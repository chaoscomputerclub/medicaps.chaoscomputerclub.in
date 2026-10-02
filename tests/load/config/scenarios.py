"""
Medi-Caps Competitive Programming Platform — Load Test Scenarios
Defines canonical concurrency scenarios for Smoke, Normal, Burst, Run Code, and Soak profiles.
"""

from __future__ import annotations

from typing import Dict, Any
from dataclasses import dataclass


@dataclass(frozen=True)
class LoadScenario:
    name: str
    description: str
    user_count: int
    spawn_rate: float
    duration: str
    weights: Dict[str, int]
    tags: list[str]


SCENARIOS: Dict[str, LoadScenario] = {
    "smoke": LoadScenario(
        name="smoke",
        description="Fast 5-user verification smoke test across all user workflows",
        user_count=5,
        spawn_rate=2.0,
        duration="2m",
        weights={
            "NormalStudentUser": 60,
            "ActiveContestantUser": 25,
            "RunCodeHeavyUser": 10,
            "ReconnectingStudentUser": 5,
        },
        tags=["smoke", "core"],
    ),
    "normal_50": LoadScenario(
        name="normal_50",
        description="Standard 50 concurrent virtual students in a live contest arena",
        user_count=50,
        spawn_rate=5.0,
        duration="10m",
        weights={
            "NormalStudentUser": 60,
            "ActiveContestantUser": 25,
            "RunCodeHeavyUser": 10,
            "ReconnectingStudentUser": 5,
        },
        tags=["normal", "standard"],
    ),
    "submission_burst": LoadScenario(
        name="submission_burst",
        description="50 users rapidly submitting code to stress ExecutionRouter and Judge queues",
        user_count=50,
        spawn_rate=10.0,
        duration="5m",
        weights={
            "NormalStudentUser": 20,
            "ActiveContestantUser": 70,
            "RunCodeHeavyUser": 10,
            "ReconnectingStudentUser": 0,
        },
        tags=["burst", "submit_heavy"],
    ),
    "run_code_load": LoadScenario(
        name="run_code_load",
        description="50 users heavily triggering Run Code to test Codebox admission and queue isolation",
        user_count=50,
        spawn_rate=5.0,
        duration="5m",
        weights={
            "NormalStudentUser": 20,
            "ActiveContestantUser": 10,
            "RunCodeHeavyUser": 70,
            "ReconnectingStudentUser": 0,
        },
        tags=["run_code", "admission_test"],
    ),
    "soak": LoadScenario(
        name="soak",
        description="20 sustained users over 30-60 minutes to detect connection, memory, and Redis leaks",
        user_count=20,
        spawn_rate=2.0,
        duration="30m",
        weights={
            "NormalStudentUser": 50,
            "ActiveContestantUser": 30,
            "RunCodeHeavyUser": 10,
            "ReconnectingStudentUser": 10,
        },
        tags=["soak", "endurance"],
    ),
}


def get_scenario(name: str) -> LoadScenario:
    scenario = SCENARIOS.get(name.lower().strip())
    if not scenario:
        raise ValueError(
            f"Unknown scenario '{name}'. Available: {list(SCENARIOS.keys())}"
        )
    return scenario
