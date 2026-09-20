"""
Chaos Computer Club — Medi-Caps Chapter
routers/events.py — Thin HTTP Router for Server-Sent Events (SSE) Real-Time Push Streams
Delegates to app.controllers.events_controller.EventsController
"""

from fastapi import APIRouter, Request
from app.controllers.events_controller import EventsController

router = APIRouter(prefix="/events", tags=["Real-Time Event Streams"])


@router.get("/stream")
async def get_global_event_stream(request: Request):
    """
    Real-time Server-Sent Events (SSE) stream for all global chapter events.
    Replaces client interval polling with instant push notifications.
    """
    return await EventsController.get_global_event_stream(request)


@router.get("/contest/{slug}/stream")
async def get_contest_event_stream(slug: str, request: Request):
    """
    Contest-specific SSE stream.
    Pushes gate check-ins, arena timer overrides, status transitions, and leaderboard scores.
    """
    return await EventsController.get_contest_event_stream(slug, request)
