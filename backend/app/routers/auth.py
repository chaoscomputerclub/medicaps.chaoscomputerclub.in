"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Authentication Router

Flows:
  1. Email OTP  → POST /auth/send-otp → POST /auth/verify-otp → POST /auth/complete-onboarding
  2. Google     → GET /auth/google/login → GET /auth/google/callback → POST /auth/complete-onboarding

Protected routes use: Depends(get_current_member)
"""

import asyncio
import random
import string
import smtplib
import logging
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.db import get_db
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, oauth2_scheme
from app.services.rating_service import get_rating_tier, get_tier_label
from app.models.db_models import MemberProfile, OTPStore, OfflineContest, ScoreboardEntry, CampusPass, TrustProof, RatingHistory, now_utc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _is_local_dev(request: Request) -> bool:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    return "localhost" in host or "127.0.0.1" in host


def _get_redirect_uri(request: Request) -> str:
    if getattr(settings, "GOOGLE_REDIRECT_URI", None):
        return settings.GOOGLE_REDIRECT_URI
    if _is_local_dev(request):
        host = request.headers.get("host", "localhost:8000")
        return f"http://{host}/api/auth/google/callback"
    return f"{settings.BACKEND_URL}/api/auth/google/callback"


def _get_frontend_url(request: Request) -> str:
    if _is_local_dev(request):
        return "http://localhost:8081"
    return settings.FRONTEND_URL


def get_ccc_otp_email_template(otp_code: str) -> str:
    """Return responsive HTML email template for Chaos Computer Club OTP verification."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chaos Computer Club — Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #050505; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #0f0f0f; border: 1px solid #1f1f1f; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #ff6500, #ff8c00); line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 8px 16px; background-color: #141414; border: 1px solid #262626; border-radius: 6px;">
                      <span style="font-size: 13px; font-weight: 700; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase;">
                        CHAOS COMPUTER CLUB
                      </span>
                    </div>
                    <div style="font-size: 11px; color: #737373; letter-spacing: 1px; margin-top: 6px; text-transform: uppercase;">
                      Medi-Caps University Chapter
                    </div>
                  </td>
                </tr>
              </table>

              <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 12px 0; color: #ffffff;">
                Verification Code
              </h1>
              
              <p style="font-size: 14px; line-height: 1.6; color: #a1a1a1; margin: 0 0 24px 0;">
                Enter this verification code to confirm your institutional identity and access the member portal. Valid for <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.
              </p>
              
              <div style="background-color: #141414; border: 1px solid #262626; border-radius: 8px; padding: 20px 10px; margin: 24px 0; text-align: center;">
                <span style="font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #ff6500; display: inline-block; padding-left: 8px;">
                  {otp_code}
                </span>
              </div>
              
              <p style="font-size: 12px; line-height: 1.5; color: #666666; margin: 24px 0 0 0;">
                If you did not request this verification code, ignore this email. Only verified Medi-Caps members receive portal access.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0a0a0a; border-top: 1px solid #1f1f1f; padding: 20px; text-align: center;">
              <p style="font-size: 11px; color: #525252; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                &copy; 2026 Chaos Computer Club India. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_smtp_sync(to_email: str, subject: str, html_body: str):
    """Synchronous SMTP dispatcher supporting port 465 (SSL) and port 587 (STARTTLS)."""
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    username = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM
    from_name = getattr(settings, "SMTP_FROM_NAME", "Chaos Computer Club")

    if not username or not password or not from_email:
        raise ValueError("SMTP credentials not configured.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=20)
    else:
        server = smtplib.SMTP(host, port, timeout=20)
        server.ehlo()
        if port == 587 or server.has_extn("STARTTLS"):
            server.starttls()
            server.ehlo()

    try:
        server.login(username, password)
        server.sendmail(from_email, [to_email], msg.as_string())
    finally:
        server.quit()


async def _send_otp_email(to_email: str, otp: str) -> bool:
    """Send OTP via SMTP using non-blocking asyncio.to_thread."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info("🔑 [DEV MODE] OTP for %s: %s", to_email, otp)
        return True

    try:
        html = get_ccc_otp_email_template(otp)
        subject = f"Your Chaos Computer Club Verification Code: {otp}"
        await asyncio.to_thread(_send_smtp_sync, to_email, subject, html)
        logger.info("Successfully sent OTP email to %s", to_email)
        return True
    except Exception as e:
        logger.error("SMTP error sending OTP to %s: %s", to_email, e)
        return False


# ─── Auth Dependency ──────────────────────────────────────────────────────────

async def get_current_member(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> MemberProfile:
    """Dependency: decode JWT and return authenticated MemberProfile."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    member_id: str = payload.get("sub")
    if not member_id:
        raise credentials_exception

    result = await db.execute(select(MemberProfile).where(MemberProfile.id == member_id))
    member = result.scalars().first()
    if not member:
        raise credentials_exception
    return member


async def get_current_member_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[MemberProfile]:
    """Optional auth — returns None if no token (for public endpoints)."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    result = await db.execute(
        select(MemberProfile).where(MemberProfile.id == payload.get("sub"))
    )
    return result.scalars().first()


# ─── Email OTP Flow ───────────────────────────────────────────────────────────

@router.post("/send-otp")
async def send_otp(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Step 1 of email OTP flow.
    Body: { "email": "user@medicaps.ac.in" }
    Generates a 6-digit OTP, stores it (with 10-min expiry), emails it.
    Returns { "sent": true, "email": "..." }
    """
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    # Generate OTP
    otp = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    # Clean old OTPs for this email
    await db.execute(delete(OTPStore).where(OTPStore.email == email))

    # Store new OTP
    otp_record = OTPStore(email=email, code=otp, expires_at=expires_at)
    db.add(otp_record)
    await db.commit()

    # Send email
    sent = await _send_otp_email(email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")

    res = {"sent": True, "email": email}
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        res["dev_otp"] = otp
    return res


@router.post("/verify-otp")
async def verify_otp(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Step 2 of email OTP flow.
    Body: { "email": "user@medicaps.ac.in", "code": "123456" }
    Verifies OTP. Creates member record if new user.
    Returns { "access_token": "...", "is_new_user": bool, "member": {...} }
    """
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()

    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and OTP code are required.")

    # Look up OTP
    result = await db.execute(
        select(OTPStore)
        .where(OTPStore.email == email)
        .order_by(OTPStore.created_at.desc())
    )
    otp_record = result.scalars().first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Request a new one.")

    # Check expiry
    now = datetime.now(timezone.utc)
    expires = otp_record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        await db.delete(otp_record)
        await db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Check code
    if otp_record.code != code:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check and try again.")

    # OTP valid — delete it
    await db.delete(otp_record)
    await db.commit()

    # Find or create member
    m_result = await db.execute(select(MemberProfile).where(MemberProfile.email == email))
    member = m_result.scalars().first()
    is_new_user = False

    if not member:
        is_new_user = True
        member = MemberProfile(email=email, rating=1200, peak_rating=1200)
        db.add(member)
        await db.commit()
        await db.refresh(member)

    # Issue JWT
    access_token = create_access_token({"sub": member.id, "email": member.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new_user or not member.is_onboarded,
        "member": _public_member(member),
    }


# ─── Google OAuth Flow ────────────────────────────────────────────────────────

@router.get("/google/login")
async def google_login(request: Request):
    """
    Step 1 of Google OAuth flow.
    Redirects user to Google consent screen.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured on this server.",
        )

    redirect_uri = _get_redirect_uri(request)
    scope = "openid email profile"
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Step 2 of Google OAuth flow.
    Exchanges code for token, upserts member record, redirects to frontend with JWT.
    """
    code = request.query_params.get("code")
    error = request.query_params.get("error")
    frontend_url = _get_frontend_url(request)

    if error or not code:
        return RedirectResponse(url=f"{frontend_url}/auth?error=google_cancelled")

    redirect_uri = _get_redirect_uri(request)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Exchange code for tokens
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
                return RedirectResponse(url=f"{frontend_url}/auth?error=google_token_failed")

            token_data = token_resp.json()
            access_token_google = token_data.get("access_token")

            # Fetch user info
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token_google}"},
            )
            if userinfo_resp.status_code != 200:
                return RedirectResponse(url=f"{frontend_url}/auth?error=google_userinfo_failed")

            userinfo = userinfo_resp.json()
    except Exception as e:
        logger.error("Google OAuth error: %s", e)
        return RedirectResponse(url=f"{frontend_url}/auth?error=google_network_error")

    google_id = userinfo.get("id")
    email = (userinfo.get("email") or "").lower()
    name = userinfo.get("name") or ""
    picture = userinfo.get("picture") or ""

    if not email or not google_id:
        return RedirectResponse(url=f"{frontend_url}/auth?error=google_no_email")

    # Upsert member
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
            avatar_url=picture,
            full_name=name or None,
            rating=1200,
            peak_rating=1200,
        )
        db.add(member)
    else:
        # Update Google info
        member.google_id = google_id
        if picture:
            member.avatar_url = picture

    await db.commit()
    await db.refresh(member)

    # Issue JWT
    jwt_token = create_access_token({"sub": member.id, "email": member.email})

    # Redirect to frontend with token in query param — frontend stores in localStorage
    needs_onboarding = is_new or not member.is_onboarded
    return RedirectResponse(
        url=f"{frontend_url}/auth?token={jwt_token}&is_onboarded={'false' if needs_onboarding else 'true'}&onboarding={'1' if needs_onboarding else '0'}&email={member.email}"
    )


# ─── Onboarding ───────────────────────────────────────────────────────────────

@router.post("/complete-onboarding")
async def complete_onboarding(
    payload: dict,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Called after first login (email or Google) to collect handle, full_name, PRN, department, batch.
    Body: { "handle": "...", "full_name": "...", "prn": "...", "department": "...", "batch": "..." }
    """
    handle = (payload.get("handle") or "").strip().lower()
    full_name = (payload.get("full_name") or "").strip()
    prn = (payload.get("prn") or "").strip().upper()
    department = (payload.get("department") or "").strip()
    batch = (payload.get("batch") or "").strip()

    if not all([handle, full_name, prn, department, batch]):
        raise HTTPException(status_code=400, detail="All fields are required: handle, full_name, prn, department, batch.")

    if len(handle) < 3 or len(handle) > 30:
        raise HTTPException(status_code=400, detail="Handle must be 3–30 characters.")

    if not handle.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Handle may only contain letters, digits, and underscores.")

    # Check uniqueness
    handle_check = await db.execute(
        select(MemberProfile).where(
            MemberProfile.handle == handle, MemberProfile.id != current_member.id
        )
    )
    if handle_check.scalars().first():
        raise HTTPException(status_code=409, detail="That handle is already taken.")

    prn_check = await db.execute(
        select(MemberProfile).where(
            MemberProfile.prn == prn, MemberProfile.id != current_member.id
        )
    )
    if prn_check.scalars().first():
        raise HTTPException(status_code=409, detail="That PRN is already registered.")

    valid_departments = {"CSE", "IT", "AIDS", "Cyber Security"}
    if department not in valid_departments:
        raise HTTPException(status_code=400, detail=f"Department must be one of: {', '.join(valid_departments)}.")

    valid_batches = {"2022-26", "2023-27", "2024-28", "2025-29"}
    if batch not in valid_batches:
        raise HTTPException(status_code=400, detail=f"Batch must be one of: {', '.join(valid_batches)}.")

    # Update member
    current_member.handle = handle
    current_member.full_name = full_name
    current_member.prn = prn
    current_member.department = department
    current_member.batch = batch
    current_member.is_onboarded = True

    await db.commit()
    await db.refresh(current_member)

    return {
        "success": True,
        "member": _public_member(current_member),
    }


# ─── Profile ──────────────────────────────────────────────────────────────────


@router.get("/profile/full")
async def get_full_profile(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Return comprehensive competitive profile data strictly for the authenticated member.
    Guest members are strictly forbidden. Only authenticated users allowed.
    """

    # 1. Rank & Active Counts
    rank_res = await db.execute(
        select(func.count(MemberProfile.id)).where(MemberProfile.rating > current_member.rating)
    )
    university_rank = (rank_res.scalar() or 0) + 1

    count_res = await db.execute(select(func.count(MemberProfile.id)))
    active_members = count_res.scalar() or 1

    # 2. Podiums
    podium_res = await db.execute(
        select(func.count(ScoreboardEntry.id)).where(
            ScoreboardEntry.handle == current_member.handle,
            ScoreboardEntry.rank <= 3,
        )
    )
    podiums = podium_res.scalar() or 0

    # 3. Tier
    raw_tier = get_rating_tier(current_member.rating)
    tier_label = get_tier_label(raw_tier)

    # 4. Rating History
    rh_res = await db.execute(
        select(RatingHistory)
        .where(RatingHistory.member_id == current_member.id)
        .order_by(RatingHistory.contested_at.asc())
    )
    histories = rh_res.scalars().all()
    rating_history = [
        {
            "contest": h.contest_title,
            "date": h.contested_at.strftime("%b %Y"),
            "rank": h.rank,
            "old_rating": h.old_rating,
            "new_rating": h.new_rating,
            "delta": h.new_rating - h.old_rating,
        }
        for h in histories
    ]
    if not rating_history:
        rating_history = []

    # 5. Recent Battles
    sb_res = await db.execute(
        select(ScoreboardEntry)
        .where(ScoreboardEntry.handle == current_member.handle)
        .order_by(ScoreboardEntry.rank.asc())
    )
    entries = sb_res.scalars().all()
    recent_battles = []
    for entry in entries:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.id == entry.contest_id))
        contest = c_res.scalars().first()
        p_res = await db.execute(
            select(TrustProof).where(
                TrustProof.contest_id == entry.contest_id,
                TrustProof.member_handle == entry.handle,
            )
        )
        proof = p_res.scalars().first()
        cert_id = proof.certificate_id if proof else f"MED-CERT-{entry.id[:8].upper()}"
        recent_battles.append({
            "contest": contest.title if contest else "Chaos Arena",
            "certificate_id": cert_id,
            "date": contest.starts_at.isoformat() if contest else now_utc().isoformat(),
            "rank": entry.rank,
            "delta": entry.rating_delta or 0,
            "solved": f"{entry.solved}/6",
            "penalty": f"{entry.penalty_seconds // 60}m",
        })

    # 6. Campus Pass
    cp_res = await db.execute(
        select(CampusPass)
        .where(CampusPass.member_id == current_member.id)
        .order_by(CampusPass.issued_at.desc())
    )
    pass_obj = cp_res.scalars().first()
    if pass_obj:
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.id == pass_obj.contest_id))
        c_obj = c_res.scalars().first()
        campus_pass = {
            "pass_code": pass_obj.pass_code,
            "member_name": current_member.full_name or "Participant",
            "handle": current_member.handle,
            "prn_hash": f"PRN-{(current_member.prn or '0000')[-4:]}",
            "contest_title": c_obj.title if c_obj else "Chaos Arena Season 02",
            "seat": pass_obj.seat_number,
            "venue": c_obj.venue if c_obj else "Auditorium Main Hall",
            "check_in_opens_at": c_obj.check_in_opens_at.isoformat() if c_obj else now_utc().isoformat(),
            "status": "issued" if pass_obj.check_in_status not in ["issued", "checked_in", "expired"] else pass_obj.check_in_status,
        }
    else:
        campus_pass = {
            "pass_code": f"CCC-MCU-26-GEN-{current_member.id[:4].upper()}",
            "member_name": current_member.full_name or "Participant",
            "handle": current_member.handle,
            "prn_hash": f"PRN-{(current_member.prn or '0000')[-4:]}",
            "contest_title": "Winter Algothon: On-Premise LAN Battle",
            "seat": "Station Allocated at Gate Check-in",
            "venue": "Auditorium Main Hall & CS Labs 401-404",
            "check_in_opens_at": now_utc().isoformat(),
            "status": "issued",
        }

    # 7. Trust Proofs
    tp_res = await db.execute(
        select(TrustProof)
        .where(TrustProof.member_handle == current_member.handle)
        .order_by(TrustProof.issued_at.desc())
    )
    proofs = [
        {
            "certificate_id": p.certificate_id,
            "contest_slug": "chaos-arena-2026",
            "contest_title": p.contest_title,
            "member_handle": p.member_handle,
            "session_uuid": p.session_uuid,
            "prn_hash": p.prn_hash,
            "sha256_digest": p.sha256_digest,
            "proctor_stamp": p.proctor_stamp,
            "attendance_stamp": p.attendance_stamp,
            "score": p.score,
            "rank": p.rank,
            "issued_at": p.issued_at.isoformat(),
            "status": "valid" if p.status not in ["valid", "revoked"] else p.status,
        }
        for p in tp_res.scalars().all()
    ]

    # 8. Achievements
    achievements = [
        {
            "code": "FIRST_AC",
            "name": "First Blood: Problem A",
            "description": "Solved first offline competitive problem at proctored station.",
            "earned": (current_member.rating >= 1200),
        },
        {
            "code": "DIV_LADDER",
            "name": "Division 2 Ascent",
            "description": "Crossed 1600 official rating threshold on University ladder.",
            "earned": (current_member.rating >= 1600),
        },
        {
            "code": "CENTURION",
            "name": "Centurion Attendance",
            "description": "Attended consecutive campus offline rounds with zero attendance violations.",
            "earned": (current_member.attendance_count >= 5),
        },
        {
            "code": "TOP_30",
            "name": "Phase 1 Qualifier",
            "description": "Secured Top 30 standing in online screening and received physical lab pass.",
            "earned": (pass_obj is not None or current_member.rating >= 1700),
        },
        {
            "code": "CORE_PROCTOR",
            "name": "Trust Custodian",
            "description": "Appointed core member and proctor authority for air-gapped contests.",
            "earned": current_member.is_core_member,
        },
    ]

    member_data = {
        "id": current_member.id,
        "handle": current_member.handle or "member",
        "full_name": current_member.full_name or "Medi-Caps Member",
        "email": current_member.email,
        "prn": current_member.prn or "0827CS231000",
        "department": current_member.department or "CSE",
        "batch": current_member.batch or "2023-27",
        "rating": current_member.rating,
        "peak_rating": current_member.peak_rating,
        "peak_contest": "Chaos Arena: Season 02",
        "university_rank": university_rank,
        "active_members": active_members,
        "attendance_count": current_member.attendance_count,
        "attendance_total": current_member.attendance_total or 10,
        "tier": tier_label,
        "is_core_member": current_member.is_core_member,
        "podiums": podiums,
        "streak": current_member.attendance_count or 1,
    }

    return {
        "member": member_data,
        "ratingHistory": rating_history,
        "recentBattles": recent_battles,
        "campusPass": campus_pass,
        "proofs": proofs,
        "achievements": achievements,
    }

@router.get("/me")
async def get_me(current_member: MemberProfile = Depends(get_current_member)):
    """Return currently authenticated member profile."""
    return {"success": True, "member": _public_member(current_member)}


@router.post("/logout")
async def logout():
    """Stateless JWT logout — client drops the token."""
    return {"success": True, "message": "Logged out."}


@router.get("/members/{handle}")
async def get_public_member(handle: str, db: AsyncSession = Depends(get_db)):
    """Return public member profile by handle."""
    result = await db.execute(select(MemberProfile).where(MemberProfile.handle == handle))
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail=f"Member @{handle} not found.")
    return _public_member(member)


# ─── Serializer ───────────────────────────────────────────────────────────────

def _public_member(member: MemberProfile) -> dict:
    return {
        "id": member.id,
        "handle": member.handle,
        "full_name": member.full_name,
        "email": member.email,
        "prn": member.prn,
        "department": member.department,
        "batch": member.batch,
        "rating": member.rating,
        "peak_rating": member.peak_rating,
        "attendance_count": member.attendance_count,
        "attendance_total": member.attendance_total,
        "is_core_member": member.is_core_member,
        "is_onboarded": member.is_onboarded,
        "avatar_url": member.avatar_url,
        "created_at": member.created_at.isoformat() if member.created_at else None,
    }
