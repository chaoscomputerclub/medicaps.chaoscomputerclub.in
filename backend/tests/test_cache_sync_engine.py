"""
Chaos Computer Club — Production Real-Time Cache Synchronization Engine Test Suite
Tests:
1. Monotonic version validation & atomic Redis Compare-And-Set (CAS) Lua script
2. Invariant: cache_version NEVER decreases
3. Idempotency & duplicate event suppression (no redundant updates or SSE broadcasts)
4. Cache strategies: UPDATE vs INVALIDATE
5. Single-flight request coalescing (cache stampede / thundering herd protection)
6. Stale-While-Revalidate (SWR) background refresh
7. High-frequency event coalescing
8. Concurrency resilience (100 concurrent workers race on same resource with random versions)
9. SSE Last-Event-ID reconnect recovery and replay buffer
10. Slow SSE client bounded queue backpressure and resync signalling
11. End-to-end Transactional Outbox -> ChaosQueue -> CacheSyncWorker -> CacheSyncEngine -> Redis -> SSE
"""

from __future__ import annotations

import asyncio
import json
import random
import time
from typing import List
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal, ensure_database_integrity, get_next_resource_version, init_db
from app.core.cache import (
    CacheSyncEngine,
    CacheSyncEvent,
    SingleFlight,
    SWREngine,
    SyncResult,
    SyncStatus,
    SyncStrategy,
    cache_sync_engine,
    delete_cache,
    execute_atomic_cas_sync,
    get_cache,
    get_cached_resource_version,
    metrics,
    set_cache,
    single_flight,
    swr_engine,
)
from app.core.cache.coalescing import EventCoalescer
from app.core.queue.outbox import record_cache_sync_event, relay_outbox_events
from app.core.queue.redis_queue import RedisQueueEngine
from app.services.event_broadcaster import (
    broadcast_sync_event,
    get_replay_events,
    subscribe,
    unsubscribe,
)
from app.workers.cache_sync_worker import CacheSyncWorker


@pytest.mark.asyncio
async def test_event_contract_validation():
    """Verify that CacheSyncEvent enforces strict schema validation and positive versions."""
    # Valid event
    evt = CacheSyncEvent(
        event_type="leaderboard.updated",
        resource_type="leaderboard",
        resource_id="leaderboard:global",
        version=42,
        strategy=SyncStrategy.INVALIDATE,
        payload={"count": 100},
    )
    assert evt.version == 42
    assert evt.event_type == "leaderboard.updated"
    assert evt.correlation_id.startswith("sync-")

    # Invalid version <= 0 handled by engine
    invalid_evt = CacheSyncEvent(
        event_type="test.invalid",
        resource_type="test",
        resource_id="test:res",
        version=0,
    )
    res = await cache_sync_engine.process_event(invalid_evt)
    assert res.status == SyncStatus.FAILED
    assert "positive integer" in (res.error or "")


@pytest.mark.asyncio
async def test_atomic_cas_version_monotonicity():
    """
    CRITICAL INVARIANT TEST:
    Verify that cache_version NEVER decreases under any arrival order.
    v41 -> applied
    v42 -> applied
    v40 -> rejected as stale
    v42 again -> rejected as duplicate
    Final version must remain strictly 42.
    """
    res_id = f"test:leaderboard:{uuid4().hex[:8]}"

    # 1. Apply v41
    e41 = CacheSyncEvent(
        event_type="leaderboard.updated",
        resource_type="leaderboard",
        resource_id=res_id,
        version=41,
        strategy=SyncStrategy.INVALIDATE,
        keys_to_invalidate=[f"cache:{res_id}"],
        broadcast_sse=False,
    )
    res41 = await cache_sync_engine.process_event(e41)
    assert res41.status == SyncStatus.APPLIED
    assert res41.current_version == 41
    assert await get_cached_resource_version(res_id) == 41

    # 2. Apply v42
    e42 = CacheSyncEvent(
        event_type="leaderboard.updated",
        resource_type="leaderboard",
        resource_id=res_id,
        version=42,
        strategy=SyncStrategy.INVALIDATE,
        keys_to_invalidate=[f"cache:{res_id}"],
        broadcast_sse=False,
    )
    res42 = await cache_sync_engine.process_event(e42)
    assert res42.status == SyncStatus.APPLIED
    assert res42.current_version == 42
    assert await get_cached_resource_version(res_id) == 42

    # 3. Apply v40 (stale arriving out-of-order)
    e40 = CacheSyncEvent(
        event_type="leaderboard.updated",
        resource_type="leaderboard",
        resource_id=res_id,
        version=40,
        strategy=SyncStrategy.INVALIDATE,
        keys_to_invalidate=[f"cache:{res_id}"],
        broadcast_sse=False,
    )
    res40 = await cache_sync_engine.process_event(e40)
    assert res40.status == SyncStatus.STALE
    assert res40.current_version == 42
    assert res40.action == "noop"
    assert res40.sse_broadcast is False
    assert await get_cached_resource_version(res_id) == 42

    # 4. Apply v42 duplicate
    res42_dup = await cache_sync_engine.process_event(e42)
    assert res42_dup.status == SyncStatus.DUPLICATE
    assert res42_dup.action == "noop"
    assert res42_dup.sse_broadcast is False
    assert await get_cached_resource_version(res_id) == 42


@pytest.mark.asyncio
async def test_cache_mutation_strategies():
    """Verify UPDATE strategy directly sets Redis cache and INVALIDATE strategy deletes keys."""
    res_id = f"test:resource:{uuid4().hex[:8]}"
    cache_key = f"cache:{res_id}"

    # Strategy 1: UPDATE
    e_update = CacheSyncEvent(
        event_type="item.updated",
        resource_type="item",
        resource_id=res_id,
        version=1,
        strategy=SyncStrategy.UPDATE,
        cache_key=cache_key,
        cache_value={"score": 100, "status": "active"},
        cache_ttl=60,
        broadcast_sse=False,
    )
    res_up = await cache_sync_engine.process_event(e_update)
    assert res_up.status == SyncStatus.APPLIED
    val = await get_cache(cache_key)
    assert val is not None
    assert val.get("score") == 100

    # Strategy 2: INVALIDATE
    e_inval = CacheSyncEvent(
        event_type="item.invalidated",
        resource_type="item",
        resource_id=res_id,
        version=2,
        strategy=SyncStrategy.INVALIDATE,
        keys_to_invalidate=[cache_key],
        broadcast_sse=False,
    )
    res_inv = await cache_sync_engine.process_event(e_inval)
    assert res_inv.status == SyncStatus.APPLIED
    val_after = await get_cache(cache_key)
    assert val_after is None


@pytest.mark.asyncio
async def test_single_flight_stampede_protection():
    """
    Test that 50 concurrent requests hitting a cache miss execute the underlying
    database loader exactly ONCE, coalescing all 50 requests into 1 execution.
    """
    sf = SingleFlight()
    test_key = f"cache:stampede:{uuid4().hex[:8]}"
    call_count = 0

    async def expensive_db_loader() -> dict:
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)  # Simulate DB query latency
        return {"data": "verified_result", "exec_count": call_count}

    # Launch 50 concurrent tasks
    tasks = [
        sf.execute(test_key, expensive_db_loader, use_distributed_lock=False)
        for _ in range(50)
    ]
    results = await asyncio.gather(*tasks)

    # Invariant: exactly 1 database execution occurred
    assert call_count == 1, f"Expected 1 execution, got {call_count}"
    assert len(results) == 50
    for r in results:
        assert r["data"] == "verified_result"


@pytest.mark.asyncio
async def test_stale_while_revalidate():
    """Test that SWR returns stale data immediately and triggers background refresh."""
    key = f"cache:swr:{uuid4().hex[:8]}"
    fetch_count = 0

    async def fetcher() -> int:
        nonlocal fetch_count
        fetch_count += 1
        return fetch_count

    # 1. Hard miss: populates cache with fetcher() = 1
    val1 = await swr_engine.get_with_swr(key, fetcher, ttl_seconds=1, swr_seconds=2)
    assert val1 == 1
    assert fetch_count == 1

    # 2. Immediate read within TTL: returns fresh cache
    val2 = await swr_engine.get_with_swr(key, fetcher, ttl_seconds=1, swr_seconds=2)
    assert val2 == 1
    assert fetch_count == 1

    # 3. Wait for TTL to expire into SWR window (1.2s > 1s TTL, < 3s TTL+SWR)
    await asyncio.sleep(1.2)
    val3 = await swr_engine.get_with_swr(key, fetcher, ttl_seconds=1, swr_seconds=2)
    # Stale value returned immediately
    assert val3 == 1

    # Wait for background refresh task to complete
    await asyncio.sleep(0.1)
    assert fetch_count == 2


@pytest.mark.asyncio
async def test_event_coalescing():
    """Test that rapid successive events within micro-batch window coalesce to highest version."""
    coalescer = EventCoalescer(window_seconds=0.15)
    flushed_events: List[CacheSyncEvent] = []

    async def flush_handler(event: CacheSyncEvent):
        flushed_events.append(event)

    res_id = "contest:live-scoreboard"
    c_key = f"coalesce:{res_id}"

    # Submit 10 events with increasing versions in quick succession
    for v in range(100, 110):
        evt = CacheSyncEvent(
            event_type="scoreboard.updated",
            resource_type="scoreboard",
            resource_id=res_id,
            version=v,
            coalesce_key=c_key,
            payload={"score": v * 10},
        )
        await coalescer.submit(evt, flush_handler)
        await asyncio.sleep(0.005)

    # Await window completion
    await asyncio.sleep(0.25)

    # Invariant: coalesced into single flush with the latest version (109)
    assert len(flushed_events) == 1
    assert flushed_events[0].version == 109
    assert flushed_events[0].payload["score"] == 1090


@pytest.mark.asyncio
async def test_concurrency_100_workers_random_order():
    """
    STRESS CONCURRENCY TEST:
    100 concurrent workers attempt to synchronize the same resource with versions 1..100
    in completely randomized completion order.
    The final version in Redis MUST be strictly 100.
    """
    res_id = f"race:resource:{uuid4().hex[:8]}"
    versions = list(range(1, 101))
    random.shuffle(versions)

    async def worker_task(ver: int):
        await asyncio.sleep(random.uniform(0.001, 0.05))
        evt = CacheSyncEvent(
            event_type="stress.test",
            resource_type="stress",
            resource_id=res_id,
            version=ver,
            strategy=SyncStrategy.INVALIDATE,
            broadcast_sse=False,
        )
        return await cache_sync_engine.process_event(evt)

    results = await asyncio.gather(*[worker_task(v) for v in versions])
    assert len(results) == 100

    # Final version in Redis MUST be 100
    final_ver = await get_cached_resource_version(res_id)
    assert final_ver == 100, f"Expected final version 100, got {final_ver}"


@pytest.mark.asyncio
async def test_sse_replay_and_last_event_id_recovery():
    """
    Test SSE replay buffer:
    Client connects, receives events.
    Client disconnects.
    New events v42, v43 are published.
    Client reconnects with Last-Event-ID: 41.
    Server replays missing events v42 and v43.
    """
    res_id = f"leaderboard:{uuid4().hex[:6]}"
    channel = f"test_chan_{uuid4().hex[:6]}"

    # Publish events v41, v42, v43
    for v in [41, 42, 43]:
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

    # Reconnect with Last-Event-ID: 41
    replays, resync_req = await get_replay_events(channel, last_event_id=41)
    assert resync_req is False
    assert len(replays) == 2  # Should contain v42 and v43
    parsed_42 = json.loads(replays[0])
    parsed_43 = json.loads(replays[1])
    assert parsed_42["version"] == 42
    assert parsed_43["version"] == 43

    # Client reconnects with ancient Last-Event-ID: 1 (out of retention buffer)
    # Simulate an ancient id by querying with id = 0 when replay buffer starts higher
    replays_old, resync_req_old = await get_replay_events(channel, last_event_id=0)
    # If the buffer lowest score is 41, 0 is too old
    assert resync_req_old is True


@pytest.mark.asyncio
async def test_end_to_end_outbox_to_cache_sync():
    """
    Full End-to-End Pipeline:
    PostgreSQL Transaction -> OutboxEvent -> ChaosQueue -> CacheSyncWorker -> Redis CAS -> SSE
    """
    await init_db()
    res_id = f"contest:{uuid4().hex[:8]}"
    cache_key = f"cache:{res_id}"
    await set_cache(cache_key, {"title": "Old Contest State"}, ttl_seconds=60)

    # 1. DB Transaction commits state and records OutboxEvent with monotonic version
    async with AsyncSessionLocal() as db:
        next_ver = await get_next_resource_version(db, res_id)
        assert next_ver >= 1

        sync_event = CacheSyncEvent(
            event_type="contest.updated",
            resource_type="contest",
            resource_id=res_id,
            version=next_ver,
            strategy=SyncStrategy.INVALIDATE,
            keys_to_invalidate=[cache_key],
            payload={"status": "live", "title": "Updated Contest Title"},
            broadcast_sse=False,
        )
        outbox_row = await record_cache_sync_event(db, sync_event, priority="high")
        await db.commit()
        outbox_id = outbox_row.id

    # 2. Outbox Relay picks up event and enqueues to ChaosQueue
    async with AsyncSessionLocal() as db:
        relayed = await relay_outbox_events(db, batch_size=10)
        assert relayed >= 1

    # 3. Dequeue job from ChaosQueue 'cache_sync'
    job = await RedisQueueEngine.dequeue("cache_sync", timeout=2)
    assert job is not None
    assert job.job_type == "contest.updated"

    # 4. Execute job through CacheSyncWorker
    worker = CacheSyncWorker()
    async with AsyncSessionLocal() as db:
        worker_result = await worker.process_job(job, db)
        assert worker_result["status"] == "applied"
        assert worker_result["current_version"] == next_ver
        await RedisQueueEngine.ack(job, result=worker_result, duration_ms=10.0)

    # 5. Verify Redis cache state: key was invalidated, version advanced
    cached_after = await get_cache(cache_key)
    assert cached_after is None
    applied_ver = await get_cached_resource_version(res_id)
    assert applied_ver == next_ver
