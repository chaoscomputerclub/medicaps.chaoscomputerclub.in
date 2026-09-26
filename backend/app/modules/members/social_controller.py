"""
Chaos Computer Club — Medi-Caps Chapter
modules/members/social_controller.py — Thin HTTP Orchestrator for Peer Social Network
"""

from typing import Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile
from app.schemas.social import (
    FollowResponse,
    FollowListResponse,
    FollowingIdsResponse,
)
from app.modules.members.social_service import SocialService


class SocialController:
    """Thin controller delegating student social graph operations to SocialService."""

    @staticmethod
    async def follow_student(
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        return await SocialService.follow_student(target, current_member, db)

    @staticmethod
    async def unfollow_student(
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        return await SocialService.unfollow_student(target, current_member, db)

    @staticmethod
    async def toggle_follow_student(
        target: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowResponse:
        return await SocialService.toggle_follow_student(target, current_member, db)

    @staticmethod
    async def get_followers(
        target: str,
        current_member: Optional[MemberProfile],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        return await SocialService.get_followers(target, current_member, limit, offset, db, response)

    @staticmethod
    async def get_following(
        target: str,
        current_member: Optional[MemberProfile],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        return await SocialService.get_following(target, current_member, limit, offset, db, response)

    @staticmethod
    async def get_student_followers(
        target: str,
        authorization: Optional[str],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        return await SocialService.get_student_followers(target, authorization, limit, offset, db, response)

    @staticmethod
    async def get_student_following(
        target: str,
        authorization: Optional[str],
        limit: int,
        offset: int,
        db: AsyncSession,
        response: Optional[Response] = None,
    ) -> FollowListResponse:
        return await SocialService.get_student_following(target, authorization, limit, offset, db, response)

    @staticmethod
    async def get_my_following_ids(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> FollowingIdsResponse:
        return await SocialService.get_my_following_ids(current_member, db)
