"""Regression tests for admin authorization and timer mutation boundaries."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from main import app
from app.middleware.auth import get_current_member_optional


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path,method",
    [
        ("/api/admin/contests", "GET"),
        ("/api/contests/example/reset-timer", "POST"),
    ],
)
@pytest.mark.parametrize("forged_key", ["1337", "admin", "CCC-ADMIN-GATE"])
async def test_static_admin_headers_do_not_authorize(monkeypatch, path, method, forged_key):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "DEV_MODE", False)
    monkeypatch.setattr(settings, "DEV_BYPASS_RESTRICTIONS", False)
    app.dependency_overrides[get_current_member_optional] = lambda: None
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.request(
                method,
                path,
                headers={"X-Admin-Key": forged_key, "X-Proctor-Key": forged_key},
            )
        assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(get_current_member_optional, None)
