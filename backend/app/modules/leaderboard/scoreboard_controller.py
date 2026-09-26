"""
Chaos Computer Club — Medi-Caps Chapter
modules/leaderboard/scoreboard_controller.py — Thin HTTP Controller for Contest Scoreboards
"""

from typing import List, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import ScoreboardEntryResponse
from app.modules.leaderboard.scoreboard_service import ScoreboardService


class ScoreboardController:
    """Thin HTTP Controller for contest scoreboard matrix queries and caching."""

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
        return await ScoreboardService.get_contest_scoreboard(
            slug=slug,
            response=response,
            division=division,
            department=department,
            db=db,
            limit=limit,
            offset=offset,
        )
