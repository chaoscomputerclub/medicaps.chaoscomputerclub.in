#!/usr/bin/env python3
"""
CCC Judge Agent — Laptop / Remote Compute Node
================================================
Standalone Python service that:
1. Registers itself with the cloud control plane
2. Sends heartbeats every HEARTBEAT_INTERVAL_S seconds
3. Polls the Redis judge queue and executes submissions via local Docker
4. Reports results back to the cloud API
5. Handles SIGTERM gracefully (drain + unregister)

Usage:
    CLOUD_API_URL=https://medicaps-api.chaoscomputerclub.in/api \
    JUDGE_AGENT_SECRET=your-secret \
    REDIS_URL=redis://143.198.38.205:6379 \
    python3 agent.py

Environment variables (all required in production):
    CLOUD_API_URL         — Base URL of the FastAPI backend (no trailing slash)
    JUDGE_AGENT_SECRET    — Shared secret set as JUDGE_AGENT_SECRET on the server
    REDIS_URL             — Redis URL for the cloud Redis instance
    AGENT_MAX_CONCURRENCY — Max parallel judge jobs (default: 4)
    AGENT_HOSTNAME        — Override hostname (default: socket.gethostname())
    AGENT_VERSION         — Override version string (default: "1.0.0")
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import signal
import socket
import subprocess
import time
from typing import Any, Dict, Optional

import httpx
import redis.asyncio as aioredis

# ─── Configuration ────────────────────────────────────────────────────────────

CLOUD_API_URL: str = os.environ["CLOUD_API_URL"].rstrip("/")
JUDGE_AGENT_SECRET: str = os.environ["JUDGE_AGENT_SECRET"]
REDIS_URL: str = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
AGENT_MAX_CONCURRENCY: int = int(os.environ.get("AGENT_MAX_CONCURRENCY", "4"))
AGENT_HOSTNAME: str = os.environ.get("AGENT_HOSTNAME", socket.gethostname())
AGENT_VERSION: str = os.environ.get("AGENT_VERSION", "1.0.0")

HEARTBEAT_INTERVAL_S: float = float(os.environ.get("HEARTBEAT_INTERVAL_S", "5"))
POLL_TIMEOUT_S: int = int(os.environ.get("POLL_TIMEOUT_S", "2"))
JOB_QUEUE_KEY: str = "ccc:queue:judge:pending"
PROCESSING_KEY: str = "ccc:queue:judge:processing"
JOB_KEY_PREFIX: str = "ccc:job:"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("ccc.judge_agent")

# ─── System Info ──────────────────────────────────────────────────────────────

def _get_cpu_cores() -> int:
    try:
        import psutil
        return psutil.cpu_count(logical=False) or 1
    except ImportError:
        return os.cpu_count() or 1


def _get_cpu_threads() -> int:
    try:
        import psutil
        return psutil.cpu_count(logical=True) or 1
    except ImportError:
        return os.cpu_count() or 1


def _get_memory_mb() -> int:
    try:
        import psutil
        return psutil.virtual_memory().total // (1024 * 1024)
    except ImportError:
        return 4096


def _get_cpu_pct() -> float:
    try:
        import psutil
        return psutil.cpu_percent(interval=0.1)
    except ImportError:
        return 0.0


def _get_ram_free_mb() -> int:
    try:
        import psutil
        return psutil.virtual_memory().available // (1024 * 1024)
    except ImportError:
        return 2048


def _get_docker_version() -> str:
    try:
        result = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True, text=True, timeout=3,
        )
        return result.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


# ─── Agent ────────────────────────────────────────────────────────────────────

class JudgeAgent:
    """
    Standalone judge agent for the gaming laptop (or any remote compute node).

    Architecture:
      - agent.py connects to cloud REDIS directly for job polling (low latency)
      - agent.py calls CLOUD_API_URL for registration, heartbeat, results
      - Docker sandbox executes on local daemon
      - PostgreSQL is NEVER accessed directly from the agent
    """

    SUPPORTED_LANGUAGES = ["python", "javascript", "cpp", "java", "go", "rust", "c"]

    def __init__(self):
        self._worker_id: Optional[str] = None
        self._is_running = False
        self._semaphore = asyncio.Semaphore(AGENT_MAX_CONCURRENCY)
        self._active_tasks: set[asyncio.Task] = set()
        self._redis: Optional[aioredis.Redis] = None
        self._http_client: Optional[httpx.AsyncClient] = None
        self._shutdown_event = asyncio.Event()

    # ─── HTTP helpers ────────────────────────────────────────────────────────

    def _auth_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {JUDGE_AGENT_SECRET}"}

    async def _post(self, path: str, data: dict) -> Optional[dict]:
        try:
            resp = await self._http_client.post(
                f"{CLOUD_API_URL}{path}", json=data, headers=self._auth_headers(), timeout=10.0
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.warning("POST %s failed: %s", path, exc)
            return None

    # ─── Registration ────────────────────────────────────────────────────────

    async def register(self) -> bool:
        payload = {
            "hostname": AGENT_HOSTNAME,
            "cpu_cores": _get_cpu_cores(),
            "cpu_threads": _get_cpu_threads(),
            "memory_mb": _get_memory_mb(),
            "max_concurrency": AGENT_MAX_CONCURRENCY,
            "languages": self.SUPPORTED_LANGUAGES,
            "agent_version": AGENT_VERSION,
            "docker_version": _get_docker_version(),
        }
        result = await self._post("/workers/register", payload)
        if result and "worker_id" in result:
            self._worker_id = result["worker_id"]
            logger.info("✅ Registered as worker: %s", self._worker_id)
            return True
        logger.error("❌ Registration failed: %s", result)
        return False

    # ─── Heartbeat ───────────────────────────────────────────────────────────

    async def _heartbeat_loop(self) -> None:
        consecutive_failures = 0
        while self._is_running:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL_S)
                if not self._is_running:
                    break
                active_jobs = AGENT_MAX_CONCURRENCY - self._semaphore._value
                result = await self._post(
                    f"/workers/{self._worker_id}/heartbeat",
                    {
                        "cpu_pct": _get_cpu_pct(),
                        "ram_free_mb": _get_ram_free_mb(),
                        "running_jobs": active_jobs,
                        "status": "healthy" if active_jobs < AGENT_MAX_CONCURRENCY else "busy",
                    },
                )
                if result:
                    consecutive_failures = 0
                    logger.debug("💓 Heartbeat ack'd (running=%d)", active_jobs)
                else:
                    consecutive_failures += 1
                    if consecutive_failures >= 6:
                        logger.warning("⚠️  6 consecutive heartbeat failures — will re-register")
                        await self.register()
                        consecutive_failures = 0
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.warning("Heartbeat error: %s", exc)

    # ─── Job Execution ───────────────────────────────────────────────────────

    async def _execute_job(self, job_id: str, job: dict) -> None:
        """Execute one job from the queue inside a local Docker sandbox."""
        async with self._semaphore:
            job_type = job.get("job_type", "")
            payload = job.get("payload", {})
            start_ts = time.monotonic()
            logger.info("⚡ Starting job %s (type=%s)", job_id[:8], job_type)

            result_data: Optional[dict] = None
            error: Optional[str] = None
            success = False

            try:
                if job_type == "EVALUATE_ARENA_SUBMISSION":
                    result_data = await self._run_docker_judge(payload)
                    success = True
                elif job_type == "EVALUATE_ASSESSMENT_SUBMISSION":
                    result_data = await self._run_docker_judge(payload)
                    success = True
                else:
                    error = f"Unknown job_type '{job_type}'"
                    logger.warning("Unknown job type: %s", job_type)
            except asyncio.TimeoutError:
                error = "Job execution timed out"
                logger.error("Job %s timed out", job_id[:8])
            except Exception as exc:
                error = str(exc)
                logger.error("Job %s failed: %s", job_id[:8], exc)

            elapsed_ms = (time.monotonic() - start_ts) * 1000

            # Acknowledge completion via cloud API
            ack_path = f"/workers/{self._worker_id}/jobs/{job_id}/complete"
            await self._post(ack_path, {
                "job_id": job_id,
                "success": success,
                "result": result_data,
                "error": error,
                "execution_ms": elapsed_ms,
            })

            # Remove from processing list in Redis
            if self._redis:
                try:
                    await self._redis.lrem(PROCESSING_KEY, 1, job_id)
                except Exception:
                    pass

            logger.info(
                "✓ Job %s done in %.0fms (success=%s)", job_id[:8], elapsed_ms, success
            )

    async def _run_docker_judge(self, payload: dict) -> dict:
        """
        Execute the submission via local Docker.
        This replicates what DockerSandboxProvider does on the cloud,
        but runs on the laptop's Docker daemon with its full CPU/GPU.
        """
        import subprocess
        import tempfile
        import json as jsonlib

        language = payload.get("language", "python")
        code = payload.get("code", "")
        test_cases = payload.get("test_cases", [])  # pre-fetched by cloud before enqueue
        time_limit = float(payload.get("time_limit", 5.0))
        memory_limit_mb = int(payload.get("memory_limit_mb", 256))

        # Map language to Docker image
        image_map = {
            "python": "ccc-judge-python:latest",
            "javascript": "ccc-judge-node:latest",
            "cpp": "ccc-judge-cpp:latest",
            "java": "ccc-judge-java:latest",
            "go": "ccc-judge-go:latest",
        }
        image = image_map.get(language.lower(), "ccc-judge-python:latest")

        # Write code to temp file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".code", delete=False) as f:
            f.write(code)
            code_path = f.name

        results = []
        try:
            for tc in test_cases[:50]:   # Hard cap: never run > 50 test cases per job
                stdin_data = tc.get("input", "")
                expected = tc.get("expected_output", "")
                try:
                    proc = await asyncio.wait_for(
                        asyncio.create_subprocess_exec(
                            "docker", "run", "--rm",
                            "--network=none",
                            f"--memory={memory_limit_mb}m",
                            f"--memory-swap={memory_limit_mb}m",
                            "--cpus=1.0",
                            "--pids-limit=64",
                            "--cap-drop=ALL",
                            "--security-opt=no-new-privileges",
                            "--user=1000:1000",
                            "-i",
                            image,
                            stdin=asyncio.subprocess.PIPE,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        ),
                        timeout=time_limit + 2,
                    )
                    stdout, stderr = await asyncio.wait_for(
                        proc.communicate(input=(stdin_data + "\n" + code).encode()),
                        timeout=time_limit + 2,
                    )
                    actual = stdout.decode("utf-8", errors="replace").strip()
                    # Trim output to 64KB
                    if len(actual) > 65536:
                        actual = actual[:65536] + "\n[OUTPUT TRUNCATED]"
                    verdict = "ACCEPTED" if actual == expected.strip() else "WRONG_ANSWER"
                    results.append({"verdict": verdict, "actual": actual, "expected": expected.strip()})
                except asyncio.TimeoutError:
                    results.append({"verdict": "TIME_LIMIT_EXCEEDED", "actual": "", "expected": expected})
                except Exception as exc:
                    results.append({"verdict": "RUNTIME_ERROR", "actual": str(exc), "expected": expected})
        finally:
            try:
                os.unlink(code_path)
            except Exception:
                pass

        accepted = sum(1 for r in results if r["verdict"] == "ACCEPTED")
        total = len(results)
        return {
            "results": results,
            "accepted_count": accepted,
            "total_count": total,
            "verdict": "ACCEPTED" if accepted == total and total > 0 else "WRONG_ANSWER",
        }

    # ─── Poll Loop ───────────────────────────────────────────────────────────

    async def _poll_loop(self) -> None:
        """Continuously poll Redis for judge jobs and execute them."""
        while self._is_running:
            await self._semaphore.acquire()
            slot_released = False
            try:
                if not self._is_running:
                    return

                # BRPOPLPUSH: atomically dequeue + add to processing
                job_id = await self._redis.brpoplpush(
                    JOB_QUEUE_KEY, PROCESSING_KEY, timeout=POLL_TIMEOUT_S
                )
                if not job_id:
                    self._semaphore.release()
                    slot_released = True
                    continue

                if isinstance(job_id, bytes):
                    job_id = job_id.decode()

                # Fetch job data
                raw = await self._redis.get(f"{JOB_KEY_PREFIX}{job_id}")
                if not raw:
                    logger.warning("Job %s not found in Redis — discarding", job_id)
                    await self._redis.lrem(PROCESSING_KEY, 1, job_id)
                    self._semaphore.release()
                    slot_released = True
                    continue

                job = json.loads(raw)
                # Mark lease timestamp (reaper will reclaim after 300s if we crash)
                await self._redis.set(
                    f"{JOB_KEY_PREFIX}{job_id}:leased_at",
                    str(time.time()),
                    ex=300,
                )

                task = asyncio.create_task(
                    self._execute_job(job_id, job),
                    name=f"job-{job_id[:8]}",
                )
                self._active_tasks.add(task)
                task.add_done_callback(self._active_tasks.discard)
                slot_released = True  # task owns the slot now via semaphore context

            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error("Poll loop error: %s", exc)
                await asyncio.sleep(1.0)
            finally:
                if not slot_released:
                    self._semaphore.release()

    # ─── Lifecycle ───────────────────────────────────────────────────────────

    async def run(self) -> None:
        """Main entry point. Runs until SIGTERM."""
        self._http_client = httpx.AsyncClient(timeout=15.0)
        self._redis = aioredis.from_url(REDIS_URL, decode_responses=False)

        # Wait for Redis to be reachable
        for attempt in range(10):
            try:
                await self._redis.ping()
                logger.info("✅ Redis connected: %s", REDIS_URL)
                break
            except Exception as exc:
                logger.warning("Redis not ready (attempt %d/10): %s", attempt + 1, exc)
                await asyncio.sleep(3.0)
        else:
            raise RuntimeError(f"Cannot connect to Redis at {REDIS_URL}")

        # Register with cloud
        for attempt in range(10):
            if await self.register():
                break
            logger.warning("Registration failed (attempt %d/10), retrying in 5s...", attempt + 1)
            await asyncio.sleep(5.0)
        else:
            raise RuntimeError("Cannot register with cloud API — check CLOUD_API_URL and JUDGE_AGENT_SECRET")

        self._is_running = True
        logger.info(
            "🚀 Judge Agent running (concurrency=%d, hostname=%s, worker_id=%s)",
            AGENT_MAX_CONCURRENCY, AGENT_HOSTNAME, self._worker_id,
        )

        poll_task = asyncio.create_task(self._poll_loop(), name="poll-loop")
        hb_task = asyncio.create_task(self._heartbeat_loop(), name="heartbeat")

        # Block until SIGTERM
        await self._shutdown_event.wait()
        logger.info("🛑 Shutdown signal received — draining...")

        self._is_running = False

        # Signal drain to control plane
        await self._post(f"/workers/{self._worker_id}/drain", {})

        # Cancel poll loop (stop accepting new jobs)
        poll_task.cancel()
        hb_task.cancel()

        # Wait for active tasks to finish
        if self._active_tasks:
            logger.info("Waiting for %d active job(s) to complete...", len(self._active_tasks))
            try:
                await asyncio.wait_for(
                    asyncio.gather(*list(self._active_tasks), return_exceptions=True),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                logger.warning("Drain timed out — force-cancelling active jobs")

        # Unregister cleanly
        await self._post(f"/workers/{self._worker_id}/unregister", {})
        logger.info("✅ Judge Agent shut down cleanly (worker_id=%s)", self._worker_id)

        await self._http_client.aclose()
        await self._redis.aclose()

    def request_shutdown(self) -> None:
        """Called on SIGTERM."""
        self._shutdown_event.set()


# ─── Entrypoint ───────────────────────────────────────────────────────────────

async def main() -> None:
    agent = JudgeAgent()

    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, agent.request_shutdown)
    loop.add_signal_handler(signal.SIGINT, agent.request_shutdown)

    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
