"""Chooses the judge provider once per process, from the environment."""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from app.core.config import settings
from .base import JudgeProvider

logger = logging.getLogger("ccc.judge")


@lru_cache(maxsize=1)
def get_judge_provider() -> JudgeProvider:
    choice = os.getenv("JUDGE_PROVIDER", settings.JUDGE_PROVIDER).strip().lower()

    # 1. Check if distributed fabric or standard docker/codebox is chosen
    if choice in {"distributed", "fabric", "nodes", "docker", "codebox", "code_box", "codebox-engine", "core", "native", "interleet", "server"}:
        try:
            from .distributed_provider import DistributedFabricProvider
            fallback: JudgeProvider
            if choice in {"codebox", "code_box", "codebox-engine"}:
                try:
                    from .codebox_provider import CodeboxProvider
                    fallback = CodeboxProvider()
                except Exception:
                    from .docker_provider import DockerSandboxProvider
                    fallback = DockerSandboxProvider()
            else:
                from .docker_provider import DockerSandboxProvider
                fallback = DockerSandboxProvider()

            logger.info("judge provider: self-adapting distributed fabric (fallback: %s)", fallback.name)
            return DistributedFabricProvider(fallback_provider=fallback)
        except Exception as exc:
            logger.warning("distributed provider unavailable (%s); falling back to local", exc)

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
