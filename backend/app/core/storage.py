"""
Chaos Computer Club India — Medi-Caps Chapter
Enterprise MinIO S3 Object Storage Service
Provides authenticated file uploads, direct public unsigned CDN URLs, and secure presigned URLs.
"""

import io
import os
import re
import uuid
import logging
from datetime import timedelta
from typing import Dict, Any, Optional

from minio import Minio
from minio.error import S3Error
from app.core.config import settings

logger = logging.getLogger(__name__)


class MinioStorageService:
    def __init__(self):
        self.endpoint = settings.MINIO_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self.secure = settings.MINIO_SECURE
        self.public_prefix = settings.MINIO_PUBLIC_URL_PREFIX.rstrip("/")

        self._client: Optional[Minio] = None
        self._bucket_checked = False

    def _get_client(self) -> Minio:
        if self._client is None:
            try:
                self._client = Minio(
                    endpoint=self.endpoint,
                    access_key=self.access_key,
                    secret_key=self.secret_key,
                    secure=self.secure,
                )
                logger.info(f"MinIO storage client connected to {self.endpoint} (bucket: {self.bucket_name})")
            except Exception as e:
                logger.error(f"Failed to initialize MinIO client: {e}")
                raise RuntimeError(f"Storage service unavailable: {e}")

        # Ensure bucket exists
        if not self._bucket_checked:
            try:
                if not self._client.bucket_exists(self.bucket_name):
                    logger.info(f"Bucket {self.bucket_name} does not exist. Creating...")
                    self._client.make_bucket(self.bucket_name)
                self._bucket_checked = True
            except Exception as e:
                logger.warning(f"Could not verify MinIO bucket {self.bucket_name}: {e}")

        return self._client

    def _sanitize_filename(self, filename: str) -> str:
        base = os.path.basename(filename)
        cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", base)
        return cleaned or "file"

    def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        prefix: str = "avatars",
    ) -> Dict[str, Any]:
        """
        Directly uploads a file buffer to MinIO.
        Returns both the public unsigned URL and a signed URL (24h).
        """
        client = self._get_client()
        clean_name = self._sanitize_filename(filename)
        object_name = f"{prefix.strip('/')}/{uuid.uuid4().hex[:12]}_{clean_name}"
        file_stream = io.BytesIO(file_bytes)
        file_size = len(file_bytes)

        try:
            client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=file_stream,
                length=file_size,
                content_type=content_type,
            )
            logger.info(f"Uploaded {object_name} ({file_size} bytes, type={content_type}) to MinIO")
        except S3Error as e:
            logger.error(f"MinIO S3 error uploading {object_name}: {e}")
            raise RuntimeError(f"Failed to store file in MinIO: {e}")
        except Exception as e:
            logger.error(f"Unexpected error uploading to MinIO: {e}")
            raise RuntimeError(f"Storage upload error: {e}")

        public_url = f"{self.public_prefix}/{object_name}"
        signed_url = self.generate_presigned_get_url(object_name, expires_minutes=1440)

        return {
            "bucket": self.bucket_name,
            "object_name": object_name,
            "public_url": public_url,
            "signed_url": signed_url,
            "content_type": content_type,
            "size": file_size,
        }

    def generate_presigned_upload_url(
        self,
        filename: str,
        content_type: str = "image/jpeg",
        prefix: str = "avatars",
        expires_minutes: int = 15,
    ) -> Dict[str, Any]:
        """
        Generates a secure presigned PUT URL allowing the client to upload
        directly to MinIO object storage without proxying through Python.
        """
        client = self._get_client()
        clean_name = self._sanitize_filename(filename)
        object_name = f"{prefix.strip('/')}/{uuid.uuid4().hex[:12]}_{clean_name}"

        try:
            upload_url = client.get_presigned_url(
                method="PUT",
                bucket_name=self.bucket_name,
                object_name=object_name,
                expires=timedelta(minutes=expires_minutes),
            )
        except Exception as e:
            logger.error(f"Error generating presigned upload URL: {e}")
            raise RuntimeError(f"Failed to generate presigned upload URL: {e}")

        public_url = f"{self.public_prefix}/{object_name}"
        return {
            "upload_url": upload_url,
            "object_name": object_name,
            "public_url": public_url,
            "expires_seconds": expires_minutes * 60,
        }

    def generate_presigned_get_url(
        self,
        object_name: str,
        expires_minutes: int = 60,
    ) -> str:
        """
        Generates a secure signed GET URL with expiration for authenticated access.
        """
        client = self._get_client()
        try:
            return client.get_presigned_url(
                method="GET",
                bucket_name=self.bucket_name,
                object_name=object_name,
                expires=timedelta(minutes=expires_minutes),
            )
        except Exception as e:
            logger.warning(f"Error generating presigned get URL for {object_name}: {e}")
            # Fallback to public unsigned URL
            return f"{self.public_prefix}/{object_name}"

    def delete_file(self, object_name: str) -> bool:
        """
        Deletes an object from MinIO bucket.
        """
        client = self._get_client()
        try:
            client.remove_object(self.bucket_name, object_name)
            logger.info(f"Deleted object {object_name} from MinIO")
            return True
        except Exception as e:
            logger.error(f"Failed to delete {object_name} from MinIO: {e}")
            return False


storage_service = MinioStorageService()
