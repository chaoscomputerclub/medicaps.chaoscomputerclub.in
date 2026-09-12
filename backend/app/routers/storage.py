"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Storage Router: MinIO Object Storage & Media Upload Management
"""

import os
import logging
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query

from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.core.storage import storage_service
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storage", tags=["MinIO Object Storage & Media"])

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


class PresignedUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field("image/jpeg")
    prefix: str = Field("avatars", max_length=50)
    expires_minutes: int = Field(15, ge=1, le=120)


@router.get("/status")
async def get_storage_status():
    """Returns MinIO object storage health, target bucket, and CDN prefix."""
    return {
        "status": "online",
        "storage": "MinIO S3",
        "bucket": settings.MINIO_BUCKET_NAME,
        "public_url_prefix": settings.MINIO_PUBLIC_URL_PREFIX,
        "max_size_mb": MAX_FILE_SIZE_BYTES // (1024 * 1024),
    }


@router.post("/upload")
async def upload_media_file(
    file: UploadFile = File(...),
    prefix: str = Form("avatars"),
    current_member: MemberProfile = Depends(get_current_member),
):
    """
    Directly uploads an image or file asset to the MinIO cluster.
    Returns both unsigned public CDN URL and 24h cryptographically signed URL.
    """
    # 1. Validate MIME type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed types: {', '.join(ALLOWED_MIME_TYPES.keys())}",
        )

    # 2. Read and validate file size
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

    # 3. Clean prefix
    safe_prefix = prefix.strip().replace("..", "").strip("/") or "uploads"
    if safe_prefix.startswith("avatars"):
        safe_prefix = "avatars"

    # 4. Upload to MinIO
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


@router.post("/presigned-upload")
async def get_presigned_upload_url(
    payload: PresignedUploadRequest,
    current_member: MemberProfile = Depends(get_current_member),
):
    """
    Generates a secure presigned PUT URL allowing direct browser-to-MinIO uploads.
    """
    if payload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type '{payload.content_type}' is not permitted.",
        )

    safe_prefix = payload.prefix.strip().replace("..", "").strip("/") or "uploads"

    try:
        result = storage_service.generate_presigned_upload_url(
            filename=payload.filename,
            content_type=payload.content_type,
            prefix=safe_prefix,
            expires_minutes=payload.expires_minutes,
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


@router.get("/presigned-url")
async def get_presigned_download_url(
    object_name: str = Query(..., min_length=1),
    expires_minutes: int = Query(60, ge=1, le=1440),
    current_member: MemberProfile = Depends(get_current_member),
):
    """
    Generates a signed GET URL for temporary private/authenticated object access.
    """
    clean_object = object_name.strip().lstrip("/")
    signed_url = storage_service.generate_presigned_get_url(
        object_name=clean_object,
        expires_minutes=expires_minutes,
    )

    return {
        "status": "success",
        "data": {
            "object_name": clean_object,
            "signed_url": signed_url,
            "expires_seconds": expires_minutes * 60,
        },
    }
