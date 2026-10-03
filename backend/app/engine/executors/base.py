"""
Chaos Computer Club — Base Language Executor
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.judge import JudgeEngine
from app.engine.sandbox import Sandbox
from app.engine.schemas import (
    ExecuteRequest,
    ExecutionResult,
    SandboxResult,
    TestCaseResult,
    TestCaseSchema,
)

logger = logging.getLogger(__name__)


class BaseExecutor(ABC):
    language: Language
    filename: str
    compile_command: Optional[list[str]] = None
    run_command: list[str]
    requires_compile: bool = False

    async def execute(
        self,
        request: ExecuteRequest,
        testcase: Optional[TestCaseSchema] = None,
    ) -> ExecutionResult:
        """Run single testcase or raw input."""
        results = await self.execute_batch(
            code=request.code,
            testcases=[testcase] if testcase else [],
            stdin=request.stdin if not testcase else "",
            time_limit=request.time_limit,
            memory_limit_mb=request.memory_limit,
            comparison_mode=request.comparison_mode,
        )
        return results

    async def execute_batch(
        self,
        code: str,
        testcases: list[TestCaseSchema],
        stdin: str = "",
        time_limit: float = 3.0,
        memory_limit_mb: int = 256,
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
    ) -> ExecutionResult:
        """Execute one or more testcases via the unified language-aware execution pipeline."""
        from app.engine.pipeline import LanguageAwareExecutionEngine
        from app.engine.strategy.base import CompileLimits, ExecutionLimits

        engine = LanguageAwareExecutionEngine()
        c_limits = CompileLimits(timeout=10.0, memory_bytes=512 * 1024 * 1024)
        e_limits = ExecutionLimits(timeout=time_limit, memory_bytes=memory_limit_mb * 1024 * 1024)

        effective_testcases = list(testcases)
        if not effective_testcases:
            effective_testcases = [TestCaseSchema(id="tc_stdin", stdin=stdin, expected_output="", hidden=False)]

        return await engine.execute(
            language=self.language,
            code=code,
            testcases=effective_testcases,
            compile_limits=c_limits,
            execution_limits=e_limits,
            comparison_mode=comparison_mode,
        )
