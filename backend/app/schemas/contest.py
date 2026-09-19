"""
Chaos Computer Club — Offline Contest, Problem & Arena Pydantic Schemas
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from .assessment import AssessmentSummaryResponse


class ContestProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contest_id: str
    problem_index: str
    title: str
    topic: str
    points: int
    solved_count: int
    first_ac_seconds: Optional[int] = None
    editorial_summary: Optional[str] = None


class ContestArenaProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contest_id: str
    problem_index: str
    title: str
    topic: str
    points: int
    difficulty: Optional[str] = "MEDIUM"
    description: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    time_limit: Optional[float] = 2.0
    memory_limit: Optional[int] = 256
    starter_codes: Optional[Dict[str, str]] = None
    sample_testcases: Optional[List[Dict[str, Any]]] = None


class ContestArenaResponse(BaseModel):
    contest_id: str
    slug: str
    title: str
    season: str
    status: str
    starts_at: str
    ends_at: str
    venue: str
    environment: str
    chief_proctors: List[str]
    problems: List[ContestArenaProblemResponse]
    server_time: str


class ContestSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    season: str
    status: str
    division: str
    starts_at: datetime
    ends_at: datetime
    check_in_opens_at: datetime
    venue: str
    seat_capacity: int
    registered_count: int
    problem_count: int
    cadence: Optional[str] = "weekly"
    edition: Optional[int] = None
    banner_url: Optional[str] = None
    assessment: Optional[AssessmentSummaryResponse] = None


class ContestDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    season: str
    status: str
    division: str
    starts_at: datetime
    ends_at: datetime
    check_in_opens_at: datetime
    venue: str
    seat_capacity: int
    registered_count: int
    problem_count: int
    environment: str
    chief_proctors: List[str]
    prize_pool: Optional[str] = None
    sponsor: Optional[str] = None
    summary: str
    rules: List[str]
    cadence: Optional[str] = "weekly"
    edition: Optional[int] = None
    banner_url: Optional[str] = None
    registered: bool = False
    problems: List[ContestProblemResponse] = []
    assessment: Optional[AssessmentSummaryResponse] = None


# Backwards-compatibility alias
OfflineContestResponse = ContestDetailResponse


class ContestRegistrationResponse(BaseModel):
    id: str
    contest_id: str
    member_id: str
    status: str
    registered_at: datetime
    seat_number: Optional[str] = None
    pass_code: Optional[str] = None
    qr_data: Optional[str] = None
    check_in_status: Optional[str] = None


class RegistrationStatusResponse(BaseModel):
    is_registered: bool
    status: Optional[str] = None
    registered_at: Optional[datetime] = None
    seat_assigned: Optional[str] = None
    pass_code: Optional[str] = None
    assessment_taken: bool = False
    assessment_score: Optional[float] = None
    is_top_30_qualified: bool = False


class ScoreboardEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rank: int
    handle: str
    full_name: str
    department: str
    batch: str
    division: str
    score: int
    solved: int
    penalty_seconds: int
    rating_delta: Optional[int] = None


class ArenaRunRequest(BaseModel):
    problem_id: str
    language: str
    code: str


class ArenaSubmitRequest(BaseModel):
    problem_id: str
    language: str
    code: str
