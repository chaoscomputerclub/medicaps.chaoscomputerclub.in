"""
Medi-Caps Competitive Programming Platform — Run Code Execution Workflow
Simulates students executing code against sample test cases in the live arena.
Exercises Codebox admission control and isolation from formal contest queues.
"""

from __future__ import annotations

import logging
import random
from typing import Dict, Any, Optional

from tests.load.clients.api_client import StudentApiClient
from tests.load.assertions.response_checks import assert_required_fields

logger = logging.getLogger("ccc.loadtest.run_code")


def execute_sample_run(
    client: StudentApiClient,
    slug: str,
    problem_id: str,
    language: str,
    code: str,
    custom_stdin: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute sample code against sandbox evaluator via POST /api/contests/{slug}/arena/run.
    """
    payload = {
        "problem_id": str(problem_id),
        "language": language,
        "code": code,
        "custom_stdin": custom_stdin,
    }

    result = client.post(
        path=f"/api/contests/{slug}/arena/run",
        name="/api/contests/{slug}/arena/run",
        json_data=payload,
        workflow="run_code",
        expected_status=[200, 429, 503],
    )

    return result
