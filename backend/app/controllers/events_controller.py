"""
Chaos Computer Club — Medi-Caps Chapter
controllers/events_controller.py — Backward-compatible facade for modules/events
"""

from app.modules.events.events_controller import EventsController
from app.modules.events.events_service import EventsService

__all__ = [
    "EventsController",
    "EventsService",
]
