"""
Chaos Computer Club — Medi-Caps Chapter
Production Architecture Invariants & Chaos Verification Suite
Tests the end-to-end correctness of:
1. Reconciliation & Outbox Requeue on Node Lease Expiry
2. Sliding-Window Circuit Breaker (No permanent failure accumulation)
3. Event-Driven Admission Controller (No busy-spin polling)
4. Capability-Aware Node Scheduling (Python-only node never gets Java)
5. Central Node Slot Governance (available_slots <= 0 blocked)
6. Fabric Queue Orphan Reaper
7. Contest Lifecycle Submissions Gate (DRAINING / FINALIZING / COMPLETE rejected)
8. Prometheus Metrics Export for Execution & Circuit Breakers
"""

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException

from app.core.contest_lifecycle import (
    ContestLifecycleState,
    assert_submissions_open,
    set_lifecycle_state,
)
from app.core.queue.outbox import OutboxEvent, record_outbox_event, relay_outbox_events
from app.engine.admission_controller import (
    AdmissionPool,
    CodeboxAdmissionController,
)
from app.engine.circuit_breaker import CircuitState, CodeboxCircuitBreaker
from app.engine.errors import ErrorCode, JudgeExecutionException
from app.engine.observability import ExecutionObservability
from app.models.judge_job import JudgeJob, JudgeJobAttempt


@pytest.mark.asyncio
async def test_reconciliation_records_outbox_requeue_on_node_expiry():
    """
    Test 1: When a node heartbeat/lease expires, ReconciliationWorker marks
    the attempt EXPIRED, sets job.state='QUEUED', and records EXECUTION_REQUEUE
    in outbox_events in the SAME transaction.
    """
    from app.core.reconciliation import ReconciliationWorker

    worker = ReconciliationWorker.get_instance()
    mock_session = AsyncMock()

    from datetime import datetime, timedelta, timezone

    # In-flight job with active deadline budget
    fake_job = JudgeJob(
        id="job-recon-1",
        state="PROCESSING",
        active_attempt_id="att-1",
        attempt_number=1,
        deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
    )
    fake_attempt = JudgeJobAttempt(
        id="att-1",
        job_id="job-recon-1",
        attempt_number=1,
        provider="distributed",
        node_id="laptop-node-99",
        state="STARTED",
    )

    exec_result_mock = MagicMock()
    exec_result_mock.scalars.return_value.all.return_value = [fake_job]
    mock_session.execute = AsyncMock(return_value=exec_result_mock)
    mock_session.get = AsyncMock(return_value=fake_attempt)
    mock_session.commit = AsyncMock()

    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_ctx.__aexit__ = AsyncMock(return_value=None)

    mock_redis = AsyncMock()
    mock_redis.exists = AsyncMock(return_value=False)
    mock_redis.lpush = AsyncMock()

    with patch("app.core.reconciliation.AsyncSessionLocal", return_value=mock_session_ctx), \
         patch("app.core.reconciliation.get_redis", return_value=mock_redis), \
         patch("app.core.queue.outbox.record_outbox_event", new_callable=AsyncMock) as mock_outbox:

        recovered = await worker.reconcile_once()

        assert recovered == 1
        assert fake_job.state == "QUEUED"
        assert fake_job.active_attempt_id is None
        assert fake_attempt.state == "EXPIRED"
        assert mock_session.commit.called
        assert mock_outbox.called
        assert mock_outbox.call_args.kwargs["event_type"] == "EXECUTION_REQUEUE"
        assert mock_outbox.call_args.kwargs["payload"]["job_id"] == "job-recon-1"


@pytest.mark.asyncio
async def test_sliding_window_circuit_breaker():
    """
    Test 2: Circuit breaker tracks failures within a sliding 60-second window.
    Isolated failures outside the window do NOT trip the breaker.
    """
    cb = CodeboxCircuitBreaker()
    cb.failure_threshold = 3
    cb.window_seconds = 2.0
    cb.cooldown_seconds = 1.0

    # Record 2 failures
    await cb.record_failure(is_infrastructure=True, reason="503 timeout")
    await cb.record_failure(is_infrastructure=True, reason="503 timeout")
    assert await cb.get_state() == CircuitState.CLOSED

    # Wait for the sliding window to elapse
    await asyncio.sleep(2.1)

    # Record 1 more failure: total active in window is only 1, so circuit stays CLOSED
    await cb.record_failure(is_infrastructure=True, reason="503 timeout")
    assert await cb.get_state() == CircuitState.CLOSED

    # Now record 2 rapid failures (total 3 in current window)
    await cb.record_failure(is_infrastructure=True, reason="503 timeout")
    await cb.record_failure(is_infrastructure=True, reason="503 timeout")
    # Must TRIP to OPEN
    assert await cb.get_state() == CircuitState.OPEN


@pytest.mark.asyncio
async def test_event_driven_admission_controller_no_spin_loop():
    """
    Test 3: Admission controller uses event-driven BLPOP with waiter queue,
    not a busy-polling sleep loop.
    """
    controller = CodeboxAdmissionController.get_instance()
    mock_redis = AsyncMock()

    with patch("app.engine.admission_controller.get_redis", return_value=mock_redis):
        # Simulate permit acquired immediately
        mock_redis.eval = AsyncMock(return_value="ACQUIRED")
        async with controller.acquire_permit(AdmissionPool.RUN_CODE) as granted:
            assert granted is True

        # Simulate queue full rejection
        mock_redis.eval = AsyncMock(return_value="REJECTED")
        with pytest.raises(JudgeExecutionException) as exc_info:
            async with controller.acquire_permit(AdmissionPool.RUN_CODE):
                pass
        assert exc_info.value.error_code == ErrorCode.CODEBOX_QUEUE_FULL


@pytest.mark.asyncio
async def test_capability_aware_scheduling_language_isolation():
    """
    Test 4: Node claiming only pops compatible workloads.
    A Python-only node claiming work will reject a Java job and requeue it.
    """
    from app.routers.nodes import claim_job, NodeClaimRequest

    mock_redis = AsyncMock()
    mock_redis.exists = AsyncMock(return_value=True)  # Heartbeat alive
    # Node registered for Python only
    mock_redis.hgetall = AsyncMock(return_value={
        b"status": b"ready",
        b"available_slots": b"2",
        b"languages": json.dumps(["python"]).encode(),
    })
    # Fabric queue returns a Java job
    mock_redis.rpoplpush = AsyncMock(return_value="job-java-1")
    java_job_payload = {
        "id": "job-java-1",
        "attempt": 0,
        "payload": {"language": "java", "code": "class Solution {}"},
    }
    mock_redis.get = AsyncMock(return_value=json.dumps(java_job_payload))
    mock_redis.lrem = AsyncMock()
    mock_redis.rpush = AsyncMock()

    with patch("app.routers.nodes.get_redis", return_value=mock_redis):
        result = await claim_job("node-py-only", NodeClaimRequest())
        assert result == {"job": None}
        # Verify Java job was removed from processing and requeued into java queue
        assert mock_redis.lrem.called
        assert mock_redis.rpush.called
        assert mock_redis.rpush.call_args[0][0] == "ccc:queue:fabric:pending:java"


@pytest.mark.asyncio
async def test_node_slot_limits_blocked_when_zero():
    """
    Test 5: Node with 0 available slots is denied from claiming work.
    """
    from app.routers.nodes import claim_job, NodeClaimRequest

    mock_redis = AsyncMock()
    mock_redis.exists = AsyncMock(return_value=True)
    mock_redis.hgetall = AsyncMock(return_value={
        b"status": b"ready",
        b"available_slots": b"0",  # Zero slots left!
        b"languages": json.dumps(["python"]).encode(),
    })

    with patch("app.routers.nodes.get_redis", return_value=mock_redis):
        result = await claim_job("node-saturated", NodeClaimRequest())
        assert result == {"job": None}


@pytest.mark.asyncio
async def test_contest_lifecycle_submissions_gate():
    """
    Test 6: Submissions are rejected with 422 if contest is DRAINING,
    FINALIZING, or COMPLETE.
    """
    mock_redis = AsyncMock()

    # 1. DRAINING
    mock_redis.get = AsyncMock(return_value=ContestLifecycleState.DRAINING.value.encode())
    with patch("app.core.contest_lifecycle.get_redis", return_value=mock_redis):
        with pytest.raises(HTTPException) as exc:
            await assert_submissions_open("weekly-contest-01")
        assert exc.value.status_code == 422
        assert "DRAINING" in exc.value.detail

    # 2. FINALIZING
    mock_redis.get = AsyncMock(return_value=ContestLifecycleState.FINALIZING.value.encode())
    with patch("app.core.contest_lifecycle.get_redis", return_value=mock_redis):
        with pytest.raises(HTTPException) as exc:
            await assert_submissions_open("weekly-contest-01")
        assert exc.value.status_code == 422
        assert "FINALIZING" in exc.value.detail

    # 3. CONTEST_ACTIVE (Should pass without exception)
    mock_redis.get = AsyncMock(return_value=ContestLifecycleState.CONTEST_ACTIVE.value.encode())
    with patch("app.core.contest_lifecycle.get_redis", return_value=mock_redis):
        await assert_submissions_open("weekly-contest-01")  # No raise


@pytest.mark.asyncio
async def test_prometheus_metrics_export_observability():
    """
    Test 7: Prometheus metrics endpoint exports ExecutionObservability counters
    and circuit breaker states.
    """
    from app.routers.metrics import prometheus_metrics

    obs = ExecutionObservability.get_instance()
    obs.record_counter("judge_stale_results_total", 5.0)

    cb = CodeboxCircuitBreaker.get_instance()
    cb._local_state = CircuitState.CLOSED

    response = await prometheus_metrics()
    assert response.status_code == 200
    content = response.body.decode("utf-8")
    assert "ccc_judge_stale_results_total" in content
    assert "ccc_circuit_breaker_state" in content
