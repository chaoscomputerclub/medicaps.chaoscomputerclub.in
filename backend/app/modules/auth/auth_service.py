"""
Chaos Computer Club — Medi-Caps Chapter
modules/auth/auth_service.py — Authentication & Session Application Service
"""

import logging
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import delete_cache, delete_cache_pattern
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    store_refresh_token,
    verify_and_revoke_refresh_token,
    revoke_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
)
from app.models.db_models import MemberProfile
from app.schemas.auth import (
    SendOTPRequest,
    SendOTPResponse,
    VerifyOTPRequest,
    AuthTokenResponse,
    CompleteOnboardingRequest,
)
from app.modules.auth.auth_repository import AuthRepository
from app.modules.auth.otp_service import OtpService
from app.modules.members.member_mapper import to_member_public

logger = logging.getLogger(__name__)

_ENROLLMENT_RE = re.compile(r"^[a-z]{2}\d{2}[a-z]{2}\d+", re.I)


class AuthService:
    """Application Service orchestrating authentication, sessions, and onboarding."""

    @staticmethod
    async def send_otp(payload: SendOTPRequest, request: Optional[Request] = None) -> SendOTPResponse:
        data = await OtpService.request_otp(
            email=payload.email,
            turnstile_token=payload.turnstile_token,
            request=request,
        )
        return SendOTPResponse(
            success=True,
            sent=True,
            message=data["message"],
            transaction_id=data["transaction_id"],
            email=data["email"],
            dev_otp=None,
        )

    @staticmethod
    async def verify_otp(
        payload: VerifyOTPRequest,
        db: AsyncSession,
        request: Optional[Request] = None,
        response: Optional[Response] = None,
    ) -> AuthTokenResponse:
        otp_code = payload.otp or payload.code or ""
        identifier = payload.transaction_id or payload.email or ""

        email = await OtpService.verify_otp(identifier, otp_code)

        member = await AuthRepository.get_by_email(db, email)
        is_new = False

        if not member:
            is_new = True
            member = await AuthRepository.create_member(
                db=db,
                email=email,
                rating=1200,
                peak_rating=1200,
                is_onboarded=False,
                is_core_member=False,
            )
            logger.info("New member registered via OTP: %s", email)
        else:
            member.updated_at = datetime.now(timezone.utc)
            await AuthRepository.save(db, member)

        token = create_access_token({"sub": member.id, "email": member.email})
        refresh_token = generate_refresh_token()
        await store_refresh_token(refresh_token, member.id, member.email)

        if response is not None:
            set_auth_cookies(
                response=response,
                access_token=token,
                refresh_token=refresh_token,
                request=request,
            )

        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            is_new_user=is_new,
            member=to_member_public(member),
        )

    @staticmethod
    async def complete_onboarding(
        payload: CompleteOnboardingRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        clean_name = (payload.full_name or "").strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Full name is required.")
        if _ENROLLMENT_RE.match(clean_name):
            raise HTTPException(
                status_code=400,
                detail="Full name cannot be an enrollment number. Please enter your real name (e.g. Rahul Sharma).",
            )
        if len(clean_name) < 2:
            raise HTTPException(status_code=400, detail="Full name must be at least 2 characters.")

        if await AuthRepository.is_handle_taken(db, payload.handle, exclude_member_id=current_member.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handle already taken. Choose another.")

        current_member.handle = payload.handle
        current_member.full_name = clean_name

        if payload.prn:
            from sqlalchemy import select
            existing_prn = await db.execute(
                select(MemberProfile).where(
                    MemberProfile.prn == payload.prn,
                    MemberProfile.id != current_member.id,
                )
            )
            if existing_prn.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Enrollment number '{payload.prn}' is already linked to another cadet profile.",
                )
            current_member.prn = payload.prn

        if payload.department:
            current_member.department = payload.department
        if payload.batch:
            current_member.batch = payload.batch

        current_member.is_onboarded = True
        await AuthRepository.save(db, current_member)

        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache_pattern("cache:leaderboard:*")

        return {
            "success": True,
            "message": "Onboarding complete. Welcome to the arena.",
            "member": to_member_public(current_member).model_dump(),
        }

    @staticmethod
    async def re_onboard(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        current_member.is_onboarded = False
        await AuthRepository.save(db, current_member)

        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache_pattern("cache:leaderboard:*")

        return {
            "success": True,
            "message": "Onboarding re-opened.",
            "member": to_member_public(current_member).model_dump(),
        }

    @staticmethod
    async def check_handle(handle: str, db: AsyncSession) -> dict:
        clean = handle.strip().lower()
        if not clean or len(clean) < 3 or len(clean) > 20 or not clean.replace("_", "").isalnum():
            return {
                "available": False,
                "reason": "Handle must be 3-20 characters, alphanumeric and underscores only.",
            }

        taken = await AuthRepository.is_handle_taken(db, clean)
        return {
            "available": not taken,
            "handle": clean,
            "reason": "Handle already taken." if taken else "Available",
        }

    @staticmethod
    async def refresh_tokens(
        request: Request,
        response: Response,
        db: AsyncSession,
    ) -> dict:
        token_candidate = (
            request.cookies.get("refresh_token")
            or request.headers.get("X-Refresh-Token")
            or request.headers.get("x-refresh-token")
        )
        if not token_candidate:
            clear_auth_cookies(response, request)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token required. Please sign in again.",
            )

        payload = await verify_and_revoke_refresh_token(token_candidate.strip())
        if not payload:
            clear_auth_cookies(response, request)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired or revoked. Please sign in again.",
            )

        member_id = payload.get("member_id")
        email = payload.get("email")

        member = None
        if member_id:
            member = await AuthRepository.get_by_id(db, member_id)
        if not member and email:
            member = await AuthRepository.get_by_email(db, email)

        if not member:
            clear_auth_cookies(response, request)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Member account no longer exists. Please sign in again.",
            )

        new_access_token = create_access_token({"sub": member.id, "email": member.email})
        new_refresh_token = generate_refresh_token()
        await store_refresh_token(new_refresh_token, member.id, member.email)

        set_auth_cookies(
            response=response,
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            request=request,
        )

        return {
            "success": True,
            "access_token": new_access_token,
            "token_type": "bearer",
            "member": to_member_public(member),
        }

    @staticmethod
    async def logout(
        request: Request,
        response: Response,
        current_member: Optional[MemberProfile] = None,
    ) -> dict:
        token_candidate = (
            request.cookies.get("refresh_token")
            or request.headers.get("X-Refresh-Token")
            or request.headers.get("x-refresh-token")
        )
        if token_candidate:
            await revoke_refresh_token(token_candidate.strip())

        clear_auth_cookies(response, request)
        return {"success": True, "message": "Logged out successfully."}
