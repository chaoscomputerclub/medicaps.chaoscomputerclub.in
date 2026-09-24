"""
Chaos Computer Club — Medi-Caps Chapter
app/core/cloudflare.py — Cloudflare client security helpers & Turnstile verification
"""

from __future__ import annotations

import logging
from typing import Optional
import httpx
from fastapi import Request

from app.core.config import settings

logger = logging.getLogger("ccc.cloudflare")

CLOUDFLARE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def get_client_ip(request: Request) -> str:
    """
    Extract the authentic client IP address prioritizing Cloudflare edge headers.
    1. CF-Connecting-IP (injected by Cloudflare edge proxy)
    2. True-Client-IP (Cloudflare Enterprise)
    3. X-Forwarded-For (first hop)
    4. X-Real-IP
    5. Underlying socket client host
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    true_client_ip = request.headers.get("true-client-ip")
    if true_client_ip and true_client_ip.strip():
        return true_client_ip.strip()

    x_forwarded = request.headers.get("x-forwarded-for")
    if x_forwarded and x_forwarded.strip():
        # First IP in comma-delimited chain is the initial client
        return x_forwarded.split(",")[0].strip()

    x_real = request.headers.get("x-real-ip")
    if x_real and x_real.strip():
        return x_real.strip()

    client = getattr(request, "client", None)
    if client and getattr(client, "host", None):
        return client.host

    return "127.0.0.1"


def get_cf_ray(request: Request) -> Optional[str]:
    """Retrieve Cloudflare Ray ID for distributed tracing and incident response."""
    return request.headers.get("cf-ray")


def get_cf_country(request: Request) -> Optional[str]:
    """Retrieve two-letter ISO country code resolved by Cloudflare GeoIP."""
    return request.headers.get("cf-ipcountry")


async def verify_turnstile_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """
    Validate a Cloudflare Turnstile token against Cloudflare's siteverify API.

    - If Turnstile is globally disabled or in dev bypass mode without a token, returns True.
    - If enabled and token is missing, returns False.
    - Uses timeout-bounded HTTP POST to Cloudflare's validation cluster.
    """
    if not settings.CLOUDFLARE_TURNSTILE_ENABLED:
        # Turnstile disabled in server configuration
        return True

    if settings.DEV_MODE or settings.DEV_BYPASS_RESTRICTIONS:
        # Dev bypass active — allow missing or test tokens
        if not token or token == "dev-token" or token.startswith("1x00"):
            return True

    if not token:
        logger.warning("Turnstile verification failed: token missing from request")
        return False

    secret_key = settings.CLOUDFLARE_TURNSTILE_SECRET_KEY
    if not secret_key:
        logger.error("Turnstile verification failed: CLOUDFLARE_TURNSTILE_SECRET_KEY not set")
        return False

    # Cloudflare dummy testing secret keys (always pass)
    if secret_key == "1x0000000000000000000000000000000AA":
        return True

    payload: dict[str, str] = {
        "secret": secret_key,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(CLOUDFLARE_SITEVERIFY_URL, data=payload)
            if resp.status_code != 200:
                logger.error(
                    "Cloudflare Turnstile siteverify returned HTTP %d: %s",
                    resp.status_code,
                    resp.text,
                )
                return False

            data = resp.json()
            success = bool(data.get("success", False))
            if not success:
                logger.warning(
                    "Cloudflare Turnstile token verification rejected. Errors: %s",
                    data.get("error-codes", []),
                )
            return success
    except Exception as exc:
        logger.error("Cloudflare Turnstile verification network error: %s", exc)
        # If Cloudflare service is unreachable, allow pass only in dev mode
        if settings.DEV_MODE or settings.DEV_BYPASS_RESTRICTIONS:
            return True
        return False
