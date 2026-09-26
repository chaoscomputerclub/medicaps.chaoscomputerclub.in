"""
Chaos Computer Club — Medi-Caps Chapter
controllers/storage_controller.py — Backward-compatible facade for modules/storage
"""

from app.modules.storage.storage_controller import StorageController
from app.modules.storage.storage_app_service import StorageAppService

__all__ = [
    "StorageController",
    "StorageAppService",
]
