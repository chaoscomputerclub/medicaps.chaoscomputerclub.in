"""
Chaos Computer Club — Medi-Caps Chapter
routers/events.py

Server-Sent Events (SSE) Real-Time Push Stream Router
Provides continuous real-time push streaming to avoid server polling for:
- Gate QR pass check-ins
- Contest lifecycle status updates
- Arena countdown clock overrides
- Live scoreboard updates
- Assessment qualification cuts
"""

import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Request, Query
from starlette.responses import StreamingResponse

from app.services.event_broadcaster import subscribe, unsubscribe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["Real-Time Event Streams"])


@router.get("/stream")
async def get_global_event_stream(request: Request):
    """
    Real-time Server-Sent Events (SSE) stream for all global chapter events.
    Replaces client interval polling with instant push notifications.
    """
    queue = await subscribe("global")

    async def event_generator():
        try:
            # Send initial connected heartbeat
            yield ": connected\n\n"
            while True:
                # Disconnect check
                if await request.is_disconnected():
                    break

                try:
                    # Wait for next event or 15s heartbeat timeout
                    raw_msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {raw_msg}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await unsubscribe("global", queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/contest/{slug}/stream")
async def get_contest_event_stream(slug: str, request: Request):
    """
    Contest-specific SSE stream.
    Pushes gate check-ins, arena timer overrides, status transitions, and leaderboard scores.
    """
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
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
