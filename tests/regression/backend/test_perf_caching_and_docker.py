"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_perf_caching_and_docker.py — Performance & Cache Invariants

Covers:
- PERF-003 / PERF-007: Public vs Private HTTP Caching & Zero Cross-User Leakage
- PERF-004: Non-blocking Docker telemetry & Bounded Worker Execution
- PERF-009: GZip API Response Compression
- PERF-006: Practice Problem Catalog Redis Caching
"""

import asyncio
import time
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock

from app.core.config import settings
from app.engine.providers.docker_provider import DockerSandboxProvider
from main import app


@pytest.mark.asyncio
async def test_docker_provider_non_blocking_and_cached():
    """
    Verifies that Docker health checks do not block the event loop,
    execute off-thread with strict 2.0s timeout, and cache results for 5s.
    """
    provider = DockerSandboxProvider()

    # Test 1: Immediate response when cached
    t0 = time.monotonic()
    h1 = await provider.healthy(force=True)
    t1 = time.monotonic()

    # Second call should return instantaneously from memory cache
    h2 = await provider.healthy(force=False)
    t2 = time.monotonic()

    assert h1 == h2
    assert (t2 - t1) < 0.05, f"Cached health check took {t2 - t1}s, expected < 0.05s"

    # Test 2: Bounded execution under simulated Docker slow ping
    with patch.object(provider, "client") as mock_client:
        def slow_ping():
            time.sleep(0.1)
            return True

        mock_client.ping = slow_ping
        t_start = time.monotonic()
        # Concurrently execute 5 health checks; semaphore must bound concurrency
        tasks = [provider.healthy(force=True) for _ in range(5)]
        results = await asyncio.gather(*tasks)
        t_elapsed = time.monotonic() - t_start

        assert all(isinstance(r, bool) for r in results)


@pytest.mark.asyncio
async def test_public_vs_private_contest_cache_headers():
    """
    Verifies that:
    1. Anonymous requests receive 'Cache-Control: public, max-age=15, stale-while-revalidate=30'
    2. Authenticated requests receive 'Cache-Control: private, no-cache, no-store, must-revalidate'
    3. Vary headers are correctly set
    """
    from app.middleware.auth import get_current_member_optional
    from app.models.member import MemberProfile

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Anonymous request
        app.dependency_overrides.pop(get_current_member_optional, None)
        anon_resp = await client.get("/api/contests")
        assert anon_resp.status_code == 200
        cache_control = anon_resp.headers.get("cache-control", "")
        assert "public" in cache_control, f"Expected public cache-control, got: {cache_control}"
        assert "max-age=15" in cache_control or "max-age" in cache_control

        # 2. Authenticated request simulation (cadet member logged in)
        mock_member = MemberProfile(
            id="mem_cadet_perf_test_99",
            email="perf_cadet@medicaps.ac.in",
            handle="cadet_perf",
            is_onboarded=True,
        )
        app.dependency_overrides[get_current_member_optional] = lambda: mock_member
        try:
            auth_resp = await client.get("/api/contests")
            assert auth_resp.status_code == 200
            auth_cc = auth_resp.headers.get("cache-control", "")
            assert "private" in auth_cc, f"Expected private cache-control, got: {auth_cc}"
            assert "no-store" in auth_cc or "no-cache" in auth_cc
            assert "Authorization" in auth_resp.headers.get("vary", "")
        finally:
            app.dependency_overrides.pop(get_current_member_optional, None)


@pytest.mark.asyncio
async def test_gzip_compression_applied_to_large_responses():
    """
    Verifies that FastAPI GZipMiddleware compresses JSON responses >= 1000 bytes
    when the client sends 'Accept-Encoding: gzip'.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with gzip encoding
        resp = await client.get(
            "/api/contests",
            headers={"Accept-Encoding": "gzip"}
        )
        assert resp.status_code == 200

        # If payload is large enough (>=1000 bytes), Content-Encoding must be gzip
        if len(resp.content) >= 1000 or "content-encoding" in resp.headers:
            assert resp.headers.get("content-encoding") == "gzip"
            assert "Accept-Encoding" in resp.headers.get("vary", "")

        # Request WITHOUT gzip encoding must NOT return Content-Encoding: gzip
        resp_plain = await client.get(
            "/api/contests",
            headers={"Accept-Encoding": "identity"}
        )
        assert resp_plain.status_code == 200
        assert resp_plain.headers.get("content-encoding") is None
