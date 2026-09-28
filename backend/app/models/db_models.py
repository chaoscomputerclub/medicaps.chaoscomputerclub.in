"""
Chaos Computer Club — Database ORM Models (Backwards-Compatibility Proxy)
This module re-exports all domain models from their respective domain modules:
  - app.models.member
  - app.models.contest
  - app.models.assessment
  - app.models.proof
  - app.models.campus_pass
  - app.models.announcement
"""

from .base import Base, get_uuid, now_utc
from .member import (
    MemberProfile,
    OTPStore,
    RatingHistory,
    StudentFollow,
)
from .contest import (
    OfflineContest,
    ContestAttempt,
    ContestProblem,
    ContestSubmission,
    ScoreboardEntry,
    ContestRegistration,
)
from .assessment import (
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
)
from .problem import Problem, ProblemVersion, ProblemTestCase
from .proof import TrustProof
from .campus_pass import CampusPass
from .announcement import Announcement
from .version import ResourceVersion
from app.core.queue.outbox import OutboxEvent

__all__ = [
    "Base",
    "get_uuid",
    "now_utc",
    "MemberProfile",
    "OTPStore",
    "RatingHistory",
    "StudentFollow",
    "OfflineContest",
    "ContestAttempt",
    "ContestProblem",
    "ContestSubmission",
    "ScoreboardEntry",
    "ContestRegistration",
    "Problem",
    "ProblemVersion",
    "ProblemTestCase",
    "Assessment",
    "AssessmentProblem",
    "AssessmentSession",
    "AssessmentSubmission",
    "TrustProof",
    "CampusPass",
    "Announcement",
    "ResourceVersion",
    "OutboxEvent",
]
