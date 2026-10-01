"""
Chaos Computer Club — Medi-Caps Chapter
routers/jobs.py — Asynchronous Job Status & Queue Telemetry Router
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Path, status
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_member_optional, require_admin_or_core
from app.models.db_models import MemberProfile
from app.controllers.job_controller import JobController

router = APIRouter(tags=["Async Jobs & Telemetry"])


class CreateJobRequest(BaseModel):
    queue_name: str = Field(default="judge.pending", description="Target execution queue")
    job_type: str = Field(default="code_execution", description="Job workload classification")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Job execution payload")
    priority: int = Field(default=2, description="Job priority (0=EMERGENCY, 1=HIGH, 2=NORMAL, 3=LOW)")
    idempotency_key: Optional[str] = Field(default=None, description="Optional unique idempotency token")


@router.post(
    "/jobs",
    summary="Enqueue a new asynchronous background execution job",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
async def create_job(
    req: CreateJobRequest,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """
    Direct asynchronous job enqueue endpoint for code evaluation, sandbox runs, or background compute.
    Returns the queued job contract and check_status_url.
    """
    return await JobController.create_job(
        queue_name=req.queue_name,
        job_type=req.job_type,
        payload=req.payload,
        priority=req.priority,
        idempotency_key=req.idempotency_key,
        current_member=current_member,
    )


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
