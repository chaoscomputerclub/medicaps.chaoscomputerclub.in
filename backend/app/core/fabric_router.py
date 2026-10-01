"""
Chaos Computer Club — Medi-Caps Chapter
core/fabric_router.py — Global Fabric Router & Intelligent Load Balancer

Implements the Tier-1 Global Request Routing layer:
1. Request classification (STATIC, API_READ, API_WRITE, SSE, AUTH, JUDGE_RUN, JUDGE_SUBMIT, ADMIN, HEALTH)
2. Live node registry evaluation and weighted multi-factor scoring
3. Capability matching (frontend, api, sse, judge, languages)
4. Active reverse tunnel connection registry for zero-inbound-port nodes
5. Dynamic total fabric capacity aggregation
"""

from __future__ import annotations

import asyncio
import enum
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger("ccc.fabric.router")


class RequestType(str, enum.Enum):
    STATIC = "STATIC"
    API_READ = "API_READ"
    API_WRITE = "API_WRITE"
    SSE = "SSE"
    AUTH = "AUTH"
    JUDGE_RUN = "JUDGE_RUN"
    JUDGE_SUBMIT = "JUDGE_SUBMIT"
    ADMIN = "ADMIN"
    HEALTH = "HEALTH"


@dataclass
class NodeScore:
    node_id: str
    hostname: str
    total_score: float
    cpu_score: float
    memory_score: float
    api_score: float
    judge_score: float
    health_score: float
    latency_score: float
    is_tunnel_connected: bool
    status: str
    details: Dict[str, Any] = field(default_factory=dict)


class GlobalFabricRouter:
    """
    Global Fabric Router & Weighted Dispatcher.
    Evaluates incoming requests, scores healthy nodes, and dispatches workloads.
    """

    _instance: Optional["GlobalFabricRouter"] = None

    def __init__(self) -> None:
        # Configurable scoring weights
        self.w_cpu = float(os.getenv("FABRIC_WEIGHT_CPU", "0.25"))
        self.w_mem = float(os.getenv("FABRIC_WEIGHT_MEMORY", "0.20"))
        self.w_api = float(os.getenv("FABRIC_WEIGHT_API", "0.20"))
        self.w_judge = float(os.getenv("FABRIC_WEIGHT_JUDGE", "0.15"))
        self.w_health = float(os.getenv("FABRIC_WEIGHT_HEALTH", "0.10"))
        self.w_latency = float(os.getenv("FABRIC_WEIGHT_LATENCY", "0.10"))

        # Active reverse tunnel channels (node_id -> WebSocket or tunnel handler)
        self._active_tunnels: Dict[str, Any] = {}
        self._tunnel_lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "GlobalFabricRouter":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ─── Request Classification ─────────────────────────────────────────────────

    def classify_request(self, method: str, path: str) -> RequestType:
        """Classify incoming HTTP requests into distinct resource profiles."""
        method = method.upper()
        clean_path = path.strip().lower()

        if clean_path in {"/api/health", "/api/v1/fabric/health", "/health"}:
            return RequestType.HEALTH

        if clean_path.startswith("/admin") or clean_path.startswith("/api/admin"):
            return RequestType.ADMIN

        if clean_path.startswith("/assets/") or clean_path.startswith("/fonts/") or clean_path.startswith("/monacoeditorwork/"):
            return RequestType.STATIC

        if clean_path.endswith((".js", ".css", ".png", ".jpg", ".webp", ".svg", ".ico", ".woff", ".woff2")):
            return RequestType.STATIC

        if clean_path.startswith("/api/events/") or clean_path.startswith("/api/v1/events/"):
            return RequestType.SSE

        if clean_path.startswith("/api/auth/"):
            return RequestType.AUTH

        # Judge execution endpoints
        if clean_path.endswith("/run") and "/contest" in clean_path:
            return RequestType.JUDGE_RUN

        if clean_path.endswith("/submit") and "/contest" in clean_path:
            return RequestType.JUDGE_SUBMIT

        if method in {"GET", "HEAD", "OPTIONS"}:
            return RequestType.API_READ

        return RequestType.API_WRITE

    # ─── Tunnel Management ──────────────────────────────────────────────────────

    async def register_tunnel(self, node_id: str, tunnel_conn: Any) -> None:
        async with self._tunnel_lock:
            self._active_tunnels[node_id] = tunnel_conn
            logger.info("⚡ [Fabric Router] Reverse tunnel registered for node %s", node_id)

    async def unregister_tunnel(self, node_id: str) -> None:
        async with self._tunnel_lock:
            self._active_tunnels.pop(node_id, None)
            logger.info("🔌 [Fabric Router] Reverse tunnel disconnected for node %s", node_id)

    def is_tunnel_active(self, node_id: str) -> bool:
        return node_id in self._active_tunnels

    # ─── Node Scoring & Selection ───────────────────────────────────────────────

    async def get_all_nodes(self) -> List[Dict[str, Any]]:
        """Retrieve live data for all registered nodes from Redis."""
        redis = get_redis()
        raw_ids = await redis.smembers("ccc:nodes:registered")
        nodes = []
        now = time.time()

        for nid in raw_ids:
            node_id = nid.decode() if isinstance(nid, bytes) else str(nid)
            info = await redis.hgetall(f"ccc:node:{node_id}:info")
            if not info:
                continue

            decoded = {
                (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
                for k, v in info.items()
            }

            # Check heartbeat validity
            has_hb = await redis.exists(f"ccc:node:{node_id}:heartbeat")
            is_online = bool(has_hb)
            
            # Check tunnel status
            is_tunneled = self.is_tunnel_active(node_id)

            decoded["node_id"] = node_id
            decoded["is_online"] = is_online
            decoded["is_tunnel_connected"] = is_tunneled
            nodes.append(decoded)

        return nodes

    async def score_nodes_for_request(self, req_type: RequestType) -> List[NodeScore]:
        """
        Evaluate and rank all online nodes based on the requirements of req_type.
        """
        nodes = await self.get_all_nodes()
        scored: List[NodeScore] = []

        for n in nodes:
            if not n.get("is_online"):
                continue

            status_str = n.get("status", "ready").lower()
            if status_str in {"draining", "offline", "unhealthy", "revoked"}:
                continue

            # Capabilities check
            raw_caps = n.get("capabilities")
            caps: Dict[str, Any] = {}
            if raw_caps:
                try:
                    caps = json.loads(raw_caps) if isinstance(raw_caps, str) else raw_caps
                except Exception:
                    pass

            # Filter eligibility by request type
            if req_type == RequestType.STATIC and not caps.get("frontend", True):
                continue
            if req_type in {RequestType.API_READ, RequestType.API_WRITE} and not caps.get("api", True):
                continue
            if req_type == RequestType.SSE and not caps.get("sse", True):
                continue
            if req_type in {RequestType.JUDGE_RUN, RequestType.JUDGE_SUBMIT}:
                if not caps.get("judge", True):
                    continue
                if n.get("docker_status") not in {None, "healthy"}:
                    continue

            # Parse metrics
            cpu_usage = float(n.get("cpu_usage_pct", 0.0))
            mem_usage = float(n.get("memory_usage_pct", 0.0))
            mem_avail = float(n.get("available_memory_mb", 1024.0))
            mem_total = float(n.get("memory_mb", 2048.0)) or 2048.0
            running_jobs = int(n.get("running_jobs", 0))
            max_concurrency = int(n.get("max_concurrency", 4)) or 1
            latency_ms = float(n.get("latency_ms", 10.0))
            docker_ok = n.get("docker_status", "healthy") == "healthy"

            # Compute normalized component scores (0 - 100)
            cpu_score = max(0.0, 100.0 - cpu_usage)
            mem_score = min(100.0, (mem_avail / mem_total) * 100.0) if mem_total > 0 else 50.0
            
            # API load component
            api_active = int(n.get("api_active", 0))
            api_cap = int(n.get("api_capacity", max_concurrency)) or 1
            api_score = max(0.0, 100.0 - (api_active / api_cap * 100.0))

            # Judge slot component
            judge_score = max(0.0, 100.0 - (running_jobs / max_concurrency * 100.0))

            # Health component
            health_score = 100.0 if docker_ok else 20.0

            # Latency component
            lat_score = max(0.0, 100.0 - min(latency_ms, 100.0))

            # Weighted sum
            total_score = (
                (self.w_cpu * cpu_score)
                + (self.w_mem * mem_score)
                + (self.w_api * api_score)
                + (self.w_judge * judge_score)
                + (self.w_health * health_score)
                + (self.w_latency * lat_score)
            )

            scored.append(
                NodeScore(
                    node_id=n["node_id"],
                    hostname=n.get("hostname", "unknown"),
                    total_score=round(total_score, 2),
                    cpu_score=round(cpu_score, 2),
                    memory_score=round(mem_score, 2),
                    api_score=round(api_score, 2),
                    judge_score=round(judge_score, 2),
                    health_score=round(health_score, 2),
                    latency_score=round(lat_score, 2),
                    is_tunnel_connected=n.get("is_tunnel_connected", False),
                    status=n.get("status", "ready"),
                    details=n,
                )
            )

        # Sort descending by total score
        scored.sort(key=lambda s: s.total_score, reverse=True)
        return scored

    async def select_best_node(self, req_type: RequestType) -> Optional[NodeScore]:
        """Returns the highest scoring node eligible for this request type."""
        scores = await self.score_nodes_for_request(req_type)
        return scores[0] if scores else None

    # ─── Total Fabric Capacity Aggregation ──────────────────────────────────────

    async def get_fabric_capacity(self) -> Dict[str, Any]:
        """Calculates aggregate compute and serving capacity across all healthy nodes."""
        nodes = await self.get_all_nodes()
        
        total_nodes = len(nodes)
        healthy_nodes = [n for n in nodes if n.get("is_online") and n.get("status") in {None, "ready", "busy"}]
        
        sum_cores = sum(int(n.get("cpu_threads", n.get("cpu_cores", 1))) for n in healthy_nodes)
        sum_ram_mb = sum(int(n.get("memory_mb", 1024)) for n in healthy_nodes)
        sum_avail_ram_mb = sum(int(n.get("available_memory_mb", 512)) for n in healthy_nodes)
        sum_judge_slots = sum(int(n.get("max_concurrency", 4)) for n in healthy_nodes)
        sum_active_jobs = sum(int(n.get("running_jobs", 0)) for n in healthy_nodes)
        sum_api_capacity = sum(int(n.get("api_capacity", 4)) for n in healthy_nodes)
        sum_sse_capacity = sum(int(n.get("sse_capacity", 500)) for n in healthy_nodes)

        return {
            "total_registered_nodes": total_nodes,
            "active_healthy_nodes": len(healthy_nodes),
            "aggregate_cpu_threads": sum_cores,
            "aggregate_memory_mb": sum_ram_mb,
            "aggregate_available_memory_mb": sum_avail_ram_mb,
            "aggregate_judge_slots": sum_judge_slots,
            "in_flight_judge_jobs": sum_active_jobs,
            "available_judge_slots": max(0, sum_judge_slots - sum_active_jobs),
            "aggregate_api_capacity": sum_api_capacity,
            "aggregate_sse_capacity": sum_sse_capacity,
            "scoring_weights": {
                "cpu": self.w_cpu,
                "memory": self.w_mem,
                "api": self.w_api,
                "judge": self.w_judge,
                "health": self.w_health,
                "latency": self.w_latency,
            },
        }


def get_fabric_router() -> GlobalFabricRouter:
    return GlobalFabricRouter.get_instance()
