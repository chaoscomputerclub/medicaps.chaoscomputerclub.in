"""
Chaos Computer Club — Medi-Caps Chapter
controllers/auth_controller.py — Authentication business logic
Architecture mirrors: Interleet/backend/app/controllers/user.py

All methods are pure business logic with zero HTTP I/O.
Routers call these; controllers call utils/lib/models.
"""
import logging
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.lib.otp import generate_otp
from app.utils.otp_store import send_otp as redis_send_otp, verify_otp as redis_verify_otp
from app.utils.email import send_otp_email
from app.models.db_models import MemberProfile
from app.schemas.auth import (
    SendOTPRequest,
    SendOTPResponse,
    VerifyOTPRequest,
    AuthTokenResponse,
    MemberPublic,
    CompleteOnboardingRequest,
)

logger = logging.getLogger(__name__)


def _to_member_public(member: MemberProfile) -> MemberPublic:
    return MemberPublic(
        handle=member.handle,
        full_name=member.full_name,
        email=member.email,
        department=member.department,
        batch=member.batch,
        rating=member.rating,
        is_onboarded=member.is_onboarded,
    )


class AuthController:

    @staticmethod
    async def send_otp(payload: SendOTPRequest) -> SendOTPResponse:
        """
        Step 1 — OTP Request.
        Generates OTP, stores in Redis with transactionID, dispatches email.
        """
        email = payload.email
        if not email:
            raise HTTPException(status_code=400, detail="Email is required.")

        otp = generate_otp()

        # Store in Redis (mirrors Interleet sendOTP utility)
        result = await redis_send_otp(email, otp)
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail="Failed to create OTP session. Please try again."
            )

        # Dispatch email
        sent = await send_otp_email(email, otp)
        if not sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification email. Please try again."
            )

        logger.info("OTP dispatched for %s (txn=%s)", email, result["transaction_id"])
        return SendOTPResponse(
            success=True,
            message=f"Verification code sent to {email}",
            transaction_id=result["transaction_id"],
        )

    @staticmethod
    async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession) -> AuthTokenResponse:
        """
        Step 2 — OTP Verification.
        Verifies against Redis (SHA-256, 5-attempt rate limit).
        Finds or creates member. Issues JWT.
        """
        result = await redis_verify_otp(payload.transaction_id, payload.otp)

        if not result.get("valid"):
            raise HTTPException(
                status_code=400,
                detail=result.get("reason", "Invalid OTP.")
            )

        email = result.get("email")
        if not email:
            raise HTTPException(status_code=500, detail="Session corrupted. Please restart.")

        # Find or create member
        row = await db.execute(select(MemberProfile).where(MemberProfile.email == email))
        member = row.scalars().first()
        is_new = False

        if not member:
            is_new = True
            member = MemberProfile(
                email=email,
                rating=1200,
                peak_rating=1200,
                is_onboarded=False,
            )
            db.add(member)
            await db.commit()
            await db.refresh(member)
            logger.info("New member created for %s", email)
        else:
            # Update last seen via ORM assignment
            member.updated_at = datetime.now(timezone.utc)
            await db.commit()

        token = create_access_token({"sub": member.id, "email": member.email})
        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            is_new_user=is_new or not member.is_onboarded,
            member=_to_member_public(member),
        )

    @staticmethod
    async def complete_onboarding(
        payload: CompleteOnboardingRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        """
        Step 3 — Post-auth onboarding: set handle, name, PRN, department, batch.
        Idempotent — can be re-submitted if partial.
        """
        # Handle uniqueness check
        existing = await db.execute(
            select(MemberProfile).where(
                MemberProfile.handle == payload.handle,
                MemberProfile.id != current_member.id,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Handle already taken. Choose another.")

        current_member.handle = payload.handle
        current_member.full_name = payload.full_name
        current_member.prn = payload.prn
        current_member.department = payload.department
        current_member.batch = payload.batch
        current_member.is_onboarded = True
        current_member.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(current_member)

        return {
            "success": True,
            "message": "Onboarding complete. Welcome to the arena.",
            "member": _to_member_public(current_member).model_dump(),
        }

    @staticmethod
    async def get_full_profile(current_member: MemberProfile, db: AsyncSession) -> dict:
        """Return full member profile with computed stats."""
        from sqlalchemy import func
        from app.models.db_models import ScoreboardEntry, OfflineContest, CampusPass

        # Active campus pass
        pass_row = await db.execute(
            select(CampusPass).where(
                CampusPass.member_id == current_member.id,
            ).order_by(CampusPass.issued_at.desc())
        )
        campus_pass = pass_row.scalars().first()

        total_contests = await db.scalar(select(func.count(OfflineContest.id)))
        attended = await db.scalar(
            select(func.count(ScoreboardEntry.id)).where(
                ScoreboardEntry.member_id == current_member.id
            )
        )
        all_members_count = await db.scalar(select(func.count(MemberProfile.id)))
        ranked = await db.scalar(
            select(func.count(MemberProfile.id)).where(
                MemberProfile.rating > current_member.rating
            )
        )

        return {
            "member": {
                "id": current_member.id,
                "handle": current_member.handle,
                "full_name": current_member.full_name,
                "email": current_member.email,
                "prn": current_member.prn,
                "department": current_member.department,
                "batch": current_member.batch,
                "rating": current_member.rating,
                "peak_rating": current_member.peak_rating,
                "university_rank": (ranked or 0) + 1,
                "active_members": all_members_count or 0,
                "attendance_count": attended or 0,
                "attendance_total": total_contests or 0,
                "is_onboarded": current_member.is_onboarded,
            },
            "campusPass": {
                "member_name": current_member.full_name or current_member.email,
                "handle": current_member.handle or "—",
                "prn_hash": f"PRN-{current_member.prn[-4:]}" if current_member.prn else "N/A",
                "is_active": campus_pass is not None,
                "pass_id": campus_pass.id if campus_pass else None,
                "contest_id": campus_pass.contest_id if campus_pass else None,
            } if campus_pass else {
                "is_active": False,
                "pass_id": None,
                "member_name": current_member.full_name or current_member.email,
                "handle": current_member.handle or "—",
                "prn_hash": "N/A",
                "contest_id": None,
            },
        }
