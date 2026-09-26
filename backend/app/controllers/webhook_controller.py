"""
Chaos Computer Club — Medi-Caps Chapter
controllers/webhook_controller.py — Backward-compatible facade for modules/events
"""

from app.modules.events.webhook_controller import WebhookController
from app.modules.events.webhook_service import WebhookService

__all__ = [
    "WebhookController",
    "WebhookService",
]
