"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Social Schemas for Student Following & Followers Network
"""

from typing import List, Optional
from pydantic import BaseModel


class StudentSummary(BaseModel):
    id: str
    handle: str
    full_name: Optional[str] = None
    department: Optional[str] = "CSE"
    batch: Optional[str] = "2023-27"
    rating: int = 1200
    peak_rating: int = 1200
    tier: str = "1★ Explorer"
    is_following: bool = False
    is_self: bool = False
    avatar_url: Optional[str] = None


class FollowResponse(BaseModel):
    success: bool
    is_following: bool
    followers_count: int
    following_count: int
    target_id: Optional[str] = None
    target_handle: str
    message: str


class FollowListResponse(BaseModel):
    count: int
    followers_count: Optional[int] = None
    following_count: Optional[int] = None
    students: List[StudentSummary]


class FollowingIdsResponse(BaseModel):
    following_ids: List[str]
