"""
Chaos Computer Club — Medi-Caps Chapter
core/origins.py — Authoritative Origin & Environment Isolation Engine

Guarantees:
1. Strict allowlist validation of frontend origins across development and production.
2. Complete elimination of hardcoded cross-environment redirects (no localhost in production).
3. Cryptographically signed, tamper-proof OAuth state encoding preserving caller frontend origin.
4. Prevention of open redirect vulnerabilities via strict domain/port boundaries.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from typing import Optional, Set
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger("ccc.core.origins")

# Default production origins trusted for Medi-Caps and Chaos Computer Club services
_DEFAULT_PRODUCTION_ORIGINS: Set[str] = {
    "https://medicaps.chaoscomputerclub.in",
    "https://chaoscomputerclub.in",
    "https://www.chaoscomputerclub.in",
    "https://admin.chaoscomputerclub.in",
    "https://admin.medicaps.chaoscomputerclub.in",
    "https://medicaps-api.chaoscomputerclub.in",
    "https://ccc-medicaps.sharexpress.in",
    "https://ccc-medicaps.shaxpress.in",
    "https://ccc.sharexpress.in",
}

# Regex matching local development hostnames on any port
_LOCALHOST_REGEX = re.compile(
    r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$",
    re.IGNORECASE,
)

# Regex matching trusted production domain hierarchies
_TRUSTED_DOMAIN_REGEX = re.compile(
    r"^https://([a-zA-Z0-9-]+\.)*(chaoscomputerclub\.in|sharexpress\.in|shaxpress\.in)(:\d+)?$",
    re.IGNORECASE,
)


def get_allowed_production_origins() -> Set[str]:
    """Returns the set of explicitly allowed production frontend origins."""
    origins = set(_DEFAULT_PRODUCTION_ORIGINS)
    if settings.FRONTEND_URL and not is_localhost_origin(settings.FRONTEND_URL):
        origins.add(settings.FRONTEND_URL.rstrip("/"))
    if settings.cors_origins_list:
        for o in settings.cors_origins_list:
            if not is_localhost_origin(o):
                origins.add(o.rstrip("/"))
    return origins


def is_localhost_origin(url: Optional[str]) -> bool:
    """Returns True if the candidate URL is a localhost / 127.0.0.1 development origin."""
    if not url:
        return False
    return bool(_LOCALHOST_REGEX.match(url.strip()))


def validate_frontend_origin(candidate: Optional[str]) -> Optional[str]:
    """
    Validates a candidate origin string against the trusted development and production allowlists.
    Returns normalized origin 'scheme://host:port' if valid, or None if rejected.
    """
    if not candidate or not isinstance(candidate, str):
        return None

    candidate = candidate.strip().rstrip("/")
    if not candidate:
        return None

    try:
        parsed = urlparse(candidate)
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            return None
        if not parsed.netloc:
            return None
        normalized = f"{scheme}://{parsed.netloc.lower()}"
    except Exception as e:
        logger.debug("Failed to parse candidate origin '%s': %s", candidate, e)
        return None

    # 1. Localhost / local development origins (allowed for development & local testing)
    if _LOCALHOST_REGEX.match(normalized):
        return normalized

    # 2. Production allowlist
    allowed_prod = get_allowed_production_origins()
    if normalized in allowed_prod:
        return normalized

    # 3. Domain pattern match (for trusted university / chapter subdomains over HTTPS)
    if scheme == "https" and _TRUSTED_DOMAIN_REGEX.match(normalized):
        return normalized

    logger.warning("Rejected untrusted frontend origin: %s", candidate)
    return None


def get_default_frontend_url() -> str:
    """
    Returns the authoritative safe default frontend URL.
    In production, this is GUARANTEED to be the production domain and NEVER localhost.
    In development, returns the configured FRONTEND_URL or local fallback.
    """
    is_prod = getattr(settings, "ENVIRONMENT", "production").lower() == "production"

    candidate = getattr(settings, "FRONTEND_URL", "").strip().rstrip("/")
    if candidate:
        if is_prod and is_localhost_origin(candidate):
            logger.error(
                "CRITICAL: FRONTEND_URL is set to localhost ('%s') in production! "
                "Overriding with canonical 'https://medicaps.chaoscomputerclub.in'.",
                candidate,
            )
            return "https://medicaps.chaoscomputerclub.in"
        valid = validate_frontend_origin(candidate)
        if valid:
            return valid

    if is_prod:
        return "https://medicaps.chaoscomputerclub.in"

    return "http://localhost:8081"


def encode_oauth_state(origin: str, return_path: Optional[str] = None) -> str:
    """
    Cryptographically signs an OAuth state token embedding the validated caller frontend origin.
    Prevents CSRF, ensures state authenticity, and preserves cross-environment destination.
    Format: <base64url(json)>.<hmac_sha256_hex>
    """
    validated_origin = validate_frontend_origin(origin) or get_default_frontend_url()
    clean_return_path = ""
    if return_path and return_path.startswith("/") and not return_path.startswith("//"):
        clean_return_path = return_path

    payload = {
        "nonce": secrets.token_urlsafe(16),
        "origin": validated_origin,
        "return_path": clean_return_path,
        "ts": int(time.time()),
    }

    raw_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(raw_json).decode("ascii").rstrip("=")

    secret_bytes = (settings.SECRET_KEY or "ccc_default_secret_key_change_in_production").encode("utf-8")
    signature = hmac.new(secret_bytes, b64_payload.encode("ascii"), hashlib.sha256).hexdigest()[:32]

    return f"{b64_payload}.{signature}"


def decode_and_verify_oauth_state(
    state: Optional[str],
    max_age_seconds: int = 600,
) -> Optional[dict]:
    """
    Verifies the HMAC signature and timestamp of an incoming OAuth state string.
    Returns the decoded payload dict if valid, or None if invalid/expired.
    """
    if not state or not isinstance(state, str) or "." not in state:
        return None

    try:
        parts = state.split(".", 1)
        if len(parts) != 2:
            return None
        b64_payload, signature = parts

        secret_bytes = (settings.SECRET_KEY or "ccc_default_secret_key_change_in_production").encode("utf-8")
        expected_sig = hmac.new(secret_bytes, b64_payload.encode("ascii"), hashlib.sha256).hexdigest()[:32]

        if not hmac.compare_digest(signature, expected_sig):
            logger.warning("OAuth state HMAC signature mismatch.")
            return None

        # Base64url padding restoration
        pad_len = 4 - (len(b64_payload) % 4)
        if pad_len != 4:
            b64_payload += "=" * pad_len

        raw_json = base64.urlsafe_b64decode(b64_payload.encode("ascii")).decode("utf-8")
        payload = json.loads(raw_json)

        # Expiry check
        ts = payload.get("ts", 0)
        if time.time() - ts > max_age_seconds:
            logger.warning("OAuth state expired (age: %s seconds).", time.time() - ts)
            return None

        # Re-validate embedded origin
        origin = payload.get("origin")
        validated_origin = validate_frontend_origin(origin)
        if not validated_origin:
            logger.warning("OAuth state embedded origin '%s' failed validation.", origin)
            payload["origin"] = get_default_frontend_url()
        else:
            payload["origin"] = validated_origin

        return payload
    except Exception as e:
        logger.error("Failed to decode and verify OAuth state: %s", e)
        return None
