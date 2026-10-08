"""
Chaos Computer Club — Medi-Caps Chapter
modules/storage/storage_app_service.py — MinIO Object Storage Application Service
"""

import logging
from typing import Any, Dict
from fastapi import HTTPException, UploadFile, status

from app.models.db_models import MemberProfile
from app.core.storage import storage_service
from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


class StorageAppService:
    """Handles file validation, upload to MinIO, presigned URLs, and asset deletion."""

    @staticmethod
    def get_storage_status() -> Dict[str, Any]:
        return {
            "status": "online",
            "storage": "MinIO S3",
            "bucket": settings.MINIO_BUCKET_NAME,
            "public_url_prefix": settings.MINIO_PUBLIC_URL_PREFIX,
            "max_size_mb": MAX_FILE_SIZE_BYTES // (1024 * 1024),
        }

    @staticmethod
    async def upload_media_file(
        file: UploadFile,
        prefix: str,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{content_type}'. Allowed types: {', '.join(ALLOWED_MIME_TYPES.keys())}",
            )

        try:
            file_bytes = await file.read()
        except Exception as e:
            logger.error(f"Error reading uploaded file: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to read file upload stream.",
            )

        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
            )

        safe_prefix = prefix.strip().replace("..", "").strip("/") or "uploads"
        if safe_prefix.startswith("avatars"):
            safe_prefix = "avatars"

        try:
            result = storage_service.upload_file(
                file_bytes=file_bytes,
                filename=file.filename or "upload.bin",
                content_type=content_type,
                prefix=safe_prefix,
            )
        except Exception as e:
            logger.error(f"Failed to upload to MinIO: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store media file in object storage.",
            )

        return {
            "status": "success",
            "message": "File uploaded successfully",
            "data": result,
        }

    @staticmethod
    def get_presigned_upload_url(
        filename: str,
        content_type: str,
        prefix: str,
        expires_minutes: int,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Content type '{content_type}' is not permitted.",
            )

        safe_prefix = prefix.strip().replace("..", "").strip("/") or "uploads"

        try:
            result = storage_service.generate_presigned_upload_url(
                filename=filename,
                content_type=content_type,
                prefix=safe_prefix,
                expires_minutes=expires_minutes,
            )
        except Exception as e:
            logger.error(f"Error generating presigned upload URL: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate presigned upload URL.",
            )

        return {
            "status": "success",
            "data": result,
        }

    @staticmethod
    def get_presigned_download_url(
        object_name: str,
        expires_minutes: int,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        safe_object = object_name.strip().replace("..", "").strip("/")
        try:
            result = storage_service.generate_presigned_download_url(
                object_name=safe_object,
                expires_minutes=expires_minutes,
            )
        except Exception as e:
            logger.error(f"Error generating presigned download URL: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate presigned download URL.",
            )

        return {
            "status": "success",
            "data": result,
        }

    @staticmethod
    def delete_media_file(
        object_name: str,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        safe_object = object_name.strip().replace("..", "").strip("/")
        try:
            success = storage_service.delete_file(safe_object)
        except Exception as e:
            logger.error(f"Error deleting file from MinIO: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete object from storage.",
            )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Object '{safe_object}' was not found in storage.",
            )

        return {
            "status": "success",
            "message": f"Object '{safe_object}' deleted successfully",
        }
