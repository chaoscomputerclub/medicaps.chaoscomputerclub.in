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

            # 2. Compile phase (if required by language, e.g. C++, Java) — COMPILE ONCE per submission
            compile_output = ""
            compile_time_ms = 0.0
            if self.requires_compile and self.compile_command:
                c_res = await Sandbox.compile(
                    command=self.compile_command,
                    workspace=workspace,
                    time_limit=15.0,
                )
                compile_output = c_res.output or c_res.error
                compile_time_ms = c_res.time_ms
                if not c_res.success:
                    return ExecutionResult(
                        success=False,
                        submission_id=submission_id,
                        status=ExecutionStatus.COMPLETED,
                        verdict=Verdict.COMPILATION_ERROR,
                        compile_output=compile_output,
                        compile_time_ms=compile_time_ms,
                        total_time_ms=compile_time_ms,
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
                if sandbox_res.system_error:
                    verdict = Verdict.SYSTEM_ERROR
                elif sandbox_res.output_limit_exceeded:
                    verdict = Verdict.OUTPUT_LIMIT_EXCEEDED
                elif sandbox_res.exit_code != 0:
                    verdict = Verdict.RUNTIME_ERROR
                elif sandbox_res.timed_out:
                    verdict = Verdict.TIME_LIMIT_EXCEEDED
                elif sandbox_res.oom_killed:
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
                    compile_time_ms=round(compile_time_ms, 2),
                    execution_time_ms=round(sandbox_res.wall_time_ms, 2),
                    total_time_ms=round(compile_time_ms + sandbox_res.wall_time_ms, 2),
                    exit_code=sandbox_res.exit_code,
                    completed_at=datetime.now(timezone.utc),
                )

            # 4. Run through testcases with early termination on hidden failures
            testcase_results: list[TestCaseResult] = []
            total_exec_time_ms = 0.0

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
                total_exec_time_ms += sandbox_res.wall_time_ms

                tc_result = JudgeEngine.evaluate(
                    sandbox_result=sandbox_res,
                    testcase=tc,
                    compile_output=compile_output,
                    compile_failed=False,  # Compilation succeeded; we are in run phase
                    comparison_mode=comparison_mode,
                )
                testcase_results.append(tc_result)

                # Early termination on definitive failure for hidden testcases
                if tc.hidden and not tc_result.passed:
                    logger.info("Early termination in BaseExecutor on hidden testcase %s (verdict=%s)", tc.id, tc_result.verdict)
                    break

            scoring = JudgeEngine.score(testcase_results)
            first_fail = next((tr for tr in testcase_results if not tr.passed), None)
            rep_tc = first_fail if first_fail else (testcase_results[0] if testcase_results else None)

            return ExecutionResult(
                success=(scoring.verdict == Verdict.ACCEPTED),
                submission_id=submission_id,
                status=ExecutionStatus.COMPLETED,
                verdict=scoring.verdict,
                stdout=rep_tc.stdout if rep_tc else "",
                stderr=rep_tc.stderr if rep_tc else "",
                compile_output=compile_output,
                memory=scoring.max_memory_mb,
                time=scoring.max_time_ms / 1000.0,
                compile_time_ms=round(compile_time_ms, 2),
                execution_time_ms=round(total_exec_time_ms, 2),
                total_time_ms=round(compile_time_ms + total_exec_time_ms, 2),
                exit_code=rep_tc.exit_code if rep_tc else 0,
                testcase_results=testcase_results,
                passed_testcases=scoring.passed,
                total_testcases=len(testcases),
                score=scoring.score,
                completed_at=datetime.now(timezone.utc),
            )

        finally:
            if workspace:
                await Sandbox.cleanup_workspace(workspace)
