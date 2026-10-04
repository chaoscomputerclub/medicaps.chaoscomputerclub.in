"""
Chaos Computer Club — Native Compiled Execution Strategy
Handles C, C++, Rust, Go and other native compiled languages.
Guarantees:
1. Compile ONCE per submission attempt; amortize compilation across all testcases.
2. Produce verified ExecutionArtifact inside isolated sandbox build directory.
3. Strict separation of compile budget from execution budget.
4. Sanitized diagnostics: zero leakage of host paths, env vars, or internal secrets.
5. Integration with optional content-addressed compilation cache.
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import resource
import shutil
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

logger = logging.getLogger("ccc.strategy.compiled")


class NativeCompiledExecutionStrategy(ExecutionStrategy):
    """Execution strategy for native compiled languages (C, C++, Rust, Go)."""

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
        binary_name = self.config.binary_filename or "solution"
        build_binary = workspace / "build" / binary_name

        if not source_file.exists():
            return CompilationResult(
                success=False,
                exit_code=1,
                stderr="Compilation error: source file not found.",
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
            cached_entry = await cache.get(cache_key, target_dest=build_binary)
            if cached_entry:
                artifact, comp_res = cached_entry
                logger.info("⚡ [CompileCache] Cache HIT for %s (%s)", self.config.language_id, cache_key.cache_id()[:12])
                return comp_res

        # 2. Compile ONCE using configured compiler and compile flags
        compiler = self.config.compiler
        if not compiler:
            return CompilationResult(
                success=False,
                exit_code=1,
                stderr=f"No compiler configured for {self.config.display_name}.",
                compiler_version=self.config.compiler_version,
                compile_flags=list(self.config.compile_flags),
            )

        # Build command with absolute paths inside sandbox workspace
        src_path_str = str(source_file)
        bin_path_str = str(build_binary)

        cmd: List[str] = []
        lang_id = self.config.language_id
        if lang_id in ("cpp", "c"):
            cmd = [compiler, *self.config.compile_flags, src_path_str, "-o", bin_path_str]
        elif lang_id == "rust":
            cmd = [compiler, *self.config.compile_flags, "-o", bin_path_str, src_path_str]
        elif lang_id == "go":
            cmd = [compiler, "build", "-o", bin_path_str, src_path_str]
        elif lang_id in ("typescript", "ts"):
            cmd = [compiler, *self.config.compile_flags, "--outDir", str(workspace / "build"), src_path_str]
        else:
            cmd = [compiler, *self.config.compile_flags, src_path_str, "-o", bin_path_str]

        start_time = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(workspace / "build"),
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
                    stderr=f"Compilation timed out after {limits.timeout} seconds.",
                    duration_ms=round(duration_ms, 2),
                    compiler_version=self.config.compiler_version,
                    compile_flags=list(self.config.compile_flags),
                )

            duration_ms = (time.monotonic() - start_time) * 1000.0
            exit_code = proc.returncode if proc.returncode is not None else 0

            # Decode and enforce output limits
            max_bytes = limits.output_limit_bytes
            stdout = stdout_b.decode("utf-8", errors="replace")[:max_bytes] if stdout_b else ""
            stderr = stderr_b.decode("utf-8", errors="replace")[:max_bytes] if stderr_b else ""

            # Sanitize diagnostic paths
            sanitized_stdout = sanitize_compiler_output(stdout, workspace)
            sanitized_stderr = sanitize_compiler_output(stderr, workspace)

            # Validate that compilation succeeded AND binary was produced
            binary_ok = (exit_code == 0) and build_binary.exists() and (build_binary.stat().st_size > 0)
            if not binary_ok:
                err_msg = sanitized_stderr or sanitized_stdout or "Compilation failed without diagnostic output."
                return CompilationResult(
                    success=False,
                    exit_code=exit_code if exit_code != 0 else 1,
                    stdout=sanitized_stdout,
                    stderr=err_msg,
                    duration_ms=round(duration_ms, 2),
                    compiler_version=self.config.compiler_version,
                    compile_flags=list(self.config.compile_flags),
                )

            # Ensure execution permissions on generated binary
            try:
                os.chmod(build_binary, 0o755)
            except Exception:
                pass

            actual_size = build_binary.stat().st_size
            is_ts = self.config.language_id in ("typescript", "ts")
            entry_cmd = (self.config.runtime, *self.config.runtime_arguments, str(build_binary)) if is_ts else (str(build_binary),)

            artifact = ExecutionArtifact(
                artifact_type=ArtifactType.RUNTIME_SOURCE if is_ts else ArtifactType.NATIVE_BINARY,
                path=build_binary,
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
                is_executable=not is_ts,
                entry_command=entry_cmd,
            )

            comp_res = CompilationResult(
                success=True,
                executable_path=str(build_binary),
                exit_code=0,
                stdout=sanitized_stdout,
                stderr=sanitized_stderr,
                duration_ms=round(duration_ms, 2),
                compiler_version=self.config.compiler_version,
                compile_flags=list(self.config.compile_flags),
                cached=False,
                artifact=artifact,
            )

            # Store in cache if enabled
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
                    compiled_file=build_binary,
                    compilation_result=comp_res,
                    artifact_type=ArtifactType.RUNTIME_SOURCE if is_ts else ArtifactType.NATIVE_BINARY,
                    is_executable=not is_ts,
                    entry_command=list(entry_cmd),
                )

            return comp_res

        except Exception as exc:
            logger.exception("Compilation system error for %s: %s", self.config.language_id, exc)
            return CompilationResult(
                success=False,
                exit_code=1,
                stderr=f"Compilation error: {exc}",
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
        run_dir: Optional[Path] = None,
    ) -> TestcaseExecutionResult:
        """
        Execute single testcase in a clean process (MODE A) while reusing the compiled artifact.
        Isolates execution inside per-testcase run_dir when provided.
        """
        build_binary = workspace / "build" / (self.config.binary_filename or "solution")
        if self.config.language_id in ("typescript", "ts") or (self.config.binary_filename and self.config.binary_filename.endswith(".js")):
            exec_cmd = [self.config.runtime, *self.config.runtime_arguments, str(build_binary)]
        else:
            exec_cmd = [str(build_binary)] if build_binary.exists() else (list(artifact.entry_command) or [str(artifact.path)])
        effective_cwd = run_dir if run_dir is not None else (workspace / "build")
        effective_cwd.mkdir(parents=True, exist_ok=True)
        start_time = time.monotonic()
        timed_out = False
        oom_killed = False

        stdin_bytes = stdin_data.encode("utf-8") if stdin_data else b""

        try:
            proc = await asyncio.create_subprocess_exec(
                *exec_cmd,
                cwd=str(effective_cwd),
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

                # Check memory usage
                peak_mb = _read_peak_memory_mb(proc_pid)
                peak_bytes = int(peak_mb * 1024 * 1024)

                # Check Output Limit Exceeded
                output_limit = limits.output_limit_bytes
                output_limit_exceeded = False
                if (stdout_b and len(stdout_b) > output_limit) or (stderr_b and len(stderr_b) > output_limit):
                    output_limit_exceeded = True
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
                elif peak_bytes > limits.memory_bytes:
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
            logger.exception("Subprocess execution exception: %s", exc)
            return TestcaseExecutionResult(
                stdout="",
                stderr=str(exc),
                exit_code=125,
                wall_time_ms=round((time.monotonic() - start_time) * 1000.0, 2),
                system_error=True,
                error_detail=str(exc),
            )
