"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Pydantic v2 Schemas for Validation and Serialization
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ─── Auth & Member Schemas ──────────────────────────────────────────

class MemberRegister(BaseModel):
    handle: str = Field(..., min_length=3, max_length=30)
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    prn: str = Field(..., min_length=6, max_length=25, description="Medi-Caps University PRN/Enrollment ID")
    department: str = Field(..., description="CSE, IT, AIDS, Cyber Security")
    batch: str = Field(..., description="2022-26, 2023-27, 2024-28")
    password: str = Field(..., min_length=6)


class MemberLogin(BaseModel):
    handle_or_prn: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    handle: str
    full_name: str
    prn: str


class MemberProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    handle: str
    full_name: str
    email: str
    prn: str
    department: str
    batch: str
    rating: int
    peak_rating: int
    attendance_count: int
    attendance_total: int
    is_core_member: bool
    created_at: datetime


# ─── Contest & Problem Schemas ─────────────────────────────────────

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


class OfflineContestResponse(BaseModel):
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
    created_at: datetime
    problems: Optional[List[ContestProblemResponse]] = None


# ─── Scoreboard & Telemetry Schemas ────────────────────────────────

class ProblemTelemetryItem(BaseModel):
    problem_index: str
    status: str  # solved, failed, untouched
    attempts: int
    solve_minute: Optional[int] = None
    is_first_ac: bool = False


class ScoreboardEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contest_id: str
    member_id: Optional[str] = None
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
    telemetry: List[Dict[str, Any]]


# ─── Rating & Leaderboard Schemas ──────────────────────────────────

class RatingHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    member_id: str
    contest_id: Optional[str] = None
    contest_title: str
    contested_at: datetime
    old_rating: int
    new_rating: int
    rank: int


class LeaderboardRow(BaseModel):
    rank: int
    university_rank: int = 1
    previous_rank: int = 1
    handle: str = "anonymous"
    full_name: str = "Anonymous Member"
    prn: str = "0827CS231000"
    department: str = "CSE"
    batch: str = "2024-28"
    rating: int = 1200
    peak_rating: int = 1200
    attendance_rate: float = 0.0
    attendance_count: int = 0
    attendance_total: int = 0
    tier: str = "1_star"  # 5_star, 4_star, 3_star, 2_star, 1_star
    ratings: List[int] = []
    recent_deltas: List[int] = []


# ─── Trust of Proof Schemas ────────────────────────────────────────

class TrustProofResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    certificate_id: str
    contest_id: str
    member_handle: str
    contest_title: str
    session_uuid: str
    prn_hash: str
    sha256_digest: str
    proctor_stamp: str
    attendance_stamp: str
    score: int
    rank: int
    issued_at: datetime
    status: str


class VerifyRequest(BaseModel):
    certificate_id_or_hash: str


class VerifyResponse(BaseModel):
    is_valid: bool
    proof: Optional[TrustProofResponse] = None
    message: str


# ─── Campus Pass & Announcements Schemas ───────────────────────────

class CampusPassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    member_id: str
    contest_id: str
    pass_code: str
    seat_number: str
    qr_data: str
    check_in_status: str
    issued_at: datetime


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    title: str
    summary: str
    published_at: datetime
    contest_slug: Optional[str] = None
