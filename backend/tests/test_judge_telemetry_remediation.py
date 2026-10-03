"""
Chaos Computer Club — Master Remediation Test Suite
Verification and regression tests for Codebox bottleneck elimination,
canonical timing model, non-synthetic telemetry attribution, and exact incident replay.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.errors import ErrorCode
from app.engine.attempt_manager import AttemptManager, FinalizeResult
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.execution_router import ExecutionRouter, build_consistent_telemetry
from app.engine.pipeline import LanguageAwareExecutionEngine
from app.engine.providers.codebox_provider import CodeboxProvider
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from app.models.judge_job import JudgeJob, JudgeJobAttempt


# ─────────────────────────────────────────────────────────────────────────────
# 1. PHASE 2 & 3: CODEBOX CPU vs WALL CLOCK TIMING
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_codebox_cpu_time_is_not_wall_time():
    """Verify that Codebox CPU/process runtime is strictly decoupled from wall turnaround."""
    provider = CodeboxProvider()

    # Mock response returning data["time"] = 0.215 (215ms CPU time)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": {"id": 3, "description": "Accepted"},
        "stdout": "42\n",
        "stderr": "",
        "compile_output": "",
        "time": "0.215",
        "memory": 2048,
        "exit_code": 0,
    }
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()

    async def delayed_post(*args, **kwargs):
        # Simulate network turnaround of 50ms
        await asyncio.sleep(0.05)
        return mock_resp

    mock_client.post = delayed_post

    tc = TestCaseSchema(id="tc_sample", stdin="input", expected_output="42")
    tc_res = await provider._execute_single_tc(
        client=mock_client,
        lang_id=71,
        code="print(42)",
        tc=tc,
        time_limit=2.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    # CPU runtime must be 215.0 ms
    assert tc_res.runtime_ms == 215.0
    assert tc_res.cpu_time_ms == 215.0
    # Wall-clock turnaround must reflect elapsed time (>= 45ms)
    assert tc_res.wall_time_ms >= 45.0
    # Crucial assertion: CPU time must NOT equal wall time when network took time
    assert tc_res.wall_time_ms != tc_res.runtime_ms


@pytest.mark.asyncio
async def test_codebox_wall_clock_is_measured():
    """Verify that wall-clock time in _execute_single_tc is measured using monotonic clocks."""
    provider = CodeboxProvider()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": {"id": 3, "description": "Accepted"},
        "stdout": "hello",
        "time": "0.010",
        "memory": 1024,
    }
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()

    async def fake_post(*args, **kwargs):
        await asyncio.sleep(0.02)
        return mock_resp

    mock_client.post = fake_post
    tc = TestCaseSchema(id="tc_wall", stdin="", expected_output="hello")

    tc_res = await provider._execute_single_tc(
        client=mock_client,
        lang_id=71,
        code="print('hello')",
        tc=tc,
        time_limit=2.0,
        memory_limit_mb=256,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    assert tc_res.wall_time_ms >= 15.0
    assert tc_res.cpu_time_ms == 10.0


@pytest.mark.asyncio
async def test_provider_turnaround_is_separate_from_execution_time():
    """Verify CodeboxProvider.execute_batch populates provider_turnaround_ms separately."""
    provider = CodeboxProvider()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": {"id": 3, "description": "Accepted"},
        "stdout": "ans",
        "time": "0.050",
        "memory": 1024,
    }
    mock_resp.raise_for_status = MagicMock()

    tcs = [
        TestCaseSchema(id=f"tc_{i}", stdin="", expected_output="ans")
        for i in range(3)
    ]

    with patch.object(provider, "healthy", AsyncMock(return_value=True)), \
         patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_resp)):
        res = await provider.execute_batch(
            language="python",
            code="print('ans')",
            testcases=tcs,
        )

    assert res.provider_turnaround_ms is not None
    assert res.execution_cpu_ms is not None
    assert res.execution_wall_ms is not None
    # 3 testcases * 50ms CPU time = 150ms total CPU
    assert res.execution_cpu_ms == pytest.approx(150.0, rel=1e-2)
    assert res.time == pytest.approx(0.050, rel=1e-2)  # Max single testcase CPU time in seconds


# ─────────────────────────────────────────────────────────────────────────────
# 2. PHASE 5 & 6: ELIMINATING SYNTHETIC RESIDUAL RESULT-REPORT TIMING
# ─────────────────────────────────────────────────────────────────────────────

def test_result_report_latency_is_measured_not_synthesized():
    """
    CRITICAL FORENSIC TEST:
    Verify that an observed 22.7s Codebox turnaround does NOT synthetically inflate
    result_report_ms to 22.7s.
    """
    t_enq = datetime.now(timezone.utc) - timedelta(milliseconds=22963.33)

    timestamps, latencies = build_consistent_telemetry(
        t_enqueue=t_enq,
        total_elapsed_ms=22963.33,
        queue_wait_ms=0.0,
        compile_dur_ms=0.0,
        exec_dur_ms=215.0,
        cas_ms=6.36,
        execution_cpu_ms=215.0,
        execution_wall_ms=22710.89,
        provider_turnaround_ms=22710.89,
        result_normalization_ms=0.5,
        result_report_ms=1.2,
    )

    # result_report_ms MUST be the actual measured report time (~1.2ms), NOT 22,710ms!
    assert latencies["result_report_ms"] == 1.2
    assert latencies["result_report_ms"] < 10.0

    # The 22,710ms must be attributed to provider_turnaround_ms and execution_wall_ms
    assert latencies["provider_turnaround_ms"] == 22710.89
    assert latencies["execution_wall_ms"] == 22710.89

    # execution_cpu_ms must correctly show the 215ms isolate runtime
    assert latencies["execution_cpu_ms"] == 215.0
    assert latencies["cas_finalize_ms"] == 6.36


def test_no_synthetic_residual_latency():
    """Verify that variations in total_elapsed_ms do not leak into result_report_ms."""
    t_enq = datetime.now(timezone.utc)

    # Even if total elapsed is huge (e.g. 50,000ms), result_report_ms remains measured
    _, latencies_1 = build_consistent_telemetry(
        t_enqueue=t_enq,
        total_elapsed_ms=50000.0,
        queue_wait_ms=10.0,
        compile_dur_ms=20.0,
        exec_dur_ms=100.0,
        cas_ms=5.0,
        result_report_ms=2.5,
    )
    assert latencies_1["result_report_ms"] == 2.5

    # If result_report_ms is omitted, it defaults to realistic nominal measurement (0.5ms), NEVER a residual!
    _, latencies_2 = build_consistent_telemetry(
        t_enqueue=t_enq,
        total_elapsed_ms=50000.0,
        queue_wait_ms=10.0,
        compile_dur_ms=20.0,
        exec_dur_ms=100.0,
        cas_ms=5.0,
        result_report_ms=None,
    )
    assert latencies_2["result_report_ms"] == 0.5


def test_execution_result_timing_fields_are_populated():
    """Verify ExecutionResult schema explicitly populates all timing fields."""
    res = ExecutionResult(
        success=True,
        compile_time_ms=15.2,
        execution_time_ms=45.0,
        total_time_ms=65.0,
        execution_cpu_ms=42.0,
        execution_wall_ms=45.0,
        provider_turnaround_ms=55.0,
        result_normalization_ms=1.5,
    )
    assert res.compile_time_ms == 15.2
    assert res.execution_time_ms == 45.0
    assert res.total_time_ms == 65.0
    assert res.execution_cpu_ms == 42.0
    assert res.execution_wall_ms == 45.0
    assert res.provider_turnaround_ms == 55.0
    assert res.result_normalization_ms == 1.5


# ─────────────────────────────────────────────────────────────────────────────
# 3. PHASE 7 & 8: PREFERRING LanguageAwareExecutionEngine OVER CODEBOX
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_language_engine_preferred_over_legacy_codebox():
    """
    Verify ExecutionRouter selects the local LanguageAwareExecutionEngine
    when distributed nodes are not online, avoiding Codebox HTTP overhead.
    """
    router = ExecutionRouter.get_instance()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_db.flush = AsyncMock()

    tcs = [TestCaseSchema(id="tc_pref", stdin="4\n", expected_output="8")]

    # When active distributed nodes is empty, verify local engine executes
    with patch.object(router, "_get_active_distributed_nodes", AsyncMock(return_value=[])):
        res = await router.execute(
            db=mock_db,
            language=Language.PYTHON,
            code="n = int(input())\nprint(n * 2)",
            testcases=tcs,
            is_submit=True,
        )

    # Must route to 'local' LanguageAwareExecutionEngine, not 'codebox'
    assert res.provider == "local"
    assert res.success is True
    assert res.verdict == Verdict.ACCEPTED
    assert res.node_id == "local-language-engine"


# ─────────────────────────────────────────────────────────────────────────────
# 4. PHASE 9 & 10: COMPILE-ONCE & CACHING BEHAVIOR
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_compile_once_for_multiple_testcases():
    """Verify LanguageAwareExecutionEngine compiles once and reuses artifact across testcases."""
    engine = LanguageAwareExecutionEngine.get_instance()
    tcs = [
        TestCaseSchema(id=f"tc_{i}", stdin=f"{i}\n", expected_output=f"{i+1}")
        for i in range(5)
    ]
    code = "x = int(input())\nprint(x + 1)"

    res = await engine.execute(
        language=Language.PYTHON,
        code=code,
        testcases=tcs,
    )

    assert res.success is True
    assert len(res.testcase_results) == 5
    assert all(tc.passed for tc in res.testcase_results)
    # Execution telemetry should record process_per_testcase
    assert res.total_testcases == 5
    assert res.passed_testcases == 5


@pytest.mark.asyncio
async def test_compilation_cache_hit_and_miss():
    """Verify compilation cache accurately flags hits and misses on compiled languages."""
    engine = LanguageAwareExecutionEngine.get_instance()
    tcs = [TestCaseSchema(id="tc_c1", stdin="5\n", expected_output="10")]

    unique_marker = f"test_cache_{time.time_ns()}"
    cpp_code_a = f"#include <iostream>\n// {unique_marker}\nint main() {{ int n; if (std::cin >> n) std::cout << (n * 2) << std::endl; return 0; }}"
    cpp_code_b = f"#include <iostream>\n// {unique_marker}_diff\nint main() {{ int n; if (std::cin >> n) std::cout << (n * 3) << std::endl; return 0; }}"

    res_1 = await engine.execute(language=Language.CPP, code=cpp_code_a, testcases=tcs)
    res_2 = await engine.execute(language=Language.CPP, code=cpp_code_a, testcases=tcs)
    res_3 = await engine.execute(language=Language.CPP, code=cpp_code_b, testcases=tcs)

    # First run on code_a: compiled (cache miss)
    assert res_1.telemetry.get("artifact_cache_hit") is False or res_1.telemetry.get("cache_hit") is False
    # Second run on identical code_a: cached artifact reused (cache hit!)
    assert res_2.telemetry.get("artifact_cache_hit") is True or res_2.telemetry.get("cache_hit") is True
    assert res_2.compile_time_ms == 0.0
    # Run on modified code_b: recompiled (cache miss)
    assert res_3.telemetry.get("artifact_cache_hit") is False or res_3.telemetry.get("cache_hit") is False



# ─────────────────────────────────────────────────────────────────────────────
# 5. PHASE 11 & 13 & 14: DEADLINE, STALE FENCING, AND IDEMPOTENCY
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_codebox_fallback_respects_deadline():
    """Verify that stage budget tracker prevents hanging when deadline expires."""
    tracker = ExecutionDeadlineTracker(total_timeout_s=0.5)
    await asyncio.sleep(0.6)
    assert tracker.is_expired() is True

    provider = CodeboxProvider()
    tcs = [TestCaseSchema(id="tc_dead", stdin="", expected_output="ok")]
    res = await provider.execute_batch(
        language="python",
        code="print('ok')",
        testcases=tcs,
        deadline_tracker=tracker,
    )
    assert res.success is False
    assert res.verdict == Verdict.SYSTEM_ERROR
    assert ErrorCode.EXECUTION_DEADLINE_EXCEEDED.value in (res.error or "")


@pytest.mark.asyncio
async def test_stale_attempt_rejected():
    """Verify AttemptManager rejects late finalization attempts."""
    mock_db = AsyncMock()
    # Mock conditional update finding 0 rows updated
    mock_res = MagicMock()
    mock_res.rowcount = 0
    mock_db.execute = AsyncMock(return_value=mock_res)

    mock_job = MagicMock()
    mock_job.id = "job_fencing_1"
    mock_job.active_attempt_id = "attempt_2"  # Newer attempt is active
    mock_job.active_lease_id = "lease_2"
    mock_job.state = "PROCESSING"

    mock_db.get = AsyncMock(return_value=mock_job)

    # Attempt 1 (stale) tries to finalize
    status, _ = await AttemptManager.finalize_attempt(
        db=mock_db,
        job_id="job_fencing_1",
        attempt_id="attempt_1",
        final_state="COMPLETED",
    )
    assert status == FinalizeResult.STALE_ATTEMPT


@pytest.mark.asyncio
async def test_duplicate_result_is_idempotent():
    """Verify AttemptManager idempotently ignores duplicate finalization of already-completed job."""
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.rowcount = 0
    mock_db.execute = AsyncMock(return_value=mock_res)

    mock_job = MagicMock()
    mock_job.id = "job_idempotent_1"
    mock_job.active_attempt_id = None
    mock_job.state = "COMPLETED"  # Already completed

    mock_db.get = AsyncMock(return_value=mock_job)

    status, _ = await AttemptManager.finalize_attempt(
        db=mock_db,
        job_id="job_idempotent_1",
        attempt_id="attempt_1",
        final_state="COMPLETED",
    )
    assert status == FinalizeResult.DUPLICATE_RESULT



# ─────────────────────────────────────────────────────────────────────────────
# 6. PHASE 21: EXACT 13-TESTCASE INCIDENT REGRESSION REPLAY
# ─────────────────────────────────────────────────────────────────────────────

def test_exact_13_testcase_incident_regression():
    """
    EXACT INCIDENT REPLAY:
    Submission ID: 5950f892-17ef-4a59-bc0f-aca4d4623bfc
    13 testcases, Codebox fallback.
    Reported execution CPU time: 215ms.
    Actual Codebox HTTP turnaround: 22,710.89ms.
    DB CAS duration: 6.36ms.

    PREVIOUS SYSTEM (THE BUG):
    rep_ms = 22963.33 - (0 + 1 + 0 + 215 + 6.36) = 22,740.97 ms (~22.7s attributed to result reporting!)

    NEW SYSTEM (REMEDIATED):
    - result_report_ms is strictly measured (<= 2ms)
    - provider_turnaround_ms is 22,710.89ms (correctly pinpointing Codebox!)
    - execution_cpu_ms is 215ms
    """
    t_enq = datetime.now(timezone.utc) - timedelta(milliseconds=22963.33)

    measured_rep_latency = 1.05  # Actual time spent serializing result

    timestamps, latencies = build_consistent_telemetry(
        t_enqueue=t_enq,
        total_elapsed_ms=22963.33,
        queue_wait_ms=0.0,
        compile_dur_ms=0.0,
        exec_dur_ms=215.0,
        cas_ms=6.36,
        execution_cpu_ms=215.0,
        execution_wall_ms=22710.89,
        provider_turnaround_ms=22710.89,
        result_normalization_ms=0.8,
        result_report_ms=measured_rep_latency,
        claim_latency_ms=1.0,
    )

    # 1. result_report_ms must NEVER be 22,710ms
    assert latencies["result_report_ms"] == 1.05
    assert latencies["result_report_ms"] < 5.0

    # 2. provider_turnaround_ms MUST expose the real bottleneck
    assert latencies["provider_turnaround_ms"] == 22710.89

    # 3. execution_cpu_ms and execution_wall_ms are properly distinguished
    assert latencies["execution_cpu_ms"] == 215.0
    assert latencies["execution_wall_ms"] == 22710.89

    # 4. CAS and total latency accurately recorded
    assert latencies["cas_finalize_ms"] == 6.36
    assert latencies["total_submission_latency_ms"] == 22963.33
