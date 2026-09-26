"""
Chaos Computer Club — Medi-Caps Chapter
core/queue/contracts.py — Typed Job Contracts, Enums & Error Classifications
"""

from __future__ import annotations

import enum
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4


class JobState(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    RETRYING = "retrying"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


class JobPriority(str, enum.Enum):
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class RetryableError(Exception):
    """Signals that an error is transient and should trigger an exponential backoff retry."""
    pass


class NonRetryableError(Exception):
    """Signals that an error is permanent and should immediately route to DLQ / fail."""
    pass


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class JobContract:
    id: str = field(default_factory=lambda: str(uuid4()))
    queue_name: str = "default"
    job_type: str = "UNKNOWN"
    version: int = 1
    payload: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=now_utc_iso)
    updated_at: str = field(default_factory=now_utc_iso)
    scheduled_for: Optional[float] = None  # Unix timestamp for delayed execution
    attempt: int = 1
    max_retries: int = 3
    backoff_base_seconds: float = 2.0
    priority: JobPriority = JobPriority.NORMAL
    correlation_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    status: JobState = JobState.QUEUED
    error: Optional[str] = None
    error_stack: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    execution_duration_ms: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value if isinstance(self.status, JobState) else self.status
        data["priority"] = self.priority.value if isinstance(self.priority, JobPriority) else self.priority
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> JobContract:
        cleaned = dict(data)
        if "status" in cleaned and isinstance(cleaned["status"], str):
            cleaned["status"] = JobState(cleaned["status"])
        if "priority" in cleaned and isinstance(cleaned["priority"], str):
            cleaned["priority"] = JobPriority(cleaned["priority"])
        return cls(**cleaned)
