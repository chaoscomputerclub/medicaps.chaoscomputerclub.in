"""
Chaos Computer Club — Medi-Caps Chapter
modules/proofs/proof_service.py — Cryptographic Proof Verification Application Service
"""

import logging
from typing import List
from fastapi import HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.schemas import TrustProofResponse, VerifyRequest, VerifyResponse
from app.lib.cache_keys import proofs_list_cache_key, TTL_PROOFS
from app.lib.pagination import normalize_pagination, inject_pagination_headers
from app.modules.proofs.proof_repository import ProofRepository

logger = logging.getLogger(__name__)


class ProofService:
    """Handles cryptographic tamper-proof validation, certificate resolution, and ledger pagination."""

    @staticmethod
    async def list_proofs(
        response: Response,
        limit: int,
        db: AsyncSession,
        offset: int = 0,
    ) -> List[TrustProofResponse]:
        safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=500)
        cache_key = f"{proofs_list_cache_key(safe_limit)}:off_{safe_offset}"
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_PROOFS}, stale-while-revalidate=60"
            if isinstance(cached, dict) and "items" in cached:
                inject_pagination_headers(response, cached.get("total", len(cached["items"])), safe_limit, safe_offset)
                return cached["items"]
            return cached

        records, total_count = await ProofRepository.list_proofs(db, limit=safe_limit, offset=safe_offset)
        inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        payload = [TrustProofResponse.model_validate(r).model_dump() for r in records]
        await set_cache(cache_key, {"items": payload, "total": total_count}, ttl_seconds=TTL_PROOFS)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_PROOFS}, stale-while-revalidate=60"
        return records

    @staticmethod
    async def verify_by_certificate(
        certificate_id: str,
        db: AsyncSession,
    ) -> TrustProofResponse:
        proof = await ProofRepository.get_by_certificate_id(db, certificate_id)
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
        proof = await ProofRepository.get_by_sha256(db, sha256_digest)
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
        proof = await ProofRepository.find_by_query(db, query)
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
