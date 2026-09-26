"""
Chaos Computer Club — Medi-Caps Chapter
modules/events/events_service.py — Real-Time Server-Sent Events (SSE) Streaming Service
"""

import asyncio
import logging
from typing import AsyncGenerator
from fastapi import Request
from starlette.responses import StreamingResponse

from app.services.event_broadcaster import subscribe, unsubscribe

logger = logging.getLogger(__name__)

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


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

        async def event_generator() -> AsyncGenerator[str, None]:
            try:
                yield f": {connect_message}\n\n"
                while True:
                    if await request.is_disconnected():
                        break
                    try:
                        raw_msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                        yield f"data: {raw_msg}\n\n"
                    except asyncio.TimeoutError:
                        yield ": ping\n\n"
            except asyncio.CancelledError:
                pass
            finally:
                await unsubscribe(channel, queue)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers=SSE_HEADERS,
        )
