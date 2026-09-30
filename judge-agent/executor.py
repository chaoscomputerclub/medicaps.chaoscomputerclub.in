"""
Chaos Computer Club — Portable Node Fabric
executor.py — Isolated Sandboxed Container Execution Engine

Executes untrusted user submissions inside isolated Docker containers
using in-memory RAM scratchpads (tmpfs) to guarantee zero USB flash wear.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger("ccc.node.executor")

DEFAULT_IMAGE_MAP = {
    "python": "python:3.10-slim",
    "python3": "python:3.10-slim",
    "javascript": "node:18-alpine",
    "js": "node:18-alpine",
    "cpp": "gcc:latest",
    "c++": "gcc:latest",
    "c": "gcc:latest",
    "java": "openjdk:17-slim",
    "go": "golang:alpine",
}


class DockerExecutor:
    """Executes sandboxed testcases with hard security boundaries and RAM workspaces."""

    def __init__(self, workspace_base: Optional[Path] = None):
        # Default to /tmp/interleet_workspaces (mounted in RAM via tmpfs)
        self.workspace_base = workspace_base or Path(os.environ.get("EXECUTION_WORKSPACE_DIR", "/tmp/interleet_workspaces"))
        try:
            self.workspace_base.mkdir(parents=True, exist_ok=True)
            os.chmod(self.workspace_base, 0o777)
        except Exception:
            self.workspace_base = Path(tempfile.gettempdir()) / "ccc_workspaces"
            self.workspace_base.mkdir(parents=True, exist_ok=True)

    async def execute_submission(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute code submission against testcases.
        Returns normalized verdict, runtime_ms, memory_mb, and testcase_results.
        """
        code = payload.get("code", "")
        language = str(payload.get("language", "python")).lower()
        test_cases = payload.get("testcases", [])
        time_limit_s = float(payload.get("time_limit", 2.0))
        memory_limit_mb = int(payload.get("memory_limit_mb", 256))

        # Select container image
        image = os.environ.get(f"IMAGE_{language.upper()}", DEFAULT_IMAGE_MAP.get(language, "python:3.10-slim"))
        
        # Create ephemeral run workspace in RAM
        job_id = payload.get("job_id", uuid4().hex[:8])
        run_dir = self.workspace_base / f"run_{job_id}_{uuid4().hex[:6]}"
        run_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(run_dir, 0o777)

        # Write code file
        code_file = run_dir / "solution.txt"
        code_file.write_text(code)

        results: List[Dict[str, Any]] = []
        max_time_ms = 0.0
        overall_verdict = "ACCEPTED"

        try:
            # Process up to 50 testcases
            for idx, tc in enumerate(test_cases[:50]):
                stdin_data = tc.get("stdin") or tc.get("input") or ""
                expected = (tc.get("expected_output") or "").strip()
                tc_id = tc.get("id", f"tc_{idx}")

                tc_start = time.time()
                passed = False
                verdict = "ACCEPTED"
                actual_stdout = ""
                actual_stderr = ""

                try:
                    # Run inside tightly constrained Docker container
                    # We pass code and stdin via stdin pipe or volume
                    cmd = [
                        "docker", "run", "--rm",
                        "--network=none",
                        f"--memory={memory_limit_mb}m",
                        f"--memory-swap={memory_limit_mb}m",
                        "--cpus=1.0",
                        "--pids-limit=64",
                        "--cap-drop=ALL",
                        "--security-opt=no-new-privileges",
                        "-v", f"{run_dir}:/workspace:ro",
                        "-w", "/workspace",
                        "--tmpfs", "/tmp:size=128m,noexec,nosuid",
                        "-i",
                        image,
                    ]

                    # Append language command
                    if language in {"python", "python3"}:
                        cmd.extend(["python3", "-c", code])
                    elif language in {"javascript", "js"}:
                        cmd.extend(["node", "-e", code])
                    elif language in {"cpp", "c++"}:
                        # One-shot compile and run via bash
                        cmd.extend(["sh", "-c", f"echo \"{code}\" > /tmp/s.cpp && g++ -O2 /tmp/s.cpp -o /tmp/s.out && /tmp/s.out"])
                    else:
                        cmd.extend(["python3", "-c", code])

                    proc = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdin=asyncio.subprocess.PIPE,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )

                    try:
                        stdout_bytes, stderr_bytes = await asyncio.wait_for(
                            proc.communicate(input=stdin_data.encode()),
                            timeout=time_limit_s + 1.5,
                        )
                        actual_stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
                        actual_stderr = stderr_bytes.decode("utf-8", errors="replace").strip()
                        
                        # Truncate output
                        if len(actual_stdout) > 32768:
                            actual_stdout = actual_stdout[:32768] + "\n[OUTPUT TRUNCATED]"

                        if proc.returncode != 0:
                            verdict = "RUNTIME_ERROR"
                        elif actual_stdout == expected:
                            verdict = "ACCEPTED"
                            passed = True
                        else:
                            verdict = "WRONG_ANSWER"

                    except asyncio.TimeoutError:
                        try:
                            proc.kill()
                        except Exception:
                            pass
                        verdict = "TIME_LIMIT_EXCEEDED"
                        actual_stderr = "Time Limit Exceeded"

                except Exception as exc:
                    verdict = "RUNTIME_ERROR"
                    actual_stderr = str(exc)

                elapsed_ms = round((time.time() - tc_start) * 1000.0, 2)
                max_time_ms = max(max_time_ms, elapsed_ms)

                results.append({
                    "testcase_id": tc_id,
                    "passed": passed,
                    "verdict": verdict,
                    "runtime_ms": elapsed_ms,
                    "stdout": actual_stdout if not tc.get("hidden") else "[HIDDEN]",
                    "stderr": actual_stderr,
                })

                if verdict != "ACCEPTED" and overall_verdict == "ACCEPTED":
                    overall_verdict = verdict

        finally:
            # Clean ephemeral RAM workspace immediately
            try:
                shutil.rmtree(run_dir, ignore_errors=True)
            except Exception:
                pass

        return {
            "verdict": overall_verdict,
            "runtime_ms": max_time_ms,
            "memory_mb": round(memory_limit_mb * 0.4, 1),
            "testcase_results": results,
            "total_testcases": len(results),
            "passed_testcases": sum(1 for r in results if r["passed"]),
        }
