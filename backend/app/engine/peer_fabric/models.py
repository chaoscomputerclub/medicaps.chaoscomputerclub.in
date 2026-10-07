"""
Chaos Computer Club — Medi-Caps Chapter
engine/peer_fabric/models.py — Peer-to-Peer Service Fabric Data Contracts
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PeerType(str, Enum):
    API_PEER = "API_PEER"
    WORKER_PEER = "WORKER_PEER"
    REALTIME_PEER = "REALTIME_PEER"
    ROUTER_PEER = "ROUTER_PEER"
    JUDGE_PEER = "JUDGE_PEER"
    STORAGE_PEER = "STORAGE_PEER"


class PeerState(str, Enum):
    JOINING = "JOINING"
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    DRAINING = "DRAINING"
    SUSPECT = "SUSPECT"
    OFFLINE = "OFFLINE"
    REMOVED = "REMOVED"


class QuotaState(str, Enum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    EXHAUSTED = "EXHAUSTED"
    UNKNOWN = "UNKNOWN"


class PeerCapacity(BaseModel):
    max_concurrent_requests: int = Field(default=50, ge=1)
    max_concurrent_jobs: int = Field(default=4, ge=1)
    cpu_cores: float = Field(default=1.0, ge=0.1)
    memory_mb: int = Field(default=512, ge=64)
    active_requests: int = Field(default=0, ge=0)
    active_jobs: int = Field(default=0, ge=0)
    quota_state: QuotaState = Field(default=QuotaState.NORMAL)


class PeerCapability(BaseModel):
    http_api: bool = True
    sse_streaming: bool = False
    judge_languages: List[str] = Field(default_factory=list)
    docker_sandboxing: bool = False
    background_workers: bool = False


class PeerAdvertisement(BaseModel):
    peer_id: str
    provider: str = Field(description="e.g. google-cloud-run, koyeb, render, railway, vps, laptop")
    region: str = Field(default="global")
    endpoint: str = Field(description="Fully qualified reachable URL")
    version: str = Field(default="1.0.11")
    git_sha: Optional[str] = None
    service_types: List[PeerType]
    capacity: PeerCapacity = Field(default_factory=PeerCapacity)
    capabilities: PeerCapability = Field(default_factory=PeerCapability)
    protocol_version: str = Field(default="1.0.0")


class PeerHeartbeat(BaseModel):
    peer_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: PeerState = Field(default=PeerState.HEALTHY)
    cpu_utilization_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    memory_utilization_mb: int = Field(default=0, ge=0)
    active_requests: int = Field(default=0, ge=0)
    active_jobs: int = Field(default=0, ge=0)
    latency_p95_ms: float = Field(default=10.0, ge=0.0)
    quota_state: QuotaState = Field(default=QuotaState.NORMAL)


class PeerRecord(BaseModel):
    advertisement: PeerAdvertisement
    status: PeerState = Field(default=PeerState.JOINING)
    last_heartbeat: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    telemetry: Optional[PeerHeartbeat] = None
    historical_success_rate: float = Field(default=1.0, ge=0.0, le=1.0)
