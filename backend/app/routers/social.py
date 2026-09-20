"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/social.py — Thin HTTP Router for Student Following & Followers Network
Delegates to app.controllers.social_controller.SocialController
"""

from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.db_models import MemberProfile
from app.schemas.social import (
    FollowResponse,
    FollowListResponse,
    FollowingIdsResponse,
)
from app.middleware.auth import get_current_member
from app.controllers.social_controller import SocialController

router = APIRouter(prefix="/social", tags=["Social Network & Following"])


@router.post("/follow/{target}", response_model=FollowResponse)
async def follow_student(
    target: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Follow another student by handle or UUID."""
    return await SocialController.follow_student(target=target, current_member=current_member, db=db)


@router.post("/toggle/{target}", response_model=FollowResponse)
async def toggle_follow_student(
    target: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Atomically toggle follow/unfollow status for a target student."""
    return await SocialController.toggle_follow_student(target=target, current_member=current_member, db=db)


@router.delete("/follow/{target}", response_model=FollowResponse)
@router.post("/unfollow/{target}", response_model=FollowResponse)
async def unfollow_student(
    target: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Unfollow a student by handle or UUID."""
    return await SocialController.unfollow_student(target=target, current_member=current_member, db=db)


@router.get("/my-following-ids", response_model=FollowingIdsResponse)
async def get_my_following_ids(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve IDs of all students currently followed by the authenticated user with Redis caching."""
    return await SocialController.get_my_following_ids(current_member=current_member, db=db)


@router.get("/{target}/followers", response_model=FollowListResponse)
async def get_student_followers(
    target: str,
    response: Response,
    limit: int = Query(50, ge=1, le=200, description="Max students to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated list of students following target member."""
    return await SocialController.get_student_followers(
        target=target,
        authorization=authorization,
        limit=limit,
        offset=offset,
        db=db,
        response=response,
    )


@router.get("/{target}/following", response_model=FollowListResponse)
async def get_student_following(
    target: str,
    response: Response,
    limit: int = Query(50, ge=1, le=200, description="Max students to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated list of students that target member is following."""
    return await SocialController.get_student_following(
        target=target,
        authorization=authorization,
        limit=limit,
        offset=offset,
        db=db,
        response=response,
    )

