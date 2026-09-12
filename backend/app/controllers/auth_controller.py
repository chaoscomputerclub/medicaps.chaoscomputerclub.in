import httpx
from fastapi import Request
from fastapi.responses import RedirectResponse
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



from app.core.config import settings

def is_allowed_organization_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.split("@")[-1].lower().strip()
    return domain == "medicaps.ac.in" or domain.endswith(".medicaps.ac.in")


def _is_local_dev(request: Request) -> bool:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    return "localhost" in host or "127.0.0.1" in host


def _get_redirect_uri(request: Request) -> str:
    if getattr(settings, "GOOGLE_REDIRECT_URI", None):
        return settings.GOOGLE_REDIRECT_URI
    proto = request.headers.get("x-forwarded-proto", "http" if _is_local_dev(request) else "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost:8000")
    return f"{proto}://{host}/api/auth/google/callback"


def _get_frontend_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", "http" if _is_local_dev(request) else "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if "medicaps.chaoscomputerclub.in" in host:
        return f"{proto}://medicaps.chaoscomputerclub.in"
    if "ccc-medicaps.sharexpress.in" in host:
        return f"{proto}://ccc-medicaps.sharexpress.in"
    if _is_local_dev(request):
        return getattr(settings, "FRONTEND_URL", "http://localhost:8081")
    return getattr(settings, "FRONTEND_URL", "https://medicaps.chaoscomputerclub.in")


class AuthController:

    @staticmethod
    async def send_otp(payload: SendOTPRequest) -> SendOTPResponse:
        """
        Step 1 — OTP Request.
        Generates OTP, stores in Redis with transactionID, dispatches email.
        """
        email = payload.email.strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required.")
        if not is_allowed_organization_email(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Only @medicaps.ac.in organization emails are permitted. Gmail and personal accounts are strictly prohibited."
            )

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
            sent=True,
            message=f"Verification code sent to {email}",
            transaction_id=result["transaction_id"],
            email=email,
        )

    @staticmethod
    async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession) -> AuthTokenResponse:
        """
        Step 2 — OTP Verification.
        Verifies against Redis (SHA-256, 5-attempt rate limit).
        Accepts either transaction_id + otp OR email + code.
        Finds or creates member. Issues JWT.
        """
        otp_code = payload.otp or payload.code
        identifier = payload.transaction_id or payload.email

        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction identifier or institutional email is required."
            )
        if not otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Six-digit authentication code is required."
            )

        result = await redis_verify_otp(identifier, otp_code)

        if not result.get("valid"):
            raise HTTPException(
                status_code=400,
                detail=result.get("reason", "Invalid OTP.")
            )

        email = (result.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(status_code=500, detail="Session corrupted. Please restart.")
        if not is_allowed_organization_email(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Only @medicaps.ac.in organization emails are permitted."
            )

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

    @staticmethod
    async def google_login(request: Request):
        """
        Step 1 of Google OAuth flow.
        Redirects user to Google consent screen restricted to @medicaps.ac.in hosted domain.
        """
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth is not configured on this server.",
            )

        redirect_uri = _get_redirect_uri(request)
        google_auth_url = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope=openid%20email%20profile"
            f"&access_type=offline"
            f"&prompt=select_account"
            f"&hd=medicaps.ac.in"
        )
        return RedirectResponse(url=google_auth_url)

    @staticmethod
    async def google_callback(request: Request, db: AsyncSession):
        """
        Step 2 of Google OAuth flow.
        Validates token, enforces @medicaps.ac.in organization email, upserts member record.
        """
        code = request.query_params.get("code")
        error = request.query_params.get("error")
        frontend_url = _get_frontend_url(request)

        if error or not code:
            return RedirectResponse(url=f"{frontend_url}/auth?error=google_cancelled")

        redirect_uri = _get_redirect_uri(request)

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                token_resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "redirect_uri": redirect_uri,
                        "grant_type": "authorization_code",
                    },
                )
                if token_resp.status_code != 200:
                    logger.error("Google token exchange error: %s", token_resp.text)
                    return RedirectResponse(url=f"{frontend_url}/auth?error=google_token_failed")

                token_data = token_resp.json()
                access_token_google = token_data.get("access_token")

                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token_google}"},
                )
                if userinfo_resp.status_code != 200:
                    logger.error("Google userinfo fetch failed: %s", userinfo_resp.text)
                    return RedirectResponse(url=f"{frontend_url}/auth?error=google_userinfo_failed")

                userinfo = userinfo_resp.json()
        except Exception as e:
            logger.error("Google OAuth network error: %s", e)
            return RedirectResponse(url=f"{frontend_url}/auth?error=google_network_error")

        google_id = userinfo.get("id")
        email = (userinfo.get("email") or "").strip().lower()
        name = userinfo.get("name") or ""
        picture = userinfo.get("picture") or ""

        if not email or not google_id:
            return RedirectResponse(url=f"{frontend_url}/auth?error=google_no_email")

        # STRICT ENFORCEMENT: Reject any non-organization email!
        if not is_allowed_organization_email(email):
            logger.warning("Rejected non-organization Google account: %s", email)
            return RedirectResponse(
                url=f"{frontend_url}/auth?error=unauthorized_domain&email={email}"
            )

        # Upsert member in database
        m_result = await db.execute(
            select(MemberProfile).where(
                (MemberProfile.email == email) | (MemberProfile.google_id == google_id)
            )
        )
        member = m_result.scalars().first()
        is_new = False

        if not member:
            is_new = True
            member = MemberProfile(
                email=email,
                google_id=google_id,
                avatar_url=picture or None,
                full_name=name or None,
                rating=1200,
                peak_rating=1200,
                is_onboarded=False,
            )
            db.add(member)
            await db.commit()
            await db.refresh(member)
            logger.info("New member registered via Google OAuth: %s", email)
        else:
            member.google_id = google_id
            if picture:
                member.avatar_url = picture
            member.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(member)

        jwt_token = create_access_token({"sub": member.id, "email": member.email})
        needs_onboarding = is_new or not member.is_onboarded
        return RedirectResponse(
            url=f"{frontend_url}/auth?token={jwt_token}&is_onboarded={'false' if needs_onboarding else 'true'}&onboarding={'1' if needs_onboarding else '0'}&email={member.email}"
        )

