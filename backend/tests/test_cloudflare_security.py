"""
Unit tests for Cloudflare client security, header extraction, and Turnstile verification.
"""

import pytest
from starlette.requests import Request
from starlette.datastructures import Headers

from app.core.cloudflare import get_client_ip, get_cf_ray, get_cf_country, verify_turnstile_token
from app.core.config import settings


def _make_mock_request(headers: dict[str, str], host: str = "127.0.0.1") -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/auth/send-otp",
        "headers": [(k.lower().encode("latin1"), v.encode("latin1")) for k, v in headers.items()],
        "client": (host, 12345),
    }
    return Request(scope)


def test_get_client_ip_prioritizes_cf_connecting_ip():
    req = _make_mock_request({
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
        "x-real-ip": "192.168.1.100",
    })
    assert get_client_ip(req) == "203.0.113.195"


def test_get_client_ip_fallback_to_x_forwarded_for():
    req = _make_mock_request({
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
        "x-real-ip": "192.168.1.100",
    })
    assert get_client_ip(req) == "198.51.100.1"


def test_get_cf_ray_and_country():
    req = _make_mock_request({
        "cf-ray": "84729f98234ab1-BOM",
        "cf-ipcountry": "IN",
    })
    assert get_cf_ray(req) == "84729f98234ab1-BOM"
    assert get_cf_country(req) == "IN"


@pytest.mark.asyncio
async def test_turnstile_verification_test_secret_always_passes():
    # Cloudflare testing secret 1x0000000000000000000000000000000AA always passes
    settings.CLOUDFLARE_TURNSTILE_ENABLED = True
    settings.CLOUDFLARE_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA"
    result = await verify_turnstile_token("dummy-response-token", remote_ip="203.0.113.195")
    assert result is True


@pytest.mark.asyncio
async def test_turnstile_disabled_allows_all():
    settings.CLOUDFLARE_TURNSTILE_ENABLED = False
    result = await verify_turnstile_token(None)
    assert result is True


@pytest.mark.asyncio
async def test_auth_security_config_endpoint():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/auth/security-config")
        assert res.status_code == 200
        data = res.json()
        assert "turnstile_enabled" in data
        assert "turnstile_site_key" in data
