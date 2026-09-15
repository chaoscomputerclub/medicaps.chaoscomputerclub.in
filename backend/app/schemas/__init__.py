"""
Chaos Computer Club — Domain-Driven Pydantic Schemas
"""

from .auth import (
    AuthTokenResponse,
    CompleteOnboardingRequest,
    MemberPublic,
    SendOTPRequest,
    SendOTPResponse,
    VerifyOTPRequest,
)
from .member import (
    LeaderboardRow,
    MemberLogin,
    MemberProfileResponse,
    MemberRegister,
    RatingHistoryResponse,
    Token,
)
from .contest import (
    ArenaRunRequest,
    ArenaSubmitRequest,
    ContestArenaProblemResponse,
    ContestArenaResponse,
    ContestDetailResponse,
    ContestProblemResponse,
    ContestRegistrationResponse,
    ContestSummaryResponse,
    OfflineContestResponse,
    RegistrationStatusResponse,
    ScoreboardEntryResponse,
)
from .assessment import (
    AssessmentDetailResponse,
    AssessmentProblemResponse,
    AssessmentSessionResponse,
    AssessmentStartResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    AssessmentSummaryResponse,
    AssessmentViolationRequest,
)
from .social import (
    FollowListResponse,
    FollowResponse,
    FollowingIdsResponse,
    StudentSummary,
)
from .proof import (
    TrustProofResponse,
    VerifyRequest,
    VerifyResponse,
)
from .campus_pass import CampusPassResponse
from .feed import AnnouncementResponse, PublicPortalResponse

__all__ = [
    # Auth
    "SendOTPRequest",
    "SendOTPResponse",
    "VerifyOTPRequest",
    "MemberPublic",
    "AuthTokenResponse",
    "CompleteOnboardingRequest",
    "MemberRegister",
    "MemberLogin",
    "Token",
    # Member
    "MemberProfileResponse",
    "RatingHistoryResponse",
    "LeaderboardRow",
    # Contest
    "ContestProblemResponse",
    "ContestArenaProblemResponse",
    "ContestArenaResponse",
    "ContestSummaryResponse",
    "ContestDetailResponse",
    "OfflineContestResponse",
    "ContestRegistrationResponse",
    "RegistrationStatusResponse",
    "ScoreboardEntryResponse",
    "ArenaRunRequest",
    "ArenaSubmitRequest",
    # Assessment
    "AssessmentSummaryResponse",
    "AssessmentDetailResponse",
    "AssessmentProblemResponse",
    "AssessmentStartResponse",
    "AssessmentSessionResponse",
    "AssessmentViolationRequest",
    "AssessmentSubmitRequest",
    "AssessmentSubmitResponse",
    # Social
    "StudentSummary",
    "FollowResponse",
    "FollowListResponse",
    "FollowingIdsResponse",
    # Proof, Pass, Feed
    "TrustProofResponse",
    "VerifyRequest",
    "VerifyResponse",
    "CampusPassResponse",
    "AnnouncementResponse",
    "PublicPortalResponse",
]
