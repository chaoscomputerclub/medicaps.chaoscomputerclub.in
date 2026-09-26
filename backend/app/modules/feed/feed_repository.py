"""
Chaos Computer Club — Medi-Caps Chapter
modules/feed/feed_repository.py — Data Persistence Repository for Campus Announcements
"""

import logging
from typing import Optional, Sequence, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Announcement

logger = logging.getLogger(__name__)


class FeedRepository:
    """Encapsulates SQL persistence and queries for campus bulletins and announcements."""

    @staticmethod
    async def list_announcements(
        db: AsyncSession,
        kind: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Tuple[Sequence[Announcement], int]:
        count_stmt = select(func.count(Announcement.id))
        stmt = select(Announcement)
        if kind:
            stmt = stmt.where(Announcement.kind == kind)
            count_stmt = count_stmt.where(Announcement.kind == kind)

        total_count = await db.scalar(count_stmt) or 0
        stmt = stmt.order_by(Announcement.published_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        return result.scalars().all(), total_count
