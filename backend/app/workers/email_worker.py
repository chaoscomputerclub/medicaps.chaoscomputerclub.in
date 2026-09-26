"""
Chaos Computer Club — Medi-Caps Chapter
workers/email_worker.py — Asynchronous Email Delivery Worker
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, NonRetryableError, RetryableError
from app.utils.email import send_otp_email

logger = logging.getLogger("ccc.worker.email")


class EmailWorker(BaseQueueWorker):
    queue_name = "email"
    default_concurrency = 5
    job_timeout_seconds = 25.0

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        job_type = job.job_type

        if job_type == "SEND_OTP_EMAIL":
            to_email = job.payload.get("to_email", "").strip()
            otp_code = job.payload.get("otp_code", "").strip()

            if not to_email or not otp_code:
                raise NonRetryableError(f"Missing required email parameters: to_email='{to_email}'")

            logger.info("📧 [EmailWorker] Delivering OTP email to %s", to_email)
            success = await send_otp_email(to_email, otp_code)

            if not success:
                raise RetryableError(f"SMTP transport delivery failed for {to_email}")

            return {
                "delivered": True,
                "to_email": to_email,
                "timestamp": job.created_at,
            }

        raise NonRetryableError(f"Unknown job_type '{job_type}' for email worker.")
