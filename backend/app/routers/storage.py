"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/storage.py — Thin HTTP Router for MinIO Object Storage & Media Upload Management
Delegates to app.controllers.storage_controller.StorageController
"""

from typing import Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query

from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.controllers.storage_controller import StorageController

router = APIRouter(prefix="/storage", tags=["MinIO Object Storage & Media"])


class PresignedUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field("image/jpeg")
    prefix: str = Field("avatars", max_length=50)
    expires_minutes: int = Field(15, ge=1, le=120)


@router.get("/status")
async def get_storage_status():
    """Returns MinIO object storage health, target bucket, and CDN prefix."""
    return StorageController.get_storage_status()


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
    return await StorageController.upload_media_file(
        file=file,
        prefix=prefix,
        current_member=current_member,
    )


@router.post("/presigned-upload")
async def get_presigned_upload_url(
    payload: PresignedUploadRequest,
    current_member: MemberProfile = Depends(get_current_member),
):
    """
    Generates a secure presigned PUT URL allowing direct browser-to-MinIO uploads.
    """
    return StorageController.get_presigned_upload_url(
        filename=payload.filename,
        content_type=payload.content_type,
        prefix=payload.prefix,
        expires_minutes=payload.expires_minutes,
        current_member=current_member,
    )


@router.get("/presigned-url")
async def get_presigned_download_url(
    object_name: str = Query(..., min_length=1),
    expires_minutes: int = Query(60, ge=1, le=1440),
    current_member: MemberProfile = Depends(get_current_member),
):
    """
    Generates a signed GET URL for temporary private/authenticated object access.
    """
    return StorageController.get_presigned_download_url(
        object_name=object_name,
        expires_minutes=expires_minutes,
        current_member=current_member,
    )
