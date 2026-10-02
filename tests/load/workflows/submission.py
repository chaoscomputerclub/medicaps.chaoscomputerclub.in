"""
Medi-Caps Competitive Programming Platform — Formal Submission Workflow
Simulates student solution submissions against the distributed judge fabric.
Handles bounded progressive polling, terminal verdict tracking, and idempotency tests.
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Any, List, Optional

from tests.load.clients.api_client import StudentApiClient
from tests.load.assertions.response_checks import (
    assert_required_fields,
    LoadTestAssertionError,
    FailureCategory,
)
from tests.load.config.settings import settings

logger = logging.getLogger("ccc.loadtest.submission")

TERMINAL_STATUSES = {
    "accepted",
    "wrong_answer",
    "time_limit_exceeded",
    "memory_limit_exceeded",
    "compilation_error",
    "runtime_error",
    "failed",
    "completed",
}


def submit_contest_solution(
    client: StudentApiClient,
    slug: str,
    problem_id: str,
    language: str,
    code: str,
    async_mode: bool = False,
    is_idempotency_retry: bool = False,
) -> Dict[str, Any]:
    """
    Submit code solution to live arena.
    POST /api/contests/{slug}/arena/submit
    """
    payload = {
        "problem_id": str(problem_id),
        "language": language,
        "code": code,
    }

    params = {"async": "true"} if async_mode else None
    headers = {"X-Idempotency-Retry": "true"} if is_idempotency_retry else None

    result = client.post(
        path=f"/api/contests/{slug}/arena/submit",
        name="/api/contests/{slug}/arena/submit",
        json_data=payload,
        params=params,
        custom_headers=headers,
        workflow="submission",
        expected_status=[200, 202, 422, 429],
    )

    return result


def poll_submission_status(
    client: StudentApiClient,
    slug: str,
    problem_id: str,
    max_timeout_seconds: float = 20.0,
) -> Optional[Dict[str, Any]]:
    """
    Bounded progressive polling for submission terminal verdict.
    Backoff sequence: 250ms -> 500ms -> 750ms -> 1s -> 1.5s -> 2s.
    """
    delays = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
    delay_idx = 0
    start_time = time.time()

    while (time.time() - start_time) < max_timeout_seconds:
        history = client.get(
            path=f"/api/contests/{slug}/problems/{problem_id}/submissions",
            name="/api/contests/{slug}/problems/{problem_id}/submissions",
            workflow="submission",
            expected_status=[200],
        )

        if isinstance(history, list) and history:
            latest = history[0]
            status = str(latest.get("status", "")).lower()
            if status in TERMINAL_STATUSES:
                return latest

        sleep_duration = delays[min(delay_idx, len(delays) - 1)]
        time.sleep(sleep_duration)
        delay_idx += 1

    logger.warning("Polling timeout exceeded for problem %s after %.1fs", problem_id, max_timeout_seconds)
    return None
