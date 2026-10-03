"""
Chaos Computer Club — VM Execution Strategy (Java)
Handles Java and bytecode VM languages.
Guarantees:
1. Compiles ONCE per submission attempt (javac -> .class files in /workspace/build).
2. Reuses JVM class files across all testcases.
3. Clean JVM process per testcase (MODE A) with bounded heap memory (-Xmx256m -Xms32m).
4. Full integration with compilation cache.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, List, Optional

if TYPE_CHECKING:
    from app.engine.compilation_cache import CompilationCache, CompilationCacheKey
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
    sanitize_compiler_output,
)

logger = logging.getLogger("ccc.strategy.vm")


class VMExecutionStrategy(ExecutionStrategy):
    """Execution strategy for VM-based languages (Java)."""

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

        return PreparationResult(
            success=True,
            source_path=source_file,
            startup_ms=0.0,
        )

    async def compile(
        self,
        workspace: Path,
        limits: CompileLimits,
        cache: Optional[CompilationCache] = None,
    ) -> CompilationResult:
        source_file = workspace / "source" / self.config.filename
        build_dir = workspace / "build"
        class_file = build_dir / "Main.class"

        if not source_file.exists():
            return CompilationResult(
                success=False,
                exit_code=1,
                stderr="Java compilation error: Main.java not found.",
                compiler_version=self.config.compiler_version,
                compile_flags=list(self.config.compile_flags),
            )

        source_code = source_file.read_text(encoding="utf-8")
        from app.engine.compilation_cache import CompilationCacheKey

        # 1. Check Compilation Cache
        if cache and cache.enabled:
            cache_key = CompilationCacheKey.create(
                language_id=self.config.language_id,
                source_code=source_code,
                compiler_version=self.config.compiler_version,
                compile_flags=self.config.compile_flags,
                sandbox_profile_version=self.config.sandbox_profile,
            )
            cached_entry = await cache.get(cache_key, target_dest=class_file)
            if cached_entry:
                artifact, comp_res = cached_entry
                logger.info("⚡ [CompileCache] Cache HIT for Java (%s)", cache_key.cache_id()[:12])
                return comp_res

        compiler = self.config.compiler or "javac"
        cmd = [compiler, "-d", str(build_dir), str(source_file)]

        start_time = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(workspace / "source"),
                env=_clean_env(workspace),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
            )

            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=limits.timeout,
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
                duration_ms = (time.monotonic() - start_time) * 1000.0
                return CompilationResult(
                    success=False,
                    exit_code=124,
                    signal=signal.SIGKILL,
                    stderr=f"Java compilation timed out after {limits.timeout} seconds.",
                    duration_ms=round(duration_ms, 2),
                    compiler_version=self.config.compiler_version,
                    compile_flags=list(self.config.compile_flags),
                )

            duration_ms = (time.monotonic() - start_time) * 1000.0
            exit_code = proc.returncode if proc.returncode is not None else 0

            max_bytes = limits.output_limit_bytes
            stdout = stdout_b.decode("utf-8", errors="replace")[:max_bytes] if stdout_b else ""
            stderr = stderr_b.decode("utf-8", errors="replace")[:max_bytes] if stderr_b else ""

            sanitized_stdout = sanitize_compiler_output(stdout, workspace)
            sanitized_stderr = sanitize_compiler_output(stderr, workspace)

            # Check that Main.class exists
            if exit_code != 0 or not class_file.exists() or class_file.stat().st_size == 0:
                err_msg = sanitized_stderr or sanitized_stdout or "Java compilation failed."
                return CompilationResult(
                    success=False,
                    exit_code=exit_code if exit_code != 0 else 1,
                    stdout=sanitized_stdout,
                    stderr=err_msg,
                    duration_ms=round(duration_ms, 2),
                    compiler_version=self.config.compiler_version,
                    compile_flags=list(self.config.compile_flags),
                )

            actual_size = class_file.stat().st_size
            entry_cmd = [self.config.runtime, *self.config.runtime_arguments, "-cp", str(build_dir), "Main"]

            artifact = ExecutionArtifact(
                artifact_type=ArtifactType.CLASS_FILES,
                path=class_file,
                language_id=self.config.language_id,
                compiler_version=self.config.compiler_version,
                compile_flags=tuple(self.config.compile_flags),
                source_hash=CompilationCacheKey.create(
                    language_id=self.config.language_id,
                    source_code=source_code,
                    compiler_version=self.config.compiler_version,
                    compile_flags=self.config.compile_flags,
                ).source_hash,
                size_bytes=actual_size,
                is_executable=False,
                entry_command=tuple(entry_cmd),
            )

            comp_res = CompilationResult(
                success=True,
                executable_path=str(class_file),
                exit_code=0,
                stdout=sanitized_stdout,
                stderr=sanitized_stderr,
                duration_ms=round(duration_ms, 2),
                compiler_version=self.config.compiler_version,
                compile_flags=list(self.config.compile_flags),
                cached=False,
                artifact=artifact,
            )

            if cache and cache.enabled:
                cache_key = CompilationCacheKey.create(
                    language_id=self.config.language_id,
                    source_code=source_code,
                    compiler_version=self.config.compiler_version,
                    compile_flags=self.config.compile_flags,
                    sandbox_profile_version=self.config.sandbox_profile,
                )
                await cache.put(
                    key=cache_key,
                    compiled_file=class_file,
                    compilation_result=comp_res,
                    artifact_type=ArtifactType.CLASS_FILES,
                    is_executable=False,
                    entry_command=entry_cmd,
                )

            return comp_res

        except Exception as exc:
            logger.exception("Java compilation system error: %s", exc)
            return CompilationResult(
                success=False,
                exit_code=1,
                stderr=f"Java compilation error: {exc}",
                duration_ms=round((time.monotonic() - start_time) * 1000.0, 2),
                compiler_version=self.config.compiler_version,
                compile_flags=list(self.config.compile_flags),
            )

    async def execute(
        self,
        workspace: Path,
        artifact: ExecutionArtifact,
        stdin_data: str,
        limits: ExecutionLimits,
    ) -> TestcaseExecutionResult:
        """
        Execute single testcase in a clean JVM process (MODE A).
        """
        build_dir = workspace / "build"
        cmd = [self.config.runtime, *self.config.runtime_arguments, "-cp", str(build_dir), "Main"]
        start_time = time.monotonic()
        timed_out = False
        oom_killed = False

        stdin_bytes = stdin_data.encode("utf-8") if stdin_data else b""

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(build_dir),
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
                elif "OutOfMemoryError" in stderr or peak_bytes > limits.memory_bytes:
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
            logger.exception("JVM subprocess execution exception: %s", exc)
            return TestcaseExecutionResult(
                stdout="",
                stderr=str(exc),
                exit_code=125,
                wall_time_ms=round((time.monotonic() - start_time) * 1000.0, 2),
                system_error=True,
                error_detail=str(exc),
            )
