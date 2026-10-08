"""
Chaos Computer Club — Medi-Caps Chapter
modules/storage/storage_controller.py — Thin HTTP Controller for MinIO Object Storage
"""

from typing import Any, Dict
from fastapi import UploadFile

from app.models.db_models import MemberProfile
from app.modules.storage.storage_app_service import StorageAppService


class StorageController:
    """Thin HTTP Controller for MinIO storage uploads, presigned URLs, and asset delivery."""

    @staticmethod
    def get_storage_status() -> Dict[str, Any]:
        return StorageAppService.get_storage_status()

    @staticmethod
    async def upload_media_file(
        file: UploadFile,
        prefix: str,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        return await StorageAppService.upload_media_file(
            file=file,
            prefix=prefix,
            current_member=current_member,
        )

    @staticmethod
    def get_presigned_upload_url(
        filename: str,
        content_type: str,
        prefix: str,
        expires_minutes: int,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        return StorageAppService.get_presigned_upload_url(
            filename=filename,
            content_type=content_type,
            prefix=prefix,
            expires_minutes=expires_minutes,
            current_member=current_member,
        )

    @staticmethod
    def get_presigned_download_url(
        object_name: str,
        expires_minutes: int,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        return StorageAppService.get_presigned_download_url(
            object_name=object_name,
            expires_minutes=expires_minutes,
            current_member=current_member,
        )

    @staticmethod
    def delete_media_file(
        object_name: str,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        return StorageAppService.delete_media_file(
            object_name=object_name,
            current_member=current_member,
        )
