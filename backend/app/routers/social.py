from app.core.cache import get_cache, set_cache, delete_cache, delete_cache_pattern
"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Social Router: Student Following & Followers Network
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.db_models import MemberProfile, StudentFollow
from app.schemas.social import (
    FollowResponse,
    FollowListResponse,
    StudentSummary,
    FollowingIdsResponse,
)
from app.middleware.auth import get_current_member
from app.services.rating_service import get_rating_tier

router = APIRouter(prefix="/social", tags=["Social Network & Following"])


async def resolve_member(target: str, db: AsyncSession) -> MemberProfile:
    """Resolve a member by handle (case-insensitive) or UUID."""
    stmt = select(MemberProfile).where(
        (func.lower(MemberProfile.handle) == target.lower()) | (MemberProfile.id == target)
    )
    res = await db.execute(stmt)
    member = res.scalars().first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student '{target}' not found.",
        )
    return member


@router.post("/follow/{target}", response_model=FollowResponse)
async def follow_student(
    target: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Follow another student by handle or UUID."""
    target_member = await resolve_member(target, db)

    if target_member.id == current_member.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot follow yourself.",
        )

    # Check existing relationship
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
        await delete_cache(f"cache:social:my_following:{current_member.id}")
        await delete_cache_pattern(f"cache:social:*{target_member.id}*")
        await delete_cache_pattern(f"cache:social:*{current_member.id}*")

    # Recalculate target's followers count and current user's following count
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
        target_handle=target_member.handle or "—",
        message=f"You are now following @{target_member.handle or 'student'}.",
    )


@router.delete("/follow/{target}", response_model=FollowResponse)
@router.post("/unfollow/{target}", response_model=FollowResponse)
async def unfollow_student(
    target: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Unfollow a student by handle or UUID."""
    target_member = await resolve_member(target, db)

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

        # Invalidate social & profile caches
        await delete_cache(f"cache:profile:{target_member.id}")
        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache(f"cache:social:my_following:{current_member.id}")
        await delete_cache_pattern(f"cache:social:*{target_member.id}*")
        await delete_cache_pattern(f"cache:social:*{current_member.id}*")

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
        target_handle=target_member.handle or "—",
        message=f"Unfollowed @{target_member.handle or 'student'}.",
    )


@router.get("/my-following-ids", response_model=FollowingIdsResponse)
async def get_my_following_ids(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve IDs of all students currently followed by the authenticated user with Redis caching."""
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


@router.get("/{target}/followers", response_model=FollowListResponse)
async def get_student_followers(
    target: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get list of students following target member."""
    target_member = await resolve_member(target, db)

    # Optional current member check
    current_member_id: Optional[str] = None
    my_following_set = set()
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        try:
            from app.core.security import decode_jwt
            payload = decode_jwt(token)
            if payload and "sub" in payload:
                current_member_id = payload["sub"]
                # Get set of IDs current member follows
                fid_res = await db.execute(
                    select(StudentFollow.following_id).where(
                        StudentFollow.follower_id == current_member_id
                    )
                )
                my_following_set = set(fid_res.scalars().all())
        except Exception:
            pass

    # Query followers
    stmt = (
        select(MemberProfile)
        .join(StudentFollow, StudentFollow.follower_id == MemberProfile.id)
        .where(StudentFollow.following_id == target_member.id)
        .order_by(StudentFollow.created_at.desc())
    )
    res = await db.execute(stmt)
    followers = res.scalars().all()

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
            )
        )

    return FollowListResponse(count=len(students), students=students)


@router.get("/{target}/following", response_model=FollowListResponse)
async def get_student_following(
    target: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get list of students that target member is following."""
    target_member = await resolve_member(target, db)

    current_member_id: Optional[str] = None
    my_following_set = set()
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

    # Query following
    stmt = (
        select(MemberProfile)
        .join(StudentFollow, StudentFollow.following_id == MemberProfile.id)
        .where(StudentFollow.follower_id == target_member.id)
        .order_by(StudentFollow.created_at.desc())
    )
    res = await db.execute(stmt)
    following = res.scalars().all()

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
            )
        )

    return FollowListResponse(count=len(students), students=students)
