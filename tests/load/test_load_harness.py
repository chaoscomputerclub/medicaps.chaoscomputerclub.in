"""
Unit and Integration Tests for the Locust Synthetic Virtual User Test Harness
Validates safety guards, credential isolation, failure taxonomy, and scenario configs.
"""

import pytest
import requests
from unittest.mock import MagicMock

from tests.load.config.settings import LoadTestSettings
from tests.load.config.scenarios import get_scenario, SCENARIOS
from tests.load.utilities.credentials import UserCredentialPool, VirtualStudentAccount
from tests.load.utilities.correlation import build_correlation_headers
from tests.load.assertions.response_checks import (
    classify_http_failure,
    FailureCategory,
    assert_status_code,
    LoadTestAssertionError,
)


def test_production_safety_guard_blocks_unauthorized_prod_target():
    """Verify that settings raise RuntimeError if targeting production without explicit permission."""
    unsafe_settings = LoadTestSettings(
        LOAD_TEST_ENVIRONMENT="production",
        LOAD_TEST_BASE_URL="https://medicaps.chaoscomputerclub.in",
        ALLOW_PRODUCTION_LOAD_TEST=False,
    )
    with pytest.raises(RuntimeError) as exc_info:
        unsafe_settings.enforce_production_safety()
    assert "SAFETY ABORT: PRODUCTION LOAD TESTING IS BLOCKED" in str(exc_info.value)


def test_production_safety_guard_permits_authorized_prod():
    """Verify that setting ALLOW_PRODUCTION_LOAD_TEST=True explicitly unlocks execution."""
    safe_prod_settings = LoadTestSettings(
        LOAD_TEST_ENVIRONMENT="production",
        LOAD_TEST_BASE_URL="https://medicaps.chaoscomputerclub.in",
        ALLOW_PRODUCTION_LOAD_TEST=True,
    )
    # Should not raise
    safe_prod_settings.enforce_production_safety()


def test_user_credential_pool_isolation():
    """Verify that checked out users are unique and non-overlapping."""
    pool = UserCredentialPool(pool_size=10)
    pool.initialize()

    user1 = pool.checkout()
    user2 = pool.checkout()

    assert user1.username != user2.username
    assert user1.email != user2.email
    assert user1.handle != user2.handle

    # Return user1 and checkout again; FIFO returns next user, but user1 is safely in pool
    pool.checkin(user1)
    user3 = pool.checkout()
    assert user3.username != user2.username

    # Drain pool to confirm user1 was returned to queue
    drained = [user3]
    while not pool._queue.empty():
        drained.append(pool.checkout())
    assert any(u.username == user1.username for u in drained)


def test_correlation_headers_structure():
    """Verify that generated correlation headers contain required telemetry."""
    headers = build_correlation_headers(user_id="loadtest_student_001", workflow="contest", action="submit")
    assert "X-Load-Test-ID" in headers
    assert "X-Virtual-User-ID" in headers
    assert headers["X-Virtual-User-ID"] == "loadtest_student_001"
    assert "X-Correlation-ID" in headers
    assert headers["X-Request-Workflow"] == "contest"


def test_http_failure_classification():
    """Verify accurate failure categorization according to Section 33."""
    mock_resp_401 = MagicMock(spec=requests.Response, status_code=401, text="Unauthorized")
    assert classify_http_failure(mock_resp_401) == FailureCategory.AUTH_FAILURE

    mock_resp_429 = MagicMock(spec=requests.Response, status_code=429, text="Rate limit exceeded")
    assert classify_http_failure(mock_resp_429) == FailureCategory.CAPACITY_EXHAUSTED

    mock_resp_503 = MagicMock(spec=requests.Response, status_code=503, text="Codebox circuit breaker is OPEN")
    assert classify_http_failure(mock_resp_503) == FailureCategory.EXECUTION_FAILURE

    mock_resp_500_db = MagicMock(spec=requests.Response, status_code=500, text="asyncpg.exceptions.ConnectionDoesNotExistError")
    assert classify_http_failure(mock_resp_500_db) == FailureCategory.DATABASE_FAILURE


def test_scenario_retrieval_and_weights():
    """Verify scenarios define correct user numbers and weights."""
    smoke = get_scenario("smoke")
    assert smoke.user_count == 5
    assert smoke.weights["NormalStudentUser"] == 60

    normal_50 = get_scenario("normal_50")
    assert normal_50.user_count == 50
    assert normal_50.spawn_rate == 5.0

    burst = get_scenario("submission_burst")
    assert burst.weights["ActiveContestantUser"] == 70
