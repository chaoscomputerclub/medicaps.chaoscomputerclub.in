"""
Medi-Caps Competitive Programming Platform — Response Validation & Failure Classifier
Enforces strict business correctness without hiding underlying server or distributed failures.
"""

from __future__ import annotations

import json
from enum import Enum
from typing import Any, Dict, List, Optional
import requests


class FailureCategory(str, Enum):
    USER_DATA_FAILURE = "USER_DATA_FAILURE"
    AUTH_FAILURE = "AUTH_FAILURE"
    API_FAILURE = "API_FAILURE"
    VALIDATION_FAILURE = "VALIDATION_FAILURE"
    BUSINESS_LOGIC_FAILURE = "BUSINESS_LOGIC_FAILURE"
    EXECUTION_FAILURE = "EXECUTION_FAILURE"
    QUEUE_FAILURE = "QUEUE_FAILURE"
    NODE_FAILURE = "NODE_FAILURE"
    REDIS_FAILURE = "REDIS_FAILURE"
    DATABASE_FAILURE = "DATABASE_FAILURE"
    SSE_FAILURE = "SSE_FAILURE"
    TIMEOUT = "TIMEOUT"
    CAPACITY_EXHAUSTED = "CAPACITY_EXHAUSTED"


class LoadTestAssertionError(AssertionError):
    """Custom assertion error with structured classification and failure tagging."""

    def __init__(self, message: str, category: FailureCategory, status_code: Optional[int] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(f"[{category.value}] (HTTP {status_code}) {message}")
        self.category = category
        self.status_code = status_code
        self.details = details or {}


def classify_http_failure(response: requests.Response) -> FailureCategory:
    """Accurately classify an HTTP failure response into a canonical root-cause bucket."""
    code = response.status_code
    text = response.text.lower()

    if code == 401 or code == 403:
        return FailureCategory.AUTH_FAILURE
    elif code == 422 or code == 400:
        if "contest time has expired" in text or "submissions are closed" in text:
            return FailureCategory.BUSINESS_LOGIC_FAILURE
        return FailureCategory.VALIDATION_FAILURE
    elif code == 429 or "rate limit" in text or "capacity exhausted" in text or "queue full" in text:
        return FailureCategory.CAPACITY_EXHAUSTED
    elif code == 503 or code == 504:
        if "circuit breaker" in text or "codebox" in text:
            return FailureCategory.EXECUTION_FAILURE
        return FailureCategory.TIMEOUT
    elif code == 500:
        if "asyncpg" in text or "database" in text or "postgres" in text:
            return FailureCategory.DATABASE_FAILURE
        elif "redis" in text:
            return FailureCategory.REDIS_FAILURE
        elif "queue" in text or "fabric" in text:
            return FailureCategory.QUEUE_FAILURE
        return FailureCategory.API_FAILURE
    return FailureCategory.API_FAILURE


def assert_status_code(response: requests.Response, expected_codes: List[int], context: str = "request") -> None:
    """Validate that the response code matches expected set."""
    if response.status_code not in expected_codes:
        category = classify_http_failure(response)
        raise LoadTestAssertionError(
            message=f"{context} failed: expected {expected_codes}, got {response.status_code}. Response: {response.text[:300]}",
            category=category,
            status_code=response.status_code,
        )


def parse_json_response(response: requests.Response, context: str = "JSON parse") -> Any:
    """Strict JSON response validation."""
    try:
        return response.json()
    except (json.JSONDecodeError, ValueError) as exc:
        raise LoadTestAssertionError(
            message=f"Malformed non-JSON response on {context}: {exc}. Body: {response.text[:200]}",
            category=FailureCategory.VALIDATION_FAILURE,
            status_code=response.status_code,
        )


def assert_required_fields(data: Dict[str, Any], required_fields: List[str], context: str = "payload") -> None:
    """Ensure essential domain properties are returned."""
    missing = [f for f in required_fields if f not in data]
    if missing:
        raise LoadTestAssertionError(
            message=f"Missing required fields {missing} on {context}. Received keys: {list(data.keys())}",
            category=FailureCategory.VALIDATION_FAILURE,
            details={"missing": missing, "keys": list(data.keys())},
        )
