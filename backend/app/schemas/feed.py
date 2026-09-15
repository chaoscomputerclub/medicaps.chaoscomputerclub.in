"""
Chaos Computer Club — Announcements & Public Portal Telemetry Schemas
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

from .contest import ContestProblemResponse, ContestSummaryResponse, ScoreboardEntryResponse


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    title: str
    summary: str
    published_at: datetime
    contest_slug: Optional[str] = None


class PublicPortalResponse(BaseModel):
    contests: List[ContestSummaryResponse]
    announcements: List[AnnouncementResponse]
    standings: List[ScoreboardEntryResponse]
    problems: List[ContestProblemResponse]
