"""
Chaos Computer Club — Medi-Caps Chapter
services/event_broadcaster.py

Real-Time Event Broadcaster & Webhook Dispatcher
Provides:
1. Low-latency Server-Sent Events (SSE) streaming for connected browser clients.
2. In-memory async event channels with zero client polling overhead.
3. Outbound webhook dispatching to external listeners / notification sinks.
4. Redis Pub/Sub mirroring when Redis is available.
"""

import asyncio
import json
import logging
from uuid import uuid4
import httpx
from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Active subscriber queues: channel_name -> Set[asyncio.Queue]
_subscribers: Dict[str, Set[asyncio.Queue]] = {}
_lock = asyncio.Lock()

# Redis lets independent ASGI workers deliver the same event to their own SSE
# subscribers. The origin marker prevents the publishing worker from faning out
# the event twice when it receives its own pub/sub message.
REDIS_EVENT_CHANNEL = "ccc:realtime:events"
_instance_id = uuid4().hex
_redis_relay_task: Optional[asyncio.Task] = None

# Outbound registered webhooks (configurable via env / settings)
_outbound_webhooks: Set[str] = set()


def register_outbound_webhook(url: str):
    """Register an external webhook endpoint URL."""
    _outbound_webhooks.add(url.strip())


async def subscribe(channel: str = "global") -> asyncio.Queue:
    """Subscribe a client connection to an event channel."""
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    async with _lock:
        if channel not in _subscribers:
            _subscribers[channel] = set()
        _subscribers[channel].add(q)
    return q


async def unsubscribe(channel: str, q: asyncio.Queue):
    """Unsubscribe a client connection."""
    async with _lock:
        if channel in _subscribers and q in _subscribers[channel]:
            _subscribers[channel].remove(q)
            if not _subscribers[channel]:
                del _subscribers[channel]


async def _fan_out(raw_message: str, contest_slug: Optional[str]) -> None:
    """Place an already serialized event in local SSE subscriber queues."""
    target_channels = ["global"]
    if contest_slug:
        target_channels.append(f"contest:{contest_slug}")

    async with _lock:
        for channel in target_channels:
            for queue in list(_subscribers.get(channel, set())):
                if not queue.full():
                    queue.put_nowait(raw_message)


async def broadcast_event(
    event_type: str,
    data: Dict[str, Any],
    contest_slug: Optional[str] = None,
):
    """
    Broadcast a real-time event to:
    1. Channel-specific subscribers (e.g. contest:{slug})
    2. Global subscribers (channel: global)
    3. External outbound webhooks (fire-and-forget)
    """
    payload = {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "contest_slug": contest_slug,
        "data": data,
    }
    raw_message = json.dumps(payload)

    # Always deliver locally first. Redis is an inter-worker enhancement, not a
    # prerequisite for an SSE event in a single-worker deployment.
    await _fan_out(raw_message, contest_slug)

    # Optional: mirror to Redis pub/sub for other ASGI workers.
    try:
        from app.core.redis import get_redis

        relay_payload = {**payload, "_origin": _instance_id}
        await get_redis().publish(REDIS_EVENT_CHANNEL, json.dumps(relay_payload))
    except Exception as exc:
        logger.debug("Redis event publish unavailable: %s", exc)

    # Outbound webhook delivery (non-blocking)
    if _outbound_webhooks:
        asyncio.create_task(_dispatch_outbound_webhooks(raw_message))


async def redis_event_relay() -> None:
    """Relay Redis pub/sub events into this worker's local SSE queues."""
    reconnect_delay = 5.0
    while True:
        pubsub = None
        try:
            from app.core.redis import get_redis

            pubsub = get_redis().pubsub()
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


async def _dispatch_outbound_webhooks(raw_json: str):
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
