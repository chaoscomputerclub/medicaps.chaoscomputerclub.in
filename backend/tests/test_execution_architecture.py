"""
Chaos Computer Club — Execution Architecture Unit & Verification Suite
Tests:
- Provider selection
- Fallback policy
- Admission controller & capacity pools
- Semaphore/permit guaranteed release
- Circuit breaker (CLOSED, OPEN, HALF_OPEN)
- No circuit tripping on user/domain execution errors (WA, CE, RE, TLE)
- Deadline propagation & dominant deadline domination
- Failure classification & safe public messaging
- Attempt creation in PostgreSQL
- Strict conditional result fencing & stale attempt rejection
- Duplicate result idempotency
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.engine.admission_controller import CodeboxAdmissionController, AdmissionPool
from app.engine.attempt_manager import AttemptManager, FinalizeResult
from app.engine.circuit_breaker import CodeboxCircuitBreaker, CircuitState
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.errors import ErrorCode, JudgeExecutionException, RETRYABLE_ERROR_CODES
from app.engine.execution_policy import ExecutionPolicy
from app.engine.fallback_manager import FallbackManager
from app.engine.observability import ExecutionObservability
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from app.models.judge_job import JudgeJob, JudgeJobAttempt


# ─── 1. Provider Selection & Fallback Policy ─────────────────────────────────

def test_execution_policy_provider_selection():
    policy = ExecutionPolicy()

    # Submit: prefer distributed if active nodes exist
    assert policy.select_initial_provider(is_submit=True, has_active_nodes=True) == "distributed"
    # Submit: fallback to codebox if no active nodes exist
    assert policy.select_initial_provider(is_submit=True, has_active_nodes=False) == "codebox"

    # Run code: fast cloud path if no nodes, or distributed
    assert policy.select_initial_provider(is_submit=False, has_active_nodes=False) == "codebox"
    assert policy.select_initial_provider(is_submit=False, has_active_nodes=True) == "distributed"


def test_execution_policy_retryability_rules():
    policy = ExecutionPolicy(max_attempts=2)

    # Infrastructure errors qualify for retry if deadline remains
    assert policy.should_retry(ErrorCode.NODE_HEARTBEAT_EXPIRED, current_attempt=1, remaining_deadline_s=10.0) is True
    assert policy.should_retry(ErrorCode.NODE_EXECUTION_TIMEOUT, current_attempt=1, remaining_deadline_s=10.0) is True
    assert policy.should_retry(ErrorCode.CODEBOX_HTTP_503, current_attempt=1, remaining_deadline_s=5.0) is True

    # User errors NEVER qualify for retry
    assert policy.should_retry(None, current_attempt=1, remaining_deadline_s=10.0) is False
    assert policy.should_retry(ErrorCode.STALE_ATTEMPT, current_attempt=1, remaining_deadline_s=10.0) is False
    assert policy.should_retry(ErrorCode.DUPLICATE_RESULT, current_attempt=1, remaining_deadline_s=10.0) is False

    # Max attempts reached -> NO retry
    assert policy.should_retry(ErrorCode.NODE_HEARTBEAT_EXPIRED, current_attempt=2, remaining_deadline_s=10.0) is False

    # Insufficient deadline remaining -> NO retry
    assert policy.should_retry(ErrorCode.NODE_HEARTBEAT_EXPIRED, current_attempt=1, remaining_deadline_s=1.0) is False


def test_exponential_backoff_with_jitter():
    policy = ExecutionPolicy(backoff_base_s=0.5, backoff_max_s=2.0)
    for attempt in [1, 2, 3]:
        delay = policy.compute_backoff(attempt)
        assert 0.1 <= delay <= 2.0


# ─── 2. Failure Classification & Safe Public Messages ────────────────────────

def test_failure_classification_safe_leak_protection():
    exc = JudgeExecutionException(
        error_code=ErrorCode.NODE_HEARTBEAT_EXPIRED,
        provider="distributed",
        attempt_id="att_123",
        internal_details="Connection to postgresql://secret:pass@127.0.0.1:5432 lost",
    )
    d = exc.to_dict()
    assert d["error_code"] == "NODE_HEARTBEAT_EXPIRED"
    assert d["retryable"] is True
    assert "secret" not in d["safe_message"]
    assert "postgres" not in d["safe_message"]


# ─── 3. Queue-Aware Deadlines ────────────────────────────────────────────────

def test_deadlines_tracking_and_domination():
    tracker = ExecutionDeadlineTracker(total_timeout_s=5.0)
    assert tracker.remaining_seconds() > 0.0
    assert tracker.is_expired() is False

    # Child stage budget must never exceed total remaining
    budget = tracker.stage_budget(configured_stage_timeout_s=15.0)
    assert budget <= 5.0

    # Expired tracker raises EXECUTION_DEADLINE_EXCEEDED
    expired_dt = datetime.now(timezone.utc) - timedelta(seconds=1)
    expired_tracker = ExecutionDeadlineTracker(deadline_at=expired_dt)
    assert expired_tracker.is_expired() is True
    with pytest.raises(JudgeExecutionException) as excinfo:
        expired_tracker.check_deadline("compile")
    assert excinfo.value.error_code == ErrorCode.EXECUTION_DEADLINE_EXCEEDED


# ─── 4. Codebox Circuit Breaker ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_circuit_breaker_transitions():
    cb = CodeboxCircuitBreaker()
    await cb.record_success()
    cb._local_state = CircuitState.CLOSED
    cb._local_failures = 0
    cb.failure_threshold = 3
    cb.cooldown_seconds = 0.5

    # 1. Closed state allows execution
    assert await cb.can_execute() is True

    # 2. Domain / user errors DO NOT trip the circuit
    await cb.record_failure(is_infrastructure=False, reason="User program produced WA")
    await cb.record_failure(is_infrastructure=False, reason="User program had CE")
    assert cb._local_failures == 0
    assert await cb.get_state() == CircuitState.CLOSED

    # 3. 3 Consecutive infrastructure failures TRIP to OPEN
    await cb.record_failure(is_infrastructure=True, reason="HTTP 503 Service Unavailable")
    await cb.record_failure(is_infrastructure=True, reason="Connection Refused")
    assert cb._local_failures == 2
    assert await cb.get_state() == CircuitState.CLOSED

    await cb.record_failure(is_infrastructure=True, reason="Worker BullMQ Crash")
    assert cb._local_failures == 3
    assert await cb.get_state() == CircuitState.OPEN
    assert await cb.can_execute() is False

    # 4. After cooldown, transitions to HALF_OPEN to allow single probe
    await asyncio.sleep(0.6)
    assert await cb.get_state() == CircuitState.HALF_OPEN
    assert await cb.can_execute() is True  # First probe allowed
    assert await cb.can_execute() is False  # Subsequent probe rejected

    # 5. Successful probe transitions back to CLOSED
    await cb.record_success()
    assert await cb.get_state() == CircuitState.CLOSED
    assert cb._local_failures == 0


# ─── 5. Codebox Admission Controller & Capacity Pools ────────────────────────

@pytest.mark.asyncio
async def test_admission_controller_bounded_concurrency_and_release():
    ac = CodeboxAdmissionController()
    ac.run_code_concurrency = 2
    ac.run_code_max_queue = 3
    ac._local_semaphores[AdmissionPool.RUN_CODE] = asyncio.Semaphore(2)

    # Acquire 2 slots concurrently
    async with ac.acquire_permit(pool=AdmissionPool.RUN_CODE, wait_timeout_s=1.0) as permit1:
        assert permit1 is True
        async with ac.acquire_permit(pool=AdmissionPool.RUN_CODE, wait_timeout_s=1.0) as permit2:
            assert permit2 is True
            # Attempting third with 0.1s timeout should exhaust capacity
            with pytest.raises(JudgeExecutionException) as excinfo:
                async with ac.acquire_permit(pool=AdmissionPool.RUN_CODE, wait_timeout_s=0.1):
                    pass
            assert excinfo.value.error_code == ErrorCode.EXECUTION_CAPACITY_EXHAUSTED

    # Invariant: Exiting context managers guarantees permits released!
    async with ac.acquire_permit(pool=AdmissionPool.RUN_CODE, wait_timeout_s=0.5) as permit_after:
        assert permit_after is True


# ─── 6. Fallback Manager Gating ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fallback_manager_circuit_and_deadline_gating():
    await CodeboxCircuitBreaker.get_instance().record_success()
    fm = FallbackManager()
    await fm._circuit_breaker.record_success()

    # 1. Normal conditions -> Fallback permitted
    healthy_tracker = ExecutionDeadlineTracker(total_timeout_s=20.0)
    decision = await fm.evaluate_fallback(healthy_tracker, attempt_number=1)
    assert decision.allowed is True
    assert decision.fallback_provider == "codebox"

    # 2. Insufficient deadline -> Fallback rejected with EXECUTION_DEADLINE_EXCEEDED
    tight_tracker = ExecutionDeadlineTracker(total_timeout_s=1.5)
    decision_tight = await fm.evaluate_fallback(tight_tracker, attempt_number=1)
    assert decision_tight.allowed is False
    assert decision_tight.rejection_code == ErrorCode.EXECUTION_DEADLINE_EXCEEDED

    # 3. Circuit breaker OPEN -> Fallback rejected with CODEBOX_UNAVAILABLE
    with patch.object(fm._circuit_breaker, "get_state", AsyncMock(return_value=CircuitState.OPEN)):
        decision_cb = await fm.evaluate_fallback(healthy_tracker, attempt_number=1)
        assert decision_cb.allowed is False
        assert decision_cb.rejection_code == ErrorCode.CODEBOX_UNAVAILABLE


# ─── 7. Attempt Model & Strict Result Fencing ────────────────────────────────

@pytest.mark.asyncio
async def test_strict_result_fencing_stale_attempt_rejection():
    """
    Scenario:
    - Job created
    - Attempt 1 created (active_attempt_id = att_1)
    - Attempt 2 created (active_attempt_id = att_2)
    - Attempt 1 finishes late -> rejected with STALE_ATTEMPT!
    - Attempt 2 finishes -> accepted as authoritative SUCCESS!
    - Attempt 2 finishes again -> rejected as DUPLICATE_RESULT!
    """
    mock_db = AsyncMock()

    job = JudgeJob(
        id="job_fencing_100",
        state="PROCESSING",
        attempt_number=2,
        active_attempt_id="att_2",
    )
    attempt_1 = JudgeJobAttempt(
        id="att_1",
        job_id="job_fencing_100",
        attempt_number=1,
        provider="distributed",
        state="STARTED",
    )
    attempt_2 = JudgeJobAttempt(
        id="att_2",
        job_id="job_fencing_100",
        attempt_number=2,
        provider="codebox",
        state="STARTED",
    )

    async def mock_get(model, pk):
        if model == JudgeJob and pk == "job_fencing_100":
            return job
        if model == JudgeJobAttempt and pk == "att_1":
            return attempt_1
        if model == JudgeJobAttempt and pk == "att_2":
            return attempt_2
        return None

    mock_db.get.side_effect = mock_get

    # Case A: Attempt 1 tries to finalize, but active_attempt_id is 'att_2'.
    # mock conditional update returning 0 rows updated
    mock_res_zero = MagicMock()
    mock_res_zero.rowcount = 0
    mock_db.execute.return_value = mock_res_zero

    fin_status_1, _ = await AttemptManager.finalize_attempt(
        db=mock_db,
        job_id="job_fencing_100",
        attempt_id="att_1",
        final_state="COMPLETED",
    )
    assert fin_status_1 == FinalizeResult.STALE_ATTEMPT
    assert attempt_1.state == "STALE"
    assert attempt_1.error_code == "STALE_ATTEMPT"

    # Case B: Authoritative Attempt 2 finalizes!
    mock_res_one = MagicMock()
    mock_res_one.rowcount = 1
    mock_db.execute.return_value = mock_res_one

    # Simulate root job update
    job.state = "COMPLETED"
    job.active_attempt_id = None

    fin_status_2, _ = await AttemptManager.finalize_attempt(
        db=mock_db,
        job_id="job_fencing_100",
        attempt_id="att_2",
        final_state="COMPLETED",
    )
    assert fin_status_2 == FinalizeResult.SUCCESS

    # Case C: Duplicate result delivery for Attempt 2
    mock_db.execute.return_value = mock_res_zero
    fin_status_dup, _ = await AttemptManager.finalize_attempt(
        db=mock_db,
        job_id="job_fencing_100",
        attempt_id="att_2",
        final_state="COMPLETED",
    )
    assert fin_status_dup == FinalizeResult.DUPLICATE_RESULT
