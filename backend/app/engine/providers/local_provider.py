"""Default provider: the sandbox executors that already ship with this server."""

from __future__ import annotations

import logging

from app.engine.enums import Language
from app.engine.executors.factory import get_executor
from app.engine.schemas import TestCaseSchema

from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult

logger = logging.getLogger("ccc.judge.local")

_LANGUAGES = {
    "python": Language.PYTHON,
    "python3": Language.PYTHON,
    "cpp": Language.CPP,
    "c++": Language.CPP,
    "java": Language.JAVA,
    "javascript": Language.JAVASCRIPT,
    "js": Language.JAVASCRIPT,
    "typescript": Language.JAVASCRIPT,
}


class LocalSandboxProvider(JudgeProvider):
    name = "local"

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        language = _LANGUAGES.get(request.language.lower())
        if language is None:
            return ProviderRunResult(
                verdict="internal_error",
                diagnostics=[f"unsupported language {request.language!r}"],
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
            time_ms=int(case.runtime_ms if case else result.time),
            memory_kb=int((case.peak_memory_mb if case else result.memory) * 1024),
            timed_out=str(result.verdict).lower().endswith("time_limit_exceeded"),
            passed=bool(case.passed) if case else result.score > 0,
            verdict=str(getattr(result.verdict, "value", result.verdict)),
        )
