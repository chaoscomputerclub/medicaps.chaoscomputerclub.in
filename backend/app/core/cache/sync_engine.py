"""
Chaos Computer Club — Real-Time Cache Synchronization Engine (CacheSyncEngine)
The core synchronization coordinator responsible for:
- Event contract validation & normalization
- Concurrency & version monotonicity protection (new_version > cached_version)
- Idempotency & duplicate delivery rejection
- Atomic Redis cache update / invalidation via Lua CAS
- Pattern-based cache purge for related queries
- Event-driven SSE fan-out (ONLY on actual state advancement)
- Structured logging & telemetry tracking
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional

from app.core.cache.atomic_cas import execute_atomic_cas_sync, get_cached_resource_version
from app.core.cache.base import delete_cache_pattern
from app.core.cache.contracts import CacheSyncEvent, SyncResult, SyncStatus, SyncStrategy
from app.core.cache.metrics import metrics

logger = logging.getLogger("ccc.cache.sync_engine")


class CacheSyncEngine:
    """
    Event-driven synchronization coordinator.
    Eliminates stale-cache behavior and guarantees that cache versions NEVER decrease.
    """

    _instance: Optional[CacheSyncEngine] = None

    @classmethod
    def get_instance(cls) -> CacheSyncEngine:
        if cls._instance is None:
            cls._instance = CacheSyncEngine()
        return cls._instance

    async def process_event(self, event: CacheSyncEvent, job_id: Optional[str] = None) -> SyncResult:
        """
        Process an incoming committed domain synchronization event.
        Guarantees:
        1. Duplicate events are idempotently ignored.
        2. Stale events (version <= cached_version) are rejected without cache or SSE churn.
        3. Valid state advancements (version > cached_version) atomically update Redis and emit SSE.
        """
        start_time = time.perf_counter()
        metrics.inc_sync_event()

        logger.info(
            "⚡ CacheSync processing event %s (resource=%s, ver=%d, strat=%s, corr=%s)",
            event.event_id,
            event.resource_id,
            event.version,
            event.strategy.value,
            event.correlation_id,
        )

        # ─── 1. Contract Validation ───────────────────────────────────────────
        if event.version <= 0:
            metrics.inc_sync_failure()
            return SyncResult(
                status=SyncStatus.FAILED,
                resource_id=event.resource_id,
                incoming_version=event.version,
                current_version=0,
                action="none",
                error="Invalid version: version must be a positive integer",
            )

        # ─── 2. Atomic CAS Execution in Redis ─────────────────────────────────
        cas_res = await execute_atomic_cas_sync(event)
        cas_status = cas_res.get("status", "failed")
        cur_version = cas_res.get("current_version", 0)
        prev_version = cas_res.get("previous_version", 0)

        # ─── 3. Branch: Duplicate Event ───────────────────────────────────────
        if cas_status == "duplicate":
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            metrics.inc_duplicate()
            logger.info(
                "⏩ Duplicate event %s ignored for '%s' (current_ver=%d, incoming_ver=%d)",
                event.event_id, event.resource_id, cur_version, event.version,
            )
            return SyncResult(
                status=SyncStatus.DUPLICATE,
                resource_id=event.resource_id,
                incoming_version=event.version,
                current_version=cur_version,
                action="noop",
                sse_broadcast=False,
                duration_ms=duration_ms,
            )

        # ─── 4. Branch: Stale Event ───────────────────────────────────────────
        if cas_status == "stale":
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            metrics.inc_stale()
            metrics.inc_version_conflict()
            logger.warning(
                "🛑 Stale event %s rejected for '%s': incoming version %d <= cached version %d",
                event.event_id, event.resource_id, event.version, cur_version,
            )
            return SyncResult(
                status=SyncStatus.STALE,
                resource_id=event.resource_id,
                incoming_version=event.version,
                current_version=cur_version,
                action="noop",
                sse_broadcast=False,
                duration_ms=duration_ms,
            )

        # ─── 5. Branch: Failed CAS ───────────────────────────────────────────
        if cas_status != "applied":
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            metrics.inc_sync_failure()
            err_msg = cas_res.get("error", "Unknown atomic CAS failure")
            logger.error("❌ Atomic CAS failed for %s: %s", event.event_id, err_msg)
            return SyncResult(
                status=SyncStatus.FAILED,
                resource_id=event.resource_id,
                incoming_version=event.version,
                current_version=cur_version,
                action="failed",
                sse_broadcast=False,
                duration_ms=duration_ms,
                error=err_msg,
            )

        # ─── 6. Branch: State Advanced (Applied) ──────────────────────────────
        action = "update" if event.strategy == SyncStrategy.UPDATE else "invalidate"
        if event.strategy == SyncStrategy.UPDATE:
            metrics.inc_update()
        else:
            metrics.inc_invalidation()

        # Handle secondary wildcard pattern purges if requested
        if event.patterns_to_invalidate:
            for pattern in event.patterns_to_invalidate:
                await delete_cache_pattern(pattern)

        # ─── 7. Emit Real-Time SSE (Only on Actual Advancement) ───────────────
        sse_published = False
        if event.broadcast_sse:
            try:
                from app.services.event_broadcaster import broadcast_sync_event
                await broadcast_sync_event(event)
                sse_published = True
                metrics.inc_sse_sent()
            except Exception as sse_exc:
                logger.warning("SSE broadcast notice for event %s: %s", event.event_id, sse_exc)

        duration_ms = (time.perf_counter() - start_time) * 1000.0
        metrics.inc_sync_success(duration_ms)

        # ─── 8. Structured Observability Logging ──────────────────────────────
        log_payload = {
            "event": "cache_sync.completed",
            "event_id": event.event_id,
            "resource_id": event.resource_id,
            "incoming_version": event.version,
            "previous_version": prev_version,
            "cache_action": action,
            "sse_broadcast": sse_published,
            "duration_ms": round(duration_ms, 2),
            "job_id": job_id,
            "correlation_id": event.correlation_id,
            "causation_id": event.causation_id,
        }
        logger.info("%s", json.dumps(log_payload))

        return SyncResult(
            status=SyncStatus.APPLIED,
            resource_id=event.resource_id,
            incoming_version=event.version,
            current_version=event.version,
            action=action,
            sse_broadcast=sse_published,
            duration_ms=duration_ms,
        )


cache_sync_engine = CacheSyncEngine.get_instance()
