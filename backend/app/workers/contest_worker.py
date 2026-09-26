"""
Chaos Computer Club — Medi-Caps Chapter
workers/contest_worker.py — Contest Lifecycle & Batch Rating Application Worker
Protected by distributed locking to prevent duplicate Elo calculations or seat double-booking.
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, NonRetryableError, RetryableError
from app.core.queue.lock import distributed_lock
from app.models.db_models import OfflineContest

logger = logging.getLogger("ccc.worker.contest")


class ContestLifecycleWorker(BaseQueueWorker):
    queue_name = "contest_lifecycle"
    default_concurrency = 2
    job_timeout_seconds = 120.0

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        job_type = job.job_type
        payload = job.payload

        if job_type == "FINALIZE_CONTEST_RATINGS":
            return await self._finalize_contest_ratings(payload, db)
        elif job_type == "QUALIFY_TOP_30_SWEEP":
            return await self._qualify_top_30_sweep(payload, db)

        raise NonRetryableError(f"Unknown job_type '{job_type}' for contest lifecycle worker.")

    async def _finalize_contest_ratings(self, payload: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        from app.services.dynamic_contest_service import DynamicContestService
        from app.services.event_broadcaster import broadcast_event

        slug = payload.get("contest_slug")
        if not slug:
            raise NonRetryableError("Missing 'contest_slug' in FINALIZE_CONTEST_RATINGS payload.")

        # Distributed Lock: Ensure exactly one worker processes final ratings for this contest
        lock_key = f"contest:finalize:{slug}"
        async with distributed_lock(lock_key, ttl_seconds=90) as acquired:
            if not acquired:
                logger.warning("Contest finalization lock '%s' is held by another worker. Skipping duplicate run.", lock_key)
                return {"status": "skipped", "message": "Finalization already in progress by another worker."}

            contest_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
            contest = contest_res.scalars().first()
            if not contest:
                raise NonRetryableError(f"Contest '{slug}' not found.")

            logger.info("🏆 [ContestWorker] Applying final Elo ratings for contest '%s'", slug)
            rating_summary = await DynamicContestService._apply_final_ratings(contest, db)
            await db.commit()

            # Invalidate all affected caches
            await DynamicContestService._invalidate_contest_caches(include_rating_caches=True)

            # Broadcast SSE notification
            try:
                concluded_event_data = DynamicContestService._contest_event_data(contest, "concluded")
                concluded_event_data.update({
                    "status": "finished",
                    "rating_summary": rating_summary,
                })
                await broadcast_event("contest_concluded", concluded_event_data, contest_slug=slug)
                await broadcast_event("contest_concluded", concluded_event_data, contest_slug=None)
                await broadcast_event("leaderboard_updated", concluded_event_data, contest_slug=None)
                await broadcast_event("ratings_updated", concluded_event_data, contest_slug=None)
            except Exception as e:
                logger.warning("Error broadcasting concluded event: %s", e)

            return {
                "success": True,
                "contest_slug": slug,
                "rating_summary": rating_summary,
            }

    async def _qualify_top_30_sweep(self, payload: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        from app.services.assessment_service import AssessmentService
        from app.services.event_broadcaster import broadcast_event

        slug = payload.get("contest_slug")
        if not slug:
            raise NonRetryableError("Missing 'contest_slug' in QUALIFY_TOP_30_SWEEP payload.")

        lock_key = f"contest:qualify_top30:{slug}"
        async with distributed_lock(lock_key, ttl_seconds=60) as acquired:
            if not acquired:
                logger.warning("Top 30 qualification lock '%s' is held. Skipping duplicate.", lock_key)
                return {"status": "skipped", "message": "Top 30 qualification already in progress."}

            logger.info("🎖️ [ContestWorker] Executing Top 30 finalist qualification for contest '%s'", slug)
            summary = await AssessmentService.evaluate_and_qualify_top_30(slug, db)
            await db.commit()

            try:
                await broadcast_event("top30_qualified", summary, contest_slug=slug)
            except Exception as e:
                logger.debug("Broadcast top30_qualified error: %s", e)

            return {
                "success": True,
                "contest_slug": slug,
                "qualification_summary": summary,
            }
