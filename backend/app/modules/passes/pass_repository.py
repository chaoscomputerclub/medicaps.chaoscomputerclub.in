"""
Chaos Computer Club — Medi-Caps Chapter
modules/passes/pass_repository.py — Data Persistence Repository for Campus Passes & Attendance
"""

import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import CampusPass

logger = logging.getLogger(__name__)


class PassRepository:
    """Encapsulates SQL persistence and queries for single-use campus entrance passes."""

    @staticmethod
    async def get_by_code(db: AsyncSession, clean_code: str) -> Optional[CampusPass]:
        stmt = select(CampusPass).where(CampusPass.pass_code == clean_code)
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def get_by_member_and_contest(
        db: AsyncSession,
        member_id: str,
        contest_id: str,
    ) -> Optional[CampusPass]:
        stmt = select(CampusPass).where(
            CampusPass.member_id == member_id,
            CampusPass.contest_id == contest_id,
        )
        res = await db.execute(stmt)
        return res.scalars().first()
