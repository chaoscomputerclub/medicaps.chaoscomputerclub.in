"""
Chaos Computer Club — Medi-Caps Chapter
controllers/events_controller.py — Real-Time Server-Sent Events (SSE) Stream Controller
"""

import asyncio
import logging
from typing import Optional
from fastapi import Request
from starlette.responses import StreamingResponse

from app.services.event_broadcaster import subscribe, unsubscribe

logger = logging.getLogger(__name__)

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


class EventsController:
    """Orchestrator for Server-Sent Events streams (global and contest-specific)."""

    @staticmethod
    async def get_global_event_stream(request: Request) -> StreamingResponse:
        queue = await subscribe("global")

        async def event_generator():
            try:
                yield ": connected\n\n"
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
                await unsubscribe("global", queue)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers=SSE_HEADERS,
        )

    @staticmethod
    async def get_contest_event_stream(slug: str, request: Request) -> StreamingResponse:
        channel = f"contest:{slug}"
        queue = await subscribe(channel)

        async def event_generator():
            try:
                yield f": connected to contest:{slug}\n\n"
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
