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
        """Execute one or more testcases within an isolated workspace."""
        submission_id = str(uuid4())
        workspace: Optional[Path] = None

        try:
            workspace = await Sandbox.create_workspace()

            # 1. Write source code
            source_file = workspace / self.filename
            source_file.write_text(code, encoding="utf-8")

            # 2. Compile phase (if required by language, e.g. C++, Java)
            compile_output = ""
            if self.requires_compile and self.compile_command:
                c_res = await Sandbox.compile(
                    command=self.compile_command,
                    workspace=workspace,
                    time_limit=15.0,
                )
                compile_output = c_res.output or c_res.error
                if not c_res.success:
                    return ExecutionResult(
                        success=False,
                        submission_id=submission_id,
                        status=ExecutionStatus.COMPLETED,
                        verdict=Verdict.COMPILATION_ERROR,
                        compile_output=compile_output,
                        stderr=c_res.error,
                        completed_at=datetime.now(timezone.utc),
                    )

            # 3. If no testcases provided, run once with provided stdin
            if not testcases:
                sandbox_res = await Sandbox.run(
                    command=self.run_command,
                    workspace=workspace,
                    stdin_data=stdin,
                    time_limit=time_limit,
                    memory_limit_mb=memory_limit_mb,
                )

                verdict = Verdict.ACCEPTED
                if sandbox_res.exit_code != 0:
                    verdict = Verdict.RUNTIME_ERROR
                if sandbox_res.timed_out:
                    verdict = Verdict.TIME_LIMIT_EXCEEDED
                if sandbox_res.oom_killed:
                    verdict = Verdict.MEMORY_LIMIT_EXCEEDED

                return ExecutionResult(
                    success=(verdict == Verdict.ACCEPTED),
                    submission_id=submission_id,
                    status=ExecutionStatus.COMPLETED,
                    verdict=verdict,
                    stdout=sandbox_res.stdout,
                    stderr=sandbox_res.stderr,
                    compile_output=compile_output,
                    memory=sandbox_res.peak_memory_mb,
                    time=sandbox_res.wall_time_ms / 1000.0,
                    exit_code=sandbox_res.exit_code,
                    completed_at=datetime.now(timezone.utc),
                )

            # 4. Run through testcases
            testcase_results: list[TestCaseResult] = []
            for tc in testcases:
                tc_time_limit = tc.time_limit or time_limit
                tc_mem_limit = tc.memory_limit or memory_limit_mb

                sandbox_res = await Sandbox.run(
                    command=self.run_command,
                    workspace=workspace,
                    stdin_data=tc.stdin,
                    time_limit=tc_time_limit,
                    memory_limit_mb=tc_mem_limit,
                )

                tc_result = JudgeEngine.evaluate(
                    sandbox_result=sandbox_res,
                    testcase=tc,
                    compile_output=compile_output,
                    comparison_mode=comparison_mode,
                )
                testcase_results.append(tc_result)

                # Short-circuit on fatal error if desired, or run all for complete diagnostics
                if sandbox_res.timed_out and len(testcases) > 5:
                    break

            scoring = JudgeEngine.score(testcase_results)
            first_tc = testcase_results[0] if testcase_results else None

            return ExecutionResult(
                success=(scoring.verdict == Verdict.ACCEPTED),
                submission_id=submission_id,
                status=ExecutionStatus.COMPLETED,
                verdict=scoring.verdict,
                stdout=first_tc.stdout if first_tc else "",
                stderr=first_tc.stderr if first_tc else "",
                compile_output=compile_output,
                memory=scoring.max_memory_mb,
                time=scoring.max_time_ms / 1000.0,
                exit_code=first_tc.exit_code if first_tc else 0,
                testcase_results=testcase_results,
                passed_testcases=scoring.passed,
                total_testcases=scoring.total,
                score=scoring.score,
                completed_at=datetime.now(timezone.utc),
            )

        finally:
            if workspace:
                await Sandbox.cleanup_workspace(workspace)
