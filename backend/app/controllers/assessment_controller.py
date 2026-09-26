"""
Chaos Computer Club — Medi-Caps Chapter
controllers/assessment_controller.py — Backward-compatible facade for modules/assessments
"""

from app.modules.assessments.assessment_controller import AssessmentController
from app.modules.assessments.assessment_service import AssessmentExecutionService
from app.modules.assessments.assessment_repository import AssessmentRepository

__all__ = [
    "AssessmentController",
    "AssessmentExecutionService",
    "AssessmentRepository",
]
