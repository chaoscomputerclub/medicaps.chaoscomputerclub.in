"""
Medi-Caps Competitive Programming Platform — Locust Load Testing Masterfile
Coordinates 50+ concurrent virtual students executing authentic contest workflows.
Integrates custom telemetry hooks, performance threshold validation, and report export.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path
from locust import events
from locust.runners import MasterRunner, LocalRunner

from tests.load.config.settings import settings
from tests.load.config.scenarios import SCENARIOS, get_scenario
from tests.load.utilities.correlation import RUN_ID
from tests.load.utilities.credentials import user_pool
from tests.load.users.student import NormalStudentUser, RunCodeHeavyUser
from tests.load.users.contest_student import ActiveContestantUser
from tests.load.users.reconnecting_student import ReconnectingStudentUser

logger = logging.getLogger("ccc.loadtest.locustfile")

# Register user classes for Locust discovery
__all__ = [
    "NormalStudentUser",
    "ActiveContestantUser",
    "RunCodeHeavyUser",
    "ReconnectingStudentUser",
]

# Telemetry accumulators
METRICS_DATA = {
    "run_id": RUN_ID,
    "environment": settings.LOAD_TEST_ENVIRONMENT,
    "target_base_url": settings.LOAD_TEST_BASE_URL,
    "start_time": None,
    "end_time": None,
    "requests_total": 0,
    "requests_success": 0,
    "requests_failure": 0,
    "submissions_created": 0,
    "submissions_evaluated": 0,
    "run_code_total": 0,
    "custom_failures": {},
}


@events.init.add_listener
def on_locust_init(environment, **_kwargs):
    """Enforce production safety check prior to test start."""
    try:
        settings.enforce_production_safety()
    except Exception as exc:
        logger.error(str(exc))
        environment.runner.quit()
        sys.exit(1)


@events.test_start.add_listener
def on_test_start(environment, **_kwargs):
    """Initialize test run state and user pool."""
    METRICS_DATA["start_time"] = time.time()
    user_pool.initialize()

    banner = (
        "\n"
        "=======================================================================\n"
        "  CHAOS COMPUTER CLUB — MEDI-CAPS COMPETITIVE PROGRAMMING PLATFORM\n"
        "  SYNTHETIC USER LOAD TEST ENVIRONMENT (LOCUST)\n"
        "=======================================================================\n"
        f"  Run ID            : {RUN_ID}\n"
        f"  Target Environment: {settings.LOAD_TEST_ENVIRONMENT}\n"
        f"  Target URL        : {settings.LOAD_TEST_BASE_URL}\n"
        f"  Configured Users  : {settings.LOAD_TEST_USERS}\n"
        f"  Spawn Rate        : {settings.LOAD_TEST_SPAWN_RATE} users/sec\n"
        f"  Target Contest    : {settings.LOAD_TEST_CONTEST_SLUG}\n"
        f"  Personas & Weights:\n"
        f"    - Normal Student       : {NormalStudentUser.weight}%\n"
        f"    - Active Contestant    : {ActiveContestantUser.weight}%\n"
        f"    - Run-Code Heavy       : {RunCodeHeavyUser.weight}%\n"
        f"    - Reconnecting Student : {ReconnectingStudentUser.weight}%\n"
        "=======================================================================\n"
    )
    print(banner)


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **_kwargs):
    """Record tagged request and business event telemetry."""
    METRICS_DATA["requests_total"] += 1
    if exception:
        METRICS_DATA["requests_failure"] += 1
        exc_str = str(exception)
        category = exc_str.split("]")[0].replace("[", "") if "[" in exc_str else "UNCLASSIFIED"
        METRICS_DATA["custom_failures"][category] = METRICS_DATA["custom_failures"].get(category, 0) + 1
    else:
        METRICS_DATA["requests_success"] += 1

    if "/arena/submit" in name:
        METRICS_DATA["submissions_created"] += 1
    elif "/arena/run" in name:
        METRICS_DATA["run_code_total"] += 1


@events.test_stop.add_listener
def on_test_stop(environment, **_kwargs):
    """Summarize execution, validate performance gates, and export report."""
    METRICS_DATA["end_time"] = time.time()
    duration = METRICS_DATA["end_time"] - (METRICS_DATA["start_time"] or METRICS_DATA["end_time"])

    # Prepare report output directory
    report_root = Path(settings.REPORT_DIR)
    run_dir = report_root / f"run-{int(time.time())}"
    run_dir.mkdir(parents=True, exist_ok=True)

    total_reqs = METRICS_DATA["requests_total"]
    total_fails = METRICS_DATA["requests_failure"]
    error_rate = (total_fails / total_reqs) if total_reqs > 0 else 0.0

    summary = {
        "run_id": RUN_ID,
        "environment": settings.LOAD_TEST_ENVIRONMENT,
        "base_url": settings.LOAD_TEST_BASE_URL,
        "duration_seconds": round(duration, 2),
        "requests": {
            "total": total_reqs,
            "success": METRICS_DATA["requests_success"],
            "failures": total_fails,
            "error_rate_percentage": round(error_rate * 100, 2),
        },
        "business_events": {
            "submissions_created": METRICS_DATA["submissions_created"],
            "run_code_calls": METRICS_DATA["run_code_total"],
        },
        "failure_breakdown": METRICS_DATA["custom_failures"],
        "thresholds": {
            "max_error_rate_allowed": settings.THRESHOLD_MAX_ERROR_RATE,
            "error_rate_passed": error_rate <= settings.THRESHOLD_MAX_ERROR_RATE,
        }
    }

    summary_file = run_dir / "summary.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 70)
    print(f"  SYNTHETIC LOAD TEST COMPLETED — Report saved to {summary_file}")
    print(f"  Total Requests : {total_reqs}")
    print(f"  Successes      : {METRICS_DATA['requests_success']}")
    print(f"  Failures       : {total_fails} ({round(error_rate * 100, 2)}%)")
    print(f"  Submissions    : {METRICS_DATA['submissions_created']}")
    print(f"  Run Code Calls : {METRICS_DATA['run_code_total']}")
    if METRICS_DATA["custom_failures"]:
        print(f"  Failures Breakdown: {METRICS_DATA['custom_failures']}")
    print("=" * 70 + "\n")
