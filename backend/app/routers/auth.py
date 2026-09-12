"""
Chaos Computer Club — Medi-Caps Chapter
routers/auth.py — HTTP endpoints for authentication layer

Thin HTTP layer: validates requests, delegates to AuthController.
All business logic lives in controllers/auth_controller.py.

Flow:
  POST /auth/send-otp         → step 1: OTP to Redis + email
  POST /auth/verify-otp       → step 2: verify against Redis, issue JWT
  POST /auth/complete-onboarding → step 3: set handle/name/PRN/dept/batch
  GET  /auth/me               → return own profile (requires JWT)
  POST /auth/logout           → client-side token drop (stateless JWT)
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member, require_onboarded
from app.models.db_models import MemberProfile
from app.schemas.auth import (
    SendOTPRequest,
    VerifyOTPRequest,
    CompleteOnboardingRequest,
)
from app.controllers.auth_controller import AuthController

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp", summary="Request OTP verification email")
async def send_otp(payload: SendOTPRequest):
    return await AuthController.send_otp(payload)


@router.post("/verify-otp", summary="Verify OTP and receive access token")
async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    return await AuthController.verify_otp(payload, db)


@router.post("/complete-onboarding", summary="Complete new member profile setup")
async def complete_onboarding(
    payload: CompleteOnboardingRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.complete_onboarding(payload, current_member, db)


@router.get("/me", summary="Get own authenticated profile")
async def get_me(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.get_full_profile(current_member, db)


@router.get("/profile/full", summary="Get own full profile (alias for /me)")
async def get_profile_full(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.get_full_profile(current_member, db)


@router.post("/logout", summary="Invalidate current session (client-side)")
async def logout(current_member: MemberProfile = Depends(get_current_member)):
    return {"success": True, "message": "Logged out. Delete your local token."}
