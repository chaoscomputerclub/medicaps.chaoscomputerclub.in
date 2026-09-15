"""
Chaos Computer Club — Domain-Driven Database ORM Models
Exports all domain entities cleanly for platform services and routers.
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
from .proof import TrustProof
from .campus_pass import CampusPass
from .announcement import Announcement

__all__ = [
    # Base
    "Base",
    "get_uuid",
    "now_utc",
    # Member & Identity
    "MemberProfile",
    "OTPStore",
    "RatingHistory",
    "StudentFollow",
    # Contests & Arenas
    "OfflineContest",
    "ContestProblem",
    "ContestSubmission",
    "ScoreboardEntry",
    "ContestRegistration",
    # Online Assessments
    "Assessment",
    "AssessmentProblem",
    "AssessmentSession",
    "AssessmentSubmission",
    # Proofs, Passes & Announcements
    "TrustProof",
    "CampusPass",
    "Announcement",
]
