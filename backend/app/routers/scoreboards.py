"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Scoreboards & Real-Time Telemetry Matrix Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.db_models import OfflineContest, ScoreboardEntry
from app.models.schemas import ScoreboardEntryResponse

router = APIRouter(prefix="/scoreboards", tags=["Scoreboards & Telemetry"])


@router.get("/{slug}", response_model=List[ScoreboardEntryResponse])
async def get_contest_scoreboard(
    slug: str,
    division: Optional[str] = Query(None, description="Filter by division: division_1, division_2, division_3, or all"),
    department: Optional[str] = Query(None, description="Filter by department: CSE, IT, AIDS, Cyber Security"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the official problem-matrix scoreboard for an offline contest.
    Includes solve times, penalty calculations, attempt history, and First-AC stars.
    """
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    stmt = select(ScoreboardEntry).where(ScoreboardEntry.contest_id == contest.id)

    if division and division != "all":
        stmt = stmt.where(ScoreboardEntry.division == division)
    if department:
        stmt = stmt.where(ScoreboardEntry.department == department)

    stmt = stmt.order_by(ScoreboardEntry.rank.asc())
    result = await db.execute(stmt)
    return result.scalars().all()
