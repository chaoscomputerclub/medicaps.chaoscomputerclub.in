"""
Core Docker Engine — Execution Harness
Compiles and executes user code inside persistent containers via exec_run.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional
from uuid import uuid4

from app.engine.docker.pool import get_container, get_workspace_base
from app.engine.schemas import CompileResult, SandboxResult

logger = logging.getLogger("ccc.docker.sandbox")

MAX_OUTPUT_BYTES = 5 * 1024 * 1024  # 5MB output guard
_DOCKER_THREAD_POOL = ThreadPoolExecutor(max_workers=16, thread_name_prefix="ccc-docker")


def _decode(b: Optional[bytes]) -> str:
    if not b:
        return ""
    return b.decode("utf-8", errors="replace")


class CoreDockerSandbox:
    """Executes code inside persistent Docker containers via exec_run."""

    @staticmethod
    def create_workspace() -> Path:
        """Create an ephemeral workspace directory on the host mounted to /workspace."""
        base = get_workspace_base()
        ws_id = str(uuid4())
        ws_path = base / ws_id
        ws_path.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(ws_path, 0o777)
        except Exception:
            pass
        return ws_path

    @staticmethod
    def cleanup_workspace(workspace: Path) -> None:
        """Safely remove ephemeral workspace."""
        try:
            if workspace and workspace.exists():
                shutil.rmtree(workspace, ignore_errors=True)
        except Exception as exc:
            logger.warning("Failed to remove workspace %s: %s", workspace, exc)

    @staticmethod
    async def compile(
        image: str,
        command: list[str],
        workspace: Path,
        time_limit: float = 15.0,
    ) -> CompileResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _DOCKER_THREAD_POOL,
            CoreDockerSandbox._compile_sync,
            image,
            command,
            workspace,
            time_limit,
        )

    @staticmethod
    def _compile_sync(
        image: str,
        command: list[str],
        workspace: Path,
        time_limit: float,
    ) -> CompileResult:
        start = time.monotonic()
        container = get_container(image)
        if not container:
            return CompileResult(success=False, error=f"Container for {image} is unavailable.")

        workspace_base = get_workspace_base()
        try:
            rel = workspace.relative_to(workspace_base)
            container_ws = f"/workspace/{rel}"
        except Exception:
            container_ws = "/workspace"

        # Wrap command in timeout
        if len(command) >= 3 and command[0] == "sh" and command[1] == "-c":
            cmd_wrapped = ["sh", "-c", f"timeout {time_limit} {command[2]}"]
        else:
            cmd_str = " ".join(command)
            cmd_wrapped = ["sh", "-c", f"timeout {time_limit} {cmd_str}"]
        try:
            res = container.exec_run(
                cmd=cmd_wrapped,
                workdir=container_ws,
                stdout=True,
                stderr=True,
                demux=True,
            )
            stdout_b, stderr_b = res.output or (b"", b"")
            stdout = _decode(stdout_b)
            stderr = _decode(stderr_b)
            output = (stdout + "\n" + stderr).strip() if stderr else stdout
            elapsed_ms = (time.monotonic() - start) * 1000

            return CompileResult(
                success=(res.exit_code == 0),
                output=output if res.exit_code == 0 else "",
                error=output if res.exit_code != 0 else "",
                time_ms=round(elapsed_ms, 2),
            )
        except Exception as exc:
            logger.exception("Container compile error: %s", exc)
            return CompileResult(success=False, error=str(exc))

    @staticmethod
    async def run(
        image: str,
        run_cmd: str,
        workspace: Path,
        stdin_data: str = "",
        time_limit: float = 3.0,
        memory_limit_mb: int = 256,
    ) -> SandboxResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _DOCKER_THREAD_POOL,
            CoreDockerSandbox._run_sync,
            image,
            run_cmd,
            workspace,
            stdin_data,
            time_limit,
            memory_limit_mb,
        )

    @staticmethod
    def _run_sync(
        image: str,
        run_cmd: str,
        workspace: Path,
        stdin_data: str,
        time_limit: float,
        memory_limit_mb: int,
    ) -> SandboxResult:
        start = time.monotonic()
        container = get_container(image)
        if not container:
            return SandboxResult(
                stdout="",
                stderr=f"Docker container {image} is not available.",
                exit_code=1,
            )

        workspace_base = get_workspace_base()
        try:
            rel = workspace.relative_to(workspace_base)
            container_ws = f"/workspace/{rel}"
        except Exception:
            container_ws = "/workspace"

        # Write stdin file
        stdin_file = workspace / "stdin.txt"
        stdin_file.write_text(stdin_data, encoding="utf-8")
        try:
            os.chmod(stdin_file, 0o666)
        except Exception:
            pass

        # Execution command wrapped in timeout, ulimit, and time profiling
        # Memory limit in kb
        mem_kb = int(memory_limit_mb * 1024)
        cmd_wrapped = ["sh", "-c", f"ulimit -v {mem_kb}; /usr/bin/time -v timeout {time_limit} {run_cmd}"]

        try:
            res = container.exec_run(
                cmd=cmd_wrapped,
                workdir=container_ws,
                stdout=True,
                stderr=True,
                demux=True,
            )
            stdout_b, stderr_b = res.output or (b"", b"")
            stdout = _decode(stdout_b)
            stderr = _decode(stderr_b)
            exit_code = res.exit_code

            timed_out = (exit_code == 124)
            oom_killed = (exit_code == 137)

            # Parse /usr/bin/time output from stderr
            peak_memory_mb = 0.0
            clean_stderr = []
            for line in stderr.splitlines():
                if "Maximum resident set size (kbytes):" in line:
                    try:
                        peak_memory_mb = int(line.split(":")[1].strip()) / 1024.0
                    except Exception:
                        pass
                elif "Command being timed:" in line or "User time (seconds):" in line or "System time (seconds):" in line or "Percent of CPU this job got:" in line or "Elapsed (wall clock) time" in line or "Average " in line or "Major (requiring I/O)" in line or "Minor (reclaiming a frame)" in line or "Voluntary context switches:" in line or "Involuntary context switches:" in line or "Swaps:" in line or "File system inputs:" in line or "File system outputs:" in line or "Socket messages" in line or "Signals delivered:" in line or "Page size (bytes):" in line or "Exit status:" in line or "Command terminated by signal" in line:
                    continue # filter out time verbose output
                else:
                    clean_stderr.append(line)
            
            stderr = "\n".join(clean_stderr)

            # Check for ulimit-induced memory errors (exit code 1 or 134 often)
            if not oom_killed and exit_code != 0:
                if "MemoryError" in stderr or "std::bad_alloc" in stderr or peak_memory_mb >= memory_limit_mb:
                    oom_killed = True

            if len(stdout) > MAX_OUTPUT_BYTES:
                stdout = stdout[:MAX_OUTPUT_BYTES] + "\n[Output truncated: exceeded 5MB limit]"

            wall_time_ms = (time.monotonic() - start) * 1000

            return SandboxResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                wall_time_ms=round(wall_time_ms, 2),
                peak_memory_mb=round(peak_memory_mb, 2),
                timed_out=timed_out,
                oom_killed=oom_killed,
            )
        except Exception as exc:
            logger.exception("Container run error: %s", exc)
            return SandboxResult(
                stdout="",
                stderr=str(exc),
                exit_code=1,
                wall_time_ms=round((time.monotonic() - start) * 1000, 2),
            )
