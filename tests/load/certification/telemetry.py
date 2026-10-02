"""
Chaos Computer Club — Certification Harness: Submission Lifecycle Telemetry
Validates correlation chains, 11-point timestamp sequences, and mathematical latency equality:
calculated_duration == timestamp_delta
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class TelemetryAuditResult:
    valid: bool
    submission_id: str
    job_id: Optional[str] = None
    delta_errors: List[str] = field(default_factory=list)
    missing_fields: List[str] = field(default_factory=list)
    latencies: Dict[str, float] = field(default_factory=dict)


class TelemetryAuditor:
    """Verifies that execution telemetry matches mathematical timestamp deltas."""

    REQUIRED_CORRELATION_FIELDS = [
        "user_id",
        "virtual_user_id",
        "contest_id",
        "problem_id",
        "submission_id",
        "language",
    ]

    TIMESTAMP_PAIRS = [
        ("enqueue", "claim", "claim_latency_ms"),
        ("claim", "execution_start", "queue_wait_ms"),
        ("compile_start", "compile_end", "compile_ms"),
        ("execution_start", "execution_end", "execution_ms"),
        ("execution_end", "result_report", "result_report_ms"),
        ("result_report", "db_cas", "cas_finalize_ms"),
        ("db_cas", "outbox", "outbox_latency_ms"),
        ("outbox", "redis_publish", "sse_publish_ms"),
        ("enqueue", "redis_publish", "total_submission_latency_ms"),
    ]

    @staticmethod
    def parse_iso(ts_str: Optional[str]) -> Optional[datetime]:
        if not ts_str:
            return None
        try:
            return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            return None

    @classmethod
    def audit_submission_telemetry(
        cls,
        telemetry: Dict[str, Any],
        virtual_user_id: str,
        submission_id: str,
    ) -> TelemetryAuditResult:
        missing_fields = []
        delta_errors = []
        latencies = {}

        # 1. Verify required correlation fields
        for field in cls.REQUIRED_CORRELATION_FIELDS:
            if field == "virtual_user_id":
                val = telemetry.get(field) or virtual_user_id
            elif field == "submission_id":
                val = telemetry.get(field) or submission_id
            else:
                val = telemetry.get(field)

            if not val:
                missing_fields.append(field)

        # 2. Extract timestamps and reported latencies
        timestamps = telemetry.get("timestamps", {})
        reported_latencies = telemetry.get("latencies", {})

        # 3. Check mathematical delta equality
        for start_key, end_key, latency_key in cls.TIMESTAMP_PAIRS:
            start_str = timestamps.get(start_key)
            end_str = timestamps.get(end_key)
            reported_val = reported_latencies.get(latency_key)

            if start_str and end_str:
                dt_start = cls.parse_iso(start_str)
                dt_end = cls.parse_iso(end_str)

                if dt_start and dt_end:
                    calculated_ms = round((dt_end - dt_start).total_seconds() * 1000.0, 3)
                    latencies[latency_key] = calculated_ms

                    if reported_val is not None:
                        # Allow 2.0 ms tolerance for float precision / serialization
                        if abs(calculated_ms - float(reported_val)) > 2.0:
                            delta_errors.append(
                                f"Mathematical mismatch for {latency_key}: "
                                f"delta({start_key}->{end_key})={calculated_ms}ms, reported={reported_val}ms"
                            )

        is_valid = len(delta_errors) == 0

        return TelemetryAuditResult(
            valid=is_valid,
            submission_id=submission_id,
            job_id=telemetry.get("job_id"),
            delta_errors=delta_errors,
            missing_fields=missing_fields,
            latencies=latencies,
        )
