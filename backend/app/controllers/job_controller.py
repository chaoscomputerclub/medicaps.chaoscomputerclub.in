"""
Chaos Computer Club — Medi-Caps Chapter
controllers/job_controller.py — Job Status Telemetry & DLQ Management Controller
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from fastapi import HTTPException, status

from app.core.queue.redis_queue import RedisQueueEngine
from app.models.db_models import MemberProfile

logger = logging.getLogger("ccc.controller.jobs")


class JobController:
    """Manages asynchronous job status queries, BOLA authorization, and DLQ operations."""

    @staticmethod
    async def get_job_status(
        job_id: str,
        current_member: Optional[MemberProfile] = None,
    ) -> Dict[str, Any]:
        job = await RedisQueueEngine.get_job(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job '{job_id}' not found or has expired from retention.",
            )

        # IDOR / BOLA Prevention: Verify referenced member ownership
        payload_member_id = job.payload.get("member_id")
        if payload_member_id:
            if not current_member:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to inspect this job.",
                )
            is_owner = current_member.id == payload_member_id
            is_staff = bool(getattr(current_member, "is_core_member", False) or getattr(current_member, "role", "cadet") in ("admin", "core", "maintainer"))
            if not is_owner and not is_staff:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You are not authorized to inspect this job.",
                )

        return {
            "job_id": job.id,
            "queue_name": job.queue_name,
            "job_type": job.job_type,
            "status": job.status.value if hasattr(job.status, "value") else job.status,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "attempt": job.attempt,
            "max_retries": job.max_retries,
            "error": job.error,
            "result": job.result,
            "duration_ms": job.execution_duration_ms,
        }

    @staticmethod
    async def replay_dlq_job(
        queue_name: str,
        job_id: str,
    ) -> Dict[str, Any]:
        success = await RedisQueueEngine.replay_dlq_job(queue_name, job_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job '{job_id}' not found in dead-letter queue '{queue_name}'",
            )
        return {
            "success": True,
            "queue_name": queue_name,
            "job_id": job_id,
            "message": f"Dead-letter job {job_id} successfully re-enqueued into '{queue_name}'.",
        }

    @staticmethod
    async def get_queue_metrics() -> Dict[str, Any]:
        queue_metrics = await RedisQueueEngine.get_all_metrics()
        from app.core.cache.metrics import metrics as cache_metrics
        return {
            "status": "operational",
            "queues": queue_metrics,
            "cache_sync": cache_metrics.get_all_metrics(),
        }
