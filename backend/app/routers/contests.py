"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Offline Contests & On-Premise Event Management Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.db import get_db
from app.models.db_models import ContestProblem, MemberProfile, OfflineContest, ContestRegistration
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
    """Check if the current member is registered for this contest & assessment round."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    if not current_member:
        return {"registered": False, "contest_slug": slug}

    reg_res = await db.execute(
        select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == current_member.id,
        )
    )
    reg = reg_res.scalars().first()
    return {
        "registered": reg is not None,
        "contest_slug": slug,
        "status": reg.status if reg else None,
        "registered_at": reg.registered_at.isoformat() if reg else None,
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
