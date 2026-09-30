"""
Chaos Computer Club — Medi-Caps Chapter
routers/workers.py — Worker Registry REST API

Endpoints consumed by the CCC Judge Agent running on the gaming laptop
(or any future compute node). All endpoints require JUDGE_AGENT_SECRET
authentication via Authorization header.

Security: workers initiate outbound HTTPS to this API.
          Redis, PostgreSQL, Docker socket are NEVER exposed publicly.

Endpoints:
  POST /workers/register          — Register and receive worker_id
  POST /workers/{id}/heartbeat    — Send health + resource telemetry
  POST /workers/{id}/drain        — Request graceful drain (stop new jobs)
  POST /workers/{id}/unregister   — Clean shutdown / deregister
  GET  /workers/                  — Admin: list all workers
  GET  /workers/{id}              — Admin: get single worker
  GET  /workers/health            — Public: quick health summary for monitoring
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.worker_registry import WorkerRegistry, WorkerStatus
from app.middleware.auth import require_admin_or_core

logger = logging.getLogger("ccc.routers.workers")

router = APIRouter(prefix="/workers", tags=["Worker Registry"])


# ─── Auth ────────────────────────────────────────────────────────────────────

def _require_agent_auth(request: Request) -> None:
    """Validate JUDGE_AGENT_SECRET from Authorization header."""
    secret = settings.JUDGE_AGENT_SECRET
    if not secret:
        logger.warning("JUDGE_AGENT_SECRET not configured — worker auth disabled")
        return
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = auth_header.removeprefix("Bearer ").strip()
    if token != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid agent secret")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class WorkerRegisterRequest(BaseModel):
    hostname: str = Field(..., description="Machine hostname or friendly name")
    cpu_cores: int = Field(..., ge=1, le=128)
    cpu_threads: int = Field(..., ge=1, le=256)
    memory_mb: int = Field(..., ge=512, le=262144)
    max_concurrency: int = Field(default=4, ge=1, le=32)
    languages: List[str] = Field(default=["python", "javascript", "cpp", "java"])
    agent_version: str = Field(default="unknown")
    docker_version: str = Field(default="unknown")


class WorkerHeartbeatRequest(BaseModel):
    cpu_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    ram_free_mb: int = Field(default=0, ge=0)
    running_jobs: int = Field(default=0, ge=0)
    available_memory_mb: Optional[int] = None
    status: str = Field(default="healthy")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_worker(
    payload: WorkerRegisterRequest,
    request: Request,
    _: None = Depends(_require_agent_auth),
) -> Dict[str, Any]:
    """
    Register a new judge worker. Returns the assigned worker_id and queue config.
    Called once at agent startup. Safe to call again on reconnect (idempotent by hostname).
    """
    info = await WorkerRegistry.register(
        hostname=payload.hostname,
        cpu_cores=payload.cpu_cores,
        cpu_threads=payload.cpu_threads,
        memory_mb=payload.memory_mb,
        max_concurrency=payload.max_concurrency,
        languages=payload.languages,
        agent_version=payload.agent_version,
        docker_version=payload.docker_version,
    )
    logger.info("Worker registered from %s: %s", request.client.host if request.client else "unknown", info.worker_id)
    return {
        "worker_id": info.worker_id,
        "status": "registered",
        "queue_name": "judge",
        "max_concurrency": info.max_concurrency,
        "heartbeat_interval_s": settings.WORKER_HEARTBEAT_INTERVAL_S,
        "heartbeat_ttl_s": settings.WORKER_HEARTBEAT_TTL_S,
    }


@router.post("/{worker_id}/heartbeat")
async def worker_heartbeat(
    worker_id: str,
    payload: WorkerHeartbeatRequest,
    _: None = Depends(_require_agent_auth),
) -> Dict[str, Any]:
    """
    Record a worker heartbeat with current resource telemetry.
    If the heartbeat TTL expires without a renewal, the worker is marked OFFLINE
    and its jobs become eligible for requeue via the visibility-timeout reaper.
    """
    try:
        worker_status = WorkerStatus(payload.status)
    except ValueError:
        worker_status = WorkerStatus.HEALTHY

    known = await WorkerRegistry.heartbeat(
        worker_id=worker_id,
        cpu_pct=payload.cpu_pct,
        ram_free_mb=payload.ram_free_mb,
        running_jobs=payload.running_jobs,
        available_memory_mb=payload.available_memory_mb,
        status=worker_status,
    )
    if not known:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker '{worker_id}' not registered. Call /workers/register first.",
        )
    return {"status": "ack", "worker_id": worker_id}


@router.post("/{worker_id}/drain")
async def drain_worker(
    worker_id: str,
    _: None = Depends(_require_agent_auth),
) -> Dict[str, Any]:
    """
    Signal that this worker is entering DRAINING mode.
    It will complete in-flight jobs but accept no new ones.
    Scheduler stops routing to it immediately.
    """
    info = await WorkerRegistry.get_worker(worker_id)
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    await WorkerRegistry.mark_draining(worker_id)
    return {"status": "draining", "worker_id": worker_id}


@router.post("/{worker_id}/unregister")
async def unregister_worker(
    worker_id: str,
    _: None = Depends(_require_agent_auth),
) -> Dict[str, Any]:
    """
    Clean shutdown: removes worker from registry entirely.
    Called by the agent on graceful SIGTERM after active jobs complete.
    """
    info = await WorkerRegistry.get_worker(worker_id)
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    await WorkerRegistry.unregister(worker_id)
    logger.info("Worker %s cleanly unregistered", worker_id)
    return {"status": "unregistered", "worker_id": worker_id}


# ─── Admin / Monitoring ──────────────────────────────────────────────────────

@router.get("/health")
async def workers_health_summary() -> Dict[str, Any]:
    """Public health summary for monitoring. No auth required."""
    summary = await WorkerRegistry.get_registry_summary()
    # Redact detailed worker info from public endpoint
    return {
        "total_workers": summary["total_workers"],
        "healthy": summary["healthy"],
        "suspect": summary["suspect"],
        "offline": summary["offline"],
        "draining": summary["draining"],
        "total_available_slots": summary["total_available_slots"],
    }


@router.get("/")
async def list_workers(
    _: Any = Depends(require_admin_or_core),
) -> Dict[str, Any]:
    """Admin: full worker registry listing with all telemetry."""
    return await WorkerRegistry.get_registry_summary()


@router.get("/{worker_id}")
async def get_worker(
    worker_id: str,
    _: Any = Depends(require_admin_or_core),
) -> Dict[str, Any]:
    """Admin: get a single worker's current state."""
    info = await WorkerRegistry.get_worker(worker_id)
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    return {
        "worker_id": info.worker_id,
        "hostname": info.hostname,
        "status": info.status.value,
        "cpu_cores": info.cpu_cores,
        "cpu_threads": info.cpu_threads,
        "memory_mb": info.memory_mb,
        "available_memory_mb": info.available_memory_mb,
        "max_concurrency": info.max_concurrency,
        "running_jobs": info.running_jobs,
        "available_slots": info.available_slots,
        "languages": info.languages,
        "cpu_pct": info.cpu_pct,
        "ram_free_mb": info.ram_free_mb,
        "last_heartbeat": info.last_heartbeat,
        "registered_at": info.registered_at,
        "agent_version": info.agent_version,
        "docker_version": info.docker_version,
    }
