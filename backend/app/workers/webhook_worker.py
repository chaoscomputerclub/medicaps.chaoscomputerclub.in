"""
Chaos Computer Club — Medi-Caps Chapter
workers/webhook_worker.py — Outbound Webhook Delivery Worker with HMAC Signatures & Retries
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Dict
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, NonRetryableError, RetryableError

logger = logging.getLogger("ccc.worker.webhooks")


class WebhookWorker(BaseQueueWorker):
    queue_name = "webhooks"
    default_concurrency = 5
    job_timeout_seconds = 12.0

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        job_type = job.job_type
        payload = job.payload

        if job_type == "DISPATCH_OUTBOUND_WEBHOOK":
            url = payload.get("url")
            event_type = payload.get("event_type", "generic")
            data = payload.get("data", {})
            secret = payload.get("secret", "ccc-secret-signature-token")

            if not url:
                raise NonRetryableError("Missing webhook destination 'url'.")

            body_str = json.dumps({
                "event": event_type,
                "timestamp": job.created_at,
                "correlation_id": job.correlation_id,
                "data": data,
            })

            # Generate HMAC-SHA256 signature
            signature = hmac.new(
                secret.encode("utf-8"),
                body_str.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            headers = {
                "Content-Type": "application/json",
                "User-Agent": "CCC-MediCaps-Webhook/2.0",
                "X-CCC-Event": event_type,
                "X-CCC-Signature-256": signature,
                "X-Correlation-ID": job.correlation_id or "",
            }

            logger.info("📡 [WebhookWorker] Dispatching '%s' event to %s", event_type, url)

            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(url, content=body_str, headers=headers)
                    if 200 <= resp.status_code < 300:
                        return {
                            "delivered": True,
                            "url": url,
                            "status_code": resp.status_code,
                        }
                    elif 400 <= resp.status_code < 500:
                        raise NonRetryableError(
                            f"Webhook recipient {url} rejected with HTTP {resp.status_code}: {resp.text[:200]}"
                        )
                    else:
                        raise RetryableError(
                            f"Webhook recipient {url} returned HTTP {resp.status_code}"
                        )
            except httpx.RequestError as exc:
                raise RetryableError(f"Network error delivering webhook to {url}: {exc}")

        raise NonRetryableError(f"Unknown job_type '{job_type}' for webhook worker.")
