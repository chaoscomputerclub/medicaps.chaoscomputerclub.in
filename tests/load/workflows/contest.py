"""
Medi-Caps Competitive Programming Platform — Contest Exploration & Registration Workflow
Simulates student browsing available contests, inspecting rules, and registering.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional
from tests.load.clients.api_client import StudentApiClient
from tests.load.assertions.response_checks import assert_required_fields

logger = logging.getLogger("ccc.loadtest.contest")


def fetch_contests_list(client: StudentApiClient) -> List[Dict[str, Any]]:
    """Retrieve all active, upcoming, and past contests."""
    data = client.get(
        path="/api/contests",
        name="/api/contests",
        workflow="contest",
        expected_status=[200],
    )
    if isinstance(data, list):
        return data
    return []


def fetch_contest_details(client: StudentApiClient, slug: str) -> Dict[str, Any]:
    """Retrieve full contest specifications."""
    data = client.get(
        path=f"/api/contests/{slug}",
        name="/api/contests/{slug}",
        workflow="contest",
        expected_status=[200],
    )
    assert_required_fields(data, ["slug", "title", "status"], context="contest_details")
    return data


def ensure_contest_registration(client: StudentApiClient, slug: str) -> Dict[str, Any]:
    """Verify student registration; register if not already enrolled."""
    status_data = client.get(
        path=f"/api/contests/{slug}/registration-status",
        name="/api/contests/{slug}/registration-status",
        workflow="contest",
        expected_status=[200],
    )

    is_registered = status_data.get("is_registered", False) or status_data.get("registered", False)
    if not is_registered:
        reg_resp = client.post(
            path=f"/api/contests/{slug}/register",
            name="/api/contests/{slug}/register",
            workflow="contest",
            expected_status=[200, 400],  # 400 if already registered or full
        )
        return reg_resp
    return status_data


def check_in_contest(client: StudentApiClient, slug: str) -> Dict[str, Any]:
    """Simulate physical/virtual gate check-in."""
    return client.post(
        path=f"/api/contests/{slug}/check-in",
        name="/api/contests/{slug}/check-in",
        workflow="contest",
        expected_status=[200, 400],
    )
