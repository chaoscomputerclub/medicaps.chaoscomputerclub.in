"""Default provider: the sandbox executors that already ship with this server."""

from __future__ import annotations

import logging

from app.core.config import settings
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.executors.factory import get_executor
from app.engine.languages import LanguageRegistry
from app.engine.schemas import ExecutionResult, TestCaseSchema

from typing import Optional

from .base import JudgeProvider, ProviderCapabilities, ProviderRunRequest, ProviderRunResult
from app.engine.deadlines import ExecutionDeadlineTracker

logger = logging.getLogger("ccc.judge.local")


class LocalSandboxProvider(JudgeProvider):
    name = "local"

    async def healthy(self) -> bool:
        """
        Local host execution is only supported and healthy when ALLOW_UNSANDBOXED_EXECUTION
        is explicitly permitted by security configuration.
        """
        return bool(settings.ALLOW_UNSANDBOXED_EXECUTION)

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            languages=["python", "javascript", "cpp", "c", "java", "rust", "go", "typescript"],
            compile_support=True,
            sandbox_support=bool(settings.ALLOW_UNSANDBOXED_EXECUTION),
            network_policy="disabled",
            concurrency=8,
            max_testcase_count=100,
            max_execution_duration_s=60.0,
        )

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        if not settings.ALLOW_UNSANDBOXED_EXECUTION:
            return ProviderRunResult(
                verdict="system_error",
                diagnostics=["CRITICAL SECURITY VIOLATION: Unsandboxed local execution is prohibited by security policy. Docker sandbox required."],
            )
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

    async def execute_batch(
        self,
        language: str | Language,
        code: str,
        testcases: list[TestCaseSchema],
        time_limit: float = 5.0,
        memory_limit_mb: int = 256,
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
        deadline_tracker: Optional[ExecutionDeadlineTracker] = None,
        submission_id: Optional[str] = None,
        job_id: Optional[str] = None,
        attempt_id: Optional[str] = None,
        lease_id: Optional[str] = None,
        node_id: Optional[str] = None,
    ) -> ExecutionResult:
        if not settings.ALLOW_UNSANDBOXED_EXECUTION:
            return ExecutionResult(
                success=False,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error="CRITICAL SECURITY VIOLATION: Unsandboxed local execution is prohibited by security policy. Docker sandbox required.",
                total_testcases=len(testcases),
            )

        try:
            from app.engine.pipeline import LanguageAwareExecutionEngine
            engine = LanguageAwareExecutionEngine.get_instance()
            return await engine.execute(
                language=language,
                code=code,
                testcases=testcases,
                deadline_tracker=deadline_tracker,
                comparison_mode=comparison_mode,
                submission_id=submission_id,
                job_id=job_id,
                attempt_id=attempt_id,
                lease_id=lease_id,
                node_id=node_id,
            )
        except Exception as exc:
            logger.warning("LanguageAwareExecutionEngine failed, falling back to legacy executor: %s", exc)
            lang = LanguageRegistry.normalize(language)
            executor = get_executor(lang)
            return await executor.execute_batch(
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
            )

