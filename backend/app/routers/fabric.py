"""
Chaos Computer Club — Medi-Caps Chapter
routers/fabric.py — Global Dynamic Distributed Application & Compute Fabric API

Exposes endpoints for fabric health, aggregated capacity, node discovery,
intelligent request routing, and outbound reverse multiplexed tunnel connections.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.fabric_router import GlobalFabricRouter, RequestType, get_fabric_router
from app.core.redis import get_redis
from app.middleware.auth import require_admin_or_core

logger = logging.getLogger("ccc.routers.fabric")

router = APIRouter(prefix="/fabric", tags=["Global Distributed Fabric"])


class RouteSimulationRequest(BaseModel):
    method: str = Field(default="GET", description="HTTP Method")
    path: str = Field(default="/api/contests", description="Target Request Path")


@router.get("/health")
async def get_fabric_health(
    router_svc: GlobalFabricRouter = Depends(get_fabric_router),
) -> Dict[str, Any]:
    """
    Global fabric health check.
    Returns overall fabric readiness, online node count, and health status.
    """
    capacity = await router_svc.get_fabric_capacity()
    active_nodes = capacity["active_healthy_nodes"]
    
    return {
        "status": "operational" if active_nodes > 0 else "degraded",
        "timestamp": time.time(),
        "active_healthy_nodes": active_nodes,
        "total_nodes": capacity["total_registered_nodes"],
        "available_judge_slots": capacity["available_judge_slots"],
        "aggregate_api_capacity": capacity["aggregate_api_capacity"],
        "aggregate_sse_capacity": capacity["aggregate_sse_capacity"],
    }


@router.get("/capacity")
async def get_fabric_capacity(
    router_svc: GlobalFabricRouter = Depends(get_fabric_router),
) -> Dict[str, Any]:
    """
    Aggregates real-time CPU, RAM, API, SSE, and Judge compute capacity
    across all healthy nodes currently registered in the fabric.
    """
    return await router_svc.get_fabric_capacity()


@router.get("/nodes")
async def get_fabric_nodes(
    router_svc: GlobalFabricRouter = Depends(get_fabric_router),
) -> Dict[str, Any]:
    """
    Lists all discovered compute nodes with live telemetry, connectivity status,
    and capability flags.
    """
    nodes = await router_svc.get_all_nodes()
    return {
        "count": len(nodes),
        "nodes": nodes,
    }


@router.post("/route")
async def simulate_route(
    payload: RouteSimulationRequest,
    router_svc: GlobalFabricRouter = Depends(get_fabric_router),
) -> Dict[str, Any]:
    """
    Evaluates where the Global Fabric Router would dispatch a given request.
    Returns the chosen node and multi-factor score breakdown.
    """
    req_type = router_svc.classify_request(payload.method, payload.path)
    scores = await router_svc.score_nodes_for_request(req_type)

    if not scores:
        return {
            "request_type": req_type.value,
            "chosen_node": None,
            "reason": "No online eligible nodes in fabric",
            "scores": [],
        }

    best = scores[0]
    return {
        "request_type": req_type.value,
        "chosen_node": {
            "node_id": best.node_id,
            "hostname": best.hostname,
            "total_score": best.total_score,
            "is_tunnel_connected": best.is_tunnel_connected,
        },
        "scores": [
            {
                "node_id": s.node_id,
                "hostname": s.hostname,
                "total_score": s.total_score,
                "cpu_score": s.cpu_score,
                "memory_score": s.memory_score,
                "api_score": s.api_score,
                "judge_score": s.judge_score,
                "health_score": s.health_score,
                "latency_score": s.latency_score,
                "is_tunnel_connected": s.is_tunnel_connected,
            }
            for s in scores
        ],
    }


@router.websocket("/tunnel/{node_id}")
async def node_reverse_tunnel(
    websocket: WebSocket,
    node_id: str,
    token: Optional[str] = Query(default=None),
    router_svc: GlobalFabricRouter = Depends(get_fabric_router),
):
    """
    Outbound reverse multiplexed WebSocket tunnel.
    Allows laptops/desktops behind NAT/Wi-Fi to register an outbound link
    over which the Cloud Fabric Router can forward incoming HTTP/API requests.
    """
    # Verify enrollment secret if configured
    expected_secret = settings.JUDGE_AGENT_SECRET
    if expected_secret:
        auth_hdr = websocket.headers.get("authorization", "")
        extracted = auth_hdr.removeprefix("Bearer ").strip() if auth_hdr.startswith("Bearer ") else token
        if extracted != expected_secret:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()
    await router_svc.register_tunnel(node_id, websocket)

    try:
        # Send initial tunnel handshake ACK
        await websocket.send_json({
            "type": "TUNNEL_ESTABLISHED",
            "node_id": node_id,
            "timestamp": time.time(),
        })

        while True:
            # Keepalive / frame receiver loop
            msg = await websocket.receive_text()
            data = json.loads(msg)
            msg_type = data.get("type")

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "timestamp": time.time()})
            elif msg_type == "RESPONSE":
                # Handle multiplexed response frames from the node's local workers
                pass
    except WebSocketDisconnect:
        logger.info("Tunnel disconnected for node %s", node_id)
    except Exception as exc:
        logger.warning("Tunnel error for node %s: %s", node_id, exc)
    finally:
        await router_svc.unregister_tunnel(node_id)
