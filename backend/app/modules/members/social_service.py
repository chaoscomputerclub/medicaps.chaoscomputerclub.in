"""
Chaos Computer Club — Medi-Caps Chapter
modules/members/social_service.py — Student Peer Social Graph Application Service
"""

import logging
from typing import Optional, Set
from fastapi import HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache, delete_cache, delete_cache_pattern
from app.models.db_models import MemberProfile
from app.schemas.social import (
    FollowResponse,
    FollowListResponse,
    StudentSummary,
    FollowingIdsResponse,
)
from app.services.rating_service import get_rating_tier
from app.lib.pagination import normalize_pagination, inject_pagination_headers
from app.modules.members.member_repository import MemberRepository
from app.modules.members.social_repository import SocialRepository

logger = logging.getLogger(__name__)


class SocialService:
    """Application Service orchestrating peer follow graphs and social telemetry."""

    @staticmethod
    async def resolve_member(target: str, db: AsyncSession) -> MemberProfile:
        member = await MemberRepository.get_by_handle_or_id(db, target)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student '{target.lstrip('@')}' not found.",
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

        already_following = await SocialRepository.is_following(db, current_member.id, target_member.id)
        if not already_following:
            await SocialRepository.add_follow(db, current_member.id, target_member.id)
            await cls._invalidate_social_caches(current_member, target_member)

        followers_count, _ = await MemberRepository.get_social_counts(db, target_member.id)
        _, following_count = await MemberRepository.get_social_counts(db, current_member.id)

        try:
            from app.services.event_broadcaster import broadcast_event
            target_following_count, _ = await MemberRepository.get_social_counts(db, target_member.id)
            await broadcast_event(
                event_type="member_profile_updated",
                data={
                    "member_id": str(target_member.id),
                    "handle": target_member.handle,
                    "followers_count": followers_count,
                    "following_count": target_following_count,
                    "follower_id": str(current_member.id),
                    "follower_handle": current_member.handle,
                    "my_following_count": following_count,
                    "action": "follow",
                },
                contest_slug=None,
            )
        except Exception as b_err:
            logger.debug("Failed to broadcast member_profile_updated on follow: %s", b_err)

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
    async def unfollow_student(
        cls,
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        target_member = await cls.resolve_member(target, db)

        if target_member.id == current_member.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot unfollow yourself.",
            )

        was_removed = await SocialRepository.remove_follow(db, current_member.id, target_member.id)
        if was_removed:
            await cls._invalidate_social_caches(current_member, target_member)

        followers_count, _ = await MemberRepository.get_social_counts(db, target_member.id)
        _, following_count = await MemberRepository.get_social_counts(db, current_member.id)

        try:
            from app.services.event_broadcaster import broadcast_event
            target_following_count, _ = await MemberRepository.get_social_counts(db, target_member.id)
            await broadcast_event(
                event_type="member_profile_updated",
                data={
                    "member_id": str(target_member.id),
                    "handle": target_member.handle,
                    "followers_count": followers_count,
                    "following_count": target_following_count,
                    "follower_id": str(current_member.id),
                    "follower_handle": current_member.handle,
                    "my_following_count": following_count,
                    "action": "unfollow",
                },
                contest_slug=None,
            )
        except Exception as b_err:
            logger.debug("Failed to broadcast member_profile_updated on unfollow: %s", b_err)

        return FollowResponse(
            success=True,
            is_following=False,
            followers_count=followers_count,
            following_count=following_count,
            target_id=str(target_member.id),
            target_handle=target_member.handle or "—",
            message=f"You have unfollowed @{target_member.handle or 'student'}.",
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

        is_currently_following = await SocialRepository.is_following(db, current_member.id, target_member.id)
        if is_currently_following:
            await SocialRepository.remove_follow(db, current_member.id, target_member.id)
            is_now_following = False
            msg = f"You have unfollowed @{target_member.handle or 'student'}."
        else:
            await SocialRepository.add_follow(db, current_member.id, target_member.id)
            is_now_following = True
            msg = f"You are now following @{target_member.handle or 'student'}."

        await cls._invalidate_social_caches(current_member, target_member)

        followers_count, _ = await MemberRepository.get_social_counts(db, target_member.id)
        _, following_count = await MemberRepository.get_social_counts(db, current_member.id)

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
    async def get_followers(
        cls,
        target: str,
        current_member: Optional[MemberProfile],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=20, max_limit=100)
        target_member = await cls.resolve_member(target, db)

        my_following_ids: Set[str] = set()
        if current_member:
            ids = await SocialRepository.get_following_ids(db, current_member.id)
            my_following_ids = set(ids)

        profiles, total_count = await SocialRepository.get_followers(db, target_member.id, safe_limit, safe_offset)

        if response is not None:
            inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        items = [
            StudentSummary(
                id=str(p.id),
                handle=p.handle or "cadet",
                full_name=p.full_name or "Cadet",
                department=p.department or "CSE",
                batch=p.batch or "2024-28",
                rating=p.rating or 1200,
                rating_tier=get_rating_tier(p.rating or 1200),
                avatar_url=p.avatar_url,
                is_following=str(p.id) in my_following_ids or (p.handle or "") in my_following_ids,
                is_you=bool(current_member and str(p.id) == str(current_member.id)),
            )
            for p in profiles
        ]

        followers_count, following_count = await MemberRepository.get_social_counts(db, target_member.id)
        return FollowListResponse(
            count=total_count,
            followers_count=followers_count,
            following_count=following_count,
            students=items,
        )

    @classmethod
    async def get_following(
        cls,
        target: str,
        current_member: Optional[MemberProfile],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=20, max_limit=100)
        target_member = await cls.resolve_member(target, db)

        my_following_ids: Set[str] = set()
        if current_member:
            ids = await SocialRepository.get_following_ids(db, current_member.id)
            my_following_ids = set(ids)

        profiles, total_count = await SocialRepository.get_following(db, target_member.id, safe_limit, safe_offset)

        if response is not None:
            inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        items = [
            StudentSummary(
                id=str(p.id),
                handle=p.handle or "cadet",
                full_name=p.full_name or "Cadet",
                department=p.department or "CSE",
                batch=p.batch or "2024-28",
                rating=p.rating or 1200,
                rating_tier=get_rating_tier(p.rating or 1200),
                avatar_url=p.avatar_url,
                is_following=str(p.id) in my_following_ids or (p.handle or "") in my_following_ids,
                is_you=bool(current_member and str(p.id) == str(current_member.id)),
            )
            for p in profiles
        ]

        followers_count, following_count = await MemberRepository.get_social_counts(db, target_member.id)
        return FollowListResponse(
            count=total_count,
            followers_count=followers_count,
            following_count=following_count,
            students=items,
        )

    @classmethod
    async def get_student_followers(
        cls,
        target: str,
        authorization: Optional[str],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        current_member = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization[len("Bearer "):].strip()
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if payload and payload.get("sub"):
                current_member = await MemberRepository.get_by_id(db, payload["sub"])
        return await cls.get_followers(target, current_member, limit, offset, db, response)

    @classmethod
    async def get_student_following(
        cls,
        target: str,
        authorization: Optional[str],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        current_member = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization[len("Bearer "):].strip()
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if payload and payload.get("sub"):
                current_member = await MemberRepository.get_by_id(db, payload["sub"])
        return await cls.get_following(target, current_member, limit, offset, db, response)

    @staticmethod
    async def get_my_following_ids(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowingIdsResponse:
        ids = await SocialRepository.get_following_ids(db, current_member.id)
        return FollowingIdsResponse(following_ids=ids)

    @staticmethod
    async def _invalidate_social_caches(current_member: MemberProfile, target_member: MemberProfile):
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
