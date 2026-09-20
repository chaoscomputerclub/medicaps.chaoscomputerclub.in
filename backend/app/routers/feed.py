"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/feed.py — Thin HTTP Router for Campus Activity Feed & Announcements
Delegates to app.controllers.feed_controller.FeedController
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.schemas import AnnouncementResponse
from app.controllers.feed_controller import FeedController

router = APIRouter(prefix="/feed", tags=["Campus Feed & Announcements"])


@router.get("/announcements", response_model=List[AnnouncementResponse])
async def list_announcements(
    response: Response,
    kind: Optional[str] = Query(None, description="Filter by kind: contest_release, editorial, podium, system"),
    limit: int = Query(20, ge=1, le=100, description="Max bulletins to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve official campus bulletins, editorials, and verified podium releases. Protected by 120s Redis Cache."""
    return await FeedController.list_announcements(
        response=response,
        kind=kind,
        limit=limit,
        offset=offset,
        db=db,
    )

