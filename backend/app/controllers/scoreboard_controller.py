"""
Chaos Computer Club — Medi-Caps Chapter
controllers/scoreboard_controller.py — Contest Scoreboard Matrix Orchestration Controller
"""

from typing import List, Optional
from fastapi import HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.db_models import OfflineContest, ScoreboardEntry
from app.models.schemas import ScoreboardEntryResponse
from app.lib.cache_keys import scoreboard_cache_key, TTL_SCOREBOARD


class ScoreboardController:
    """Orchestrator for contest scoreboard matrix queries and caching."""

    @staticmethod
    async def get_contest_scoreboard(
        slug: str,
        response: Response,
        division: Optional[str],
        department: Optional[str],
        db: AsyncSession,
    ) -> List[ScoreboardEntryResponse]:
        cache_key = scoreboard_cache_key(slug, division, department)
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_SCOREBOARD}, stale-while-revalidate=10"
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
        await set_cache(cache_key, payload, ttl_seconds=TTL_SCOREBOARD)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_SCOREBOARD}, stale-while-revalidate=10"
        return records
