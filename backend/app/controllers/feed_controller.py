"""
Chaos Computer Club — Medi-Caps Chapter
controllers/feed_controller.py — Backward-compatible facade for modules/feed
"""

from app.modules.feed.feed_controller import FeedController
from app.modules.feed.feed_service import FeedService
from app.modules.feed.feed_repository import FeedRepository

__all__ = [
    "FeedController",
    "FeedService",
    "FeedRepository",
]
