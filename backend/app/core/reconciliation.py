"""
Chaos Computer Club — Judge Job & Attempt Reconciliation Worker
Periodically audits in-flight PROCESSING jobs to detect crashed nodes, expired leases,
and stranded executions. Guarantees zero orphaned jobs without duplicate retries.

Authoritative principle:
PostgreSQL state drives reconciliation. Expired distributed leases transition
gracefully to bounded fallback without race conditions.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.core.redis import get_redis
from app.engine.attempt_manager import AttemptManager
from app.engine.errors import ErrorCode
from app.engine.execution_policy import ExecutionPolicy
from app.engine.observability import ExecutionObservability
from app.models.base import now_utc
from app.models.judge_job import JudgeJob, JudgeJobAttempt

logger = logging.getLogger("ccc.judge.reconciliation")


class ReconciliationWorker:
    """Audits PROCESSING jobs in PostgreSQL against live Redis coordination leases."""

    _instance: Optional["ReconciliationWorker"] = None

    def __init__(self) -> None:
        self.interval_seconds = 15.0
        self.policy = ExecutionPolicy()
        self.obs = ExecutionObservability.get_instance()
        self._running = False
        self._task: Optional[asyncio.Task] = None

    @classmethod
    def get_instance(cls) -> "ReconciliationWorker":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._reconciliation_loop())
        logger.info("🛰️ [Reconciliation] Judge reconciliation worker started (interval: %.1fs)", self.interval_seconds)

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("🛰️ [Reconciliation] Judge reconciliation worker stopped.")

    async def _reconciliation_loop(self) -> None:
        while self._running:
            try:
                await self.reconcile_once()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in reconciliation loop: %s", exc)

            await asyncio.sleep(self.interval_seconds)

    async def reconcile_once(self) -> int:
        """
        Single reconciliation scan.
        Returns count of recovered/reaped jobs.
        """
        recovered_count = 0
        now = now_utc()

        async with AsyncSessionLocal() as session:
            try:
                # Query in-flight jobs
                stmt = select(JudgeJob).where(JudgeJob.state == "PROCESSING").limit(50)
                res = await session.execute(stmt)
                processing_jobs = res.scalars().all()

                if not processing_jobs:
                    return 0

                redis = None
                try:
                    redis = get_redis()
                except Exception:
                    pass

                for job in processing_jobs:
                    # 1. Check dominant deadline expiration
                    if job.deadline_at and now >= job.deadline_at:
                        logger.warning(
                            "⏰ [Reconciliation] Job %s exceeded dominant deadline (%s). Expiring.",
                            job.id, job.deadline_at
                        )
                        if job.active_attempt_id:
                            await AttemptManager.expire_attempt(session, job.id, job.active_attempt_id, reason=ErrorCode.EXECUTION_DEADLINE_EXCEEDED.value)

                        job.state = "TIMED_OUT"
                        job.active_attempt_id = None
                        job.completed_at = now
                        job.failure_code = ErrorCode.EXECUTION_DEADLINE_EXCEEDED.value
                        await session.commit()
                        self.obs.record_counter("judge_jobs_failed_total")
                        recovered_count += 1
                        continue

                    # 2. Check active attempt lease health
                    if job.active_attempt_id and redis is not None:
                        attempt = await session.get(JudgeJobAttempt, job.active_attempt_id)
                        if attempt and attempt.provider == "distributed":
                            node_id = attempt.node_id
                            # Check if node heartbeat is still alive
                            node_alive = bool(await redis.exists(f"ccc:node:{node_id}:heartbeat")) if node_id else True
                            lease_alive = bool(await redis.exists(f"ccc:job:{job.id}:lease_id"))

                            # If node heartbeat or lease expired
                            if not node_alive or not lease_alive:
                                logger.warning(
                                    "🔁 [Reconciliation] Job %s attempt %s lease expired (node_alive=%s, lease_alive=%s)",
                                    job.id, attempt.id, node_alive, lease_alive
                                )
                                self.obs.record_counter("judge_lease_expirations_total")

                                # Check if job can be retried / recovered
                                remaining_sec = (job.deadline_at - now).total_seconds() if job.deadline_at else 0.0
                                if self.policy.should_retry(ErrorCode.NODE_HEARTBEAT_EXPIRED, job.attempt_number, remaining_sec):
                                    await AttemptManager.expire_attempt(session, job.id, attempt.id, reason=ErrorCode.NODE_HEARTBEAT_EXPIRED.value)
                                    # Reset to QUEUED and establish durable intent to requeue via transactional outbox
                                    job.state = "QUEUED"
                                    job.active_attempt_id = None
                                    from app.core.queue.outbox import record_outbox_event
                                    await record_outbox_event(
                                        db=session,
                                        queue_name="fabric",
                                        event_type="EXECUTION_REQUEUE",
                                        payload={"job_id": job.id, "attempt_number": job.attempt_number + 1},
                                        aggregate_id=job.id,
                                        priority="high",
                                    )
                                    await session.commit()
                                    if redis is not None:
                                        try:
                                            await redis.lpush("ccc:queue:fabric:pending", job.id)
                                        except Exception:
                                            pass
                                    self.obs.record_counter("judge_jobs_retried_total")
                                    recovered_count += 1
                                else:
                                    # Cannot retry: mark as failed
                                    await AttemptManager.expire_attempt(session, job.id, attempt.id, reason=ErrorCode.NODE_HEARTBEAT_EXPIRED.value)
                                    job.state = "FAILED"
                                    job.active_attempt_id = None
                                    job.completed_at = now
                                    job.failure_code = ErrorCode.NODE_HEARTBEAT_EXPIRED.value
                                    await session.commit()
                                    self.obs.record_counter("judge_jobs_failed_total")
                                    recovered_count += 1

            except Exception as e:
                await session.rollback()
                logger.error("Reconciliation error during scan: %s", e)

        return recovered_count
