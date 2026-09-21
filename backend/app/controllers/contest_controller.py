"""
Chaos Computer Club — Medi-Caps Chapter
controllers/contest_controller.py — Offline Contests & Arena Workspace Orchestrator
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import delete_cache_pattern, get_cache, set_cache
from app.core.config import settings
from app.engine.enums import ComparisonMode, Language
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema
from app.lib.cache_keys import contest_list_cache_key, TTL_CONTESTS_LIST
from app.lib.pagination import normalize_pagination, inject_pagination_headers, slice_page

from app.models.db_models import (
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    CampusPass,
    ContestProblem,
    ContestRegistration,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    ScoreboardEntry,
    now_utc,
)
from app.models.schemas import (
    ContestArenaProblemResponse,
    ContestArenaResponse,
    ContestProblemResponse,
    OfflineContestResponse,
)
from app.schemas.dynamic_contest import (
    ContestCloneRequest,
    ContestStatusChangeRequest,
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    PresetContestLaunchRequest,
    ProblemCreateSchema,
)
from app.services.contest_eligibility_service import is_member_eligible_for_live_contest
from app.services.dynamic_contest_service import DynamicContestService
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger(__name__)


class ArenaRunRequest(BaseModel):
    problem_id: str
    language: Language
    code: str
    custom_stdin: Optional[str] = None


class ArenaSubmitRequest(BaseModel):
    problem_id: str
    language: Language
    code: str


class ContestController:
    """Orchestrator for candidate contests, registration status, arena code execution, and dynamic management."""

    @staticmethod
    async def list_contests(
        response: Response,
        status: Optional[str],
        division: Optional[str],
        db: AsyncSession,
        current_member: Optional[MemberProfile],
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> List[Dict[str, Any]]:
        member_key = current_member.id if current_member else "anon"
        cache_key = contest_list_cache_key(status, division, member_key)
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_CONTESTS_LIST}, stale-while-revalidate=15"
            if limit is not None:
                safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=100)
                inject_pagination_headers(response, len(cached), safe_limit, safe_offset)
                return slice_page(cached, safe_limit, safe_offset)
            return cached

        stmt = select(OfflineContest).options(
            selectinload(OfflineContest.problems),
            selectinload(OfflineContest.assessment),
        )

        if status:
            stmt = stmt.where(OfflineContest.status == status)
        if division:
            stmt = stmt.where(OfflineContest.division == division)

        stmt = stmt.order_by(OfflineContest.starts_at.desc())
        result = await db.execute(stmt)
        all_contests = result.scalars().all()

        filtered_contests = [c for c in all_contests if c.slug not in ("dev-assessment-round", "dev-offline-final")]

        registered_contest_ids = set()
        if current_member:
            user_regs = await db.execute(
                select(ContestRegistration.contest_id).where(
                    ContestRegistration.member_id == current_member.id
                )
            )
            registered_contest_ids = set(user_regs.scalars().all())

        payload = []
        for c in filtered_contests:
            c_dict = OfflineContestResponse.model_validate(c).model_dump()
            c_dict["registered"] = c.id in registered_contest_ids
            payload.append(c_dict)

        await set_cache(cache_key, payload, ttl_seconds=TTL_CONTESTS_LIST)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_CONTESTS_LIST}, stale-while-revalidate=15"

        if limit is not None:
            safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=100)
            inject_pagination_headers(response, len(payload), safe_limit, safe_offset)
            return slice_page(payload, safe_limit, safe_offset)

        return payload


    @staticmethod
    async def get_my_participated_contests(
        response: Response,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        reg_query = (
            select(ContestRegistration, OfflineContest)
            .join(OfflineContest, ContestRegistration.contest_id == OfflineContest.id)
            .where(ContestRegistration.member_id == current_member.id)
            .order_by(ContestRegistration.registered_at.desc())
        )
        reg_res = await db.execute(reg_query)
        registrations = reg_res.all()

        sb_query = (
            select(ScoreboardEntry, OfflineContest)
            .join(OfflineContest, ScoreboardEntry.contest_id == OfflineContest.id)
            .where(ScoreboardEntry.member_id == current_member.id)
        )
        sb_res = await db.execute(sb_query)
        scoreboards = {row[1].id: row[0] for row in sb_res.all()}

        sess_query = (
            select(AssessmentSession, Assessment)
            .join(Assessment, AssessmentSession.assessment_id == Assessment.id)
            .where(AssessmentSession.member_id == current_member.id)
        )
        sess_res = await db.execute(sess_query)
        sessions_by_contest_id = {}
        sessions_by_slug = {}
        for sess, assess in sess_res.all():
            if assess.contest_id:
                sessions_by_contest_id[assess.contest_id] = (sess, assess)
            if assess.slug:
                sessions_by_slug[assess.slug] = (sess, assess)

        results = []
        seen_contest_ids = set()

        for reg, contest in registrations:
            seen_contest_ids.add(contest.id)
            sb = scoreboards.get(contest.id)
            sess_pair = sessions_by_contest_id.get(contest.id) or sessions_by_slug.get(contest.slug)
            sess = sess_pair[0] if sess_pair else None

            is_sess_submitted = (sess and sess.status in ["submitted", "completed", "expired"]) or bool(reg and reg.assessment_taken)
            assessment_submitted = is_sess_submitted

            if is_sess_submitted:
                outcome = "qualified" if (sess and sess.is_top_30_qualified) else ("submitted" if contest.status == "upcoming" else "pending")
            elif contest.status == "upcoming":
                outcome = "registered"
            elif contest.status == "live":
                outcome = "live"
            elif sb:
                outcome = "qualified" if sb.rank <= 30 else "not_qualified"
            else:
                outcome = "registered"

            score = sb.score if sb else (round(sess.total_score) if (sess and sess.total_score is not None) else (round(reg.assessment_score) if (reg and reg.assessment_score is not None and reg.assessment_taken) else None))
            rank = sb.rank if sb else None
            rating_delta = sb.rating_delta if (sb and sb.rating_delta is not None) else None

            results.append({
                "contest_id": contest.id,
                "contest_slug": contest.slug,
                "contest_title": contest.title,
                "season": contest.season,
                "status": contest.status,
                "venue": contest.venue,
                "participated_at": reg.registered_at.isoformat(),
                "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
                "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
                "score": score,
                "rank": rank,
                "rating_delta": rating_delta,
                "participants": contest.registered_count,
                "outcome": outcome,
                "assessment_submitted": assessment_submitted,
                "assessment_status": sess.status if sess else ("submitted" if (reg and reg.assessment_taken) else None),
                "assessment_score": score,
                "offline_result": f"Certificate CCC-{contest.slug.upper()}" if (sb and sb.rank <= 30) else None,
            })

        for contest_id, (sess, assess) in sessions_by_contest_id.items():
            if contest_id not in seen_contest_ids:
                contest_row = await db.get(OfflineContest, contest_id)
                if contest_row:
                    seen_contest_ids.add(contest_id)
                    is_sess_submitted = sess.status in ["submitted", "completed", "expired"]
                    outcome = "qualified" if sess.is_top_30_qualified else ("submitted" if contest_row.status == "upcoming" else "pending")
                    score = round(sess.total_score) if sess.total_score is not None else None
                    results.append({
                        "contest_id": contest_row.id,
                        "contest_slug": contest_row.slug,
                        "contest_title": contest_row.title,
                        "season": contest_row.season,
                        "status": contest_row.status,
                        "venue": contest_row.venue,
                        "participated_at": sess.started_at.isoformat() if sess.started_at else contest_row.starts_at.isoformat(),
                        "starts_at": contest_row.starts_at.isoformat() if contest_row.starts_at else None,
                        "ends_at": contest_row.ends_at.isoformat() if contest_row.ends_at else None,
                        "score": score,
                        "rank": None,
                        "rating_delta": None,
                        "participants": contest_row.registered_count,
                        "outcome": outcome,
                        "assessment_submitted": is_sess_submitted,
                        "assessment_status": sess.status,
                        "assessment_score": score,
                        "offline_result": None,
                    })

        for contest_id, sb in scoreboards.items():
            if contest_id not in seen_contest_ids:
                contest_row = await db.get(OfflineContest, contest_id)
                if contest_row:
                    seen_contest_ids.add(contest_id)
                    results.append({
                        "contest_id": contest_row.id,
                        "contest_slug": contest_row.slug,
                        "contest_title": contest_row.title,
                        "season": contest_row.season,
                        "status": contest_row.status,
                        "venue": contest_row.venue,
                        "participated_at": contest_row.starts_at.isoformat() if contest_row.starts_at else None,
                        "starts_at": contest_row.starts_at.isoformat() if contest_row.starts_at else None,
                        "ends_at": contest_row.ends_at.isoformat() if contest_row.ends_at else None,
                        "score": sb.score,
                        "rank": sb.rank,
                        "rating_delta": sb.rating_delta if (sb and sb.rating_delta is not None) else None,
                        "participants": contest_row.registered_count,
                        "outcome": "qualified" if sb.rank <= 30 else "not_qualified",
                        "assessment_submitted": True,
                        "assessment_status": "submitted",
                        "assessment_score": sb.score,
                        "offline_result": f"Certificate CCC-{contest_row.slug.upper()}",
                    })

        return results

    @staticmethod
    async def get_contest_detail(
        slug: str,
        response: Response,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        member_key = current_member.id if current_member else "anon"
        cache_key = f"cache:contest:detail:{slug}:{member_key}"
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
            return cached

        stmt = (
            select(OfflineContest)
            .options(
                selectinload(OfflineContest.problems),
                selectinload(OfflineContest.assessment),
            )
            .where(OfflineContest.slug == slug)
        )
        result = await db.execute(stmt)
        contest = result.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        is_registered = False
        if current_member:
            reg_check = await db.execute(
                select(ContestRegistration.id).where(
                    ContestRegistration.contest_id == contest.id,
                    ContestRegistration.member_id == current_member.id,
                )
            )
            is_registered = reg_check.scalars().first() is not None

        payload = OfflineContestResponse.model_validate(contest).model_dump()
        payload["registered"] = is_registered
        await set_cache(cache_key, payload, ttl_seconds=60)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
        return payload

    @staticmethod
    async def get_contest_problems(
        slug: str,
        response: Response,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> List[Dict[str, Any]]:
        cache_key = f"cache:contest:problems:{slug}"
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
            return cached

        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if contest.status == "live":
            is_eligible, reason = await is_member_eligible_for_live_contest(
                current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
            )
            if not is_eligible:
                raise HTTPException(status_code=403, detail=f"Access restricted: {reason}")

        res = await db.execute(
            select(ContestProblem)
            .where(ContestProblem.contest_id == contest.id)
            .order_by(ContestProblem.problem_index.asc())
        )
        records = res.scalars().all()
        payload = [ContestProblemResponse.model_validate(p).model_dump() for p in records]
        await set_cache(cache_key, payload, ttl_seconds=60)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
        return records

    @staticmethod
    async def get_registration_status(
        slug: str,
        response: Response,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        contest_status = contest.status

        if not current_member:
            return {
                "registered": False,
                "contest_slug": slug,
                "contest_status": contest_status,
                "status": None,
                "registered_at": None,
                "assessment_taken": False,
                "assessment_score": 0.0,
                "assessment_rank": None,
                "assessment_status": None,
                "is_top_30_qualified": False,
                "can_take_assessment": False,
                "can_enter_live_contest": False,
                "eligibility_message": "Sign in to register or check your contest standing.",
            }

        reg_res = await db.execute(
            select(ContestRegistration).where(
                ContestRegistration.contest_id == contest.id,
                ContestRegistration.member_id == current_member.id,
            )
        )
        reg = reg_res.scalars().first()
        is_registered = reg is not None

        assessment_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = assessment_res.scalars().first()
        if not assessment and contest.status == "live":
            assess_season_res = await db.execute(
                select(Assessment).where(
                    (Assessment.slug == "medicaps-offline-open-2026") | (Assessment.is_active == True)
                )
            )
            assessment = assess_season_res.scalars().first()

        assessment_taken = False
        assessment_score = 0.0
        assessment_rank = None
        assessment_session_status = None
        is_top_30_qualified = False
        can_resume_assessment = False
        anti_cheat_violations = 0
        max_violations = 3
        remaining_seconds = 0

        if assessment:
            max_violations = assessment.max_violations
            s_res = await db.execute(
                select(AssessmentSession).where(
                    AssessmentSession.assessment_id == assessment.id,
                    AssessmentSession.member_id == current_member.id,
                )
            )
            my_session = s_res.scalars().first()
            if my_session:
                assessment_score = my_session.total_score
                assessment_session_status = my_session.status
                anti_cheat_violations = my_session.anti_cheat_violations

                started_at = my_session.started_at
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                duration = assessment.duration_minutes or 45
                expires_at = started_at + timedelta(minutes=duration)
                is_session_expired = now_utc() >= expires_at

                if my_session.status in ("submitted", "disqualified") or is_session_expired:
                    assessment_taken = True
                    can_resume_assessment = False
                    remaining_seconds = 0
                else:
                    assessment_taken = False
                    can_resume_assessment = True
                    remaining_seconds = max(0, int((expires_at - now_utc()).total_seconds()))

                all_sessions_res = await db.execute(
                    select(AssessmentSession)
                    .where(
                        AssessmentSession.assessment_id == assessment.id,
                        AssessmentSession.status.in_(["in_progress", "submitted"]),
                    )
                    .order_by(desc(AssessmentSession.total_score), AssessmentSession.total_penalty_seconds)
                )
                all_sessions = all_sessions_res.scalars().all()
                for rank_num, s in enumerate(all_sessions, start=1):
                    if s.member_id == current_member.id:
                        assessment_rank = rank_num
                        break

                is_top_30_qualified = (
                    my_session.is_top_30_qualified or
                    (assessment_rank is not None and assessment_rank <= 30)
                )

        pass_res = await db.execute(
            select(CampusPass).where(
                CampusPass.contest_id == contest.id,
                CampusPass.member_id == current_member.id,
            )
        )
        pass_obj = pass_res.scalars().first()
        check_in_status = pass_obj.check_in_status if pass_obj else "not_issued"
        is_checked_in = check_in_status == "checked_in"

        from app.services.contest_lifecycle_service import assessment_available
        assessment_window_open = False
        if contest and contest.starts_at:
            assessment_window_open, _ = assessment_available(contest_status, contest.starts_at)

        from app.core.security import is_privileged_test_member
        is_test_user = is_privileged_test_member(current_member)
        is_dev_contest = slug.startswith("dev-")
        is_dev_bypass = bool(settings.is_dev_bypass_enabled or is_dev_contest or is_test_user)

        can_take_assessment = (
            contest_status == "upcoming"
            and is_registered
            and not assessment_taken
            and assessment_window_open
            and assessment_session_status not in ("submitted", "disqualified")
        )
        can_enter_live_contest = (contest_status == "live" and is_top_30_qualified and is_checked_in)

        if not settings.FEATURE_ASSESSMENT_AND_QR_ENABLED:
            can_take_assessment = False
            can_resume_assessment = False
            is_top_30_qualified = True
            is_checked_in = True
            check_in_status = "checked_in"
            can_enter_live_contest = (contest_status == "live" and is_registered) or is_test_user

            if is_test_user:
                is_registered = True
                can_enter_live_contest = True
                eligibility_message = "Test mode active: full arena access unlocked."
            elif contest_status == "upcoming":
                if not is_registered:
                    eligibility_message = "Registration is open. Register to participate in the contest."
                else:
                    eligibility_message = "You are registered. The contest arena will unlock at the scheduled start time."
            elif contest_status == "live":
                can_enter_live_contest = True
                eligibility_message = "Contest is live! Enter the arena now to start solving."
            else:
                eligibility_message = "This contest has officially concluded."
        elif is_test_user or is_dev_contest:
            is_registered = True
            is_top_30_qualified = True
            is_checked_in = True
            can_enter_live_contest = True
            can_take_assessment = True
            assessment_window_open = True
            is_dev_bypass = True
            eligibility_message = "⚡ TEST MODE ACTIVE: Full assessment & contest arena access unlocked for your account."
        elif is_dev_bypass:
            is_registered = True
            can_take_assessment = not (assessment_taken or assessment_session_status in ("submitted", "disqualified"))
            eligibility_message = "⚡ DEV BYPASS ACTIVE: Unrestricted development testing mode enabled."
        elif can_resume_assessment:
            mins_left = remaining_seconds // 60
            eligibility_message = f"⚠️ Assessment in progress ({mins_left}m remaining, Warning {anti_cheat_violations} of {max_violations}). Click 'Resume Contest' to continue."
        elif contest_status == "upcoming":
            if not is_registered:
                eligibility_message = "Registration open. Register to take the Phase 1 Online Screening Assessment."
            elif assessment_taken:
                eligibility_message = f"Screening submitted. Score: {assessment_score} pts (Current Rank: #{assessment_rank or chr(0x2014)}). Top 30 cadets will advance when the contest goes LIVE."
            elif not assessment_window_open:
                from app.services.contest_lifecycle_service import assessment_window, utcnow
                if contest and contest.starts_at:
                    window = assessment_window(contest.starts_at)
                    if utcnow() < window.opens_at:
                        eligibility_message = f"Assessment window opens at {window.opens_at.strftime('%d %b %Y, %H:%M UTC')}. You can enter once it unlocks."
                    else:
                        eligibility_message = "The Round 1 assessment window has closed."
                else:
                    eligibility_message = "Assessment window is not yet open."
            else:
                eligibility_message = "Registration confirmed. Round 1 window is open — start your assessment now."
        elif contest_status == "live":
            if is_top_30_qualified:
                if is_checked_in or is_dev_bypass:
                    eligibility_message = f"✓ Top 30 Qualified Finalist (Rank #{assessment_rank or 'Top 30'}). Gate check-in verified. Enter the Live Contest Lab."
                else:
                    eligibility_message = f"✓ Top 30 Qualified Finalist (Rank #{assessment_rank or 'Top 30'}). Physical QR proctor scan required at lab entrance before entering arena."
            else:
                eligibility_message = "🔒 Live Final is restricted strictly to Top 30 assessment qualifiers. You are currently not eligible."
        else:
            eligibility_message = "This contest has officially concluded."

        return {
            "registered": is_registered,
            "contest_slug": slug,
            "contest_status": contest_status,
            "status": reg.status if reg else None,
            "registered_at": reg.registered_at.isoformat() if reg else None,
            "assessment_taken": assessment_taken,
            "assessment_score": assessment_score,
            "assessment_rank": assessment_rank,
            "assessment_status": assessment_session_status,
            "can_resume_assessment": can_resume_assessment,
            "anti_cheat_violations": anti_cheat_violations,
            "max_violations": max_violations,
            "remaining_seconds": remaining_seconds,
            "is_top_30_qualified": is_top_30_qualified,
            "is_checked_in": is_checked_in,
            "check_in_status": check_in_status,
            "can_take_assessment": can_take_assessment,
            "can_enter_live_contest": can_enter_live_contest,
            "eligibility_message": eligibility_message,
            "is_dev_bypass": is_dev_bypass,
        }

    @staticmethod
    async def register_for_contest(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if contest.status not in ("upcoming", "live"):
            raise HTTPException(
                status_code=400,
                detail="Registration is only open for upcoming or live contests.",
            )

        existing_reg = await db.execute(
            select(ContestRegistration).where(
                ContestRegistration.contest_id == contest.id,
                ContestRegistration.member_id == current_member.id,
            )
        )
        if existing_reg.scalars().first():
            return {
                "status": "already_registered",
                "registered": True,
                "message": f"You are already registered for {contest.title}. Proceed to the assessment studio.",
                "venue": contest.venue,
                "registered_count": contest.registered_count,
                "capacity": contest.seat_capacity,
            }

        if contest.registered_count >= contest.seat_capacity:
            raise HTTPException(status_code=400, detail="All lab workstation seats are filled for this contest.")

        new_reg = ContestRegistration(
            contest_id=contest.id,
            member_id=current_member.id,
            status="confirmed",
        )
        db.add(new_reg)
        contest.registered_count += 1
        await db.commit()
        await delete_cache_pattern("cache:contest*")

        return {
            "status": "confirmed",
            "registered": True,
            "message": f"Registration confirmed for {contest.title}. Workstation seat reserved and assessment round unlocked.",
            "venue": contest.venue,
            "registered_count": contest.registered_count,
            "capacity": contest.seat_capacity,
        }

    @staticmethod
    async def check_in_contest(
        slug: str,
        pass_code: Optional[str],
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        assigned_seat = "Lab-04-WS-07"
        effective_code = pass_code or f"CCC-PASS-{uuid.uuid4().hex[:6].upper()}"

        if current_member:
            pass_res = await db.execute(
                select(CampusPass).where(
                    CampusPass.contest_id == contest.id,
                    CampusPass.member_id == current_member.id,
                )
            )
            pass_obj = pass_res.scalars().first()
            if not pass_obj:
                pass_obj = CampusPass(
                    contest_id=contest.id,
                    member_id=current_member.id,
                    pass_code=effective_code,
                    seat_number=assigned_seat,
                    qr_data=f"ccc://medicaps/contest/{contest.slug}/cadet/{current_member.handle}",
                    check_in_status="checked_in",
                    issued_at=now_utc(),
                )
                db.add(pass_obj)
            else:
                pass_obj.check_in_status = "checked_in"
                assigned_seat = pass_obj.seat_number
            await db.commit()
            await delete_cache_pattern("cache:contest*")

            try:
                await broadcast_event(
                    event_type="pass_checked_in",
                    data={
                        "member_id": current_member.id,
                        "handle": current_member.handle,
                        "candidate_name": current_member.full_name or current_member.handle,
                        "pass_code": effective_code,
                        "seat_number": assigned_seat,
                        "status": "checked_in",
                        "checked_in_at": now_utc().isoformat(),
                    },
                    contest_slug=contest.slug,
                )
            except Exception as e:
                logger.debug("Broadcast error: %s", e)

        return {
            "success": True,
            "status": "checked_in",
            "message": f"Physical presence verified. Workstation assigned: {assigned_seat}",
            "contest": contest.title,
            "seat": assigned_seat,
            "pass_code": effective_code,
        }

    @staticmethod
    async def reset_contest_timer(
        slug: str,
        seconds: int,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        now = datetime.now(timezone.utc)
        new_starts = now + timedelta(hours=24, seconds=seconds)
        contest.starts_at = new_starts
        contest.status = "upcoming"

        a_res = await db.execute(select(Assessment).where((Assessment.contest_id == contest.id) | (Assessment.slug == slug)))
        assessment = a_res.scalars().first()
        if assessment:
            assessment.starts_at = now + timedelta(seconds=seconds)
            assessment.ends_at = new_starts
            assessment.is_active = True

        await db.commit()
        await delete_cache_pattern("cache:contest*")

        try:
            await broadcast_event(
                event_type="contest_timer_reset",
                data={
                    "contest_slug": slug,
                    "starts_at": new_starts.isoformat(),
                    "countdown_seconds": seconds,
                },
                contest_slug=slug,
            )
        except Exception as e:
            logger.debug("Broadcast error: %s", e)

        return {
            "status": "timer_reset",
            "slug": slug,
            "countdown_seconds": seconds,
            "starts_at": new_starts.isoformat(),
        }

    @staticmethod
    async def get_contest_arena_data(
        slug: str,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        c_res = await db.execute(
            select(OfflineContest)
            .options(selectinload(OfflineContest.problems))
            .where(OfflineContest.slug == slug)
        )
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        from app.core.security import is_privileged_test_member
        is_test_user = is_privileged_test_member(current_member)

        if not is_test_user and contest.status == "live" and not slug.startswith("dev-"):
            is_eligible, reason = await is_member_eligible_for_live_contest(
                current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
            )
            if not is_eligible:
                raise HTTPException(status_code=403, detail=f"Arena access denied: {reason}")

        assigned_seat = "Lab-04-WS-07"
        pass_code = None
        check_in_status = "checked_in" if is_test_user else "issued"

        if current_member:
            pass_res = await db.execute(
                select(CampusPass).where(
                    CampusPass.contest_id == contest.id,
                    CampusPass.member_id == current_member.id,
                )
            )
            pass_obj = pass_res.scalars().first()
            if pass_obj:
                assigned_seat = pass_obj.seat_number
                pass_code = pass_obj.pass_code
                check_in_status = "checked_in" if is_test_user else pass_obj.check_in_status

        problems = sorted(contest.problems, key=lambda p: p.problem_index)

        fallback_descriptions = {
            "A": "At Medi-Caps University, campus pass numbers are issued as alphanumeric strings. Two passes are considered a 'mirror pair' if one string is the exact reverse of the other (e.g. 'AB' and 'BA'). Given a list of N pass strings, determine the total count of valid unordered mirror pairs (i < j where passes[i] is the reverse of passes[j]).",
            "B": "The Medi-Caps lab router has M megabits of total bandwidth to distribute among K competing lab processes. Process i requires at least min_i bandwidth and can consume at most max_i bandwidth, yielding utility = allocated_bandwidth * priority_i. Find the maximum total utility achievable such that the sum of allocated bandwidth does not exceed M and every process receives at least its minimum requirement. If the total minimum requirements exceed M, output -1.",
            "C": "An air-gapped lab network consists of N workstations numbered 1 to N and M bidirectional communication channels. Each channel connects workstation u and v with latency L (in milliseconds). Workstation 1 needs to transmit an encrypted cryptographic key to workstation N. To avoid packet interception, you may deploy at most K quantum booster repeaters at chosen intermediate workstations along the path. A repeater reduces the latency of its adjacent outgoing channel by half (floor division). Find the minimum total transmission latency from workstation 1 to workstation N."
        }

        arena_problems = []
        for p in problems:
            desc = getattr(p, "description", None) or fallback_descriptions.get(p.problem_index, f"Problem {p.problem_index}: {p.title}")
            arena_problems.append({
                "id": p.id,
                "contest_id": p.contest_id,
                "problem_index": p.problem_index,
                "title": p.title,
                "topic": p.topic,
                "points": p.points,
                "difficulty": getattr(p, "difficulty", None) or "MEDIUM",
                "description": desc,
                "input_format": getattr(p, "input_format", None) or "Standard competitive programming input format.",
                "output_format": getattr(p, "output_format", None) or "Standard output format.",
                "constraints": getattr(p, "constraints", None) or "Time Limit: 2.0s · Memory: 256MB",
                "time_limit": getattr(p, "time_limit", 2.0) or 2.0,
                "memory_limit": getattr(p, "memory_limit", 256) or 256,
                "starter_codes": getattr(p, "starter_codes", None) or {},
                "sample_testcases": getattr(p, "sample_testcases", None) or [],
            })

        now_dt = datetime.now(timezone.utc)
        arena_ends_at = contest.ends_at
        if is_test_user:
            # For test users, ensure ends_at is at least 2 hours in future so the arena clock gives them full testing time
            if not arena_ends_at or (arena_ends_at.tzinfo is None and arena_ends_at.replace(tzinfo=timezone.utc) <= now_dt) or (arena_ends_at.tzinfo is not None and arena_ends_at <= now_dt):
                arena_ends_at = now_dt + timedelta(hours=2)

        return {
            "contest_id": contest.id,
            "slug": contest.slug,
            "title": contest.title,
            "season": contest.season,
            "status": contest.status,
            "starts_at": contest.starts_at.isoformat() if contest.starts_at else "",
            "ends_at": arena_ends_at.isoformat() if arena_ends_at else "",
            "venue": contest.venue,
            "environment": contest.environment,
            "chief_proctors": contest.chief_proctors if contest.chief_proctors else ["Chief Proctor", "CCC Operations Desk"],
            "assigned_seat": assigned_seat,
            "pass_code": pass_code,
            "check_in_status": check_in_status,
            "is_proctored": True,
            "is_faculty_proctored": True,
            "problems": arena_problems,
            "server_time": now_dt.isoformat(),
        }

    @staticmethod
    async def run_arena_code(
        slug: str,
        payload: ArenaRunRequest,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        from app.core.security import is_privileged_test_member
        is_test_user = is_privileged_test_member(current_member)

        if not is_test_user and contest.status == "live" and not slug.startswith("dev-"):
            is_eligible, reason = await is_member_eligible_for_live_contest(
                current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
            )
            if not is_eligible:
                raise HTTPException(status_code=403, detail=f"Arena execution denied: {reason}")

        p_res = await db.execute(select(ContestProblem).where(ContestProblem.id == payload.problem_id))
        problem = p_res.scalars().first()
        if not problem:
            raise HTTPException(status_code=404, detail="Contest problem not found.")

        if payload.custom_stdin is not None:
            tcs = [TestCaseSchema(id="custom", stdin=payload.custom_stdin, expected_output="")]
        else:
            sample_list = getattr(problem, "sample_testcases", None) or []
            tcs = [
                TestCaseSchema(
                    id=f"sample_{i+1}",
                    name=f"Sample Test {i+1}",
                    stdin=s.get("stdin") if s.get("stdin") is not None else s.get("input", ""),
                    expected_output=s.get("expected_output") if s.get("expected_output") is not None else s.get("output", ""),
                )
                for i, s in enumerate(sample_list)
            ]
            if not tcs:
                tcs = [TestCaseSchema(id="sample_1", name="Sample 1", stdin="", expected_output="")]

        from app.engine.harness import prepare_solution_code
        exec_code = prepare_solution_code(
            code=payload.code,
            language=payload.language,
            problem_index=problem.problem_index,
            starter_codes=getattr(problem, "starter_codes", None) or {},
        )

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=payload.language,
            code=exec_code,
            testcases=tcs,
            time_limit=getattr(problem, "time_limit", 2.0) or 2.0,
            memory_limit_mb=getattr(problem, "memory_limit", 256) or 256,
            comparison_mode=ComparisonMode.TRIMMED,
        )

        return {
            "success": exec_result.success,
            "verdict": exec_result.verdict,
            "stdout": exec_result.stdout,
            "stderr": exec_result.stderr,
            "compile_output": exec_result.compile_output,
            "time": exec_result.time,
            "memory": exec_result.memory,
            "passed_testcases": exec_result.passed_testcases,
            "total_testcases": exec_result.total_testcases,
            "score": exec_result.score,
            "testcase_results": [
                {
                    "testcase_id": tr.testcase_id,
                    "name": tr.name,
                    "passed": tr.passed,
                    "verdict": tr.verdict,
                    "stdout": tr.stdout,
                    "expected_output": tr.expected_output,
                    "stdin": (tcs[i].stdin if i < len(tcs) else ""),
                    "stderr": tr.stderr,
                    "wall_time_ms": tr.wall_time_ms,
                }
                for i, tr in enumerate(exec_result.testcase_results)
            ],
        }

    @staticmethod
    async def submit_arena_code(
        slug: str,
        payload: ArenaSubmitRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        from app.core.security import is_privileged_test_member
        is_test_user = is_privileged_test_member(current_member)

        if not is_test_user and contest.status == "live" and not slug.startswith("dev-"):
            is_eligible, reason = await is_member_eligible_for_live_contest(
                current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
            )
            if not is_eligible:
                raise HTTPException(status_code=403, detail=f"Arena submission denied: {reason}")

        p_res = await db.execute(select(ContestProblem).where(ContestProblem.id == payload.problem_id))
        problem = p_res.scalars().first()
        if not problem:
            raise HTTPException(status_code=404, detail="Contest problem not found.")

        samples = getattr(problem, "sample_testcases", None) or []
        hidden = getattr(problem, "hidden_testcases", None) or []
        all_raw = samples + hidden

        all_tcs: list[TestCaseSchema] = []
        for i, s in enumerate(all_raw):
            all_tcs.append(
                TestCaseSchema(
                    id=f"tc_{i+1}",
                    name=f"Test {i+1}",
                    stdin=s.get("stdin") if s.get("stdin") is not None else s.get("input", ""),
                    expected_output=s.get("expected_output") if s.get("expected_output") is not None else s.get("output", ""),
                    hidden=(i >= len(samples)),
                    weight=1.0,
                )
            )
        if not all_tcs:
            all_tcs = [TestCaseSchema(id="tc_1", name="Test 1", stdin="", expected_output="")]

        from app.engine.harness import prepare_solution_code
        exec_code = prepare_solution_code(
            code=payload.code,
            language=payload.language,
            problem_index=problem.problem_index,
            starter_codes=getattr(problem, "starter_codes", None) or {},
        )

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=payload.language,
            code=exec_code,
            testcases=all_tcs,
            time_limit=getattr(problem, "time_limit", 2.0) or 2.0,
            memory_limit_mb=getattr(problem, "memory_limit", 256) or 256,
            comparison_mode=ComparisonMode.TRIMMED,
        )

        is_accepted = exec_result.passed_testcases == exec_result.total_testcases
        verdict_str = "ACCEPTED" if is_accepted else (exec_result.verdict or "WRONG_ANSWER")
        points_awarded = problem.points if is_accepted else int(problem.points * (exec_result.passed_testcases / max(1, exec_result.total_testcases)))

        sub = ContestSubmission(
            contest_id=contest.id,
            problem_id=problem.id,
            member_id=current_member.id,
            handle=current_member.handle or f"cadet_{current_member.id[:6]}",
            language=str(payload.language),
            code=payload.code,
            verdict=verdict_str,
            passed_testcases=exec_result.passed_testcases,
            total_testcases=exec_result.total_testcases,
            execution_time=exec_result.time or 0.0,
            memory_used=exec_result.memory or 0,
            points_awarded=points_awarded,
            submitted_at=now_utc(),
        )
        db.add(sub)

        if is_accepted:
            problem.solved_count += 1

        sb_res = await db.execute(
            select(ScoreboardEntry).where(
                ScoreboardEntry.contest_id == contest.id,
                ScoreboardEntry.member_id == current_member.id,
            )
        )
        sb_entry = sb_res.scalars().first()
        if not sb_entry:
            sb_entry = ScoreboardEntry(
                contest_id=contest.id,
                member_id=current_member.id,
                rank=999,
                handle=current_member.handle or f"cadet_{current_member.id[:6]}",
                full_name=current_member.full_name or "Cadet",
                department=current_member.department or "CSE",
                batch=current_member.batch or "2023-27",
                division="open",
                score=points_awarded,
                solved=1 if is_accepted else 0,
                penalty_seconds=120,
                telemetry=[{"problem_index": problem.problem_index, "status": "solved" if is_accepted else "failed", "attempts": 1, "is_first_ac": False}],
            )
            db.add(sb_entry)
        else:
            if is_accepted:
                sb_entry.score += points_awarded
                sb_entry.solved += 1

        await db.commit()
        await delete_cache_pattern("cache:scoreboard*")
        await delete_cache_pattern("cache:contest*")

        try:
            await broadcast_event(
                event_type="submission_evaluated",
                data={
                    "contest_slug": slug,
                    "problem_index": problem.problem_index,
                    "problem_id": problem.id,
                    "handle": current_member.handle,
                    "verdict": verdict_str,
                    "is_accepted": is_accepted,
                    "points_awarded": points_awarded,
                    "passed_testcases": exec_result.passed_testcases,
                    "total_testcases": exec_result.total_testcases,
                },
                contest_slug=slug,
            )
        except Exception as e:
            logger.debug("Broadcast error: %s", e)

        submit_tc_results = []
        for i, tr in enumerate(exec_result.testcase_results):
            tc = all_tcs[i] if i < len(all_tcs) else None
            is_hidden = tc.hidden if tc else (i >= len(samples))
            submit_tc_results.append({
                "testcase_id": tr.testcase_id,
                "name": f"Hidden Testcase {i - len(samples) + 1}" if is_hidden else tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict,
                "is_hidden": is_hidden,
                "stdout": tr.stdout if not is_hidden else ("[Hidden output]" if not tr.passed else ""),
                "expected_output": tr.expected_output if not is_hidden else "[Hidden]",
                "input": tc.stdin if (tc and not is_hidden) else "[Hidden]",
                "stderr": tr.stderr,
                "wall_time_ms": tr.wall_time_ms,
            })

        return {
            "submission_id": sub.id,
            "success": exec_result.success,
            "verdict": verdict_str,
            "passed_testcases": exec_result.passed_testcases,
            "total_testcases": exec_result.total_testcases,
            "points_awarded": points_awarded,
            "execution_time": exec_result.time,
            "memory": exec_result.memory,
            "message": "Accepted! Solved problem awarded to scoreboard." if is_accepted else f"Verdict: {verdict_str} ({exec_result.passed_testcases}/{exec_result.total_testcases} testcases passed)",
            "testcase_results": submit_tc_results,
        }

    # Dynamic Contest endpoints mapped to DynamicContestService
    @staticmethod
    async def create_dynamic_contest(
        payload: DynamicContestCreateRequest,
        db: AsyncSession,
        admin: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        return await DynamicContestService.create_contest(payload, db, creator=admin)

    @staticmethod
    async def launch_preset(
        payload: PresetContestLaunchRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.launch_preset(payload, db)

    @staticmethod
    async def update_contest(
        slug: str,
        payload: DynamicContestUpdateRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.update_contest(slug, payload, db)

    @staticmethod
    async def delete_contest(
        slug: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.delete_contest(slug, db)

    @staticmethod
    async def add_or_update_problem(
        slug: str,
        payload: ProblemCreateSchema,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.add_or_update_problem(slug, payload, db)

    @staticmethod
    async def delete_problem(
        slug: str,
        problem_index: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.delete_problem(slug, problem_index, db)

    @staticmethod
    async def clone_contest(
        slug: str,
        payload: ContestCloneRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.clone_contest(slug, payload, db)

    @staticmethod
    async def change_contest_status(
        slug: str,
        payload: ContestStatusChangeRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.change_contest_status(
            slug,
            payload.status,
            db,
            auto_qualify_top_30=payload.auto_qualify_top_30,
        )
