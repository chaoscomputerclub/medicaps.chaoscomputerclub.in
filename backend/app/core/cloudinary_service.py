"""
Chaos Computer Club India — Medi-Caps Chapter
Cloudinary Enterprise Media Service
Provides cryptographically signed direct uploads, strict MIME magic-byte validation,
dynamic transformations, and deletion management.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from typing import Any, Dict, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger("ccc.storage.cloudinary")

ALLOWED_MIME_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
    "image/gif": [b"GIF87a", b"GIF89a"],
}

MAX_MEDIA_BYTES = 5 * 1024 * 1024  # 5 MB hard limit


def validate_image_bytes(data: bytes, reported_mime: Optional[str] = None) -> str:
    """
    Validate binary magic bytes to guarantee file is an authentic, safe image.
    Never trusts client-reported Content-Type alone.
    """
    if len(data) > MAX_MEDIA_BYTES:
        raise ValueError(f"File size ({len(data)} bytes) exceeds 5MB limit.")

    detected_mime: Optional[str] = None
    for mime, signatures in ALLOWED_MIME_TYPES.items():
        for sig in signatures:
            if data.startswith(sig):
                if mime == "image/webp":
                    # WebP has RIFF at 0 and WEBP at byte 8
                    if len(data) >= 12 and data[8:12] == b"WEBP":
                        detected_mime = mime
                        break
                else:
                    detected_mime = mime
                    break
        if detected_mime:
            break

    if not detected_mime:
        raise ValueError("Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF.")

    return detected_mime


class CloudinaryService:
    """Manages signed uploads, direct client upload tokens, and asset URLs."""

    def __init__(self) -> None:
        self.cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
        self.api_key = os.getenv("CLOUDINARY_API_KEY", "")
        self.api_secret = os.getenv("CLOUDINARY_API_SECRET", "")
        self.upload_preset = os.getenv("CLOUDINARY_UPLOAD_PRESET", "ccc_avatars")

    @property
    def is_configured(self) -> bool:
        return bool(self.cloud_name and self.api_key and self.api_secret)

    def generate_upload_signature(
        self,
        folder: str = "avatars",
        tags: Optional[str] = None,
        public_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates HMAC-SHA1 signature and params for direct browser-to-Cloudinary upload.
        Eliminates proxying heavy media bytes through FastAPI.
        """
        if not self.is_configured:
            raise RuntimeError("Cloudinary is not configured on this environment.")

        timestamp = int(time.time())
        params_to_sign: Dict[str, Any] = {
            "folder": folder,
            "timestamp": timestamp,
        }
        if tags:
            params_to_sign["tags"] = tags
        if public_id:
            params_to_sign["public_id"] = public_id

        # Sort alphabetically and format query string as required by Cloudinary spec
        sorted_params = sorted(params_to_sign.items())
        serialized = "&".join(f"{k}={v}" for k, v in sorted_params)
        to_sign = f"{serialized}{self.api_secret}"

        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        return {
            "cloud_name": self.cloud_name,
            "api_key": self.api_key,
            "timestamp": timestamp,
            "signature": signature,
            "folder": folder,
            "upload_url": f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/upload",
            "params": params_to_sign,
        }

    async def upload_image(
        self,
        file_bytes: bytes,
        filename: str,
        folder: str = "avatars",
        owner_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Direct server-side upload to Cloudinary with MIME verification.
        """
        if not self.is_configured:
            raise RuntimeError("Cloudinary is not configured.")

        mime = validate_image_bytes(file_bytes)
        timestamp = int(time.time())
        public_id = f"{folder}/{owner_id or 'anon'}_{hashlib.sha256(file_bytes).hexdigest()[:12]}"

        params_to_sign = {
            "folder": folder,
            "public_id": public_id,
            "timestamp": timestamp,
        }
        sorted_params = sorted(params_to_sign.items())
        serialized = "&".join(f"{k}={v}" for k, v in sorted_params)
        to_sign = f"{serialized}{self.api_secret}"
        signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

        upload_url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/upload"

        data = {
            "api_key": self.api_key,
            "timestamp": str(timestamp),
            "folder": folder,
            "public_id": public_id,
            "signature": signature,
        }
        files = {
            "file": (filename, file_bytes, mime)
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(upload_url, data=data, files=files)
            if resp.status_code != 200:
                logger.error("Cloudinary upload failed: %s %s", resp.status_code, resp.text)
                raise RuntimeError(f"Cloudinary upload failed: {resp.text}")

            payload = resp.json()
            return {
                "public_id": payload.get("public_id"),
                "secure_url": payload.get("secure_url"),
                "format": payload.get("format"),
                "bytes": payload.get("bytes"),
                "width": payload.get("width"),
                "height": payload.get("height"),
            }

    def get_transformed_url(
        self,
        public_id: str,
        width: int = 256,
        height: int = 256,
        crop: str = "fill",
        gravity: str = "face",
    ) -> str:
        """
        Derives optimized WebP/AVIF CDN URL with dynamic resizing.
        """
        if not self.is_configured or not public_id:
            return ""
        clean_id = public_id.lstrip("/")
        return (
            f"https://res.cloudinary.com/{self.cloud_name}/image/upload/"
            f"w_{width},h_{height},c_{crop},g_{gravity},f_auto,q_auto/{clean_id}"
        )


cloudinary_service = CloudinaryService()
