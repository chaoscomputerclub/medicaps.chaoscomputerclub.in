"""
Chaos Computer Club — Medi-Caps Chapter
Unit & Integration Tests for Cloudinary Service & Cloud Run Service Modes
"""

import pytest
import os
from unittest.mock import patch, MagicMock

from app.core.cloudinary_service import (
    CloudinaryService,
    validate_image_bytes,
    ALLOWED_MIME_TYPES,
)
from app.engine.providers.local_provider import LocalSandboxProvider
from app.engine.providers.base import ProviderRunRequest
from app.core.config import settings


def test_validate_image_bytes_valid_jpeg():
    # Valid JPEG magic bytes \xff\xd8\xff
    valid_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50
    mime = validate_image_bytes(valid_jpeg)
    assert mime == "image/jpeg"


def test_validate_image_bytes_valid_png():
    # Valid PNG magic bytes \x89PNG\r\n\x1a\n
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 50
    mime = validate_image_bytes(valid_png)
    assert mime == "image/png"


def test_validate_image_bytes_valid_webp():
    # Valid WebP RIFF....WEBP
    valid_webp = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 50
    mime = validate_image_bytes(valid_webp)
    assert mime == "image/webp"


def test_validate_image_bytes_rejects_executable_or_html():
    malicious_elf = b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 50
    with pytest.raises(ValueError, match="Invalid image format"):
        validate_image_bytes(malicious_elf)

    html_script = b"<html><script>alert(1)</script></html>"
    with pytest.raises(ValueError, match="Invalid image format"):
        validate_image_bytes(html_script)


def test_validate_image_bytes_rejects_oversized():
    oversized = b"\xff\xd8\xff" + b"\x00" * (6 * 1024 * 1024)
    with pytest.raises(ValueError, match="exceeds 5MB limit"):
        validate_image_bytes(oversized)


def test_cloudinary_signature_generation():
    service = CloudinaryService()
    service.cloud_name = "test-cloud"
    service.api_key = "123456789"
    service.api_secret = "test-secret"

    sig_data = service.generate_upload_signature(folder="avatars", tags="member_1")
    assert sig_data["cloud_name"] == "test-cloud"
    assert sig_data["api_key"] == "123456789"
    assert "signature" in sig_data
    assert len(sig_data["signature"]) == 40  # SHA1 hex digest is 40 chars
    assert sig_data["upload_url"] == "https://api.cloudinary.com/v1_1/test-cloud/image/upload"


@pytest.mark.asyncio
async def test_unsandboxed_local_execution_fail_closed_by_default():
    provider = LocalSandboxProvider()
    with patch.object(settings, "ALLOW_UNSANDBOXED_EXECUTION", False):
        healthy = await provider.healthy()
        assert healthy is False

        req = ProviderRunRequest(
            language="python",
            source_code="print('hello')",
            stdin="",
            expected_output="hello",
        )
        res = await provider.run(req)
        assert res.verdict == "system_error"
        assert any("Unsandboxed local execution is prohibited" in d for d in res.diagnostics)
