"""
Chaos Computer Club — Judge queue.

Contest submissions must never block an HTTP worker while code compiles and
runs. Requests enqueue a job and return immediately with a job id; a fixed pool
of workers drains the queue through the configured judge provider.

This is an in-process asyncio queue: correct for one API instance and the right
shape for a Redis/Celery backed queue later, because callers only ever touch
`submit_job` / `get_job`.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Awaitable, Callable, Dict, List, Optional
from uuid import uuid4

from app.engine.providers import ProviderRunRequest, ProviderRunResult, get_judge_provider

logger = logging.getLogger("ccc.judge.queue")

WORKER_COUNT = int(os.getenv("JUDGE_WORKERS", "4"))
JOB_RETENTION = int(os.getenv("JUDGE_JOB_RETENTION", "500"))


@dataclass
class JudgeJob:
    id: str
    status: str = "queued"  # queued | running | done | failed
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    requests: List[ProviderRunRequest] = field(default_factory=list)
    results: List[ProviderRunResult] = field(default_factory=list)
    error: Optional[str] = None
    on_complete: Optional[Callable[["JudgeJob"], Awaitable[None]]] = None

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)

    def as_dict(self) -> dict:
        return {
            "job_id": self.id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "total": len(self.requests),
            "passed": self.passed,
            "error": self.error,
            "results": [
                {
                    "verdict": r.verdict,
                    "passed": r.passed,
                    "stdout": r.stdout,
                    "stderr": r.stderr,
                    "compile_output": r.compile_output,
                    "time_ms": r.time_ms,
                    "memory_kb": r.memory_kb,
                }
                for r in self.results
            ],
        }


class JudgeQueue:
    def __init__(self) -> None:
        self._queue: "asyncio.Queue[JudgeJob]" = asyncio.Queue()
        self._jobs: Dict[str, JudgeJob] = {}
        self._order: List[str] = []
        self._workers: List[asyncio.Task] = []

    async def start(self) -> None:
        if self._workers:
            return
        for index in range(WORKER_COUNT):
            self._workers.append(asyncio.create_task(self._worker(index), name=f"judge-{index}"))
        logger.info("judge queue started with %d workers", WORKER_COUNT)

    async def stop(self) -> None:
        for task in self._workers:
            task.cancel()
        self._workers.clear()

    def _remember(self, job: JudgeJob) -> None:
        self._jobs[job.id] = job
        self._order.append(job.id)
        while len(self._order) > JOB_RETENTION:
            self._jobs.pop(self._order.pop(0), None)

    async def submit_job(
        self,
        requests: List[ProviderRunRequest],
        on_complete: Optional[Callable[[JudgeJob], Awaitable[None]]] = None,
    ) -> JudgeJob:
        await self.start()
        job = JudgeJob(id=str(uuid4()), requests=list(requests), on_complete=on_complete)
        self._remember(job)
        await self._queue.put(job)
        return job

    def get_job(self, job_id: str) -> Optional[JudgeJob]:
        return self._jobs.get(job_id)

    async def run_now(self, requests: List[ProviderRunRequest]) -> List[ProviderRunResult]:
        """Synchronous path for the small sample runs of the `Run` button."""
        return await get_judge_provider().run_batch(list(requests))

    async def _worker(self, index: int) -> None:
        provider = get_judge_provider()
        while True:
            job = await self._queue.get()
            job.status = "running"
            try:
                job.results = await provider.run_batch(job.requests)
                job.status = "done"
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                job.status = "failed"
                job.error = str(exc)
                logger.exception("judge worker %d failed job %s", index, job.id)
            finally:
                job.finished_at = datetime.now(timezone.utc)
                self._queue.task_done()

            if job.on_complete:
                try:
                    await job.on_complete(job)
                except Exception:
                    logger.exception("judge job callback failed for %s", job.id)


judge_queue = JudgeQueue()
