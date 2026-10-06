"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_scoreboard_canonical.py — Scoreboard & Ranking Invariants

Linked Bugs: REG-0004, REG-0019
Invariant: SCOREBOARD_CALCULATION_AND_RANKING_MUST_BE_DETERMINISTIC_AND_IDEMPOTENT
"""

import pytest
from typing import List, Dict, Any


def rank_participants(participants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ranks participants according to ICPC / LeetCode CP rules:
    1. Solved problems count (descending)
    2. Total penalty time in minutes (ascending)
    3. Timestamp of last accepted submission (ascending)
    4. Deterministic tie breaker: handle (ascending alphabetical)
    """
    sorted_list = sorted(
        participants,
        key=lambda p: (
            -p["solved_count"],
            p["total_penalty"],
            p["last_accepted_timestamp"],
            p["handle"].lower(),
        )
    )

    ranked = []
    current_rank = 1
    for idx, p in enumerate(sorted_list):
        item = dict(p)
        item["rank"] = idx + 1
        ranked.append(item)
    return ranked


@pytest.mark.regression("REG-0004")
def test_scoreboard_tie_breaking_is_strictly_deterministic():
    """
    REG-0004 Invariant:
    Participants with identical solved counts and penalty times must have
    deterministic rankings based on last accepted submission time, then handle.
    """
    contestants = [
        {"handle": "cadet_charlie", "solved_count": 3, "total_penalty": 120, "last_accepted_timestamp": 5000},
        {"handle": "cadet_alice", "solved_count": 3, "total_penalty": 120, "last_accepted_timestamp": 4500},
        {"handle": "cadet_bob", "solved_count": 4, "total_penalty": 200, "last_accepted_timestamp": 5500},
        {"handle": "cadet_david", "solved_count": 3, "total_penalty": 120, "last_accepted_timestamp": 4500},
    ]

    ranks = rank_participants(contestants)

    # Cadet Bob solved 4 problems -> Rank 1
    assert ranks[0]["handle"] == "cadet_bob"
    assert ranks[0]["rank"] == 1

    # Alice and David both solved 3 problems with 120 penalty and timestamp 4500
    # Alice comes before David alphabetically
    assert ranks[1]["handle"] == "cadet_alice"
    assert ranks[1]["rank"] == 2

    assert ranks[2]["handle"] == "cadet_david"
    assert ranks[2]["rank"] == 3

    # Charlie solved 3 with timestamp 5000 -> Rank 4
    assert ranks[3]["handle"] == "cadet_charlie"
    assert ranks[3]["rank"] == 4


@pytest.mark.regression("REG-0019")
def test_scoreboard_calculation_is_idempotent():
    """
    REG-0019 Invariant:
    Repeated invocations of the scoreboard ranking algorithm on the same input
    must produce identical ranks and never mutate source objects.
    """
    contestants = [
        {"handle": "user_1", "solved_count": 2, "total_penalty": 90, "last_accepted_timestamp": 3000},
        {"handle": "user_2", "solved_count": 1, "total_penalty": 30, "last_accepted_timestamp": 1000},
    ]

    run1 = rank_participants(contestants)
    run2 = rank_participants(contestants)

    assert run1 == run2
    assert [r["rank"] for r in run1] == [1, 2]
    assert [r["handle"] for r in run1] == ["user_1", "user_2"]
