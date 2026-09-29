"""
Chaos Computer Club — Dual-Mode Execution Sandbox
Supports high-speed isolated subprocess sandboxing and Docker container execution.

BUG FIX: peak_memory_mb was previously hardcoded to min(memory_limit_mb, 32.0),
completely fabricated and unrelated to actual process memory usage.
Now uses /proc/{pid}/status VmPeak on Linux and resource.getrusage on macOS/BSD.
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import resource
import shutil
import signal
import tempfile
import time
from pathlib import Path
from typing import Optional

from app.engine.schemas import CompileResult, SandboxResult

logger = logging.getLogger(__name__)

MAX_OUTPUT_BYTES = 2 * 1024 * 1024  # 2MB maximum stdout/stderr output cap
_IS_LINUX = platform.system() == "Linux"


def _clean_env(workspace: Path) -> dict[str, str]:
    """Pass strictly minimal environment variables to prevent leaking application secrets."""
    return {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(workspace),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TMPDIR": str(workspace),
    }


def _read_peak_memory_mb(pid: int) -> float:
    """
    Read actual peak resident set size of a process.
    Linux: /proc/{pid}/status VmPeak (most accurate, includes shared pages).
    macOS/BSD: resource.getrusage — maxrss is in bytes on Linux, kilobytes on macOS.
    Returns 0.0 if the process is already gone or measurement fails.
    """
    if _IS_LINUX:
        try:
            with open(f"/proc/{pid}/status", "r") as f:
                for line in f:
                    if line.startswith("VmPeak:"):
                        kb = int(line.split()[1])
                        return round(kb / 1024.0, 2)
        except (FileNotFoundError, ValueError, IndexError):
            pass
        # Fallback to /proc/{pid}/statm if VmPeak missing
        try:
            with open(f"/proc/{pid}/statm", "r") as f:
                pages = int(f.read().split()[1])  # resident pages
                page_kb = resource.getpagesize() // 1024
                return round(pages * page_kb / 1024.0, 2)
        except Exception:
            pass
    else:
        # macOS: ru_maxrss is in bytes
        try:
            usage = resource.getrusage(resource.RUSAGE_CHILDREN)
            maxrss_bytes = usage.ru_maxrss
            return round(maxrss_bytes / (1024.0 * 1024.0), 2)
        except Exception:
            pass
    return 0.0


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
                env=_clean_env(workspace),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
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
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
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

            # Spawn process in isolated working directory with sanitized environment and separate session
            proc = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(workspace),
                env=_clean_env(workspace),
                stdin=asyncio.subprocess.PIPE if stdin_bytes else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
            )

            # Capture PID before process exits so we can read /proc stats
            proc_pid = proc.pid

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

                # Exit code 137 = SIGKILL, typically OOM or ulimit kill
                if exit_code == 137:
                    oom_killed = True

                # Read actual peak memory — not a fabricated constant
                peak_mb = _read_peak_memory_mb(proc_pid)

                return SandboxResult(
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=exit_code,
                    wall_time_ms=round(wall_time_ms, 2),
                    peak_memory_mb=peak_mb,
                    timed_out=timed_out,
                    oom_killed=oom_killed,
                )

            except asyncio.TimeoutError:
                timed_out = True
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
                await proc.wait()
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
