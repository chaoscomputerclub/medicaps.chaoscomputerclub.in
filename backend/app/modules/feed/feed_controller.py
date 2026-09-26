"""
Chaos Computer Club — Medi-Caps Chapter
modules/feed/feed_controller.py — Thin HTTP Controller for Campus Feed & Announcements
"""

from typing import List, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import AnnouncementResponse
from app.modules.feed.feed_service import FeedService


class FeedController:
    """Thin HTTP Controller for campus feed, bulletins, and announcements."""

    @staticmethod
    async def list_announcements(
        response: Response,
        kind: Optional[str],
        limit: int,
        db: AsyncSession,
        offset: int = 0,
    ) -> List[AnnouncementResponse]:
        return await FeedService.list_announcements(
            response=response,
            kind=kind,
            limit=limit,
            db=db,
            offset=offset,
        )
