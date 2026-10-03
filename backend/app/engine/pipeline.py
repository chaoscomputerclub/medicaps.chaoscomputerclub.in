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

    _instance: Optional["LanguageAwareExecutionEngine"] = None

    @classmethod
    def get_instance(cls, cache: Optional[CompilationCache] = None) -> "LanguageAwareExecutionEngine":
        if cls._instance is None:
            cls._instance = cls(cache=cache)
        return cls._instance

    def __init__(self, cache: Optional[CompilationCache] = None) -> None:
        self.cache = cache or CompilationCache(enabled=True)
        self.obs = ExecutionObservability.get_instance()


    @staticmethod
    def resolve_testcase_concurrency(
        family: LanguageFamily,
        testcase_count: int,
        memory_limit_mb: int = 256,
    ) -> int:
        """
        Derives capacity-aware, bounded testcase execution concurrency:
        - Respects settings.MAX_TESTCASE_CONCURRENCY (default 4)
        - Respects available system CPU cores
        - Considers language execution characteristics:
            - VM (Java): JVM heap and metaspace footprint bounded to <= 2
            - COMPILED (C, C++, Rust, Go): binary already compiled, bounded to <= 4
            - INTERPRETED (Python, Node): fresh process bounded to <= 4
        - Heavy memory limits (> 512MB) scale down concurrency to prevent OOM
        - Never exceeds testcase count
        """
        if testcase_count <= 1:
            return 1

        configured = getattr(settings, "MAX_TESTCASE_CONCURRENCY", 4)
        import os
        cpu_cores = os.cpu_count() or 2

        if family == LanguageFamily.VM:
            lang_bound = 2
        elif family == LanguageFamily.COMPILED:
            lang_bound = 4
        else:
            lang_bound = 4

        if memory_limit_mb > 512:
            lang_bound = min(lang_bound, 2)

        return max(1, min(configured, cpu_cores, lang_bound, testcase_count))

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

            # 7. Testcase Execution Stage: capacity-aware bounded execution concurrency
            concurrency = self.resolve_testcase_concurrency(
                family=config.family,
                testcase_count=len(testcases),
                memory_limit_mb=int(e_limits.memory_bytes / (1024 * 1024)),
            )
            semaphore = asyncio.Semaphore(concurrency)
            early_stop_event = asyncio.Event()

            t_exec_start = time.monotonic()

            async def _run_single_tc(idx: int, tc: TestCaseSchema) -> tuple[int, TestCaseResult, float, float]:
                async with semaphore:
                    if early_stop_event.is_set() or tracker.is_expired():
                        verdict = Verdict.TIME_LIMIT_EXCEEDED if tracker.is_expired() else Verdict.INTERNAL_ERROR
                        msg = "Execution budget exceeded dominant job deadline." if tracker.is_expired() else "Execution aborted: earlier failure triggered early-stop."
                        tc_res = TestCaseResult(
                            testcase_id=tc.id,
                            name=tc.name,
                            hidden=tc.hidden,
                            passed=False,
                            verdict=verdict,
                            stderr=msg,
                            compile_output=comp_res.stdout,
                            wall_time_ms=0.0,
                            peak_memory_mb=0.0,
                            weight=tc.weight,
                        )
                        return idx, tc_res, 0.0, 0.0

                    tc_time_limit = tc.time_limit or e_limits.timeout
                    tc_mem_limit = tc.memory_limit or int(e_limits.memory_bytes / (1024 * 1024))

                    try:
                        bounded_tc_timeout = tracker.testcase_budget(tc_time_limit)
                    except Exception as b_err:
                        tc_res = TestCaseResult(
                            testcase_id=tc.id,
                            name=tc.name,
                            hidden=tc.hidden,
                            passed=False,
                            verdict=Verdict.TIME_LIMIT_EXCEEDED,
                            stderr=str(b_err),
                            compile_output=comp_res.stdout,
                            wall_time_ms=0.0,
                            peak_memory_mb=0.0,
                            weight=tc.weight,
                        )
                        return idx, tc_res, 0.0, 0.0

                    tc_exec_limits = ExecutionLimits(
                        timeout=bounded_tc_timeout,
                        cpu=e_limits.cpu,
                        memory_bytes=tc_mem_limit * 1024 * 1024,
                        process_count=e_limits.process_count,
                        output_limit_bytes=e_limits.output_limit_bytes,
                    )

                    # Distinct isolated working directory per testcase
                    tc_run_dir = workspace / "runs" / f"tc_{idx}"
                    tc_run_dir.mkdir(parents=True, exist_ok=True)

                    raw_stdin = tc.stdin if getattr(tc, "stdin", None) is not None else getattr(tc, "input", "")
                    exec_res: TestcaseExecutionResult = await strategy.execute(
                        workspace=workspace,
                        artifact=artifact,
                        stdin_data=raw_stdin or "",
                        limits=tc_exec_limits,
                        run_dir=tc_run_dir,
                    )

                    exec_wall_ms = exec_res.wall_time_ms
                    peak_mb = round(exec_res.peak_memory_bytes / (1024.0 * 1024.0), 2)

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

                    self.obs.record_testcase_execution(
                        language=config.language_id,
                        execution_mode="process_per_testcase",
                        duration_seconds=exec_wall_ms / 1000.0,
                        verdict=tc_eval.verdict.value,
                    )

                    # Early termination trigger on fatal non-ACCEPTED verdict
                    if not tc_eval.passed and (tc.hidden or idx >= 2):
                        logger.debug("⚡ Early termination triggered on testcase %s (verdict=%s)", tc.id, tc_eval.verdict)
                        early_stop_event.set()

                    return idx, tc_eval, exec_wall_ms, peak_mb

            tasks = [_run_single_tc(idx, tc) for idx, tc in enumerate(testcases)]
            run_outcomes = await asyncio.gather(*tasks)

            # Sort strictly back into original testcase order
            run_outcomes_sorted = sorted(run_outcomes, key=lambda x: x[0])
            testcase_results = [item[1] for item in run_outcomes_sorted]

            # Timing & verdict calculations
            total_exec_time_ms = sum(item[2] for item in run_outcomes_sorted)
            max_runtime_ms = max((item[2] for item in run_outcomes_sorted), default=0.0)
            max_memory_mb = max((item[3] for item in run_outcomes_sorted), default=0.0)
            stage_wall_ms = (time.monotonic() - t_exec_start) * 1000.0

            passed_count = sum(1 for tr in testcase_results if tr.passed)
            first_fail = next((tr for tr in testcase_results if not tr.passed), None)
            dominant_verdict = first_fail.verdict if first_fail else Verdict.ACCEPTED

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
                execution_time_ms=round(stage_wall_ms, 2),
                total_time_ms=round(total_time_ms, 2),
                execution_cpu_ms=round(total_exec_time_ms, 2),
                execution_wall_ms=round(stage_wall_ms, 2),
                provider_turnaround_ms=round(total_time_ms, 2),

                latencies={
                    "sandbox_create_ms": round(sandbox_create_ms, 2),
                    "source_write_ms": round(source_write_ms, 2),
                    "startup_ms": round(startup_ms, 2),
                    "compile_ms": round(compile_ms, 2),
                    "artifact_cache_lookup_ms": round(cache_lookup_ms, 2),
                    "execution_ms": round(total_exec_time_ms, 2),
                    "execution_wall_ms": round(stage_wall_ms, 2),
                    "execution_concurrency": concurrency,
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
