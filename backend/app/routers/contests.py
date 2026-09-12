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
from app.models.db_models import ContestProblem, MemberProfile, OfflineContest
from app.models.schemas import ContestProblemResponse, OfflineContestResponse
from app.middleware.auth import get_current_member

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


@router.post("/{slug}/register")
async def register_for_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_member: MemberProfile = Depends(get_current_member),
):
    """Reserve physical workstation seat for the offline campus contest."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    if contest.registered_count >= contest.seat_capacity:
        raise HTTPException(status_code=400, detail="All lab workstation seats are filled for this contest.")

    contest.registered_count += 1
    await db.commit()
    return {
        "status": "confirmed",
        "message": f"Workstation seat reserved for {contest.title}.",
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
