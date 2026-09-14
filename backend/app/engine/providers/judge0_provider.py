"""
Optional provider: an external Judge0-compatible service.

Enabled with JUDGE_PROVIDER=judge0. The key lives in this server's environment
only — it is never sent to, or read by, the web client.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Dict

import httpx

from .base import JudgeProvider, ProviderRunRequest, ProviderRunResult

logger = logging.getLogger("ccc.judge.judge0")

# Judge0 language ids for the languages this platform offers.
LANGUAGE_IDS: Dict[str, int] = {
    "python": 71,
    "python3": 71,
    "cpp": 54,
    "c++": 54,
    "java": 62,
    "javascript": 63,
    "typescript": 74,
}

_ACCEPTED = 3
_TERMINAL_MIN = 3  # Judge0 statuses < 3 are queued/processing


class Judge0Provider(JudgeProvider):
    name = "judge0"

    def __init__(self) -> None:
        self.base_url = os.getenv("JUDGE0_URL", "https://judge0-ce.p.rapidapi.com").rstrip("/")
        self.api_key = os.getenv("JUDGE0_KEY", "")
        self.api_host = os.getenv("JUDGE0_HOST", "")
        self.poll_interval = float(os.getenv("JUDGE0_POLL_SECONDS", "0.4"))
        self.max_polls = int(os.getenv("JUDGE0_MAX_POLLS", "40"))

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-RapidAPI-Key"] = self.api_key
            headers["X-Auth-Token"] = self.api_key
        if self.api_host:
            headers["X-RapidAPI-Host"] = self.api_host
        return headers

    async def healthy(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base_url}/about", headers=self._headers())
            return response.status_code < 400
        except Exception:
            return False

    async def run(self, request: ProviderRunRequest) -> ProviderRunResult:
        language_id = LANGUAGE_IDS.get(request.language.lower())
        if language_id is None:
            return ProviderRunResult(
                verdict="internal_error",
                diagnostics=[f"judge0 has no language id for {request.language!r}"],
            )

        payload = {
            "language_id": language_id,
            "source_code": request.source_code,
            "stdin": request.stdin,
            "expected_output": request.expected_output,
            "cpu_time_limit": request.time_limit_seconds,
            "memory_limit": request.memory_limit_mb * 1024,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                created = await client.post(
                    f"{self.base_url}/submissions?base64_encoded=false&wait=false",
                    json=payload,
                    headers=self._headers(),
                )
                created.raise_for_status()
                token = created.json().get("token")
                if not token:
                    raise RuntimeError("judge0 did not return a token")

                data: Dict = {}
                for _ in range(self.max_polls):
                    await asyncio.sleep(self.poll_interval)
                    polled = await client.get(
                        f"{self.base_url}/submissions/{token}?base64_encoded=false",
                        headers=self._headers(),
                    )
                    polled.raise_for_status()
                    data = polled.json()
                    status_id = int((data.get("status") or {}).get("id", 0))
                    if status_id >= _TERMINAL_MIN:
                        break
                else:
                    return ProviderRunResult(verdict="time_limit_exceeded", timed_out=True)
        except Exception as exc:
            logger.warning("judge0 run failed: %s", exc)
            return ProviderRunResult(verdict="internal_error", diagnostics=[str(exc)])

        status_id = int((data.get("status") or {}).get("id", 0))
        verdict = {
            3: "accepted",
            4: "wrong_answer",
            5: "time_limit_exceeded",
            6: "compilation_error",
        }.get(status_id, "runtime_error")

        return ProviderRunResult(
            stdout=data.get("stdout") or "",
            stderr=data.get("stderr") or "",
            compile_output=data.get("compile_output") or "",
            exit_code=int(data.get("exit_code") or 0),
            time_ms=int(float(data.get("time") or 0) * 1000),
            memory_kb=int(data.get("memory") or 0),
            timed_out=status_id == 5,
            passed=status_id == _ACCEPTED,
            verdict=verdict,
        )
