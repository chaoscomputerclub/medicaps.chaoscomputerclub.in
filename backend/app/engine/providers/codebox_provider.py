"""
Chaos Computer Club — CodeBox Execution Engine Provider
Integrates the high-performance Judge0-compatible Codebox engine (Firecracker/Docker micro-isolation).
Supports synchronous wait executions, parallel testcase runs, and token fallback.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(BASE_DIR / ".env")

from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.judge import JudgeEngine
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from app.lib.chunking import gather_with_concurrency
from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult


logger = logging.getLogger("ccc.judge.codebox")

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
    """

    name = "codebox"

    def __init__(self) -> None:
        self.base_url = os.getenv("CODEBOX_URL", "http://127.0.0.1:3000").rstrip("/")
        self.auth_token = os.getenv("CODEBOX_TOKEN", "dev-token")
        self.poll_interval = float(os.getenv("CODEBOX_POLL_SECONDS", "0.3"))
        self.max_polls = int(os.getenv("CODEBOX_MAX_POLLS", "30"))
        self.timeout = float(os.getenv("CODEBOX_TIMEOUT", "15.0"))

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["X-Auth-Token"] = self.auth_token
            headers["X-RapidAPI-Key"] = self.auth_token
        return headers

    async def healthy(self) -> bool:
        """Probe Codebox health endpoint without needing auth."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                if resp.status_code == 200:
                    return True
                # Fallback to /about
                about_resp = await client.get(f"{self.base_url}/about", headers=self._headers())
                return about_resp.status_code < 400
        except Exception:
            return False

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

        payload = {
            "language_id": lang_id,
            "source_code": request.source_code,
            "stdin": request.stdin or "",
            "expected_output": request.expected_output or "",
            "cpu_time_limit": max(0.5, float(request.time_limit_seconds)),
            "memory_limit": int(request.memory_limit_mb * 1024),
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
            logger.warning("Codebox run failed (%s)", exc)
            return ProviderRunResult(verdict="internal_error", diagnostics=[str(exc)])

        status_id = int((data.get("status") or {}).get("id", 0))
        verdict = STATUS_VERDICTS.get(status_id, Verdict.RUNTIME_ERROR).value.lower()
        stdout = data.get("stdout") or ""
        stderr = data.get("stderr") or ""
        compile_out = data.get("compile_output") or ""
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
        payload = {
            "language_id": lang_id,
            "source_code": code,
            "stdin": tc.stdin or "",
            "expected_output": tc.expected_output or "",
            "cpu_time_limit": max(0.5, float(time_limit)),
            "memory_limit": int(memory_limit_mb * 1024),
        }

        data: Dict[str, Any] = {}
        try:
            url = f"{self.base_url}/submissions?base64_encoded=false&wait=true"
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

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
        except Exception as exc:
            logger.warning("Codebox testcase execution error: %s", exc)
            return TestCaseResult(
                testcase_id=tc.id,
                name=tc.name,
                hidden=bool(tc.hidden),
                category=getattr(tc.category, "value", None) if tc.category else None,
                stdout="",
                expected_output="" if tc.hidden else (tc.expected_output or ""),
                stderr=str(exc),
                compile_output="",
                wall_time_ms=0.0,
                runtime_ms=0.0,
                peak_memory_mb=0.0,
                exit_code=1,
                weight=tc.weight,
                passed=False,
                verdict=Verdict.INTERNAL_ERROR,
            )

        status_id = int((data.get("status") or {}).get("id", 0))
        raw_verdict = STATUS_VERDICTS.get(status_id, Verdict.RUNTIME_ERROR)
        stdout = data.get("stdout") or ""
        stderr = data.get("stderr") or ""
        compile_out = data.get("compile_output") or ""
        time_sec = float(data.get("time") or 0.0)
        time_ms = time_sec * 1000
        mem_kb = float(data.get("memory") or 0.0)
        mem_mb = mem_kb / 1024.0

        # Perform rigorous comparison
        passed = False
        final_verdict = raw_verdict

        if status_id == 6:
            final_verdict = Verdict.COMPILATION_ERROR
        elif status_id == 5:
            final_verdict = Verdict.TIME_LIMIT_EXCEEDED
        elif status_id in {7, 8, 9, 10, 11, 12}:
            final_verdict = Verdict.RUNTIME_ERROR
        elif status_id == 3 or raw_verdict == Verdict.ACCEPTED:
            # Check comparison with configured mode
            passed = JudgeEngine.compare(
                actual=stdout,
                expected=tc.expected_output or "",
                mode=tc.comparison_mode or comparison_mode,
            )
            final_verdict = Verdict.ACCEPTED if passed else Verdict.WRONG_ANSWER
        elif status_id == 4 or raw_verdict == Verdict.WRONG_ANSWER:
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
            stdout="" if tc.hidden else stdout,
            expected_output="" if tc.hidden else (tc.expected_output or ""),
            stderr=stderr,
            compile_output=compile_out,
            wall_time_ms=time_ms,
            runtime_ms=time_ms,
            peak_memory_mb=mem_mb,
            exit_code=int(data.get("exit_code") or 0),
            weight=tc.weight,
            passed=passed,
            verdict=final_verdict,
        )

    async def execute_batch(
        self,
        language: str | Language,
        code: str,
        testcases: list[TestCaseSchema],
        time_limit: float = 5.0,
        memory_limit_mb: int = 256,
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
    ) -> ExecutionResult:
        """
        Execute full suite of testcases concurrently against Codebox engine.
        Seamlessly falls back to local execution if Codebox server is unreachable.
        """
        lang_id = self._resolve_lang_id(language)
        submission_id = str(uuid4())

        # Probe health or fallback
        if not await self.healthy():
            logger.warning("Codebox engine unreachable at %s; falling back to local sandbox.", self.base_url)
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

        async with httpx.AsyncClient(timeout=self.timeout) as client:
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
            results: list[TestCaseResult] = await gather_with_concurrency(8, *tasks)

        passed_count = sum(1 for r in results if r.passed)

        total_count = len(results)
        max_time = max((r.wall_time_ms for r in results), default=0.0)
        max_mem = max((r.peak_memory_mb for r in results), default=0.0)

        # Primary compile output if any
        compile_out = next((r.compile_output for r in results if r.compile_output), "")
        first_stderr = next((r.stderr for r in results if r.stderr), "")
        first_stdout = results[0].stdout if results else ""

        # Determine overall verdict
        if any(r.verdict == Verdict.COMPILATION_ERROR for r in results):
            top_verdict = Verdict.COMPILATION_ERROR
        elif any(r.verdict == Verdict.TIME_LIMIT_EXCEEDED for r in results):
            top_verdict = Verdict.TIME_LIMIT_EXCEEDED
        elif any(r.verdict == Verdict.RUNTIME_ERROR for r in results):
            top_verdict = Verdict.RUNTIME_ERROR
        elif any(r.verdict == Verdict.WRONG_ANSWER for r in results):
            top_verdict = Verdict.WRONG_ANSWER
        elif all(r.verdict == Verdict.ACCEPTED for r in results) and total_count > 0:
            top_verdict = Verdict.ACCEPTED
        else:
            top_verdict = Verdict.INTERNAL_ERROR

        score = (passed_count / max(1, total_count)) * 100.0

        return ExecutionResult(
            success=passed_count == total_count,
            submission_id=submission_id,
            status=ExecutionStatus.COMPLETED,
            verdict=top_verdict,
            stdout=first_stdout,
            stderr=first_stderr,
            compile_output=compile_out,
            memory=max_mem,
            time=max_time / 1000.0,
            exit_code=0 if top_verdict == Verdict.ACCEPTED else 1,
            testcase_results=results,
            passed_testcases=passed_count,
            total_testcases=total_count,
            score=score,
            completed_at=datetime.now(timezone.utc),
        )
