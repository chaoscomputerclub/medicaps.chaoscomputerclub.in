"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/fixtures/regression_fixtures.py — Standard Deterministic Fixtures
"""

import pytest
from datetime import datetime, timezone, timedelta
from typing import Dict, Any


@pytest.fixture
def mock_contest_data() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "id": "contest-reg-fixture-01",
        "slug": "weekly-challenge-42",
        "title": "CCC Weekly Challenge #42",
        "season": "Season 2026",
        "status": "upcoming",
        "division": "open",
        "starts_at": now + timedelta(hours=2),
        "ends_at": now + timedelta(hours=4),
        "check_in_opens_at": now + timedelta(hours=1),
        "venue": "ONLINE",
        "seat_capacity": 50,
        "registered_count": 0,
        "problem_count": 3,
        "environment": "Air-gapped Linux Container",
        "chief_proctors": ["Chief Proctor"],
        "summary": "Weekly competitive programming contest.",
        "rules": ["Standard CP rules"],
        "cadence": "weekly",
        "edition": 42,
        "version": 1,
    }


@pytest.fixture
def mock_member_data() -> Dict[str, Any]:
    return {
        "id": "member-reg-fixture-01",
        "handle": "cadet_tester",
        "email": "cadet@medicaps.ac.in",
        "full_name": "Cadet Tester",
        "role": "student",
        "rating": 1500,
        "is_onboarded": True,
    }
