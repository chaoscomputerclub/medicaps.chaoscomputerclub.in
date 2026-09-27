"""
Chaos Computer Club — Medi-Caps Chapter
services/event_broadcaster.py

Real-Time Event Broadcaster & Webhook Dispatcher (SSE Engine v2)
Provides:
1. Low-latency Server-Sent Events (SSE) streaming with standard W3C formatting (id:, event:, data:).
2. Monotonic Last-Event-ID replay buffer (circular Redis ZSET) for reconnect recovery.
3. Resync-Required backpressure signalling for slow clients.
4. Outbound webhook dispatching via ChaosQueue.
5. Multi-worker Redis Pub/Sub event relay with origin loopback suppression.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

import httpx

from app.core.cache.metrics import metrics
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Active subscriber queues: channel_name -> Set[asyncio.Queue]
_subscribers: Dict[str, Set[asyncio.Queue]] = {}
_lock = asyncio.Lock()

REDIS_EVENT_CHANNEL = "ccc:realtime:events"
REPLAY_BUFFER_KEY_PREFIX = "ccc:sse:replay"
_instance_id = uuid4().hex
_redis_relay_task: Optional[asyncio.Task] = None

_outbound_webhooks: Set[str] = set()


def register_outbound_webhook(url: str) -> None:
    """Register an external webhook endpoint URL."""
    _outbound_webhooks.add(url.strip())


async def subscribe(channel: str = "global") -> asyncio.Queue:
    """Subscribe a client connection to an event channel."""
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    async with _lock:
        if channel not in _subscribers:
            _subscribers[channel] = set()
        _subscribers[channel].add(q)
        total_active = sum(len(qs) for qs in _subscribers.values())
        metrics.set_active_connections(total_active)
    return q


async def unsubscribe(channel: str, q: asyncio.Queue) -> None:
    """Unsubscribe a client connection."""
    async with _lock:
        if channel in _subscribers and q in _subscribers[channel]:
            _subscribers[channel].remove(q)
            if not _subscribers[channel]:
                del _subscribers[channel]
        total_active = sum(len(qs) for qs in _subscribers.values())
        metrics.set_active_connections(total_active)


async def _fan_out(raw_message: str, contest_slug: Optional[str] = None) -> None:
    """
    Deliver message into local SSE subscriber queues with backpressure protection.
    If a slow client's queue is completely full, we do NOT silently drop.
    We remove the oldest message and inject a resync warning so the client knows it fell behind.
    """
    target_channels = ["global"]
    if contest_slug:
        target_channels.append(f"contest:{contest_slug}")

    async with _lock:
        for channel in target_channels:
            for queue in list(_subscribers.get(channel, set())):
                if queue.full():
                    metrics.inc_sse_buffer_overflow()
                    metrics.inc_sse_slow_client()
                    logger.warning("Subscriber queue full on '%s' (backpressure triggered)", channel)
                    try:
                        # Drop oldest to make room for resync notice
                        queue.get_nowait()
                        resync_notice = json.dumps({
                            "event": "resync_required",
                            "status": "resync_required",
                            "reason": "buffer_overflow",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
                        queue.put_nowait(resync_notice)
                    except Exception:
                        pass
                else:
                    queue.put_nowait(raw_message)


async def broadcast_event(
    event_type: str,
    data: Dict[str, Any],
    contest_slug: Optional[str] = None,
) -> None:
    """
    Backwards-compatible event broadcaster.
    Used for legacy endpoints and internal notifications.
    """
    payload = {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "contest_slug": contest_slug,
        "data": data,
    }
    raw_message = json.dumps(payload)

    await _fan_out(raw_message, contest_slug)

    try:
        redis = get_redis()
        relay_payload = {**payload, "_origin": _instance_id}
        await redis.publish(REDIS_EVENT_CHANNEL, json.dumps(relay_payload))
    except Exception as exc:
        logger.debug("Redis event publish unavailable: %s", exc)

    if _outbound_webhooks:
        try:
            from app.core.queue import RedisQueueEngine
            for url in list(_outbound_webhooks):
                await RedisQueueEngine.enqueue(
                    queue_name="webhooks",
                    job_type="DISPATCH_OUTBOUND_WEBHOOK",
                    payload={"url": url, "event_type": event_type, "data": data},
                    max_retries=5,
                    backoff_base_seconds=2.0,
                )
        except Exception as exc:
            logger.debug("Queue unavailable for outbound webhook, falling back: %s", exc)
            asyncio.create_task(_dispatch_outbound_webhooks(raw_message))


async def broadcast_sync_event(event: Any) -> None:
    """
    Publish a strongly typed CacheSyncEvent to real-time subscribers.
    Emits standard SSE format with monotonic version ID.
    """
    contest_slug = None
    if getattr(event, "resource_type", "") == "contest" or "contest:" in getattr(event, "resource_id", ""):
        parts = event.resource_id.split(":")
        contest_slug = parts[1] if len(parts) > 1 else None

    # Standard JSON envelope for browser and proxy consumers
    payload = {
        "id": getattr(event, "version", 1),
        "event": getattr(event, "event_type", "cache_sync"),
        "version": getattr(event, "version", 1),
        "resource_type": getattr(event, "resource_type", "unknown"),
        "resource_id": getattr(event, "resource_id", "global"),
        "occurred_at": getattr(event, "occurred_at", datetime.now(timezone.utc).isoformat()),
        "correlation_id": getattr(event, "correlation_id", ""),
        "contest_slug": contest_slug,
        "data": getattr(event, "payload", {}),
    }
    raw_message = json.dumps(payload)

    # 1. Fan-out locally to in-process subscribers
    await _fan_out(raw_message, contest_slug)

    # 2. Replay buffer storage in Redis (ZSET scored by version)
    channel = getattr(event, "sse_channel", "global") or "global"
    replay_key = f"{REPLAY_BUFFER_KEY_PREFIX}:{channel.strip(':')}"
    try:
        redis = get_redis()
        # Add to ZSET
        await redis.zadd(replay_key, {raw_message: event.version})
        # Keep bounded: trim to 100 items max
        card = await redis.zcard(replay_key)
        if card > 100:
            await redis.zremrangebyrank(replay_key, 0, card - 101)
        await redis.expire(replay_key, 86400)
    except Exception as exc:
        logger.debug("Replay buffer write error: %s", exc)

    # 3. Publish to Redis Pub/Sub for other ASGI workers
    try:
        redis = get_redis()
        relay_payload = {**payload, "_origin": _instance_id}
        await redis.publish(REDIS_EVENT_CHANNEL, json.dumps(relay_payload))
    except Exception as exc:
        logger.debug("Redis sync event publish unavailable: %s", exc)


async def get_replay_events(channel: str, last_event_id: int) -> Tuple[List[str], bool]:
    """
    Fetch missing events from the Redis circular replay buffer for reconnecting clients.
    Returns: (events_list, resync_required)
    """
    replay_key = f"{REPLAY_BUFFER_KEY_PREFIX}:{channel.strip(':')}"
    try:
        redis = get_redis()
        total_items = await redis.zcard(replay_key)
        if total_items == 0:
            return [], False

        # Get the lowest available version score in buffer
        min_items = await redis.zrange(replay_key, 0, 0, withscores=True)
        if min_items:
            min_score = int(min_items[0][1])
            if last_event_id < min_score - 1:
                # Client is too far behind — historical events were already pruned!
                metrics.inc_sse_resync()
                return [], True

        # Fetch events strictly greater than last_event_id
        missing_events = await redis.zrangebyscore(replay_key, f"({last_event_id}", "+inf")
        if missing_events:
            metrics.inc_sse_replay()
        return list(missing_events), False
    except Exception as exc:
        logger.warning("Error fetching replay events for '%s' from v%d: %s", channel, last_event_id, exc)
        return [], False


async def redis_event_relay() -> None:
    """Relay Redis pub/sub events into this worker's local SSE queues."""
    reconnect_delay = 5.0
    while True:
        pubsub = None
        try:
            redis = get_redis()
            pubsub = redis.pubsub()
            await pubsub.subscribe(REDIS_EVENT_CHANNEL)
            reconnect_delay = 5.0
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    incoming = json.loads(message["data"])
                    if incoming.pop("_origin", None) == _instance_id:
                        continue
                    event_type = incoming.get("event")
                    event_data = incoming.get("data")
                    if not isinstance(event_type, str) or not isinstance(event_data, dict):
                        continue
                    raw_message = json.dumps(incoming)
                    await _fan_out(raw_message, incoming.get("contest_slug"))
                except (TypeError, ValueError, KeyError) as exc:
                    logger.debug("Ignoring malformed Redis realtime event: %s", exc)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.debug("Redis realtime relay disconnected (retrying in %.1fs): %s", reconnect_delay, exc)
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 1.5, 30.0)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(REDIS_EVENT_CHANNEL)
                    await pubsub.aclose()
                except Exception:
                    pass


def start_redis_event_relay() -> asyncio.Task:
    """Start one Redis relay task for the current ASGI process."""
    global _redis_relay_task
    if _redis_relay_task is None or _redis_relay_task.done():
        _redis_relay_task = asyncio.create_task(
            redis_event_relay(), name="ccc-redis-realtime-relay"
        )
    return _redis_relay_task


async def _dispatch_outbound_webhooks(raw_json: str) -> None:
    """Deliver webhook payload to external endpoints asynchronously."""
    async with httpx.AsyncClient(timeout=4.0) as client:
        for url in list(_outbound_webhooks):
            try:
                await client.post(
                    url,
                    content=raw_json,
                    headers={"Content-Type": "application/json", "User-Agent": "CCC-MediCaps-Webhook/1.0"},
                )
            except Exception as e:
                logger.debug("Failed to deliver webhook to %s: %s", url, e)
