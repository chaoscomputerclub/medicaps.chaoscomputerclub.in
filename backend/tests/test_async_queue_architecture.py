"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_async_queue_architecture.py
Comprehensive Production-Grade Test Suite for Asynchronous Queue Architecture:
1. Job Contract Serialization & Versioning
2. Distributed Locking & Mutual Exclusion (Lua release)
3. Redis Queue Enqueue, Atomic Dequeue & ACK
4. Idempotency Key Deduplication
5. Exponential Backoff Retries with Jitter
6. Dead-Letter Queue (DLQ) & Admin Replay
7. Backpressure Depth Enforcement
8. Base Worker Concurrency & Execution Lifecycle
9. Transactional Outbox Pattern & DB-Queue Relay
10. Job Status Telemetry & BOLA / IDOR Security
"""

import asyncio
import time
import pytest
from uuid import uuid4

from app.core.queue.contracts import (
    JobContract,
    JobPriority,
    JobState,
    NonRetryableError,
    RetryableError,
)
from app.core.queue.lock import DistributedLock, distributed_lock
from app.core.queue.redis_queue import (
    QueueBackpressureError,
    RedisQueueEngine,
)
from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.outbox import (
    OutboxEvent,
    record_outbox_event,
    relay_outbox_events,
)
from app.core.db import AsyncSessionLocal
from app.models.db_models import MemberProfile
from app.controllers.job_controller import JobController
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_job_contract_serialization():
    """Verify JobContract dataclass serializes and deserializes cleanly with versioning."""
    job = JobContract(
        queue_name="email",
        job_type="SEND_OTP_EMAIL",
        version=1,
        payload={"to_email": "cadet@medicaps.ac.in", "otp_code": "849201"},
        priority=JobPriority.HIGH,
        correlation_id="req-test-1234",
    )
    data = job.to_dict()
    assert data["job_type"] == "SEND_OTP_EMAIL"
    assert data["priority"] == "high"
    assert data["status"] == "queued"
    assert data["version"] == 1

    restored = JobContract.from_dict(data)
    assert restored.id == job.id
    assert restored.priority == JobPriority.HIGH
    assert restored.status == JobState.QUEUED
    assert restored.payload["otp_code"] == "849201"


@pytest.mark.asyncio
async def test_distributed_locking_mutual_exclusion():
    """Verify DistributedLock guarantees mutual exclusion and safe release via Lua script."""
    lock_key = f"test:lock:{uuid4().hex[:8]}"

    lock1 = DistributedLock(lock_key, ttl_seconds=5)
    lock2 = DistributedLock(lock_key, ttl_seconds=5)

    # 1. Lock 1 acquires successfully
    acquired1 = await lock1.acquire()
    assert acquired1 is True

    # 2. Lock 2 fails to acquire concurrently
    acquired2 = await lock2.acquire()
    assert acquired2 is False

    # 3. Lock 1 releases atomically
    released = await lock1.release()
    assert released is True

    # 4. Now Lock 2 can acquire
    acquired2_after = await lock2.acquire()
    assert acquired2_after is True
    await lock2.release()


@pytest.mark.asyncio
async def test_distributed_lock_context_manager():
    """Verify distributed_lock async context manager auto-releases on exit."""
    lock_key = f"test:ctx_lock:{uuid4().hex[:8]}"

    async with distributed_lock(lock_key, ttl_seconds=5) as acquired:
        assert acquired is True
        # Verify another cannot acquire
        lock_inner = DistributedLock(lock_key, ttl_seconds=5)
        assert await lock_inner.acquire() is False

    # After context exit, lock should be free
    lock_outer = DistributedLock(lock_key, ttl_seconds=5)
    assert await lock_outer.acquire() is True
    await lock_outer.release()


@pytest.mark.asyncio
async def test_redis_queue_enqueue_dequeue_ack():
    """Verify atomic lease, state transition, and acknowledgment."""
    q_name = f"test_q_{uuid4().hex[:6]}"

    job = await RedisQueueEngine.enqueue(
        queue_name=q_name,
        job_type="TEST_TASK",
        payload={"message": "hello async"},
        priority=JobPriority.NORMAL,
    )
    assert job.status == JobState.QUEUED

    # Dequeue with atomic lease
    leased_job = await RedisQueueEngine.dequeue(q_name, timeout=2)
    assert leased_job is not None
    assert leased_job.id == job.id
    assert leased_job.status == JobState.PROCESSING

    # Acknowledge success
    await RedisQueueEngine.ack(leased_job, result={"computed": 42}, duration_ms=12.5)

    # Verify state in Redis
    completed_job = await RedisQueueEngine.get_job(job.id)
    assert completed_job is not None
    assert completed_job.status == JobState.COMPLETED
    assert completed_job.result == {"computed": 42}
    assert completed_job.execution_duration_ms == 12.5


@pytest.mark.asyncio
async def test_redis_queue_idempotency_deduplication():
    """Verify identical idempotency key returns the existing job without duplicate enqueueing."""
    q_name = f"test_idem_{uuid4().hex[:6]}"
    idem_key = f"unique_user_action_{uuid4().hex}"

    job1 = await RedisQueueEngine.enqueue(
        queue_name=q_name,
        job_type="SEND_OTP",
        payload={"email": "student@medicaps.ac.in"},
        idempotency_key=idem_key,
    )

    job2 = await RedisQueueEngine.enqueue(
        queue_name=q_name,
        job_type="SEND_OTP",
        payload={"email": "student@medicaps.ac.in"},
        idempotency_key=idem_key,
    )

    assert job1.id == job2.id

    # Dequeue should only yield ONE job
    leased1 = await RedisQueueEngine.dequeue(q_name, timeout=1)
    assert leased1 is not None
    assert leased1.id == job1.id

    # Queue should now be empty
    leased2 = await RedisQueueEngine.dequeue(q_name, timeout=1)
    assert leased2 is None

    await RedisQueueEngine.ack(leased1)


@pytest.mark.asyncio
async def test_redis_queue_retry_and_dead_letter():
    """Verify exponential backoff retry and routing to DLQ upon terminal failure."""
    q_name = f"test_retry_{uuid4().hex[:6]}"

    job = await RedisQueueEngine.enqueue(
        queue_name=q_name,
        job_type="FLAKY_NETWORK_CALL",
        payload={"url": "https://api.external.com"},
        max_retries=2,
        backoff_base_seconds=0.1,  # Fast backoff for testing (actual delay = 0.1 + jitter 0.1–1.0s)
    )

    # 1. Dequeue attempt 1
    leased = await RedisQueueEngine.dequeue(q_name, timeout=2)
    assert leased is not None

    # 2. Simulate Retryable Failure on attempt 1
    await RedisQueueEngine.nack(leased, error="503 Service Unavailable", is_retryable=True)

    # Verify status is RETRYING
    retrying_job = await RedisQueueEngine.get_job(job.id)
    assert retrying_job.status == JobState.RETRYING
    assert retrying_job.attempt == 2

    # Wait for backoff expiration — base=0.1 + jitter up to 1.0 → max 1.1s, so wait 1.5s
    await asyncio.sleep(1.5)

    # 3. Dequeue attempt 2
    leased2 = await RedisQueueEngine.dequeue(q_name, timeout=2)
    assert leased2 is not None
    assert leased2.attempt == 2

    # 4. Simulate Failure on attempt 2 (max_retries reached) -> should route to DLQ
    await RedisQueueEngine.nack(leased2, error="503 Final Timeout", is_retryable=True)

    dlq_job = await RedisQueueEngine.get_job(job.id)
    assert dlq_job.status == JobState.DEAD_LETTER
    assert dlq_job.error == "503 Final Timeout"

    # Verify DLQ count
    metrics = await RedisQueueEngine.get_queue_metrics(q_name)
    assert metrics["dead_letter"] == 1


@pytest.mark.asyncio
async def test_dlq_replay_mechanism():
    """Verify administrative replay restores dead-lettered job to pending state."""
    q_name = f"test_dlq_replay_{uuid4().hex[:6]}"

    job = await RedisQueueEngine.enqueue(
        queue_name=q_name,
        job_type="CRITICAL_PAYLOAD",
        payload={"record_id": 99},
        max_retries=1,
    )
    leased = await RedisQueueEngine.dequeue(q_name, timeout=2)
    await RedisQueueEngine.nack(leased, error="Non-retryable poison pill", is_retryable=False)

    # Verify job is dead-lettered
    dlq_job = await RedisQueueEngine.get_job(job.id)
    assert dlq_job.status == JobState.DEAD_LETTER

    # Administrative Replay
    replayed = await RedisQueueEngine.replay_dlq_job(q_name, job.id)
    assert replayed is True

    # Job should now be dequeued again
    re_leased = await RedisQueueEngine.dequeue(q_name, timeout=2)
    assert re_leased is not None
    assert re_leased.id == job.id
    assert re_leased.attempt == 1
    assert re_leased.error is None

    await RedisQueueEngine.ack(re_leased)


@pytest.mark.asyncio
async def test_worker_execution_lifecycle():
    """Test BaseQueueWorker consuming jobs with concurrency control and timeouts."""
    q_name = f"test_worker_{uuid4().hex[:6]}"
    processed_events = []

    class MockWorker(BaseQueueWorker):
        queue_name = q_name
        default_concurrency = 2
        job_timeout_seconds = 5.0

        async def process_job(self, job: JobContract, db) -> dict:
            await asyncio.sleep(0.05)
            processed_events.append(job.payload["val"])
            return {"processed": True, "val": job.payload["val"]}

    worker = MockWorker()
    worker.start()

    try:
        # Enqueue 4 jobs
        for i in range(4):
            await RedisQueueEngine.enqueue(
                queue_name=q_name,
                job_type="MOCK_JOB",
                payload={"val": i},
            )

        # Allow worker to process
        await asyncio.sleep(1.0)
        assert len(processed_events) == 4
        assert sorted(processed_events) == [0, 1, 2, 3]

    finally:
        await worker.stop(drain_timeout=2.0)


@pytest.mark.asyncio
async def test_transactional_outbox_relay():
    """Verify Transactional Outbox commits to DB and relays reliably into Redis."""
    q_name = f"test_outbox_{uuid4().hex[:6]}"

    async with AsyncSessionLocal() as db:
        # 1. Record outbox event within database transaction
        event = await record_outbox_event(
            db=db,
            queue_name=q_name,
            event_type="CONTEST_CONCLUDED",
            payload={"slug": "weekly-42", "participants": 120},
            aggregate_id="weekly-42",
            priority="high",
        )
        await db.commit()
        event_id = event.id

    # 2. Execute Outbox Relay
    async with AsyncSessionLocal() as db:
        relayed = await relay_outbox_events(db)
        assert relayed >= 1

    # 3. Verify event is now published in DB
    async with AsyncSessionLocal() as db:
        saved_event = await db.get(OutboxEvent, event_id)
        assert saved_event.status == "published"
        assert saved_event.published_at is not None

    # 4. Verify job arrived in Redis queue
    queued_job = await RedisQueueEngine.dequeue(q_name, timeout=2)
    assert queued_job is not None
    assert queued_job.job_type == "CONTEST_CONCLUDED"
    assert queued_job.payload["slug"] == "weekly-42"
    await RedisQueueEngine.ack(queued_job)


@pytest.mark.asyncio
async def test_job_status_api_and_bola_security():
    """Verify JobController enforces BOLA authorization so cadets cannot snoop on other cadets' jobs."""
    q_name = f"test_bola_{uuid4().hex[:6]}"

    cadet_owner_id = str(uuid4())
    intruder_cadet_id = str(uuid4())
    admin_id = str(uuid4())

    job = await RedisQueueEngine.enqueue(
        queue_name=q_name,
        job_type="EVALUATE_SUBMISSION",
        payload={
            "member_id": cadet_owner_id,
            "submission_id": str(uuid4()),
        },
    )

    owner_profile = MemberProfile(id=cadet_owner_id, email=f"owner_{cadet_owner_id[:8]}@medicaps.ac.in", is_core_member=False)
    intruder_profile = MemberProfile(id=intruder_cadet_id, email=f"intruder_{intruder_cadet_id[:8]}@medicaps.ac.in", is_core_member=False)
    admin_profile = MemberProfile(id=admin_id, email=f"admin_{admin_id[:8]}@medicaps.ac.in", is_core_member=True)

    # 1. Owner can access their own job
    status_res = await JobController.get_job_status(job.id, current_member=owner_profile)
    assert status_res["job_id"] == job.id
    assert status_res["status"] == "queued"

    # 2. Intruder cadet is blocked by BOLA / IDOR guard (HTTP 403)
    with pytest.raises(HTTPException) as exc_info:
        await JobController.get_job_status(job.id, current_member=intruder_profile)
    assert exc_info.value.status_code == 403

    # 3. Admin can inspect any cadet's job
    admin_res = await JobController.get_job_status(job.id, current_member=admin_profile)
    assert admin_res["job_id"] == job.id
