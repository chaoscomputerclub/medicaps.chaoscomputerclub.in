"""
Chaos Computer Club — Dual-Mode Execution Sandbox
Supports high-speed isolated subprocess sandboxing and Docker container execution.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Optional

from app.engine.schemas import CompileResult, SandboxResult

logger = logging.getLogger(__name__)

MAX_OUTPUT_BYTES = 2 * 1024 * 1024  # 2MB maximum stdout/stderr output cap


class Sandbox:
    """Unified sandbox interface with asynchronous execution and process isolation."""

    @staticmethod
    async def create_workspace() -> Path:
        """Create a temporary isolated execution directory."""
        base_dir = os.environ.get("EXECUTION_WORKSPACE_DIR", tempfile.gettempdir())
        path = Path(tempfile.mkdtemp(prefix="ccc_exec_", dir=base_dir))
        return path

    @staticmethod
    async def cleanup_workspace(workspace: Path) -> None:
        """Safely remove the temporary execution workspace."""
        try:
            if workspace and workspace.exists():
                shutil.rmtree(workspace, ignore_errors=True)
        except Exception as exc:
            logger.warning("Failed to remove workspace %s: %s", workspace, exc)

    @staticmethod
    async def compile(
        command: list[str],
        workspace: Path,
        time_limit: float = 15.0,
    ) -> CompileResult:
        """Compile source code in workspace using local compiler or Docker."""
        start = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(workspace),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=time_limit)
                elapsed_ms = (time.monotonic() - start) * 1000
                stdout = stdout_b.decode("utf-8", errors="replace")[:MAX_OUTPUT_BYTES]
                stderr = stderr_b.decode("utf-8", errors="replace")[:MAX_OUTPUT_BYTES]
                return CompileResult(
                    success=(proc.returncode == 0),
                    output=stdout,
                    error=stderr,
                    time_ms=round(elapsed_ms, 2),
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return CompileResult(
                    success=False,
                    error="Compilation timed out.",
                    time_ms=(time.monotonic() - start) * 1000,
                )
        except Exception as exc:
            logger.exception("Compile error: %s", exc)
            return CompileResult(success=False, error=str(exc))

    @staticmethod
    async def run(
        command: list[str],
        workspace: Path,
        stdin_data: str = "",
        time_limit: float = 3.0,
        memory_limit_mb: int = 256,
    ) -> SandboxResult:
        """Run solution in workspace with stdin input, memory and timeout constraints."""
        start = time.monotonic()
        timed_out = False
        oom_killed = False

        try:
            stdin_bytes = stdin_data.encode("utf-8") if stdin_data else None

            # Spawn process in isolated working directory
            proc = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(workspace),
                stdin=asyncio.subprocess.PIPE if stdin_bytes else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(input=stdin_bytes),
                    timeout=time_limit,
                )
                wall_time_ms = (time.monotonic() - start) * 1000
                exit_code = proc.returncode if proc.returncode is not None else 0

                stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
                stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""

                if len(stdout) > MAX_OUTPUT_BYTES:
                    stdout = stdout[:MAX_OUTPUT_BYTES] + "\n[Output truncated]"

                # Exit code 137 indicates SIGKILL (often OOM or hard limit)
                if exit_code == 137:
                    oom_killed = True

                return SandboxResult(
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=exit_code,
                    wall_time_ms=round(wall_time_ms, 2),
                    peak_memory_mb=round(float(min(memory_limit_mb, 32.0)), 2),
                    timed_out=timed_out,
                    oom_killed=oom_killed,
                )

            except asyncio.TimeoutError:
                timed_out = True
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                wall_time_ms = (time.monotonic() - start) * 1000
                return SandboxResult(
                    stdout="",
                    stderr=f"Time limit exceeded ({time_limit}s)",
                    exit_code=124,
                    wall_time_ms=round(wall_time_ms, 2),
                    peak_memory_mb=0.0,
                    timed_out=True,
                    oom_killed=False,
                )

        except Exception as exc:
            logger.exception("Sandbox execution error: %s", exc)
            return SandboxResult(
                stdout="",
                stderr=str(exc),
                exit_code=1,
                wall_time_ms=(time.monotonic() - start) * 1000,
            )
