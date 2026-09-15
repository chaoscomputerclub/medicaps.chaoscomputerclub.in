import uuid
from app.services.contest_eligibility_service import is_member_eligible_for_live_contest
"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Offline Contests & On-Premise Event Management Router
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.db import get_db
from app.core.cache import get_cache, set_cache, delete_cache_pattern
from app.models.db_models import (
    ContestProblem,
    MemberProfile,
    OfflineContest,
    ContestRegistration,
    Assessment,
    CampusPass,
    now_utc,
    AssessmentSession,
    ContestSubmission,
    ScoreboardEntry,
)
from app.models.schemas import ContestProblemResponse, OfflineContestResponse, ContestArenaResponse, ContestArenaProblemResponse
from app.middleware.auth import get_current_member, get_current_member_optional
from app.engine.enums import Language, Verdict, ComparisonMode
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema

class ArenaRunRequest(BaseModel):
    problem_id: str
    language: Language
    code: str
    custom_stdin: Optional[str] = None

class ArenaSubmitRequest(BaseModel):
    problem_id: str
    language: Language
    code: str

router = APIRouter(prefix="/contests", tags=["Offline Contests"])


@router.get("", response_model=List[OfflineContestResponse])
async def list_contests(
    response: Response,
    status: Optional[str] = Query(None, description="Filter by: live, upcoming, finished"),
    division: Optional[str] = Query(None, description="Filter by: division_1, division_2, division_3, open"),
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """
    List offline campus contests.
    STRICT SECURITY RULE: Contests in LIVE status are strictly filtered out
    unless the requesting member is authenticated and eligible (Top 30 qualifier,
    registered finalist, or core team proctor).
    Protected by 30s Redis Cache-Aside.
    """
    # Only cache unauthenticated / general public view
    member_key = current_member.id if current_member else "anon"
    cache_key = f"cache:contests:list:{status or 'all'}:{division or 'all'}:{member_key}"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=15"
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

    filtered_contests = []
    for c in all_contests:
        # Exclude legacy dev screening rounds from being listed as standalone contests
        if c.slug in ("dev-assessment-round", "dev-offline-final"):
            continue
        if c.status == "live" and not c.slug.startswith("dev-"):
            is_eligible, _ = await is_member_eligible_for_live_contest(current_member, c, db)
            if not is_eligible:
                continue
        filtered_contests.append(c)

    payload = [OfflineContestResponse.model_validate(c).model_dump() for c in filtered_contests]
    await set_cache(cache_key, payload, ttl_seconds=30)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=15"
    return filtered_contests



@router.get("/my/participated", summary="List all contests the current member has registered for or participated in")
async def get_my_participated_contests(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Return all contests the current member has registered for or participated in,
    including upcoming registered contests, active online screening attempts,
    and verified on-campus scoreboard finishes.
    """
    from app.models.db_models import ContestRegistration, OfflineContest, AssessmentSession, Assessment, ScoreboardEntry

    # 1. Fetch all contest registrations for this cadet
    reg_query = (
        select(ContestRegistration, OfflineContest)
        .join(OfflineContest, ContestRegistration.contest_id == OfflineContest.id)
        .where(ContestRegistration.member_id == current_member.id)
        .order_by(ContestRegistration.registered_at.desc())
    )
    reg_res = await db.execute(reg_query)
    registrations = reg_res.all()

    # 2. Fetch all scoreboard entries (on-campus finishes)
    sb_query = (
        select(ScoreboardEntry, OfflineContest)
        .join(OfflineContest, ScoreboardEntry.contest_id == OfflineContest.id)
        .where(ScoreboardEntry.member_id == current_member.id)
    )
    sb_res = await db.execute(sb_query)
    scoreboards = {row[1].id: row[0] for row in sb_res.all()}

    # 3. Fetch all assessment sessions (online screening attempts)
    sess_query = (
        select(AssessmentSession, Assessment.slug)
        .join(Assessment, AssessmentSession.assessment_id == Assessment.id)
        .where(AssessmentSession.member_id == current_member.id)
    )
    sess_res = await db.execute(sess_query)
    sessions = {row[1]: row[0] for row in sess_res.all()}

    results = []
    seen_contest_ids = set()

    for reg, contest in registrations:
        seen_contest_ids.add(contest.id)
        sb = scoreboards.get(contest.id)
        sess = sessions.get(contest.slug)

        # Determine outcome and status
        if contest.status == "upcoming":
            outcome = "registered"
        elif contest.status == "live":
            outcome = "live"
        elif sb:
            outcome = "qualified" if sb.rank <= 30 else "not_qualified"
        elif sess and sess.status == "submitted":
            outcome = "qualified" if sess.is_top_30_qualified else "pending"
        else:
            outcome = "registered"

        score = sb.score if sb else (round(sess.total_score) if (sess and sess.total_score is not None) else None)
        rank = sb.rank if sb else None

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
            "participants": contest.registered_count,
            "outcome": outcome,
            "offline_result": f"Certificate CCC-{contest.slug.upper()}" if (sb and sb.rank <= 30) else None,
        })

    # Also add any scoreboard entries if not already in registrations
    for contest_id, sb in scoreboards.items():
        if contest_id not in seen_contest_ids:
            contest_row = await db.get(OfflineContest, contest_id)
            if contest_row:
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
                    "participants": contest_row.registered_count,
                    "outcome": "qualified" if sb.rank <= 30 else "not_qualified",
                    "offline_result": f"Certificate CCC-{contest_row.slug.upper()}",
                })

    return results


@router.get("/{slug}", response_model=OfflineContestResponse)
async def get_contest_detail(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Fetch complete specifications, venue, rules, and proctor details for an offline contest. Protected by 60s Redis Cache."""
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

    if contest.status == "live":
        is_eligible, reason = await is_member_eligible_for_live_contest(current_member, contest, db)
        if not is_eligible:
            raise HTTPException(
                status_code=403,
                detail=f"Access restricted: {reason}",
            )

    payload = OfflineContestResponse.model_validate(contest).model_dump()
    await set_cache(cache_key, payload, ttl_seconds=60)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
    return contest


@router.get("/{slug}/problems", response_model=List[ContestProblemResponse])
async def get_contest_problems(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Fetch problem set papers (A-F), first-solve times, and editorial summaries. Protected by 60s Redis Cache."""
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
        is_eligible, reason = await is_member_eligible_for_live_contest(current_member, contest, db)
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


@router.get("/{slug}/registration-status")
async def get_registration_status(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Check candidate registration, screening assessment ranking, and Top 30 live final eligibility."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    contest_status = contest.status  # "upcoming", "live", "finished"

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

    # Check candidate screening assessment session & rank
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

    if assessment:
        s_res = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment.id,
                AssessmentSession.member_id == current_member.id,
            )
        )
        my_session = s_res.scalars().first()
        if my_session:
            assessment_taken = True
            assessment_score = my_session.total_score
            assessment_session_status = my_session.status

            # Calculate candidate rank in screening leaderboard
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

    # Assessment can only be started if not yet taken AND the lifecycle window is open
    from app.services.contest_lifecycle_service import assessment_available
    assessment_window_open = False
    if contest and contest.starts_at:
        assessment_window_open, _ = assessment_available(contest_status, contest.starts_at)

    from app.core.config import settings
    is_dev_bypass = settings.is_dev_bypass_enabled or getattr(current_member, "is_core_member", False) or slug.startswith("dev-")

    can_take_assessment = (
        contest_status == "upcoming"
        and is_registered
        and not assessment_taken
        and assessment_window_open
    )
    can_enter_live_contest = (contest_status == "live" and is_top_30_qualified)

    # Dev Contest overrides for frictionless testing
    if is_dev_bypass:
        is_registered = True
        is_top_30_qualified = True
        can_enter_live_contest = True
        can_take_assessment = not (assessment_taken and assessment_session_status == "submitted")
        assessment_window_open = True

    # Contextual eligibility explanation
    if is_dev_bypass:
        eligibility_message = "⚡ DEV BYPASS ACTIVE: Unrestricted development testing mode enabled."
    elif contest_status == "upcoming":
        if not is_registered:
            eligibility_message = "Registration open. Register to take the Phase 1 Online Screening Assessment."
        elif assessment_taken:
            eligibility_message = f"Screening submitted. Score: {assessment_score} pts (Current Rank: #{assessment_rank or chr(0x2014)}). Top 30 cadets will advance when the contest goes LIVE."
        elif not assessment_window_open:
            from app.services.contest_lifecycle_service import assessment_window
            if contest and contest.starts_at:
                window = assessment_window(contest.starts_at)
                from app.services.contest_lifecycle_service import utcnow
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
            eligibility_message = f"✓ Top 30 Qualified Finalist (Rank #{assessment_rank or 'Top 30'}). Workstation reserved. Enter the Live Contest Lab."
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
        "is_top_30_qualified": is_top_30_qualified,
        "can_take_assessment": can_take_assessment,
        "can_enter_live_contest": can_enter_live_contest,
        "eligibility_message": eligibility_message,
        "is_dev_bypass": is_dev_bypass,
    }


@router.post("/{slug}/register")
async def register_for_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_member: MemberProfile = Depends(get_current_member),
):
    """Reserve physical workstation seat and unlock Phase 1 Online Assessment for the contest."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    if contest.status != "upcoming":
        raise HTTPException(
            status_code=400,
            detail="Registration and Phase 1 screening are only open for UPCOMING contests. Live contests are restricted strictly to pre-qualified Top 30 finalists.",
        )

    # Check if candidate is already registered
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

    # Create ContestRegistration record in DB
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


@router.post("/{slug}/check-in")
async def check_in_contest(
    slug: str,
    pass_code: Optional[str] = Query(None, description="Campus Pass verification code"),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """Verify physical on-premise attendance at the lab gate check-in."""
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

    return {
        "success": True,
        "status": "checked_in",
        "message": f"Physical presence verified. Workstation assigned: {assigned_seat}",
        "contest": contest.title,
        "seat": assigned_seat,
        "pass_code": effective_code,
    }


@router.post("/{slug}/reset-timer")
async def reset_contest_timer(
    slug: str,
    seconds: int = Query(10, description="Countdown duration in seconds"),
    db: AsyncSession = Depends(get_db),
):
    """Reset contest and assessment starts_at to N seconds in the future for demo countdown."""
    from datetime import datetime, timezone, timedelta
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    now = datetime.now(timezone.utc)
    new_starts = now + timedelta(hours=24, seconds=seconds)
    contest.starts_at = new_starts
    contest.status = "upcoming"

    # Also update Assessment starts_at
    a_res = await db.execute(select(Assessment).where((Assessment.contest_id == contest.id) | (Assessment.slug == slug)))
    assessment = a_res.scalars().first()
    if assessment:
        assessment.starts_at = now + timedelta(seconds=seconds)
        assessment.ends_at = new_starts
        assessment.is_active = True

    await db.commit()
    await delete_cache_pattern("cache:contest*")
    return {
        "status": "timer_reset",
        "slug": slug,
        "countdown_seconds": seconds,
        "starts_at": new_starts.isoformat(),
    }


@router.get("/{slug}/arena", response_model=ContestArenaResponse)
async def get_contest_arena_data(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Retrieve full arena workspace data, assigned workstation seat, faculty proctors, and problem statements."""
    c_res = await db.execute(
        select(OfflineContest)
        .options(selectinload(OfflineContest.problems))
        .where(OfflineContest.slug == slug)
    )
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    if contest.status == "live" and not slug.startswith("dev-"):
        is_eligible, reason = await is_member_eligible_for_live_contest(current_member, contest, db)
        if not is_eligible:
            raise HTTPException(status_code=403, detail=f"Arena access denied: {reason}")

    # Check candidate CampusPass for assigned workstation seat
    assigned_seat = "Lab-04-WS-07"
    pass_code = None
    check_in_status = "issued"

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
            check_in_status = pass_obj.check_in_status

    # Sort problems by problem_index
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

    return {
        "contest_id": contest.id,
        "slug": contest.slug,
        "title": contest.title,
        "season": contest.season,
        "status": contest.status,
        "starts_at": contest.starts_at.isoformat() if contest.starts_at else "",
        "ends_at": contest.ends_at.isoformat() if contest.ends_at else "",
        "venue": contest.venue,
        "environment": contest.environment,
        "chief_proctors": contest.chief_proctors if contest.chief_proctors else ["Dr. Ratnesh Litoriya", "Prof. Amit Shrivastava"],
        "assigned_seat": assigned_seat,
        "pass_code": pass_code,
        "check_in_status": check_in_status,
        "is_faculty_proctored": True,
        "problems": arena_problems,
    }


@router.post("/{slug}/arena/run")
async def run_contest_arena_code(
    slug: str,
    payload: ArenaRunRequest,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """Run code against sample test cases or custom stdin in the live contest arena."""
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

    provider = get_judge_provider()
    exec_result = await provider.execute_batch(
        language=payload.language,
        code=payload.code,
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
                "stderr": tr.stderr,
                "wall_time_ms": tr.wall_time_ms,
            }
            for tr in exec_result.testcase_results
        ],
    }


@router.post("/{slug}/arena/submit")
async def submit_contest_arena_code(
    slug: str,
    payload: ArenaSubmitRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Submit solution in live contest arena against full judge test suite & update live scoreboard."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

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

    provider = get_judge_provider()
    exec_result = await provider.execute_batch(
        language=payload.language,
        code=payload.code,
        testcases=all_tcs,
        time_limit=getattr(problem, "time_limit", 2.0) or 2.0,
        memory_limit_mb=getattr(problem, "memory_limit", 256) or 256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    is_accepted = exec_result.passed_testcases == exec_result.total_testcases
    verdict_str = "ACCEPTED" if is_accepted else (exec_result.verdict or "WRONG_ANSWER")
    points_awarded = problem.points if is_accepted else int(problem.points * (exec_result.passed_testcases / max(1, exec_result.total_testcases)))

    # Record contest submission
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

    # If accepted, update problem solved_count
    if is_accepted:
        problem.solved_count += 1

    # Update or create ScoreboardEntry
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
    }
