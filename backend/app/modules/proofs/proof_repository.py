"""
Chaos Computer Club — Medi-Caps Chapter
modules/proofs/proof_repository.py — Data Persistence Repository for Trust Proofs & Ledgers
"""

import logging
from typing import Optional, Sequence, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import TrustProof

logger = logging.getLogger(__name__)


class ProofRepository:
    """Encapsulates SQL persistence and queries for cryptographic contest trust proofs."""

    @staticmethod
    async def list_proofs(
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[Sequence[TrustProof], int]:
        total_count = await db.scalar(select(func.count(TrustProof.id))) or 0
        stmt = select(TrustProof).order_by(TrustProof.issued_at.desc()).limit(limit).offset(offset)
        res = await db.execute(stmt)
        return res.scalars().all(), total_count

    @staticmethod
    async def get_by_certificate_id(db: AsyncSession, certificate_id: str) -> Optional[TrustProof]:
        stmt = select(TrustProof).where(TrustProof.certificate_id == certificate_id)
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def get_by_sha256(db: AsyncSession, sha256_digest: str) -> Optional[TrustProof]:
        stmt = select(TrustProof).where(TrustProof.sha256_digest == sha256_digest)
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def find_by_query(db: AsyncSession, query: str) -> Optional[TrustProof]:
        stmt = select(TrustProof).where(
            or_(
                TrustProof.certificate_id == query,
                TrustProof.sha256_digest == query,
                TrustProof.session_uuid == query,
            )
        )
        res = await db.execute(stmt)
        return res.scalars().first()
