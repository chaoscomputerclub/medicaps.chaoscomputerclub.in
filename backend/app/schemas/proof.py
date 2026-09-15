"""
Chaos Computer Club — Trust-of-Proof Pydantic Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TrustProofResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    certificate_id: str
    contest_id: str
    member_handle: str
    contest_title: str
    session_uuid: str
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
