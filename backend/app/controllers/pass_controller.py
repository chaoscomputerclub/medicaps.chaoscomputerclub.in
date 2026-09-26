"""
Chaos Computer Club — Medi-Caps Chapter
controllers/pass_controller.py — Backward-compatible facade for modules/passes
"""

from app.modules.passes.pass_controller import PassController
from app.modules.passes.pass_repository import PassRepository

__all__ = [
    "PassController",
    "PassRepository",
]
