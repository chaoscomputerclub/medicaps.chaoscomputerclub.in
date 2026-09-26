"""
Chaos Computer Club — Medi-Caps Chapter
modules/leaderboard/leaderboard_controller.py — Thin HTTP Controller for University Leaderboard
"""

from typing import Dict, List, Optional, Any
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import LeaderboardRow
from app.modules.leaderboard.leaderboard_service import LeaderboardService


class LeaderboardController:
    """Thin HTTP Controller for university leaderboard, rating distributions, and department metrics."""

    @staticmethod
    async def get_university_leaderboard(
        response: Response,
        department: Optional[str],
        batch: Optional[str],
        tier: Optional[str],
        limit: Optional[int],
        offset: Optional[int],
        db: AsyncSession,
        request: Optional[Any] = None,
        fresh: bool = False,
    ) -> List[LeaderboardRow]:
        return await LeaderboardService.get_university_leaderboard(
            response=response,
            department=department,
            batch=batch,
            tier=tier,
            limit=limit,
            offset=offset,
            db=db,
            request=request,
            fresh=fresh,
        )

    @staticmethod
    async def get_rating_distribution(
        response: Response,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await LeaderboardService.get_rating_distribution(
            response=response,
            db=db,
        )

    @staticmethod
    async def get_department_performance(
        response: Response,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        return await LeaderboardService.get_department_performance(
            response=response,
            db=db,
        )
