"""
Chaos Computer Club — CodeBox Execution Engine Provider
Integrates the high-performance Judge0-compatible Codebox engine (Firecracker/Docker micro-isolation).
Supports synchronous wait executions, parallel testcase runs, and token fallback.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone

from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(BASE_DIR / ".env")

import enum
from app.core.config import settings
from app.engine.admission_controller import CodeboxAdmissionController, AdmissionPool
from app.engine.circuit_breaker import CodeboxCircuitBreaker, CircuitState
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.errors import ErrorCode, JudgeExecutionException
from app.engine.judge import JudgeEngine
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from app.lib.chunking import gather_with_concurrency
from .base import JudgeProvider, ProviderCapabilities, ProviderRunRequest, ProviderRunResult


logger = logging.getLogger("ccc.judge.codebox")


class ReadinessState(str, enum.Enum):
    HEALTHY = "HEALTHY"
    READY = "READY"
    DEGRADED = "DEGRADED"
    SATURATED = "SATURATED"
    UNAVAILABLE = "UNAVAILABLE"

# CodeBox / Judge0 Language ID Mapping
CODEBOX_LANGUAGE_IDS: Dict[str, int] = {
    "python": 71,
    "python3": 71,
    "py": 71,
    "cpp": 54,
    "c++": 54,
    "c": 50,
    "java": 62,
    "javascript": 63,
    "js": 63,
    "node": 63,
    "typescript": 74,
    "ts": 74,
}

STATUS_VERDICTS: Dict[int, Verdict] = {
    3: Verdict.ACCEPTED,
    4: Verdict.WRONG_ANSWER,
    5: Verdict.TIME_LIMIT_EXCEEDED,
    6: Verdict.COMPILATION_ERROR,
    7: Verdict.RUNTIME_ERROR,
    8: Verdict.RUNTIME_ERROR,
    9: Verdict.RUNTIME_ERROR,
    10: Verdict.RUNTIME_ERROR,
    11: Verdict.RUNTIME_ERROR,
    12: Verdict.RUNTIME_ERROR,
    13: Verdict.INTERNAL_ERROR,
    14: Verdict.INTERNAL_ERROR,
}


class CodeboxProvider(JudgeProvider):
    """
    Client for Hitesh Choudhary's Codebox execution engine.
    Drop-in Judge0 API compliant with Firecracker microVM & Docker isolation.
    Hardened with admission control, circuit breakers, and queue-aware deadlines.
    """

    name = "codebox"

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            languages=list(CODEBOX_LANGUAGE_IDS.keys()),
            compile_support=True,
            sandbox_support=True,
            network_policy="disabled",
            concurrency=4,
            max_testcase_count=50,
            max_execution_duration_s=15.0,
        )

    def __init__(self) -> None:
        self.base_url = os.getenv("CODEBOX_URL", "http://127.0.0.1:3000").rstrip("/")
        self.auth_token = os.getenv("CODEBOX_TOKEN", "dev-token")
        self.poll_interval = float(os.getenv("CODEBOX_POLL_SECONDS", "0.3"))
        self.max_polls = int(os.getenv("CODEBOX_MAX_POLLS", "30"))
        # 60s default: a batch of 13 TCs through Codebox's internal worker pool can take 20-30s.
        # The old 15s default was insufficient and caused premature batch-poll timeouts.
        self.timeout = float(os.getenv("CODEBOX_TIMEOUT", "60.0"))
        # Batch API: submit all TCs in one request, eliminating the ceil(N/concurrency) latency multiplier.
        # Set CODEBOX_USE_BATCH_API=false to force per-TC fallback (e.g. if Codebox lacks /submissions/batch).
        self.use_batch_api: bool = os.getenv("CODEBOX_USE_BATCH_API", "true").lower() not in ("false", "0", "no")
        # Initial poll interval for exponential-backoff polling (catches sub-second completions fast).
        self.poll_initial_s: float = float(os.getenv("CODEBOX_POLL_INITIAL_SECONDS", "0.05"))
        self._circuit_breaker = CodeboxCircuitBreaker.get_instance()
        self._admission_controller = CodeboxAdmissionController.get_instance()

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["X-Auth-Token"] = self.auth_token
            headers["X-RapidAPI-Key"] = self.auth_token
        return headers

    async def check_readiness(self) -> dict:
        """
        Deep execution readiness probe.
        Distinguishes: HEALTHY, READY, DEGRADED, SATURATED, UNAVAILABLE.
        Accounts for: HTTP API health, Circuit Breaker state, Admission pool saturation.
        """
        cb_state = await self._circuit_breaker.get_state()
        if cb_state == CircuitState.OPEN:
            return {
                "status": ReadinessState.UNAVAILABLE.value,
                "reason": "Circuit breaker is OPEN due to repeated infrastructure faults.",
                "accepting_submissions": False,
                "circuit_state": cb_state.value,
            }

        pool_status = await self._admission_controller.get_pool_status()
        is_saturated = all(p["saturated"] for p in pool_status.values())
        if is_saturated:
            return {
                "status": ReadinessState.SATURATED.value,
                "reason": "All execution capacity pools and queues are currently saturated.",
                "accepting_submissions": False,
                "circuit_state": cb_state.value,
                "pool_status": pool_status,
            }

        # Check HTTP /ready or /health
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                if resp.status_code == 200:
                    status_enum = ReadinessState.DEGRADED if cb_state == CircuitState.HALF_OPEN else ReadinessState.READY
                    return {
                        "status": status_enum.value,
                        "reason": "Codebox service responsive and accepting executions.",
                        "accepting_submissions": True,
                        "circuit_state": cb_state.value,
                        "pool_status": pool_status,
                    }
                return {
                    "status": ReadinessState.UNAVAILABLE.value,
                    "reason": f"Codebox returned HTTP {resp.status_code}",
                    "accepting_submissions": False,
                    "circuit_state": cb_state.value,
                }
        except Exception as exc:
            return {
                "status": ReadinessState.UNAVAILABLE.value,
                "reason": f"Codebox unreachable: {exc}",
                "accepting_submissions": False,
                "circuit_state": cb_state.value,
            }

    async def healthy(self) -> bool:
        """Health check backed by deep readiness state and circuit breaker."""
        readiness = await self.check_readiness()
        return readiness["status"] in (ReadinessState.HEALTHY.value, ReadinessState.READY.value, ReadinessState.DEGRADED.value)

    def _resolve_lang_id(self, language: str | Language) -> Optional[int]:
        if isinstance(language, Language):
            key = language.value.lower()
        else:
            key = str(language).lower()
        return CODEBOX_LANGUAGE_IDS.get(key)

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        """Run single code request against CodeBox."""
        lang_id = self._resolve_lang_id(request.language)
        if lang_id is None:
            return ProviderRunResult(
                verdict="internal_error",
                diagnostics=[f"Codebox does not support language: {request.language}"],
            )

        # Codebox Joi validation schema caps maxMemoryLimit to 512000 KB and maxCpuTimeLimit to 15.0s.
        # Clamp inputs defensively to prevent HTTP 422 Unprocessable Entity errors on higher problem specs.
        safe_mem_kb = min(int(request.memory_limit_mb * 1024), 512000)
        safe_cpu_sec = min(max(0.5, float(request.time_limit_seconds)), 15.0)

        payload = {
            "language_id": lang_id,
            "source_code": request.source_code,
            "stdin": request.stdin or "",
            "expected_output": request.expected_output or "",
            "cpu_time_limit": safe_cpu_sec,
            "memory_limit": safe_mem_kb,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # CodeBox supports wait=true for synchronous response
                url = f"{self.base_url}/submissions?base64_encoded=false&wait=true"
                resp = await client.post(url, json=payload, headers=self._headers())
                resp.raise_for_status()
                data = resp.json()

                # If wait=true returned token instead of completed execution, poll it
                token = data.get("token")
                status_id = int((data.get("status") or {}).get("id", 0))
                if status_id < 3 and token:
                    for _ in range(self.max_polls):
                        await asyncio.sleep(self.poll_interval)
                        poll_resp = await client.get(
                            f"{self.base_url}/submissions/{token}?base64_encoded=false",
                            headers=self._headers(),
                        )
                        poll_resp.raise_for_status()
                        data = poll_resp.json()
                        status_id = int((data.get("status") or {}).get("id", 0))
                        if status_id >= 3:
                            break
                    else:
                        return ProviderRunResult(verdict="time_limit_exceeded", timed_out=True)

        except Exception as exc:
            err_msg = str(exc)
            if isinstance(exc, httpx.HTTPStatusError):
                try:
                    err_json = exc.response.json()
                    err_msg = err_json.get("message") or err_json.get("error") or str(exc)
                except Exception:
                    if exc.response.text:
                        err_msg = exc.response.text[:200]
            logger.warning("Codebox run failed (%s)", err_msg)
            return ProviderRunResult(verdict="internal_error", diagnostics=[err_msg])

        status_id = int((data.get("status") or {}).get("id", 0))
        verdict = STATUS_VERDICTS.get(status_id, Verdict.RUNTIME_ERROR).value.lower()
        stdout = data.get("stdout") or ""
        stderr = data.get("stderr") or ""
        compile_out = data.get("compile_output") or ""
        status_desc = (data.get("status") or {}).get("description") or ""

        if status_id == 6:
            if not compile_out:
                compile_out = stderr or status_desc or "Compilation error"
            if not stderr:
                stderr = compile_out
        elif status_id in {7, 8, 9, 10, 11, 12}:
            if not stderr:
                stderr = compile_out or status_desc or "Runtime error"

        time_sec = float(data.get("time") or 0.0)
        mem_kb = int(data.get("memory") or 0)

        passed = (status_id == 3)
        if not passed and request.expected_output:
            # Recheck comparison in case of formatting nuances
            passed = stdout.strip() == request.expected_output.strip()
            if passed:
                verdict = "accepted"

        return ProviderRunResult(
            stdout=stdout,
            stderr=stderr,
            compile_output=compile_out,
            exit_code=int(data.get("exit_code") or 0),
            time_ms=int(time_sec * 1000),
            memory_kb=mem_kb,
            timed_out=(status_id == 5),
            passed=passed,
            verdict=verdict,
        )

    async def _execute_batch_api(
        self,
        client: httpx.AsyncClient,
        lang_id: int,
        code: str,
        testcases: list[TestCaseSchema],
        time_limit: float,
        memory_limit_mb: int,
        comparison_mode: ComparisonMode,
        poll_budget_s: float = 0.0,
    ) -> list[TestCaseResult]:
        """
        Submit all testcases in ONE batch request to the Judge0-compatible /submissions/batch endpoint.

        This eliminates the ceil(N/concurrency) × per_TC_latency wall-time multiplier that arises when
        each testcase is submitted as a separate HTTP request with individual polling loops.
        Instead, Codebox handles all N submissions internally with its own worker pool, and we poll
        a single /submissions/batch endpoint until all are complete.

        Expected improvement for N=13, concurrency=4:
          Before: ceil(13/4) * ~7s = ~23s
          After:  max(TC wall times) ≈ ~7s  (3× speedup)

        Raises:
            httpx.HTTPStatusError: if /submissions/batch returns 404, caller falls back to per-TC.
        """
        safe_mem_kb = min(int(memory_limit_mb * 1024), 512000)
        safe_cpu_sec = min(max(0.5, float(time_limit)), 15.0)

        submissions = [
            {
                "language_id": lang_id,
                "source_code": code,
                "stdin": tc.stdin or "",
                "expected_output": tc.expected_output or "",
                "cpu_time_limit": safe_cpu_sec,
                "memory_limit": safe_mem_kb,
            }
            for tc in testcases
        ]

        # --- Stage 1: Batch Submit ---
        t_submit_start = time.perf_counter()
        resp = await client.post(
            f"{self.base_url}/submissions/batch?base64_encoded=false",
            json={"submissions": submissions},
            headers=self._headers(),
        )
        resp.raise_for_status()  # 404 → caller falls back to per-TC
        t_submit_done = time.perf_counter()
        submit_ms = (t_submit_done - t_submit_start) * 1000.0

        batch_resp = resp.json()
        tokens: list[str] = [
            item["token"] for item in (batch_resp if isinstance(batch_resp, list) else batch_resp.get("submissions", []))
        ]
        if not tokens:
            raise ValueError(f"Codebox batch API returned no tokens: {batch_resp!r}")

        logger.debug(
            "[Codebox|batch] %d TCs submitted in %.0fms → tokens: %s",
            len(testcases),
            submit_ms,
            tokens,
        )

        # --- Stage 2: Poll Until All Complete (exponential backoff) ---
        tokens_csv = ",".join(tokens)
        # Use the passed poll_budget_s (= httpx timeout_budget) as the authoritative deadline.
        # Fallback: max_polls * poll_interval for backwards compat if called without poll_budget_s.
        # CRITICAL FIX: the old code used 30 * 0.3 = 9.0s which caused all TCs to time out on
        # batches of 13 where Codebox needs 10-25s to process through its internal worker pool.
        max_total_wait_s = poll_budget_s if poll_budget_s > 0 else self.max_polls * self.poll_interval
        poll_interval = self.poll_initial_s  # start fast (default 50ms)
        t_poll_start = time.perf_counter()
        results_data: list[Optional[Dict[str, Any]]] = [None] * len(tokens)
        pending_indices = list(range(len(tokens)))
        poll_count = 0

        while pending_indices and (time.perf_counter() - t_poll_start) < max_total_wait_s:
            await asyncio.sleep(poll_interval)
            poll_interval = min(poll_interval * 1.5, self.poll_interval)  # exponential backoff up to max
            poll_count += 1

            poll_resp = await client.get(
                f"{self.base_url}/submissions/batch?tokens={tokens_csv}&base64_encoded=false",
                headers=self._headers(),
            )
            poll_resp.raise_for_status()
            poll_payload = poll_resp.json()
            batch_results = poll_payload if isinstance(poll_payload, list) else poll_payload.get("submissions", [])

            still_pending: list[int] = []
            for idx in pending_indices:
                if idx >= len(batch_results):
                    still_pending.append(idx)
                    continue
                d = batch_results[idx]
                status_id = int((d.get("status") or {}).get("id", 0))
                if status_id >= 3:
                    results_data[idx] = d
                else:
                    still_pending.append(idx)
            pending_indices = still_pending

        poll_wall_ms = (time.perf_counter() - t_poll_start) * 1000.0
        logger.debug(
            "[Codebox|batch] poll complete: %d/%d resolved in %.0fms (%d polls, final_interval=%.0fms)",
            len(tokens) - len(pending_indices),
            len(tokens),
            poll_wall_ms,
            poll_count,
            poll_interval * 1000,
        )

        # --- Stage 3: Normalise results (mirrors _execute_single_tc logic) ---
        t_norm_start = time.perf_counter()
        batch_turnaround_ms = (t_norm_start - t_submit_start) * 1000.0
        tc_results: list[TestCaseResult] = []
        for i, (tc, data) in enumerate(zip(testcases, results_data)):
            if data is None:
                # Timed out waiting for this TC
                tc_results.append(TestCaseResult(
                    testcase_id=tc.id,
                    name=tc.name,
                    hidden=bool(tc.hidden),
                    category=getattr(tc.category, "value", None) if tc.category else None,
                    stdout="",
                    expected_output="" if tc.hidden else (tc.expected_output or ""),
                    stderr="Batch polling timed out before this testcase completed.",
                    compile_output="",
                    wall_time_ms=round(batch_turnaround_ms, 2),
                    runtime_ms=0.0,
                    cpu_time_ms=0.0,
                    peak_memory_mb=0.0,
                    exit_code=1,
                    weight=tc.weight,
                    passed=False,
                    verdict=Verdict.INTERNAL_ERROR,
                    wall_time_fallback=True,
                ))
                continue

            # Preserves actual Codebox wall_time when reported, avoiding batch turnaround contamination
            raw_wall = data.get("wall_time")
            is_fallback_wall = False
            if raw_wall is not None:
                try:
                    tc_wall_ms = float(raw_wall) * 1000.0
                except (ValueError, TypeError):
                    tc_wall_ms = batch_turnaround_ms
                    is_fallback_wall = True
            else:
                tc_wall_ms = batch_turnaround_ms
                is_fallback_wall = True

            status_id = int((data.get("status") or {}).get("id", 0))
            raw_verdict = STATUS_VERDICTS.get(status_id, Verdict.RUNTIME_ERROR)
            stdout = data.get("stdout") or ""
            stderr = data.get("stderr") or ""
            compile_out = data.get("compile_output") or ""
            status_desc = (data.get("status") or {}).get("description") or ""
            cpu_time_sec = float(data.get("time") or 0.0)
            cpu_time_ms = cpu_time_sec * 1000.0
            mem_kb = float(data.get("memory") or 0.0)
            mem_mb = mem_kb / 1024.0

            passed = False
            final_verdict = raw_verdict

            if status_id == 6:
                final_verdict = Verdict.COMPILATION_ERROR
                if not compile_out:
                    compile_out = stderr or status_desc or "Compilation error"
                if not stderr:
                    stderr = compile_out
            elif status_id == 5:
                final_verdict = Verdict.TIME_LIMIT_EXCEEDED
                if not stderr:
                    stderr = "Time Limit Exceeded"
            elif status_id in {7, 8, 9, 10, 11, 12}:
                final_verdict = Verdict.RUNTIME_ERROR
                if not stderr:
                    stderr = compile_out or status_desc or "Runtime error"
            env, user_out = JudgeEngine.parse_runner_envelope(stdout)
            display_out = user_out if env is not None else stdout
            if env is not None:
                if env.get("status") in ("RUNTIME_ERROR", "FUNCTION_NOT_FOUND"):
                    final_verdict = Verdict.RUNTIME_ERROR
                    if env.get("error"):
                        stderr = (stderr + "\n" if stderr else "") + str(env["error"])
                elif env.get("status") == "SUCCESS":
                    ret_val = env.get("return_value")
                    if isinstance(ret_val, bool):
                        actual_cmp_str = "true" if ret_val else "false"
                    elif ret_val is None:
                        actual_cmp_str = "null"
                    elif isinstance(ret_val, (list, dict)):
                        actual_cmp_str = json.dumps(ret_val, ensure_ascii=False)
                    elif isinstance(ret_val, (int, float)):
                        actual_cmp_str = str(ret_val)
                    elif isinstance(ret_val, str):
                        actual_cmp_str = ret_val
                    else:
                        actual_cmp_str = str(ret_val)

                    passed = JudgeEngine.compare(
                        actual=actual_cmp_str,
                        expected=tc.expected_output or "",
                        mode=tc.comparison_mode or comparison_mode,
                    )
                    final_verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER
            elif status_id == 3 or raw_verdict == Verdict.ACCEPTED or status_id == 4 or raw_verdict == Verdict.WRONG_ANSWER:
                passed = JudgeEngine.compare(
                    actual=stdout,
                    expected=tc.expected_output or "",
                    mode=tc.comparison_mode or comparison_mode,
                )
                final_verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER

            tc_results.append(TestCaseResult(
                testcase_id=tc.id,
                name=tc.name,
                hidden=bool(tc.hidden),
                category=getattr(tc.category, "value", None) if tc.category else None,
                stdout=display_out,
                expected_output=tc.expected_output or "",
                stderr=stderr,
                compile_output=compile_out,
                wall_time_ms=round(tc_wall_ms, 2),
                runtime_ms=round(cpu_time_ms, 2),
                cpu_time_ms=round(cpu_time_ms, 2),
                peak_memory_mb=mem_mb,
                exit_code=int(data.get("exit_code") or 0),
                weight=tc.weight,
                passed=passed,
                verdict=final_verdict,
                wall_time_fallback=is_fallback_wall,
            ))

        t_norm_end = time.perf_counter()
        norm_ms = (t_norm_end - t_norm_start) * 1000.0
        self._last_batch_norm_ms = norm_ms
        self._last_batch_meta = {
            "provider_submit_start": t_submit_start,
            "provider_submit_end": t_submit_done,
            "provider_submit_ms": round(submit_ms, 2),
            "provider_poll_start": t_poll_start,
            "provider_poll_end": t_poll_start + (poll_wall_ms / 1000.0),
            "provider_poll_count": poll_count,
            "provider_turnaround_ms": round(batch_turnaround_ms, 2),
            "batch_result_normalization_ms": round(norm_ms, 2),
        }
        return tc_results

    async def _execute_single_tc(
        self,
        client: httpx.AsyncClient,
        lang_id: int,
        code: str,
        tc: TestCaseSchema,
        time_limit: float,
        memory_limit_mb: int,
        comparison_mode: ComparisonMode,
    ) -> TestCaseResult:
        """Execute one testcase concurrently against Codebox with fallback polling."""
        # Codebox Joi validation schema caps maxMemoryLimit to 512000 KB and maxCpuTimeLimit to 15.0s.
        # Clamp inputs defensively to prevent HTTP 422 Unprocessable Entity errors on higher problem specs.
        safe_mem_kb = min(int(memory_limit_mb * 1024), 512000)
        safe_cpu_sec = min(max(0.5, float(time_limit)), 15.0)

        payload = {
            "language_id": lang_id,
            "source_code": code,
            "stdin": tc.stdin or "",
            "expected_output": tc.expected_output or "",
            "cpu_time_limit": safe_cpu_sec,
            "memory_limit": safe_mem_kb,
        }

        t0 = time.perf_counter()
        data: Dict[str, Any] = {}
        try:
            url = f"{self.base_url}/submissions?base64_encoded=false&wait=true"
            t_submit = time.perf_counter()
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
            t_submit_done = time.perf_counter()

            token = data.get("token")
            status_id = int((data.get("status") or {}).get("id", 0))
            if status_id < 3 and token:
                # wait=true was not honored — fall into exponential-backoff polling
                logger.debug(
                    "[Codebox|tc] wait=true returned status_id=%d (pending) for token=%s; polling (submit_ms=%.0f)",
                    status_id,
                    token,
                    (t_submit_done - t_submit) * 1000,
                )
                poll_interval = self.poll_initial_s
                for poll_num in range(self.max_polls):
                    await asyncio.sleep(poll_interval)
                    poll_interval = min(poll_interval * 1.5, self.poll_interval)  # exponential backoff
                    poll_resp = await client.get(
                        f"{self.base_url}/submissions/{token}?base64_encoded=false",
                        headers=self._headers(),
                    )
                    poll_resp.raise_for_status()
                    data = poll_resp.json()
                    status_id = int((data.get("status") or {}).get("id", 0))
                    if status_id >= 3:
                        logger.debug(
                            "[Codebox|tc] token=%s resolved status_id=%d after %d polls (%.0fms elapsed)",
                            token, status_id, poll_num + 1, (time.perf_counter() - t0) * 1000,
                        )
                        break
        except Exception as exc:
            tc_wall_ms = (time.perf_counter() - t0) * 1000.0
            err_msg = str(exc)
            if isinstance(exc, httpx.HTTPStatusError):
                try:
                    err_json = exc.response.json()
                    err_msg = err_json.get("message") or err_json.get("error") or str(exc)
                except Exception:
                    if exc.response.text:
                        err_msg = exc.response.text[:200]
            logger.warning("Codebox testcase execution error: %s", err_msg)
            return TestCaseResult(
                testcase_id=tc.id,
                name=tc.name,
                hidden=bool(tc.hidden),
                category=getattr(tc.category, "value", None) if tc.category else None,
                stdout="",
                expected_output="" if tc.hidden else (tc.expected_output or ""),
                stderr=err_msg,
                compile_output="",
                wall_time_ms=round(tc_wall_ms, 2),
                runtime_ms=0.0,
                cpu_time_ms=0.0,
                peak_memory_mb=0.0,
                exit_code=1,
                weight=tc.weight,
                passed=False,
                verdict=Verdict.INTERNAL_ERROR,
            )

        tc_turnaround_ms = (time.perf_counter() - t0) * 1000.0
        raw_wall = data.get("wall_time")
        is_fallback_wall = False
        if raw_wall is not None:
            try:
                tc_wall_ms = float(raw_wall) * 1000.0
            except (ValueError, TypeError):
                tc_wall_ms = tc_turnaround_ms
                is_fallback_wall = True
        else:
            tc_wall_ms = tc_turnaround_ms
            is_fallback_wall = True

        status_id = int((data.get("status") or {}).get("id", 0))
        raw_verdict = STATUS_VERDICTS.get(status_id, Verdict.RUNTIME_ERROR)
        stdout = data.get("stdout") or ""
        stderr = data.get("stderr") or ""
        compile_out = data.get("compile_output") or ""
        status_desc = (data.get("status") or {}).get("description") or ""
        # data["time"] represents isolate/process CPU runtime in seconds, NOT turnaround wall-clock time
        cpu_time_sec = float(data.get("time") or 0.0)
        cpu_time_ms = cpu_time_sec * 1000.0
        mem_kb = float(data.get("memory") or 0.0)
        mem_mb = mem_kb / 1024.0

        # Perform rigorous comparison
        passed = False
        final_verdict = raw_verdict

        if status_id == 6:
            final_verdict = Verdict.COMPILATION_ERROR
            if not compile_out:
                compile_out = stderr or status_desc or "Compilation error"
            if not stderr:
                stderr = compile_out
        elif status_id == 5:
            final_verdict = Verdict.TIME_LIMIT_EXCEEDED
            if not stderr:
                stderr = "Time Limit Exceeded"
        elif status_id in {7, 8, 9, 10, 11, 12}:
            final_verdict = Verdict.RUNTIME_ERROR
            if not stderr:
                stderr = compile_out or status_desc or "Runtime error"
        env, user_out = JudgeEngine.parse_runner_envelope(stdout)
        display_out = user_out if env is not None else stdout
        if env is not None:
            if env.get("status") in ("RUNTIME_ERROR", "FUNCTION_NOT_FOUND"):
                final_verdict = Verdict.RUNTIME_ERROR
                if env.get("error"):
                    stderr = (stderr + "\n" if stderr else "") + str(env["error"])
            elif env.get("status") == "SUCCESS":
                ret_val = env.get("return_value")
                if isinstance(ret_val, bool):
                    actual_cmp_str = "true" if ret_val else "false"
                elif ret_val is None:
                    actual_cmp_str = "null"
                elif isinstance(ret_val, (list, dict)):
                    actual_cmp_str = json.dumps(ret_val, ensure_ascii=False)
                elif isinstance(ret_val, (int, float)):
                    actual_cmp_str = str(ret_val)
                elif isinstance(ret_val, str):
                    actual_cmp_str = ret_val
                else:
                    actual_cmp_str = str(ret_val)

                passed = JudgeEngine.compare(
                    actual=actual_cmp_str,
                    expected=tc.expected_output or "",
                    mode=tc.comparison_mode or comparison_mode,
                )
                final_verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER
        elif status_id == 3 or raw_verdict == Verdict.ACCEPTED or status_id == 4 or raw_verdict == Verdict.WRONG_ANSWER:
            passed = JudgeEngine.compare(
                actual=stdout,
                expected=tc.expected_output or "",
                mode=tc.comparison_mode or comparison_mode,
            )
            final_verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER

        return TestCaseResult(
            testcase_id=tc.id,
            name=tc.name,
            hidden=bool(tc.hidden),
            category=getattr(tc.category, "value", None) if tc.category else None,
            stdout=display_out,
            expected_output=tc.expected_output or "",
            stderr=stderr,
            compile_output=compile_out,
            wall_time_ms=round(tc_wall_ms, 2),  # Actual measured testcase execution wall-clock time
            runtime_ms=round(cpu_time_ms, 2),   # CPU / sandbox process runtime
            cpu_time_ms=round(cpu_time_ms, 2),  # Explicit sandbox CPU runtime
            peak_memory_mb=mem_mb,
            exit_code=int(data.get("exit_code") or 0),
            weight=tc.weight,
            passed=passed,
            verdict=final_verdict,
            wall_time_fallback=is_fallback_wall,
        )


    async def execute_batch(
        self,
        language: str | Language,
        code: str,
        testcases: list[TestCaseSchema],
        time_limit: float = 5.0,
        memory_limit_mb: int = 256,
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
        admission_pool: str = AdmissionPool.FALLBACK,
        deadline_tracker: Optional[ExecutionDeadlineTracker] = None,
    ) -> ExecutionResult:
        """
        Execute full suite of testcases concurrently against Codebox engine.
        Protected by distributed admission control, circuit breaker, and dominant deadlines.
        """
        lang_id = self._resolve_lang_id(language)
        submission_id = str(uuid4())

        # 0. Dominant deadline gate (Phase 11: Fail fast if submission budget expired)
        timeout_budget = self.timeout

        if deadline_tracker is not None:
            if deadline_tracker.is_expired():
                return ExecutionResult(
                    success=False,
                    submission_id=submission_id,
                    status=ExecutionStatus.FAILED,
                    verdict=Verdict.SYSTEM_ERROR,
                    error=f"[{ErrorCode.EXECUTION_DEADLINE_EXCEEDED.value}] Execution deadline exceeded before provider invocation.",
                    total_testcases=len(testcases),
                )
            try:
                timeout_budget = deadline_tracker.stage_budget(self.timeout)
            except Exception as d_err:
                return ExecutionResult(
                    success=False,
                    submission_id=submission_id,
                    status=ExecutionStatus.FAILED,
                    verdict=Verdict.SYSTEM_ERROR,
                    error=f"[{ErrorCode.EXECUTION_DEADLINE_EXCEEDED.value}] {d_err}",
                    total_testcases=len(testcases),
                )

        # 1. Circuit breaker gate
        if not await self._circuit_breaker.can_execute():

            if settings.ALLOW_UNSANDBOXED_EXECUTION:
                logger.warning("🛑 [Codebox] Circuit breaker is OPEN. Falling back to local execution (ALLOW_UNSANDBOXED_EXECUTION=True).")
                from app.engine.executors.factory import get_executor
                lang_enum = language if isinstance(language, Language) else Language(language)
                return await get_executor(lang_enum).execute_batch(
                    code=code,
                    testcases=testcases,
                    time_limit=time_limit,
                    memory_limit_mb=memory_limit_mb,
                    comparison_mode=comparison_mode,
                )
            logger.warning("🛑 [Codebox] Circuit breaker is OPEN. Fast-failing Codebox request.")
            return ExecutionResult(
                success=False,
                submission_id=submission_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error=f"[{ErrorCode.CODEBOX_UNAVAILABLE.value}] CRITICAL INFRASTRUCTURE FAILURE: Codebox execution engine circuit is currently OPEN due to repeated faults.",
                total_testcases=len(testcases),
            )

        # 2. Check health/readiness
        if not await self.healthy():
            if not settings.ALLOW_UNSANDBOXED_EXECUTION:
                await self._circuit_breaker.record_failure(is_infrastructure=True, reason="Health probe failed")
                logger.error("Codebox engine is unreachable and ALLOW_UNSANDBOXED_EXECUTION is False. Failing closed with SYSTEM_ERROR.")
                return ExecutionResult(
                    success=False,
                    submission_id=submission_id,
                    status=ExecutionStatus.FAILED,
                    verdict=Verdict.SYSTEM_ERROR,
                    error=f"[{ErrorCode.CODEBOX_UNAVAILABLE.value}] CRITICAL INFRASTRUCTURE FAILURE: Codebox execution engine is unreachable.",
                    total_testcases=len(testcases),
                )
            logger.warning("Codebox engine unreachable at %s; falling back to local sandbox (ALLOW_UNSANDBOXED_EXECUTION=True).", self.base_url)
            from app.engine.executors.factory import get_executor
            lang_enum = language if isinstance(language, Language) else Language(language)
            return await get_executor(lang_enum).execute_batch(
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
            )

        if lang_id is None:
            return ExecutionResult(
                success=False,
                submission_id=submission_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.INTERNAL_ERROR,
                error=f"Unsupported language: {language}",
                total_testcases=len(testcases),
            )

        # 3. Calculate dynamic stage budget from dominant deadline
        timeout_budget = self.timeout
        if deadline_tracker is not None:
            try:
                timeout_budget = deadline_tracker.stage_budget(self.timeout)
            except Exception as d_err:
                return ExecutionResult(
                    success=False,
                    submission_id=submission_id,
                    status=ExecutionStatus.FAILED,
                    verdict=Verdict.SYSTEM_ERROR,
                    error=f"[{ErrorCode.EXECUTION_DEADLINE_EXCEEDED.value}] {d_err}",
                    total_testcases=len(testcases),
                )

        # 4. Acquire permit from bounded admission pool
        batch_start = time.perf_counter()
        try:
            async with self._admission_controller.acquire_permit(pool=admission_pool, wait_timeout_s=min(5.0, timeout_budget)):
                limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
                async with httpx.AsyncClient(timeout=timeout_budget, limits=limits) as client:
                    # --- Batch API path (preferred): submit all TCs in one request ---
                    # Eliminates ceil(N/concurrency) × per_TC_latency multiplier.
                    # Falls back to per-TC concurrent if batch endpoint returns 404.
                    if self.use_batch_api:
                        try:
                            t_batch = time.perf_counter()
                            logger.debug(
                                "[Codebox] Attempting batch API for %d testcases (CODEBOX_USE_BATCH_API=true, poll_budget=%.1fs)",
                                len(testcases),
                                timeout_budget,
                            )
                            results: list[TestCaseResult] = await self._execute_batch_api(
                                client=client,
                                lang_id=lang_id,
                                code=code,
                                testcases=testcases,
                                time_limit=time_limit,
                                memory_limit_mb=memory_limit_mb,
                                comparison_mode=comparison_mode,
                                poll_budget_s=timeout_budget,  # FIX: pass real budget, not max_polls*poll_interval
                            )
                            resolved = sum(1 for r in results if r.verdict != Verdict.INTERNAL_ERROR)
                            logger.info(
                                "[Codebox] batch API resolved %d/%d TCs in %.0fms",
                                resolved,
                                len(testcases),
                                (time.perf_counter() - t_batch) * 1000,
                            )
                        except (httpx.HTTPStatusError, ValueError) as batch_err:
                            # ValueError: batch response malformed (no tokens) = batch not supported.
                            # HTTPStatusError 404: endpoint does not exist.
                            # Both signal "fall back to per-TC"; any other HTTPStatusError re-raises.
                            is_not_supported = isinstance(batch_err, ValueError) or (
                                isinstance(batch_err, httpx.HTTPStatusError)
                                and batch_err.response.status_code == 404
                            )
                            if is_not_supported:
                                logger.warning(
                                    "[Codebox] batch API not supported (%s) — "
                                    "disabling for this instance and falling back to per-TC concurrent.",
                                    type(batch_err).__name__,
                                )
                                self.use_batch_api = False  # disable for lifetime of this instance
                                tasks = [
                                    self._execute_single_tc(
                                        client=client,
                                        lang_id=lang_id,
                                        code=code,
                                        tc=tc,
                                        time_limit=time_limit,
                                        memory_limit_mb=memory_limit_mb,
                                        comparison_mode=comparison_mode,
                                    )
                                    for tc in testcases
                                ]
                                results = await gather_with_concurrency(4, *tasks)
                            else:
                                raise
                    else:
                        # Per-TC concurrent path (fallback or explicitly disabled)
                        tasks = [
                            self._execute_single_tc(
                                client=client,
                                lang_id=lang_id,
                                code=code,
                                tc=tc,
                                time_limit=time_limit,
                                memory_limit_mb=memory_limit_mb,
                                comparison_mode=comparison_mode,
                            )
                            for tc in testcases
                        ]
                        # Concurrency bounded to 4 to match container worker slot limits
                        results = await gather_with_concurrency(4, *tasks)
        except JudgeExecutionException as j_exc:
            batch_wall_ms = (time.perf_counter() - batch_start) * 1000.0
            return ExecutionResult(
                success=False,
                submission_id=submission_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error=f"[{j_exc.error_code.value}] {j_exc.safe_message}",
                total_testcases=len(testcases),
                execution_wall_ms=round(batch_wall_ms, 2),
                provider_turnaround_ms=round(batch_wall_ms, 2),
                total_time_ms=round(batch_wall_ms, 2),
            )
        except Exception as exc:
            batch_wall_ms = (time.perf_counter() - batch_start) * 1000.0
            err_str = str(exc)
            is_infra = any(k in err_str.lower() for k in ("connect", "timeout", "503", "refused"))
            await self._circuit_breaker.record_failure(is_infrastructure=is_infra, reason=err_str)
            return ExecutionResult(
                success=False,
                submission_id=submission_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error=f"[{ErrorCode.INFRASTRUCTURE_FAILURE.value}] Execution failed: {err_str[:200]}",
                total_testcases=len(testcases),
                execution_wall_ms=round(batch_wall_ms, 2),
                provider_turnaround_ms=round(batch_wall_ms, 2),
                total_time_ms=round(batch_wall_ms, 2),
            )

        batch_wall_ms = (time.perf_counter() - batch_start) * 1000.0

        # 5. Evaluate infrastructure success vs failure
        # CRITICAL FIX: also count batch poll timeouts (data=None → "Batch polling timed out") as
        # infrastructure failures. The old filter only matched "503/connect" so batch-timeout results
        # were incorrectly counted as successes, masking the timeout issue from the circuit breaker.
        infra_failures = [
            r for r in results
            if r.verdict == Verdict.INTERNAL_ERROR and (
                "503" in r.stderr
                or "connect" in r.stderr.lower()
                or "timed out" in r.stderr.lower()
                or "timeout" in r.stderr.lower()
            )
        ]
        if infra_failures:
            await self._circuit_breaker.record_failure(is_infrastructure=True, reason=infra_failures[0].stderr)
        else:
            await self._circuit_breaker.record_success()

        passed_count = sum(1 for r in results if r.passed)
        total_count = len(results)
        total_cpu_time_ms = sum((r.runtime_ms or 0.0) for r in results)
        max_cpu_time = max(((r.runtime_ms or 0.0) for r in results), default=0.0)
        max_mem = max((r.peak_memory_mb for r in results), default=0.0)

        # Primary compile output if any
        compile_out = next((r.compile_output for r in results if r.compile_output), "")
        first_stderr = next((r.stderr for r in results if r.stderr), "")
        first_stdout = results[0].stdout if results else ""

        # Determine overall verdict
        if any(r.verdict == Verdict.COMPILATION_ERROR for r in results):
            top_verdict = Verdict.COMPILATION_ERROR
            if not compile_out and first_stderr:
                compile_out = first_stderr
            if not first_stderr and compile_out:
                first_stderr = compile_out
        elif any(r.verdict == Verdict.TIME_LIMIT_EXCEEDED for r in results):
            top_verdict = Verdict.TIME_LIMIT_EXCEEDED
            if not first_stderr:
                first_stderr = "Time Limit Exceeded"
        elif any(r.verdict == Verdict.RUNTIME_ERROR for r in results):
            top_verdict = Verdict.RUNTIME_ERROR
            if not first_stderr and compile_out:
                first_stderr = compile_out
        elif any(r.verdict == Verdict.WRONG_ANSWER for r in results):
            top_verdict = Verdict.WRONG_ANSWER
        elif all(r.verdict == Verdict.ACCEPTED for r in results) and total_count > 0:
            top_verdict = Verdict.ACCEPTED
        else:
            top_verdict = Verdict.INTERNAL_ERROR

        score = (passed_count / max(1, total_count)) * 100.0

        batch_meta = getattr(self, "_last_batch_meta", None)
        norm_ms = float(batch_meta.get("batch_result_normalization_ms", 0.0)) if batch_meta else 0.0

        exec_res = ExecutionResult(
            success=passed_count == total_count,
            submission_id=submission_id,
            status=ExecutionStatus.COMPLETED,
            verdict=top_verdict,
            stdout=first_stdout,
            stderr=first_stderr,
            compile_output=compile_out,
            memory=max_mem,
            time=round(max_cpu_time / 1000.0, 3),  # Max single testcase CPU runtime in seconds
            exit_code=0 if top_verdict == Verdict.ACCEPTED else 1,
            testcase_results=results,
            passed_testcases=passed_count,
            total_testcases=total_count,
            score=score,
            compile_time_ms=0.0,
            execution_time_ms=round(batch_wall_ms, 2),
            total_time_ms=round(batch_wall_ms, 2),
            execution_cpu_ms=round(total_cpu_time_ms, 2),
            execution_wall_ms=round(batch_wall_ms, 2),
            provider_turnaround_ms=round(batch_wall_ms, 2),
            result_normalization_ms=round(norm_ms, 2),
            completed_at=datetime.now(timezone.utc),
        )
        if batch_meta:
            exec_res.telemetry.update(batch_meta)
            for k in ("provider_submit_ms", "provider_turnaround_ms", "batch_result_normalization_ms"):
                if k in batch_meta:
                    exec_res.latencies[k] = batch_meta[k]
        return exec_res

