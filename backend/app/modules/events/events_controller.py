"""
Chaos Computer Club — Medi-Caps Chapter
modules/events/events_controller.py — Thin HTTP Controller for Server-Sent Events (SSE)
"""

from fastapi import Request
from starlette.responses import StreamingResponse

from app.modules.events.events_service import EventsService


class EventsController:
    """Thin HTTP Controller for Server-Sent Events streams (global and contest-specific)."""

    @staticmethod
    async def get_global_event_stream(request: Request) -> StreamingResponse:
        return await EventsService.create_event_stream(
            channel="global",
            request=request,
            connect_message="connected",
        )

    @staticmethod
    async def get_contest_event_stream(slug: str, request: Request) -> StreamingResponse:
        return await EventsService.create_event_stream(
            channel=f"contest:{slug}",
            request=request,
            connect_message=f"connected to contest:{slug}",
        )
