"""
Chaos Computer Club — Medi-Caps Chapter
controllers/contest_controller.py — Backward-compatible facade for modules/contests
"""

from app.modules.contests.contest_controller import ContestController
from app.modules.contests.contest_execution_service import (
    ArenaRunRequest,
    ArenaSubmitRequest,
    ContestExecutionService,
)
from app.modules.contests.contest_service import ContestService
from app.modules.contests.contest_repository import ContestRepository

__all__ = [
    "ContestController",
    "ArenaRunRequest",
    "ArenaSubmitRequest",
    "ContestExecutionService",
    "ContestService",
    "ContestRepository",
]
