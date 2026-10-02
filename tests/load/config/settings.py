"""
Medi-Caps Competitive Programming Platform — Locust Load Testing Settings
Strict configuration parser with non-negotiable production safety guards.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LoadTestSettings(BaseSettings):
    """Configuration and safety policy for synthetic virtual user testing."""

    # 1. Environment & Target Guard
    LOAD_TEST_ENVIRONMENT: str = Field(default="local")
    LOAD_TEST_BASE_URL: str = Field(default="http://localhost:8000")
    ALLOW_PRODUCTION_LOAD_TEST: bool = Field(default=False)

    # 2. Concurrency & Timing
    LOAD_TEST_USERS: int = Field(default=50)
    LOAD_TEST_SPAWN_RATE: float = Field(default=5.0)
    LOAD_TEST_DURATION: str = Field(default="10m")

    # 3. Contest & Language Targeting
    LOAD_TEST_CONTEST_SLUG: str = Field(default="weekly-contest-01")
    LOAD_TEST_DEFAULT_LANGUAGE: str = Field(default="python")

    # 4. Identity & Namespace
    LOAD_TEST_USERNAME_PREFIX: str = Field(default="loadtest_student")
    LOAD_TEST_USER_DOMAIN: str = Field(default="medicaps.ac.in")

    # 5. Network & Latency Timeouts (seconds)
    LOAD_TEST_TIMEOUT_SECONDS: float = Field(default=30.0)
    LOAD_TEST_SUBMISSION_POLL_TIMEOUT: float = Field(default=20.0)

    # 6. Persona Weights (Normalized in Locustfile)
    NORMAL_STUDENT_WEIGHT: int = Field(default=60)
    ACTIVE_CONTESTANT_WEIGHT: int = Field(default=25)
    RUN_CODE_HEAVY_WEIGHT: int = Field(default=10)
    RECONNECTING_STUDENT_WEIGHT: int = Field(default=5)

    # 7. Advanced Chaos & Correctness Gates
    IDEMPOTENCY_TEST_RATE: float = Field(default=0.02)  # 2% of submissions test duplicate retry
    RECONNECT_DELAY_SECONDS: float = Field(default=5.0)

    # 8. Performance Pass/Fail Thresholds
    THRESHOLD_MAX_ERROR_RATE: float = Field(default=0.02)          # < 2%
    THRESHOLD_P95_READ_LATENCY_MS: float = Field(default=1000.0)   # < 1000ms
    THRESHOLD_P95_SUBMIT_LATENCY_MS: float = Field(default=1500.0) # < 1500ms
    THRESHOLD_MAX_SUBMIT_TIMEOUT_MS: float = Field(default=30000.0)# < 30s

    # 9. Local Resource Connection (for seeding & verification scripts)
    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/arena_dev")
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    REPORT_DIR: str = Field(default="tests/load/reports")

    model_config = SettingsConfigDict(
        env_file=os.getenv("LOAD_TEST_ENV_FILE", "tests/load/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def enforce_production_safety(self) -> None:
        """
        Hard safety invariant:
        Prevents synthetic load tests from executing against production domains
        or environments unless explicitly and unambiguously approved.
        """
        env = self.LOAD_TEST_ENVIRONMENT.strip().lower()
        base_url = self.LOAD_TEST_BASE_URL.strip().lower()

        is_prod_env = env in ("prod", "production")
        is_prod_domain = "medicaps.chaoscomputerclub.in" in base_url

        if (is_prod_env or is_prod_domain) and not self.ALLOW_PRODUCTION_LOAD_TEST:
            err_msg = (
                "\n"
                "🛑 CRITICAL SAFETY ABORT: PRODUCTION LOAD TESTING IS BLOCKED!\n"
                f"Attempted Target URL: {self.LOAD_TEST_BASE_URL}\n"
                f"Target Environment : {self.LOAD_TEST_ENVIRONMENT}\n\n"
                "To execute synthetic user load against production, you MUST explicitly set:\n"
                "  ALLOW_PRODUCTION_LOAD_TEST=true\n"
                "  LOAD_TEST_ENVIRONMENT=production\n"
                "Aborting immediately to protect live student assessment state.\n"
            )
            print(err_msg, file=sys.stderr)
            raise RuntimeError(err_msg)


settings = LoadTestSettings()
settings.enforce_production_safety()
