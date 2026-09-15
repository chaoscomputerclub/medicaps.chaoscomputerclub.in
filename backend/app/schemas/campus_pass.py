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
    """Single attendee row for the proctor check-in dashboard."""
    rank: int
    handle: str
    full_name: str
    department: str
    batch: str
    seat_number: str
    pass_code: str
    check_in_status: str
    checked_in_at: Optional[datetime] = None
    checked_in_by: Optional[str] = None
    screening_score: float
