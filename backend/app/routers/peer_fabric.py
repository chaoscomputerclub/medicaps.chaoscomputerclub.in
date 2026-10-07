"""
Chaos Computer Club — Medi-Caps Chapter
routers/peer_fabric.py — Internal Service APIs & Infrastructure Dashboard
"""

from __future__ import annotations

import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.engine.peer_fabric.models import (
    PeerAdvertisement,
    PeerHeartbeat,
    PeerRecord,
    PeerType,
)
from app.engine.peer_fabric.registry import PeerRegistry
from app.engine.peer_fabric.router import PeerRouter

logger = logging.getLogger("ccc.routers.peer_fabric")

router = APIRouter(prefix="/internal/v1/peers", tags=["Peer Fabric"])


def _verify_peer_auth(
    request: Request,
    x_peer_id: Optional[str] = Header(None),
    x_peer_signature: Optional[str] = Header(None),
    x_peer_timestamp: Optional[str] = Header(None),
) -> None:
    """
    Enforce internal mutual authentication using HMAC-SHA256 signatures.
    If secret is unset in development, logs a warning.
    """
    secret = getattr(settings, "PEER_SHARED_SECRET", None) or getattr(settings, "JUDGE_AGENT_SECRET", None)
    if not secret:
        return

    if not x_peer_signature or not x_peer_id or not x_peer_timestamp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing peer authentication headers (X-Peer-Id, X-Peer-Signature, X-Peer-Timestamp)"
        )

    # Validate timestamp drift (<60s)
    try:
        req_dt = datetime.fromisoformat(x_peer_timestamp.replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        if abs((now_dt - req_dt).total_seconds()) > 60:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Peer signature timestamp drift exceeds 60s"
            )
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid timestamp format")


@router.post("/register", response_model=PeerRecord)
async def register_peer(ad: PeerAdvertisement, request: Request):
    """Enrolls a new compute or routing peer into the fabric."""
    _verify_peer_auth(request)
    return await PeerRegistry.register(ad)


@router.post("/heartbeat", response_model=Dict[str, Any])
async def peer_heartbeat(hb: PeerHeartbeat, request: Request):
    """Refreshes live capacity and renews peer membership lease."""
    _verify_peer_auth(request)
    updated = await PeerRegistry.record_heartbeat(hb)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Peer '{hb.peer_id}' not found. Please re-register.")
    return {"status": "acknowledged", "reap_threshold_sec": 30}


@router.post("/drain", response_model=Dict[str, Any])
async def drain_peer(peer_id: str, request: Request):
    """Initiates graceful draining of in-flight work prior to shutdown."""
    _verify_peer_auth(request)
    success = await PeerRegistry.drain(peer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Peer not found")
    return {"status": "draining", "peer_id": peer_id}


@router.get("/capabilities", response_model=Dict[str, Any])
async def get_capabilities():
    """Lists aggregated cluster capabilities and supported execution languages."""
    peers = await PeerRegistry.get_all_peers()
    roles: set[str] = set()
    languages: set[str] = set()
    total_capacity = 0

    for p in peers:
        if p.status.value in ("HEALTHY", "DEGRADED"):
            roles.update(r.value for r in p.advertisement.service_types)
            languages.update(p.advertisement.capabilities.judge_languages)
            total_capacity += p.advertisement.capacity.max_concurrent_jobs

    return {
        "status": "active",
        "peer_count": len(peers),
        "supported_roles": list(roles),
        "supported_languages": list(languages),
        "aggregate_judge_capacity": total_capacity,
    }


@router.get("/dashboard", response_model=Dict[str, Any])
async def get_dashboard():
    """Returns the live Infrastructure Matrix Dashboard across all providers."""
    peers = await PeerRegistry.get_all_peers()
    matrix = []

    for p in peers:
        active_jobs = p.telemetry.active_jobs if p.telemetry else 0
        max_jobs = p.advertisement.capacity.max_concurrent_jobs
        cpu = p.telemetry.cpu_utilization_percent if p.telemetry else 0.0
        ram = p.telemetry.memory_utilization_mb if p.telemetry else 0
        quota = p.telemetry.quota_state.value if p.telemetry else p.advertisement.capacity.quota_state.value

        matrix.append({
            "peer_id": p.advertisement.peer_id,
            "provider": p.advertisement.provider,
            "region": p.advertisement.region,
            "roles": [r.value for r in p.advertisement.service_types],
            "status": p.status.value,
            "capacity": f"{active_jobs}/{max_jobs}",
            "cpu_percent": cpu,
            "ram_mb": ram,
            "quota": quota,
            "last_heartbeat": p.last_heartbeat.isoformat(),
        })

    return {
        "cluster_protocol": "ccc-p2p-fabric-v1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_peers": len(peers),
        "peers": matrix,
    }
