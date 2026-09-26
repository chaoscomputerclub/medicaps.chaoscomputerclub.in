"""
Chaos Computer Club — Medi-Caps Chapter
modules/auth/auth_repository.py — Identity & Authentication Persistence Layer
"""

from typing import Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import MemberProfile, now_utc


class AuthRepository:
    """Encapsulates all database operations for member authentication and credentials."""

    @staticmethod
    async def get_by_id(db: AsyncSession, member_id: str) -> Optional[MemberProfile]:
        """Fetch member profile by unique ID."""
        stmt = select(MemberProfile).where(MemberProfile.id == member_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[MemberProfile]:
        """Fetch member profile by email address (case-insensitive)."""
        stmt = select(MemberProfile).where(func.lower(MemberProfile.email) == email.lower().strip())
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_by_handle(db: AsyncSession, handle: str) -> Optional[MemberProfile]:
        """Fetch member profile by handle (case-insensitive)."""
        stmt = select(MemberProfile).where(func.lower(MemberProfile.handle) == handle.lower().strip())
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def is_handle_taken(db: AsyncSession, handle: str, exclude_member_id: Optional[str] = None) -> bool:
        """Check if a handle is already registered by another cadet."""
        stmt = select(MemberProfile.id).where(func.lower(MemberProfile.handle) == handle.lower().strip())
        if exclude_member_id:
            stmt = stmt.where(MemberProfile.id != exclude_member_id)
        result = await db.execute(stmt)
        return result.scalars().first() is not None

    @staticmethod
    async def create_member(
        db: AsyncSession,
        email: str,
        full_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        is_onboarded: bool = False,
        **extra_fields,
    ) -> MemberProfile:
        """Create and persist a new member profile."""
        clean_email = email.lower().strip()
        member = MemberProfile(
            email=clean_email,
            full_name=full_name or clean_email.split("@")[0],
            avatar_url=avatar_url,
            is_onboarded=is_onboarded,
            rating=1200,
            peak_rating=1200,
            **extra_fields,
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def save(db: AsyncSession, member: MemberProfile) -> MemberProfile:
        """Persist changes to an existing member profile."""
        member.updated_at = now_utc()
        await db.commit()
        await db.refresh(member)
        return member
