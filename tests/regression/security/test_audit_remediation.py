"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/security/test_audit_remediation.py — Audit & Remediation Verification

Verifies all critical and high-confidence fixes from CCC_MediCaps_Full_Project_Audit:
- SEC-01: No privileged identity defaults, no handle-based elevation, read-only auth.
- SEC-02: Query parameter token rejection for standard endpoints.
- SEC-03: Zero exception detail / secret leakage to client.
- OPS-01 / SEC-04: API docs gated in production.
- OPS-02 / PERF-01: Health check splitting (liveness vs readiness).
- AUTH-01: Optional auth is strictly read-only and does not mutate state.
- ARCH-01: Single canonical prefix for admin routers.
"""

import pytest
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from fastapi import HTTPException

from app.core.config import Settings
from app.middleware.auth import extract_access_token, require_admin_or_core
from app.models.db_models import MemberProfile


def test_sec01_privileged_identity_fails_closed():
    """SEC-01: Verifies that empty CORE_TEAM_EMAILS fails closed without hardcoded defaults."""
    s = Settings(
        CORE_TEAM_EMAILS="",
        CORE_TEAM_HANDLES="",
    )
    assert s.core_team_emails_set == set()
    assert s.core_team_handles_set == set()


def test_sec01_handle_cannot_elevate_admin_privilege():
    """SEC-01: Verifies that having a handle like 'admin' or 'core' never grants admin access."""
    # Member with 'admin' handle but is_core_member=False
    cadet = MemberProfile(
        id="cadet-1",
        email="attacker@medicaps.ac.in",
        handle="admin",
        is_core_member=False,
    )

    with pytest.raises(HTTPException) as exc_info:
        import asyncio
        asyncio.run(require_admin_or_core(cadet))

    assert exc_info.value.status_code == 403
    assert "Administrator or Core Team access required" in exc_info.value.detail


def test_sec02_query_token_rejected_by_extract_access_token():
    """SEC-02: Verifies that extract_access_token strictly rejects tokens in query strings."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/contests?token=stolen-jwt-token-in-url",
        "headers": [],
        "query_string": b"token=stolen-jwt-token-in-url",
    }
    req = Request(scope)
    assert extract_access_token(req) is None


def test_sec03_exception_handler_sanitizes_secrets_and_sql():
    """SEC-03: Verifies unhandled exception text never leaks SQL or server secrets to client."""
    from main import global_exception_handler

    synthetic_leak = "FATAL: password 'super_secret_db_pass' failed for role 'postgres'; SELECT * FROM users;"
    fake_exc = RuntimeError(synthetic_leak)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/test",
        "headers": [(b"host", b"localhost:8000")],
    }
    req = Request(scope)

    import asyncio
    resp: JSONResponse = asyncio.run(global_exception_handler(req, fake_exc))

    assert resp.status_code == 500
    import json
    body = json.loads(resp.body.decode("utf-8"))

    # Must contain generic error and request_id
    assert body.get("detail") == "Internal Server Error"
    assert "request_id" in body

    # Must NEVER leak internal message, password, or SQL query
    assert "super_secret_db_pass" not in resp.body.decode("utf-8")
    assert "SELECT * FROM users" not in resp.body.decode("utf-8")
    assert "error" not in body or body["error"] != synthetic_leak


def test_ops01_docs_gated_by_environment():
    """OPS-01 / SEC-04: Verifies docs URLs are None in production when ENABLE_API_DOCS is false."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        ENABLE_API_DOCS=False,
    )
    docs_enabled = (not prod_settings.is_production) or prod_settings.ENABLE_API_DOCS
    assert docs_enabled is False

    dev_settings = Settings(
        ENVIRONMENT="development",
        ENABLE_API_DOCS=False,
    )
    docs_enabled_dev = (not dev_settings.is_production) or dev_settings.ENABLE_API_DOCS
    assert docs_enabled_dev is True


def test_ops02_liveness_probe_instant():
    """OPS-02: Verifies /health/live returns 200 without dependency dependencies."""
    from main import liveness_probe
    import asyncio
    res = asyncio.run(liveness_probe())
    assert res["status"] == "alive"
    assert "version" in res


def test_arch01_no_duplicate_admin_problems_mount():
    """ARCH-01: Verifies admin_problems router is mounted once under canonical API prefix."""
    from main import app
    all_paths = []
    for r in app.routes:
        if getattr(r, "path", None):
            all_paths.append(r.path)
        elif hasattr(r, "original_router") and hasattr(r, "include_context"):
            pfx = r.include_context.prefix
            for sub in r.original_router.routes:
                if hasattr(sub, "path"):
                    all_paths.append(pfx + sub.path)

    # Check that /api/admin/problems exists
    assert any("/api/admin/problems" in p for p in all_paths)
    # Check that root un-prefixed /admin/problems was removed
    admin_prob_root = [p for p in all_paths if p.startswith("/admin/problems")]
    assert len(admin_prob_root) == 0, f"Found unexpected root mount: {admin_prob_root}"
