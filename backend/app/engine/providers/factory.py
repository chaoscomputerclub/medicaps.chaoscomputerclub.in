"""Chooses the judge provider once per process, from the environment."""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from .base import JudgeProvider

logger = logging.getLogger("ccc.judge")


@lru_cache(maxsize=1)
def get_judge_provider() -> JudgeProvider:
    choice = os.getenv("JUDGE_PROVIDER", "codebox").strip().lower()

    if choice in {"codebox", "code_box", "codebox-engine"}:
        try:
            from .codebox_provider import CodeboxProvider

            logger.info("judge provider: codebox execution engine")
            return CodeboxProvider()
        except Exception as exc:
            logger.warning("codebox provider unavailable (%s); falling back to local", exc)

    if choice in {"docker", "core", "native", "interleet", "server", "interleet-docker"}:
        try:
            from .docker_provider import DockerSandboxProvider

            logger.info("judge provider: core in-process docker execution engine")
            return DockerSandboxProvider()
        except Exception as exc:
            logger.warning("docker provider unavailable (%s); falling back to local", exc)

    if choice in {"judge0", "external", "remote"}:
        try:
            from .judge0_provider import Judge0Provider

            logger.info("judge provider: judge0")
            return Judge0Provider()
        except Exception as exc:
            logger.warning("judge0 provider unavailable (%s); falling back to local", exc)

    from .local_provider import LocalSandboxProvider

    logger.info("judge provider: local sandbox")
    return LocalSandboxProvider()
