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
    Returns True only for members whose is_core_member flag is explicitly set
    by an admin in the database. No hardcoded user identifiers — every student,
    including chapter leads, goes through the same eligibility gates.
    """
    if not member:
        return False
    return bool(getattr(member, "is_core_member", False))
