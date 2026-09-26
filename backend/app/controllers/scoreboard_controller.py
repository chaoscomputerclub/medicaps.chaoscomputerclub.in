"""
Chaos Computer Club — Medi-Caps Chapter
controllers/scoreboard_controller.py — Backward-compatible facade for modules/leaderboard
"""

from app.modules.leaderboard.scoreboard_controller import ScoreboardController
from app.modules.leaderboard.scoreboard_service import ScoreboardService
from app.modules.leaderboard.leaderboard_repository import LeaderboardRepository

__all__ = [
    "ScoreboardController",
    "ScoreboardService",
    "LeaderboardRepository",
]
