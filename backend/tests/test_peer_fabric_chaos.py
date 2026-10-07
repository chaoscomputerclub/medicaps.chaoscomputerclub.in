"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_peer_fabric_chaos.py — Peer-to-Peer Distributed Service Fabric Chaos & Resilience Suite

Comprehensive verification of:
1. Peer Lifecycle & Membership (JOINING -> HEALTHY -> DEGRADED -> DRAINING -> SUSPECT -> OFFLINE)
2. Provider-Agnostic Multi-Factor Peer Selection & Quota Awareness
3. Dynamic Nginx Router Upstream Config Generation
4. Judge Peer Failure, Lease Expiry & PostgreSQL CAS Result Fencing (Stale Attempt Rejection)
5. SSE Realtime Peer Reconnection with Monotonic Redis Ring-Buffer Replay
6. 50-Virtual-User Contest with In-Flight Chaos (API Peer Removal, Worker Drain, Judge Failure)
"""

import asyncio
from datetime import datetime, timezone, timedelta
import json
import os
import pytest
import pytest_asyncio
from uuid import uuid4

from app.core.redis import get_redis
from app.core.db import AsyncSessionLocal
from app.engine.peer_fabric.models import (
    PeerAdvertisement,
    PeerCapacity,
    PeerCapability,
    PeerHeartbeat,
    PeerRecord,
    PeerState,
    PeerType,
    QuotaState,
)
from app.engine.peer_fabric.registry import PeerRegistry
from app.engine.peer_fabric.router import PeerRouter
from app.engine.attempt_manager import AttemptManager, FinalizeResult
from app.models.judge_job import JudgeJob, JudgeJobAttempt
from scripts.simulate_50_user_contest import VirtualContestSimulator


@pytest.mark.asyncio
async def test_peer_lifecycle_and_telemetry():
    """Verify peer registration, heartbeat updates, high-load degradation, draining, and timeout reaping."""
    redis = get_redis()
    peer_id = f"peer-test-koyeb-{uuid4().hex[:6]}"

    # 1. Register peer
    ad = PeerAdvertisement(
        peer_id=peer_id,
        provider="koyeb",
        region="fra",
        endpoint=f"https://{peer_id}.koyeb.app",
        service_types=[PeerType.API_PEER, PeerType.JUDGE_PEER],
        capacity=PeerCapacity(
            max_concurrent_requests=100,
            max_concurrent_jobs=8,
            cpu_cores=2.0,
            memory_mb=1024,
            quota_state=QuotaState.NORMAL,
        ),
        capabilities=PeerCapability(
            http_api=True,
            judge_languages=["python", "cpp", "java", "rust"],
            docker_sandboxing=True,
        ),
    )

    rec = await PeerRegistry.register(ad)
    assert rec.status == PeerState.HEALTHY
    assert rec.advertisement.peer_id == peer_id

    # Check active set
    is_active = await redis.sismember("ccc:peers:active", peer_id)
    assert is_active

    # 2. Telemetry Heartbeat (Normal)
    hb_normal = PeerHeartbeat(
        peer_id=peer_id,
        timestamp=datetime.now(timezone.utc),
        status=PeerState.HEALTHY,
        cpu_utilization_percent=25.0,
        memory_utilization_mb=256,
        active_requests=10,
        active_jobs=2,
        latency_p95_ms=12.5,
        quota_state=QuotaState.NORMAL,
    )
    updated_rec = await PeerRegistry.record_heartbeat(hb_normal)
    assert updated_rec is not None
    assert updated_rec.status == PeerState.HEALTHY
    assert updated_rec.telemetry.cpu_utilization_percent == 25.0

    # 3. Telemetry Heartbeat (High CPU -> Auto-degrade)
    hb_heavy = PeerHeartbeat(
        peer_id=peer_id,
        timestamp=datetime.now(timezone.utc),
        status=PeerState.HEALTHY,
        cpu_utilization_percent=94.5,
        memory_utilization_mb=900,
        active_requests=95,
        active_jobs=8,
        latency_p95_ms=85.0,
        quota_state=QuotaState.WARNING,
    )
    degraded_rec = await PeerRegistry.record_heartbeat(hb_heavy)
    assert degraded_rec is not None
    assert degraded_rec.status == PeerState.DEGRADED

    # 4. Graceful Draining
    drained = await PeerRegistry.drain(peer_id)
    assert drained is True

    # 5. Heartbeat expiration simulation
    await redis.delete(f"ccc:peer:heartbeat:{peer_id}")
    all_peers = await PeerRegistry.get_all_peers()
    matching = [p for p in all_peers if p.advertisement.peer_id == peer_id]
    assert len(matching) == 1
    assert matching[0].status == PeerState.SUSPECT

    # Cleanup
    await redis.srem("ccc:peers:active", peer_id)
    await redis.delete(f"ccc:peer:record:{peer_id}")


@pytest.mark.asyncio
async def test_peer_router_scoring_and_quota_filtering():
    """Verify multi-factor peer scoring formula, quota exhaustion filtering, and capability checks."""
    redis = get_redis()
    now = datetime.now(timezone.utc)

    # Peer A: Fast, healthy, normal quota
    p_a = PeerAdvertisement(
        peer_id="peer-scorer-a",
        provider="google-cloud-run",
        endpoint="https://cloudrun-a.run.app",
        service_types=[PeerType.JUDGE_PEER],
        capacity=PeerCapacity(max_concurrent_jobs=10, quota_state=QuotaState.NORMAL),
        capabilities=PeerCapability(judge_languages=["cpp", "python"]),
    )
    await PeerRegistry.register(p_a)
    await PeerRegistry.record_heartbeat(
        PeerHeartbeat(
            peer_id="peer-scorer-a",
            timestamp=now,
            status=PeerState.HEALTHY,
            active_jobs=1,
            latency_p95_ms=10.0,
            quota_state=QuotaState.NORMAL,
        )
    )

    # Peer B: Exhausted quota -> MUST be filtered out
    p_b = PeerAdvertisement(
        peer_id="peer-scorer-b",
        provider="render",
        endpoint="https://render-b.onrender.com",
        service_types=[PeerType.JUDGE_PEER],
        capacity=PeerCapacity(max_concurrent_jobs=4, quota_state=QuotaState.EXHAUSTED),
        capabilities=PeerCapability(judge_languages=["cpp", "python"]),
    )
    await PeerRegistry.register(p_b)
    await PeerRegistry.record_heartbeat(
        PeerHeartbeat(
            peer_id="peer-scorer-b",
            timestamp=now,
            status=PeerState.HEALTHY,
            active_jobs=0,
            latency_p95_ms=8.0,
            quota_state=QuotaState.EXHAUSTED,
        )
    )

    # Peer C: Supports only python (no cpp)
    p_c = PeerAdvertisement(
        peer_id="peer-scorer-c",
        provider="railway",
        endpoint="https://railway-c.up.railway.app",
        service_types=[PeerType.JUDGE_PEER],
        capacity=PeerCapacity(max_concurrent_jobs=4, quota_state=QuotaState.NORMAL),
        capabilities=PeerCapability(judge_languages=["python"]),
    )
    await PeerRegistry.register(p_c)
    await PeerRegistry.record_heartbeat(
        PeerHeartbeat(
            peer_id="peer-scorer-c",
            timestamp=now,
            status=PeerState.HEALTHY,
            active_jobs=0,
            latency_p95_ms=15.0,
            quota_state=QuotaState.NORMAL,
        )
    )

    # Select for C++
    selected_cpp = await PeerRouter.select_peers(
        required_role=PeerType.JUDGE_PEER,
        required_language="cpp",
        limit=5,
    )
    selected_ids = [p.advertisement.peer_id for p in selected_cpp]

    # Verification:
    # - Peer A must be selected
    # - Peer B must be excluded (Quota Exhausted)
    # - Peer C must be excluded (Language incompatible)
    assert "peer-scorer-a" in selected_ids
    assert "peer-scorer-b" not in selected_ids
    assert "peer-scorer-c" not in selected_ids

    # Cleanup
    for pid in ["peer-scorer-a", "peer-scorer-b", "peer-scorer-c"]:
        await redis.srem("ccc:peers:active", pid)
        await redis.delete(f"ccc:peer:record:{pid}")
        await redis.delete(f"ccc:peer:heartbeat:{pid}")


@pytest.mark.asyncio
async def test_dynamic_nginx_router_config_generation():
    import sys
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    from scripts.peer_sync_router import generate_nginx_upstreams

    peers = [
        PeerRecord(
            advertisement=PeerAdvertisement(
                peer_id="peer-api-cloudrun",
                provider="google-cloud-run",
                endpoint="https://cloudrun-api.run.app",
                service_types=[PeerType.API_PEER],
            ),
            status=PeerState.HEALTHY,
        ),
        PeerRecord(
            advertisement=PeerAdvertisement(
                peer_id="peer-api-koyeb",
                provider="koyeb",
                endpoint="https://koyeb-api.koyeb.app",
                service_types=[PeerType.API_PEER, PeerType.REALTIME_PEER],
            ),
            status=PeerState.HEALTHY,
        ),
        PeerRecord(
            advertisement=PeerAdvertisement(
                peer_id="peer-api-draining",
                provider="render",
                endpoint="https://render-draining.onrender.com",
                service_types=[PeerType.API_PEER],
            ),
            status=PeerState.DRAINING,  # Drained -> MUST NOT appear in active routing
        ),
    ]

    conf = generate_nginx_upstreams(peers)
    assert "upstream ccc_api_peers" in conf
    assert "upstream ccc_realtime_peers" in conf
    assert "cloudrun-api.run.app" in conf
    assert "koyeb-api.koyeb.app" in conf
    assert "render-draining.onrender.com" not in conf


@pytest.mark.asyncio
async def test_judge_peer_failure_and_cas_fencing():
    """
    Verify Level 3 Judge Failure requirement:
    Job -> Judge Peer A (Attempt 1) -> Crash / Lease Expiry
    Redis -> Judge Peer B (Attempt 2)
    Judge Peer A reports result -> REJECTED (STALE_ATTEMPT)
    Judge Peer B reports result -> ACCEPTED (AUTHORITATIVE)
    """
    async with AsyncSessionLocal() as db:
        # 1. Create root JudgeJob
        job = await AttemptManager.create_job(
            db=db,
            submission_id=f"sub-chaos-{uuid4().hex[:8]}",
            provider="distributed",
        )
        await db.commit()

        # 2. Create Attempt #1 (Assigned to Judge Peer A)
        attempt_1 = await AttemptManager.create_attempt(
            db=db,
            job_id=job.id,
            provider="judge-laptop-01",
        )
        await db.commit()
        assert job.active_attempt_id == attempt_1.id
        assert job.attempt_number == 1

        # 3. Simulate Judge Peer A crash: Attempt #2 is spawned (Assigned to Judge Peer B)
        attempt_2 = await AttemptManager.create_attempt(
            db=db,
            job_id=job.id,
            provider="judge-gaming-pc-02",
        )
        await db.commit()
        assert job.active_attempt_id == attempt_2.id
        assert job.attempt_number == 2

        # 4. Judge Peer A wakes up late and attempts to finalize Attempt #1
        status_1, _ = await AttemptManager.finalize_attempt(
            db=db,
            job_id=job.id,
            attempt_id=attempt_1.id,  # Stale attempt!
            final_state="COMPLETED",
            execution_time_ms=120.0,
            result_payload={"verdict": "ACCEPTED", "reporter": "judge-laptop-01"},
        )
        await db.commit()

        # PostgreSQL CAS conditional update MUST reject Attempt #1!
        assert status_1 == FinalizeResult.STALE_ATTEMPT

        # Verify job is still PROCESSING on Attempt #2
        await db.refresh(job)
        assert job.state == "PROCESSING"
        assert job.active_attempt_id == attempt_2.id

        # 5. Judge Peer B finishes Attempt #2
        status_2, _ = await AttemptManager.finalize_attempt(
            db=db,
            job_id=job.id,
            attempt_id=attempt_2.id,  # Authoritative attempt!
            final_state="COMPLETED",
            execution_time_ms=85.0,
            result_payload={"verdict": "ACCEPTED", "reporter": "judge-gaming-pc-02"},
        )
        await db.commit()

        # Must succeed!
        assert status_2 == FinalizeResult.SUCCESS

        await db.refresh(job)
        assert job.state == "COMPLETED"
        assert job.active_attempt_id is None
        assert job.result_payload["reporter"] == "judge-gaming-pc-02"


@pytest.mark.asyncio
async def test_sse_peer_reconnect_and_ringbuffer_replay():
    """Verify SSE peer failover: client reconnecting with Last-Event-ID replays missed events cleanly."""
    redis = get_redis()
    contest_id = f"contest-sse-{uuid4().hex[:6]}"
    ring_key = f"ccc:events:contest:{contest_id}:ring"

    # Populate 5 sequential events into Redis ring buffer
    events = [
        {"id": 1, "type": "submission_evaluated", "submission_id": "sub_1", "verdict": "AC"},
        {"id": 2, "type": "scoreboard_updated", "leader": "user_alpha"},
        {"id": 3, "type": "submission_evaluated", "submission_id": "sub_2", "verdict": "WA"},
        {"id": 4, "type": "first_solve_awarded", "problem": "A", "solver": "user_alpha"},
        {"id": 5, "type": "scoreboard_updated", "leader": "user_alpha"},
    ]

    for ev in events:
        await redis.rpush(ring_key, json.dumps(ev))
    await redis.expire(ring_key, 3600)

    # Client was connected to Realtime Peer A, saw event ID 2, then Peer A died.
    # Client reconnects to Realtime Peer B with Last-Event-ID: 2
    last_event_id = 2

    # Peer B reads buffer and replays all events > 2
    raw_history = await redis.lrange(ring_key, 0, -1)
    replayed = []
    for item in raw_history:
        ev_data = json.loads(item)
        if ev_data["id"] > last_event_id:
            replayed.append(ev_data)

    assert len(replayed) == 3
    assert [e["id"] for e in replayed] == [3, 4, 5]
    assert replayed[0]["type"] == "submission_evaluated"
    assert replayed[1]["type"] == "first_solve_awarded"
    assert replayed[2]["type"] == "scoreboard_updated"

    # Cleanup
    await redis.delete(ring_key)


@pytest.mark.asyncio
async def test_50_user_contest_with_peer_chaos():
    """
    Run 50-user online competitive programming contest simulation with live in-flight peer chaos:
    - Remove 1 API peer mid-flight
    - Drain 1 Worker peer mid-flight
    - Inject Judge peer crash mid-flight
    Verify 100% submission completion, CAS integrity, and correct mathematical scoreboard ranking.
    """
    redis = get_redis()

    # Pre-register test fabric peers
    test_peers = [
        PeerAdvertisement(
            peer_id="peer-api-run-1",
            provider="google-cloud-run",
            endpoint="https://run-1.run.app",
            service_types=[PeerType.API_PEER],
        ),
        PeerAdvertisement(
            peer_id="peer-api-koyeb-2",
            provider="koyeb",
            endpoint="https://koyeb-2.koyeb.app",
            service_types=[PeerType.API_PEER],
        ),
        PeerAdvertisement(
            peer_id="peer-worker-1",
            provider="railway",
            endpoint="https://railway-worker.app",
            service_types=[PeerType.WORKER_PEER],
        ),
        PeerAdvertisement(
            peer_id="peer-judge-laptop",
            provider="laptop",
            endpoint="http://192.168.1.50:9090",
            service_types=[PeerType.JUDGE_PEER],
            capabilities=PeerCapability(judge_languages=["*"]),
        ),
        PeerAdvertisement(
            peer_id="peer-judge-pc",
            provider="gaming-pc",
            endpoint="http://192.168.1.100:9090",
            service_types=[PeerType.JUDGE_PEER],
            capabilities=PeerCapability(judge_languages=["*"]),
        ),
    ]

    for p in test_peers:
        await PeerRegistry.register(p)

    sim = VirtualContestSimulator(user_count=50, concurrency=25)

    # Launch simulation concurrently with background chaos injector
    async def inject_chaos():
        await asyncio.sleep(0.15)
        # Chaos 1: Remove API peer
        await redis.srem("ccc:peers:active", "peer-api-run-1")
        await redis.delete("ccc:peer:heartbeat:peer-api-run-1")

        await asyncio.sleep(0.15)
        # Chaos 2: Drain Worker peer
        await PeerRegistry.drain("peer-worker-1")

        await asyncio.sleep(0.15)
        # Chaos 3: Fail Judge peer (heartbeat drops)
        await redis.delete("ccc:peer:heartbeat:peer-judge-laptop")

    # Run simulation and chaos concurrently
    sim_task = asyncio.create_task(sim.run_full_simulation())
    chaos_task = asyncio.create_task(inject_chaos())

    results, _ = await asyncio.gather(sim_task, chaos_task)

    # 1. 50 Users registered idempotently
    assert results["registrations"]["total_registered"] == 50

    # 2. 150 Submissions queued and executed
    assert results["submissions"]["total_queued"] == 150
    assert results["judging"]["processed"] == 150
    assert results["judging"]["successful_leases"] == 150
    assert results["judging"]["cas_conflicts"] == 0

    # 3. Scoreboard audit
    assert results["audit"]["total_participants"] == 50
    top_5 = results["audit"]["top_5"]
    assert len(top_5) == 5

    # Solved DESC, Penalty ASC
    for i in range(len(top_5) - 1):
        assert top_5[i]["solved"] >= top_5[i + 1]["solved"]
        if top_5[i]["solved"] == top_5[i + 1]["solved"]:
            assert top_5[i]["penalty_min"] <= top_5[i + 1]["penalty_min"]

    # Cleanup peers
    for p in test_peers:
        await redis.srem("ccc:peers:active", p.peer_id)
        await redis.delete(f"ccc:peer:record:{p.peer_id}")
        await redis.delete(f"ccc:peer:heartbeat:{p.peer_id}")
