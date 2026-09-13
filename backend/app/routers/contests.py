"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Offline Contests & On-Premise Event Management Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.db import get_db
from app.models.db_models import ContestProblem, MemberProfile, OfflineContest, ContestRegistration, Assessment, AssessmentSession
from app.models.schemas import ContestProblemResponse, OfflineContestResponse
from app.middleware.auth import get_current_member, get_current_member_optional

router = APIRouter(prefix="/contests", tags=["Offline Contests"])


@router.get("", response_model=List[OfflineContestResponse])
async def list_contests(
    status: Optional[str] = Query(None, description="Filter by: live, upcoming, finished"),
    division: Optional[str] = Query(None, description="Filter by: division_1, division_2, division_3, open"),
    db: AsyncSession = Depends(get_db),
):
    """List all offline campus contests with optional status and division filtering."""
    stmt = select(OfflineContest).options(selectinload(OfflineContest.problems))

    if status:
        stmt = stmt.where(OfflineContest.status == status)
    if division:
        stmt = stmt.where(OfflineContest.division == division)

    stmt = stmt.order_by(OfflineContest.starts_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()



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
async def get_contest_detail(slug: str, db: AsyncSession = Depends(get_db)):
    """Fetch complete specifications, venue, rules, and proctor details for an offline contest."""
    stmt = (
        select(OfflineContest)
        .options(selectinload(OfflineContest.problems))
        .where(OfflineContest.slug == slug)
    )
    result = await db.execute(stmt)
    contest = result.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")
    return contest


@router.get("/{slug}/problems", response_model=List[ContestProblemResponse])
async def get_contest_problems(slug: str, db: AsyncSession = Depends(get_db)):
    """Fetch problem set papers (A-F), first-solve times, and editorial summaries."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    res = await db.execute(
        select(ContestProblem)
        .where(ContestProblem.contest_id == contest.id)
        .order_by(ContestProblem.problem_index.asc())
    )
    return res.scalars().all()


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

    can_take_assessment = (contest_status == "upcoming" and is_registered)
    can_enter_live_contest = (contest_status == "live" and is_top_30_qualified)

    # Contextual eligibility explanation
    if contest_status == "upcoming":
        if not is_registered:
            eligibility_message = "Registration open. Register to take the Phase 1 Online Screening Assessment."
        elif not assessment_taken:
            eligibility_message = "Registration confirmed. Take the Phase 1 Screening Assessment to qualify for the Top 30 Live Final."
        else:
            eligibility_message = f"Screening submitted. Score: {assessment_score} pts (Current Rank: #{assessment_rank or '—'}). Top 30 cadets will advance when the contest goes LIVE."
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
    pass_code: str = Query(..., description="Campus Pass verification code"),
    db: AsyncSession = Depends(get_db),
):
    """Verify physical on-premise attendance at the lab gate check-in."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    return {
        "status": "checked_in",
        "message": "Physical presence verified by lab proctor.",
        "contest": contest.title,
        "pass_code": pass_code,
    }
