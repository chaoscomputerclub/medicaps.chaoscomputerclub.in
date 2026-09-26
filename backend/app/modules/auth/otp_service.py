"""
Chaos Computer Club — Medi-Caps Chapter
modules/auth/otp_service.py — Cryptographic OTP & Email Dispatch Service
"""

import asyncio
import logging
from typing import Optional, Set
from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.cloudflare import get_client_ip, verify_turnstile_token
from app.lib.otp import generate_otp
from app.utils.otp_store import send_otp as redis_send_otp, verify_otp as redis_verify_otp
from app.utils.email import send_otp_email

logger = logging.getLogger(__name__)

# Track active background email tasks to prevent premature garbage collection
_bg_otp_tasks: Set[asyncio.Task] = set()


def is_allowed_organization_email(email: str) -> bool:
    """Institutional access restriction: strictly Medi-Caps University emails (@medicaps.ac.in)."""
    if not email or "@" not in email:
        return False
    domain = email.split("@")[1].strip().lower()
    return domain == "medicaps.ac.in"


class OtpService:
    """Manages OTP lifecycle, Cloudflare Turnstile bot verification, and background SMTP delivery."""

    @staticmethod
    async def request_otp(
        email: str,
        turnstile_token: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> dict:
        clean_email = email.strip().lower()
        if not clean_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required.")

        if not is_allowed_organization_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Only @medicaps.ac.in organization emails are permitted. Gmail and personal accounts are strictly prohibited.",
            )

        client_ip = get_client_ip(request) if request else None
        if settings.CLOUDFLARE_TURNSTILE_ENABLED and not settings.DEV_MODE:
            is_valid = await verify_turnstile_token(turnstile_token, remote_ip=client_ip)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cloudflare client security verification failed. Please complete the bot challenge.",
                )

        otp = generate_otp()
        result = await redis_send_otp(clean_email, otp)
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create OTP session. Please try again.",
            )

        # Dispatch SMTP delivery asynchronously through high-priority email queue
        job_id = None
        try:
            from app.core.queue import RedisQueueEngine, JobPriority
            job = await RedisQueueEngine.enqueue(
                queue_name="email",
                job_type="SEND_OTP_EMAIL",
                payload={"to_email": clean_email, "otp_code": otp},
                priority=JobPriority.HIGH,
                idempotency_key=f"otp:{clean_email}:{result['transaction_id']}",
                max_retries=3,
                backoff_base_seconds=2.0,
            )
            job_id = job.id
        except Exception as exc:
            logger.warning("Queue enqueue fallback for OTP email: %s", exc)
            task = asyncio.create_task(send_otp_email(clean_email, otp))
            _bg_otp_tasks.add(task)
            task.add_done_callback(_bg_otp_tasks.discard)

        logger.info("OTP session created for %s (txn=%s, job_id=%s)", clean_email, result["transaction_id"], job_id)
        return {
            "success": True,
            "sent": True,
            "message": f"Verification code sent to {clean_email}",
            "transaction_id": result["transaction_id"],
            "email": clean_email,
            "job_id": job_id,
        }

    @staticmethod
    async def verify_otp(
        identifier: str,
        otp_code: str,
    ) -> str:
        """
        Verify OTP code against Redis session.
        Returns the verified institutional email address or raises HTTPException.
        """
        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction identifier or institutional email is required.",
            )
        if not otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Six-digit authentication code is required.",
            )

        result = await redis_verify_otp(identifier, otp_code)
        if not result.get("valid"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("reason", "Invalid OTP."),
            )

        email = (result.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Session corrupted. Please restart.")

        if not is_allowed_organization_email(email):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Only @medicaps.ac.in organization emails are permitted.",
            )

        return email
