"""
Chaos Computer Club — Core Docker Execution Engine Provider
Executes code submissions directly inside persistent Docker containers via the local Docker daemon.
Runs completely in-process: no intermediary HTTP services required.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.engine.docker.languages import get_language_spec
from app.engine.docker.pool import get_container, get_docker_client, prewarm_containers
from app.engine.docker.sandbox import CoreDockerSandbox
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.judge import JudgeEngine
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult

logger = logging.getLogger("ccc.judge.docker")


class DockerSandboxProvider(JudgeProvider):
    name = "docker"

    def __init__(self) -> None:
        self.client = get_docker_client()

    async def healthy(self) -> bool:
        """Verify Docker daemon is responsive and python sandbox is available."""
        if not self.client:
            self.client = get_docker_client()
        if not self.client:
            return False
        try:
            self.client.ping()
            cnt = get_container("interleet-python:latest")
            return cnt is not None and cnt.status == "running"
        except Exception:
            return False

    async def get_engine_status(self) -> Dict[str, Any]:
        """Observability telemetry for /api/health probe."""
        client = get_docker_client()
        if not client:
            return {"status": "docker_daemon_unavailable"}
        try:
            containers = client.containers.list(filters={"name": "interleet-engine-"})
            return {
                "engine": "ccc-core-docker-v1",
                "mode": "direct_in_process",
                "running_containers": len(containers),
                "containers": [c.name for c in containers],
                "active_threads": 16,
            }
        except Exception as exc:
            return {"status": "error", "detail": str(exc)}

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
        Direct in-process batch execution inside persistent Docker sandboxes.
        Falls back to LocalSandboxProvider if Docker daemon is not active.
        """
        # Fallback check
        if not await self.healthy():
            logger.warning("Docker daemon is offline; falling back to local host sandbox.")
            from app.engine.executors.factory import get_executor
            lang_enum = language if isinstance(language, Language) else Language(language)
            return await get_executor(lang_enum).execute_batch(
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
            )

        spec = get_language_spec(language)
        workspace: Optional[Path] = None
        submission_id = str(uuid4())

        try:
            workspace = CoreDockerSandbox.create_workspace()

            # 1. Write source file
            source_file = workspace / spec.filename
            source_file.write_text(code, encoding="utf-8")
            try:
                os.chmod(source_file, 0o666)
            except Exception:
                pass

            # 2. Compilation phase (C++, Java, TS, Go, Rust)
            compile_output = ""
            if spec.requires_compile and spec.compile_command:
                comp_res = await CoreDockerSandbox.compile(
                    image=spec.image,
                    command=spec.compile_command,
                    workspace=workspace,
                    time_limit=15.0,
                )
                compile_output = comp_res.output or comp_res.error
                if not comp_res.success:
                    return ExecutionResult(
                        success=False,
                        submission_id=submission_id,
                        status=ExecutionStatus.COMPLETED,
                        verdict=Verdict.COMPILATION_ERROR,
                        compile_output=compile_output,
                        stderr=comp_res.error,
                        completed_at=datetime.now(timezone.utc),
                    )

            # 3. Testcase execution
            testcase_results: list[TestCaseResult] = []
            total_time_ms = 0.0

            for tc in testcases:
                tc_time = tc.time_limit or time_limit
                tc_mem = tc.memory_limit or memory_limit_mb

                sandbox_res = await CoreDockerSandbox.run(
                    image=spec.image,
                    run_cmd=spec.run_command,
                    workspace=workspace,
                    stdin_data=tc.stdin or "",
                    time_limit=tc_time,
                    memory_limit_mb=tc_mem,
                )
                total_time_ms += sandbox_res.wall_time_ms

                tc_res = JudgeEngine.evaluate(
                    sandbox_result=sandbox_res,
                    testcase=tc,
                    compile_output=compile_output,
                    comparison_mode=comparison_mode,
                )
                testcase_results.append(tc_res)

            # 4. Aggregation
            scoring_res = JudgeEngine.score(testcase_results)

            # Determine representative output
            first_fail = next((tr for tr in testcase_results if not tr.passed), None)
            rep_case = first_fail if first_fail else (testcase_results[0] if testcase_results else None)

            return ExecutionResult(
                success=(scoring_res.passed == scoring_res.total and scoring_res.total > 0),
                submission_id=submission_id,
                status=ExecutionStatus.COMPLETED,
                verdict=scoring_res.verdict,
                stdout=rep_case.stdout if rep_case else "",
                stderr=rep_case.stderr if rep_case else "",
                compile_output=compile_output,
                memory=scoring_res.max_memory_mb,
                time=round(scoring_res.max_time_ms / 1000.0, 4),
                exit_code=testcase_results[0].exit_code if testcase_results else 0,
                testcase_results=testcase_results,
                passed_testcases=scoring_res.passed,
                total_testcases=scoring_res.total,
                score=scoring_res.score,
                completed_at=datetime.now(timezone.utc),
            )

        finally:
            if workspace:
                CoreDockerSandbox.cleanup_workspace(workspace)

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        """Run a single testcase."""
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
        """Batch run for multiple testcases."""
        if not requests:
            return []

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

        return list(await asyncio.gather(*[self.run(r) for r in requests]))
