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
import httpx
from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Active subscriber queues: channel_name -> Set[asyncio.Queue]
_subscribers: Dict[str, Set[asyncio.Queue]] = {}
_lock = asyncio.Lock()

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

    target_channels = ["global"]
    if contest_slug:
        target_channels.append(f"contest:{contest_slug}")

    # Push to SSE queues
    async with _lock:
        for ch in target_channels:
            if ch in _subscribers:
                for q in list(_subscribers[ch]):
                    try:
                        if not q.full():
                            q.put_nowait(raw_message)
                    except Exception:
                        pass

    # Optional: mirror to Redis pub/sub
    try:
        from app.core.redis import get_redis_client
        redis = await get_redis_client()
        if redis:
            await redis.publish("ccc:realtime:events", raw_message)
    except Exception:
        pass

    # Outbound webhook delivery (non-blocking)
    if _outbound_webhooks:
        asyncio.create_task(_dispatch_outbound_webhooks(raw_message))


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
