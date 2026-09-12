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
        clean = v.strip().lower()
        if "@" not in clean:
            raise ValueError("A valid institutional email address is required.")
        domain = clean.split("@")[-1].strip()
        if domain != "medicaps.ac.in" and not domain.endswith(".medicaps.ac.in"):
            raise ValueError(
                "Access restricted: Only @medicaps.ac.in organization emails are permitted. Gmail and personal accounts are strictly prohibited."
            )
        return clean



class SendOTPResponse(BaseModel):
    success: bool
    sent: bool = True
    message: str
    transaction_id: str
    email: Optional[str] = None


class VerifyOTPRequest(BaseModel):
    # Support both Interleet (transaction_id + otp) and legacy/frontend (email + code)
    transaction_id: Optional[str] = None
    otp: Optional[str] = None
    email: Optional[str] = None
    code: Optional[str] = None

    @field_validator("otp", "code", mode="before")
    @classmethod
    def clean_code(cls, v):
        if v is None:
            return None
        return str(v).strip()

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v):
        if v is None:
            return None
        return str(v).strip().lower()


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
