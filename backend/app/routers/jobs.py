"""
Chaos Computer Club — Medi-Caps Chapter
routers/jobs.py — Asynchronous Job Status & Queue Telemetry Router
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Path

from app.middleware.auth import get_current_member_optional, require_admin_or_core
from app.models.db_models import MemberProfile
from app.controllers.job_controller import JobController

router = APIRouter(tags=["Async Jobs & Telemetry"])


@router.get(
    "/jobs/{job_id}",
    summary="Query asynchronous background job status and result",
    response_model=Dict[str, Any],
)
async def get_job_status(
    job_id: str = Path(..., description="Unique job execution UUID"),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """
    Check the status of an asynchronous job (e.g. code submission evaluation).
    Returns current state: 'queued', 'processing', 'completed', 'retrying', 'failed', or 'dead_letter'.
    Protected against BOLA / IDOR access to other cadet jobs.
    """
    return await JobController.get_job_status(job_id=job_id, current_member=current_member)


@router.post(
    "/admin/jobs/{queue_name}/dlq/{job_id}/replay",
    summary="Replay a dead-lettered job back into the pending queue",
)
async def replay_dlq_job(
    queue_name: str = Path(..., description="Domain queue name"),
    job_id: str = Path(..., description="Dead-letter job UUID"),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Admin endpoint to safely replay a poisoned or failed job after root cause remediation."""
    return await JobController.replay_dlq_job(queue_name=queue_name, job_id=job_id)


@router.get(
    "/admin/jobs/metrics",
    summary="Retrieve live queue depths and worker metrics across all domains",
)
async def get_queue_metrics(
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Live observability probe into pending, processing, delayed, and dead-letter queue depths."""
    return await JobController.get_queue_metrics()


@router.get(
    "/admin/cache/metrics",
    summary="Retrieve Real-Time Cache Synchronization Engine telemetry",
)
async def get_cache_sync_metrics(
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Live observability probe into CacheSyncEngine counters, hit rates, and SSE stream health."""
    from app.core.cache.metrics import metrics as cache_metrics
    return {
        "status": "operational",
        "cache_sync": cache_metrics.get_all_metrics(),
    }
