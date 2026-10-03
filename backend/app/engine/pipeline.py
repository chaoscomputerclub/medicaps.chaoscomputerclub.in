"""
Chaos Computer Club — Language-Aware Production Judge Execution Pipeline
Core engine orchestrating language resolution, strategy selection, single compilation,
reusable artifact execution, strict resource bounds, and comprehensive telemetry.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.config import settings
from app.engine.compilation_cache import CompilationCache
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.errors import ErrorCode, JudgeExecutionException
from app.engine.judge import JudgeEngine
from app.engine.languages import LanguageConfig, LanguageFamily, LanguageRegistry
from app.engine.observability import ExecutionObservability
from app.engine.sandbox import Sandbox
from app.engine.schemas import ExecutionResult, SandboxResult, TestCaseResult, TestCaseSchema
from app.engine.strategy.base import (
    ArtifactType,
    CompilationResult,
    CompileLimits,
    ExecutionArtifact,
    ExecutionLimits,
    ExecutionStrategy,
    PreparationResult,
    TestcaseExecutionResult,
)

logger = logging.getLogger("ccc.engine.pipeline")


class LanguageAwareExecutionEngine:
    """
    Authoritative language-aware execution pipeline for CCC distributed coding judge.
    Distinguishes INTERPRETED, COMPILED, and VM languages.
    Enforces 'Compile ONCE per submission attempt' across all testcases.
    """

    def __init__(self, cache: Optional[CompilationCache] = None) -> None:
        self.cache = cache or CompilationCache(enabled=True)
        self.obs = ExecutionObservability.get_instance()

    async def execute(
        self,
        language: str | Language,
        code: str,
        testcases: list[TestCaseSchema],
        compile_limits: Optional[CompileLimits] = None,
        execution_limits: Optional[ExecutionLimits] = None,
        deadline_tracker: Optional[ExecutionDeadlineTracker] = None,
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
        submission_id: Optional[str] = None,
        job_id: Optional[str] = None,
        attempt_id: Optional[str] = None,
        lease_id: Optional[str] = None,
        node_id: Optional[str] = None,
        is_submit: bool = False,
    ) -> ExecutionResult:
        sub_id = submission_id or str(uuid4())
        t_start = time.monotonic()

        # 1. Resolve Language Config & Strategy
        try:
            norm_lang = LanguageRegistry.normalize(language)
            config = LanguageRegistry.get_config(norm_lang)
            strategy = LanguageRegistry.resolve_strategy(norm_lang)
        except Exception as exc:
            return ExecutionResult(
                success=False,
                submission_id=sub_id,
                job_id=job_id,
                attempt_id=attempt_id,
                lease_id=lease_id,
                node_id=node_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error=f"Language resolution error: {exc}",
                total_testcases=len(testcases),
            )

        # 2. Language Isolation Assertion (detect and block foreign tokens before execution)
        try:
            LanguageRegistry.validate_source(norm_lang, code)
        except Exception as exc:
            return ExecutionResult(
                success=False,
                submission_id=sub_id,
                job_id=job_id,
                attempt_id=attempt_id,
                lease_id=lease_id,
                node_id=node_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.COMPILATION_ERROR,
                compile_output=str(exc),
                stderr=str(exc),
                error=str(exc),
                total_testcases=len(testcases),
            )

        # 3. Setup Resource Limits & Dominant Deadline Tracker
        c_limits = compile_limits or CompileLimits(timeout=10.0, cpu=2.0)
        e_limits = execution_limits or ExecutionLimits(
            timeout=config.default_time_limit,
            memory_bytes=config.default_memory_limit * 1024 * 1024,
        )
        tracker = deadline_tracker or ExecutionDeadlineTracker(
            total_timeout_s=max(30.0, (e_limits.timeout * len(testcases)) + c_limits.timeout + 5.0)
        )

        workspace: Optional[Path] = None
        sandbox_create_ms = 0.0
        source_write_ms = 0.0
        startup_ms = 0.0
        compile_ms = 0.0
        cache_lookup_ms = 0.0
        cache_hit = False

        try:
            # 4. Create Ephemeral Sandbox Workspace
            ws_start = time.monotonic()
            workspace = await Sandbox.create_workspace()
            sandbox_create_ms = (time.monotonic() - ws_start) * 1000.0

            # 5. Preparation Stage: write source & initialize directory layout
            prep_start = time.monotonic()
            prep_res: PreparationResult = await strategy.prepare(workspace, code, c_limits)
            source_write_ms = (time.monotonic() - prep_start) * 1000.0
            startup_ms = prep_res.startup_ms

            if not prep_res.success:
                return ExecutionResult(
                    success=False,
                    submission_id=sub_id,
                    job_id=job_id,
                    attempt_id=attempt_id,
                    lease_id=lease_id,
                    node_id=node_id,
                    status=ExecutionStatus.FAILED,
                    verdict=Verdict.COMPILATION_ERROR,
                    compile_output=prep_res.error or "Preparation failed.",
                    stderr=prep_res.error or "",
                    total_testcases=len(testcases),
                )

            # 6. Compilation Stage: COMPILE ONCE per submission attempt
            # Interpreted languages bypass native compilation. Compiled/VM languages compile once.
            comp_res: CompilationResult
            if config.family in (LanguageFamily.COMPILED, LanguageFamily.VM):
                # Calculate compilation budget bounded by dominant deadline
                try:
                    bounded_c_timeout = tracker.compile_budget(c_limits.timeout)
                except JudgeExecutionException as exc:
                    return ExecutionResult(
                        success=False,
                        submission_id=sub_id,
                        job_id=job_id,
                        attempt_id=attempt_id,
                        lease_id=lease_id,
                        node_id=node_id,
                        status=ExecutionStatus.FAILED,
                        verdict=Verdict.TIME_LIMIT_EXCEEDED,
                        error=str(exc),
                        total_testcases=len(testcases),
                    )

                comp_limits_bounded = CompileLimits(
                    timeout=bounded_c_timeout,
                    cpu=c_limits.cpu,
                    memory_bytes=c_limits.memory_bytes,
                    process_count=c_limits.process_count,
                    output_limit_bytes=c_limits.output_limit_bytes,
                )

                c_start = time.monotonic()
                comp_res = await strategy.compile(workspace, comp_limits_bounded, self.cache)
                c_elapsed_ms = (time.monotonic() - c_start) * 1000.0
                cache_hit = comp_res.cached
                if cache_hit:
                    compile_ms = 0.0
                    cache_lookup_ms = c_elapsed_ms
                else:
                    compile_ms = c_elapsed_ms
                    cache_lookup_ms = 0.0

                tracker.record_stage("compile", compile_ms)

                self.obs.record_compilation(
                    language=config.language_id,
                    duration_seconds=compile_ms / 1000.0,
                    success=comp_res.success,
                    cached=cache_hit,
                )

                # If compilation failed: STOP. Never execute testcases.
                if not comp_res.success:
                    compile_err = comp_res.stderr or comp_res.stdout or "Compilation error occurred."
                    return ExecutionResult(
                        success=False,
                        submission_id=sub_id,
                        job_id=job_id,
                        attempt_id=attempt_id,
                        lease_id=lease_id,
                        node_id=node_id,
                        status=ExecutionStatus.FAILED,
                        verdict=Verdict.COMPILATION_ERROR,
                        compile_output=compile_err,
                        compile_time_ms=round(compile_ms, 2),
                        total_time_ms=round((time.monotonic() - t_start) * 1000.0, 2),
                        stderr=compile_err,
                        latencies={
                            "sandbox_create_ms": round(sandbox_create_ms, 2),
                            "source_write_ms": round(source_write_ms, 2),
                            "compile_ms": round(compile_ms, 2),
                            "execution_ms": 0.0,
                            "total_ms": round((time.monotonic() - t_start) * 1000.0, 2),
                        },
                        telemetry={
                            "language": config.language_id,
                            "family": config.family.value,
                            "compiler": config.compiler,
                            "compiler_version": comp_res.compiler_version,
                            "compile_flags": comp_res.compile_flags,
                            "cache_hit": cache_hit,
                            "compilation_required": True,
                        },
                        completed_at=datetime.now(timezone.utc),
                        total_testcases=len(testcases),
                    )

                artifact = comp_res.artifact
            else:
                # Interpreted languages bypass native compilation
                c_start = time.monotonic()
                comp_res = await strategy.compile(workspace, c_limits, self.cache)
                compile_ms = 0.0
                artifact = prep_res.artifact or comp_res.artifact

            if not artifact:
                raise RuntimeError("Failed to resolve valid ExecutionArtifact for execution stage.")

            # 7. Testcase Execution Stage: execute testcases sequentially (MODE A: process per testcase)
            testcase_results: list[TestCaseResult] = []
            total_exec_time_ms = 0.0
            max_runtime_ms = 0.0
            max_memory_mb = 0.0
            passed_count = 0
            dominant_verdict = Verdict.ACCEPTED

            for idx, tc in enumerate(testcases):
                # Check dominant job deadline
                if tracker.is_expired():
                    dominant_verdict = Verdict.TIME_LIMIT_EXCEEDED
                    tc_res = TestCaseResult(
                        testcase_id=tc.id,
                        name=tc.name,
                        hidden=tc.hidden,
                        passed=False,
                        verdict=Verdict.TIME_LIMIT_EXCEEDED,
                        stderr="Execution budget exceeded dominant job deadline.",
                        compile_output=comp_res.stdout,
                        wall_time_ms=0.0,
                        peak_memory_mb=0.0,
                        weight=tc.weight,
                    )
                    testcase_results.append(tc_res)
                    break

                tc_time_limit = tc.time_limit or e_limits.timeout
                tc_mem_limit = tc.memory_limit or int(e_limits.memory_bytes / (1024 * 1024))

                # Calculate bounded timeout for this testcase
                bounded_tc_timeout = tracker.testcase_budget(tc_time_limit)
                tc_exec_limits = ExecutionLimits(
                    timeout=bounded_tc_timeout,
                    cpu=e_limits.cpu,
                    memory_bytes=tc_mem_limit * 1024 * 1024,
                    process_count=e_limits.process_count,
                    output_limit_bytes=e_limits.output_limit_bytes,
                )

                # Execute in clean process
                exec_start = time.monotonic()
                raw_stdin = tc.stdin if getattr(tc, "stdin", None) is not None else getattr(tc, "input", "")
                exec_res: TestcaseExecutionResult = await strategy.execute(
                    workspace=workspace,
                    artifact=artifact,
                    stdin_data=raw_stdin or "",
                    limits=tc_exec_limits,
                )
                exec_wall_ms = exec_res.wall_time_ms
                total_exec_time_ms += exec_wall_ms
                if exec_wall_ms > max_runtime_ms:
                    max_runtime_ms = exec_wall_ms

                peak_mb = round(exec_res.peak_memory_bytes / (1024.0 * 1024.0), 2)
                if peak_mb > max_memory_mb:
                    max_memory_mb = peak_mb

                # Convert to SandboxResult for unified scoring
                sandbox_res = SandboxResult(
                    stdout=exec_res.stdout,
                    stderr=exec_res.stderr,
                    exit_code=exec_res.exit_code,
                    wall_time_ms=round(exec_wall_ms, 2),
                    peak_memory_mb=peak_mb,
                    timed_out=exec_res.timed_out,
                    oom_killed=exec_res.oom_killed,
                    output_limit_exceeded=exec_res.output_limit_exceeded,
                    system_error=exec_res.system_error,
                )

                tc_eval = JudgeEngine.evaluate(
                    sandbox_result=sandbox_res,
                    testcase=tc,
                    compile_output=comp_res.stdout,
                    compile_failed=False,
                    comparison_mode=comparison_mode,
                )

                testcase_results.append(tc_eval)
                if tc_eval.passed:
                    passed_count += 1
                elif dominant_verdict == Verdict.ACCEPTED:
                    dominant_verdict = tc_eval.verdict

                self.obs.record_testcase_execution(
                    language=config.language_id,
                    execution_mode="process_per_testcase",
                    duration_seconds=exec_wall_ms / 1000.0,
                    verdict=tc_eval.verdict.value,
                )

                # Early termination on non-ACCEPTED verdict for hidden testcases
                if not tc_eval.passed and (tc.hidden or idx >= 2):
                    logger.debug("⚡ Early termination on testcase %s (verdict=%s)", tc.id, tc_eval.verdict)
                    break

            # 8. Final Verdict Aggregation
            total_time_ms = (time.monotonic() - t_start) * 1000.0
            overall_success = (passed_count == len(testcases)) and (len(testcases) > 0)
            score = (passed_count / len(testcases) * 100.0) if testcases else 0.0

            result = ExecutionResult(
                success=overall_success,
                submission_id=sub_id,
                job_id=job_id,
                attempt_id=attempt_id,
                lease_id=lease_id,
                node_id=node_id,
                status=ExecutionStatus.FINISHED,
                verdict=dominant_verdict,
                stdout=testcase_results[0].stdout if testcase_results else "",
                stderr=testcase_results[0].stderr if testcase_results else "",
                compile_output=comp_res.stdout,
                memory=max_memory_mb,
                time=round(max_runtime_ms / 1000.0, 3),
                exit_code=testcase_results[0].exit_code if testcase_results else 0,
                testcase_results=testcase_results,
                passed_testcases=passed_count,
                total_testcases=len(testcases),
                score=round(score, 2),
                compile_time_ms=round(compile_ms, 2),
                execution_time_ms=round(total_exec_time_ms, 2),
                total_time_ms=round(total_time_ms, 2),
                latencies={
                    "sandbox_create_ms": round(sandbox_create_ms, 2),
                    "source_write_ms": round(source_write_ms, 2),
                    "startup_ms": round(startup_ms, 2),
                    "compile_ms": round(compile_ms, 2),
                    "artifact_cache_lookup_ms": round(cache_lookup_ms, 2),
                    "execution_ms": round(total_exec_time_ms, 2),
                    "total_ms": round(total_time_ms, 2),
                },
                telemetry={
                    "language": config.language_id,
                    "family": config.family.value,
                    "compiler": config.compiler,
                    "compiler_version": comp_res.compiler_version,
                    "compile_flags": comp_res.compile_flags,
                    "cache_hit": cache_hit,
                    "artifact_cache_hit": cache_hit,
                    "artifact_cache_lookup_ms": round(cache_lookup_ms, 2),
                    "compilation_required": config.requires_compile,
                    "sandbox_profile": config.sandbox_profile,
                },
                completed_at=datetime.now(timezone.utc),
            )
            return result

        except Exception as exc:
            logger.exception("Execution pipeline failure: %s", exc)
            return ExecutionResult(
                success=False,
                submission_id=sub_id,
                job_id=job_id,
                attempt_id=attempt_id,
                lease_id=lease_id,
                node_id=node_id,
                status=ExecutionStatus.FAILED,
                verdict=Verdict.SYSTEM_ERROR,
                error=f"Execution pipeline system error: {exc}",
                total_testcases=len(testcases),
                total_time_ms=round((time.monotonic() - t_start) * 1000.0, 2),
            )

        finally:
            # 9. Guaranteed Workspace Cleanup
            if workspace:
                await Sandbox.cleanup_workspace(workspace)
