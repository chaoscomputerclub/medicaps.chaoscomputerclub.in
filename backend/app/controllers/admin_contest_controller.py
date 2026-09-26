"""
Chaos Computer Club — Medi-Caps Chapter
controllers/admin_contest_controller.py — Backward-compatible facade for modules/contests
"""

from app.modules.contests.admin_contest_controller import AdminContestController
from app.modules.contests.admin_contest_service import AdminContestService

__all__ = [
    "AdminContestController",
    "AdminContestService",
]
