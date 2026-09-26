"""
Chaos Computer Club — Medi-Caps Chapter
modules/events/webhook_service.py — Inbound Turnstile Scans & Outbound Webhook Service
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import delete_cache_pattern
from app.modules.contests.contest_repository import ContestRepository
from app.services.pass_service import PassService
from app.services.event_broadcaster import broadcast_event, register_outbound_webhook

logger = logging.getLogger(__name__)


class WebhookService:
    """Handles inbound hardware gate scans, contest lifecycle events, and outbound webhooks."""

    @staticmethod
    async def handle_gate_scan(
        pass_code_or_qr: str,
        proctor_name: str,
        contest_slug: str,
        db: AsyncSession,
    ) -> Any:
        res = await PassService.verify_and_check_in(
            raw_input=pass_code_or_qr,
            proctor_name=proctor_name or "Hardware Gate Turnstile",
            contest_slug=contest_slug,
            db=db,
        )

        if res.valid:
            await broadcast_event(
                event_type="pass_checked_in",
                data={
                    "pass_code": res.pass_code,
                    "seat_number": res.seat_number,
                    "candidate_name": res.candidate_name,
                    "handle": res.handle,
                    "department": res.department,
                    "checked_in_at": res.checked_in_at.isoformat() if res.checked_in_at else None,
                    "checked_in_by": res.checked_in_by,
                    "status": res.status,
                },
                contest_slug=res.contest_slug or contest_slug,
            )

        return res

    @staticmethod
    async def handle_contest_event(
        slug: str,
        action: str,
        timer_minutes: int,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if action == "start_live":
            from app.services.dynamic_contest_service import DynamicContestService
            await DynamicContestService.change_contest_status(slug, "live", db)
            await broadcast_event(
                event_type="contest_status_changed",
                data={"status": "live", "contest_title": contest.title},
                contest_slug=slug,
            )
            return {"success": True, "message": f"Contest {slug} transitioned to LIVE."}

        elif action == "finish":
            from app.services.dynamic_contest_service import DynamicContestService
            await DynamicContestService.change_contest_status(slug, "finished", db)
            await broadcast_event(
                event_type="contest_status_changed",
                data={"status": "finished", "contest_title": contest.title},
                contest_slug=slug,
            )
            return {"success": True, "message": f"Contest {slug} marked FINISHED."}

        elif action == "reset_timer":
            new_ends = datetime.now(timezone.utc) + timedelta(minutes=timer_minutes or 90)
            contest.ends_at = new_ends
            await db.commit()
            await delete_cache_pattern("cache:contest*")

            await broadcast_event(
                event_type="arena_timer_reset",
                data={"remaining_seconds": (timer_minutes or 90) * 60, "ends_at": new_ends.isoformat()},
                contest_slug=slug,
            )
            return {"success": True, "message": f"Contest {slug} timer reset to {timer_minutes} minutes."}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action '{action}'")

    @staticmethod
    def register_outbound(webhook_url: str) -> Dict[str, Any]:
        register_outbound_webhook(webhook_url)
        return {"success": True, "message": f"Webhook '{webhook_url}' registered successfully."}
