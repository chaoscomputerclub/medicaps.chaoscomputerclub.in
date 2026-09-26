"""
Chaos Computer Club — Medi-Caps Chapter
modules/proofs/proof_controller.py — Thin HTTP Controller for Trust Proof Verification
"""

from typing import List
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import TrustProofResponse, VerifyRequest, VerifyResponse
from app.modules.proofs.proof_service import ProofService


class VerifyController:
    """Thin HTTP Controller for cryptographic trust proof verification and public ledgers."""

    @staticmethod
    async def list_proofs(
        response: Response,
        limit: int,
        db: AsyncSession,
        offset: int = 0,
    ) -> List[TrustProofResponse]:
        return await ProofService.list_proofs(
            response=response,
            limit=limit,
            db=db,
            offset=offset,
        )

    @staticmethod
    async def verify_by_certificate(
        certificate_id: str,
        db: AsyncSession,
    ) -> TrustProofResponse:
        return await ProofService.verify_by_certificate(certificate_id=certificate_id, db=db)

    @staticmethod
    async def verify_by_digest(
        sha256_digest: str,
        db: AsyncSession,
    ) -> TrustProofResponse:
        return await ProofService.verify_by_digest(sha256_digest=sha256_digest, db=db)

    @staticmethod
    async def verify_general(
        req: VerifyRequest,
        db: AsyncSession,
    ) -> VerifyResponse:
        return await ProofService.verify_general(req=req, db=db)
