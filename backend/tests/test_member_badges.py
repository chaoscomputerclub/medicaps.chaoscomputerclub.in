"""
Tests for authoritative chapter badges calculation.
Badges depend strictly on official contest rating and tournament attendance.
Unranked members (0 official contests attended) must have 0 badges unlocked.
"""

import pytest
from app.modules.members.member_service import MemberService


def test_unranked_member_zero_badges():
    """Cadets with 0 official contest attendances must have 0 badges unlocked, regardless of solves."""
    achievements = MemberService.compute_achievements(
        rating=1200,
        attended=0,
        podiums=0,
        is_core_member=False,
        total_solved=15,  # Has 15 practice solves, but 0 official contests
        peak_rating=1200,
    )
    assert len(achievements) == 6
    for b in achievements:
        assert b["earned"] is False, f"Badge {b['title']} should be locked for unranked cadet"


def test_unranked_member_even_with_high_solves():
    """Even with 150 solves, 0 contest attendances results in 0 badges unlocked."""
    achievements = MemberService.compute_achievements(
        rating=1200,
        attended=0,
        podiums=0,
        is_core_member=False,
        total_solved=150,
        peak_rating=1200,
    )
    assert all(b["earned"] is False for b in achievements)


def test_novice_badge_unlocked_with_contest_attendance():
    """Attending 1 official contest establishes baseline rating and unlocks Novice badge."""
    achievements = MemberService.compute_achievements(
        rating=1200,
        attended=1,
        podiums=0,
        is_core_member=False,
        total_solved=0,
        peak_rating=1200,
    )
    earned_map = {b["code"]: b["earned"] for b in achievements}
    assert earned_map["NOVICE"] is True
    assert earned_map["AMATEUR"] is False
    assert earned_map["CANDIDATE"] is False
    assert earned_map["EXPERT"] is False
    assert earned_map["MASTER"] is False
    assert earned_map["GRANDMASTER"] is False


def test_rating_tier_badge_progression():
    """Verify that badges unlock progressively with official contest rating."""
    # Amateur: rating >= 1400
    amateur_achievements = MemberService.compute_achievements(
        rating=1420,
        attended=2,
        podiums=0,
        is_core_member=False,
    )
    amateur_map = {b["code"]: b["earned"] for b in amateur_achievements}
    assert amateur_map["NOVICE"] is True
    assert amateur_map["AMATEUR"] is True
    assert amateur_map["CANDIDATE"] is False

    # Candidate: rating >= 1600
    candidate_achievements = MemberService.compute_achievements(
        rating=1650,
        attended=3,
        podiums=0,
        is_core_member=False,
    )
    candidate_map = {b["code"]: b["earned"] for b in candidate_achievements}
    assert candidate_map["NOVICE"] is True
    assert candidate_map["AMATEUR"] is True
    assert candidate_map["CANDIDATE"] is True
    assert candidate_map["EXPERT"] is False

    # GrandMaster: rating >= 2200
    gm_achievements = MemberService.compute_achievements(
        rating=2250,
        attended=5,
        podiums=2,
        is_core_member=False,
    )
    assert all(b["earned"] is True for b in gm_achievements)


def test_peak_rating_preserves_earned_badges():
    """If a cadet previously attained rating >= 1600 (peak_rating), they retain Candidate badge."""
    achievements = MemberService.compute_achievements(
        rating=1350,  # dropped after contest
        attended=3,
        podiums=0,
        is_core_member=False,
        peak_rating=1620,  # historical peak was Candidate tier
    )
    earned_map = {b["code"]: b["earned"] for b in achievements}
    assert earned_map["NOVICE"] is True
    assert earned_map["AMATEUR"] is True
    assert earned_map["CANDIDATE"] is True
    assert earned_map["EXPERT"] is False
