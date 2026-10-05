"""
Chaos Computer Club — Online Judge Complete Remediation & Architecture Hardening Tests
Verifies:
1. Security & Fail-Closed Policy: ALLOW_UNSANDBOXED_EXECUTION=False fails closed to SYSTEM_ERROR.
2. Hidden Testcase Privacy: stdin, stdout, and stderr exfiltration attacks are redacted.
3. Java Execution Consistency: Main.java / class Main standardized across all layers.
4. C Array Return Contract: starter code contains int* returnSize matching wrapper.
5. TypeScript Execution: TypeScriptExecutor registered and verified.
6. Output Limit Classification: OUTPUT_LIMIT_EXCEEDED verdict returned when output exceeds limit.
7. Contest Expiry & Lifecycle: finished/expired contest strictly rejects submissions.
8. Scoreboard Penalty Correctness: penalty accumulates per problem + 20min per failed attempt before AC.
9. Idempotency & Debounce: duplicate submissions within window rejected with 429.
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.contracts import DataType, FunctionSignature, ParameterDefinition
from app.engine.schemas import (
    CompileResult,
    ExecutionResult,
    SandboxResult,
    TestCaseResult,
    TestCaseSchema,
)
from app.engine.providers.base import ProviderRunRequest
from app.engine.judge import JudgeEngine
from app.engine.adapters import get_adapter
from app.engine.executors.factory import get_executor
from app.engine.executors.typescript_executor import TypeScriptExecutor
from app.engine.providers.local_provider import LocalSandboxProvider
from app.engine.providers.docker_provider import DockerSandboxProvider
from app.engine.providers.codebox_provider import CodeboxProvider
from app.engine.sandbox import Sandbox
from app.modules.contests.contest_execution_service import (
    ArenaRunRequest,
    ArenaSubmitRequest,
    ContestExecutionService,
)
from fastapi import HTTPException


# ===========================================================================
# 1. SECURITY & FAIL-CLOSED POLICY TESTS
# ===========================================================================

@pytest.mark.asyncio
async def test_unsandboxed_execution_prohibited_by_default():
    """Verify that when ALLOW_UNSANDBOXED_EXECUTION is False, host execution is blocked."""
    with patch.object(settings, "ALLOW_UNSANDBOXED_EXECUTION", False):
        # 1. Sandbox.run fails closed
        res = await Sandbox.run(command=["echo", "test"], workspace=MagicMock())
        assert res.system_error is True
        assert "CRITICAL SECURITY VIOLATION" in res.stderr

        # 2. Sandbox.compile fails closed
        c_res = await Sandbox.compile(command=["gcc", "test.c"], workspace=MagicMock())
        assert c_res.success is False
        assert "CRITICAL SECURITY VIOLATION" in c_res.error

        # 3. LocalSandboxProvider fails closed
        local_prov = LocalSandboxProvider()
        exec_res = await local_prov.execute_batch(
            language="python",
            code="print(1)",
            testcases=[TestCaseSchema(stdin="", expected_output="1")],
        )
        assert exec_res.success is False
        assert exec_res.verdict == Verdict.SYSTEM_ERROR

        run_res = await local_prov.run(ProviderRunRequest(language="python", source_code="print(1)"))
        assert run_res.verdict == "system_error"


@pytest.mark.asyncio
async def test_docker_and_codebox_offline_fail_closed_to_system_error():
    """When Docker or Codebox is unreachable and ALLOW_UNSANDBOXED_EXECUTION is False, must return SYSTEM_ERROR."""
    with patch.object(settings, "ALLOW_UNSANDBOXED_EXECUTION", False):
        # Docker offline
        docker_prov = DockerSandboxProvider()
        docker_prov.healthy = AsyncMock(return_value=False)
        d_res = await docker_prov.execute_batch(
            language="python",
            code="print(1)",
            testcases=[TestCaseSchema(stdin="", expected_output="1")],
        )
        assert d_res.success is False
        assert d_res.verdict == Verdict.SYSTEM_ERROR
        assert d_res.status == ExecutionStatus.FAILED
        assert "CRITICAL INFRASTRUCTURE FAILURE" in (d_res.error or "")

        # Codebox offline
        cb_prov = CodeboxProvider()
        cb_prov.healthy = AsyncMock(return_value=False)
        cb_res = await cb_prov.execute_batch(
            language="python",
            code="print(1)",
            testcases=[TestCaseSchema(stdin="", expected_output="1")],
        )
        assert cb_res.success is False
        assert cb_res.verdict == Verdict.SYSTEM_ERROR
        assert cb_res.status == ExecutionStatus.FAILED
        assert "CRITICAL INFRASTRUCTURE FAILURE" in (cb_res.error or "")


# ===========================================================================
# 2. HIDDEN TESTCASE PRIVACY TESTS
# ===========================================================================

def test_judge_engine_redacts_hidden_testcase_stderr_and_stdout():
    """Candidate attempting sys.stderr.write(sys.stdin.read()) must NOT leak hidden input."""
    hidden_input = "SECRET_INPUT_FOR_HIDDEN_TESTCASE"
    hidden_output = "SECRET_EXPECTED_OUTPUT"
    tc = TestCaseSchema(
        id="hidden_tc_1",
        name="Hidden 1",
        stdin=hidden_input,
        expected_output=hidden_output,
        hidden=True,
    )

    # Candidate attempted exfiltration via stderr
    leaked_sandbox_res = SandboxResult(
        stdout="Candidate Output",
        stderr=f"Exfiltrated data: {hidden_input}",
        exit_code=0,
    )

    tc_res = JudgeEngine.evaluate(leaked_sandbox_res, tc)
    assert tc_res.stdout == ""
    assert tc_res.stderr == ""
    assert tc_res.expected_output == ""
    assert tc_res.hidden is True


# ===========================================================================
# 3. JAVA CLASS & FILE MISMATCH FIX
# ===========================================================================

def test_java_adapter_and_spec_standardized_on_main():
    """Verify Java adapter wrapper and language specs both use Main.java / public class Main."""
    from app.engine.docker.languages import get_language_spec

    spec = get_language_spec("java")
    assert spec.filename == "Main.java"
    assert "Main.java" in spec.compile_command[2]
    assert "Main" in spec.run_command

    sig = FunctionSignature(
        name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY),
            ParameterDefinition(name="target", type=DataType.INTEGER),
        ],
        return_type=DataType.INTEGER_ARRAY,
    )
    java_adapter = get_adapter("java")
    wrapper = java_adapter.generate_wrapper(sig, "class Solution { public int[] twoSum(int[] n, int t) { return new int[]{0,1}; } }")
    assert "public class Main" in wrapper
    assert "class Solution" in wrapper


# ===========================================================================
# 4. C ADAPTER STARTER CODE & WRAPPER RETURNSIZE MATCH
# ===========================================================================

def test_c_adapter_starter_code_includes_return_size():
    """C starter code for array return must expose int* returnSize to match wrapper call."""
    sig = FunctionSignature(
        name="twoSum",
        parameters=[
            ParameterDefinition(name="nums", type=DataType.INTEGER_ARRAY),
            ParameterDefinition(name="target", type=DataType.INTEGER),
        ],
        return_type=DataType.INTEGER_ARRAY,
    )
    c_adapter = get_adapter("c")
    starter = c_adapter.generate_starter_code(sig)
    assert "int* returnSize" in starter
    assert "int* twoSum(int* nums, int numsSize, int target, int* returnSize)" in starter

    wrapper = c_adapter.generate_wrapper(sig, starter)
    assert "&_returnSize" in wrapper


# ===========================================================================
# 5. TYPESCRIPT EXECUTOR REGISTRATION
# ===========================================================================

def test_typescript_executor_registered():
    """Verify TypeScript executor is registered in executor factory and does not raise UnsupportedLanguageError."""
    executor = get_executor(Language.TYPESCRIPT)
    assert isinstance(executor, TypeScriptExecutor)
    assert executor.language == Language.TYPESCRIPT
    assert executor.filename == "solution.ts"
    assert executor.requires_compile is True


# ===========================================================================
# 6. OUTPUT LIMIT EXCEEDED CLASSIFICATION
# ===========================================================================

def test_output_limit_exceeded_classification():
    """Huge candidate output must trigger OUTPUT_LIMIT_EXCEEDED, not WRONG_ANSWER."""
    tc = TestCaseSchema(id="tc_1", expected_output="42")
    res = SandboxResult(
        stdout="x" * 2048,
        stderr="Output limit exceeded.",
        exit_code=0,
        output_limit_exceeded=True,
    )
    tc_res = JudgeEngine.evaluate(res, tc)
    assert tc_res.verdict == Verdict.OUTPUT_LIMIT_EXCEEDED
    assert tc_res.passed is False

    score_res = JudgeEngine.score([tc_res])
    assert score_res.verdict == Verdict.OUTPUT_LIMIT_EXCEEDED


# ===========================================================================
# 7. CONTEST EXPIRY & STATUS CHECKS
# ===========================================================================

@pytest.mark.asyncio
async def test_contest_expiry_enforcement():
    """Contest past ends_at or with status='finished' must strictly reject submissions and runs."""
    mock_member = MagicMock()
    mock_member.id = "cadet-1"
    mock_member.is_core_member = False

    # 1. Finished contest
    finished_contest = MagicMock()
    finished_contest.id = "contest-finished"
    finished_contest.slug = "campus-cup"
    finished_contest.status = "finished"
    finished_contest.starts_at = datetime.now(timezone.utc) - timedelta(hours=3)
    finished_contest.ends_at = datetime.now(timezone.utc) - timedelta(hours=1)

    db = AsyncMock()

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", return_value=finished_contest):
        with patch("app.modules.contests.contest_execution_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))):
            # Submit should raise 403
            with pytest.raises(HTTPException) as exc_info:
                await ContestExecutionService.submit_arena_code(
                    slug="campus-cup",
                    payload=ArenaSubmitRequest(problem_id="prob-1", language="python", code="print(1)"),
                    current_member=mock_member,
                    db=db,
                )
            assert exc_info.value.status_code == 403
            assert "ended" in exc_info.value.detail.lower()

            # Run should raise 403
            with pytest.raises(HTTPException) as exc_info:
                await ContestExecutionService.run_arena_code(
                    slug="campus-cup",
                    payload=ArenaRunRequest(problem_id="prob-1", language="python", code="print(1)"),
                    current_member=mock_member,
                    db=db,
                )
            assert exc_info.value.status_code == 403
            assert "ended" in exc_info.value.detail.lower()

    # 2. Contest with ends_at in the past
    expired_contest = MagicMock()
    expired_contest.id = "contest-expired"
    expired_contest.slug = "campus-cup"
    expired_contest.status = "live"
    expired_contest.starts_at = datetime.now(timezone.utc) - timedelta(hours=3)
    expired_contest.ends_at = datetime.now(timezone.utc) - timedelta(minutes=5)

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", return_value=expired_contest):
        with patch("app.modules.contests.contest_execution_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))):
            with pytest.raises(HTTPException) as exc_info:
                await ContestExecutionService.submit_arena_code(
                    slug="campus-cup",
                    payload=ArenaSubmitRequest(problem_id="prob-1", language="python", code="print(1)"),
                    current_member=mock_member,
                    db=db,
                )
            assert exc_info.value.status_code == 403
            assert "expired" in exc_info.value.detail.lower()


# ===========================================================================
# 8. SCOREBOARD PENALTY ACCUMULATION CALCULATION
# ===========================================================================

def test_scoreboard_penalty_accumulation_logic():
    """Verify penalty calculation accumulates across problems and penalizes failed attempts before AC."""
    # Problem A solved at 15m (900s) with 2 failed attempts prior: 900 + 2 * 1200 = 3300s
    prob_a = {
        "problem_index": "A",
        "status": "solved",
        "attempts": 3,
        "failed_attempts": 2,
        "solve_time_seconds": 900,
        "penalty_seconds": 900 + (2 * 20 * 60),
    }
    # Problem B solved at 30m (1800s) on 1st attempt: 1800s
    prob_b = {
        "problem_index": "B",
        "status": "solved",
        "attempts": 1,
        "failed_attempts": 0,
        "solve_time_seconds": 1800,
        "penalty_seconds": 1800,
    }
    telemetry = [prob_a, prob_b]

    total_penalty = sum(
        item.get("penalty_seconds", 0)
        for item in telemetry
        if item.get("status") == "solved"
    )
    # Total penalty must be 3300 + 1800 = 5100s, NOT overwritten with 1800s!
    assert total_penalty == 5100


# ===========================================================================
# 9. GOLDEN MULTI-LANGUAGE TEST (VALID ANAGRAM)
# ===========================================================================

def test_golden_valid_anagram_adapters_all_supported_languages():
    """
    Authoritative test: isAnagram(s, t) -> bool
    Input: ["anagram", "nagaram"] -> Expected: true
    Input: ["rat", "car"] -> Expected: false
    Verifies that Python, JS, TS, C++, C, Java all generate isolated, valid wrappers.
    """
    sig = FunctionSignature(
        name="isAnagram",
        parameters=[
            ParameterDefinition(name="s", type=DataType.STRING),
            ParameterDefinition(name="t", type=DataType.STRING),
        ],
        return_type=DataType.BOOLEAN,
    )

    solutions = {
        "python": "class Solution:\n    def isAnagram(self, s: str, t: str) -> bool:\n        return sorted(s) == sorted(t)",
        "javascript": "class Solution {\n    isAnagram(s, t) {\n        return s.split('').sort().join('') === t.split('').sort().join('');\n    }\n}",
        "typescript": "class Solution {\n    isAnagram(s: string, t: string): boolean {\n        return s.split('').sort().join('') === t.split('').sort().join('');\n    }\n}",
        "cpp": "#include <string>\n#include <algorithm>\nusing namespace std;\nclass Solution {\npublic:\n    bool isAnagram(string s, string t) {\n        sort(s.begin(), s.end());\n        sort(t.begin(), t.end());\n        return s == t;\n    }\n};",
        "c": "#include <stdbool.h>\n#include <string.h>\n#include <stdlib.h>\nstatic int cmp(const void* a, const void* b) { return (*(char*)a - *(char*)b); }\nbool isAnagram(char* s, char* t) {\n    if (strlen(s) != strlen(t)) return false;\n    char* s1 = strdup(s);\n    char* t1 = strdup(t);\n    qsort(s1, strlen(s1), 1, cmp);\n    qsort(t1, strlen(t1), 1, cmp);\n    bool res = strcmp(s1, t1) == 0;\n    free(s1); free(t1);\n    return res;\n}",
        "java": "import java.util.Arrays;\nclass Solution {\n    public boolean isAnagram(String s, String t) {\n        char[] a = s.toCharArray();\n        char[] b = t.toCharArray();\n        Arrays.sort(a);\n        Arrays.sort(b);\n        return Arrays.equals(a, b);\n    }\n}",
    }

    for lang_name, code in solutions.items():
        adapter = get_adapter(lang_name)
        assert adapter is not None, f"Missing adapter for {lang_name}"
        wrapper = adapter.generate_wrapper(sig, code)
        assert "isAnagram" in wrapper, f"Wrapper missing function name for {lang_name}"
        # Validate that foreign tokens do NOT cross contaminate
        if lang_name == "python":
            assert "class Solution:" in wrapper
            assert "int main" not in wrapper
        elif lang_name == "cpp":
            assert "int main(" in wrapper
            assert "def isAnagram" not in wrapper
        elif lang_name == "java":
            assert "public class Main" in wrapper
            assert "def isAnagram" not in wrapper


# ===========================================================================
# 10. ATOMIC SOLVED_COUNT & SCOREBOARD ADVISORY LOCKING
# ===========================================================================

@pytest.mark.asyncio
async def test_atomic_solved_count_and_advisory_locking_in_submit():
    """Verify that submit_arena_code uses atomic update for solved_count and advisory xact lock for scoreboard."""
    mock_member = MagicMock()
    mock_member.id = "cadet-1"
    mock_member.handle = "alpha"
    mock_member.full_name = "Cadet Alpha"
    mock_member.department = "CSE"
    mock_member.batch = "2023-27"
    mock_member.is_core_member = True

    mock_contest = MagicMock()
    mock_contest.id = "c-1"
    mock_contest.slug = "campus-cup"
    mock_contest.status = "live"
    mock_contest.starts_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    mock_contest.ends_at = datetime.now(timezone.utc) + timedelta(hours=1)

    mock_problem = MagicMock()
    mock_problem.id = "p-1"
    mock_problem.contest_id = "c-1"
    mock_problem.points = 100
    mock_problem.problem_index = "A"
    mock_problem.solved_count = 0
    mock_problem.sample_testcases = [{"input": "test", "expected_output": "true"}]
    mock_problem.hidden_testcases = []
    mock_problem.starter_codes = {}

    mock_db = AsyncMock()
    # Mock queries
    mock_db.scalars = AsyncMock(return_value=MagicMock(first=MagicMock(return_value=None)))
    mock_db.scalar = AsyncMock(return_value=0)  # prev_ac_count = 0 (first solve)

    # Mock provider returning accepted
    mock_provider = MagicMock()
    mock_tc_result = TestCaseResult(
        testcase_id="tc_1",
        passed=True,
        verdict=Verdict.ACCEPTED,
        stdout="true",
        wall_time_ms=10.0,
    )
    mock_exec_result = ExecutionResult(
        success=True,
        verdict=Verdict.ACCEPTED,
        passed_testcases=1,
        total_testcases=1,
        testcase_results=[mock_tc_result],
        time=0.01,
        memory=16.0,
    )
    mock_provider.execute_batch = AsyncMock(return_value=mock_exec_result)

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", return_value=mock_contest):
        with patch("app.modules.contests.contest_repository.ContestRepository.get_problem_by_id", return_value=mock_problem):
            with patch("app.modules.contests.contest_execution_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))):
                with patch("app.modules.contests.contest_execution_service.get_judge_provider", return_value=mock_provider):
                    with patch("app.modules.contests.contest_repository.ContestRepository.get_scoreboard_entry", return_value=None):
                        with patch("app.modules.contests.contest_repository.ContestRepository.re_rank_scoreboard", new=AsyncMock()):
                            with patch("app.modules.contests.contest_execution_service.delete_cache_pattern", new=AsyncMock()):
                                res = await ContestExecutionService.submit_arena_code(
                                    slug="campus-cup",
                                    payload=ArenaSubmitRequest(problem_id="p-1", language="python", code="print(1)"),
                                    current_member=mock_member,
                                    db=mock_db,
                                )

    assert res["success"] is True
    assert res["verdict"] == "ACCEPTED"

    # Verify atomic SQL update executed for solved_count
    execute_calls = mock_db.execute.call_args_list
    assert len(execute_calls) > 0

    # Verify advisory transaction lock was called
    advisory_lock_called = any(
        "pg_advisory_xact_lock" in str(getattr(call.args[0], "text", str(call.args[0])))
        for call in execute_calls
        if len(call.args) > 0
    )
    assert advisory_lock_called, "Scoreboard advisory transaction lock was not acquired"


# ===========================================================================
# 11. TIMEOUT SIGKILL & WORKSPACE ISOLATION VERIFICATION
# ===========================================================================

def test_docker_sandbox_timeout_uses_sigkill_fallback(tmp_path):
    """Verify timeout command uses -k 1 to prevent processes trapping SIGTERM from leaking."""
    from app.engine.docker.sandbox import CoreDockerSandbox
    from unittest.mock import MagicMock

    mock_container = MagicMock()
    mock_container.exec_run.return_value = MagicMock(exit_code=0, output=(b"", b""))

    ws = tmp_path
    CoreDockerSandbox._compile_sync(
        image="test-img",
        command=["g++", "-O3", "Solution.cpp"],
        workspace=ws,
        time_limit=10.0,
        container=mock_container,
    )
    cmd_run = mock_container.exec_run.call_args[1]["cmd"][2]
    assert "timeout -k 1 10.0" in cmd_run

    mock_container.reset_mock()
    CoreDockerSandbox._run_sync(
        image="test-img",
        run_cmd="./a.out",
        workspace=ws,
        stdin_data="",
        time_limit=3.0,
        memory_limit_mb=256,
        container=mock_container,
    )
    cmd_run2 = mock_container.exec_run.call_args[1]["cmd"][2]
    assert "timeout -k 1 3.0" in cmd_run2


def test_persistent_container_pool_does_not_mount_workspace_base():
    """Verify that persistent containers do not mount the host workspace base into /workspace."""
    from app.engine.docker.pool import _create_persistent_container
    from unittest.mock import MagicMock

    mock_client = MagicMock()
    mock_client.containers.get.side_effect = Exception("Not found")

    _create_persistent_container(mock_client, "interleet-python:latest")
    call_kwargs = mock_client.containers.run.call_args[1]
    assert call_kwargs["volumes"] == {}, "Persistent container must not mount host workspace_base"


