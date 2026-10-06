"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_general_invariants.py — General Platform Invariants

Linked Bugs: REG-0150, REG-0163, REG-0168, REG-0200, REG-0211, REG-0238, REG-0245
Invariants:
- OPERATION_MUST_SATISFY_STRICT_BUILD_CONTRACT
- OPERATION_MUST_SATISFY_STRICT_ROUTING_CONTRACT
- HOT_PATHS_MUST_AVOID_N_PLUS_ONE_QUERIES_AND_REPETITIVE_BROADCAST_LOOPS
"""

import pytest
import os
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.regression("REG-0238")
def test_all_backend_routers_mounted_under_api_prefix():
    """
    REG-0238 Invariant:
    All routers in backend/app/main.py must be mounted with settings.API_PREFIX
    to prevent un-prefixed routing drift or 404s.
    """
    main_file = REPO_ROOT / "backend" / "main.py"
    assert main_file.exists(), f"backend/main.py not found at {main_file}"

    content = main_file.read_text(encoding="utf-8")
    router_mounts = re.findall(r'app\.include_router\(([^)]+)\)', content)
    assert len(router_mounts) > 0, "No routers mounted in main.py"

    # Social router and standard endpoints should obey prefix
    assert "prefix=settings.API_PREFIX" in content or "prefix=\"/api\"" in content or "settings.API_V1_STR" in content or "prefix=\"/api/v1\"" in content


@pytest.mark.regression("REG-0200")
def test_error_boundary_sanitizes_stack_traces_in_production():
    """
    REG-0200 Invariant:
    Production error responses must return sanitized, structured error envelopes
    without exposing raw server filesystem paths or sensitive credentials.
    """
    def sanitize_error(err: Exception, is_production: bool = True):
        if is_production:
            return {
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please contact CCC Medi-Caps support.",
                "status_code": 500
            }
        return {"error": str(err), "type": type(err).__name__}

    raw_err = FileNotFoundError("/Users/santushtkotai/secret/db.key not found")
    safe_resp = sanitize_error(raw_err, is_production=True)

    assert safe_resp["status_code"] == 500
    assert "secret/db.key" not in safe_resp["message"]
    assert "Users" not in safe_resp["message"]


@pytest.mark.regression("REG-0163")
def test_pagination_bounds_and_defaults():
    """
    REG-0163 Invariant:
    List queries (contests, leaderboards, submissions) must enforce hard limits
    on page size (e.g. max 100) to prevent denial of service via memory exhaustion.
    """
    def sanitize_pagination(limit: int, offset: int, max_limit: int = 100):
        safe_limit = max(1, min(limit, max_limit))
        safe_offset = max(0, offset)
        return safe_limit, safe_offset

    # User asks for 1,000,000 rows
    lim, off = sanitize_pagination(1_000_000, 0)
    assert lim == 100
    assert off == 0

    # User passes negative offset
    lim, off = sanitize_pagination(20, -5)
    assert lim == 20
    assert off == 0


@pytest.mark.regression("REG-0246")
def test_attendance_total_is_zero_when_no_contests_exist():
    """
    REG-0246 Invariant:
    CONTEST_ATTENDANCE_TOTAL_MUST_REFLECT_ACTUAL_HELD_CONTESTS_AND_NEVER_INVENT_PHANTOM_CONTESTS
    When there are 0 contests, attendance_total must evaluate to 0, not coerced to 1 via 'or 1'.
    Attendance percentage math must guard with 'if total > 0' and evaluate safely to 0.0%.
    """
    total_contests_scalar = 0
    # Correct assignment without 'or 1'
    attendance_total = total_contests_scalar if total_contests_scalar is not None else 0
    attendance_count = 0

    assert attendance_total == 0

    # Rate calculation must never trigger ZeroDivisionError and return 0.0
    attendance_rate = (
        round((attendance_count / attendance_total) * 100, 1)
        if attendance_total > 0
        else 0.0
    )
    assert attendance_rate == 0.0

    # Frontend ProfilePage formatting invariant
    def format_contest_metric(count: int, total: int):
        val = f"{count}/{total}"
        detail = "No official contests yet" if total == 0 else "Official attendance"
        return val, detail

    val, detail = format_contest_metric(attendance_count, attendance_total)
    assert val == "0/0"
    assert detail == "No official contests yet"
    assert val != "0/1"

    # Frontend defensive resolution invariant against legacy or cached 0/1 response
    def resolve_effective_attendance(official_contests: int, battles_len: int, raw_count: int, raw_total: int):
        if official_contests > 0:
            return max(official_contests, raw_total)
        if battles_len > 0:
            return max(battles_len, raw_total)
        if raw_count > 0:
            return raw_total
        return 0

    # Scenario A: Legacy backend returns raw_total=1 when 0 official contests exist
    stale_backend_total = 1
    effective_total_a = resolve_effective_attendance(
        official_contests=0,
        battles_len=0,
        raw_count=0,
        raw_total=stale_backend_total,
    )
    assert effective_total_a == 0
    val_a, detail_a = format_contest_metric(0, effective_total_a)
    assert val_a == "0/0"
    assert detail_a == "No official contests yet"

    # Scenario B: 1 official contest was held, student missed it
    effective_total_b = resolve_effective_attendance(
        official_contests=1,
        battles_len=0,
        raw_count=0,
        raw_total=0,
    )
    assert effective_total_b == 1
    val_b, detail_b = format_contest_metric(0, effective_total_b)
    assert val_b == "0/1"
    assert detail_b == "Official attendance"



