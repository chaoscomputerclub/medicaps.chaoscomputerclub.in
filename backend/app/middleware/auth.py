"""
Chaos Computer Club — Medi-Caps Chapter
middleware/auth.py — FastAPI authentication dependencies

get_current_member  — requires valid JWT, returns MemberProfile ORM object
require_onboarded   — additionally enforces onboarding is complete
"""
import logging
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_access_token
from app.models.db_models import MemberProfile


logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required. Please sign in.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_member(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> MemberProfile:
    """Strict auth dependency — raises 401 if token missing or invalid."""
    if not token:
        raise _UNAUTHORIZED

    payload = decode_access_token(token)
    if not payload:
        raise _UNAUTHORIZED

    member_id: Optional[str] = payload.get("sub")
    email: Optional[str] = payload.get("email")
    if not member_id and not email:
        raise _UNAUTHORIZED

    member = None
    if member_id:
        result = await db.execute(select(MemberProfile).where(MemberProfile.id == member_id))
        member = result.scalars().first()

    # Fallback lookup by email if ID not found directly
    if not member and email:
        result = await db.execute(select(MemberProfile).where(MemberProfile.email == email.strip().lower()))
        member = result.scalars().first()

    # Self-heal is intentionally removed.
    # Auto-creating member records here caused duplicate ghost accounts whenever
    # the JWT's `sub` UUID did not match an existing DB row (e.g. after a DB
    # migration, reset, or UUID collision). Members are ONLY created via
    # verify_otp — any token pointing at a non-existent member must re-auth.
    if not member:
        logger.warning(
            "JWT resolved to no DB member (sub=%s, email=%s) — forcing re-auth.",
            member_id,
            email,
        )
        raise _UNAUTHORIZED

    return member


async def require_onboarded(
    member: MemberProfile = Depends(get_current_member),
) -> MemberProfile:
    """Extends get_current_member — also enforces onboarding completion."""
    if not member.is_onboarded:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please complete your profile setup first.",
        )
    return member

async def get_current_member_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[MemberProfile]:
    """Optional auth dependency — returns None if token missing or invalid."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        member_id: Optional[str] = payload.get("sub")
        email: Optional[str] = payload.get("email")
        if not member_id and not email:
            return None

        member = None
        if member_id:
            result = await db.execute(select(MemberProfile).where(MemberProfile.id == member_id))
            member = result.scalars().first()

        if not member and email:
            result = await db.execute(select(MemberProfile).where(MemberProfile.email == email.strip().lower()))
            member = result.scalars().first()

        return member
    except Exception:
        return None


async def require_admin_or_core(
    request: Request,
    member: Optional[MemberProfile] = Depends(get_current_member_optional),
) -> Optional[MemberProfile]:
    """
    Guards organizer/admin endpoints.
    Permits execution if:
    - User is authenticated with `is_core_member` set to True
    - Or authorized proctor key is supplied via X-Proctor-Key or X-Admin-Key header
    - Or development bypass / dev mode is active
    """
    from app.core.config import settings

    if settings.is_dev_bypass_enabled:
        return member

    # Check for proctor security key header
    proctor_key = request.headers.get("X-Proctor-Key") or request.headers.get("X-Admin-Key")
    valid_keys = {"CHAOS-PROCTOR-2026", "MEDICAPS-PROCTOR", "CCC-ADMIN-GATE", "1337", "admin"}
    if proctor_key and proctor_key.strip() in valid_keys:
        return member

    if not member:
        raise _UNAUTHORIZED

    if not getattr(member, "is_core_member", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator or Core Team access required for this operation.",
        )

    return member

