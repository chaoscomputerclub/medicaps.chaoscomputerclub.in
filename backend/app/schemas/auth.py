"""
Chaos Computer Club — Medi-Caps Chapter
schemas/auth.py — Pydantic request/response models for auth layer
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class SendOTPRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class SendOTPResponse(BaseModel):
    success: bool
    message: str
    transaction_id: str


class VerifyOTPRequest(BaseModel):
    transaction_id: str
    otp: str

    @field_validator("otp")
    @classmethod
    def strip_otp(cls, v: str) -> str:
        return v.strip()


class MemberPublic(BaseModel):
    handle: Optional[str] = None
    full_name: Optional[str] = None
    email: str
    department: Optional[str] = None
    batch: Optional[str] = None
    rating: int = 1200
    is_onboarded: bool = False


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
    member: MemberPublic


class CompleteOnboardingRequest(BaseModel):
    handle: str
    full_name: str
    prn: str
    department: str
    batch: str

    @field_validator("handle")
    @classmethod
    def handle_format(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) < 3:
            raise ValueError("Handle must be at least 3 characters.")
        return v

    @field_validator("prn")
    @classmethod
    def prn_upper(cls, v: str) -> str:
        return v.strip().upper()
