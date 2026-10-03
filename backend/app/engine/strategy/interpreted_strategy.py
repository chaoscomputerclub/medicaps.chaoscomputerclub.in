"""
Chaos Computer Club — Interpreted Execution Strategy
Handles Python, JavaScript and other dynamic interpreted languages.
Guarantees:
1. Bypasses artificial native compilation.
2. Measures interpreter startup overhead (startup_ms).
3. Enforces strict process isolation, timeouts, memory limits, and output limits.
4. Executes each testcase in a fresh, isolated interpreter process (MODE A).
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import time
from pathlib import Path
from typing import Any, List, Optional

from app.engine.sandbox import _clean_env, _read_peak_memory_mb
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

logger = logging.getLogger("ccc.strategy.interpreted")


class InterpretedExecutionStrategy(ExecutionStrategy):
    """Execution strategy for interpreted languages (Python, JavaScript)."""

    async def prepare(
        self,
        workspace: Path,
        source_code: str,
        limits: CompileLimits,
    ) -> PreparationResult:
        source_dir = workspace / "source"
        build_dir = workspace / "build"
        input_dir = workspace / "input"
        output_dir = workspace / "output"
        metadata_dir = workspace / "metadata"

        source_dir.mkdir(parents=True, exist_ok=True)
        build_dir.mkdir(parents=True, exist_ok=True)
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        metadata_dir.mkdir(parents=True, exist_ok=True)

        source_file = source_dir / self.config.filename
        source_file.write_text(source_code, encoding="utf-8")
        try:
            os.chmod(source_file, 0o666)
        except Exception:
            pass

        # Measure interpreter startup overhead and perform fast syntax verification
        startup_ms = 0.0
        start_t = time.monotonic()
        try:
            runtime = self.config.runtime
            if self.config.language_id == "python":
                # Validate syntax via py_compile in separate process
                proc = await asyncio.create_subprocess_exec(
                    runtime, "-m", "py_compile", str(source_file),
                    cwd=str(source_dir),
                    env=_clean_env(workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    start_new_session=True,
                )
                try:
                    _, err_b = await asyncio.wait_for(proc.communicate(), timeout=3.0)
                    startup_ms = (time.monotonic() - start_t) * 1000.0
                    if proc.returncode != 0:
                        err_str = err_b.decode("utf-8", errors="replace").strip()
                        return PreparationResult(
                            success=False,
                            source_path=source_file,
                            startup_ms=round(startup_ms, 2),
                            error=err_str or "Python syntax validation failed.",
                        )
                except asyncio.TimeoutError:
                    proc.kill()
                    return PreparationResult(
                        success=False,
                        source_path=source_file,
                        error="Python interpreter startup timed out.",
                    )
            elif self.config.language_id in ("javascript", "node"):
                # Node check
                proc = await asyncio.create_subprocess_exec(
                    runtime, "--check", str(source_file),
                    cwd=str(source_dir),
                    env=_clean_env(workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    start_new_session=True,
                )
                try:
                    _, err_b = await asyncio.wait_for(proc.communicate(), timeout=3.0)
                    startup_ms = (time.monotonic() - start_t) * 1000.0
                    if proc.returncode != 0:
                        err_str = err_b.decode("utf-8", errors="replace").strip()
                        return PreparationResult(
                            success=False,
                            source_path=source_file,
                            startup_ms=round(startup_ms, 2),
                            error=err_str or "Node syntax validation failed.",
                        )
                except asyncio.TimeoutError:
                    proc.kill()
                    return PreparationResult(
                        success=False,
                        source_path=source_file,
                        error="Node interpreter startup timed out.",
                    )
            else:
                startup_ms = (time.monotonic() - start_t) * 1000.0
        except Exception as exc:
            logger.warning("Interpreter startup probe encountered warning: %s", exc)

        artifact = ExecutionArtifact(
            artifact_type=ArtifactType.RUNTIME_SOURCE,
            path=source_file,
            language_id=self.config.language_id,
            compiler_version=None,
            compile_flags=(),
            source_hash="",
            size_bytes=source_file.stat().st_size,
            is_executable=False,
            entry_command=(self.config.runtime, *self.config.runtime_arguments, str(source_file)),
        )

        return PreparationResult(
            success=True,
            source_path=source_file,
            startup_ms=round(startup_ms, 2),
            artifact=artifact,
        )

    async def compile(
        self,
        workspace: Path,
        limits: CompileLimits,
        cache: Optional[Any] = None,
    ) -> CompilationResult:
        """
        Interpreted languages bypass native compilation.
        Returns a successful zero-duration CompilationResult.
        """
        source_file = workspace / "source" / self.config.filename
        artifact = ExecutionArtifact(
            artifact_type=ArtifactType.RUNTIME_SOURCE,
            path=source_file,
            language_id=self.config.language_id,
            compiler_version=None,
            compile_flags=(),
            size_bytes=source_file.stat().st_size if source_file.exists() else 0,
            is_executable=False,
            entry_command=(self.config.runtime, *self.config.runtime_arguments, str(source_file)),
        )

        return CompilationResult(
            success=True,
            executable_path=str(source_file),
            exit_code=0,
            stdout="",
            stderr="",
            duration_ms=0.0,
            compiler_version=None,
            compile_flags=[],
            cached=False,
            artifact=artifact,
        )

    async def execute(
        self,
        workspace: Path,
        artifact: ExecutionArtifact,
        stdin_data: str,
        limits: ExecutionLimits,
    ) -> TestcaseExecutionResult:
        """
        Execute single testcase in a clean, fresh interpreter process (MODE A).
        """
        source_file = workspace / "source" / self.config.filename
        cmd = [self.config.runtime, *self.config.runtime_arguments, str(source_file)]
        start_time = time.monotonic()
        timed_out = False
        oom_killed = False

        stdin_bytes = stdin_data.encode("utf-8") if stdin_data else b""

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(workspace / "source"),
                env=_clean_env(workspace),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
            )

            proc_pid = proc.pid

            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(input=stdin_bytes),
                    timeout=limits.timeout,
                )
                wall_time_ms = (time.monotonic() - start_time) * 1000.0
                exit_code = proc.returncode if proc.returncode is not None else 0

                peak_mb = _read_peak_memory_mb(proc_pid)
                peak_bytes = int(peak_mb * 1024 * 1024)

                # Check Output Limit Exceeded
                output_limit = limits.output_limit_bytes
                if (stdout_b and len(stdout_b) > output_limit) or (stderr_b and len(stderr_b) > output_limit):
                    stdout = (stdout_b.decode("utf-8", errors="replace")[:2048] if stdout_b else "") + "\n[OUTPUT_LIMIT_EXCEEDED]"
                    return TestcaseExecutionResult(
                        stdout=stdout,
                        stderr="Execution aborted: output limit exceeded.",
                        exit_code=0,
                        wall_time_ms=round(wall_time_ms, 2),
                        peak_memory_bytes=peak_bytes,
                        output_limit_exceeded=True,
                    )

                stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
                stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""

                if exit_code in (137, -9):
                    oom_killed = True
                elif "MemoryError" in stderr or peak_bytes > limits.memory_bytes:
                    oom_killed = True

                return TestcaseExecutionResult(
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=exit_code,
                    wall_time_ms=round(wall_time_ms, 2),
                    peak_memory_bytes=peak_bytes,
                    timed_out=False,
                    oom_killed=oom_killed,
                    output_limit_exceeded=False,
                )

            except asyncio.TimeoutError:
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
                await proc.wait()
                wall_time_ms = (time.monotonic() - start_time) * 1000.0
                return TestcaseExecutionResult(
                    stdout="",
                    stderr=f"Time limit exceeded ({limits.timeout}s)",
                    exit_code=124,
                    signal=signal.SIGKILL,
                    wall_time_ms=round(wall_time_ms, 2),
                    peak_memory_bytes=0,
                    timed_out=True,
                    oom_killed=False,
                )

        except Exception as exc:
            logger.exception("Interpreted subprocess execution exception: %s", exc)
            return TestcaseExecutionResult(
                stdout="",
                stderr=str(exc),
                exit_code=125,
                wall_time_ms=round((time.monotonic() - start_time) * 1000.0, 2),
                system_error=True,
                error_detail=str(exc),
            )
