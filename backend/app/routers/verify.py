"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/verify.py — Thin HTTP Router for Trust-of-Proof Cryptographic Verification
Delegates to app.controllers.verify_controller.VerifyController
"""

from typing import List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.schemas import TrustProofResponse, VerifyRequest, VerifyResponse
from app.controllers.verify_controller import VerifyController

router = APIRouter(prefix="/verify", tags=["Trust of Proof Verification"])


@router.get("/proofs", response_model=List[TrustProofResponse])
async def list_proofs(
    response: Response,
    limit: int = Query(200, ge=1, le=500, description="Max proofs to return"),
    db: AsyncSession = Depends(get_db),
):
    """Fetch live cryptographic trust proofs from database. Protected by 120s Redis Cache."""
    return await VerifyController.list_proofs(response=response, limit=limit, db=db)


@router.get("/cert/{certificate_id}", response_model=TrustProofResponse)
async def verify_by_certificate(certificate_id: str, db: AsyncSession = Depends(get_db)):
    """
    Verify the cryptographic authenticity of an offline contest result certificate.
    Returns SHA-256 signature, physical attendance stamp, and proctor signature.
    """
    return await VerifyController.verify_by_certificate(certificate_id=certificate_id, db=db)


@router.get("/digest/{sha256_digest}", response_model=TrustProofResponse)
async def verify_by_digest(sha256_digest: str, db: AsyncSession = Depends(get_db)):
    """Verify result directly using raw SHA-256 digest hash."""
    return await VerifyController.verify_by_digest(sha256_digest=sha256_digest, db=db)


@router.post("", response_model=VerifyResponse)
async def verify_general(req: VerifyRequest, db: AsyncSession = Depends(get_db)):
    """Search by Certificate ID, SHA-256 digest, or session UUID."""
    return await VerifyController.verify_general(req=req, db=db)
