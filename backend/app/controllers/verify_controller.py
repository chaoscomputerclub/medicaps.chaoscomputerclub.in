"""
Chaos Computer Club — Medi-Caps Chapter
controllers/verify_controller.py — Trust-of-Proof Verification Orchestration Controller
"""

from typing import List
from fastapi import HTTPException, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.db_models import TrustProof
from app.models.schemas import TrustProofResponse, VerifyRequest, VerifyResponse
from app.lib.cache_keys import proofs_list_cache_key, TTL_PROOFS


class VerifyController:
    """Orchestrator for cryptographic trust proof verification and public ledgers."""

    @staticmethod
    async def list_proofs(
        response: Response,
        limit: int,
        db: AsyncSession,
    ) -> List[TrustProofResponse]:
        cache_key = proofs_list_cache_key(limit)
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_PROOFS}, stale-while-revalidate=60"
            return cached

        stmt = select(TrustProof).order_by(TrustProof.issued_at.desc()).limit(limit)
        res = await db.execute(stmt)
        records = res.scalars().all()

        payload = [TrustProofResponse.model_validate(r).model_dump() for r in records]
        await set_cache(cache_key, payload, ttl_seconds=TTL_PROOFS)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_PROOFS}, stale-while-revalidate=60"
        return records

    @staticmethod
    async def verify_by_certificate(
        certificate_id: str,
        db: AsyncSession,
    ) -> TrustProofResponse:
        stmt = select(TrustProof).where(TrustProof.certificate_id == certificate_id)
        result = await db.execute(stmt)
        proof = result.scalars().first()
        if not proof:
            raise HTTPException(
                status_code=404,
                detail=f"Certificate '{certificate_id}' not found or has been revoked.",
            )
        return proof

    @staticmethod
    async def verify_by_digest(
        sha256_digest: str,
        db: AsyncSession,
    ) -> TrustProofResponse:
        stmt = select(TrustProof).where(TrustProof.sha256_digest == sha256_digest)
        result = await db.execute(stmt)
        proof = result.scalars().first()
        if not proof:
            raise HTTPException(
                status_code=404,
                detail="No contest result matches this cryptographic SHA-256 digest.",
            )
        return proof

    @staticmethod
    async def verify_general(
        req: VerifyRequest,
        db: AsyncSession,
    ) -> VerifyResponse:
        query = req.certificate_id_or_hash.strip()
        stmt = select(TrustProof).where(
            or_(
                TrustProof.certificate_id == query,
                TrustProof.sha256_digest == query,
                TrustProof.session_uuid == query,
            )
        )
        result = await db.execute(stmt)
        proof = result.scalars().first()
        if not proof:
            return VerifyResponse(
                is_valid=False,
                proof=None,
                message="No verified physical contest record matches the provided token.",
            )

        return VerifyResponse(
            is_valid=True,
            proof=TrustProofResponse.model_validate(proof),
            message="Cryptographic proof verified. Result is authentic and tamper-proof.",
        )
