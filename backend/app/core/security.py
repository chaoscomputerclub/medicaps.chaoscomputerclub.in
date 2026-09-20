"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Authentication, Security, and Password Hashing
Native bcrypt + JWT RSA 256 (RS256) Asymmetric Signature
"""

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
    Encode JWT access token with RSA 256 (RS256) asymmetric private key.
    Falls back gracefully to HS256 if RSA key is unavailable.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    # RS256 Asymmetric Signature
    if settings.ALGORITHM == "RS256" and settings.JWT_PRIVATE_KEY:
        return jwt.encode(to_encode, settings.JWT_PRIVATE_KEY, algorithm="RS256")

    # Symmetric HS256 Fallback
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token using RSA 256 (RS256) public key.
    Provides backward compatibility for existing HS256 sessions during key rotation.
    """
    try:
        # RS256 Verification with Public Key
        if settings.JWT_PUBLIC_KEY:
            try:
                return jwt.decode(token, settings.JWT_PUBLIC_KEY, algorithms=["RS256"])
            except JWTError:
                # Fallback check for existing HS256 tokens during transition
                if settings.SECRET_KEY:
                    try:
                        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                    except JWTError:
                        pass
                raise

        # Symmetric fallback
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM, "HS256"])
    except JWTError:
        return None


def is_privileged_test_member(member: Optional[object]) -> bool:
    """
    Checks if a member has privileged TEST mode enabled.
    Privileged test members can:
    - Attempt assessments at any time (bypasses window restrictions, countdowns, expiration)
    - Reattempt or reset assessments at any time
    - Enter contest arenas at any time (bypasses status check, Top 30 restriction, and physical QR check-in)
    - Run and submit code at any time
    """
    if not member:
        return False
    if getattr(member, "is_core_member", False):
        return True

    handle = (getattr(member, "handle", None) or "").strip().lower()
    email = (getattr(member, "email", None) or "").strip().lower()
    prn = (getattr(member, "prn", None) or "").strip().upper()

    # User-specific identifiers for Santusht Kotai & chapter core leads
    if (
        handle in ("santusht", "santush01")
        or "santusht" in email
        or "en23cs301927" in email
        or prn == "EN23CS301927"
    ):
        return True

    return False
