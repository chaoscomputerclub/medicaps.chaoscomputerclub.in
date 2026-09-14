"""
Judge providers.

The platform must be able to change *where* code runs without touching the
contest logic. Everything scoring-related depends on `JudgeProvider`, never on a
concrete executor.

  JUDGE_PROVIDER=local    -> in-process sandbox executors (default, no key)
  JUDGE_PROVIDER=judge0   -> external Judge0 service (JUDGE0_URL / JUDGE0_KEY)
"""

from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult
from .factory import get_judge_provider

__all__ = [
    "JudgeProvider",
    "ProviderRunRequest",
    "ProviderRunResult",
    "get_judge_provider",
]
