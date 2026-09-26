"""
Chaos Computer Club — Medi-Caps Chapter
modules/auth/auth_controller.py — Thin HTTP Orchestrator for Authentication
"""

from typing import Optional
from fastapi import Request, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile
from app.schemas.auth import (
    SendOTPRequest,
    SendOTPResponse,
    VerifyOTPRequest,
    AuthTokenResponse,
    CompleteOnboardingRequest,
    UpdateProfileRequest,
)
from app.modules.auth.auth_service import AuthService
from app.modules.auth.oauth_service import OAuthService
from app.modules.members.member_service import MemberService


class AuthController:
    """Thin controller delegating authentication and user identity to domain services."""

    @staticmethod
    async def send_otp(payload: SendOTPRequest, request: Optional[Request] = None) -> SendOTPResponse:
        return await AuthService.send_otp(payload, request)

    @staticmethod
    async def verify_otp(
        payload: VerifyOTPRequest,
        db: AsyncSession,
        request: Optional[Request] = None,
        response: Optional[Response] = None,
    ) -> AuthTokenResponse:
        return await AuthService.verify_otp(payload, db, request, response)

    @staticmethod
    async def complete_onboarding(
        payload: CompleteOnboardingRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        return await AuthService.complete_onboarding(payload, current_member, db)

    @staticmethod
    async def re_onboard(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        return await AuthService.re_onboard(current_member, db)

    @staticmethod
    async def update_profile(
        payload: UpdateProfileRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        return await MemberService.update_profile(payload, current_member, db)

    @staticmethod
    async def upload_avatar(
        file: UploadFile,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        return await MemberService.upload_avatar(file, current_member, db)

    @staticmethod
    async def remove_avatar(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        return await MemberService.remove_avatar(current_member, db)

    @staticmethod
    async def get_full_profile(current_member: MemberProfile, db: AsyncSession) -> dict:
        return await MemberService.get_full_profile(current_member, db)

    @staticmethod
    async def get_student_public_profile(
        handle_or_id: str,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> dict:
        return await MemberService.get_student_public_profile(handle_or_id, current_member, db)

    @staticmethod
    async def check_handle(handle: str, db: AsyncSession) -> dict:
        return await AuthService.check_handle(handle, db)

    @staticmethod
    async def delete_account(
        current_member: MemberProfile,
        db: AsyncSession,
        request: Optional[Request] = None,
        response: Optional[Response] = None,
    ) -> dict:
        return await MemberService.delete_account(current_member, db, request, response)

    @staticmethod
    async def google_login(request: Request):
        return OAuthService.initiate_google_login(request)

    @staticmethod
    async def google_callback(request: Request, db: AsyncSession):
        return await OAuthService.process_google_callback(request, db)

    @staticmethod
    async def refresh_tokens(
        request: Request,
        response: Response,
        db: AsyncSession,
    ) -> dict:
        return await AuthService.refresh_tokens(request, response, db)

    @staticmethod
    async def logout(
        request: Request,
        response: Response,
        current_member: Optional[MemberProfile] = None,
    ) -> dict:
        return await AuthService.logout(request, response, current_member)
