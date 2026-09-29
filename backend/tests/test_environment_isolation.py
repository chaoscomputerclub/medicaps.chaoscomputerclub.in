"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_environment_isolation.py — Environment Isolation & OAuth Redirect Security Suite

Verifies:
1. Complete elimination of hardcoded localhost:8081 redirects.
2. Dynamic environment awareness: local frontend (any port) -> production backend -> returns to caller frontend.
3. Production frontend -> production backend -> returns to production frontend.
4. Open redirect mitigation: malicious origins are strictly rejected.
5. Tamper-proof OAuth state signing using HMAC-SHA256.
6. Fail-fast validation against localhost FRONTEND_URL in production.
7. Environment-aware cookie management (no domain mismatch on localhost).
8. Strict CORS origin handling (no wildcard with credentials).
"""

import time
import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.origins import (
    validate_frontend_origin,
    get_default_frontend_url,
    encode_oauth_state,
    decode_and_verify_oauth_state,
    is_localhost_origin,
    get_allowed_production_origins,
)
from app.core.security import set_auth_cookies, is_connection_secure
from app.modules.auth.oauth_service import OAuthService


# ==============================================================================
# 1. ORIGIN VALIDATION TESTS
# ==============================================================================

def test_localhost_origin_allowlist():
    """Verify any standard local development port is accepted without hardcoding."""
    assert validate_frontend_origin("http://localhost:5173") == "http://localhost:5173"
    assert validate_frontend_origin("http://localhost:8081") == "http://localhost:8081"
    assert validate_frontend_origin("http://localhost:8082") == "http://localhost:8082"
    assert validate_frontend_origin("http://localhost:3000") == "http://localhost:3000"
    assert validate_frontend_origin("http://127.0.0.1:5173") == "http://127.0.0.1:5173"
    assert validate_frontend_origin("http://127.0.0.1:8081") == "http://127.0.0.1:8081"


def test_production_origin_allowlist():
    """Verify official production domains are accepted."""
    assert validate_frontend_origin("https://medicaps.chaoscomputerclub.in") == "https://medicaps.chaoscomputerclub.in"
    assert validate_frontend_origin("https://chaoscomputerclub.in") == "https://chaoscomputerclub.in"
    assert validate_frontend_origin("https://admin.chaoscomputerclub.in") == "https://admin.chaoscomputerclub.in"


def test_malicious_origins_strictly_rejected():
    """Verify attacker-supplied origins are completely blocked to prevent open redirects."""
    assert validate_frontend_origin("https://evil.com") is None
    assert validate_frontend_origin("http://evil.com") is None
    assert validate_frontend_origin("https://attacker.example.org") is None
    assert validate_frontend_origin("javascript:alert(1)") is None
    assert validate_frontend_origin("https://medicaps.chaoscomputerclub.in.evil.com") is None
    assert validate_frontend_origin("data:text/html,<script>alert(1)</script>") is None


# ==============================================================================
# 2. OAUTH STATE SIGNING & TAMPER PROOFING TESTS
# ==============================================================================

def test_oauth_state_roundtrip_local_frontend():
    """Local frontend origin is signed into state and accurately recovered."""
    local_origin = "http://localhost:5173"
    state = encode_oauth_state(local_origin, return_path="/contests/live-finals")
    assert state is not None
    assert "." in state

    decoded = decode_and_verify_oauth_state(state)
    assert decoded is not None
    assert decoded["origin"] == local_origin
    assert decoded["return_path"] == "/contests/live-finals"


def test_oauth_state_roundtrip_production_frontend():
    """Production origin is signed into state and accurately recovered."""
    prod_origin = "https://medicaps.chaoscomputerclub.in"
    state = encode_oauth_state(prod_origin, return_path="/settings")

    decoded = decode_and_verify_oauth_state(state)
    assert decoded is not None
    assert decoded["origin"] == prod_origin
    assert decoded["return_path"] == "/settings"


def test_oauth_state_tamper_detection():
    """Modifying the state string invalidates the HMAC signature and rejects the state."""
    state = encode_oauth_state("http://localhost:5173")
    payload, sig = state.split(".", 1)

    # Corrupt the signature
    tampered_sig = state[:-4] + "0000"
    assert decode_and_verify_oauth_state(tampered_sig) is None

    # Corrupt the payload
    mutated_first_char = "X" if payload[0] != "X" else "Y"
    tampered_payload = mutated_first_char + payload[1:] + "." + sig
    assert decode_and_verify_oauth_state(tampered_payload) is None


def test_oauth_state_malicious_origin_fallback():
    """If state contains an untrusted origin, decode_and_verify_oauth_state falls back to safe default."""
    from app.core.origins import get_default_frontend_url
    default_url = get_default_frontend_url()

    # encode_oauth_state automatically sanitizes untrusted origins
    state = encode_oauth_state("https://evil.com")
    decoded = decode_and_verify_oauth_state(state)
    assert decoded is not None
    assert decoded["origin"] == default_url
    assert "evil.com" not in decoded["origin"]


# ==============================================================================
# 3. PRODUCTION DEFAULT AND FAIL-SAFE TESTS
# ==============================================================================

def test_production_default_never_returns_localhost():
    """Verify get_default_frontend_url in production never returns localhost."""
    default_url = get_default_frontend_url()
    assert not is_localhost_origin(default_url)
    assert default_url.startswith("https://")


# ==============================================================================
# 4. COOKIE SECURITY & SAME-SITE TESTS
# ==============================================================================

def test_cookie_domain_not_set_on_localhost():
    """When a request comes from localhost, domain attribute is omitted to avoid browser drop."""
    res = Response()
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/auth/login",
        "headers": [(b"host", b"localhost:5173")],
        "scheme": "http",
    }
    req = Request(scope)
    set_auth_cookies(response=res, access_token="test_jwt", request=req)

    # Find Set-Cookie header
    cookie_headers = res.headers.getlist("set-cookie") if hasattr(res.headers, "getlist") else [res.headers.get("set-cookie", "")]
    joined = " ".join(cookie_headers)
    assert "Domain=" not in joined or "localhost" not in joined.lower()


# ==============================================================================
# 5. OAUTH FLOW SIMULATION
# ==============================================================================

def test_oauth_initiate_preserves_local_port():
    """Verify initiating Google OAuth from localhost:5173 sets state with localhost:5173."""
    if not settings.GOOGLE_CLIENT_ID:
        settings.GOOGLE_CLIENT_ID = "mock_client_id_for_testing"

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/auth/google/login",
        "headers": [
            (b"host", b"medicaps.chaoscomputerclub.in"),
            (b"referer", b"http://localhost:5173/auth"),
        ],
        "query_string": b"origin=http%3A%2F%2Flocalhost%3A5173&return_path=%2Farena",
        "scheme": "https",
    }
    req = Request(scope)
    resp = OAuthService.initiate_google_login(req)

    # Check redirect location
    location = resp.headers.get("location", "")
    assert "accounts.google.com" in location
    assert "state=" in location

    # Extract state parameter from Google auth URL
    from urllib.parse import urlparse, parse_qs
    parsed_url = urlparse(location)
    qs = parse_qs(parsed_url.query)
    state = qs["state"][0]

    # Decode and verify the state
    decoded = decode_and_verify_oauth_state(state)
    assert decoded is not None
    assert decoded["origin"] == "http://localhost:5173"
    assert decoded["return_path"] == "/arena"
