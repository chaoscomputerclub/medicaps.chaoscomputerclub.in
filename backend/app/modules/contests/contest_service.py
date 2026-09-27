"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/contest_service.py — Candidate Contest & Arena Application Service
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.core.cache import delete_cache_pattern, get_cache, set_cache
from app.core.config import settings
from app.lib.cache_keys import contest_list_cache_key, TTL_CONTESTS_LIST
from app.lib.pagination import normalize_pagination, inject_pagination_headers, slice_page
from app.models.db_models import (
    Assessment,
    AssessmentSession,
    CampusPass,
    ContestProblem,
    ContestRegistration,
    MemberProfile,
    OfflineContest,
    ScoreboardEntry,
    now_utc,
)
from app.models.schemas import (
    ContestProblemResponse,
    OfflineContestResponse,
)
from app.modules.contests.contest_repository import ContestRepository
from app.services.contest_eligibility_service import (
    is_member_eligible_for_live_contest,
    is_contest_attempt_submitted,
)
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger(__name__)


class ContestService:
    """Handles candidate contest discovery, registration, arena access gates, and passes."""

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
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            if limit is not None:
                safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=100)
                inject_pagination_headers(response, len(cached), safe_limit, safe_offset)
                return slice_page(cached, safe_limit, safe_offset)
            return cached

        all_contests = await ContestRepository.list_contests(db, status=status, division=division)
        filtered_contests = [c for c in all_contests if c.slug not in ("dev-assessment-round", "dev-offline-final")]

        registered_contest_ids = set()
        submitted_contest_ids = set()
        if current_member:
            registered_contest_ids, submitted_contest_ids = await ContestRepository.get_user_registrations_and_submissions(
                db, current_member.id
            )

        payload = []
        for c in filtered_contests:
            c_dict = OfflineContestResponse.model_validate(c).model_dump()
            c_dict["registered"] = c.id in registered_contest_ids
            c_dict["is_submitted"] = c.id in submitted_contest_ids
            payload.append(c_dict)

        await set_cache(cache_key, payload, ttl_seconds=TTL_CONTESTS_LIST)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

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

        registrations, scoreboards, sessions = await ContestRepository.get_my_participations(db, current_member.id)

        sessions_by_contest_id = {}
        sessions_by_slug = {}
        for sess, assess in sessions:
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

            is_sess_submitted = (
                (sess and sess.status in ["submitted", "completed", "expired", "disqualified"])
                or bool(reg and (reg.assessment_taken or reg.status in ["submitted", "completed"]))
            )

            if contest.status == "live":
                is_contest_submitted = bool(reg and reg.status in ["submitted", "completed"])
                outcome = "submitted" if is_contest_submitted else "live"
                assessment_submitted = is_contest_submitted
            elif is_sess_submitted:
                outcome = "qualified" if (sess and sess.is_top_30_qualified) else "submitted"
                assessment_submitted = True
            elif contest.status == "upcoming":
                outcome = "registered"
                assessment_submitted = False
            elif sb:
                outcome = "qualified" if sb.rank <= 30 else "not_qualified"
                assessment_submitted = False
            else:
                outcome = "registered"
                assessment_submitted = False

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
                contest_row = await ContestRepository.get_by_id(db, contest_id)
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
                contest_row = await ContestRepository.get_by_id(db, contest_id)
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
            if current_member:
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
            else:
                response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
            return cached

        contest = await ContestRepository.get_by_slug(db, slug, with_problems=True, with_assessment=True)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        is_registered = False
        is_sub = False
        if current_member:
            reg = await ContestRepository.get_registration(db, contest.id, current_member.id)
            is_registered = reg is not None
            is_sub, _ = await is_contest_attempt_submitted(current_member, contest, db)

        payload = OfflineContestResponse.model_validate(contest).model_dump()
        payload["registered"] = is_registered
        payload["is_submitted"] = is_sub
        if contest.status == "upcoming":
            for p in payload.get("problems", []):
                idx = p.get("problem_index", "")
                p["title"] = f"Problem {idx} — sealed until contest starts"
                p["topic"] = "—"
                p["editorial_summary"] = None
                p["first_ac_seconds"] = None

        await set_cache(cache_key, payload, ttl_seconds=60)
        response.headers["X-Cache"] = "MISS"
        if current_member:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        else:
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

        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if contest.status == "live":
            is_eligible, reason = await is_member_eligible_for_live_contest(
                current_member, contest, db
            )
            if not is_eligible:
                raise HTTPException(status_code=403, detail=f"Access restricted: {reason}")

        records = await ContestRepository.get_contest_problems(db, contest.id)
        payload = [ContestProblemResponse.model_validate(p).model_dump() for p in records]
        if contest.status == "upcoming":
            for p in payload:
                idx = p.get("problem_index", "")
                p["title"] = f"Problem {idx} — sealed until contest starts"
                p["topic"] = "—"
                p["editorial_summary"] = None
                p["first_ac_seconds"] = None
        await set_cache(cache_key, payload, ttl_seconds=60)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
        return payload

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

        contest = await ContestRepository.get_by_slug(db, slug)
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

        reg = await ContestRepository.get_registration(db, contest.id, current_member.id)
        is_registered = reg is not None

        is_dev_contest = slug.startswith("dev-")
        is_dev_bypass = bool(settings.DEV_MODE and is_dev_contest)

        can_enter_live_contest = (contest_status == "live")

        if contest_status == "upcoming":
            if not is_registered:
                eligibility_message = "Registration is open. Register to participate in the contest."
            else:
                eligibility_message = "You are registered. The contest arena will unlock at the scheduled start time."
        elif contest_status == "live":
            eligibility_message = "Contest is live! Enter the arena now to start solving."
        else:
            eligibility_message = "This contest has officially concluded."

        is_submitted, _ = await is_contest_attempt_submitted(current_member, contest, db)
        is_contest_final_submitted = is_submitted or bool(reg and reg.status in ("submitted", "completed"))
        if is_contest_final_submitted:
            can_enter_live_contest = False
            eligibility_message = "Contest attempt has already been submitted. Retakes are not permitted."

        return {
            "registered": is_registered,
            "contest_slug": slug,
            "contest_status": contest_status,
            "status": "submitted" if is_contest_final_submitted else (reg.status if reg else None),
            "registered_at": reg.registered_at.isoformat() if reg else None,
            "assessment_taken": False,
            "assessment_score": 0.0,
            "assessment_rank": None,
            "assessment_status": None,
            "can_resume_assessment": False,
            "anti_cheat_violations": 0,
            "max_violations": 0,
            "remaining_seconds": 0,
            "is_top_30_qualified": True,
            "is_checked_in": True,
            "check_in_status": "checked_in",
            "can_take_assessment": False,
            "can_enter_live_contest": can_enter_live_contest and not is_contest_final_submitted,
            "eligibility_message": eligibility_message,
            "is_dev_bypass": is_dev_bypass,
        }

    @staticmethod
    async def register_for_contest(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if contest.status not in ("upcoming", "live"):
            raise HTTPException(
                status_code=400,
                detail="Registration is only open for upcoming or live contests.",
            )

        is_sub, _ = await is_contest_attempt_submitted(current_member, contest, db)
        if is_sub:
            raise HTTPException(
                status_code=400,
                detail="Contest attempt has already been submitted. Retakes are not permitted.",
            )

        existing_reg = await ContestRepository.get_registration(db, contest.id, current_member.id)
        if existing_reg:
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
        await delete_cache_pattern("cache:contests*")
        await delete_cache_pattern(f"cache:*:{current_member.id}:*")
        await delete_cache_pattern("cache:passes*")

        try:
            await broadcast_event(
                event_type="contest_registered",
                data={
                    "contest_slug": contest.slug,
                    "contest_title": contest.title,
                    "member_id": current_member.id,
                    "handle": current_member.handle,
                    "full_name": current_member.full_name or current_member.handle,
                    "registered_count": contest.registered_count,
                    "capacity": contest.seat_capacity,
                    "status": "confirmed",
                },
                contest_slug=contest.slug,
            )
        except Exception as e:
            logger.debug("Broadcast error: %s", e)

        return {
            "status": "confirmed",
            "registered": True,
            "message": f"Registration confirmed for {contest.title}. Workstation seat reserved and assessment round unlocked.",
            "venue": contest.venue,
            "registered_count": contest.registered_count,
            "capacity": contest.seat_capacity,
        }

    @staticmethod
    async def unregister_from_contest(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if contest.status not in ("upcoming", "live"):
            raise HTTPException(
                status_code=400,
                detail="You cannot unregister from a concluded or archived contest.",
            )

        reg_record = await ContestRepository.get_registration(db, contest.id, current_member.id)
        if not reg_record:
            return {
                "status": "not_registered",
                "registered": False,
                "message": f"You are not registered for {contest.title}.",
                "registered_count": contest.registered_count,
            }

        is_sub, _ = await is_contest_attempt_submitted(current_member, contest, db)
        if is_sub or (reg_record.status in ("submitted", "completed") or (contest.status != "live" and reg_record.assessment_taken)):
            raise HTTPException(
                status_code=400,
                detail="You cannot unregister after submitting your contest attempt.",
            )

        await db.delete(reg_record)
        await db.execute(
            delete(CampusPass).where(
                CampusPass.contest_id == contest.id,
                CampusPass.member_id == current_member.id,
            )
        )

        contest.registered_count = max(0, contest.registered_count - 1)
        await db.commit()

        await delete_cache_pattern("cache:contest*")
        await delete_cache_pattern("cache:contests*")
        await delete_cache_pattern(f"cache:*:{current_member.id}:*")
        await delete_cache_pattern("cache:passes*")

        try:
            await broadcast_event(
                event_type="contest_unregistered",
                data={
                    "contest_slug": contest.slug,
                    "contest_title": contest.title,
                    "member_id": current_member.id,
                    "handle": current_member.handle,
                    "registered_count": contest.registered_count,
                    "capacity": contest.seat_capacity,
                    "status": "unregistered",
                },
                contest_slug=contest.slug,
            )
        except Exception as e:
            logger.debug("Broadcast error: %s", e)

        return {
            "status": "unregistered",
            "registered": False,
            "message": f"Successfully unregistered from {contest.title}.",
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
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        effective_code = pass_code or f"CCC-PASS-{uuid.uuid4().hex[:6].upper()}"
        assigned_seat = "UNASSIGNED"

        if current_member:
            pass_obj = await ContestRepository.get_campus_pass(db, contest.id, current_member.id)
            if not pass_obj:
                existing_passes_count = await ContestRepository.count_campus_passes(db, contest.id)
                assigned_seat = f"LAB-04-PC{existing_passes_count + 1:02d}"
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
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        now = datetime.now(timezone.utc)
        new_starts = now + timedelta(hours=24, seconds=seconds)
        contest.starts_at = new_starts
        contest.status = "upcoming"

        from sqlalchemy import select
        a_res = await db.execute(select(Assessment).where((Assessment.contest_id == contest.id) | (Assessment.slug == slug)))
        assessment = a_res.scalars().first()
        if assessment:
            assessment.starts_at = now + timedelta(seconds=seconds)
            assessment.ends_at = new_starts
            assessment.is_active = True

        await db.commit()
        await delete_cache_pattern("cache:contest*")
        await delete_cache_pattern("cache:contests*")

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
        contest = await ContestRepository.get_by_slug(db, slug, with_problems=True)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if not current_member:
            raise HTTPException(status_code=401, detail="Authentication required to enter contest arena.")

        from app.core.security import is_privileged_test_member
        is_test_user = is_privileged_test_member(current_member)

        is_sub, sub_reason = await is_contest_attempt_submitted(current_member, contest, db)
        if is_sub:
            raise HTTPException(
                status_code=403,
                detail=sub_reason or "Contest attempt has already been submitted. Retakes are not permitted.",
            )

        if not (settings.DEV_MODE and slug.startswith("dev-")):
            if contest.status == "upcoming":
                raise HTTPException(
                    status_code=403,
                    detail="Contest has not started yet. The arena unlocks at the scheduled start time.",
                )
            if contest.status == "live":
                is_eligible, reason = await is_member_eligible_for_live_contest(
                    current_member, contest, db
                )
                if not is_eligible:
                    raise HTTPException(status_code=403, detail=f"Arena access denied: {reason}")

        assigned_seat = None
        pass_code = None
        check_in_status = "checked_in"

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
