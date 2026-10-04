"""
Chaos Computer Club — Code Execution Engine Enumerations
Inspired by Interleet Judge Engine
"""

from enum import Enum


# Language enum is defined authoritatively in languages.py alongside the registry.
# Importing here so all other modules can continue using `from app.engine.enums import Language`
# without any change — single source of truth, no dual-definition drift.
from app.engine.languages import Language  # noqa: F401


class Verdict(str, Enum):
    # User-Code Verdicts
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    COMPILATION_ERROR = "COMPILATION_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    OUTPUT_LIMIT_EXCEEDED = "OUTPUT_LIMIT_EXCEEDED"

    # Infrastructure Verdicts
    SYSTEM_ERROR = "SYSTEM_ERROR"
    EXECUTION_RESULT_MISSING = "EXECUTION_RESULT_MISSING"
    SANDBOX_ERROR = "SANDBOX_ERROR"
    EXECUTOR_UNAVAILABLE = "EXECUTOR_UNAVAILABLE"
    CAPACITY_EXCEEDED = "CAPACITY_EXCEEDED"
    INTERNAL_ERROR = "SYSTEM_ERROR"
    CANCELLED = "CANCELLED"

    # Testcase State Verdict
    NOT_EXECUTED = "NOT_EXECUTED"


class SubmissionMode(str, Enum):
    FULL_PROGRAM = "FULL_PROGRAM"
    FUNCTION = "FUNCTION"


class TestCaseState(str, Enum):
    NOT_EXECUTED = "NOT_EXECUTED"
    RUNNING = "RUNNING"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"
    INFRASTRUCTURE_ERROR = "INFRASTRUCTURE_ERROR"


class ExecutionStatus(str, Enum):
    QUEUED = "QUEUED"
    COMPILING = "COMPILING"
    COMPILED = "COMPILED"
    RUNNING = "RUNNING"
    EXECUTING = "EXECUTING"
    JUDGING = "JUDGING"
    COMPLETED = "COMPLETED"
    FINISHED = "FINISHED"
    FAILED = "FAILED"


class ComparisonMode(str, Enum):
    EXACT = "exact"
    TRIMMED = "trimmed"
    TOKEN = "token"
    FLOAT = "float"
    SEMANTIC = "semantic"
    UNORDERED = "unordered"


class TestCaseCategory(str, Enum):
    SAMPLE = "sample"           # Visible examples
    FUNCTIONAL = "functional"   # Normal hidden tests
    EDGE_CASE = "edge_case"     # Extreme/boundary cases
    PERFORMANCE = "performance" # Stress / large input tests
