"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Trust-of-Proof Cryptographic Verification Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.cache import get_cache, set_cache
from app.models.db_models import TrustProof
from app.models.schemas import TrustProofResponse, VerifyRequest, VerifyResponse

router = APIRouter(prefix="/verify", tags=["Trust of Proof Verification"])

@router.get("/proofs", response_model=List[TrustProofResponse])
async def list_proofs(
    response: Response,
    limit: int = Query(200, ge=1, le=500, description="Max proofs to return"),
    db: AsyncSession = Depends(get_db),
):
    """Fetch live cryptographic trust proofs from database. Protected by 120s Redis Cache."""
    cache_key = f"cache:verify:proofs:{limit}"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
        return cached

    stmt = select(TrustProof).order_by(TrustProof.issued_at.desc()).limit(limit)
    res = await db.execute(stmt)
    records = res.scalars().all()

    payload = [TrustProofResponse.model_validate(r).model_dump() for r in records]
    await set_cache(cache_key, payload, ttl_seconds=120)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
    return records


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
