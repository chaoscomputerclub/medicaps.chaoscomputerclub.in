"""
Medi-Caps Competitive Programming Platform — Problem & Arena Discovery Workflow
Simulates student entering the live contest workspace and opening challenge problems.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, List
from tests.load.clients.api_client import StudentApiClient
from tests.load.assertions.response_checks import assert_required_fields

logger = logging.getLogger("ccc.loadtest.problem")


def fetch_contest_problems(client: StudentApiClient, slug: str) -> List[Dict[str, Any]]:
    """Retrieve problem previews for the contest."""
    data = client.get(
        path=f"/api/contests/{slug}/problems",
        name="/api/contests/{slug}/problems",
        workflow="problem",
        expected_status=[200],
    )
    if isinstance(data, list):
        return data
    return []


def fetch_arena_workspace(client: StudentApiClient, slug: str) -> Dict[str, Any]:
    """Retrieve full arena workspace data, problem statements, and testcase descriptions."""
    arena_data = client.get(
        path=f"/api/contests/{slug}/arena",
        name="/api/contests/{slug}/arena",
        workflow="problem",
        expected_status=[200],
    )
    assert_required_fields(arena_data, ["contest_title", "problems"], context="arena_workspace")
    return arena_data
