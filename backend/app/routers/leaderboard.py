"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/leaderboard.py — Thin HTTP Router for Leaderboards & Star Division Ladder
Delegates to app.controllers.leaderboard_controller.LeaderboardController
"""

from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.schemas import LeaderboardRow
from app.controllers.leaderboard_controller import LeaderboardController

router = APIRouter(prefix="/leaderboard", tags=["Leaderboards & Ratings"])


@router.get("", response_model=List[LeaderboardRow])
async def get_university_leaderboard(
    response: Response,
    department: Optional[str] = Query(None, description="Filter: CSE, IT, AIDS, Cyber Security"),
    batch: Optional[str] = Query(None, description="Filter: 2022-26, 2023-27, 2024-28"),
    tier: Optional[str] = Query(None, description="Filter: 5_star, 4_star, 3_star, 2_star, 1_star"),
    limit: Optional[int] = Query(None, ge=1, le=500, description="Max rows to return"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch official Medi-Caps University rating standings with star division brackets.
    Supports granular departmental and batch filters, and limit/offset pagination.
    Protected by 60s Redis Cache-Aside with conditional HTTP headers.
    """
    return await LeaderboardController.get_university_leaderboard(
        response=response,
        department=department,
        batch=batch,
        tier=tier,
        limit=limit,
        offset=offset,
        db=db,
    )


@router.get("/distribution")
async def get_rating_distribution(response: Response, db: AsyncSession = Depends(get_db)):
    """
    Return the real rating distribution histogram from the DB.
    Each bucket spans 50 rating points (1000-1050, ..., 2350-2400+).
    Count is the actual number of members whose rating falls in that range.
    Protected by 120s Redis Cache-Aside.
    """
    return await LeaderboardController.get_rating_distribution(response=response, db=db)


@router.get("/departments")
async def get_department_performance(response: Response, db: AsyncSession = Depends(get_db)):
    """Aggregate rating and participation statistics by university department. Protected by 120s Redis Cache."""
    return await LeaderboardController.get_department_performance(response=response, db=db)
