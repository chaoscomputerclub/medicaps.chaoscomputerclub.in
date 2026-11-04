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
from .problem import Problem, ProblemVersion, ProblemTestCase, MemberProblemStats
from .proof import TrustProof
from .campus_pass import CampusPass
from .announcement import Announcement
from .version import ResourceVersion
from .judge_job import JudgeJob, JudgeJobAttempt
from app.core.queue.outbox import OutboxEvent
from .organization import (
    Organization,
    OrganizationDomain,
    OrganizationMembership,
    OrganizationInvitation,
)
from .policy import (
    PlatformPolicy,
    UserConsent,
)
from .settings import (
    PlatformSetting,
    PlatformSettingAudit,
)

__all__ = [
    "Base",
    "get_uuid",
    "now_utc",
    "MemberProfile",
    "OTPStore",
    "RatingHistory",
    "StudentFollow",
    "OfflineContest",
    "ContestProblem",
    "ContestSubmission",
    "ScoreboardEntry",
    "ContestRegistration",
    "Assessment",
    "AssessmentProblem",
    "AssessmentSession",
    "AssessmentSubmission",
    "Problem",
    "ProblemVersion",
    "ProblemTestCase",
    "MemberProblemStats",
    "TrustProof",
    "CampusPass",
    "Announcement",
    "ResourceVersion",
    "JudgeJob",
    "JudgeJobAttempt",
    "OutboxEvent",
    "Organization",
    "OrganizationDomain",
    "OrganizationMembership",
    "OrganizationInvitation",
    "PlatformPolicy",
    "UserConsent",
    "PlatformSetting",
    "PlatformSettingAudit",
]

