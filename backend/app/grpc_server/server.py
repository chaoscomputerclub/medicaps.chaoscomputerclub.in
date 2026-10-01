"""
Chaos Computer Club — Medi-Caps Chapter
grpc_server/server.py — High-Performance gRPC Control Plane Servicer (HTTP/2 + TLS)

Handles node enrollment, heartbeats, bidirectional telemetry streaming, atomic job
leases, and result recording directly over gRPC over HTTP/2.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncIterator, Dict, Optional

import grpc
from grpc.aio import Server

from app.core.config import settings
from app.core.redis import get_redis
from app.grpc_stubs import fabric_pb2, fabric_pb2_grpc

logger = logging.getLogger("ccc.fabric.grpc")


class FabricControlPlaneService(fabric_pb2_grpc.FabricControlPlaneServicer):
    """Asynchronous gRPC Servicer implementing FabricControlPlane protocol."""

    async def RegisterNode(
        self,
        request: fabric_pb2.RegisterNodeRequest,
        context: grpc.aio.ServicerContext,
    ) -> fabric_pb2.RegisterNodeResponse:
        logger.info("📡 [gRPC] RegisterNode from %s (%s)", request.node_id, request.hostname)

        # Validate enrollment token against JUDGE_AGENT_SECRET
        expected_secret = getattr(settings, "JUDGE_AGENT_SECRET", "")
        if expected_secret:
            token = (request.enrollment_token or "").replace("Bearer ", "").strip()
            if token != expected_secret:
                context.set_code(grpc.StatusCode.UNAUTHENTICATED)
                context.set_details("Invalid enrollment secret token")
                return fabric_pb2.RegisterNodeResponse()

        redis = get_redis()
        now = time.time()

        # Dynamic capacity targets
        judge_slots = request.capacity.judge_slots or max(2, min(16, (request.hardware.cpu_threads or 4) - 1))
        api_workers = request.capacity.api_workers or max(1, min(8, (request.hardware.cpu_cores or 2)))
        sse_conns = request.capacity.sse_connections or (request.hardware.total_memory_mb // 6)

        node_info = {
            "node_id": request.node_id,
            "hostname": request.hostname,
            "agent_version": request.agent_version or "v2.2.0-grpc",
            "protocol": "grpc_http2",
            "os": request.hardware.os,
            "arch": request.hardware.arch,
            "cpu_cores": str(request.hardware.cpu_cores),
            "cpu_threads": str(request.hardware.cpu_threads),
            "cpu_model": request.hardware.cpu_model,
            "memory_mb": str(request.hardware.total_memory_mb),
            "available_memory_mb": str(request.hardware.available_memory_mb),
            "docker_version": request.hardware.docker_version,
            "docker_healthy": "true" if request.hardware.docker_healthy else "false",
            "max_concurrency": str(judge_slots),
            "api_capacity": str(api_workers),
            "sse_capacity": str(sse_conns),
            "status": "ready",
            "registered_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
            "last_heartbeat": str(now),
        }

        # Store in Redis
        await redis.hset(f"ccc:node:{request.node_id}:info", mapping=node_info)
        await redis.sadd("ccc:nodes:registered", request.node_id)
        await redis.set(f"ccc:node:{request.node_id}:heartbeat", "alive", ex=15)

        logger.info("✓ [gRPC] Node %s registered: %d judge slots, %d API workers", request.node_id, judge_slots, api_workers)

        return fabric_pb2.RegisterNodeResponse(
            node_id=request.node_id,
            status="ready",
            heartbeat_interval_seconds=5,
            assigned_queue="judge",
            max_concurrency=judge_slots,
            message="Node enrolled in Global Fabric Control Plane via gRPC",
        )

    async def SendHeartbeat(
        self,
        request: fabric_pb2.HeartbeatRequest,
        context: grpc.aio.ServicerContext,
    ) -> fabric_pb2.HeartbeatResponse:
        redis = get_redis()
        now = time.time()

        # Update node live telemetry
        telemetry = {
            "last_heartbeat": str(now),
            "cpu_usage_pct": str(request.cpu_usage_pct),
            "memory_usage_pct": str(request.memory_usage_pct),
            "available_memory_mb": str(request.available_memory_mb),
            "running_jobs": str(request.active_jobs),
            "api_active": str(request.active_api_workers),
            "sse_active": str(request.active_sse_conns),
            "latency_ms": str(request.latency_ms),
            "docker_status": "healthy" if request.docker_healthy else "degraded",
        }
        await redis.hset(f"ccc:node:{request.node_id}:info", mapping=telemetry)
        await redis.set(f"ccc:node:{request.node_id}:heartbeat", "alive", ex=15)

        # Check if node was requested to drain
        status_val = await redis.hget(f"ccc:node:{request.node_id}:info", "status")
        status_str = status_val.decode() if isinstance(status_val, bytes) else (status_val or "ready")
        should_drain = (status_str.lower() == "draining")

        return fabric_pb2.HeartbeatResponse(
            acknowledged=True,
            status=status_str,
            should_drain=should_drain,
            timestamp=int(now),
        )

    async def DrainNode(
        self,
        request: fabric_pb2.DrainNodeRequest,
        context: grpc.aio.ServicerContext,
    ) -> fabric_pb2.DrainNodeResponse:
        redis = get_redis()
        await redis.hset(f"ccc:node:{request.node_id}:info", "status", "draining")
        logger.info("🛑 [gRPC] Node %s entering draining mode (Reason: %s)", request.node_id, request.reason)
        return fabric_pb2.DrainNodeResponse(acknowledged=True, status="draining")

    async def MarkReady(
        self,
        request: fabric_pb2.ReadyNodeRequest,
        context: grpc.aio.ServicerContext,
    ) -> fabric_pb2.ReadyNodeResponse:
        redis = get_redis()
        await redis.hset(f"ccc:node:{request.node_id}:info", "status", "ready")
        logger.info("🚀 [gRPC] Node %s marked READY", request.node_id)
        return fabric_pb2.ReadyNodeResponse(acknowledged=True, status="ready")

    async def ClaimJob(
        self,
        request: fabric_pb2.ClaimJobRequest,
        context: grpc.aio.ServicerContext,
    ) -> fabric_pb2.ClaimJobResponse:
        redis = get_redis()

        # Verify node heartbeat
        if not await redis.exists(f"ccc:node:{request.node_id}:heartbeat"):
            context.set_code(grpc.StatusCode.FAILED_PRECONDITION)
            context.set_details("Node heartbeat missing or expired")
            return fabric_pb2.ClaimJobResponse(has_job=False)

        # Atomic queue pop with lease assignment
        processing_queue = "ccc:queue:fabric:processing"
        job_id = await redis.rpoplpush("ccc:queue:fabric:pending", processing_queue)
        if not job_id:
            processing_queue = "ccc:queue:judge:processing"
            job_id = await redis.rpoplpush("ccc:queue:judge:pending", processing_queue)
        if not job_id:
            return fabric_pb2.ClaimJobResponse(has_job=False)

        if isinstance(job_id, bytes):
            job_id = job_id.decode()

        raw_job = await redis.get(f"ccc:job:{job_id}")
        if not raw_job:
            await redis.lrem(processing_queue, 1, job_id)
            return fabric_pb2.ClaimJobResponse(has_job=False)

        job_dict = json.loads(raw_job)
        now = time.time()

        # Attach 300s distributed lease
        await redis.set(f"ccc:job:{job_id}:leased_at", str(now), ex=300)
        await redis.set(f"ccc:job:{job_id}:node_id", request.node_id, ex=300)

        job_dict["status"] = "PROCESSING"
        job_dict["claimed_by_node"] = request.node_id
        job_dict["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        await redis.set(f"ccc:job:{job_id}", json.dumps(job_dict), ex=86400)

        p = job_dict.get("payload", {})
        testcases_pb = []
        for tc in p.get("testcases", []):
            testcases_pb.append(
                fabric_pb2.TestCase(
                    id=str(tc.get("id", "")),
                    stdin=str(tc.get("stdin", "")),
                    expected_output=str(tc.get("expected_output", "")),
                    hidden=bool(tc.get("hidden", False)),
                    weight=float(tc.get("weight", 1.0)),
                )
            )

        job_spec = fabric_pb2.JobSpec(
            job_id=job_id,
            queue_name=job_dict.get("queue_name", "judge"),
            job_type=job_dict.get("job_type", "code_execution"),
            language=p.get("language", ""),
            code=p.get("code", ""),
            time_limit_ms=float(p.get("time_limit_ms", 2000.0)),
            memory_limit_mb=int(p.get("memory_limit_mb", 256)),
            testcases=testcases_pb,
            lease_id=f"lease_{job_id}_{request.node_id}",
            attempt=int(job_dict.get("attempt", 1)),
            submission_id=str(p.get("submission_id", "")),
            contest_slug=str(p.get("contest_slug", "")),
        )

        logger.info("⚡ [gRPC] Job %s claimed by node %s", job_id, request.node_id)
        return fabric_pb2.ClaimJobResponse(has_job=True, job=job_spec)

    async def SubmitResult(
        self,
        request: fabric_pb2.SubmitResultRequest,
        context: grpc.aio.ServicerContext,
    ) -> fabric_pb2.SubmitResultResponse:
        redis = get_redis()

        # 1. Release in-flight processing locks and leases
        await redis.lrem("ccc:queue:fabric:processing", 1, request.job_id)
        await redis.lrem("ccc:queue:judge:processing", 1, request.job_id)
        await redis.delete(f"ccc:job:{request.job_id}:leased_at")
        await redis.delete(f"ccc:job:{request.job_id}:node_id")

        # 2. Update job record in Redis
        raw_job = await redis.get(f"ccc:job:{request.job_id}")
        if raw_job:
            job_dict = json.loads(raw_job)
            res_dict = {
                "verdict": request.verdict,
                "runtime_ms": request.runtime_ms,
                "memory_kb": request.memory_kb,
                "exit_code": request.exit_code,
                "error_message": request.error_message,
                "compiler_output": request.compiler_output,
                "passed_testcases": request.passed_testcases,
                "total_testcases": request.total_testcases,
                "testcase_results": [
                    {
                        "id": tr.id,
                        "passed": tr.passed,
                        "verdict": tr.verdict,
                        "execution_time_ms": tr.execution_time_ms,
                        "stdout": tr.stdout,
                        "stderr": tr.stderr,
                    }
                    for tr in request.testcase_results
                ],
            }
            job_dict["status"] = "COMPLETED"
            job_dict["result"] = res_dict
            job_dict["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            await redis.set(f"ccc:job:{request.job_id}", json.dumps(job_dict), ex=86400)

            # Release per-user concurrency slot if applicable
            member_id = job_dict.get("payload", {}).get("member_id")
            if member_id:
                try:
                    from app.core.user_concurrency import release_user_job_slot
                    await release_user_job_slot(str(member_id))
                except Exception:
                    pass

            # Publish SSE completion event
            contest_slug = job_dict.get("payload", {}).get("contest_slug")
            if contest_slug:
                channel = f"ccc:contest:{contest_slug}"
                event_payload = {
                    "event": "submission_completed",
                    "job_id": request.job_id,
                    "submission_id": job_dict.get("payload", {}).get("submission_id"),
                    "verdict": request.verdict,
                    "runtime_ms": request.runtime_ms,
                    "timestamp": time.time(),
                }
                await redis.publish(channel, json.dumps(event_payload))

        logger.info("✓ [gRPC] Result for job %s received: %s (%.1f ms)", request.job_id, request.verdict, request.runtime_ms)
        return fabric_pb2.SubmitResultResponse(recorded=True, status="recorded")

    async def ConnectFabric(
        self,
        request_iterator: AsyncIterator[fabric_pb2.NodeTelemetry],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[fabric_pb2.FabricCommand]:
        """Bidirectional persistent telemetry and job dispatch stream."""
        logger.info("🌐 [gRPC] Persistent Fabric stream established")
        try:
            async for telemetry in request_iterator:
                # Update heartbeat from stream
                if telemetry.node_id and telemetry.heartbeat:
                    redis = get_redis()
                    await redis.set(f"ccc:node:{telemetry.node_id}:heartbeat", "alive", ex=15)

                # Check if there are queued commands or jobs for this node
                yield fabric_pb2.FabricCommand(type=fabric_pb2.FabricCommand.NOOP)
        except asyncio.CancelledError:
            logger.info("🌐 [gRPC] Fabric stream disconnected")


async def serve_grpc(host: str = "0.0.0.0", port: int = 50051) -> Server:
    """Spawns an async gRPC server listening on host:port."""
    server = grpc.aio.server(
        options=[
            ("grpc.max_send_message_length", 32 * 1024 * 1024),
            ("grpc.max_receive_message_length", 32 * 1024 * 1024),
            ("grpc.keepalive_time_ms", 10000),
            ("grpc.keepalive_timeout_ms", 5000),
            ("grpc.http2.min_ping_interval_without_data_ms", 5000),
        ]
    )
    fabric_pb2_grpc.add_FabricControlPlaneServicer_to_server(FabricControlPlaneService(), server)
    server.add_insecure_port(f"{host}:{port}")
    await server.start()
    logger.info("🚀 [gRPC] Fabric Control Plane server running on %s:%d (HTTP/2)", host, port)
    return server
