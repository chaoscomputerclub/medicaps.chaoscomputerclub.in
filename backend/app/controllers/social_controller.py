"""
Chaos Computer Club — Medi-Caps Chapter
controllers/social_controller.py — Facade redirecting to Modular Monolith Members Module
"""

from app.modules.members.social_controller import SocialController
from app.modules.members.social_service import SocialService
from app.modules.members.social_repository import SocialRepository

__all__ = ["SocialController", "SocialService", "SocialRepository"]
