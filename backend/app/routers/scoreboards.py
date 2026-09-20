"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/scoreboards.py — Thin HTTP Router for Scoreboards & Real-Time Telemetry Matrix
Delegates to app.controllers.scoreboard_controller.ScoreboardController
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.schemas import ScoreboardEntryResponse
from app.controllers.scoreboard_controller import ScoreboardController

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
    return await ScoreboardController.get_contest_scoreboard(
        slug=slug,
        response=response,
        division=division,
        department=department,
        db=db,
    )
