"""
Chaos Computer Club — Medi-Caps Chapter
app.services.llm.provider — LLM Provider Interface Contract
"""

from abc import ABC, abstractmethod
from typing import Type, TypeVar, Optional, Dict, Any
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class LLMProvider(ABC):
    """Abstract interface for large language model providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the concrete provider (e.g., 'gemini', 'openai', 'mock')."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.2,
        timeout_seconds: float = 30.0,
    ) -> T:
        """
        Executes a prompt and guarantees a validated Pydantic model response.
        Raises ValueError or TimeoutError if generation or validation fails.
        """
        pass

    @abstractmethod
    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.5,
        timeout_seconds: float = 30.0,
    ) -> str:
        """Generates plain text response."""
        pass
