"""
Chaos Computer Club — Medi-Caps Chapter
modules/leaderboard/scoreboard_service.py — Contest Scoreboard Matrix Application Service
"""

import logging
from typing import List, Optional
from fastapi import HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.schemas import ScoreboardEntryResponse
from app.lib.cache_keys import scoreboard_cache_key, TTL_SCOREBOARD
from app.lib.pagination import normalize_pagination, inject_pagination_headers, slice_page
from app.modules.contests.contest_repository import ContestRepository
from app.modules.leaderboard.leaderboard_repository import LeaderboardRepository

logger = logging.getLogger(__name__)


class ScoreboardService:
    """Handles contest scoreboard matrix computation, pagination, and multi-tier caching."""

    @staticmethod
    async def get_contest_scoreboard(
        slug: str,
        response: Response,
        division: Optional[str],
        department: Optional[str],
        db: AsyncSession,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> List[ScoreboardEntryResponse]:
        cache_key = scoreboard_cache_key(slug, division, department)
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_SCOREBOARD}, stale-while-revalidate=10"
            if limit is not None:
                safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=500)
                inject_pagination_headers(response, len(cached), safe_limit, safe_offset)
                return slice_page(cached, safe_limit, safe_offset)
            return cached

        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        records = await LeaderboardRepository.get_contest_scoreboard_entries(
            db,
            contest_id=contest.id,
            division=division,
            department=department,
        )

        payload = [ScoreboardEntryResponse.model_validate(r).model_dump() for r in records]
        await set_cache(cache_key, payload, ttl_seconds=TTL_SCOREBOARD)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_SCOREBOARD}, stale-while-revalidate=10"

        if limit is not None:
            safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=500)
            inject_pagination_headers(response, len(payload), safe_limit, safe_offset)
            return slice_page(payload, safe_limit, safe_offset)

        return records
