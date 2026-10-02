"""
Medi-Caps Competitive Programming Platform — Correlation & Telemetry
Generates end-to-end distributed trace headers and test run identifiers.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Dict

# Global run identifier for this Locust invocation
RUN_ID = f"loadtest-run-{int(time.time())}-{uuid.uuid4().hex[:6]}"


def get_run_id() -> str:
    """Return the unique run identifier for current test execution."""
    return RUN_ID


def generate_virtual_user_id(index: int) -> str:
    """Deterministic virtual user identifier."""
    return f"vu-{index:04d}-{uuid.uuid4().hex[:4]}"


def build_correlation_headers(
    user_id: str,
    workflow: str = "general",
    action: str = "request",
) -> Dict[str, str]:
    """
    Construct safe tracing headers to accompany Locust synthetic HTTP requests.
    Only sends standard and recognized X- headers without breaking auth.
    """
    correlation_id = f"corr-{uuid.uuid4().hex[:12]}"
    return {
        "X-Load-Test-ID": RUN_ID,
        "X-Virtual-User-ID": user_id,
        "X-Correlation-ID": correlation_id,
        "X-Request-Workflow": workflow,
        "X-Request-Action": action,
    }
