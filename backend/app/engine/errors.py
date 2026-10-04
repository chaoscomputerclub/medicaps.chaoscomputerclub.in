"""
Chaos Computer Club — Machine-Readable Failure Classification & Safe Exceptions
Standardized error codes, retryable classification, and safe public messaging.
"""

from __future__ import annotations

import enum
from typing import Optional


class ErrorCode(str, enum.Enum):
    # Distributed Node Failures
    NODE_UNAVAILABLE = "NODE_UNAVAILABLE"
    NODE_HEARTBEAT_EXPIRED = "NODE_HEARTBEAT_EXPIRED"
    NODE_EXECUTION_TIMEOUT = "NODE_EXECUTION_TIMEOUT"
    NODE_RESULT_TIMEOUT = "NODE_RESULT_TIMEOUT"

    # Codebox Execution Failures
    CODEBOX_UNAVAILABLE = "CODEBOX_UNAVAILABLE"
    CODEBOX_NOT_READY = "CODEBOX_NOT_READY"
    CODEBOX_QUEUE_FULL = "CODEBOX_QUEUE_FULL"
    CODEBOX_TIMEOUT = "CODEBOX_TIMEOUT"
    CODEBOX_WORKER_FAILURE = "CODEBOX_WORKER_FAILURE"
    CODEBOX_REDIS_FAILURE = "CODEBOX_REDIS_FAILURE"
    CODEBOX_HTTP_503 = "CODEBOX_HTTP_503"

    # Admission & Deadline Failures
    EXECUTION_CAPACITY_EXHAUSTED = "EXECUTION_CAPACITY_EXHAUSTED"
    EXECUTION_DEADLINE_EXCEEDED = "EXECUTION_DEADLINE_EXCEEDED"

    # Fencing & Idempotency
    STALE_ATTEMPT = "STALE_ATTEMPT"
    DUPLICATE_RESULT = "DUPLICATE_RESULT"

    # Infrastructure & Runner Failures
    EXECUTION_RESULT_MISSING = "EXECUTION_RESULT_MISSING"
    SANDBOX_ERROR = "SANDBOX_ERROR"
    EXECUTOR_UNAVAILABLE = "EXECUTOR_UNAVAILABLE"
    FUNCTION_NOT_FOUND = "FUNCTION_NOT_FOUND"

    # Catch-all
    INFRASTRUCTURE_FAILURE = "INFRASTRUCTURE_FAILURE"


# Classification of whether a failure is transient and eligible for bounded retry
RETRYABLE_ERROR_CODES = {
    ErrorCode.NODE_UNAVAILABLE,
    ErrorCode.NODE_HEARTBEAT_EXPIRED,
    ErrorCode.NODE_EXECUTION_TIMEOUT,
    ErrorCode.NODE_RESULT_TIMEOUT,
    ErrorCode.CODEBOX_UNAVAILABLE,
    ErrorCode.CODEBOX_TIMEOUT,
    ErrorCode.CODEBOX_HTTP_503,
    ErrorCode.CODEBOX_QUEUE_FULL,
    ErrorCode.EXECUTION_CAPACITY_EXHAUSTED,
}

NON_RETRYABLE_ERROR_CODES = {
    ErrorCode.STALE_ATTEMPT,
    ErrorCode.DUPLICATE_RESULT,
    ErrorCode.EXECUTION_DEADLINE_EXCEEDED,
    ErrorCode.CODEBOX_NOT_READY,
}


SAFE_PUBLIC_MESSAGES = {
    ErrorCode.NODE_UNAVAILABLE: "Execution node temporarily unavailable; rerouting job.",
    ErrorCode.NODE_HEARTBEAT_EXPIRED: "Execution node connection lost; reallocating compute worker.",
    ErrorCode.NODE_EXECUTION_TIMEOUT: "Execution exceeded allocated worker timeout.",
    ErrorCode.NODE_RESULT_TIMEOUT: "Execution result delivery timed out.",
    ErrorCode.CODEBOX_UNAVAILABLE: "Fallback execution engine is temporarily unavailable.",
    ErrorCode.CODEBOX_NOT_READY: "Execution engine is initializing. Please retry shortly.",
    ErrorCode.CODEBOX_QUEUE_FULL: "Execution queue is at peak capacity. Please retry in a few moments.",
    ErrorCode.CODEBOX_TIMEOUT: "Execution timed out in sandbox runner.",
    ErrorCode.CODEBOX_WORKER_FAILURE: "Sandbox worker encountered an infrastructure fault.",
    ErrorCode.CODEBOX_REDIS_FAILURE: "Coordination service transient error.",
    ErrorCode.CODEBOX_HTTP_503: "Execution service temporarily saturated.",
    ErrorCode.EXECUTION_CAPACITY_EXHAUSTED: "Platform compute capacity saturated. Request queued with backpressure.",
    ErrorCode.EXECUTION_DEADLINE_EXCEEDED: "Job execution budget exceeded dominant deadline.",
    ErrorCode.STALE_ATTEMPT: "Stale execution attempt superseded by newer attempt.",
    ErrorCode.DUPLICATE_RESULT: "Duplicate execution result received and safely ignored.",
    ErrorCode.INFRASTRUCTURE_FAILURE: "Transient platform infrastructure fault.",
}


class JudgeExecutionException(Exception):
    """
    Standardized typed execution exception.
    Guarantees zero leakage of internal stack traces, DB credentials, Docker paths, or testcase data.
    """

    def __init__(
        self,
        error_code: ErrorCode | str,
        safe_message: Optional[str] = None,
        provider: str = "unknown",
        attempt_id: Optional[str] = None,
        job_id: Optional[str] = None,
        internal_details: Optional[str] = None,
        retryable: Optional[bool] = None,
    ) -> None:
        if isinstance(error_code, str):
            try:
                self.error_code = ErrorCode(error_code)
            except ValueError:
                self.error_code = ErrorCode.INFRASTRUCTURE_FAILURE
        else:
            self.error_code = error_code

        self.safe_message = safe_message or SAFE_PUBLIC_MESSAGES.get(
            self.error_code, "A transient platform infrastructure fault occurred."
        )
        self.provider = provider
        self.attempt_id = attempt_id
        self.job_id = job_id
        self.internal_details = internal_details
        self.retryable = retryable if retryable is not None else (self.error_code in RETRYABLE_ERROR_CODES)

        super().__init__(f"[{self.error_code.value}] {self.safe_message}")

    def to_dict(self) -> dict:
        return {
            "error_code": self.error_code.value,
            "retryable": self.retryable,
            "provider": self.provider,
            "attempt_id": self.attempt_id,
            "job_id": self.job_id,
            "safe_message": self.safe_message,
        }
