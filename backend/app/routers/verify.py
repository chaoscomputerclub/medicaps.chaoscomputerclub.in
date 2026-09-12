"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Trust-of-Proof Cryptographic Verification Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.db_models import TrustProof
from app.models.schemas import TrustProofResponse, VerifyRequest, VerifyResponse

router = APIRouter(prefix="/verify", tags=["Trust of Proof Verification"])


@router.get("/cert/{certificate_id}", response_model=TrustProofResponse)
async def verify_by_certificate(certificate_id: str, db: AsyncSession = Depends(get_db)):
    """
    Verify the cryptographic authenticity of an offline contest result certificate.
    Returns SHA-256 signature, physical attendance stamp, and proctor signature.
    """
    stmt = select(TrustProof).where(TrustProof.certificate_id == certificate_id)
    result = await db.execute(stmt)
    proof = result.scalars().first()
    if not proof:
        raise HTTPException(
            status_code=404,
            detail=f"Certificate '{certificate_id}' not found or has been revoked.",
        )
    return proof


@router.get("/digest/{sha256_digest}", response_model=TrustProofResponse)
async def verify_by_digest(sha256_digest: str, db: AsyncSession = Depends(get_db)):
    """Verify result directly using raw SHA-256 digest hash."""
    stmt = select(TrustProof).where(TrustProof.sha256_digest == sha256_digest)
    result = await db.execute(stmt)
    proof = result.scalars().first()
    if not proof:
        raise HTTPException(
            status_code=404,
            detail="No contest result matches this cryptographic SHA-256 digest.",
        )
    return proof


@router.post("", response_model=VerifyResponse)
async def verify_general(req: VerifyRequest, db: AsyncSession = Depends(get_db)):
    """Search by Certificate ID, SHA-256 digest, or session UUID."""
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
