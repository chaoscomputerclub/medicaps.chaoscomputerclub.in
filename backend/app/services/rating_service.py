"""
Chaos Computer Club India — Medi-Caps Chapter Backend
CodeChef & LeetCode Inspired Rating Service
"""

import math
from typing import Dict, List, Tuple


def get_rating_tier(rating: int, attendance_count: int = 1) -> str:
    """Return official competitive division tier."""
    if attendance_count <= 0:
        return "Unranked"
    if rating >= 2200:
        return "GrandMaster"
    elif rating >= 2000:
        return "Master"
    elif rating >= 1800:
        return "Expert"
    elif rating >= 1600:
        return "Candidate"
    elif rating >= 1400:
        return "Amateur"
    else:
        return "Novice"


def get_tier_label(tier: str) -> str:
    labels = {
        "grandmaster": "GrandMaster",
        "master": "Master",
        "expert": "Expert",
        "candidate": "Candidate",
        "amateur": "Amateur",
        "novice": "Novice",
        "unranked": "Unranked",
        # Legacy backwards-compatibility
        "5_star": "GrandMaster",
        "4_star": "Master",
        "3_star": "Expert",
        "2_star": "Candidate",
        "1_star": "Novice",
    }
    return labels.get((tier or "").lower(), tier or "Unranked")


def calculate_rating_deltas(standings: List[Dict[str, any]]) -> List[Tuple[str, int, int]]:
    """
    Given a list of standings sorted by rank, compute fair rating adjustments.
    Returns: list of (handle, delta, new_rating)
    """
    total_participants = len(standings)
    if total_participants == 0:
        return []

    results = []
    for entry in standings:
        rank = entry["rank"]
        current_rating = entry.get("rating", 1200)
        
        # Expected rank based on relative position
        expected_rank = total_participants / 2.0
        
        # Performance factor
        perf = (expected_rank - rank) / (total_participants / 2.0)
        
        # Scaled delta (between -45 and +110)
        if rank <= 3:
            delta = int(80 + (4 - rank) * 15)
        elif rank <= total_participants * 0.2:
            delta = int(30 + perf * 35)
        elif rank <= total_participants * 0.5:
            delta = int(10 + perf * 20)
        else:
            delta = max(-35, int(perf * 25))
            
        new_rating = max(800, current_rating + delta)
        results.append((entry["handle"], delta, new_rating))

    return results
