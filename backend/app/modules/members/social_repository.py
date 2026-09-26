"""
Chaos Computer Club — Medi-Caps Chapter
modules/members/social_repository.py — Student Social Network & Follow Graph Persistence
"""

from typing import List, Optional, Tuple
from sqlalchemy import func, select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import MemberProfile, StudentFollow, now_utc


class SocialRepository:
    """Encapsulates database operations for the student follow network."""

    @staticmethod
    async def is_following(db: AsyncSession, follower_id: str, following_id: str) -> bool:
        stmt = select(StudentFollow.id).where(
            and_(StudentFollow.follower_id == follower_id, StudentFollow.following_id == following_id)
        )
        result = await db.execute(stmt)
        return result.scalars().first() is not None

    @staticmethod
    async def add_follow(db: AsyncSession, follower_id: str, following_id: str) -> StudentFollow:
        follow = StudentFollow(follower_id=follower_id, following_id=following_id, created_at=now_utc())
        db.add(follow)
        await db.commit()
        return follow

    @staticmethod
    async def remove_follow(db: AsyncSession, follower_id: str, following_id: str) -> bool:
        stmt = delete(StudentFollow).where(
            and_(StudentFollow.follower_id == follower_id, StudentFollow.following_id == following_id)
        )
        res = await db.execute(stmt)
        await db.commit()
        return (res.rowcount or 0) > 0

    @staticmethod
    async def get_following_ids(db: AsyncSession, follower_id: str) -> List[str]:
        stmt = select(StudentFollow.following_id).where(StudentFollow.follower_id == follower_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_followers(
        db: AsyncSession,
        member_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[MemberProfile], int]:
        count_stmt = select(func.count(StudentFollow.id)).where(StudentFollow.following_id == member_id)
        total = await db.scalar(count_stmt) or 0

        stmt = (
            select(MemberProfile)
            .join(StudentFollow, StudentFollow.follower_id == MemberProfile.id)
            .where(StudentFollow.following_id == member_id)
            .order_by(StudentFollow.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_following(
        db: AsyncSession,
        member_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[MemberProfile], int]:
        count_stmt = select(func.count(StudentFollow.id)).where(StudentFollow.follower_id == member_id)
        total = await db.scalar(count_stmt) or 0

        stmt = (
            select(MemberProfile)
            .join(StudentFollow, StudentFollow.following_id == MemberProfile.id)
            .where(StudentFollow.follower_id == member_id)
            .order_by(StudentFollow.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total
