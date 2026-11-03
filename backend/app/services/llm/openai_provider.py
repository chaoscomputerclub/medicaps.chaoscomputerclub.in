"""
Chaos Computer Club — Medi-Caps Chapter
app.services.llm.openai_provider — OpenAI / OpenRouter / Ollama Provider
"""

import json
import logging
import os
from typing import Type, TypeVar
import httpx
from pydantic import BaseModel
from .provider import LLMProvider

logger = logging.getLogger("ccc.llm.openai")
T = TypeVar("T", bound=BaseModel)


class OpenAICompatibleProvider(LLMProvider):
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str = "gpt-4o-mini",
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY") or "mock-key"
        self.base_url = (base_url or os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        self.model = model

    @property
    def provider_name(self) -> str:
        return f"openai-compat:{self.model}"

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.2,
        timeout_seconds: float = 30.0,
    ) -> T:
        schema = response_model.model_json_schema()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": f"{system_prompt}\nReturn valid JSON adhering to: {json.dumps(schema)}"},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API error {resp.status_code}: {resp.text}")

            res_json = resp.json()
            raw_content = res_json["choices"][0]["message"]["content"]
            parsed = json.loads(raw_content)
            return response_model.model_validate(parsed)

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.5,
        timeout_seconds: float = 30.0,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API error {resp.status_code}: {resp.text}")
            res_json = resp.json()
            return res_json["choices"][0]["message"]["content"]
