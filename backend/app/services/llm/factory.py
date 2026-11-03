"""
Chaos Computer Club — Medi-Caps Chapter
app.services.llm.factory — Environment-Aware LLM Provider Factory
Implements CCC-AI-0201 & LLM_PROVIDER_POLICY:
- Explicit test / development / production policies.
- Strict fail-closed rule: No silent mock fallback in production.
- Production requires a validated Gemini or OpenAI API key unless emergency mock override is explicitly asserted.
"""

import os
import logging
from typing import Optional
from functools import lru_cache
from .provider import LLMProvider
from .mock_provider import DeterministicMockLLMProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAICompatibleProvider

logger = logging.getLogger("ccc.llm.factory")

_OVERRIDDEN_PROVIDER: Optional[LLMProvider] = None


def set_llm_provider(provider: Optional[LLMProvider] = None) -> None:
    """Explicitly set or clear an LLM provider (useful for testing)."""
    global _OVERRIDDEN_PROVIDER
    _OVERRIDDEN_PROVIDER = provider
    get_llm_provider.cache_clear()


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    """
    Returns configured LLM provider based on environment variables and active policy.
    In production, fails closed with RuntimeError if no real provider credentials are valid.
    """
    if _OVERRIDDEN_PROVIDER is not None:
        return _OVERRIDDEN_PROVIDER

    env = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).strip().lower()
    is_production = env in {"production", "prod"}
    allow_mock = os.getenv("LLM_ALLOW_MOCK", "false").strip().lower() in {"true", "1", "yes"}

    choice = os.getenv("LLM_PROVIDER", "").strip().lower()

    # 1. Gemini / Google Provider
    if choice in {"gemini", "google"} or os.getenv("GEMINI_API_KEY"):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
            logger.info("Initializing Gemini LLM Provider (model: %s, env: %s)", model, env)
            return GeminiProvider(api_key=api_key, model=model)

    # 2. OpenAI / Compatible Provider
    if choice in {"openai", "openrouter", "ollama"} or os.getenv("OPENAI_API_KEY"):
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY")
        if api_key:
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            logger.info("Initializing OpenAI-compatible LLM Provider (model: %s, env: %s)", model, env)
            return OpenAICompatibleProvider(api_key=api_key, model=model)

    # 3. Production Safety Check
    if is_production and not allow_mock:
        error_msg = (
            "CRITICAL SECURITY CONFIGURATION ERROR: Real LLM Provider (Gemini or OpenAI) is strictly required "
            "in production environment. Silent fallback to DeterministicMockLLMProvider is forbidden by CCC-AI-0201. "
            "Please configure GEMINI_API_KEY or OPENAI_API_KEY."
        )
        logger.critical(error_msg)
        raise RuntimeError(error_msg)

    # 4. Development or Test fallback
    logger.warning("Using DeterministicMockLLMProvider (test/development simulation mode, env=%s)", env)
    return DeterministicMockLLMProvider()
