"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Campus Activity Feed & Solution Editorials Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.cache import get_cache, set_cache
from app.models.db_models import Announcement
from app.models.schemas import AnnouncementResponse

router = APIRouter(prefix="/feed", tags=["Campus Feed & Announcements"])


@router.get("/announcements", response_model=List[AnnouncementResponse])
async def list_announcements(
    response: Response,
    kind: Optional[str] = Query(None, description="Filter by kind: contest_release, editorial, podium, system"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve official campus bulletins, editorials, and verified podium releases. Protected by 120s Redis Cache."""
    cache_key = f"cache:feed:announcements:{kind or 'all'}:{limit}"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
        return cached

    stmt = select(Announcement)
    if kind:
        stmt = stmt.where(Announcement.kind == kind)
    stmt = stmt.order_by(Announcement.published_at.desc()).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()

    payload = [AnnouncementResponse.model_validate(r).model_dump() for r in records]
    await set_cache(cache_key, payload, ttl_seconds=120)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
    return records
