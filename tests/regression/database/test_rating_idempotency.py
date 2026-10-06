"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/database/test_rating_idempotency.py — Rating Finalization & Idempotency Invariants

Linked Bugs: REG-0004, REG-0018
Invariant: RATING_CALCULATION_MUST_BE_IDEMPOTENT_AND_ONLY_RATE_ACTIVE_PARTICIPANTS
"""

import pytest
from typing import Dict, List, Set, Any


class RatingEngine:
    def __init__(self):
        self.member_ratings: Dict[str, int] = {}
        self.finalized_contests: Set[str] = set()
        self.rating_history: Dict[str, Dict[str, int]] = {}  # (contest_id, member_id) -> delta

    def finalize_contest_ratings(
        self,
        contest_id: str,
        registered_members: List[str],
        active_submitters: Set[str],
    ) -> Dict[str, int]:
        # Invariant 1: Idempotency guard — do not re-apply ratings for already finalized contest
        if contest_id in self.finalized_contests:
            return {m: self.member_ratings.get(m, 1500) for m in active_submitters}

        # Invariant 2: Only active code submitters get rated (not idle registrants)
        for member_id in active_submitters:
            if member_id not in registered_members:
                continue  # Must be registered
            current = self.member_ratings.get(member_id, 1500)
            delta = +25  # Simulated Elo/Glicko delta
            self.member_ratings[member_id] = current + delta
            self.rating_history[f"{contest_id}:{member_id}"] = delta

        self.finalized_contests.add(contest_id)
        return dict(self.member_ratings)


@pytest.mark.regression("REG-0004")
def test_rating_finalization_is_strictly_idempotent():
    """
    REG-0004 Invariant:
    Executing rating finalization twice for the same contest must never double-apply
    rating changes.
    """
    engine = RatingEngine()
    engine.member_ratings["cadet_active"] = 1500

    registered = ["cadet_active", "cadet_idle"]
    active = {"cadet_active"}

    # First finalization
    ratings_run1 = engine.finalize_contest_ratings("contest-season-1", registered, active)
    assert ratings_run1["cadet_active"] == 1525

    # Second finalization (simulated duplicate Celery/Worker job or retry)
    ratings_run2 = engine.finalize_contest_ratings("contest-season-1", registered, active)
    
    # Invariant: Rating must NOT become 1550!
    assert ratings_run2["cadet_active"] == 1525
    assert engine.member_ratings["cadet_active"] == 1525


@pytest.mark.regression("REG-0018")
def test_idle_registered_cadets_do_not_suffer_rating_adjustments():
    """
    REG-0018 Invariant:
    A student who registered for a contest but did not submit any code during the window
    must not have their rating mutated or penalized.
    """
    engine = RatingEngine()
    engine.member_ratings["cadet_idle"] = 1600

    registered = ["cadet_idle"]
    active = set()  # No submissions

    engine.finalize_contest_ratings("contest-season-2", registered, active)

    # Invariant: Rating remains exactly 1600
    assert engine.member_ratings["cadet_idle"] == 1600
    assert "contest-season-2:cadet_idle" not in engine.rating_history
