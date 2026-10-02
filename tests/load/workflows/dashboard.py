"""
Medi-Caps Competitive Programming Platform — Student Dashboard Workflow
Simulates student landing, stats retrieval, and healthcheck telemetry.
"""

from __future__ import annotations

from typing import Dict, Any, List
from tests.load.clients.api_client import StudentApiClient


def load_student_dashboard(client: StudentApiClient) -> Dict[str, Any]:
    """Simulate initial student dashboard load."""
    profile = client.get(
        path="/api/auth/me",
        name="/api/auth/me",
        workflow="dashboard",
        expected_status=[200],
    )

    contests = client.get(
        path="/api/contests",
        name="/api/contests",
        workflow="dashboard",
        expected_status=[200],
    )

    health = client.get(
        path="/api/health",
        name="/api/health",
        workflow="dashboard",
        expected_status=[200],
    )

    return {
        "profile": profile,
        "contests": contests,
        "health": health,
    }
