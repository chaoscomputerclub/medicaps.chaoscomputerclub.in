"""
Chaos Computer Club — Interleet Docker Sandbox Judge Provider
Connects Medi-Caps platform to the self-hosted Interleet Docker container engine.
Runs code inside pre-warmed, isolated persistent containers across 7 languages.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Dict, List, Optional
from uuid import uuid4

import httpx

from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult

logger = logging.getLogger("ccc.judge.interleet")

# Normalize language identifiers between providers
LANGUAGE_ALIASES: Dict[str, str] = {
    "python": "python",
    "python3": "python",
    "py": "python",
    "cpp": "cpp",
    "c++": "cpp",
    "c": "cpp",
    "java": "java",
    "javascript": "javascript",
    "js": "javascript",
    "node": "javascript",
    "typescript": "typescript",
    "ts": "typescript",
    "go": "go",
    "golang": "go",
    "rust": "rust",
    "rs": "rust",
}


class InterleetProvider(JudgeProvider):
    name = "interleet"

    def __init__(self) -> None:
        self.base_url = os.getenv("INTERLEET_ENGINE_URL", "http://127.0.0.1:8001").rstrip("/")
        self.timeout = float(os.getenv("INTERLEET_TIMEOUT", "35.0"))

    def _normalize_lang(self, lang: str | Language) -> str:
        raw = lang.value if isinstance(lang, Language) else str(lang)
        return LANGUAGE_ALIASES.get(raw.strip().lower(), "python")

    async def healthy(self) -> bool:
        """Check whether the Interleet Docker engine is responsive and has sandbox images ready."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/v1/health")
                if res.status_code == 200:
                    data = res.json()
                    images_ready = data.get("docker", {}).get("images_ready", 0)
                    return data.get("status") == "ok" and images_ready > 0
                return False
        except Exception:
            return False

    async def get_engine_status(self) -> Dict:
        """Detailed status metadata for the /api/health probe."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/v1/health")
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "engine": data.get("engine", "interleet-judge-v1"),
                        "images_ready": data.get("docker", {}).get("images_ready", 0),
                        "images_total": data.get("docker", {}).get("images_total", 0),
                        "workers": data.get("workers", {}).get("count", 0),
                        "redis_connected": data.get("redis", {}).get("connected", False),
                    }
        except Exception as exc:
            return {"error": str(exc)}
        return {"status": "offline"}

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
        Primary execution entrypoint.
        Sends all testcases to the Interleet Docker engine in a single network round-trip.
        Falls back to the in-process local sandbox if the Docker engine is unreachable.
        """
        lang_str = self._normalize_lang(language)

        payload = {
            "language": lang_str,
            "code": code,
            "test_cases": [
                {
                    "id": tc.id,
                    "name": tc.name,
                    "stdin": tc.stdin or "",
                    "expected_output": tc.expected_output or "",
                    "hidden": bool(tc.hidden),
                }
                for tc in testcases
            ],
            "time_limit": max(0.5, min(float(time_limit), 30.0)),
            "memory_limit": max(32, min(int(memory_limit_mb), 1024)),
            "comparison_mode": getattr(comparison_mode, "value", str(comparison_mode).lower()),
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/v1/run", json=payload)
                response.raise_for_status()
                data = response.json()

            # Parse returned testcase results
            testcase_results: list[TestCaseResult] = []
            for tr in data.get("testcase_results", []):
                v_str = str(tr.get("verdict", "INTERNAL_ERROR")).upper()
                tc_verdict = getattr(Verdict, v_str, Verdict.INTERNAL_ERROR)
                testcase_results.append(
                    TestCaseResult(
                        testcase_id=str(tr.get("testcase_id", "")),
                        name=tr.get("name"),
                        hidden=bool(tr.get("hidden", False)),
                        passed=bool(tr.get("passed", False)),
                        verdict=tc_verdict,
                        category=tr.get("category"),
                        stdout=tr.get("stdout") or "",
                        expected_output=tr.get("expected_output") or "",
                        stderr=tr.get("stderr") or "",
                        compile_output=tr.get("compile_output") or "",
                        wall_time_ms=float(tr.get("wall_time_ms") or 0.0),
                        runtime_ms=float(tr.get("runtime_ms") or tr.get("wall_time_ms") or 0.0),
                        peak_memory_mb=float(tr.get("peak_memory_mb") or 0.0),
                        exit_code=int(tr.get("exit_code") or 0),
                        weight=float(tr.get("weight") or 1.0),
                    )
                )

            top_verdict_str = str(data.get("verdict", "INTERNAL_ERROR")).upper()
            top_verdict = getattr(Verdict, top_verdict_str, Verdict.INTERNAL_ERROR)

            return ExecutionResult(
                success=bool(data.get("success", False)),
                submission_id=str(data.get("submission_id") or uuid4()),
                status=ExecutionStatus.COMPLETED,
                verdict=top_verdict,
                stdout=data.get("stdout") or "",
                stderr=data.get("stderr") or "",
                compile_output=data.get("compile_output") or "",
                memory=float(data.get("memory") or 0.0),
                time=float(data.get("time") or 0.0),
                exit_code=int(data.get("exit_code") or 0),
                testcase_results=testcase_results,
                passed_testcases=int(data.get("passed_testcases") or 0),
                total_testcases=int(data.get("total_testcases") or len(testcase_results)),
                score=float(data.get("score") or 0.0),
                error=data.get("error"),
            )

        except Exception as exc:
            logger.warning(
                "Interleet Docker engine at %s failed or unreachable (%s); falling back to local sandbox executor",
                self.base_url,
                exc,
            )
            from app.engine.executors.factory import get_executor

            try:
                lang_enum = Language(lang_str)
            except ValueError:
                lang_enum = Language.PYTHON

            executor = get_executor(lang_enum)
            return await executor.execute_batch(
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
            )

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        """Run single testcase for ProviderRunRequest contract."""
        tc = TestCaseSchema(
            id="run_single",
            stdin=request.stdin,
            expected_output=request.expected_output,
        )
        res = await self.execute_batch(
            language=request.language,
            code=request.source_code,
            testcases=[tc],
            time_limit=request.time_limit_seconds,
            memory_limit_mb=request.memory_limit_mb,
        )
        case = res.testcase_results[0] if res.testcase_results else None
        return ProviderRunResult(
            stdout=(case.stdout if case else res.stdout) or "",
            stderr=(case.stderr if case else res.stderr) or "",
            compile_output=res.compile_output or "",
            exit_code=case.exit_code if case else res.exit_code,
            time_ms=int(case.wall_time_ms if case else (res.time * 1000.0)),
            memory_kb=int((case.peak_memory_mb if case else res.memory) * 1024),
            timed_out=res.verdict == Verdict.TIME_LIMIT_EXCEEDED,
            passed=bool(case.passed if case else res.success),
            verdict=res.verdict.value.lower(),
        )

    async def run_batch(self, requests: List[ProviderRunRequest]) -> List[ProviderRunResult]:
        """
        Execute multiple requests. If all belong to the same code/language submission,
        bundles into a single HTTP call to the Docker engine.
        """
        if not requests:
            return []

        # If uniform code & language, run as single batch in one container execution
        first = requests[0]
        is_uniform = all(
            r.language == first.language and r.source_code == first.source_code for r in requests
        )

        if is_uniform:
            testcases = [
                TestCaseSchema(
                    id=f"tc_{i}",
                    stdin=r.stdin,
                    expected_output=r.expected_output,
                )
                for i, r in enumerate(requests)
            ]
            res = await self.execute_batch(
                language=first.language,
                code=first.source_code,
                testcases=testcases,
                time_limit=first.time_limit_seconds,
                memory_limit_mb=first.memory_limit_mb,
            )
            out: List[ProviderRunResult] = []
            for i, r in enumerate(requests):
                case = res.testcase_results[i] if i < len(res.testcase_results) else None
                out.append(
                    ProviderRunResult(
                        stdout=(case.stdout if case else res.stdout) or "",
                        stderr=(case.stderr if case else res.stderr) or "",
                        compile_output=res.compile_output or "",
                        exit_code=case.exit_code if case else res.exit_code,
                        time_ms=int(case.wall_time_ms if case else (res.time * 1000.0)),
                        memory_kb=int((case.peak_memory_mb if case else res.memory) * 1024),
                        timed_out=res.verdict == Verdict.TIME_LIMIT_EXCEEDED,
                        passed=bool(case.passed if case else False),
                        verdict=res.verdict.value.lower(),
                    )
                )
            return out

        # Non-uniform: concurrent individual runs
        return list(await asyncio.gather(*[self.run(r) for r in requests]))
