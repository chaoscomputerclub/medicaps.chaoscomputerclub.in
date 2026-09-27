"""
Chaos Computer Club India — Medi-Caps Chapter Backend
CodeChef & LeetCode Inspired Rating Service
"""

import math
from typing import Dict, List, Tuple


def get_rating_tier(rating: int) -> str:
    """Return CodeChef-style star bracket."""
    if rating >= 2000:
        return "5_star"
    elif rating >= 1800:
        return "4_star"
    elif rating >= 1600:
        return "3_star"
    elif rating >= 1400:
        return "2_star"
    else:
        return "1_star"


def get_tier_label(tier: str) -> str:
    labels = {
        "5_star": "5★ Grandmaster",
        "4_star": "4★ Master",
        "3_star": "3★ Specialist",
        "2_star": "2★ Candidate",
        "1_star": "1★ Explorer",
    }
    return labels.get(tier, "1★ Explorer")


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
