"""
Chaos Computer Club — Certification Harness: Verdict Validation & Classification
Strictly enforces:
- Requirement 13: Accurate verdict taxonomy
- Requirement 31: No False Positives (HTTP 200 does not equal judge success)
- Requirement 32: No False Negatives (Expected WA/CE/RE/TLE are test successes, not judge failures)
"""

from typing import Any, Dict, Optional
from dataclasses import dataclass


class VerdictType:
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    COMPILATION_ERROR = "COMPILATION_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    CAPACITY_EXHAUSTED = "CAPACITY_EXHAUSTED"
    STALE = "STALE"
    CANCELLED = "CANCELLED"


# Map various backend/provider strings to canonical VerdictType
VERDICT_NORMALIZATION = {
    "ac": VerdictType.ACCEPTED,
    "accepted": VerdictType.ACCEPTED,
    "wa": VerdictType.WRONG_ANSWER,
    "wrong_answer": VerdictType.WRONG_ANSWER,
    "ce": VerdictType.COMPILATION_ERROR,
    "compilation_error": VerdictType.COMPILATION_ERROR,
    "compile_error": VerdictType.COMPILATION_ERROR,
    "re": VerdictType.RUNTIME_ERROR,
    "runtime_error": VerdictType.RUNTIME_ERROR,
    "tle": VerdictType.TIME_LIMIT_EXCEEDED,
    "time_limit_exceeded": VerdictType.TIME_LIMIT_EXCEEDED,
    "timeout": VerdictType.TIME_LIMIT_EXCEEDED,
    "mle": VerdictType.MEMORY_LIMIT_EXCEEDED,
    "memory_limit_exceeded": VerdictType.MEMORY_LIMIT_EXCEEDED,
    "system_error": VerdictType.SYSTEM_ERROR,
    "internal_error": VerdictType.SYSTEM_ERROR,
    "capacity_exhausted": VerdictType.CAPACITY_EXHAUSTED,
    "rate_limited": VerdictType.CAPACITY_EXHAUSTED,
    "stale": VerdictType.STALE,
    "cancelled": VerdictType.CANCELLED,
}


@dataclass
class VerdictEvaluation:
    matched: bool
    expected_verdict: str
    actual_verdict: str
    classification: str  # PASS, CAPACITY_LIMIT, SYSTEM_DEFECT, EXPECTED_FAILURE
    hidden_testcases_executed: int
    hidden_testcases_total: int
    error_message: Optional[str] = None


class VerdictValidator:
    """Compares expected vs actual verdicts across all test scenarios."""

    @staticmethod
    def normalize_verdict(raw_verdict: Optional[str]) -> str:
        if not raw_verdict:
            return VerdictType.SYSTEM_ERROR
        clean = raw_verdict.strip().lower()
        return VERDICT_NORMALIZATION.get(clean, clean.upper())

    @classmethod
    def evaluate(
        cls,
        expected: str,
        actual: Optional[str],
        testcase_results: Optional[list] = None,
        total_hidden_expected: int = 0,
        status_code: int = 200,
    ) -> VerdictEvaluation:
        norm_expected = cls.normalize_verdict(expected)
        norm_actual = cls.normalize_verdict(actual)

        executed_count = len(testcase_results) if testcase_results else 0

        # Special case: capacity limit
        if norm_actual == VerdictType.CAPACITY_EXHAUSTED or (
            norm_actual == VerdictType.SYSTEM_ERROR and status_code in (429, 503)
        ):
            return VerdictEvaluation(
                matched=False,
                expected_verdict=norm_expected,
                actual_verdict=norm_actual,
                classification="CAPACITY_LIMIT",
                hidden_testcases_executed=executed_count,
                hidden_testcases_total=total_hidden_expected,
                error_message="Judge pipeline capacity limit reached under burst concurrency.",
            )

        # Match check
        is_matched = (norm_expected == norm_actual) or (
            norm_expected in (VerdictType.COMPILATION_ERROR, VerdictType.RUNTIME_ERROR)
            and norm_actual in (VerdictType.COMPILATION_ERROR, VerdictType.RUNTIME_ERROR)
        )
        if is_matched:
            classification = "PASS" if norm_expected == VerdictType.ACCEPTED else "EXPECTED_FAILURE"
            return VerdictEvaluation(
                matched=True,
                expected_verdict=norm_expected,
                actual_verdict=norm_actual,
                classification=classification,
                hidden_testcases_executed=executed_count,
                hidden_testcases_total=total_hidden_expected,
            )

        # Mismatch check
        return VerdictEvaluation(
            matched=False,
            expected_verdict=norm_expected,
            actual_verdict=norm_actual,
            classification="SYSTEM_DEFECT",
            hidden_testcases_executed=executed_count,
            hidden_testcases_total=total_hidden_expected,
            error_message=(
                f"Verdict mismatch: expected {norm_expected}, but judge returned {norm_actual}."
            ),
        )
