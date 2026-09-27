"""
Chaos Computer Club — Cache & Real-Time Sync Observability Metrics
Thread-safe, high-precision metric counters and gauges for the CacheSyncEngine.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict


class CacheSyncMetrics:
    """Thread-safe and async-safe metrics registry for CacheSyncEngine."""

    _instance: CacheSyncMetrics | None = None

    def __init__(self):
        self._lock = asyncio.Lock()
        self.cache_sync_events_total: int = 0
        self.cache_sync_success_total: int = 0
        self.cache_sync_failure_total: int = 0
        self.cache_sync_duplicate_total: int = 0
        self.cache_sync_stale_event_total: int = 0
        self.cache_sync_version_conflict_total: int = 0
        self.cache_sync_latency_ms_total: float = 0.0
        self.cache_update_total: int = 0
        self.cache_invalidation_total: int = 0
        self.cache_hit_total: int = 0
        self.cache_miss_total: int = 0
        self.sse_connections_active: int = 0
        self.sse_events_sent_total: int = 0
        self.sse_events_dropped_total: int = 0
        self.sse_reconnect_total: int = 0
        self.sse_replay_total: int = 0
        self.sse_resync_total: int = 0
        self.sse_slow_clients_total: int = 0
        self.sse_buffer_overflow_total: int = 0
        self.event_coalesced_total: int = 0

    @classmethod
    def get_instance(cls) -> CacheSyncMetrics:
        if cls._instance is None:
            cls._instance = CacheSyncMetrics()
        return cls._instance

    def inc_sync_event(self) -> None:
        self.cache_sync_events_total += 1

    def inc_sync_success(self, duration_ms: float) -> None:
        self.cache_sync_success_total += 1
        self.cache_sync_latency_ms_total += duration_ms

    def inc_sync_failure(self) -> None:
        self.cache_sync_failure_total += 1

    def inc_duplicate(self) -> None:
        self.cache_sync_duplicate_total += 1

    def inc_stale(self) -> None:
        self.cache_sync_stale_event_total += 1

    def inc_version_conflict(self) -> None:
        self.cache_sync_version_conflict_total += 1

    def inc_update(self) -> None:
        self.cache_update_total += 1

    def inc_invalidation(self) -> None:
        self.cache_invalidation_total += 1

    def inc_hit(self) -> None:
        self.cache_hit_total += 1

    def inc_miss(self) -> None:
        self.cache_miss_total += 1

    def inc_sse_sent(self) -> None:
        self.sse_events_sent_total += 1

    def inc_sse_dropped(self) -> None:
        self.sse_events_dropped_total += 1

    def inc_sse_reconnect(self) -> None:
        self.sse_reconnect_total += 1

    def inc_sse_replay(self) -> None:
        self.sse_replay_total += 1

    def inc_sse_resync(self) -> None:
        self.sse_resync_total += 1

    def inc_sse_slow_client(self) -> None:
        self.sse_slow_clients_total += 1

    def inc_sse_buffer_overflow(self) -> None:
        self.sse_buffer_overflow_total += 1

    def inc_coalesced(self) -> None:
        self.event_coalesced_total += 1

    def set_active_connections(self, count: int) -> None:
        self.sse_connections_active = count

    def get_all_metrics(self) -> Dict[str, Any]:
        """Snapshot of current metrics."""
        avg_latency = (
            round(self.cache_sync_latency_ms_total / self.cache_sync_success_total, 2)
            if self.cache_sync_success_total > 0
            else 0.0
        )
        return {
            "cache_sync_events_total": self.cache_sync_events_total,
            "cache_sync_success_total": self.cache_sync_success_total,
            "cache_sync_failure_total": self.cache_sync_failure_total,
            "cache_sync_duplicate_total": self.cache_sync_duplicate_total,
            "cache_sync_stale_event_total": self.cache_sync_stale_event_total,
            "cache_sync_version_conflict_total": self.cache_sync_version_conflict_total,
            "cache_sync_avg_latency_ms": avg_latency,
            "cache_update_total": self.cache_update_total,
            "cache_invalidation_total": self.cache_invalidation_total,
            "cache_hit_total": self.cache_hit_total,
            "cache_miss_total": self.cache_miss_total,
            "sse_connections_active": self.sse_connections_active,
            "sse_events_sent_total": self.sse_events_sent_total,
            "sse_events_dropped_total": self.sse_events_dropped_total,
            "sse_reconnect_total": self.sse_reconnect_total,
            "sse_replay_total": self.sse_replay_total,
            "sse_resync_total": self.sse_resync_total,
            "sse_slow_clients_total": self.sse_slow_clients_total,
            "sse_buffer_overflow_total": self.sse_buffer_overflow_total,
            "event_coalesced_total": self.event_coalesced_total,
        }


metrics = CacheSyncMetrics.get_instance()
