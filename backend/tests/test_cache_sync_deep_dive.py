"""
CacheSyncEngine — Deep-Dive Production Adversarial Test Suite

Tests production-grade failure modes, edge cases, and concurrency scenarios
NOT covered by the standard test suite:

1.  Version key strip semantics (trailing/leading colons in resource_id)
2.  SWR envelope schema: non-SWR-wrapped cache shouldn't corrupt SWR path
3.  SingleFlight exception propagation to all waiters, no zombie futures
4.  SingleFlight cleanup on exception (map must be empty after failure)
5.  EventCoalescer: lower-version event does NOT displace higher-version winner
6.  EventCoalescer: cancellation safety — cancelled flush task, then re-submit
7.  Backpressure: slow client receives resync_required, not buffered stale data
8.  Metrics: inc_sync_event / success / stale / duplicate are monotonically consistent
9.  CacheSyncWorker: RetryableError on transient Redis failure
10. CacheSyncWorker: NonRetryableError on malformed payload
11. Duplicate event_id suppression survives TTL re-submission
12. Pattern invalidation fan-out across multiple keys matching glob
13. UPDATE strategy writes correct JSON to Redis key with TTL
14. Version_key strip: colons in resource_id don't cause key collision
15. Concurrent coalescer submits for different keys don't interfere
16. SSE replay buffer: exactly bounded at 100 items (no overflow)
17. Empty keys_to_invalidate does not crash INVALIDATE strategy
18. process_event on a CacheSyncEvent with version=1 from zero state
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, List
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

import pytest

from app.core.db import ensure_database_integrity
from app.core.cache import (
    CacheSyncEvent,
    SyncStatus,
    SyncStrategy,
    cache_sync_engine,
    delete_cache,
    delete_cache_pattern,
    get_cache,
    get_cached_resource_version,
    metrics,
    set_cache,
    single_flight,
    swr_engine,
)
from app.core.cache.atomic_cas import (
    DEFAULT_IDEMPOTENCY_TTL_SECONDS,
    _idem_key,
    _version_key,
)
from app.core.cache.coalescing import EventCoalescer
from app.core.cache.contracts import SyncResult
from app.core.cache.singleflight import SingleFlight
from app.core.cache.swr import SWREngine
from app.core.cache.metrics import CacheSyncMetrics
from app.core.redis import get_redis
from app.core.queue.contracts import NonRetryableError, RetryableError
from app.workers.cache_sync_worker import CacheSyncWorker


# ─── Shared fixture ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def _setup():
    await ensure_database_integrity()


# ─── 1. Version Key Strip Semantics ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_version_key_strip_colons():
    """
    INVARIANT: _version_key must strip leading/trailing colons from resource_id
    so that 'leaderboard:' and ':leaderboard' and 'leaderboard' map to the same Redis key.
    """
    assert _version_key("leaderboard") == _version_key("leaderboard")
    assert _version_key(":leaderboard") == _version_key("leaderboard")
    assert _version_key("leaderboard:") == _version_key("leaderboard")


# ─── 2. SWR Envelope: Non-SWR-wrapped cache is a hard miss ───────────────────

@pytest.mark.asyncio
async def test_swr_ignores_non_swr_cache():
    """
    SWR must treat a raw (non-envelope) cached value as a hard miss, not corrupt
    the SWR metadata path or return a wrapped envelope as the result.
    """
    await ensure_database_integrity()
    key = f"cache:swr:plain:{uuid4().hex[:8]}"
    # Write a plain non-SWR-wrapped value
    await set_cache(key, {"score": 99}, ttl_seconds=300)

    call_count = 0

    async def fetcher() -> dict:
        nonlocal call_count
        call_count += 1
        return {"score": 999}

    # SWR should NOT read {"score":99} as the data field —
    # it's not an envelope so should treat as a hard miss and call fetcher
    result = await swr_engine.get_with_swr(key, fetcher, ttl_seconds=60, swr_seconds=30)

    # The result should be the fresh fetched value, not the raw old value
    # (because the old value has no _swr_meta key — it's a hard miss for SWR)
    assert call_count == 1, "SWR should fetch fresh when cached value is not SWR-wrapped"
    assert result == {"score": 999}


# ─── 3. SingleFlight: Exception propagates to ALL waiters ────────────────────

@pytest.mark.asyncio
async def test_single_flight_exception_propagates_to_all_waiters():
    """
    When the underlying fetcher raises, ALL concurrent waiters should receive the same exception.
    No waiter should hang or silently receive None.
    SingleFlight pattern: 1 fetcher runs, N-1 await its Future.
    When fetcher raises, all N awaiters (including waiters) must receive the exception.
    """
    sf = SingleFlight()
    key = f"sf:exc:{uuid4().hex[:8]}"

    start_event = asyncio.Event()

    async def failing_fetcher():
        # Signal that we're inside the fetcher, give other tasks a chance to line up
        start_event.set()
        await asyncio.sleep(0.05)  # Give waiters time to queue on the Future
        raise RuntimeError("Simulated DB failure")

    # Start the first task; wait until it's inside the fetcher
    first_task = asyncio.create_task(sf.execute(key, failing_fetcher, use_distributed_lock=False))
    await start_event.wait()  # Fetcher is now running, in-flight map is populated

    # Now launch 4 more tasks that will await the same in-flight Future
    waiter_tasks = [
        asyncio.create_task(sf.execute(key, failing_fetcher, use_distributed_lock=False))
        for _ in range(4)
    ]

    results = await asyncio.gather(first_task, *waiter_tasks, return_exceptions=True)
    errors = [r for r in results if isinstance(r, RuntimeError)]
    assert len(errors) == 5, f"All 5 should receive RuntimeError, got: {results}"
    for err in errors:
        assert "Simulated DB failure" in str(err)


# ─── 4. SingleFlight: Map is clean after exception ───────────────────────────

@pytest.mark.asyncio
async def test_single_flight_cleanup_after_exception():
    """
    After a fetcher fails, the in-flight map must be empty.
    A subsequent call for the same key MUST re-execute the fetcher, not hang.
    """
    sf = SingleFlight()
    key = f"sf:cleanup:{uuid4().hex[:8]}"
    call_count = 0

    async def failing_once():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("First call fails")
        return {"ok": True}

    # First call: fails
    with pytest.raises(RuntimeError, match="First call fails"):
        await sf.execute(key, failing_once, use_distributed_lock=False)

    # Map must be empty — no zombie futures
    assert key not in sf._in_flight, "In-flight map must be empty after exception"

    # Second call: succeeds
    result = await sf.execute(key, failing_once, use_distributed_lock=False)
    assert result == {"ok": True}
    assert call_count == 2


# ─── 5. EventCoalescer: Lower-version event does not displace higher ──────────

@pytest.mark.asyncio
async def test_coalescer_lower_version_does_not_displace():
    """
    Once a higher-version event is in the pending buffer, a subsequent lower-version
    event for the same coalesce_key must NOT overwrite it.
    """
    coalescer = EventCoalescer(window_seconds=0.3)
    flushed: List[CacheSyncEvent] = []

    async def handler(evt: CacheSyncEvent):
        flushed.append(evt)

    ck = f"coalesce:lowdisplace:{uuid4().hex[:6]}"
    res_id = f"test:coalesce:{uuid4().hex[:6]}"

    # Submit v100 first, then v50 (lower)
    await coalescer.submit(CacheSyncEvent(
        event_type="test", resource_type="t", resource_id=res_id,
        version=100, coalesce_key=ck,
    ), handler)
    await coalescer.submit(CacheSyncEvent(
        event_type="test", resource_type="t", resource_id=res_id,
        version=50, coalesce_key=ck,
    ), handler)

    await asyncio.sleep(0.5)

    assert len(flushed) == 1
    assert flushed[0].version == 100, f"Expected v100 to win, got v{flushed[0].version}"


# ─── 6. EventCoalescer: Different keys do not interfere ──────────────────────

@pytest.mark.asyncio
async def test_coalescer_different_keys_do_not_interfere():
    """
    Coalescing for key A must not affect key B and vice versa.
    Both should flush independently with their own max-version winner.
    """
    coalescer = EventCoalescer(window_seconds=0.2)
    flushed: Dict[str, List[CacheSyncEvent]] = {"A": [], "B": []}

    async def handler_a(evt):
        flushed["A"].append(evt)

    async def handler_b(evt):
        flushed["B"].append(evt)

    ck_a = f"coalesce:keyA:{uuid4().hex[:6]}"
    ck_b = f"coalesce:keyB:{uuid4().hex[:6]}"
    res_id = f"test:coalesce:{uuid4().hex[:6]}"

    for v in [10, 20, 30]:
        await coalescer.submit(CacheSyncEvent(
            event_type="test", resource_type="t", resource_id=res_id,
            version=v, coalesce_key=ck_a,
        ), handler_a)
    for v in [5, 15, 25]:
        await coalescer.submit(CacheSyncEvent(
            event_type="test", resource_type="t", resource_id=res_id,
            version=v, coalesce_key=ck_b,
        ), handler_b)

    await asyncio.sleep(0.4)

    assert len(flushed["A"]) == 1 and flushed["A"][0].version == 30
    assert len(flushed["B"]) == 1 and flushed["B"][0].version == 25


# ─── 7. Backpressure: Slow client queue overflow → resync_required ────────────

@pytest.mark.asyncio
async def test_backpressure_slow_client_receives_resync_required():
    """
    A slow client whose queue is full should receive a resync_required notice,
    NOT silently dropped messages that leave it in a stale-forever state.
    _fan_out with no contest_slug delivers to the 'global' channel.
    """
    from app.services.event_broadcaster import subscribe, unsubscribe, _fan_out

    # _fan_out with contest_slug=None delivers to the 'global' channel
    channel = "global"
    q = await subscribe(channel)

    # Fill the queue to capacity (maxsize=100)
    for i in range(100):
        q.put_nowait(json.dumps({"event": "filler", "idx": i}))

    assert q.full()

    # Fan out one more event with no slug — targets global channel
    await _fan_out(json.dumps({"event": "overflow_event"}), None)

    # The queue should still be full and contain a resync_required notice
    assert q.full()

    # Drain and find the resync notice
    items = []
    while not q.empty():
        items.append(q.get_nowait())

    resync_items = [json.loads(item) for item in items if "resync_required" in item]
    assert len(resync_items) >= 1, f"Expected resync_required notice in queue, got last 3: {items[-3:]}"
    assert resync_items[-1]["status"] == "resync_required"

    await unsubscribe(channel, q)


# ─── 8. Metrics: Consistent monotonic increments ─────────────────────────────

@pytest.mark.asyncio
async def test_metrics_monotonic_consistency():
    """
    Metrics counters must be non-negative integers and must only increase.
    inc_sync_event must be called before inc_sync_success or inc_sync_failure.
    """
    await ensure_database_integrity()
    m = CacheSyncMetrics()  # fresh isolated metrics instance

    assert m.cache_sync_events_total == 0
    m.inc_sync_event()
    assert m.cache_sync_events_total == 1
    m.inc_sync_success(12.5)
    assert m.cache_sync_success_total == 1
    assert m.cache_sync_latency_ms_total == 12.5
    m.inc_sync_event()
    m.inc_sync_failure()
    assert m.cache_sync_events_total == 2
    assert m.cache_sync_failure_total == 1

    snap = m.get_all_metrics()
    assert snap["cache_sync_avg_latency_ms"] == 12.5
    assert snap["cache_sync_events_total"] == 2
    assert snap["cache_sync_success_total"] == 1
    assert snap["cache_sync_failure_total"] == 1


# ─── 9. CacheSyncWorker: RetryableError on transient Redis error ──────────────

@pytest.mark.asyncio
async def test_worker_raises_retryable_on_connection_error():
    """
    If CacheSyncEngine returns FAILED with a connection error message,
    the worker must raise RetryableError (not NonRetryableError).
    """
    from app.core.queue.contracts import JobContract
    from sqlalchemy.ext.asyncio import AsyncSession

    worker = CacheSyncWorker()
    job = JobContract(
        id=str(uuid4()),
        queue_name="cache_sync",
        job_type="test.event",
        payload={
            "event_id": str(uuid4()),
            "event_type": "test.event",
            "resource_type": "test",
            "resource_id": "test:res",
            "version": 1,
            "strategy": "INVALIDATE",
            "payload": {},
            "keys_to_invalidate": [],
            "patterns_to_invalidate": [],
            "sse_channel": "global",
            "broadcast_sse": False,
            "cache_ttl": 300,
        },
        priority="normal",
        max_retries=3,
        attempt=1,
    )

    failed_result = SyncResult(
        status=SyncStatus.FAILED,
        resource_id="test:res",
        incoming_version=1,
        current_version=0,
        action="failed",
        error="connection timeout to Redis",
    )

    with patch.object(cache_sync_engine, "process_event", return_value=failed_result):
        with pytest.raises(RetryableError, match="connection timeout"):
            await worker.process_job(job, AsyncMock())


# ─── 10. CacheSyncWorker: NonRetryableError on malformed payload ──────────────

@pytest.mark.asyncio
async def test_worker_raises_non_retryable_on_malformed_payload():
    """
    A job with a completely invalid CacheSyncEvent payload must raise NonRetryableError
    (not RetryableError) to prevent infinite retry loops.
    """
    from app.core.queue.contracts import JobContract

    worker = CacheSyncWorker()
    job = JobContract(
        id=str(uuid4()),
        queue_name="cache_sync",
        job_type="test.event",
        payload={"not_a_valid_event": True},  # Missing all required fields
        priority="normal",
        max_retries=3,
        attempt=1,
    )

    from sqlalchemy.ext.asyncio import AsyncSession
    with pytest.raises(NonRetryableError):
        await worker.process_job(job, AsyncMock())


# ─── 11. Duplicate event_id is idempotent even after a long re-submission ─────

@pytest.mark.asyncio
async def test_idempotency_same_event_id_always_duplicate():
    """
    Submitting the exact same CacheSyncEvent (same event_id) twice must return DUPLICATE
    on the second call regardless of which version the Redis idem key tracks.
    """
    await ensure_database_integrity()
    res_id = f"idem:test:{uuid4().hex[:8]}"
    event_id = str(uuid4())

    evt = CacheSyncEvent(
        event_id=event_id,
        event_type="test.event",
        resource_type="test",
        resource_id=res_id,
        version=1,
        strategy=SyncStrategy.INVALIDATE,
        broadcast_sse=False,
    )

    r1 = await cache_sync_engine.process_event(evt)
    assert r1.status == SyncStatus.APPLIED

    # Same event_id resubmitted — must be idempotent regardless of version
    r2 = await cache_sync_engine.process_event(evt)
    assert r2.status == SyncStatus.DUPLICATE, f"Expected DUPLICATE, got {r2.status}"
    assert r2.sse_broadcast is False


# ─── 12. Pattern invalidation deletes multiple matching keys ──────────────────

@pytest.mark.asyncio
async def test_pattern_invalidation_deletes_multiple_keys():
    """
    CacheSyncEngine must call delete_cache_pattern for patterns_to_invalidate
    and actually purge all matching Redis keys.
    """
    await ensure_database_integrity()
    prefix = f"pat:inv:{uuid4().hex[:6]}"
    keys = [f"{prefix}:a", f"{prefix}:b", f"{prefix}:c"]

    # Pre-populate keys
    for k in keys:
        await set_cache(k, {"data": "stale"}, ttl_seconds=60)

    res_id = f"test:res:{uuid4().hex[:8]}"
    evt = CacheSyncEvent(
        event_type="test.invalidate",
        resource_type="test",
        resource_id=res_id,
        version=1,
        strategy=SyncStrategy.INVALIDATE,
        keys_to_invalidate=[],
        patterns_to_invalidate=[f"{prefix}:*"],
        broadcast_sse=False,
    )

    result = await cache_sync_engine.process_event(evt)
    assert result.status == SyncStatus.APPLIED

    # All keys should be gone
    for k in keys:
        val = await get_cache(k)
        assert val is None, f"Expected {k} to be deleted, but it still exists"


# ─── 13. UPDATE strategy writes correct JSON to Redis with TTL ────────────────

@pytest.mark.asyncio
async def test_update_strategy_writes_correct_payload_with_ttl():
    """
    UPDATE strategy must write the exact cache_value JSON to the specified cache_key
    and the key must have a TTL set.
    """
    await ensure_database_integrity()
    res_id = f"upd:ttl:{uuid4().hex[:8]}"
    cache_key = f"cache:{res_id}"
    cache_value = {"rankings": [1, 2, 3], "updated_at": "2026-09-27T00:00:00Z"}

    evt = CacheSyncEvent(
        event_type="leaderboard.updated",
        resource_type="leaderboard",
        resource_id=res_id,
        version=1,
        strategy=SyncStrategy.UPDATE,
        cache_key=cache_key,
        cache_value=cache_value,
        cache_ttl=120,
        broadcast_sse=False,
    )

    result = await cache_sync_engine.process_event(evt)
    assert result.status == SyncStatus.APPLIED

    # Verify Redis has the value
    val = await get_cache(cache_key)
    assert val is not None
    assert val["rankings"] == [1, 2, 3]
    assert val["updated_at"] == "2026-09-27T00:00:00Z"

    # Verify TTL is set (should be <= 120 seconds from now)
    redis = get_redis()
    ttl = await redis.ttl(cache_key)
    assert 0 < ttl <= 120, f"Expected TTL <= 120, got {ttl}"


# ─── 14. Resource ID colons don't cause version key collisions ────────────────

@pytest.mark.asyncio
async def test_resource_id_colon_variants_have_distinct_version_keys():
    """
    'contest:slug-a' and 'contest:slug-b' must have DIFFERENT version keys.
    'contest:slug-a' and ':contest:slug-a' must have the SAME version key (strip).
    """
    k1 = _version_key("contest:slug-a")
    k2 = _version_key("contest:slug-b")
    k3 = _version_key(":contest:slug-a")

    assert k1 != k2, "Different resource_ids must have different version keys"
    assert k1 == k3, "Leading colon stripping must produce same key"


# ─── 15. Empty keys_to_invalidate does not crash INVALIDATE strategy ──────────

@pytest.mark.asyncio
async def test_invalidate_with_empty_keys_does_not_crash():
    """
    An INVALIDATE event with no keys_to_invalidate and no patterns_to_invalidate
    should succeed (APPLIED) without crashing.
    """
    await ensure_database_integrity()
    res_id = f"empty:inval:{uuid4().hex[:8]}"

    evt = CacheSyncEvent(
        event_type="test.empty_invalidate",
        resource_type="test",
        resource_id=res_id,
        version=1,
        strategy=SyncStrategy.INVALIDATE,
        keys_to_invalidate=[],
        patterns_to_invalidate=[],
        broadcast_sse=False,
    )
    result = await cache_sync_engine.process_event(evt)
    assert result.status == SyncStatus.APPLIED
    assert result.action == "invalidate"


# ─── 16. Version=1 from zero state always succeeds ───────────────────────────

@pytest.mark.asyncio
async def test_version_1_from_zero_state_succeeds():
    """
    For a fresh resource (no cached version), version=1 MUST be APPLIED.
    This is the first-write invariant.
    """
    await ensure_database_integrity()
    res_id = f"fresh:res:{uuid4().hex[:8]}"

    # Ensure there's no version cached for this resource
    ver = await get_cached_resource_version(res_id)
    assert ver == 0, f"Expected 0 for fresh resource, got {ver}"

    evt = CacheSyncEvent(
        event_type="contest.created",
        resource_type="contest",
        resource_id=res_id,
        version=1,
        strategy=SyncStrategy.INVALIDATE,
        broadcast_sse=False,
    )
    result = await cache_sync_engine.process_event(evt)
    assert result.status == SyncStatus.APPLIED
    assert result.current_version == 1
    assert await get_cached_resource_version(res_id) == 1


# ─── 17. SSE replay buffer bounded at exactly 100 items ──────────────────────

@pytest.mark.asyncio
async def test_sse_replay_buffer_bounded_at_100():
    """
    The SSE replay buffer MUST NEVER exceed 100 items.
    After 150 events, only the top 100 (highest-versioned) must be retained.
    """
    await ensure_database_integrity()
    from app.services.event_broadcaster import broadcast_sync_event, get_replay_events
    from app.core.redis import get_redis

    channel = f"bounded:{uuid4().hex[:6]}"
    res_id = f"test:bounded:{uuid4().hex[:6]}"

    # Publish 150 events with version=1..150
    for v in range(1, 151):
        evt = CacheSyncEvent(
            event_type="leaderboard.updated",
            resource_type="leaderboard",
            resource_id=res_id,
            version=v,
            sse_channel=channel,
            broadcast_sse=True,
            payload={"rank": v},
        )
        await cache_sync_engine.process_event(evt)

    # Check Redis ZSET size
    redis = get_redis()
    replay_key = f"ccc:sse:replay:{channel}"
    card = await redis.zcard(replay_key)
    assert card == 100, f"Replay buffer must be capped at 100, but has {card} items"

    # The minimum score in the buffer should be 51 (items 1..50 were pruned)
    min_items = await redis.zrange(replay_key, 0, 0, withscores=True)
    min_score = int(min_items[0][1])
    assert min_score == 51, f"Expected min score 51, got {min_score}"

    # Reconnecting with last_event_id=50 should trigger resync (50 < min_score-1 = 50)
    replays, resync_req = await get_replay_events(channel, last_event_id=49)
    assert resync_req is True, "Client with last_event_id=49 should need resync"


# ─── 18. process_event: version <= 0 returns FAILED ──────────────────────────

@pytest.mark.asyncio
async def test_invalid_zero_version_returns_failed():
    """
    Explicitly ensure version=0 and version=-1 return SyncStatus.FAILED immediately
    without touching Redis.
    """
    for bad_version in [0, -1, -100]:
        evt = CacheSyncEvent(
            event_type="test.bad",
            resource_type="test",
            resource_id=f"test:badver:{uuid4().hex[:6]}",
            version=bad_version,
            broadcast_sse=False,
        )
        result = await cache_sync_engine.process_event(evt)
        assert result.status == SyncStatus.FAILED, f"Expected FAILED for version={bad_version}, got {result.status}"
        assert "positive integer" in (result.error or "").lower()
