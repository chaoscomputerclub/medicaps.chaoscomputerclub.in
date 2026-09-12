"""
Chaos Computer Club — Code Execution & Assessment Schemas
Inspired by Interleet Judge Engine
"""

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4
from pydantic import BaseModel, Field
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, TestCaseCategory, Verdict


class InlineTestCase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    stdin: str = ""
    expected_output: str = ""
    name: Optional[str] = None
    hidden: bool = False


class ExecuteRequest(BaseModel):
    language: Language
    code: str
    stdin: str = ""
    expected_output: Optional[str] = None
    time_limit: float = Field(default=3.0, ge=0.2, le=15.0)
    memory_limit: int = Field(default=256, ge=32, le=1024)
    comparison_mode: ComparisonMode = ComparisonMode.TRIMMED


class RunRequest(BaseModel):
    """Run code against sample test cases (interactive testing)"""
    language: Language
    code: str
    test_cases: list[InlineTestCase] = []
    time_limit: float = Field(default=3.0, ge=0.2, le=15.0)
    memory_limit: int = Field(default=256, ge=32, le=1024)
    comparison_mode: ComparisonMode = ComparisonMode.TRIMMED


class TestCaseSchema(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    stdin: str = ""
    expected_output: str = ""
    hidden: bool = False
    weight: float = 1.0
    category: Optional[TestCaseCategory] = TestCaseCategory.SAMPLE
    time_limit: Optional[float] = None
    memory_limit: Optional[int] = None
    name: Optional[str] = None
    comparison_mode: Optional[ComparisonMode] = None


class SandboxResult(BaseModel):
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    wall_time_ms: float = 0.0
    peak_memory_mb: float = 0.0
    timed_out: bool = False
    oom_killed: bool = False


class CompileResult(BaseModel):
    success: bool
    output: str = ""
    error: str = ""
    time_ms: float = 0.0


class TestCaseResult(BaseModel):
    testcase_id: str
    name: Optional[str] = None
    hidden: bool = False
    passed: bool = False
    verdict: Verdict = Verdict.INTERNAL_ERROR
    category: Optional[str] = None
    stdout: str = ""
    expected_output: str = ""
    stderr: str = ""
    compile_output: str = ""
    wall_time_ms: float = 0.0
    runtime_ms: float = 0.0
    peak_memory_mb: float = 0.0
    exit_code: int = 0
    weight: float = 1.0


class ScoringResult(BaseModel):
    verdict: Verdict
    score: float
    passed: int
    total: int
    max_time_ms: float = 0.0
    max_memory_mb: float = 0.0


class ExecutionResult(BaseModel):
    success: bool
    submission_id: str = Field(default_factory=lambda: str(uuid4()))
    status: ExecutionStatus = ExecutionStatus.COMPLETED
    verdict: Verdict = Verdict.INTERNAL_ERROR
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    memory: float = 0.0
    time: float = 0.0
    exit_code: int = 0
    testcase_results: list[TestCaseResult] = Field(default_factory=list)
    passed_testcases: int = 0
    total_testcases: int = 0
    score: float = 0.0
    error: Optional[str] = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
