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
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, Response, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member, get_current_member_optional, require_onboarded
from app.models.db_models import MemberProfile
from app.schemas.auth import (
    SendOTPRequest,
    VerifyOTPRequest,
    CompleteOnboardingRequest,
    UpdateProfileRequest,
)
from app.controllers.auth_controller import AuthController

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/google/login", summary="Initiate Google OAuth flow restricted to @medicaps.ac.in")
async def google_login(request: Request):
    return await AuthController.google_login(request)


@router.get("/google/callback", summary="Google OAuth callback with @medicaps.ac.in validation")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    return await AuthController.google_callback(request, db)


@router.post("/send-otp", summary="Request OTP verification email")
async def send_otp(payload: SendOTPRequest):
    return await AuthController.send_otp(payload)


@router.post("/verify-otp", summary="Verify OTP and receive access token + set auth cookies")
async def verify_otp(
    payload: VerifyOTPRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.verify_otp(payload, db, request=request, response=response)


@router.post("/refresh", summary="Rotate and refresh access token via HttpOnly refresh cookie")
async def refresh_tokens(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.refresh_tokens(request, response, db)


@router.post("/complete-onboarding", summary="Complete new member profile setup")
async def complete_onboarding(
    payload: CompleteOnboardingRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.complete_onboarding(payload, current_member, db)


@router.post("/re-onboard", summary="Reset name if it was auto-set to enrollment ID; triggers fresh onboarding")
async def re_onboard(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows a member whose full_name was incorrectly auto-set to their enrollment ID
    to re-enter the onboarding flow. Only acts if the name matches an enrollment pattern.
    """
    return await AuthController.re_onboard(current_member, db)


@router.put("/profile", summary="Update current member's profile details")
@router.patch("/profile", summary="Update current member's profile details")
async def update_profile(
    payload: UpdateProfileRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.update_profile(payload, current_member, db)


@router.post("/profile/avatar", summary="Upload profile avatar directly to MinIO and update profile")
async def upload_avatar(
    file: UploadFile = File(...),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Directly uploads an avatar image to MinIO S3 and binds it to the authenticated member."""
    return await AuthController.upload_avatar(file, current_member, db)


@router.delete("/profile/avatar", summary="Remove custom profile avatar and revert to initials")
async def remove_avatar(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Removes the member's custom avatar and reverts to initials."""
    return await AuthController.remove_avatar(current_member, db)


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


@router.get("/profile/{handle}", summary="Get public competitive profile of another student cadet")
@router.get("/users/{handle}", summary="Get public competitive profile of another student cadet (alias)")
async def get_student_profile(
    handle: str,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.get_student_public_profile(handle, current_member, db)


@router.get("/check-handle", summary="Check handle availability (unauthenticated)")
async def check_handle(
    handle: str = Query(..., min_length=3, max_length=40, description="Handle to check"),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.check_handle(handle, db)


@router.delete("/me", summary="Permanently delete authenticated member account")
async def delete_account(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await AuthController.delete_account(current_member, db)


@router.post("/logout", summary="Invalidate session, revoke refresh token, and clear auth cookies")
async def logout(
    request: Request,
    response: Response,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    return await AuthController.logout(request, response, current_member)


@router.get("/jwt-public-key", summary="Get RSA 256 public key for asymmetric token verification")
async def get_jwt_public_key():
    """Return the public RSA 256 key used to verify signatures issued by this server."""
    from app.core.config import settings
    return {
        "algorithm": "RS256",
        "public_key": settings.JWT_PUBLIC_KEY,
    }
