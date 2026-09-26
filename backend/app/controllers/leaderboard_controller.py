"""
Chaos Computer Club — Medi-Caps Chapter
controllers/leaderboard_controller.py — Backward-compatible facade for modules/leaderboard
"""

from app.modules.leaderboard.leaderboard_controller import LeaderboardController
from app.modules.leaderboard.leaderboard_service import LeaderboardService
from app.modules.leaderboard.leaderboard_repository import LeaderboardRepository

__all__ = [
    "LeaderboardController",
    "LeaderboardService",
    "LeaderboardRepository",
]
