"""
Chaos Computer Club — Phase 0: Judge Telemetry Contract & Invariant Verification
Tests that every code submission and interactive run carries the complete distributed
telemetry envelope:
- Identifiers: submission_id, job_id, attempt_id, lease_id, node_id, container_id, provider
- Timestamps: enqueue, claim, execution_start, compile_start, compile_end, execution_end, result_report, db_cas, outbox, redis_publish
- Latencies: queue_wait_ms, claim_latency_ms, compile_ms, execution_ms, result_report_ms, cas_finalize_ms, sse_publish_ms, total_submission_latency_ms
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.execution_router import ExecutionRouter
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from app.models.db_models import ContestProblem, ContestSubmission, MemberProfile, OfflineContest, ScoreboardEntry
from app.modules.contests.contest_execution_service import (
    ArenaRunRequest,
    ArenaSubmitRequest,
    ContestExecutionService,
)


@pytest.mark.asyncio
async def test_execution_router_attaches_phase_0_telemetry():
    """Verify ExecutionRouter produces all identifiers, timestamps, and latencies."""
    router = ExecutionRouter.get_instance()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_db.flush = AsyncMock()

    mock_provider = AsyncMock()
    mock_provider.execute_batch = AsyncMock(return_value=ExecutionResult(
        success=True,
        submission_id="test_sub_1",
        status=ExecutionStatus.COMPLETED,
        verdict=Verdict.ACCEPTED,
        time=0.045,
        memory=18.5,
        compile_time_ms=12.0,
        execution_time_ms=45.0,
        total_time_ms=65.0,
        testcase_results=[
            TestCaseResult(
                testcase_id="tc_1",
                passed=True,
                verdict=Verdict.ACCEPTED,
                wall_time_ms=45.0,
            )
        ],
    ))

    tcs = [TestCaseSchema(id="tc_1", stdin="3\n1 2 3", expected_output="6")]

    with patch.object(router, "_codebox_provider", mock_provider), \
         patch.object(router, "_get_active_distributed_nodes", AsyncMock(return_value=[])):
        res = await router.execute(
            db=mock_db,
            language=Language.PYTHON,
            code="print(6)\n",
            testcases=tcs,
            time_limit=2.0,
            memory_limit_mb=256,
            is_submit=False,
            contest_id="contest_telemetry",
            problem_id="prob_telemetry",
            member_id="mem_telemetry",
        )

    # Identifiers
    assert res.job_id is not None
    assert res.attempt_id is not None
    assert res.lease_id is not None
    assert res.node_id is not None
    assert res.container_id is not None
    assert res.provider in ("codebox", "distributed", "docker", "local")


    # Timestamps
    required_timestamps = [
        "enqueue", "claim", "execution_start", "compile_start",
        "compile_end", "execution_end", "result_report", "db_cas"
    ]
    for ts_name in required_timestamps:
        assert ts_name in res.timestamps, f"Missing timestamp {ts_name}"
        assert isinstance(res.timestamps[ts_name], str)

    # Latencies
    required_latencies = [
        "queue_wait_ms", "claim_latency_ms", "compile_ms",
        "execution_ms", "result_report_ms", "cas_finalize_ms",
        "total_submission_latency_ms"
    ]
    for lat_name in required_latencies:
        assert lat_name in res.latencies, f"Missing latency metric {lat_name}"
        assert isinstance(res.latencies[lat_name], (int, float))
        assert res.latencies[lat_name] >= 0.0


@pytest.mark.asyncio
async def test_arena_submission_returns_complete_telemetry_payload():
    """Verify submit_arena_code returns outbox and redis_publish timestamps and sse_publish_ms."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = None
    mock_scalars.all.return_value = []
    mock_db.scalars = AsyncMock(return_value=mock_scalars)
    mock_db.scalar = AsyncMock(return_value=0)

    from datetime import timedelta
    now = datetime.now(timezone.utc)
    contest = OfflineContest(
        id="c_telemetry_id",
        slug="loadtest-arena-50",
        status="live",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    problem = ContestProblem(
        id="p_telemetry_id",
        contest_id="c_telemetry_id",
        problem_index="A",
        points=100,
        sample_testcases=[{"input": "1 2", "output": "3"}],
        hidden_testcases=[],
    )
    member = MemberProfile(
        id="m_telemetry_id",
        handle="loadtest-student-001",
        full_name="Loadtest Student 001",
        email="loadtest-student-001@medicaps.ac.in",
        department="CSE",
        batch="2023-27",
    )

    mock_exec_res = ExecutionResult(
        success=True,
        submission_id="sub_test_1",
        job_id="job_test_1",
        attempt_id="att_test_1",
        lease_id="lease_test_1",
        node_id="codebox-local",
        container_id="sandbox-test-1",
        provider="codebox",
        status=ExecutionStatus.COMPLETED,
        verdict=Verdict.ACCEPTED,
        time=0.035,
        memory=15.0,
        compile_time_ms=10.0,
        execution_time_ms=35.0,
        total_time_ms=50.0,
        timestamps={
            "enqueue": now.isoformat(),
            "claim": now.isoformat(),
            "execution_start": now.isoformat(),
            "compile_start": now.isoformat(),
            "compile_end": now.isoformat(),
            "execution_end": now.isoformat(),
            "result_report": now.isoformat(),
            "db_cas": now.isoformat(),
        },
        latencies={
            "queue_wait_ms": 1.5,
            "claim_latency_ms": 0.8,
            "compile_ms": 10.0,
            "execution_ms": 35.0,
            "result_report_ms": 0.5,
            "cas_finalize_ms": 1.2,
            "total_submission_latency_ms": 50.0,
        },
        testcase_results=[
            TestCaseResult(
                testcase_id="tc_1",
                passed=True,
                verdict=Verdict.ACCEPTED,
                stdout="3",
                expected_output="3",
            )
        ],
    )

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_repository.ContestRepository.get_problem_by_id", AsyncMock(return_value=problem)), \
         patch("app.modules.contests.contest_repository.ContestRepository.get_scoreboard_entry", AsyncMock(return_value=None)), \
         patch("app.modules.contests.contest_repository.ContestRepository.re_rank_scoreboard", AsyncMock()), \
         patch("app.modules.contests.contest_execution_service.is_contest_attempt_submitted", AsyncMock(return_value=(False, None))), \
         patch("app.modules.contests.contest_execution_service.assert_submissions_open", AsyncMock()), \
         patch("app.modules.contests.contest_execution_service.is_member_eligible_for_live_contest", AsyncMock(return_value=(True, None))), \
         patch("app.engine.execution_router.ExecutionRouter.execute", AsyncMock(return_value=mock_exec_res)), \
         patch("app.core.queue.outbox.record_outbox_event", AsyncMock()), \
         patch("app.services.event_broadcaster.broadcast_event", AsyncMock()), \
         patch("app.core.cache.delete_cache_pattern", AsyncMock()):

        req = ArenaSubmitRequest(problem_id="p_telemetry_id", language="python", code="print(3)")
        response = await ContestExecutionService.submit_arena_code(
            slug="loadtest-arena-50",
            payload=req,
            current_member=member,
            db=mock_db,
        )

    # Check identifiers
    assert "submission_id" in response
    assert response["job_id"] == "job_test_1"
    assert response["attempt_id"] == "att_test_1"
    assert response["lease_id"] == "lease_test_1"
    assert response["node_id"] == "codebox-local"
    assert response["container_id"] == "sandbox-test-1"
    assert response["provider"] == "codebox"

    # Check timestamps
    assert "timestamps" in response
    ts = response["timestamps"]
    assert "outbox" in ts
    assert "redis_publish" in ts
    assert "db_cas" in ts

    # Check calculated latencies
    assert "latencies" in response
    lats = response["latencies"]
    assert "sse_publish_ms" in lats
    assert "cas_finalize_ms" in lats
    assert "queue_wait_ms" in lats
    assert "execution_ms" in lats
    assert "total_submission_latency_ms" in lats
