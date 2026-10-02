"""
Chaos Computer Club — Admin Load Test & Distributed Judge Certification Schemas
Strict Finite State Machine (FSM) Lifecycle:
PREPARING -> READY_FOR_ACK -> ADMIN_ACKNOWLEDGED -> ARMED -> RUNNING -> DRAINING -> COMPLETED -> REPORT_READY
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LoadTestFSMState(str, Enum):
    PREPARING = "PREPARING"
    READY_FOR_ACK = "READY_FOR_ACK"
    ADMIN_ACKNOWLEDGED = "ADMIN_ACKNOWLEDGED"
    ARMED = "ARMED"
    RUNNING = "RUNNING"
    DRAINING = "DRAINING"
    COMPLETED = "COMPLETED"
    REPORT_READY = "REPORT_READY"
    ABORTED = "ABORTED"
    FAILED = "FAILED"


class ProblemReadinessDetail(BaseModel):
    problem_id: str
    problem_index: str
    title: str
    time_limit: float
    memory_limit: int
    sample_testcases_count: int
    hidden_testcases_count: int
    has_hidden_tests: bool
    languages_configured: List[str] = Field(default_factory=list)


class LoadTestPrepareRequest(BaseModel):
    virtual_users_count: int = Field(default=50, ge=1, le=200, description="Target virtual users cohort")
    scenarios: List[str] = Field(
        default=["single_submission", "burst_concurrency", "mixed_languages", "mixed_verdicts"],
        description="Configured test scenario identifiers"
    )
    run_seed: Optional[int] = Field(default=None, description="Deterministic pseudo-random seed")
    allow_failure_injection: bool = Field(default=False, description="Enable controlled node/Redis disruption")


class LoadTestPrepareResponse(BaseModel):
    status: LoadTestFSMState
    contest_id: str
    contest_slug: str
    contest_title: str
    virtual_users: int
    problems_count: int
    problems: List[ProblemReadinessDetail]
    languages_supported: List[str]
    hidden_tests_verified: bool
    identity_pool_verified: bool
    execution_nodes_healthy: bool
    configuration_hash: str
    readiness_issues: List[str] = Field(default_factory=list)
    message: str


class LoadTestAckRequest(BaseModel):
    confirm_live_execution: bool = Field(..., description="Must explicitly be True to arm the test harness")
    notes: Optional[str] = Field(default=None, description="Optional administrative audit notes")


class LoadTestAckResponse(BaseModel):
    status: LoadTestFSMState
    test_run_id: str
    contest_id: str
    admin_id: str
    admin_handle: str
    acknowledged_at: str
    configuration_hash: str
    message: str


class LoadTestStartRequest(BaseModel):
    run_seed: Optional[int] = Field(default=None, description="Optional seed override for reproduction")


class LoadTestStartResponse(BaseModel):
    status: LoadTestFSMState
    test_run_id: str
    contest_id: str
    started_at: str
    message: str


class LoadTestStatusResponse(BaseModel):
    contest_id: str
    test_run_id: Optional[str] = None
    status: LoadTestFSMState
    virtual_users_active: int = 0
    submissions_dispatched: int = 0
    submissions_completed: int = 0
    queue_depth: int = 0
    elapsed_seconds: float = 0.0
    progress_percent: float = 0.0
    current_phase: Optional[str] = None
    message: Optional[str] = None


class LoadTestAbortResponse(BaseModel):
    status: LoadTestFSMState
    test_run_id: str
    aborted_at: str
    message: str
