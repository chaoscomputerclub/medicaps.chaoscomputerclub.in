"""
Chaos Computer Club — Medi-Caps Chapter
core/queue/outbox.py — Transactional Outbox Pattern for Guaranteed DB-Queue Consistency
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base, get_uuid, now_utc
from app.core.queue.contracts import JobPriority
from app.core.queue.redis_queue import RedisQueueEngine

logger = logging.getLogger("ccc.outbox")


class OutboxEvent(Base):
    """
    Transactional Outbox Table.
    Written within the same database transaction as business mutations to prevent
    ghost events or lost messages when publishing to Redis.
    """
    __tablename__ = "outbox_events"

    id = Column(String(36), primary_key=True, default=get_uuid)
    queue_name = Column(String(40), nullable=False, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    aggregate_id = Column(String(100), nullable=True, index=True)
    payload = Column(JSON, nullable=False)
    priority = Column(String(20), default="normal", nullable=False)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending, published, failed
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)


async def record_outbox_event(
    db: AsyncSession,
    queue_name: str,
    event_type: str,
    payload: Dict[str, Any],
    aggregate_id: Optional[str] = None,
    priority: str = "normal",
) -> OutboxEvent:
    """
    Create an OutboxEvent row inside the caller's active database transaction.
    Guarantees the event is saved if and only if the transaction commits.
    """
    event = OutboxEvent(
        id=str(uuid4()),
        queue_name=queue_name,
        event_type=event_type,
        aggregate_id=aggregate_id,
        payload=payload,
        priority=priority,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    return event


async def record_cache_sync_event(
    db: AsyncSession,
    sync_event: Any,
    priority: str = "high",
) -> OutboxEvent:
    """
    Record a CacheSyncEvent in the transactional outbox table.
    Guarantees that the cache sync job is enqueued if and only if the business transaction commits.
    """
    payload = sync_event.model_dump() if hasattr(sync_event, "model_dump") else dict(sync_event)
    return await record_outbox_event(
        db=db,
        queue_name="cache_sync",
        event_type=getattr(sync_event, "event_type", "cache_sync"),
        aggregate_id=getattr(sync_event, "resource_id", None),
        payload=payload,
        priority=priority,
    )


async def relay_outbox_events(db: AsyncSession, batch_size: int = 50) -> int:
    """
    Poll and dispatch pending outbox events into Redis with at-least-once delivery.
    """
    stmt = (
        select(OutboxEvent)
        .where(OutboxEvent.status == "pending")
        .order_by(OutboxEvent.created_at.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )
    result = await db.execute(stmt)
    events: List[OutboxEvent] = result.scalars().all()

    if not events:
        return 0

    relayed_count = 0
    now = datetime.now(timezone.utc)

    for event in events:
        try:
            if event.event_type == "EXECUTION_REQUEUE" or event.queue_name == "fabric":
                import json
                from app.core.redis import get_redis
                job_id = event.payload.get("job_id") if isinstance(event.payload, dict) else str(event.payload)
                if job_id:
                    redis = get_redis()
                    raw_job = await redis.get(f"ccc:job:{job_id}")
                    lang = None
                    if raw_job:
                        try:
                            jd = json.loads(raw_job)
                            jd["status"] = "QUEUED"
                            jd["attempt"] = event.payload.get("attempt_number", int(jd.get("attempt", 0)) + 1)
                            await redis.set(f"ccc:job:{job_id}", json.dumps(jd), ex=86400)
                            lang = jd.get("payload", {}).get("language")
                        except Exception:
                            pass
                    if lang:
                        await redis.lpush(f"ccc:queue:fabric:pending:{str(lang).lower()}", job_id)
                    await redis.lpush("ccc:queue:fabric:pending", job_id)
                    logger.info("🔁 [Outbox] Relayed EXECUTION_REQUEUE for job %s into Redis queue", job_id)
            elif event.queue_name in {"realtime", "events", "sse"}:
                from app.services.event_broadcaster import broadcast_event
                contest_slug = event.payload.get("contest_slug") if isinstance(event.payload, dict) else None
                await broadcast_event(
                    event_type=event.event_type,
                    data=event.payload if isinstance(event.payload, dict) else {"raw": event.payload},
                    contest_slug=contest_slug,
                )
            else:
                prio = JobPriority.HIGH if event.priority == "high" else JobPriority.NORMAL
                await RedisQueueEngine.enqueue(
                    queue_name=event.queue_name,
                    job_type=event.event_type,
                    payload=event.payload,
                    priority=prio,
                    idempotency_key=f"outbox:{event.id}",
                    correlation_id=f"outbox-{event.id[:8]}",
                )
            event.status = "published"
            event.published_at = now
            relayed_count += 1
        except Exception as exc:
            event.retry_count += 1
            event.error_message = str(exc)
            if event.retry_count >= 5:
                event.status = "failed"
            logger.warning("Failed to relay outbox event %s: %s", event.id, exc)

    await db.commit()
    if relayed_count > 0:
        logger.info("✓ Relayed %d outbox event(s) to Redis queue / pubsub.", relayed_count)

    return relayed_count
