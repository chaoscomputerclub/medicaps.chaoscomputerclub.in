"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Authentication, Security, and Password Hashing
Native bcrypt + JWT RS256 Asymmetric Signature

Pattern B — Production Auth:
  - Access Tokens  : Short-lived JWTs (15 min). Stateless. Carried in memory + Authorization header.
  - Refresh Tokens : Opaque 256-bit random tokens (30 days). HttpOnly Secure cookie. Stored in Redis.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/token", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate bcrypt hash of a password."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encode a short-lived JWT access token (default: ACCESS_TOKEN_EXPIRE_MINUTES = 15 min).
    Signed with RS256 asymmetric key; falls back to HS256 if RSA keys unavailable.
    Claims are readable client-side (not secret), so never put sensitive data here.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})

    if settings.ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        return jwt.encode(to_encode, settings.JWT_PRIVATE_KEY, algorithm="RS256")

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.
    RS256 primary path; graceful HS256 fallback for session continuity during key rotation.
    """
    try:
        if settings.JWT_PUBLIC_KEY:
            try:
                return jwt.decode(token, settings.JWT_PUBLIC_KEY, algorithms=["RS256"])
            except JWTError:
                pass

        if settings.SECRET_KEY:
            algs = ["HS256"]
            if settings.ALGORITHM == "HS256":
                algs = ["HS256"]
            return jwt.decode(token, settings.SECRET_KEY, algorithms=algs)

        return None
    except JWTError:
        return None


def generate_refresh_token() -> str:
    """
    Generate a cryptographically secure opaque refresh token (256-bit entropy).
    Opaque = NOT a JWT. No decodable claims. Validated server-side via Redis lookup only.
    Enables instant, per-token revocation (logout from specific device, ban user, etc.)
    """
    return secrets.token_urlsafe(32)


def is_privileged_test_member(member: Optional[object]) -> bool:
    """
    Returns True only for members whose is_core_member flag is explicitly set
    by an admin in the database. No hardcoded user identifiers — every student,
    including chapter leads, goes through the same eligibility gates.
    """
    if not member:
        return False
    return bool(getattr(member, "is_core_member", False))


# ─── Production Cookie Management & Refresh Token Rotation ───────────────────

import json
import logging
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


def is_connection_secure(request: Optional[Request] = None) -> bool:
    """
    Determine if cookies should have Secure=True flag.
    Returns True in production or when HTTPS is detected (via URL or X-Forwarded-Proto).
    Returns False in plain HTTP local development so cookies are not dropped.
    """
    if settings.COOKIE_SECURE is not None:
        return settings.COOKIE_SECURE
    if request:
        x_proto = request.headers.get("x-forwarded-proto", "").lower()
        if x_proto == "https" or request.url.is_secure:
            return True
        host = request.headers.get("host", "").lower()
        if "localhost" in host or "127.0.0.1" in host:
            return False
    return settings.ENVIRONMENT == "production"


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Set strict production-grade HttpOnly cookies for access and refresh tokens.
    - HttpOnly: Prevents JavaScript/XSS extraction.
    - Secure: Transmitted only over TLS/HTTPS in production.
    - SameSite: Lax for CSRF protection with top-level link compatibility.
    - Host-only: No domain wildcard by default to avoid leaking across subdomains.
    """
    secure = is_connection_secure(request)
    domain = settings.COOKIE_DOMAIN or None
    samesite = settings.COOKIE_SAMESITE

    # Short-lived Access Token Cookie (15 min)
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=access_max_age,
        expires=access_max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        domain=domain,
    )

    # Long-lived Refresh Token Cookie (30 days)
    if refresh_token:
        refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=refresh_max_age,
            expires=refresh_max_age,
            httponly=True,
            secure=secure,
            samesite=samesite,
            path="/",
            domain=domain,
        )


def clear_auth_cookies(
    response: Response,
    request: Optional[Request] = None,
) -> None:
    """
    Immediately clear authentication cookies by expiring them with max_age=0.
    """
    secure = is_connection_secure(request)
    domain = settings.COOKIE_DOMAIN or None
    samesite = settings.COOKIE_SAMESITE

    for cookie_name in ("access_token", "refresh_token"):
        response.delete_cookie(
            key=cookie_name,
            path="/",
            domain=domain,
            httponly=True,
            secure=secure,
            samesite=samesite,
        )


async def store_refresh_token(refresh_token: str, member_id: str, email: str) -> None:
    """
    Store opaque refresh token in Redis with 30-day TTL.
    """
    try:
        from app.core.redis import get_redis
        redis = get_redis()
        key = f"ccc:refresh:{refresh_token}"
        data = {
            "member_id": str(member_id),
            "email": email.strip().lower(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
        await redis.set(key, json.dumps(data), ex=ttl_seconds)
    except Exception as e:
        logger.error("Failed to store refresh token in Redis: %s", e)


async def verify_and_revoke_refresh_token(refresh_token: str) -> Optional[dict]:
    """
    Validate refresh token against Redis and atomically revoke it (Refresh Token Rotation - RTR).
    Returns the associated member payload dict if valid, or None if expired/invalid/reused.
    """
    if not refresh_token:
        return None
    try:
        from app.core.redis import get_redis
        redis = get_redis()
        key = f"ccc:refresh:{refresh_token}"
        raw = await redis.get(key)
        if not raw:
            return None
        # Consume the refresh token immediately to prevent replay attacks
        await redis.delete(key)
        return json.loads(raw)
    except Exception as e:
        logger.error("Failed to verify/revoke refresh token in Redis: %s", e)
        return None


async def revoke_refresh_token(refresh_token: str) -> bool:
    """
    Directly revoke a refresh token on explicit user logout.
    """
    if not refresh_token:
        return False
    try:
        from app.core.redis import get_redis
        redis = get_redis()
        key = f"ccc:refresh:{refresh_token}"
        deleted = await redis.delete(key)
        return bool(deleted > 0)
    except Exception as e:
        logger.error("Failed to revoke refresh token in Redis: %s", e)
        return False

