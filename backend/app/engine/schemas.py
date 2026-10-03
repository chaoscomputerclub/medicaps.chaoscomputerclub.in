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
    output_limit_exceeded: bool = False
    system_error: bool = False


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
    verdict: Verdict = Verdict.SYSTEM_ERROR
    category: Optional[str] = None
    stdout: str = ""
    expected_output: str = ""
    stderr: str = ""
    compile_output: str = ""
    wall_time_ms: float = 0.0  # Measured wall-clock duration of testcase execution
    runtime_ms: float = 0.0    # CPU / sandbox process runtime in milliseconds
    cpu_time_ms: Optional[float] = None  # Explicit sandbox CPU runtime in milliseconds
    peak_memory_mb: float = 0.0
    exit_code: int = 0
    weight: float = 1.0
    wall_time_fallback: bool = False


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
    job_id: Optional[str] = None
    attempt_id: Optional[str] = None
    lease_id: Optional[str] = None
    node_id: Optional[str] = None
    container_id: Optional[str] = None
    provider: Optional[str] = None
    status: ExecutionStatus = ExecutionStatus.COMPLETED
    verdict: Verdict = Verdict.SYSTEM_ERROR
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    memory: float = 0.0
    time: float = 0.0  # CPU execution time in seconds (for problem time limit evaluation)
    exit_code: int = 0
    testcase_results: list[TestCaseResult] = Field(default_factory=list)
    passed_testcases: int = 0
    total_testcases: int = 0
    score: float = 0.0
    compile_time_ms: float = 0.0  # Time spent compiling code
    execution_time_ms: float = 0.0  # Wall-clock duration of testcase execution stage
    total_time_ms: float = 0.0  # Total provider execution lifecycle wall time
    execution_cpu_ms: Optional[float] = None  # Aggregate CPU/process runtime inside sandbox
    execution_wall_ms: Optional[float] = None  # Actual elapsed wall-clock execution time
    provider_turnaround_ms: Optional[float] = None  # Full wall-clock turnaround of execution provider
    result_normalization_ms: Optional[float] = None  # Time spent parsing/evaluating results
    timestamps: dict[str, Optional[str]] = Field(default_factory=dict)
    latencies: dict[str, float] = Field(default_factory=dict)
    telemetry: dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

