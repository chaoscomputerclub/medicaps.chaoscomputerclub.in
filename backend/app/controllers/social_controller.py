"""
Chaos Computer Club — Medi-Caps Chapter
controllers/social_controller.py — Student Social Graph & Follow Network Orchestrator
"""

from typing import Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache, delete_cache, delete_cache_pattern
from app.models.db_models import MemberProfile, StudentFollow
from app.schemas.social import (
    FollowResponse,
    FollowListResponse,
    StudentSummary,
    FollowingIdsResponse,
)
from app.services.rating_service import get_rating_tier


class SocialController:
    """Orchestrator for student peer graph, following, followers, and social telemetry."""

    @staticmethod
    async def resolve_member(target: str, db: AsyncSession) -> MemberProfile:
        """Resolve a member by handle (case-insensitive) or UUID."""
        clean_target = target.lstrip("@").strip()
        stmt = select(MemberProfile).where(
            (func.lower(MemberProfile.handle) == clean_target.lower()) | (MemberProfile.id == clean_target)
        )
        res = await db.execute(stmt)
        member = res.scalars().first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student '{clean_target}' not found.",
            )
        return member

    @classmethod
    async def follow_student(
        cls,
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        target_member = await cls.resolve_member(target, db)

        if target_member.id == current_member.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot follow yourself.",
            )

        stmt = select(StudentFollow).where(
            and_(
                StudentFollow.follower_id == current_member.id,
                StudentFollow.following_id == target_member.id,
            )
        )
        existing = (await db.execute(stmt)).scalars().first()

        if not existing:
            follow_record = StudentFollow(
                follower_id=current_member.id,
                following_id=target_member.id,
            )
            db.add(follow_record)
            await db.commit()

            # Invalidate social & profile caches
            await delete_cache(f"cache:profile:{target_member.id}")
            await delete_cache(f"cache:profile:{current_member.id}")
            await delete_cache_pattern(f"cache:student:profile:{target_member.id}*")
            await delete_cache_pattern(f"cache:student:profile:{current_member.id}*")
            if target_member.handle:
                await delete_cache_pattern(f"cache:student:profile:{target_member.handle.lower()}*")
            if current_member.handle:
                await delete_cache_pattern(f"cache:student:profile:{current_member.handle.lower()}*")
            await delete_cache(f"cache:social:my_following:{current_member.id}")
            await delete_cache_pattern("cache:social:*")

        followers_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.following_id == target_member.id
            )
        ) or 0
        following_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.follower_id == current_member.id
            )
        ) or 0

        return FollowResponse(
            success=True,
            is_following=True,
            followers_count=followers_count,
            following_count=following_count,
            target_id=str(target_member.id),
            target_handle=target_member.handle or "—",
            message=f"You are now following @{target_member.handle or 'student'}.",
        )

    @classmethod
    async def toggle_follow_student(
        cls,
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        target_member = await cls.resolve_member(target, db)

        if target_member.id == current_member.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot follow yourself.",
            )

        stmt = select(StudentFollow).where(
            and_(
                StudentFollow.follower_id == current_member.id,
                StudentFollow.following_id == target_member.id,
            )
        )
        existing = (await db.execute(stmt)).scalars().first()

        if existing:
            await db.delete(existing)
            await db.commit()
            is_now_following = False
            msg = f"Unfollowed @{target_member.handle or 'student'}."
        else:
            follow_record = StudentFollow(
                follower_id=current_member.id,
                following_id=target_member.id,
            )
            db.add(follow_record)
            await db.commit()
            is_now_following = True
            msg = f"You are now following @{target_member.handle or 'student'}."

        await delete_cache(f"cache:profile:{target_member.id}")
        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache_pattern(f"cache:student:profile:{target_member.id}*")
        await delete_cache_pattern(f"cache:student:profile:{current_member.id}*")
        if target_member.handle:
            await delete_cache_pattern(f"cache:student:profile:{target_member.handle.lower()}*")
        if current_member.handle:
            await delete_cache_pattern(f"cache:student:profile:{current_member.handle.lower()}*")
        await delete_cache(f"cache:social:my_following:{current_member.id}")
        await delete_cache_pattern("cache:social:*")

        followers_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.following_id == target_member.id
            )
        ) or 0
        following_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.follower_id == current_member.id
            )
        ) or 0

        return FollowResponse(
            success=True,
            is_following=is_now_following,
            followers_count=followers_count,
            following_count=following_count,
            target_id=str(target_member.id),
            target_handle=target_member.handle or "—",
            message=msg,
        )

    @classmethod
    async def unfollow_student(
        cls,
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        target_member = await cls.resolve_member(target, db)

        stmt = select(StudentFollow).where(
            and_(
                StudentFollow.follower_id == current_member.id,
                StudentFollow.following_id == target_member.id,
            )
        )
        existing = (await db.execute(stmt)).scalars().first()

        if existing:
            await db.delete(existing)
            await db.commit()

            await delete_cache(f"cache:profile:{target_member.id}")
            await delete_cache(f"cache:profile:{current_member.id}")
            await delete_cache_pattern(f"cache:student:profile:{target_member.id}*")
            await delete_cache_pattern(f"cache:student:profile:{current_member.id}*")
            if target_member.handle:
                await delete_cache_pattern(f"cache:student:profile:{target_member.handle.lower()}*")
            if current_member.handle:
                await delete_cache_pattern(f"cache:student:profile:{current_member.handle.lower()}*")
            await delete_cache(f"cache:social:my_following:{current_member.id}")
            await delete_cache_pattern("cache:social:*")

        followers_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.following_id == target_member.id
            )
        ) or 0
        following_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.follower_id == current_member.id
            )
        ) or 0

        return FollowResponse(
            success=True,
            is_following=False,
            followers_count=followers_count,
            following_count=following_count,
            target_id=str(target_member.id),
            target_handle=target_member.handle or "—",
            message=f"Unfollowed @{target_member.handle or 'student'}.",
        )

    @staticmethod
    async def get_my_following_ids(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowingIdsResponse:
        cache_key = f"cache:social:my_following:{current_member.id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return FollowingIdsResponse(following_ids=cached)

        stmt = select(StudentFollow.following_id).where(
            StudentFollow.follower_id == current_member.id
        )
        res = await db.execute(stmt)
        following_ids = [str(fid) for fid in res.scalars().all()]
        await set_cache(cache_key, following_ids, ttl_seconds=60)
        return FollowingIdsResponse(following_ids=following_ids)

    @classmethod
    async def get_student_followers(
        cls,
        target: str,
        authorization: Optional[str],
        db: AsyncSession,
    ) -> FollowListResponse:
        target_member = await cls.resolve_member(target, db)

        current_member_id: Optional[str] = None
        my_following_set: Set[str] = set()
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            try:
                from app.core.security import decode_jwt
                payload = decode_jwt(token)
                if payload and "sub" in payload:
                    current_member_id = payload["sub"]
                    fid_res = await db.execute(
                        select(StudentFollow.following_id).where(
                            StudentFollow.follower_id == current_member_id
                        )
                    )
                    my_following_set = set(fid_res.scalars().all())
            except Exception:
                pass

        stmt = (
            select(MemberProfile)
            .join(StudentFollow, StudentFollow.follower_id == MemberProfile.id)
            .where(StudentFollow.following_id == target_member.id)
            .order_by(StudentFollow.created_at.desc())
        )
        res = await db.execute(stmt)
        followers = res.scalars().all()

        followers_count = len(followers)
        following_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.follower_id == target_member.id
            )
        ) or 0

        students = []
        for m in followers:
            tier_str = get_rating_tier(m.rating)
            students.append(
                StudentSummary(
                    id=m.id,
                    handle=m.handle or "—",
                    full_name=m.full_name or m.email,
                    department=m.department or "CSE",
                    batch=m.batch or "2023-27",
                    rating=m.rating,
                    peak_rating=m.peak_rating,
                    tier=tier_str,
                    is_following=m.id in my_following_set,
                    is_self=(m.id == current_member_id),
                    avatar_url=m.avatar_url,
                )
            )

        return FollowListResponse(
            count=len(students),
            followers_count=followers_count,
            following_count=following_count,
            students=students,
        )

    @classmethod
    async def get_student_following(
        cls,
        target: str,
        authorization: Optional[str],
        db: AsyncSession,
    ) -> FollowListResponse:
        target_member = await cls.resolve_member(target, db)

        current_member_id: Optional[str] = None
        my_following_set: Set[str] = set()
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            try:
                from app.core.security import decode_jwt
                payload = decode_jwt(token)
                if payload and "sub" in payload:
                    current_member_id = payload["sub"]
                    fid_res = await db.execute(
                        select(StudentFollow.following_id).where(
                            StudentFollow.follower_id == current_member_id
                        )
                    )
                    my_following_set = set(fid_res.scalars().all())
            except Exception:
                pass

        stmt = (
            select(MemberProfile)
            .join(StudentFollow, StudentFollow.following_id == MemberProfile.id)
            .where(StudentFollow.follower_id == target_member.id)
            .order_by(StudentFollow.created_at.desc())
        )
        res = await db.execute(stmt)
        following = res.scalars().all()

        following_count = len(following)
        followers_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(
                StudentFollow.following_id == target_member.id
            )
        ) or 0

        students = []
        for m in following:
            tier_str = get_rating_tier(m.rating)
            students.append(
                StudentSummary(
                    id=m.id,
                    handle=m.handle or "—",
                    full_name=m.full_name or m.email,
                    department=m.department or "CSE",
                    batch=m.batch or "2023-27",
                    rating=m.rating,
                    peak_rating=m.peak_rating,
                    tier=tier_str,
                    is_following=m.id in my_following_set,
                    is_self=(m.id == current_member_id),
                    avatar_url=m.avatar_url,
                )
            )

        return FollowListResponse(
            count=len(students),
            followers_count=followers_count,
            following_count=following_count,
            students=students,
        )
