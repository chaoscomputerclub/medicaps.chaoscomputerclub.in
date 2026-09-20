"""
Chaos Computer Club — Medi-Caps Chapter
controllers/admin_qa_controller.py — Admin QA & Tournament Simulation Orchestration Controller
"""

import logging
from typing import Any, Dict, Optional
from app.services.qa_test_service import ProductionQAService, QAAuditReport
from app.services.tournament_qa_service import TournamentQAService
from app.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)

_LATEST_QA_REPORT: Optional[QAAuditReport] = None


class AdminQAController:
    """Orchestrator for automated QA audits, regression testing, and tournament simulation."""

    @staticmethod
    async def run_qa_audit(base_url: Optional[str] = None) -> QAAuditReport:
        global _LATEST_QA_REPORT
        logger.info(f"⚡ Initiating on-demand QA audit run (Target: {base_url or 'In-Process'})...")
        report = await ProductionQAService.run_full_qa_audit(base_url=base_url)
        _LATEST_QA_REPORT = report
        return report

    @staticmethod
    async def get_latest_qa_report() -> QAAuditReport:
        global _LATEST_QA_REPORT
        if not _LATEST_QA_REPORT:
            _LATEST_QA_REPORT = await ProductionQAService.run_full_qa_audit()
        return _LATEST_QA_REPORT

    @staticmethod
    async def get_latest_qa_markdown() -> Dict[str, str]:
        global _LATEST_QA_REPORT
        if not _LATEST_QA_REPORT:
            _LATEST_QA_REPORT = await ProductionQAService.run_full_qa_audit()
        md_content = ProductionQAService.generate_markdown_report(_LATEST_QA_REPORT)
        return {"audit_id": _LATEST_QA_REPORT.audit_id, "markdown": md_content}

    @staticmethod
    async def simulate_tournament(
        cadet_count: int,
        contest_count: int,
        primary_handle: str,
        primary_email: str,
        primary_name: str,
        primary_prn: str,
    ) -> Dict[str, Any]:
        logger.info("⚡ [QA ADMIN] Executing 50-contest tournament simulation...")
        async with AsyncSessionLocal() as db:
            result = await TournamentQAService.simulate_50_contests(
                db=db,
                cadet_count=cadet_count,
                contest_count=contest_count,
                primary_handle=primary_handle,
                primary_email=primary_email,
                primary_name=primary_name,
                primary_prn=primary_prn,
            )
        return result
