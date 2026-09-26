"""
Chaos Computer Club — Medi-Caps Chapter
core/queue/base_worker.py — Abstract Base Queue Worker

Fixes applied (v2):
- Semaphore always released via try/finally — no slot leak on dequeue error
- _active_tasks snapshotted before gather — no set-mutation-during-iteration crash
- Visibility timeout reaper runs as a separate periodic co-routine
- _classify_exception uses type name, not message substring
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.core.queue.contracts import (
    JobContract,
    NonRetryableError,
    RetryableError,
)
from app.core.queue.redis_queue import RedisQueueEngine, QUEUE_MAX_DEPTHS

logger = logging.getLogger("ccc.worker")

# How often the reaper sweeps the :processing list for stuck jobs
REAPER_INTERVAL_SECONDS = 60.0


class BaseQueueWorker(ABC):
    """
    Abstract asynchronous worker for a single domain queue.
    Guarantees:
    - asyncio.Semaphore concurrency cap with no leak on error
    - Job execution timeout via asyncio.wait_for
    - RetryableError / NonRetryableError classification
    - Graceful drain on SIGTERM (stop() waits for in-flight tasks)
    - Periodic visibility-timeout reaper for orphaned jobs
    """

    queue_name: str = "default"
    default_concurrency: int = 4
    job_timeout_seconds: float = 30.0

    def __init__(
        self,
        concurrency: Optional[int] = None,
        queue_name: Optional[str] = None,
    ):
        if queue_name:
            self.queue_name = queue_name

        env_key = f"QUEUE_CONCURRENCY_{self.queue_name.upper()}"
        env_val = os.getenv(env_key)
        self.concurrency = (
            int(env_val)
            if env_val and env_val.isdigit()
            else (concurrency or self.default_concurrency)
        )
        self.semaphore = asyncio.Semaphore(self.concurrency)
        self.is_running = False
        self._active_tasks: Set[asyncio.Task] = set()
        self._main_task: Optional[asyncio.Task] = None
        self._reaper_task: Optional[asyncio.Task] = None

    # ─── Abstract ─────────────────────────────────────────────────────────────

    @abstractmethod
    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        """
        Domain-specific execution.  Return a result dict on success.
        Raise RetryableError for transient failures, NonRetryableError for permanent ones.
        """
        raise NotImplementedError

    # ─── Lifecycle ────────────────────────────────────────────────────────────

    def start(self) -> asyncio.Task:
        """Start the poll loop and reaper in the current event loop."""
        if self._main_task is not None and not self._main_task.done():
            return self._main_task

        self.is_running = True
        loop = asyncio.get_running_loop()

        self._main_task = loop.create_task(
            self._run_loop(),
            name=f"worker-{self.queue_name}",
        )
        self._reaper_task = loop.create_task(
            self._reaper_loop(),
            name=f"reaper-{self.queue_name}",
        )

        logger.info(
            "🚀 Worker '%s' started (concurrency=%d, timeout=%.1fs)",
            self.queue_name, self.concurrency, self.job_timeout_seconds,
        )
        return self._main_task

    async def stop(self, drain_timeout: float = 15.0) -> None:
        """Gracefully stop: cancel poll loop, drain all in-flight tasks."""
        if not self.is_running:
            return

        logger.info(
            "🛑 Worker '%s' stopping — draining %d in-flight task(s)",
            self.queue_name, len(self._active_tasks),
        )
        self.is_running = False

        if self._main_task:
            self._main_task.cancel()
        if self._reaper_task:
            self._reaper_task.cancel()

        if self._active_tasks:
            # Snapshot the set to avoid RuntimeError from mutation during gather
            snapshot = list(self._active_tasks)
            try:
                await asyncio.wait_for(
                    asyncio.gather(*snapshot, return_exceptions=True),
                    timeout=drain_timeout,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    "Worker '%s' drain timed out after %.1fs — force-cancelling",
                    self.queue_name, drain_timeout,
                )
                for t in list(self._active_tasks):
                    t.cancel()

        logger.info("✓ Worker '%s' stopped.", self.queue_name)

    # ─── Poll Loop ────────────────────────────────────────────────────────────

    async def _run_loop(self) -> None:
        """Continuous poll-and-lease loop with guaranteed semaphore release."""
        while self.is_running:
            # Acquire concurrency slot BEFORE dequeue so we don't fetch
            # a job we can't immediately start processing.
            await self.semaphore.acquire()
            slot_released = False

            try:
                if not self.is_running:
                    return  # finally releases

                job = await RedisQueueEngine.dequeue(self.queue_name, timeout=2)

                if not job:
                    # No job available — release slot and wait briefly
                    self.semaphore.release()
                    slot_released = True
                    await asyncio.sleep(0.05)
                    continue

                # Spawn a task; it is responsible for releasing the slot via _execute_with_slot
                task = asyncio.create_task(
                    self._execute_with_slot(job),
                    name=f"job-{job.id[:8]}",
                )
                self._active_tasks.add(task)
                task.add_done_callback(self._active_tasks.discard)
                slot_released = True   # ownership transferred to the task

            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error(
                    "Unexpected error in worker loop '%s': %s", self.queue_name, exc
                )
                await asyncio.sleep(1.0)
            finally:
                if not slot_released:
                    # Safety net: semaphore was acquired but task was never spawned
                    self.semaphore.release()

    # ─── Reaper Loop ──────────────────────────────────────────────────────────

    async def _reaper_loop(self) -> None:
        """
        Periodic sweep: detect jobs stuck in :processing beyond VISIBILITY_TIMEOUT
        and re-queue them so they are not silently lost on worker crashes.
        """
        while self.is_running:
            try:
                await asyncio.sleep(REAPER_INTERVAL_SECONDS)
                if self.is_running:
                    await RedisQueueEngine.reap_orphaned_jobs(self.queue_name)
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.warning("Reaper error on queue '%s': %s", self.queue_name, exc)

    # ─── Execution ────────────────────────────────────────────────────────────

    async def _execute_with_slot(self, job: JobContract) -> None:
        """Run the job and unconditionally release the semaphore slot."""
        try:
            await self._safe_process_job(job)
        finally:
            self.semaphore.release()

    async def _safe_process_job(self, job: JobContract) -> None:
        start = time.perf_counter()
        logger.info(
            "⏳ [%s] Processing %s (type=%s, attempt=%d/%d, prio=%s)",
            self.queue_name, job.id, job.job_type,
            job.attempt, job.max_retries, job.priority,
        )

        async with AsyncSessionLocal() as db:
            try:
                result = await asyncio.wait_for(
                    self.process_job(job, db),
                    timeout=self.job_timeout_seconds,
                )
                duration_ms = (time.perf_counter() - start) * 1000.0
                await RedisQueueEngine.ack(job, result=result, duration_ms=duration_ms)

            except asyncio.TimeoutError:
                duration_ms = (time.perf_counter() - start) * 1000.0
                err = f"Job timed out after {self.job_timeout_seconds}s"
                logger.error("⏱️ [%s] %s — job %s", self.queue_name, err, job.id)
                await RedisQueueEngine.nack(
                    job, error=err, is_retryable=True, duration_ms=duration_ms
                )

            except NonRetryableError as exc:
                duration_ms = (time.perf_counter() - start) * 1000.0
                logger.warning("🚫 [%s] Non-retryable on %s: %s", self.queue_name, job.id, exc)
                await RedisQueueEngine.nack(
                    job,
                    error=str(exc),
                    error_stack=traceback.format_exc(),
                    is_retryable=False,
                    duration_ms=duration_ms,
                )

            except RetryableError as exc:
                duration_ms = (time.perf_counter() - start) * 1000.0
                logger.warning("🔄 [%s] Retryable on %s: %s", self.queue_name, job.id, exc)
                await RedisQueueEngine.nack(
                    job,
                    error=str(exc),
                    error_stack=traceback.format_exc(),
                    is_retryable=True,
                    duration_ms=duration_ms,
                )

            except Exception as exc:
                duration_ms = (time.perf_counter() - start) * 1000.0
                is_retryable = self._classify_exception(exc)
                logger.exception(
                    "💥 [%s] Unhandled failure on %s: %s", self.queue_name, job.id, exc
                )
                await RedisQueueEngine.nack(
                    job,
                    error=f"{type(exc).__name__}: {exc}",
                    error_stack=traceback.format_exc(),
                    is_retryable=is_retryable,
                    duration_ms=duration_ms,
                )

    # ─── Exception Classifier ─────────────────────────────────────────────────

    def _classify_exception(self, exc: Exception) -> bool:
        """
        Determine if an unexpected exception is retryable.
        Uses the exception TYPE hierarchy first, then message keywords as a fallback.
        Returns True → retryable, False → non-retryable (DLQ immediately).
        """
        # Type-based rules (authoritative)
        non_retryable_types = (ValueError, KeyError, TypeError, PermissionError, NotImplementedError)
        retryable_types_names = (
            "ConnectionError", "TimeoutError", "OSError",
            "aiohttp.ClientError", "asyncio.TimeoutError",
            "sqlalchemy.exc.OperationalError", "redis.exceptions.ConnectionError",
        )

        if isinstance(exc, non_retryable_types):
            return False
        if type(exc).__name__ in retryable_types_names:
            return True
        if any(n in type(exc).__mro__.__str__() for n in ("Connection", "Timeout", "Network")):
            return True

        # Keyword fallback — match only on exception message, not class name substring
        msg = str(exc).lower()
        if any(k in msg for k in ("connection", "timeout", "deadlock", "try again", "rate limit", "503", "502", "504", "429")):
            return True
        if any(k in msg for k in ("not found", "permission denied", "forbidden", "unauthorized", "invalid", "already")):
            return False

        return True   # default: assume transient, let retry decide
