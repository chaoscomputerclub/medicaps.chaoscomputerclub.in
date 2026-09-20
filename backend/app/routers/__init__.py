"""
Chaos Computer Club — Medi-Caps Chapter
app.routers — Thin HTTP API routing layer delegating to app.controllers.
"""

from app.routers import (
    admin,
    admin_contests,
    admin_qa,
    assessment,
    auth,
    contests,
    events,
    feed,
    leaderboard,
    passes,
    scoreboards,
    social,
    storage,
    verify,
    webhooks,
)

__all__ = [
    "admin",
    "admin_contests",
    "admin_qa",
    "assessment",
    "auth",
    "contests",
    "events",
    "feed",
    "leaderboard",
    "passes",
    "scoreboards",
    "social",
    "storage",
    "verify",
    "webhooks",
]
