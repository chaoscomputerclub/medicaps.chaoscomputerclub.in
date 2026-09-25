"""
Chaos Computer Club — Medi-Caps Chapter
app/middleware/cloudflare_security.py — Cloudflare client security & edge protection middleware
"""

from __future__ import annotations

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.cloudflare import get_client_ip, get_cf_ray, get_cf_country
from app.core.security import is_connection_secure

logger = logging.getLogger("ccc.cloudflare_security")


class CloudflareSecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces Cloudflare Edge Security standards:
    1. Extracts verified client IP from CF-Connecting-IP into request.state.client_ip.
    2. Records CF-Ray and CF-IPCountry for distributed audit telemetry.
    3. Attaches mandatory security headers to all responses:
       - X-Content-Type-Options: nosniff
       - X-Frame-Options: DENY
       - Referrer-Policy: strict-origin-when-cross-origin
       - Permissions-Policy: camera=(), microphone=(), geolocation=()
       - Cross-Origin-Opener-Policy: same-origin-allow-popups (vital for Google OAuth)
       - Strict-Transport-Security (HSTS on HTTPS)
       - Echoes CF-Ray in response header for end-to-end debugging.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Populate authentic client identity in request.state
        client_ip = get_client_ip(request)
        cf_ray = get_cf_ray(request)
        cf_country = get_cf_country(request)

        request.state.client_ip = client_ip
        request.state.cf_ray = cf_ray
        request.state.cf_country = cf_country

        response: Response = await call_next(request)

        # Edge protection security headers
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        # Allows Google OAuth popup / redirects to interact securely without COOP restriction
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin-allow-popups")

        if cf_ray:
            response.headers.setdefault("CF-Ray", cf_ray)

        if is_connection_secure(request):
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains; preload",
            )

        return response
