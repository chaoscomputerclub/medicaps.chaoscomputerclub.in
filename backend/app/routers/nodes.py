"""
Chaos Computer Club — Medi-Caps Chapter
routers/nodes.py — Central Distributed Node Fabric Controller API

Handles dynamic registration, real-time heartbeats, outbound job claiming,
and execution result reporting for portable USB compute nodes.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.redis import get_redis
from app.core.worker_registry import WorkerRegistry, WorkerStatus
from app.middleware.auth import require_admin_or_core

logger = logging.getLogger("ccc.routers.nodes")

router = APIRouter(prefix="/nodes", tags=["Distributed Node Fabric"])


# ─── Auth ────────────────────────────────────────────────────────────────────

def _require_node_auth(request: Request) -> None:
    """Validate JUDGE_AGENT_SECRET from Authorization header."""
    secret = settings.JUDGE_AGENT_SECRET
    if not secret:
        logger.warning("JUDGE_AGENT_SECRET not configured — node auth disabled")
        return
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token in Authorization header",
        )
    token = auth_header.removeprefix("Bearer ").strip()
    if token != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid node enrollment token",
        )


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CPUCapability(BaseModel):
    physical_cores: int = Field(default=1, ge=1)
    logical_cores: int = Field(default=1, ge=1)
    architecture: str = Field(default="x86_64")
    model: str = Field(default="Unknown")
    frequency_mhz: Optional[float] = None


class MemoryCapability(BaseModel):
    total_mb: int = Field(..., ge=256)
    available_mb: int = Field(..., ge=128)


class StorageCapability(BaseModel):
    available_gb: float = Field(default=10.0, ge=0.1)
    usb_mode: bool = Field(default=True)


class ContainerCapability(BaseModel):
    runtime: str = Field(default="docker")
    version: str = Field(default="unknown")
    healthy: bool = Field(default=True)


class NetworkCapability(BaseModel):
    connected: bool = Field(default=True)
    interface: str = Field(default="eth0")
    latency_ms: float = Field(default=0.0)


class NodeRegisterRequest(BaseModel):
    node_id: Optional[str] = Field(default=None, description="Persistent hardware UUID if known")
    hostname: str = Field(..., description="Friendly machine name")
    os_name: str = Field(default="linux")
    cpu: CPUCapability
    memory: MemoryCapability
    storage: StorageCapability
    container: ContainerCapability
    network: NetworkCapability
    max_concurrency: int = Field(default=4, ge=1, le=64)
    api_capacity: int = Field(default=4, ge=1, le=64)
    sse_capacity: int = Field(default=1000, ge=10, le=50000)
    judge_capacity: int = Field(default=4, ge=1, le=64)
    capabilities: Dict[str, bool] = Field(
        default_factory=lambda: {"frontend": True, "api": True, "sse": True, "judge": True}
    )
    languages: List[str] = Field(default=["python", "javascript", "cpp", "java"])
    agent_version: str = Field(default="2.1.0")
    protocol_version: str = Field(default="2.0")


class NodeHeartbeatRequest(BaseModel):
    cpu_usage_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    memory_usage_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    available_memory_mb: int = Field(default=1024, ge=0)
    running_jobs: int = Field(default=0, ge=0)
    available_slots: int = Field(default=4, ge=0)
    api_active: int = Field(default=0, ge=0)
    sse_active: int = Field(default=0, ge=0)
    judge_active: int = Field(default=0, ge=0)
    network_status: str = Field(default="healthy")
    docker_status: str = Field(default="healthy")


class NodeClaimRequest(BaseModel):
    timeout_seconds: float = Field(default=2.0, ge=0.0, le=30.0)


class NodeResultRequest(BaseModel):
    job_id: str
    attempt: Optional[int] = None
    lease_id: Optional[str] = None
    verdict: str
    runtime_ms: float = 0.0
    memory_mb: float = 0.0
    testcase_results: Optional[List[Dict[str, Any]]] = None
    compile_output: Optional[str] = None
    error: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_node(
    payload: NodeRegisterRequest,
    request: Request,
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """
    Self-discovery registration for any compute node booted from USB.
    Assigns or confirms node_id and maps capabilities into central scheduler.
    """
    redis = get_redis()
    node_id = payload.node_id or f"node_{uuid4().hex[:12]}"
    
    node_data = {
        "node_id": node_id,
        "hostname": payload.hostname,
        "os_name": payload.os_name,
        "cpu_cores": payload.cpu.physical_cores,
        "cpu_threads": payload.cpu.logical_cores,
        "cpu_model": payload.cpu.model,
        "memory_mb": payload.memory.total_mb,
        "max_concurrency": payload.max_concurrency,
        "api_capacity": payload.api_capacity,
        "sse_capacity": payload.sse_capacity,
        "judge_capacity": payload.judge_capacity,
        "capabilities": json.dumps(payload.capabilities),
        "languages": json.dumps(payload.languages),
        "docker_version": payload.container.version,
        "agent_version": payload.agent_version,
        "protocol_version": payload.protocol_version,
        "status": "ready",
        "registered_at": time.time(),
        "last_heartbeat": time.time(),
        "ip": request.client.host if request.client else "unknown",
    }

    # Register in Redis sets and hashes
    await redis.sadd("ccc:nodes:registered", node_id)
    await redis.hset(f"ccc:node:{node_id}:info", mapping={k: str(v) for k, v in node_data.items()})
    await redis.set(f"ccc:node:{node_id}:heartbeat", str(time.time()), ex=settings.WORKER_HEARTBEAT_TTL_S)

    # Mirror into existing WorkerRegistry for backward compatibility with scheduler
    await WorkerRegistry.register(
        hostname=f"{payload.hostname} ({node_id})",
        cpu_cores=payload.cpu.physical_cores,
        cpu_threads=payload.cpu.logical_cores,
        memory_mb=payload.memory.total_mb,
        max_concurrency=payload.max_concurrency,
        languages=payload.languages,
        agent_version=payload.agent_version,
        docker_version=payload.container.version,
    )

    logger.info(
        "🛸 [Fabric] Node registered: %s (%s, %d threads, %d MB RAM, judge_cap=%d, api_cap=%d, sse_cap=%d)",
        node_id, payload.hostname, payload.cpu.logical_cores, payload.memory.total_mb, payload.judge_capacity, payload.api_capacity, payload.sse_capacity
    )

    return {
        "node_id": node_id,
        "status": "ready",
        "heartbeat_interval_s": settings.WORKER_HEARTBEAT_INTERVAL_S,
        "heartbeat_ttl_s": settings.WORKER_HEARTBEAT_TTL_S,
        "assigned_concurrency": payload.max_concurrency,
        "api_capacity": payload.api_capacity,
        "sse_capacity": payload.sse_capacity,
        "judge_capacity": payload.judge_capacity,
        "queue_name": "fabric",
    }


@router.post("/{node_id}/heartbeat")
async def node_heartbeat(
    node_id: str,
    payload: NodeHeartbeatRequest,
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """
    High-frequency node telemetry ping (every 5-15s).
    Keeps node lease active and reports real-time CPU/RAM/slot saturation.
    """
    redis = get_redis()
    exists = await redis.sismember("ccc:nodes:registered", node_id)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not registered. Please register first.",
        )

    now = time.time()
    await redis.set(f"ccc:node:{node_id}:heartbeat", str(now), ex=settings.WORKER_HEARTBEAT_TTL_S)
    await redis.hset(
        f"ccc:node:{node_id}:info",
        mapping={
            "cpu_usage_pct": str(payload.cpu_usage_pct),
            "memory_usage_pct": str(payload.memory_usage_pct),
            "available_memory_mb": str(payload.available_memory_mb),
            "running_jobs": str(payload.running_jobs),
            "available_slots": str(payload.available_slots),
            "api_active": str(payload.api_active),
            "sse_active": str(payload.sse_active),
            "judge_active": str(payload.judge_active),
            "last_heartbeat": str(now),
            "status": "ready" if payload.docker_status == "healthy" else "degraded",
        },
    )

    return {"status": "ack", "node_id": node_id, "timestamp": now}


@router.post("/{node_id}/claim")
async def claim_job(
    node_id: str,
    payload: NodeClaimRequest = NodeClaimRequest(),
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """
    Outbound REST job claim endpoint with blocking pop / long-polling support.
    Allows remote USB nodes behind NAT/firewalls to atomically dequeue
    a job over standard HTTPS with near-0ms dispatch latency.
    """
    redis = get_redis()
    
    # Verify node is recognized and healthy
    heartbeat_alive = await redis.exists(f"ccc:node:{node_id}:heartbeat")
    if not heartbeat_alive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Node heartbeat expired or not registered",
        )

    processing_queue = "ccc:queue:fabric:processing"
    
    # Step 1: Immediate non-blocking check on primary queue
    job_id = await redis.rpoplpush("ccc:queue:fabric:pending", processing_queue)
    if not job_id:
        # Step 2: Immediate non-blocking check on secondary queue
        processing_queue = "ccc:queue:judge:processing"
        job_id = await redis.rpoplpush("ccc:queue:judge:pending", processing_queue)

    # Step 3: If still empty and caller requested a wait timeout > 0, block on Redis
    timeout_s = max(0.0, min(float(payload.timeout_seconds), 15.0))
    if not job_id and timeout_s > 0:
        processing_queue = "ccc:queue:fabric:processing"
        int_timeout = max(1, int(timeout_s))
        try:
            job_id = await redis.brpoplpush("ccc:queue:fabric:pending", processing_queue, timeout=int_timeout)
        except Exception as exc:
            logger.debug("brpoplpush wait completed without job: %s", exc)
            job_id = None

    if not job_id:
        return {"job": None}

    if isinstance(job_id, bytes):
        job_id = job_id.decode()

    raw_job = await redis.get(f"ccc:job:{job_id}")
    if not raw_job:
        await redis.lrem(processing_queue, 1, job_id)
        return {"job": None}

    job_dict = json.loads(raw_job)

    # Attach distributed lease (300s) and attempt tracking to this node
    now = time.time()
    attempt = int(job_dict.get("attempt", 0)) + 1
    lease_id = f"lease_{job_id}_{attempt}_{node_id}"

    await redis.set(f"ccc:job:{job_id}:leased_at", str(now), ex=300)
    await redis.set(f"ccc:job:{job_id}:node_id", node_id, ex=300)
    await redis.set(f"ccc:job:{job_id}:lease_id", lease_id, ex=300)
    await redis.set(f"ccc:job:{job_id}:attempt", str(attempt), ex=300)

    # Update job state in Redis
    job_dict["status"] = "PROCESSING"
    job_dict["claimed_by_node"] = node_id
    job_dict["attempt"] = attempt
    job_dict["lease_id"] = lease_id
    job_dict["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
    await redis.set(f"ccc:job:{job_id}", json.dumps(job_dict), ex=86400)

    logger.info("⚡ [Fabric] Job %s (attempt %d, lease %s) claimed by node %s", job_id, attempt, lease_id, node_id)
    return {"job": job_dict}


@router.post("/{node_id}/result")
async def submit_result(
    node_id: str,
    payload: NodeResultRequest,
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """
    Receives verified execution results from a remote compute node.
    Enforces fencing & stale attempt protection, releases queues, and publishes SSE/PubSub events.
    """
    redis = get_redis()

    # 1. Fencing and stale-attempt validation: check if lease is still owned by this node & attempt
    active_lease = await redis.get(f"ccc:job:{payload.job_id}:lease_id")
    active_node = await redis.get(f"ccc:job:{payload.job_id}:node_id")

    if active_lease and payload.lease_id and active_lease != payload.lease_id:
        logger.warning(
            "⚠️ [Fabric] Rejecting stale result for job %s from node %s (lease mismatch: expected %s, got %s)",
            payload.job_id, node_id, active_lease, payload.lease_id
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stale result rejected. Active lease is held by another attempt ({active_lease}).",
        )

    if active_node and active_node != node_id:
        logger.warning(
            "⚠️ [Fabric] Rejecting result for job %s from node %s (lease held by node %s)",
            payload.job_id, node_id, active_node
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Node {node_id} does not hold active lease for job {payload.job_id}.",
        )

    # 2. Remove from in-flight processing lists & clear lease keys
    await redis.lrem("ccc:queue:fabric:processing", 1, payload.job_id)
    await redis.lrem("ccc:queue:judge:processing", 1, payload.job_id)
    await redis.delete(f"ccc:job:{payload.job_id}:leased_at")
    await redis.delete(f"ccc:job:{payload.job_id}:node_id")
    await redis.delete(f"ccc:job:{payload.job_id}:lease_id")

    # 3. Update authoritative job record in Redis
    raw_job = await redis.get(f"ccc:job:{payload.job_id}")
    if raw_job:
        job_dict = json.loads(raw_job)
        job_dict["status"] = "COMPLETED"
        res_data = payload.model_dump()
        if res_data.get("testcase_results") is None:
            res_data["testcase_results"] = []
        job_dict["result"] = res_data
        job_dict["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        await redis.set(f"ccc:job:{payload.job_id}", json.dumps(job_dict), ex=86400)

        # Release per-user concurrency slot
        member_id = job_dict.get("payload", {}).get("member_id")
        if member_id:
            from app.core.user_concurrency import release_user_job_slot
            await release_user_job_slot(str(member_id))

        # Broadcast SSE completion event
        contest_slug = job_dict.get("payload", {}).get("contest_slug")
        if contest_slug:
            channel = f"ccc:contest:{contest_slug}"
            event_payload = {
                "event": "submission_completed",
                "job_id": payload.job_id,
                "submission_id": job_dict.get("payload", {}).get("submission_id"),
                "verdict": payload.verdict,
                "runtime_ms": payload.runtime_ms,
                "timestamp": time.time(),
            }
            await redis.publish(channel, json.dumps(event_payload))

        # Publish dedicated job completion channel for 0ms event-driven wakeup
        completion_event = {
            "status": "COMPLETED",
            "job_id": payload.job_id,
            "verdict": payload.verdict,
            "runtime_ms": payload.runtime_ms,
            "timestamp": time.time(),
        }
        await redis.publish(f"ccc:job:{payload.job_id}:done", json.dumps(completion_event))

    logger.info("✓ [Fabric] Job %s completed by node %s with verdict: %s", payload.job_id, node_id, payload.verdict)
    return {"status": "recorded", "job_id": payload.job_id}


@router.post("/{node_id}/drain")
async def drain_node(
    node_id: str,
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """Signals that a compute node is draining before USB removal or host shutdown."""
    redis = get_redis()
    await redis.hset(f"ccc:node:{node_id}:info", "status", "draining")
    logger.info("Node %s entered DRAINING mode", node_id)
    return {"status": "draining", "node_id": node_id}


@router.post("/{node_id}/ready")
async def mark_node_ready(
    node_id: str,
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """Transitions a node back into READY status to accept work."""
    redis = get_redis()
    await redis.hset(f"ccc:node:{node_id}:info", "status", "ready")
    logger.info("Node %s transitioned to READY", node_id)
    return {"status": "ready", "node_id": node_id}


@router.get("/{node_id}")
async def get_node(
    node_id: str,
    _: Any = Depends(require_admin_or_core),
) -> Dict[str, Any]:
    """Retrieve detailed telemetry and configuration for a specific node."""
    redis = get_redis()
    info = await redis.hgetall(f"ccc:node:{node_id}:info")
    if not info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found",
        )
    decoded = {
        (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
        for k, v in info.items()
    }
    decoded["is_online"] = bool(await redis.exists(f"ccc:node:{node_id}:heartbeat"))
    return decoded


@router.get("/{node_id}/health")
async def get_node_health(
    node_id: str,
) -> Dict[str, Any]:
    """Liveness probe for a specific node."""
    redis = get_redis()
    is_online = bool(await redis.exists(f"ccc:node:{node_id}:heartbeat"))
    status_val = await redis.hget(f"ccc:node:{node_id}:info", "status")
    status_str = status_val.decode() if isinstance(status_val, bytes) else str(status_val or "unknown")
    
    return {
        "node_id": node_id,
        "is_online": is_online,
        "status": status_str if is_online else "offline",
    }


@router.get("/{node_id}/capacity")
async def get_node_capacity(
    node_id: str,
) -> Dict[str, Any]:
    """Hardware capacity and saturation report for a specific node."""
    redis = get_redis()
    info = await redis.hgetall(f"ccc:node:{node_id}:info")
    if not info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found",
        )
    decoded = {
        (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
        for k, v in info.items()
    }
    
    return {
        "node_id": node_id,
        "cpu_cores": int(decoded.get("cpu_cores", 1)),
        "cpu_threads": int(decoded.get("cpu_threads", 1)),
        "memory_total_mb": int(decoded.get("memory_mb", 1024)),
        "memory_available_mb": float(decoded.get("available_memory_mb", 512)),
        "api_capacity": int(decoded.get("api_capacity", 4)),
        "api_active": int(decoded.get("api_active", 0)),
        "sse_capacity": int(decoded.get("sse_capacity", 1000)),
        "sse_active": int(decoded.get("sse_active", 0)),
        "judge_capacity": int(decoded.get("max_concurrency", 4)),
        "running_jobs": int(decoded.get("running_jobs", 0)),
        "is_online": bool(await redis.exists(f"ccc:node:{node_id}:heartbeat")),
    }


@router.post("/{node_id}/unregister")
async def unregister_node(
    node_id: str,
    _: None = Depends(_require_node_auth),
) -> Dict[str, Any]:
    """Clean exit: removes node from the fabric."""
    redis = get_redis()
    await redis.srem("ccc:nodes:registered", node_id)
    await redis.delete(f"ccc:node:{node_id}:info")
    await redis.delete(f"ccc:node:{node_id}:heartbeat")
    logger.info("Node %s unregistered from fabric", node_id)
    return {"status": "unregistered", "node_id": node_id}


@router.get("/")
async def list_nodes(
    _: Any = Depends(require_admin_or_core),
) -> Dict[str, Any]:
    """Admin: list all discovered compute nodes and live resource telemetry."""
    redis = get_redis()
    node_ids = await redis.smembers("ccc:nodes:registered")
    nodes = []
    
    for nid in node_ids:
        raw_id = nid.decode() if isinstance(nid, bytes) else str(nid)
        info = await redis.hgetall(f"ccc:node:{raw_id}:info")
        if info:
            decoded = {
                (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
                for k, v in info.items()
            }
            is_active = await redis.exists(f"ccc:node:{raw_id}:heartbeat")
            decoded["is_online"] = bool(is_active)
            nodes.append(decoded)

    return {"total_nodes": len(nodes), "nodes": nodes}


class DispatchTestRequest(BaseModel):
    language: str = "python"
    code: str = "print(40 + 2)\n"
    stdin: str = ""
    expected_output: str = "42"
    time_limit_seconds: float = 5.0


@router.post("/dispatch-test")
async def dispatch_test_job(payload: DispatchTestRequest) -> Dict[str, Any]:
    """
    Test harness: enqueues a test execution into ccc:queue:judge:pending and
    awaits verified execution from an active compute node (e.g. connected laptop).
    """
    from app.engine.providers.distributed_provider import DistributedFabricProvider
    from app.engine.schemas import TestCaseSchema

    provider = DistributedFabricProvider()
    tc = TestCaseSchema(id="test_1", stdin=payload.stdin, expected_output=payload.expected_output)
    res = await provider.execute_batch(
        language=payload.language,
        code=payload.code,
        testcases=[tc],
        time_limit=payload.time_limit_seconds,
    )
    return {
        "success": res.success,
        "verdict": res.verdict.value if hasattr(res.verdict, "value") else str(res.verdict),
        "execution_time_seconds": res.time,
        "memory_mb": res.memory,
        "testcases": [
            {
                "id": t.testcase_id,
                "passed": t.passed,
                "verdict": t.verdict.value if hasattr(t.verdict, "value") else str(t.verdict),
                "stdout": t.stdout,
                "stderr": t.stderr,
                "wall_time_ms": t.wall_time_ms,
            }
            for t in res.testcase_results
        ],
    }
