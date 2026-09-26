"""
Chaos Computer Club — Medi-Caps Chapter
controllers/auth_controller.py — Facade redirecting to Modular Monolith Auth Module
"""

from app.modules.auth.auth_controller import AuthController
from app.modules.auth.auth_service import AuthService
from app.modules.auth.otp_service import is_allowed_organization_email
from app.modules.members.member_mapper import to_member_public as _to_member_public
from app.modules.members.member_service import _extract_minio_avatar_object

__all__ = [
    "AuthController",
    "AuthService",
    "_to_member_public",
    "is_allowed_organization_email",
    "_extract_minio_avatar_object",
]
