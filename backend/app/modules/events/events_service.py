"""
Chaos Computer Club — Medi-Caps Chapter
modules/events/events_service.py — Real-Time Server-Sent Events (SSE) Streaming Service v2
Implements:
1. Standard W3C SSE wire format (id, event, data)
2. Last-Event-ID header reconnect replay
3. Resync-Required snapshot recovery signalling
4. Proxy-safe periodic heartbeats
5. Clean resource cleanup on disconnect
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator
from fastapi import Request
from starlette.responses import StreamingResponse

from app.core.cache.metrics import metrics
from app.services.event_broadcaster import get_replay_events, subscribe, unsubscribe

logger = logging.getLogger(__name__)

SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def format_sse_chunk(raw_payload: str) -> str:
    """Format raw JSON message into standard SSE wire specification."""
    try:
        parsed = json.loads(raw_payload)
        event_id = parsed.get("id") or parsed.get("version")
        event_name = parsed.get("event") or "message"
        lines = []
        if event_id is not None:
            lines.append(f"id: {event_id}")
        if event_name:
            lines.append(f"event: {event_name}")
        lines.append(f"data: {raw_payload}")
        return "\n".join(lines) + "\n\n"
    except Exception:
        return f"data: {raw_payload}\n\n"


class EventsService:
    """Provides resilient Server-Sent Event streaming generators for real-time pub/sub channels."""

    @classmethod
    async def create_event_stream(
        cls,
        channel: str,
        request: Request,
        connect_message: str = "connected",
    ) -> StreamingResponse:
        queue = await subscribe(channel)

        # Check for Last-Event-ID header or query parameter for reconnect recovery
        raw_last_id = request.headers.get("last-event-id") or request.query_params.get("last_event_id")
        last_event_id: int | None = None
        if raw_last_id:
            try:
                last_event_id = int(raw_last_id.strip())
                metrics.inc_sse_reconnect()
            except ValueError:
                last_event_id = None

        async def event_generator() -> AsyncGenerator[str, None]:
            try:
                # 1. Connection acknowledgement comment
                yield f": {connect_message}\n\n"

                # 2. Replay Buffer Recovery on Reconnect
                if last_event_id is not None and last_event_id > 0:
                    replays, resync_required = await get_replay_events(channel, last_event_id)
                    if resync_required:
                        logger.info("SSE reconnect from v%d: replay buffer expired, signaling resync", last_event_id)
                        yield "event: resync_required\ndata: {\"status\": \"resync_required\", \"reason\": \"replay_window_expired\"}\n\n"
                    elif replays:
                        logger.info("SSE reconnect from v%d: replaying %d missed event(s)", last_event_id, len(replays))
                        for item in replays:
                            yield format_sse_chunk(item)

                # 3. Live Event Stream Loop
                while True:
                    if await request.is_disconnected():
                        break
                    try:
                        raw_msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                        yield format_sse_chunk(raw_msg)
                    except asyncio.TimeoutError:
                        # Lightweight heartbeat keeping proxies and load-balancers alive
                        yield ": heartbeat\n\n"
            except asyncio.CancelledError:
                pass
            finally:
                await unsubscribe(channel, queue)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers=SSE_HEADERS,
        )
