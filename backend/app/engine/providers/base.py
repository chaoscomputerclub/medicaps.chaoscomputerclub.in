"""Provider contract shared by every execution backend."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import List


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


class JudgeProvider(abc.ABC):
    """Runs one submission against one test case."""

    name: str = "abstract"

    @abc.abstractmethod
    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        ...

    async def run_batch(self, requests: List[ProviderRunRequest]) -> List[ProviderRunResult]:
        results: List[ProviderRunResult] = []
        for request in requests:
            results.append(await self.run(request))
        return results

    async def healthy(self) -> bool:
        return True
