"""
Medi-Caps Competitive Programming Platform — Leaderboard & Scoreboard Workflow
Simulates student inspecting live problem-matrix scoreboards and university ladders.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, List
from tests.load.clients.api_client import StudentApiClient

logger = logging.getLogger("ccc.loadtest.leaderboard")


def fetch_contest_scoreboard(client: StudentApiClient, slug: str) -> List[Dict[str, Any]]:
    """Retrieve official contest problem-matrix scoreboard."""
    data = client.get(
        path=f"/api/scoreboards/{slug}",
        name="/api/scoreboards/{slug}",
        workflow="leaderboard",
        expected_status=[200],
    )
    if isinstance(data, list):
        return data
    return []


def fetch_university_leaderboard(client: StudentApiClient) -> List[Dict[str, Any]]:
    """Retrieve full university rating ladder."""
    data = client.get(
        path="/api/leaderboard",
        name="/api/leaderboard",
        workflow="leaderboard",
        expected_status=[200],
    )
    if isinstance(data, list):
        return data
    return []


def fetch_assessment_leaderboard(client: StudentApiClient, slug: str) -> Dict[str, Any]:
    """Retrieve live screening assessment leaderboard."""
    return client.get(
        path=f"/api/assessment/{slug}/leaderboard",
        name="/api/assessment/{slug}/leaderboard",
        workflow="leaderboard",
        expected_status=[200],
    )
