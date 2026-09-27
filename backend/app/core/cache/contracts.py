"""
Chaos Computer Club — Cache Synchronization Contracts & Enums
Defines strongly-typed Pydantic schemas for event-driven cache synchronization.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class SyncStrategy(str, enum.Enum):
    """Synchronization mutation strategy."""
    UPDATE = "UPDATE"          # Event contains full authoritative state; write directly to Redis
    INVALIDATE = "INVALIDATE"  # Event indicates state is obsolete; delete keys, read-repair on next miss


class SyncStatus(str, enum.Enum):
    """Result of cache synchronization attempt."""
    APPLIED = "applied"
    STALE = "stale"
    DUPLICATE = "duplicate"
    COALESCED = "coalesced"
    FAILED = "failed"


class CacheSyncEvent(BaseModel):
    """
    Strongly-typed synchronization event contract.
    Guarantees monotonic versioning, correlation tracking, and idempotency.
    """
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str  # e.g., "leaderboard.updated", "scoreboard.updated", "contest.updated"
    resource_type: str  # e.g., "leaderboard", "scoreboard", "contest", "member"
    resource_id: str  # e.g., "global", "contest:weekly-contest-1", "member:uuid"
    version: int  # Strictly monotonic positive integer (new_version > current_version required)
    occurred_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    correlation_id: str = Field(default_factory=lambda: f"sync-{uuid4().hex[:8]}")
    causation_id: Optional[str] = None
    strategy: SyncStrategy = SyncStrategy.INVALIDATE
    payload: Dict[str, Any] = Field(default_factory=dict)

    # Specific cache details (for UPDATE strategy)
    cache_key: Optional[str] = None
    cache_value: Optional[Any] = None
    cache_ttl: int = 300

    # Invalidation targets (for INVALIDATE strategy)
    keys_to_invalidate: List[str] = Field(default_factory=list)
    patterns_to_invalidate: List[str] = Field(default_factory=list)

    # High-frequency event coalescing tag
    coalesce_key: Optional[str] = None

    # Real-time SSE fan-out configuration
    sse_channel: str = "global"
    broadcast_sse: bool = True


class SyncResult(BaseModel):
    """Outcome report for a CacheSyncEngine execution."""
    status: SyncStatus
    resource_id: str
    incoming_version: int
    current_version: int
    action: str  # "update", "invalidate", "noop"
    sse_broadcast: bool = False
    duration_ms: float = 0.0
    error: Optional[str] = None
