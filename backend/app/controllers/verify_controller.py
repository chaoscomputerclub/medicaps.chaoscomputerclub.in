"""
Chaos Computer Club — Medi-Caps Chapter
controllers/verify_controller.py — Backward-compatible facade for modules/proofs
"""

from app.modules.proofs.proof_controller import VerifyController
from app.modules.proofs.proof_service import ProofService
from app.modules.proofs.proof_repository import ProofRepository

__all__ = [
    "VerifyController",
    "ProofService",
    "ProofRepository",
]
