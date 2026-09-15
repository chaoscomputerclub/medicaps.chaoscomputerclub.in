"""
Chaos Computer Club — Online Screening Assessment Pydantic Schemas
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AssessmentSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    summary: str
    duration_minutes: int
    starts_at: datetime
    ends_at: datetime
    is_active: bool
    contest_id: Optional[str] = None


class AssessmentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    summary: str
    duration_minutes: int
    starts_at: datetime
    ends_at: datetime
    is_active: bool
    max_violations: int
    problem_count: int


class AssessmentProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    problem_index: str
    title: str
    difficulty: str
    description: str
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    points: int
    time_limit: float
    memory_limit: int
    starter_codes: Dict[str, str] = {}
    sample_testcases: List[Dict[str, Any]] = []


class AssessmentStartResponse(BaseModel):
    session_id: str
    assessment_id: str
    started_at: datetime
    duration_minutes: int
    time_remaining_seconds: int
    problems: List[AssessmentProblemResponse]


class AssessmentSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    total_score: float
    anti_cheat_violations: int
    is_top_30_qualified: bool


class AssessmentViolationRequest(BaseModel):
    violation_type: str = Field(..., description="tab_switch, fullscreen_exit, devtools_open, multiple_faces")
    details: Optional[str] = None


class AssessmentSubmitRequest(BaseModel):
    problem_id: str
    language: str
    code: str


class AssessmentSubmitResponse(BaseModel):
    submission_id: str
    verdict: str
    passed_testcases: int
    total_testcases: int
    score: float
    runtime_ms: float
    memory_mb: float
    testcase_results: List[Dict[str, Any]] = []
