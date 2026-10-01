"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_grpc_fabric_service.py — Verification of gRPC Fabric Control Plane (HTTP/2 + Protobuf)
"""

import pytest
import grpc
from unittest.mock import AsyncMock, patch

from app.grpc_stubs import fabric_pb2, fabric_pb2_grpc
from app.grpc_server.server import FabricControlPlaneService, serve_grpc


@pytest.mark.asyncio
async def test_grpc_node_registration_and_heartbeat():
    # Start ephemeral in-process gRPC test server
    server = await serve_grpc(host="127.0.0.1", port=50099)
    try:
        async with grpc.aio.insecure_channel("127.0.0.1:50099") as channel:
            stub = fabric_pb2_grpc.FabricControlPlaneStub(channel)

            # 1. Test RegisterNode RPC
            reg_req = fabric_pb2.RegisterNodeRequest(
                node_id="node_grpc_test_01",
                hostname="test-laptop",
                enrollment_token="ccc_judge_agent_secret_prod_2026",
                hardware=fabric_pb2.HardwareSpecs(
                    cpu_cores=8,
                    cpu_threads=16,
                    cpu_model="AMD Ryzen 7",
                    total_memory_mb=16384,
                    available_memory_mb=12000,
                    docker_healthy=True,
                ),
                capacity=fabric_pb2.DynamicCapacity(
                    judge_slots=10,
                    api_workers=4,
                    sse_connections=2000,
                ),
            )
            reg_resp = await stub.RegisterNode(reg_req)
            assert reg_resp.node_id == "node_grpc_test_01"
            assert reg_resp.status == "ready"
            assert reg_resp.max_concurrency == 10

            # 2. Test SendHeartbeat RPC
            hb_req = fabric_pb2.HeartbeatRequest(
                node_id="node_grpc_test_01",
                cpu_usage_pct=25.5,
                memory_usage_pct=35.0,
                available_memory_mb=10500,
                active_jobs=2,
                active_api_workers=1,
                active_sse_conns=50,
                latency_ms=12.4,
                docker_healthy=True,
            )
            hb_resp = await stub.SendHeartbeat(hb_req)
            assert hb_resp.acknowledged is True
            assert hb_resp.should_drain is False

            # 3. Test DrainNode RPC
            drain_resp = await stub.DrainNode(fabric_pb2.DrainNodeRequest(node_id="node_grpc_test_01", reason="USB unplugged"))
            assert drain_resp.acknowledged is True
            assert drain_resp.status == "draining"

            # 4. Test MarkReady RPC
            ready_resp = await stub.MarkReady(fabric_pb2.ReadyNodeRequest(node_id="node_grpc_test_01"))
            assert ready_resp.acknowledged is True
            assert ready_resp.status == "ready"
    finally:
        await server.stop(grace=None)
