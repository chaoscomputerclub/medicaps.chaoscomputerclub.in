"""
Tests for Strict Cookie Architecture & Refresh Token Rotation (RTR)
Chaos Computer Club India — Medi-Caps Chapter
"""
import pytest
from starlette.requests import Request
from starlette.responses import Response
from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    store_refresh_token,
    verify_and_revoke_refresh_token,
    revoke_refresh_token,
    is_connection_secure,
)
from app.middleware.auth import extract_access_token


def test_token_lifetimes():
    """Verify production expiration lifetimes are strictly configured."""
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 15
    assert settings.REFRESH_TOKEN_EXPIRE_DAYS == 30


def test_is_connection_secure_detection():
    """Verify HTTPS detection for Secure cookie flag."""
    scope_http = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"host", b"localhost:8081")],
        "scheme": "http",
    }
    req_http = Request(scope_http)
    # On localhost HTTP, should not enforce Secure=True
    assert is_connection_secure(req_http) is False

    scope_https = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"host", b"medicaps.chaoscomputerclub.in"), (b"x-forwarded-proto", b"https")],
        "scheme": "https",
    }
    req_https = Request(scope_https)
    assert is_connection_secure(req_https) is True


def test_set_and_clear_auth_cookies():
    """Verify cookies are set with strict production flags."""
    res = Response()
    access = create_access_token({"sub": "test-id", "email": "test@medicaps.ac.in"})
    refresh = generate_refresh_token()

    set_auth_cookies(response=res, access_token=access, refresh_token=refresh)

    # Inspect Set-Cookie headers
    cookie_headers = res.headers.getlist("set-cookie")
    assert len(cookie_headers) == 2

    access_cookie = next(c for c in cookie_headers if c.startswith("access_token="))
    assert "HttpOnly" in access_cookie or "httponly" in access_cookie.lower()
    assert "SameSite=lax" in access_cookie or "samesite=lax" in access_cookie.lower()
    assert "Path=/" in access_cookie or "path=/" in access_cookie.lower()
    assert f"max-age={15 * 60}" in access_cookie.lower()

    refresh_cookie = next(c for c in cookie_headers if c.startswith("refresh_token="))
    assert "HttpOnly" in refresh_cookie or "httponly" in refresh_cookie.lower()
    assert "SameSite=lax" in refresh_cookie or "samesite=lax" in refresh_cookie.lower()
    assert "Path=/" in refresh_cookie or "path=/" in refresh_cookie.lower()
    assert f"max-age={30 * 24 * 3600}" in refresh_cookie.lower()

    # Clear cookies
    res_clear = Response()
    clear_auth_cookies(response=res_clear)
    clear_headers = res_clear.headers.getlist("set-cookie")
    assert len(clear_headers) == 2
    for h in clear_headers:
        assert "max-age=0" in h.lower()


def test_extract_access_token_priority():
    """Verify cookie extraction takes precedence over Bearer header and query param."""
    # 1. Cookie only
    scope1 = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"cookie", b"access_token=cookie-jwt-token; other=123")],
    }
    req1 = Request(scope1)
    assert extract_access_token(req1) == "cookie-jwt-token"

    # 2. Cookie priority over Bearer header
    scope2 = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [
            (b"cookie", b"access_token=cookie-jwt-token"),
            (b"authorization", b"Bearer header-jwt-token"),
        ],
    }
    req2 = Request(scope2)
    assert extract_access_token(req2, bearer_token="header-jwt-token") == "cookie-jwt-token"

    # 3. Fallback to Bearer header when cookie missing
    scope3 = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"authorization", b"Bearer header-jwt-token")],
    }
    req3 = Request(scope3)
    assert extract_access_token(req3, bearer_token="header-jwt-token") == "header-jwt-token"

    # 4. Fallback to query param
    scope4 = {
        "type": "http",
        "method": "GET",
        "path": "/api/feed?token=query-jwt-token",
        "headers": [],
        "query_string": b"token=query-jwt-token",
    }
    req4 = Request(scope4)
    assert extract_access_token(req4) == "query-jwt-token"


@pytest.mark.asyncio
async def test_redis_refresh_token_rotation():
    """Verify Refresh Token Rotation: validating consumes the old token and prevents replay attacks."""
    refresh_token = generate_refresh_token()
    member_id = "mem-test-uuid-1234"
    email = "cadet@medicaps.ac.in"

    # 1. Store in Redis
    await store_refresh_token(refresh_token, member_id, email)

    # 2. First verification succeeds and revokes token (RTR)
    payload = await verify_and_revoke_refresh_token(refresh_token)
    assert payload is not None
    assert payload["member_id"] == member_id
    assert payload["email"] == email

    # 3. Second verification (replay attempt) MUST fail because token was consumed
    replay_payload = await verify_and_revoke_refresh_token(refresh_token)
    assert replay_payload is None


@pytest.mark.asyncio
async def test_redis_refresh_token_logout_revocation():
    """Verify explicit revocation on logout wipes the refresh token from Redis."""
    refresh_token = generate_refresh_token()
    await store_refresh_token(refresh_token, "mem-5678", "logout@medicaps.ac.in")

    revoked = await revoke_refresh_token(refresh_token)
    assert revoked is True

    # Token can no longer be verified
    payload = await verify_and_revoke_refresh_token(refresh_token)
    assert payload is None

