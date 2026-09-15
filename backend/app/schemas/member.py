"""
Chaos Computer Club — Member, Profile & Auth Pydantic Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class RatingHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contest_id: Optional[str] = None
    contest_title: str
    contested_at: datetime
    old_rating: int
    new_rating: int
    rank: int


class LeaderboardRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    avatar_url: Optional[str] = None
    rank: int
    university_rank: int
    previous_rank: Optional[int] = None
    handle: str
    full_name: str
    prn: str
    department: str
    batch: str
    rating: int
    peak_rating: int
    attendance_rate: float
    attendance_count: int
    attendance_total: int
    tier: str
    ratings: list[int] = []
    recent_deltas: list[int] = []
