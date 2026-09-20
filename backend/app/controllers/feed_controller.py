"""
Chaos Computer Club — Medi-Caps Chapter
controllers/feed_controller.py — Campus Feed & Announcements Orchestration Controller
"""

from typing import List, Optional
from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.db_models import Announcement
from app.models.schemas import AnnouncementResponse
from app.lib.cache_keys import feed_announcements_cache_key, TTL_FEED
from app.lib.pagination import normalize_pagination, inject_pagination_headers


class FeedController:
    """Orchestrator for campus feed, bulletins, and announcements."""

    @staticmethod
    async def list_announcements(
        response: Response,
        kind: Optional[str],
        limit: int,
        db: AsyncSession,
        offset: int = 0,
    ) -> List[AnnouncementResponse]:
        safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=20, max_limit=100)
        cache_key = f"{feed_announcements_cache_key(kind, safe_limit)}:off_{safe_offset}"
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_FEED}, stale-while-revalidate=60"
            if isinstance(cached, dict) and "items" in cached:
                inject_pagination_headers(response, cached.get("total", len(cached["items"])), safe_limit, safe_offset)
                return cached["items"]
            return cached

        count_stmt = select(func.count(Announcement.id))
        stmt = select(Announcement)
        if kind:
            stmt = stmt.where(Announcement.kind == kind)
            count_stmt = count_stmt.where(Announcement.kind == kind)

        total_count = await db.scalar(count_stmt) or 0
        stmt = stmt.order_by(Announcement.published_at.desc()).limit(safe_limit).offset(safe_offset)
        result = await db.execute(stmt)
        records = result.scalars().all()

        inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        payload = [AnnouncementResponse.model_validate(r).model_dump() for r in records]
        await set_cache(cache_key, {"items": payload, "total": total_count}, ttl_seconds=TTL_FEED)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_FEED}, stale-while-revalidate=60"
        return records

