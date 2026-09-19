"""
Chaos Computer Club — Campus Pass & QR Validation Pydantic Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class CampusPassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pass_code: str
    contest_id: str
    seat_number: str
    qr_data: str
    check_in_status: str
    issued_at: datetime
    checked_in_at: Optional[datetime] = None
    checked_in_by: Optional[str] = None
    # Joined fields for UI convenience
    member_name: Optional[str] = None
    handle: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    contest_title: Optional[str] = None
    contest_slug: Optional[str] = None
    seat: Optional[str] = None
    status: Optional[str] = None
    check_in_opens_at: Optional[datetime] = None


class PassVerifyRequest(BaseModel):
    """Payload sent by Proctor/Teacher when scanning or entering a QR Pass."""
    pass_code_or_qr: str
    contest_slug: Optional[str] = None


class PassVerifyResponse(BaseModel):
    """Result returned to Proctor after verifying student at the lab entrance."""
    valid: bool
    status: str  # verified, already_checked_in, invalid_pass, not_qualified
    message: str
    pass_code: Optional[str] = None
    seat_number: Optional[str] = None
    contest_title: Optional[str] = None
    contest_slug: Optional[str] = None
    candidate_name: Optional[str] = None
    handle: Optional[str] = None
    department: Optional[str] = None
    batch: Optional[str] = None
    qualification_rank: Optional[int] = None
    screening_score: Optional[float] = None
    checked_in_at: Optional[datetime] = None
    checked_in_by: Optional[str] = None


class ContestAttendeeItem(BaseModel):
    """Single attendee / registered participant row for the proctor check-in dashboard & admin dossier."""
    model_config = ConfigDict(from_attributes=True)

    rank: Optional[int] = None
    handle: str
    full_name: str
    department: Optional[str] = "CSE"
    batch: Optional[str] = "2023-27"
    seat_number: Optional[str] = "UNASSIGNED"
    pass_code: Optional[str] = "—"
    check_in_status: str = "registered"  # "checked_in", "issued", "registered", "pending"
    checked_in_at: Optional[datetime] = None
    checked_in_by: Optional[str] = None
    screening_score: Optional[float] = 0.0
    email: Optional[str] = None
    prn: Optional[str] = None
    enrollment_number: Optional[str] = None
    registered_at: Optional[datetime] = None
    registration_status: Optional[str] = "confirmed"
    assessment_taken: Optional[bool] = False
    is_top_30_qualified: Optional[bool] = False
    rating: Optional[int] = 1200

