"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_global_fabric_architecture.py — Verification of Global Distributed Fabric
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.fabric_router import GlobalFabricRouter, RequestType, NodeScore
from app.routers.fabric import RouteSimulationRequest


def test_request_classification():
    router = GlobalFabricRouter()

    assert router.classify_request("GET", "/api/health") == RequestType.HEALTH
    assert router.classify_request("GET", "/api/v1/fabric/health") == RequestType.HEALTH
    assert router.classify_request("GET", "/admin/settings") == RequestType.ADMIN
    assert router.classify_request("GET", "/assets/main-D9x3.js") == RequestType.STATIC
    assert router.classify_request("GET", "/fonts/inter.woff2") == RequestType.STATIC
    assert router.classify_request("GET", "/api/events/stream/contest_live") == RequestType.SSE
    assert router.classify_request("POST", "/api/auth/otp/send") == RequestType.AUTH
    assert router.classify_request("POST", "/api/contests/winter-2026/run") == RequestType.JUDGE_RUN
    assert router.classify_request("POST", "/api/contests/winter-2026/submit") == RequestType.JUDGE_SUBMIT
    assert router.classify_request("GET", "/api/contests/winter-2026/leaderboard") == RequestType.API_READ
    assert router.classify_request("POST", "/api/contests/winter-2026/register") == RequestType.API_WRITE


@pytest.mark.asyncio
async def test_node_scoring_and_selection():
    router = GlobalFabricRouter()

    mock_nodes = [
        {
            "node_id": "node_laptop_1",
            "hostname": "gaming-laptop",
            "is_online": True,
            "status": "ready",
            "cpu_usage_pct": "20.0",
            "memory_usage_pct": "30.0",
            "available_memory_mb": "5800",
            "memory_mb": "8192",
            "running_jobs": "1",
            "max_concurrency": "6",
            "api_active": "0",
            "api_capacity": "4",
            "latency_ms": "5.0",
            "docker_status": "healthy",
            "capabilities": json.dumps({"frontend": True, "api": True, "sse": True, "judge": True}),
        },
        {
            "node_id": "node_cloud_vps",
            "hostname": "vps-control-plane",
            "is_online": True,
            "status": "ready",
            "cpu_usage_pct": "75.0",
            "memory_usage_pct": "70.0",
            "available_memory_mb": "1200",
            "memory_mb": "4096",
            "running_jobs": "2",
            "max_concurrency": "2",
            "api_active": "3",
            "api_capacity": "4",
            "latency_ms": "15.0",
            "docker_status": "healthy",
            "capabilities": json.dumps({"frontend": True, "api": True, "sse": True, "judge": True}),
        },
        {
            "node_id": "node_offline_lab",
            "hostname": "lab-pc-3",
            "is_online": False,
            "status": "offline",
            "cpu_usage_pct": "0.0",
            "capabilities": json.dumps({"frontend": True, "api": True, "sse": True, "judge": True}),
        },
    ]

    with patch.object(router, "get_all_nodes", AsyncMock(return_value=mock_nodes)):
        scores = await router.score_nodes_for_request(RequestType.JUDGE_RUN)
        
        # Offline node must be excluded
        scored_ids = [s.node_id for s in scores]
        assert "node_offline_lab" not in scored_ids
        assert len(scores) == 2

        # Gaming laptop has much higher CPU/RAM availability, so it should rank #1
        best = scores[0]
        assert best.node_id == "node_laptop_1"
        assert best.total_score > scores[1].total_score


@pytest.mark.asyncio
async def test_fabric_capacity_aggregation():
    router = GlobalFabricRouter()

    mock_nodes = [
        {
            "node_id": "node_1",
            "is_online": True,
            "status": "ready",
            "cpu_threads": "12",
            "memory_mb": "8192",
            "available_memory_mb": "6000",
            "max_concurrency": "6",
            "running_jobs": "2",
            "api_capacity": "4",
            "sse_capacity": "1000",
        },
        {
            "node_id": "node_2",
            "is_online": True,
            "status": "ready",
            "cpu_threads": "8",
            "memory_mb": "16384",
            "available_memory_mb": "12000",
            "max_concurrency": "8",
            "running_jobs": "1",
            "api_capacity": "6",
            "sse_capacity": "1500",
        },
    ]

    with patch.object(router, "get_all_nodes", AsyncMock(return_value=mock_nodes)):
        cap = await router.get_fabric_capacity()

        assert cap["total_registered_nodes"] == 2
        assert cap["active_healthy_nodes"] == 2
        assert cap["aggregate_cpu_threads"] == 20
        assert cap["aggregate_memory_mb"] == 24576
        assert cap["aggregate_judge_slots"] == 14
        assert cap["in_flight_judge_jobs"] == 3
        assert cap["available_judge_slots"] == 11
        assert cap["aggregate_api_capacity"] == 10
        assert cap["aggregate_sse_capacity"] == 2500


@pytest.mark.asyncio
async def test_fabric_router_endpoints():
    from httpx import AsyncClient, ASGITransport
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fabric Health
        resp = await client.get("/api/v1/fabric/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "active_healthy_nodes" in data

        # 2. Fabric Capacity
        resp = await client.get("/api/v1/fabric/capacity")
        assert resp.status_code == 200
        cap_data = resp.json()
        assert "total_registered_nodes" in cap_data
        assert "scoring_weights" in cap_data

        # 3. Fabric Route Simulation
        resp = await client.post("/api/v1/fabric/route", json={"method": "GET", "path": "/api/contests"})
        assert resp.status_code == 200
        route_data = resp.json()
        assert route_data["request_type"] == "API_READ"
        assert "chosen_node" in route_data


@pytest.mark.asyncio
async def test_jobs_enqueue_and_query_endpoints():
    from httpx import AsyncClient, ASGITransport
    from main import app
    from app.core.queue.redis_queue import RedisQueueEngine
    from app.core.queue.contracts import JobContract, JobState, JobPriority

    dummy_job = JobContract(
        id="test-job-uuid-1234",
        queue_name="judge.pending",
        job_type="code_execution",
        payload={"language": "python", "code": "print('hello')"},
        status=JobState.QUEUED,
        priority=JobPriority.NORMAL,
    )

    with patch.object(RedisQueueEngine, "enqueue", AsyncMock(return_value=dummy_job)), \
         patch.object(RedisQueueEngine, "get_job", AsyncMock(return_value=dummy_job)):

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Enqueue job
            resp = await client.post(
                "/api/v1/jobs",
                json={
                    "queue_name": "judge.pending",
                    "job_type": "code_execution",
                    "payload": {"language": "python", "code": "print('hello')"},
                    "priority": 2,
                },
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["job_id"] == "test-job-uuid-1234"
            assert data["status"] == "queued"
            assert data["check_status_url"] == "/api/jobs/test-job-uuid-1234"

            # 2. Query job status
            resp2 = await client.get("/api/v1/jobs/test-job-uuid-1234")
            assert resp2.status_code == 200
            status_data = resp2.json()
            assert status_data["job_id"] == "test-job-uuid-1234"
            assert status_data["status"] == "queued"

