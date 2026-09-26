"""
Chaos Computer Club — Medi-Caps Chapter
modules/events/webhook_controller.py — Thin HTTP Controller for Webhooks & Gate Scans
"""

from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.events.webhook_service import WebhookService


class WebhookController:
    """Thin HTTP Controller for inbound hardware gate scans, contest triggers, and outbound webhooks."""

    @staticmethod
    async def handle_gate_scan(
        pass_code_or_qr: str,
        proctor_name: str,
        contest_slug: str,
        db: AsyncSession,
    ) -> Any:
        return await WebhookService.handle_gate_scan(
            pass_code_or_qr=pass_code_or_qr,
            proctor_name=proctor_name,
            contest_slug=contest_slug,
            db=db,
        )

    @staticmethod
    async def handle_contest_event(
        slug: str,
        action: str,
        timer_minutes: int,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await WebhookService.handle_contest_event(
            slug=slug,
            action=action,
            timer_minutes=timer_minutes,
            db=db,
        )

    @staticmethod
    def register_outbound(webhook_url: str) -> Dict[str, Any]:
        return WebhookService.register_outbound(webhook_url=webhook_url)
