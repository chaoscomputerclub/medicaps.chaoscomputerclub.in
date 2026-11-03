"""
Chaos Computer Club — Medi-Caps Chapter
app.services.llm.gemini_provider — Google Gemini 2.5 LLM Provider
"""

import json
import logging
import os
from typing import Type, TypeVar
import httpx
from pydantic import BaseModel
from .provider import LLMProvider

logger = logging.getLogger("ccc.llm.gemini")
T = TypeVar("T", bound=BaseModel)

GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model = model

    @property
    def provider_name(self) -> str:
        return f"gemini:{self.model}"

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.2,
        timeout_seconds: float = 30.0,
    ) -> T:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in environment.")

        schema = response_model.model_json_schema()
        url = f"{GEMINI_API_ENDPOINT}/{self.model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"System Instructions:\n{system_prompt}\n\nCandidate / Task Input:\n{user_prompt}"}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error("Gemini API error %d: %s", resp.status_code, resp.text)
                raise RuntimeError(f"Gemini API returned status {resp.status_code}: {resp.text}")

            res_json = resp.json()
            candidates = res_json.get("candidates", [])
            if not candidates:
                raise ValueError("No candidates returned from Gemini.")

            raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            parsed = json.loads(raw_text)
            return response_model.model_validate(parsed)

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.5,
        timeout_seconds: float = 30.0,
    ) -> str:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in environment.")

        url = f"{GEMINI_API_ENDPOINT}/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"System:\n{system_prompt}\n\nUser:\n{user_prompt}"}],
                }
            ],
            "generationConfig": {"temperature": temperature},
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API returned {resp.status_code}: {resp.text}")
            res_json = resp.json()
            return res_json["candidates"][0]["content"]["parts"][0]["text"]
