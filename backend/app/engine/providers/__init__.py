"""
Judge providers.

  JUDGE_PROVIDER=docker   -> Core in-process Docker execution engine (default)
  JUDGE_PROVIDER=local    -> in-process host sandbox executors (no docker required)
  JUDGE_PROVIDER=judge0   -> external Judge0 service
"""

from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult
from .factory import get_judge_provider
from .docker_provider import DockerSandboxProvider

__all__ = [
    "JudgeProvider",
    "ProviderRunRequest",
    "ProviderRunResult",
    "DockerSandboxProvider",
    "get_judge_provider",
]
