"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Scoreboards & Real-Time Telemetry Matrix Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.cache import get_cache, set_cache
from app.models.db_models import OfflineContest, ScoreboardEntry
from app.models.schemas import ScoreboardEntryResponse

router = APIRouter(prefix="/scoreboards", tags=["Scoreboards & Telemetry"])


@router.get("/{slug}", response_model=List[ScoreboardEntryResponse])
async def get_contest_scoreboard(
    slug: str,
    response: Response,
    division: Optional[str] = Query(None, description="Filter by division: division_1, division_2, division_3, or all"),
    department: Optional[str] = Query(None, description="Filter by department: CSE, IT, AIDS, Cyber Security"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the official problem-matrix scoreboard for an offline contest.
    Includes solve times, penalty calculations, attempt history, and First-AC stars.
    Protected by 15s Redis Cache-Aside.
    """
    cache_key = f"cache:scoreboard:{slug}:{division or 'all'}:{department or 'all'}"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=10"
        return cached

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
    records = result.scalars().all()

    payload = [ScoreboardEntryResponse.model_validate(r).model_dump() for r in records]
    await set_cache(cache_key, payload, ttl_seconds=15)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=10"
    return records
