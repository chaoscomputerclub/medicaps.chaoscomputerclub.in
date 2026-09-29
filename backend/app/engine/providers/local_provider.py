"""Default provider: the sandbox executors that already ship with this server."""

from __future__ import annotations

import logging

from app.engine.enums import Language
from app.engine.executors.factory import get_executor
from app.engine.languages import LanguageRegistry
from app.engine.schemas import TestCaseSchema

from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult

logger = logging.getLogger("ccc.judge.local")


class LocalSandboxProvider(JudgeProvider):
    name = "local"

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        try:
            language = LanguageRegistry.normalize(request.language)
        except Exception as exc:
            return ProviderRunResult(
                verdict="internal_error",
                diagnostics=[f"unsupported language {request.language!r}: {exc}"],
            )

        executor = get_executor(language)
        testcase = TestCaseSchema(
            stdin=request.stdin,
            expected_output=request.expected_output,
        )

        try:
            result = await executor.execute_batch(
                code=request.source_code,
                testcases=[testcase],
                time_limit=request.time_limit_seconds,
                memory_limit_mb=request.memory_limit_mb,
            )
        except Exception as exc:
            logger.warning("local execution failed: %s", exc)
            return ProviderRunResult(verdict="internal_error", diagnostics=[str(exc)])

        case = result.testcase_results[0] if result.testcase_results else None
        return ProviderRunResult(
            stdout=(case.stdout if case else result.stdout) or "",
            stderr=(case.stderr if case else result.stderr) or "",
            compile_output=result.compile_output or "",
            exit_code=int(case.exit_code if case else result.exit_code),
            # result.time is stored in SECONDS (wall_time_ms/1000.0 in base executor)
            # case.runtime_ms is already milliseconds — do NOT mix units
            time_ms=int(case.runtime_ms if case else result.time * 1000),
            memory_kb=int((case.peak_memory_mb if case else result.memory) * 1024),
            timed_out=str(result.verdict).lower().endswith("time_limit_exceeded"),
            passed=bool(case.passed) if case else result.score > 0,
            verdict=str(getattr(result.verdict, "value", result.verdict)),
        )
