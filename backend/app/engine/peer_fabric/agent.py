"""
Chaos Computer Club — Medi-Caps Chapter
engine/peer_fabric/agent.py — Autonomous Peer Registration & Heartbeat Daemon

Runs inside every deployed compute peer (Render, Koyeb, Railway, Cloud Run, VPS, local machine).
Automatically:
1. Discovers its provider and public endpoint from environment variables.
2. Enrolls in the shared P2P PeerRegistry upon container startup.
3. Emits periodic telemetry heartbeats (CPU, RAM, active jobs, quota state).
4. Gracefully drains on SIGTERM / application shutdown.
"""

from __future__ import annotations

import asyncio
import logging
import os
import psutil
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from app.core.config import settings
from app.engine.peer_fabric.models import (
    PeerAdvertisement,
    PeerCapacity,
    PeerCapability,
    PeerHeartbeat,
    PeerState,
    PeerType,
    QuotaState,
)
from app.engine.peer_fabric.registry import PeerRegistry

logger = logging.getLogger("ccc.p2p.agent")

HEARTBEAT_INTERVAL_SECONDS = 10


def detect_provider() -> str:
    """Detect hosting provider from runtime environment variables."""
    if os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID"):
        return "render"
    if os.getenv("KOYEB_SERVICE_ID") or os.getenv("KOYEB_APP_NAME"):
        return "koyeb"
    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_SERVICE_ID"):
        return "railway"
    if os.getenv("FLY_APP_NAME"):
        return "fly-io"
    if os.getenv("K_SERVICE") or os.getenv("CLOUD_RUN_JOB"):
        return "google-cloud-run"
    if os.getenv("NORTHFLANK"):
        return "northflank"
    return os.getenv("PEER_PROVIDER", "custom-peer")


def detect_public_endpoint(provider: str) -> str:
    """Detect public reachable URL from provider metadata or environment."""
    explicit = os.getenv("PEER_PUBLIC_URL") or os.getenv("PUBLIC_URL")
    if explicit:
        return explicit.rstrip("/")

    if provider == "render" and os.getenv("RENDER_EXTERNAL_URL"):
        return os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")

    if provider == "koyeb" and os.getenv("KOYEB_PUBLIC_DOMAIN"):
        domain = os.getenv("KOYEB_PUBLIC_DOMAIN", "").strip()
        return f"https://{domain}" if not domain.startswith("http") else domain

    if provider == "railway" and os.getenv("RAILWAY_PUBLIC_DOMAIN"):
        domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
        return f"https://{domain}" if not domain.startswith("http") else domain

    if provider == "fly-io" and os.getenv("FLY_APP_NAME"):
        return f"https://{os.getenv('FLY_APP_NAME')}.fly.dev"

    port = os.getenv("PORT", "8000")
    return f"http://127.0.0.1:{port}"


def detect_service_types(mode: str) -> List[PeerType]:
    """Map SERVICE_MODE to federated PeerTypes."""
    m = mode.strip().lower()
    if m == "api":
        return [PeerType.API_PEER]
    if m == "worker":
        return [PeerType.WORKER_PEER]
    if m == "realtime":
        return [PeerType.REALTIME_PEER]
    if m == "judge":
        return [PeerType.JUDGE_PEER]
    # Default "all" or unspecified runs combined API, worker, and realtime roles
    return [PeerType.API_PEER, PeerType.WORKER_PEER, PeerType.REALTIME_PEER]


class PeerAgent:
    """Autonomous peer agent managing self-registration and liveness loop."""

    _instance: Optional[PeerAgent] = None
    _task: Optional[asyncio.Task] = None
    _peer_id: str = ""
    _running: bool = False

    def __init__(self) -> None:
        self.provider = detect_provider()
        self.endpoint = detect_public_endpoint(self.provider)
        self.service_mode = os.getenv("SERVICE_MODE", "all")
        self.roles = detect_service_types(self.service_mode)

        default_id = f"peer-{self.provider}-{uuid4().hex[:6]}"
        self.peer_id = os.getenv("PEER_ID", default_id)

    @classmethod
    def get_instance(cls) -> PeerAgent:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start(self) -> None:
        """Register peer in fabric registry and launch heartbeat background loop."""
        if self._running:
            return
        self._running = True

        ad = PeerAdvertisement(
            peer_id=self.peer_id,
            provider=self.provider,
            region=os.getenv("REGION", os.getenv("FLY_REGION", "global")),
            endpoint=self.endpoint,
            version=settings.VERSION,
            service_types=self.roles,
            capacity=PeerCapacity(
                max_concurrent_requests=int(os.getenv("MAX_CONCURRENT_REQUESTS", 100)),
                max_concurrent_jobs=int(os.getenv("MAX_CONCURRENT_JOBS", 4)),
                cpu_cores=float(os.getenv("CPU_CORES", 1.0)),
                memory_mb=int(os.getenv("MEMORY_MB", 512)),
                quota_state=QuotaState.NORMAL,
            ),
            capabilities=PeerCapability(
                http_api=PeerType.API_PEER in self.roles,
                sse_streaming=PeerType.REALTIME_PEER in self.roles,
                judge_languages=["*"],
                docker_sandboxing=False,
                background_workers=PeerType.WORKER_PEER in self.roles,
            ),
        )

        try:
            await PeerRegistry.register(ad)
            logger.info("🛰️ [P2P Fabric] Peer '%s' registered (Provider: %s, Endpoint: %s, Roles: %s)",
                        self.peer_id, self.provider, self.endpoint, [r.value for r in self.roles])
        except Exception as e:
            logger.warning("Notice during peer self-registration: %s", e)

        self._task = asyncio.create_task(self._heartbeat_loop())

    async def stop(self) -> None:
        """Gracefully drain and unregister peer."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        try:
            await PeerRegistry.drain(self.peer_id)
            logger.info("👋 [P2P Fabric] Peer '%s' drained cleanly upon shutdown.", self.peer_id)
        except Exception as e:
            logger.debug("Notice during peer draining: %s", e)

    async def _heartbeat_loop(self) -> None:
        """Periodically report system telemetry to renew heartbeat lease."""
        while self._running:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
                cpu_pct = 0.0
                mem_mb = 0
                try:
                    cpu_pct = psutil.cpu_percent(interval=None)
                    mem_mb = int(psutil.Process().memory_info().rss / (1024 * 1024))
                except Exception:
                    pass

                hb = PeerHeartbeat(
                    peer_id=self.peer_id,
                    timestamp=datetime.now(timezone.utc),
                    status=PeerState.HEALTHY,
                    cpu_utilization_percent=cpu_pct,
                    memory_utilization_mb=mem_mb,
                    active_requests=0,
                    active_jobs=0,
                    latency_p95_ms=10.0,
                    quota_state=QuotaState.NORMAL,
                )
                await PeerRegistry.record_heartbeat(hb)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug("Telemetry heartbeat update notice: %s", e)
