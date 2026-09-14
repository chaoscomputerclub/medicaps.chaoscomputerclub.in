"""Chooses the judge provider once per process, from the environment."""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from .base import JudgeProvider

logger = logging.getLogger("ccc.judge")


@lru_cache(maxsize=1)
def get_judge_provider() -> JudgeProvider:
    choice = os.getenv("JUDGE_PROVIDER", "interleet").strip().lower()

    if choice in {"interleet", "docker", "server", "interleet-docker"}:
        try:
            from .interleet_provider import InterleetProvider

            logger.info("judge provider: interleet docker containers")
            return InterleetProvider()
        except Exception as exc:
            logger.warning("interleet provider unavailable (%s); falling back to local", exc)

    if choice in {"judge0", "external", "remote"}:
        try:
            from .judge0_provider import Judge0Provider

            logger.info("judge provider: judge0")
            return Judge0Provider()
        except Exception as exc:  # httpx missing, misconfiguration, etc.
            logger.warning("judge0 provider unavailable (%s); falling back to local", exc)

    from .local_provider import LocalSandboxProvider

    logger.info("judge provider: local sandbox")
    return LocalSandboxProvider()
