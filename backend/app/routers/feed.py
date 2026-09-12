"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Campus Activity Feed & Solution Editorials Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.db_models import Announcement
from app.models.schemas import AnnouncementResponse

router = APIRouter(prefix="/feed", tags=["Campus Feed & Announcements"])


@router.get("/announcements", response_model=List[AnnouncementResponse])
async def list_announcements(
    kind: Optional[str] = Query(None, description="Filter by kind: contest_release, editorial, podium, system"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve official campus bulletins, editorials, and verified podium releases."""
    stmt = select(Announcement)
    if kind:
        stmt = stmt.where(Announcement.kind == kind)
    stmt = stmt.order_by(Announcement.published_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()
