"""
Chaos Computer Club — Dynamic Contest Creation & Admin Pydantic Schemas
Production-grade request and response schemas for dynamically creating,
updating, configuring, and publishing campus contests and screening rounds.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class TestCaseCreateSchema(BaseModel):
    stdin: str = Field("", description="Standard input string passed to the solution")
    expected_output: str = Field(..., description="Exact expected standard output string")
    explanation: Optional[str] = Field(None, description="Optional explanation for sample testcases")
    weight: Optional[float] = Field(1.0, description="Score weight for hidden testcase evaluation")


class ProblemCreateSchema(BaseModel):
    problem_index: str = Field(..., description="Problem index identifier: A, B, C, D, E, F")
    title: str = Field(..., min_length=2, max_length=120, description="Problem title")
    topic: Optional[str] = Field("Algorithms", max_length=60, description="Core topic: Graph, DP, Greedy, etc.")
    difficulty: str = Field("MEDIUM", description="EASY, MEDIUM, HARD")
    points: int = Field(100, ge=10, le=1000, description="Points awarded for solving this problem")
    description: str = Field(..., min_length=10, description="Detailed problem statement markdown")
    input_format: Optional[str] = Field(None, description="Input format specification")
    output_format: Optional[str] = Field(None, description="Output format specification")
    constraints: Optional[str] = Field(None, description="Time/Memory and mathematical constraints")
    time_limit: float = Field(2.0, ge=0.1, le=10.0, description="Execution time limit in seconds")
    memory_limit: int = Field(256, ge=16, le=1024, description="Memory limit in megabytes")
    starter_codes: Dict[str, str] = Field(default_factory=dict, description="Boilerplate code per language: python, cpp, java, javascript")
    sample_testcases: List[TestCaseCreateSchema] = Field(default_factory=list, description="Visible sample testcases with optional explanations")
    hidden_testcases: List[TestCaseCreateSchema] = Field(default_factory=list, description="Hidden evaluation testcases for official grading")

    @field_validator("problem_index")
    @classmethod
    def validate_index(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not re.match(r"^[A-Z][0-9]?$", cleaned):
            raise ValueError("Problem index must be a letter (A-Z) or alphanumeric (A1, B2).")
        return cleaned

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in {"EASY", "MEDIUM", "HARD"}:
            return "MEDIUM"
        return cleaned


class AssessmentConfigSchema(BaseModel):
    title: Optional[str] = Field(None, max_length=120, description="Phase 1 assessment title")
    summary: Optional[str] = Field(None, description="Assessment overview summary")
    duration_minutes: int = Field(120, ge=15, le=360, description="Duration allowed per candidate attempt in minutes")
    starts_at: Optional[datetime] = Field(None, description="Assessment unlock timestamp (defaults to contest starts_at - 24h)")
    ends_at: Optional[datetime] = Field(None, description="Assessment conclusion timestamp (defaults to contest starts_at)")
    max_violations: int = Field(3, ge=1, le=10, description="Anti-cheat violation threshold before disqualification")
    auto_unlock_now: bool = Field(True, description="Whether to open the screening window immediately upon creation")


class DynamicContestCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=120, description="Contest title")
    slug: Optional[str] = Field(None, max_length=80, description="Unique URL slug (auto-generated if omitted)")
    season: str = Field("Season 2026", max_length=50, description="Contest season / academic year")
    cadence: str = Field("weekly", description="Cadence category: weekly, biweekly, special")
    edition: Optional[int] = Field(None, ge=1, description="Contest edition number (e.g. 42 for Weekly #42)")
    division: str = Field("open", max_length=30, description="Contest division: open, division_1, division_2, division_3")
    starts_at: datetime = Field(..., description="On-premise lab final start time (ISO 8601)")
    ends_at: Optional[datetime] = Field(None, description="On-premise lab final end time (defaults to starts_at + 2 hours)")
    check_in_opens_at: Optional[datetime] = Field(None, description="Gate check-in opening time (defaults to starts_at - 1 hour)")
    venue: str = Field("Medi-Caps University Main Computing Lab (Lab 04)", max_length=120, description="Physical venue / lab room")
    seat_capacity: int = Field(60, ge=10, le=500, description="Maximum physical workstation seats available")
    environment: str = Field("Air-Gapped Workstation LAN · Clang 18 / GCC 14 / Python 3.12", max_length=120, description="Technical environment setup")
    chief_proctors: List[str] = Field(default_factory=lambda: ["Chief Proctor (CCC Core)", "CCC Operations Desk"], description="Chief proctors & station officers")
    prize_pool: Optional[str] = Field(None, max_length=80, description="Prize pool description")
    sponsor: Optional[str] = Field("Chaos Computer Club Medi-Caps Chapter", max_length=80, description="Sponsoring organisation")
    summary: str = Field(..., min_length=10, description="Comprehensive contest briefing summary")
    rules: List[str] = Field(default_factory=list, description="Contest rules and guidelines")
    banner_url: Optional[str] = Field(None, max_length=500, description="Hero banner image URL")
    problems: List[ProblemCreateSchema] = Field(default_factory=list, description="Contest & Assessment problem set")
    assessment: Optional[AssessmentConfigSchema] = Field(default_factory=AssessmentConfigSchema, description="Phase 1 online screening configuration")

    @field_validator("cadence")
    @classmethod
    def validate_cadence(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in {"weekly", "biweekly", "special"}:
            return "weekly"
        return cleaned

    @field_validator("division")
    @classmethod
    def validate_division(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in {"open", "division_1", "division_2", "division_3"}:
            return "open"
        return cleaned

    @model_validator(mode="after")
    def validate_dates(self) -> "DynamicContestCreateRequest":
        if self.ends_at and self.starts_at and self.ends_at <= self.starts_at:
            raise ValueError("Contest ends_at must be chronologically after starts_at.")
        return self


class DynamicContestUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=120)
    season: Optional[str] = Field(None, max_length=50)
    cadence: Optional[str] = None
    edition: Optional[int] = Field(None, ge=1)
    division: Optional[str] = None
    status: Optional[str] = Field(None, description="upcoming, live, finished")
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    check_in_opens_at: Optional[datetime] = None
    venue: Optional[str] = Field(None, max_length=120)
    seat_capacity: Optional[int] = Field(None, ge=10, le=500)
    environment: Optional[str] = Field(None, max_length=120)
    chief_proctors: Optional[List[str]] = None
    prize_pool: Optional[str] = None
    sponsor: Optional[str] = None
    summary: Optional[str] = Field(None, min_length=10)
    rules: Optional[List[str]] = None
    banner_url: Optional[str] = None


class ContestCloneRequest(BaseModel):
    new_slug: Optional[str] = Field(None, max_length=80, description="Custom slug for cloned contest")
    new_title: str = Field(..., min_length=3, max_length=120, description="Title for new contest")
    new_edition: Optional[int] = Field(None, ge=1, description="Edition number (e.g., incremented number)")
    starts_at: datetime = Field(..., description="Target start time for the cloned contest")
    ends_at: Optional[datetime] = Field(None, description="Target end time")
    auto_unlock_assessment_now: bool = Field(True, description="Unlock screening round immediately")


class PresetContestLaunchRequest(BaseModel):
    cadence: str = Field("weekly", description="weekly or biweekly")
    edition: int = Field(..., ge=1, description="Edition number (e.g. 43)")
    starts_in_hours: float = Field(24.0, ge=0.5, le=336.0, description="Hours from now when contest will start")
    venue: Optional[str] = None
    prize_pool: Optional[str] = None
    auto_unlock_screening: bool = Field(True, description="Open Phase 1 screening immediately")


class ContestStatusChangeRequest(BaseModel):
    status: str = Field(..., description="Target status: upcoming, live, finished")
    auto_qualify_top_30: bool = Field(True, description="Auto-qualify Top 30 candidates when transitioning to live")
