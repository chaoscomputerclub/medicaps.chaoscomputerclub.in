"""
Chaos Computer Club — Medi-Caps Chapter
workers/maintenance_worker.py — Low-Priority Isolated Maintenance & Simulation Worker
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, NonRetryableError

logger = logging.getLogger("ccc.worker.maintenance")


class MaintenanceWorker(BaseQueueWorker):
    queue_name = "maintenance"
    default_concurrency = 1
    job_timeout_seconds = 300.0

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        job_type = job.job_type
        payload = job.payload

        if job_type == "SIMULATE_TOURNAMENT":
            from app.services.tournament_qa_service import TournamentQAService
            logger.info("⚙️ [MaintenanceWorker] Running tournament simulation via worker...")
            result = await TournamentQAService.simulate_50_contests(
                db=db,
                cadet_count=payload.get("cadet_count", 110),
                contest_count=payload.get("contest_count", 50),
                primary_handle=payload.get("primary_handle", "santusht"),
                primary_email=payload.get("primary_email", "santusht.en23@medicaps.ac.in"),
                primary_name=payload.get("primary_name", "Santusht Kotai"),
                primary_prn=payload.get("primary_prn", "EN23CS301927"),
            )
            return result

        elif job_type == "RUN_QA_AUDIT":
            from app.services.qa_test_service import ProductionQAService
            logger.info("⚙️ [MaintenanceWorker] Running full QA audit via worker...")
            report = await ProductionQAService.run_full_qa_audit(base_url=payload.get("base_url"))
            return report.to_dict()

        raise NonRetryableError(f"Unknown job_type '{job_type}' for maintenance worker.")
