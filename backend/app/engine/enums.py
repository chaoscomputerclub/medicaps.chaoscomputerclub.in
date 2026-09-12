"""
Chaos Computer Club — Code Execution Engine Enumerations
Inspired by Interleet Judge Engine
"""

from enum import Enum


class Language(str, Enum):
    PYTHON = "python"
    CPP = "cpp"
    JAVA = "java"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"


class Verdict(str, Enum):
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    COMPILATION_ERROR = "COMPILATION_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ExecutionStatus(str, Enum):
    QUEUED = "QUEUED"
    COMPILING = "COMPILING"
    RUNNING = "RUNNING"
    JUDGING = "JUDGING"
    COMPLETED = "COMPLETED"
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
