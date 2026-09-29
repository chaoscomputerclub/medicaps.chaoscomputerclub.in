"""
Chaos Computer Club — Medi-Caps Chapter
modules/auth/oauth_service.py — Google OAuth Service Restricted to @medicaps.ac.in
"""

import logging
import secrets
from datetime import datetime, timezone
import urllib.parse
import httpx
from fastapi import HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    store_refresh_token,
    set_auth_cookies,
    is_connection_secure,
)
from app.modules.auth.auth_repository import AuthRepository
from app.modules.auth.otp_service import is_allowed_organization_email

from app.core.origins import (
    validate_frontend_origin,
    get_default_frontend_url,
    encode_oauth_state,
    decode_and_verify_oauth_state,
)

logger = logging.getLogger(__name__)


def _is_local_dev(request: Request) -> bool:
    host = request.headers.get("host", "") or request.headers.get("x-forwarded-host", "")
    return "localhost" in host or "127.0.0.1" in host


def _get_redirect_uri(request: Request) -> str:
    if settings.GOOGLE_REDIRECT_URI and not _is_local_dev(request):
        return settings.GOOGLE_REDIRECT_URI
    scheme = "https" if is_connection_secure(request) else "http"
    host = request.headers.get("host", f"127.0.0.1:{settings.PORT}")
    return f"{scheme}://{host}/api/auth/google/callback"


class OAuthService:
    """Manages Google OAuth institutional authentication restricted to Medi-Caps University."""

    @staticmethod
    def initiate_google_login(request: Request) -> RedirectResponse:
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth is not configured on this server.",
            )

        # 1. Resolve and validate candidate frontend origin from query param or headers
        candidate_origin = (
            request.query_params.get("origin")
            or request.query_params.get("frontend_origin")
            or request.headers.get("origin")
        )
        if not candidate_origin:
            referer = request.headers.get("referer")
            if referer:
                try:
                    from urllib.parse import urlparse
                    p = urlparse(referer)
                    candidate_origin = f"{p.scheme}://{p.netloc}"
                except Exception:
                    pass

        target_origin = validate_frontend_origin(candidate_origin) or get_default_frontend_url()
        return_path = request.query_params.get("return_path") or request.query_params.get("return_url") or ""

        # 2. Cryptographically sign the target origin and nonce into the OAuth state
        redirect_uri = _get_redirect_uri(request)
        state = encode_oauth_state(target_origin, return_path)
        google_auth_url = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope=openid%20email%20profile"
            f"&access_type=offline"
            f"&prompt=select_account"
            f"&state={state}"
            f"&hd=medicaps.ac.in"
        )
        res = RedirectResponse(url=google_auth_url)
        res.set_cookie(
            key="ccc_oauth_state",
            value=state,
            max_age=600,
            httponly=True,
            secure=is_connection_secure(request),
            samesite="lax",
        )
        return res

    @staticmethod
    async def process_google_callback(request: Request, db: AsyncSession) -> RedirectResponse:
        code = request.query_params.get("code")
        error = request.query_params.get("error")
        incoming_state = request.query_params.get("state")
        stored_state = request.cookies.get("ccc_oauth_state")

        # 1. Verify signed state and extract the verified caller frontend origin
        state_data = decode_and_verify_oauth_state(incoming_state)
        frontend_url = state_data["origin"] if state_data else get_default_frontend_url()
        return_path = state_data.get("return_path", "") if state_data else ""

        # 2. CSRF cookie verification if cookie was retained across redirect
        if stored_state and incoming_state and stored_state != incoming_state:
            logger.warning("Google OAuth state mismatch: stored=%s incoming=%s", stored_state, incoming_state)
            return RedirectResponse(url=f"{frontend_url}/auth?error=state_mismatch")

        # 3. If state decoding failed completely, reject as tampered / expired
        if not state_data and not error and not code:
            logger.warning("Google OAuth callback rejected: state could not be verified.")
            return RedirectResponse(url=f"{frontend_url}/auth?error=state_mismatch")

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

        if not is_allowed_organization_email(email):
            logger.warning("Rejected non-organization Google account: %s", email)
            return RedirectResponse(url=f"{frontend_url}/auth?error=unauthorized_domain&email={email}")

        member = await AuthRepository.get_by_email(db, email)
        is_new = False
        enrollment_candidate = email.split("@")[0].upper() if "@" in email else None

        if not member:
            is_new = True
            member = await AuthRepository.create_member(
                db=db,
                email=email,
                google_id=google_id,
                avatar_url=picture or None,
                full_name=name or None,
                prn=enrollment_candidate,
                is_onboarded=False,
            )
            logger.info("New member registered via Google OAuth: %s", email)
        else:
            member.google_id = google_id
            if not member.prn and enrollment_candidate:
                member.prn = enrollment_candidate
            if picture and not member.avatar_url:
                member.avatar_url = picture
            await AuthRepository.save(db, member)

        jwt_token = create_access_token({"sub": member.id, "email": member.email})
        refresh_token = generate_refresh_token()
        await store_refresh_token(refresh_token, member.id, member.email)

        needs_onboarding = is_new or not member.is_onboarded
        return_param = f"&return_url={urllib.parse.quote(return_path)}" if return_path else ""
        redirect_res = RedirectResponse(
            url=f"{frontend_url}/auth?token={jwt_token}&is_onboarded={'false' if needs_onboarding else 'true'}&onboarding={'1' if needs_onboarding else '0'}&email={member.email}&google_success=1{return_param}"
        )
        set_auth_cookies(
            response=redirect_res,
            access_token=jwt_token,
            refresh_token=refresh_token,
            request=request,
        )
        redirect_res.delete_cookie("ccc_oauth_state")
        return redirect_res
