"""Provider contract shared by every execution backend."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, List


@dataclass(frozen=True)
class ProviderRunRequest:
    language: str
    source_code: str
    stdin: str = ""
    expected_output: str = ""
    time_limit_seconds: float = 5.0
    memory_limit_mb: int = 256


@dataclass(frozen=True)
class ProviderRunResult:
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    exit_code: int = 0
    time_ms: int = 0
    memory_kb: int = 0
    timed_out: bool = False
    passed: bool = False
    verdict: str = "pending"
    diagnostics: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class ProviderCapabilities:
    """Explicit capability contract defining supported languages, sandboxing, and limits."""
    languages: List[str] = field(default_factory=list)
    compile_support: bool = True
    sandbox_support: bool = True
    network_policy: str = "disabled"
    architecture: str = "x86_64"
    resource_limits: dict[str, Any] = field(default_factory=lambda: {"max_time_s": 15.0, "max_memory_mb": 1024})
    concurrency: int = 4
    max_testcase_count: int = 100
    max_execution_duration_s: float = 60.0

    def supports_language(self, language: str | Any) -> bool:
        lang_str = getattr(language, "value", str(language)).lower()
        if not self.languages:
            return True
        return lang_str in [l.lower() for l in self.languages]


class JudgeProvider(abc.ABC):
    """Runs code executions against test cases."""

    name: str = "abstract"

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities()


    @abc.abstractmethod
    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        ...

    async def run_batch(self, requests: List[ProviderRunRequest]) -> List[ProviderRunResult]:
        results: List[ProviderRunResult] = []
        for request in requests:
            results.append(await self.run(request))
        return results

    async def execute_batch(
        self,
        language: str | Any,
        code: str,
        testcases: list[Any],
        time_limit: float = 5.0,
        memory_limit_mb: int = 256,
        comparison_mode: Any = None,
    ) -> Any:
        """Default batch execution falling back to in-process executor if allowed."""
        from app.core.config import settings
        from app.engine.enums import ComparisonMode, ExecutionStatus, Verdict
        from app.engine.executors.factory import get_executor
        from app.engine.languages import LanguageRegistry
        from app.engine.schemas import ExecutionResult

        if not settings.ALLOW_UNSANDBOXED_EXECUTION:
            return ExecutionResult(
                success=False,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error="CRITICAL SECURITY VIOLATION: Unsandboxed host execution is prohibited by security policy. Docker sandbox required.",
                total_testcases=len(testcases),
            )

        lang = LanguageRegistry.normalize(language)
        executor = get_executor(lang)
        cmp_mode = comparison_mode or ComparisonMode.TRIMMED
        return await executor.execute_batch(
            code=code,
            testcases=testcases,
            time_limit=time_limit,
            memory_limit_mb=memory_limit_mb,
            comparison_mode=cmp_mode,
        )

    async def healthy(self) -> bool:
        return True
