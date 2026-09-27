"""
Chaos Computer Club — Real-Time Cache Synchronization Worker
Consumes synchronization jobs from the 'cache_sync' queue and executes them through CacheSyncEngine.
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache.contracts import CacheSyncEvent, SyncStatus
from app.core.cache.sync_engine import cache_sync_engine
from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, NonRetryableError, RetryableError

logger = logging.getLogger("ccc.worker.cache_sync")


class CacheSyncWorker(BaseQueueWorker):
    """
    Asynchronous worker consuming cache_sync jobs.
    Executes atomic version validation, Redis CAS update/invalidation, and SSE fan-out.
    """

    queue_name: str = "cache_sync"
    default_concurrency: int = 8
    job_timeout_seconds: float = 10.0

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        try:
            event = CacheSyncEvent.model_validate(job.payload)
        except Exception as val_err:
            logger.error("Malformed CacheSyncEvent in job %s: %s", job.id, val_err)
            raise NonRetryableError(f"Invalid CacheSyncEvent payload: {val_err}") from val_err

        try:
            result = await cache_sync_engine.process_event(event, job_id=job.id)
            if result.status == SyncStatus.FAILED:
                # Classify whether retryable
                err_msg = result.error or "Sync failed"
                if "connection" in err_msg.lower() or "timeout" in err_msg.lower():
                    raise RetryableError(err_msg)
                raise NonRetryableError(err_msg)

            return result.model_dump()
        except (RetryableError, NonRetryableError):
            raise
        except Exception as exc:
            logger.exception("Unexpected error in CacheSyncWorker on job %s: %s", job.id, exc)
            raise RetryableError(f"Cache sync worker transient error: {exc}") from exc
