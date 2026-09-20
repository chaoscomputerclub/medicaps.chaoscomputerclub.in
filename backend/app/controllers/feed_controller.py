"""
Chaos Computer Club — Medi-Caps Chapter
controllers/feed_controller.py — Campus Feed & Announcements Orchestration Controller
"""

from typing import List, Optional
from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.db_models import Announcement
from app.models.schemas import AnnouncementResponse
from app.lib.cache_keys import feed_announcements_cache_key, TTL_FEED


class FeedController:
    """Orchestrator for campus feed, bulletins, and announcements."""

    @staticmethod
    async def list_announcements(
        response: Response,
        kind: Optional[str],
        limit: int,
        db: AsyncSession,
    ) -> List[AnnouncementResponse]:
        cache_key = feed_announcements_cache_key(kind, limit)
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_FEED}, stale-while-revalidate=60"
            return cached

        stmt = select(Announcement)
        if kind:
            stmt = stmt.where(Announcement.kind == kind)
        stmt = stmt.order_by(Announcement.published_at.desc()).limit(limit)
        result = await db.execute(stmt)
        records = result.scalars().all()

        payload = [AnnouncementResponse.model_validate(r).model_dump() for r in records]
        await set_cache(cache_key, payload, ttl_seconds=TTL_FEED)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_FEED}, stale-while-revalidate=60"
        return records
