"""
Chaos Computer Club — Medi-Caps Chapter
core/queue/registry.py — Central Queue & Worker Lifecycle Manager
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, JobPriority
from app.core.queue.redis_queue import RedisQueueEngine
from app.workers.email_worker import EmailWorker
from app.workers.judge_worker import JudgeWorker
from app.workers.contest_worker import ContestLifecycleWorker
from app.workers.webhook_worker import WebhookWorker
from app.workers.maintenance_worker import MaintenanceWorker

logger = logging.getLogger("ccc.queue.manager")


class QueueManager:
    """Orchestrates all asynchronous domain workers and provides producer helpers."""

    _instance: Optional[QueueManager] = None

    def __init__(self):
        self.workers: Dict[str, BaseQueueWorker] = {
            "email": EmailWorker(),
            "judge": JudgeWorker(),
            "contest_lifecycle": ContestLifecycleWorker(),
            "webhooks": WebhookWorker(),
            "maintenance": MaintenanceWorker(),
        }
        self._is_started = False

    @classmethod
    def get_instance(cls) -> "QueueManager":
        """
        Return the singleton. Safe to call at import time — workers are built lazily
        inside __init__ only when get_instance() is first invoked, not at module load.
        """
        if cls._instance is None:
            cls._instance = QueueManager()
        return cls._instance

    def start_all(self) -> List[asyncio.Task]:
        """Start all configured queue workers in the current event loop."""
        if self._is_started:
            return [w._main_task for w in self.workers.values() if w._main_task]

        tasks = []
        for name, worker in self.workers.items():
            t = worker.start()
            tasks.append(t)

        self._is_started = True
        logger.info("✓ All domain queue workers started: %s", list(self.workers.keys()))
        return tasks

    async def stop_all(self, drain_timeout: float = 15.0) -> None:
        """Stop all workers and gracefully drain in-flight jobs."""
        if not self._is_started:
            return

        logger.info("Stopping all queue workers...")
        await asyncio.gather(
            *[worker.stop(drain_timeout=drain_timeout) for worker in self.workers.values()],
            return_exceptions=True,
        )
        self._is_started = False
        logger.info("✓ All queue workers stopped.")

    @staticmethod
    async def enqueue(
        queue_name: str,
        job_type: str,
        payload: Dict[str, Any],
        priority: JobPriority = JobPriority.NORMAL,
        idempotency_key: Optional[str] = None,
        correlation_id: Optional[str] = None,
        max_retries: int = 3,
        backoff_base_seconds: float = 2.0,
        delay_seconds: float = 0.0,
    ) -> JobContract:
        return await RedisQueueEngine.enqueue(
            queue_name=queue_name,
            job_type=job_type,
            payload=payload,
            priority=priority,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            max_retries=max_retries,
            backoff_base_seconds=backoff_base_seconds,
            delay_seconds=delay_seconds,
        )

    @staticmethod
    async def get_job(job_id: str) -> Optional[JobContract]:
        return await RedisQueueEngine.get_job(job_id)


queue_manager = QueueManager.get_instance()
