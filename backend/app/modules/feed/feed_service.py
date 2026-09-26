"""
Chaos Computer Club — Medi-Caps Chapter
modules/feed/feed_service.py — Campus Feed & Announcements Application Service
"""

import logging
from typing import List, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.schemas import AnnouncementResponse
from app.lib.cache_keys import feed_announcements_cache_key, TTL_FEED
from app.lib.pagination import normalize_pagination, inject_pagination_headers
from app.modules.feed.feed_repository import FeedRepository

logger = logging.getLogger(__name__)


class FeedService:
    """Handles campus feed announcements, caching, and category filtering."""

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

        records, total_count = await FeedRepository.list_announcements(
            db, kind=kind, limit=safe_limit, offset=safe_offset
        )
        inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        payload = [AnnouncementResponse.model_validate(r).model_dump() for r in records]
        await set_cache(cache_key, {"items": payload, "total": total_count}, ttl_seconds=TTL_FEED)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_FEED}, stale-while-revalidate=60"
        return records
