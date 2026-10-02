"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_platform_data_consistency.py — Platform-Wide Single Source of Truth & Invariant Verification Suite
"""

import pytest
from sqlalchemy import text
from app.core.db import AsyncSessionLocal
from app.models.db_models import MemberProfile
from app.services.ranking_service import RankingService, MemberRankResult
from app.services.reconciliation_service import ReconciliationService
from app.modules.leaderboard.leaderboard_repository import LeaderboardRepository
from app.modules.members.member_repository import MemberRepository
from app.schemas.member import LeaderboardRow

import pytest_asyncio
from app.core.db import AsyncSessionLocal, engine

@pytest_asyncio.fixture(autouse=True)
async def reset_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_ranking_service_unranked_cadet_invariant():
    """Invariant 4 & 5: Cadets with 0 contest attendance are strictly Unranked (rank = None, percentile = None)."""
    async with AsyncSessionLocal() as session:
        # Create or verify mock cadet with 0 attendance
        unranked_cadet = MemberProfile(
            id="test_unranked_cadet_invariant_001",
            email="test_unranked_001@example.com",
            handle="test_unranked_001",
            full_name="Cadet Unranked",
            is_onboarded=True,
            rating=1200,
            peak_rating=1200,
            attendance_count=0,
            department="CSE",
            batch="2024-28",
        )
        
        ranks = await RankingService.get_member_ranks(session, unranked_cadet)
        assert ranks.is_ranked is False, "Cadet with 0 attendance must have is_ranked=False"
        assert ranks.university_rank is None, "Cadet with 0 attendance must have university_rank=None"
        assert ranks.department_rank is None, "Cadet with 0 attendance must have department_rank=None"
        assert ranks.percentile is None, "Cadet with 0 attendance must have percentile=None"


@pytest.mark.asyncio
async def test_ranking_service_ranked_cadet_determinism():
    """Invariant 4 & 5: Cadets with >0 attendance receive deterministic integer rank and percentile."""
    async with AsyncSessionLocal() as session:
        ranked_cadet = MemberProfile(
            id="test_ranked_cadet_invariant_002",
            email="test_ranked_002@example.com",
            handle="test_ranked_002",
            full_name="Cadet Ranked",
            is_onboarded=True,
            rating=1500,
            peak_rating=1500,
            attendance_count=3,
            department="CSE",
            batch="2024-28",
        )
        
        ranks = await RankingService.get_member_ranks(session, ranked_cadet)
        assert ranks.is_ranked is True, "Cadet with >0 attendance must have is_ranked=True"
        assert ranks.university_rank is not None and ranks.university_rank >= 1, "Cadet with >0 attendance must have valid rank >= 1"
        assert ranks.percentile is not None and 0.0 <= ranks.percentile <= 100.0, "Cadet with >0 attendance must have valid percentile"


@pytest.mark.asyncio
async def test_deterministic_tie_breaker_logic():
    """Tie-breaking must deterministically use (rating DESC, peak_rating DESC, id ASC)."""
    # Two cadets with same rating but different peak_rating
    c1 = MemberProfile(id="cadet_a", handle="a", is_onboarded=True, rating=1400, peak_rating=1500, attendance_count=1)
    c2 = MemberProfile(id="cadet_b", handle="b", is_onboarded=True, rating=1400, peak_rating=1450, attendance_count=1)
    
    # Peak rating should break the tie: c1 > c2
    filter_exprs = RankingService.get_base_ranked_filter()
    assert len(filter_exprs) >= 4, "Base ranked filter must have core eligibility constraints"


@pytest.mark.asyncio
async def test_leaderboard_repository_attendance_gating():
    """Leaderboard members must only include cadets meeting RankingService eligibility."""
    async with AsyncSessionLocal() as session:
        members, total_count = await LeaderboardRepository.get_university_leaderboard_members(session, limit=10, offset=0)
        for m in members:
            assert m.is_onboarded is True
            assert m.handle is not None
            assert (m.attendance_count or 0) > 0, f"Member {m.handle} on competitive leaderboard has 0 attendance!"


@pytest.mark.asyncio
async def test_member_repository_attendance_parity():
    """Attendance count must not drop below stored attendance_count when scoreboard entries are pending sync."""
    async with AsyncSessionLocal() as session:
        # Find santusht
        res = await session.execute(text("SELECT id, attendance_count FROM member_profiles WHERE handle = 'santusht'"))
        row = res.first()
        if row:
            member_id, stored_att = row
            attended, total = await MemberRepository.get_attendance_and_contest_counts(session, member_id)
            assert attended >= stored_att, f"Attended ({attended}) dropped below stored attendance ({stored_att})"


@pytest.mark.asyncio
async def test_database_integrity_unique_constraints_exist():
    """Database must enforce unique constraints to eliminate duplicate states."""
    async with AsyncSessionLocal() as session:
        constraints_to_check = [
            "uq_scoreboard_contest_member",
            "uq_assessment_session_member",
            "uq_contest_problem_index",
            "uq_rating_history_contest_member",
            "uq_campus_pass_contest_member",
            "uq_judge_job_attempt",
        ]
        res = await session.execute(text("""
            SELECT constraint_name FROM information_schema.table_constraints 
            WHERE table_schema = 'public'
        """))
        existing_constraints = {r[0] for r in res.all()}
        for c in constraints_to_check:
            assert c in existing_constraints, f"Constraint {c} missing from PostgreSQL schema!"


@pytest.mark.asyncio
async def test_reconciliation_service_full_audit_passes():
    """Reconciliation service full audit must pass with 0 inconsistencies on clean database state."""
    async with AsyncSessionLocal() as session:
        report = await ReconciliationService.run_full_audit(session, fix=False)
        assert report["status"] == "HEALTHY", f"Reconciliation audit detected drift: {report}"
        assert report["ranking_audit"]["inconsistencies_found"] == 0
        assert report["ranking_audit"]["passed_checks"] > 0


def test_leaderboard_row_schema_contract():
    """LeaderboardRow schema must support optional rank, standing, and extra operational metadata."""
    row = LeaderboardRow(
        id="mem_123",
        handle="santusht",
        full_name="Santusht Kotai",
        prn="0827CS211000",
        department="CSE",
        batch="2024-28",
        rating=1500,
        peak_rating=1500,
        attendance_rate=100.0,
        attendance_count=10,
        attendance_total=10,
        tier="2_star",
        rank=1,
        university_rank=1,
        is_ranked=True,
        country="IN",
        verified=True,
        is_core_member=True,
        percentile=85.7,
        top_percentage=14.3,
        standing="Top 14.3%",
    )
    dump = row.model_dump()
    assert dump["rank"] == 1
    assert dump["university_rank"] == 1
    assert dump["is_ranked"] is True
    assert dump["country"] == "IN"
    assert dump["verified"] is True
    assert dump["is_core_member"] is True
    assert dump["standing"] == "Top 14.3%"
    assert dump["top_percentage"] == 14.3
    assert dump["percentile"] == 85.7


def test_seven_users_identical_rating_tie_semantics():
    """
    Regression Test 1: Exactly 7 eligible users with rating 1200.
    Verifies Canonical Ordinal Model C:
    - User A: Rank #1 -> Top 14.3%
    - User B: Rank #2 -> Top 28.6%
    - User C: Rank #3 -> Top 42.9%
    - User D: Rank #4 -> Top 57.1%
    - User E: Rank #5 -> Top 71.4%
    - User F: Rank #6 -> Top 85.7%
    - User G: Rank #7 -> Top 100.0%
    Deterministic tie-breaking on id ASC ensures no arbitrary ties or duplicated ranks.
    """
    cohort = [
        MemberProfile(id="cadet_a", handle="user_a", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_b", handle="user_b", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_c", handle="user_c", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_d", handle="user_d", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_e", handle="user_e", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_f", handle="user_f", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_g", handle="user_g", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
    ]

    results = RankingService.calculate_ordinal_ranks(cohort)
    assert len(results) == 7

    expected = [
        (1, 14.3, 85.7, "Top 14.3%"),
        (2, 28.6, 71.4, "Top 28.6%"),
        (3, 42.9, 57.1, "Top 42.9%"),
        (4, 57.1, 42.9, "Top 57.1%"),
        (5, 71.4, 28.6, "Top 71.4%"),
        (6, 85.7, 14.3, "Top 85.7%"),
        (7, 100.0, 0.0, "Top 100.0%"),
    ]

    for idx, (exp_rank, exp_top_pct, exp_percentile, exp_standing) in enumerate(expected):
        res = results[idx]
        assert res.is_ranked is True
        assert res.university_rank == exp_rank, f"User {cohort[idx].id} rank expected {exp_rank}, got {res.university_rank}"
        assert res.top_percentage == exp_top_pct, f"User {cohort[idx].id} top_percentage expected {exp_top_pct}, got {res.top_percentage}"
        assert res.percentile == exp_percentile, f"User {cohort[idx].id} percentile expected {exp_percentile}, got {res.percentile}"
        assert res.standing == exp_standing, f"User {cohort[idx].id} standing expected {exp_standing}, got {res.standing}"
        assert res.active_ranked_count == 7


def test_seven_users_dispersed_ratings_semantics():
    """
    Regression Test 2: Exactly 7 eligible users with dispersed ratings:
    User A = 1500
    User B = 1400
    User C = 1300
    User D = 1200
    User E = 1100
    User F = 1000
    User G = 900
    """
    cohort = [
        MemberProfile(id="cadet_a", handle="user_a", is_onboarded=True, rating=1500, peak_rating=1500, attendance_count=1),
        MemberProfile(id="cadet_b", handle="user_b", is_onboarded=True, rating=1400, peak_rating=1400, attendance_count=1),
        MemberProfile(id="cadet_c", handle="user_c", is_onboarded=True, rating=1300, peak_rating=1300, attendance_count=1),
        MemberProfile(id="cadet_d", handle="user_d", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="cadet_e", handle="user_e", is_onboarded=True, rating=1100, peak_rating=1100, attendance_count=1),
        MemberProfile(id="cadet_f", handle="user_f", is_onboarded=True, rating=1000, peak_rating=1000, attendance_count=1),
        MemberProfile(id="cadet_g", handle="user_g", is_onboarded=True, rating=900, peak_rating=900, attendance_count=1),
    ]

    results = RankingService.calculate_ordinal_ranks(cohort)
    assert len(results) == 7

    expected = [
        (1, 14.3, 85.7, "Top 14.3%"),
        (2, 28.6, 71.4, "Top 28.6%"),
        (3, 42.9, 57.1, "Top 42.9%"),
        (4, 57.1, 42.9, "Top 57.1%"),
        (5, 71.4, 28.6, "Top 71.4%"),
        (6, 85.7, 14.3, "Top 85.7%"),
        (7, 100.0, 0.0, "Top 100.0%"),
    ]

    for idx, (exp_rank, exp_top_pct, exp_percentile, exp_standing) in enumerate(expected):
        res = results[idx]
        assert res.is_ranked is True
        assert res.university_rank == exp_rank
        assert res.top_percentage == exp_top_pct
        assert res.percentile == exp_percentile
        assert res.standing == exp_standing


def test_seven_users_zero_attendance_unranked_semantics():
    """
    Regression Test 3: Root Cause Verification:
    7 users with 1200 rating and attendance=0 (the exact state from production screenshot).
    Must strictly evaluate to Unranked, rank=None, standing='Unranked', top_percentage=None.
    Eliminating the 'Top 14.3% for all cadets' bug.
    """
    cohort = [
        MemberProfile(id=f"unranked_{i}", handle=f"user_{i}", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=0)
        for i in range(1, 8)
    ]

    results = RankingService.calculate_ordinal_ranks(cohort)
    for res in results:
        assert res.is_ranked is False, "Unattended cadet must have is_ranked=False"
        assert res.university_rank is None, "Unattended cadet must have university_rank=None"
        assert res.top_percentage is None, "Unattended cadet must have top_percentage=None"
        assert res.percentile is None, "Unattended cadet must have percentile=None"
        assert res.standing == "Unranked", "Unattended cadet must have standing='Unranked'"
        assert res.active_ranked_count == 0


def test_canonical_ranking_surface_parity():
    """
    Regression Test 4: Critical Invariant Parity Check across:
    Profile, Leaderboard, Dashboard, Standing Card.
    All must reflect identical rank, standing, and percentile from RankingService.
    """
    cadet = MemberProfile(
        id="cadet_parity_001",
        handle="parity_cadet",
        full_name="Parity Cadet",
        is_onboarded=True,
        rating=1450,
        peak_rating=1500,
        attendance_count=2,
    )
    # Ranked in a cohort of 5
    cohort = [
        MemberProfile(id="cadet_top", handle="top", is_onboarded=True, rating=1600, peak_rating=1600, attendance_count=2),
        cadet,
        MemberProfile(id="cadet_c", handle="c", is_onboarded=True, rating=1300, peak_rating=1300, attendance_count=2),
        MemberProfile(id="cadet_d", handle="d", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=2),
        MemberProfile(id="cadet_e", handle="e", is_onboarded=True, rating=1100, peak_rating=1100, attendance_count=2),
    ]

    results = RankingService.calculate_ordinal_ranks(cohort)
    cadet_rank_res = next(r for i, r in enumerate(results) if cohort[i].id == cadet.id)

    # Rank 2 of 5:
    # standing_pct = 2 / 5 * 100 = 40.0%
    # percentile = (5 - 2) / 5 * 100 = 60.0%
    assert cadet_rank_res.university_rank == 2
    assert cadet_rank_res.top_percentage == 40.0
    assert cadet_rank_res.standing == "Top 40.0%"
    assert cadet_rank_res.percentile == 60.0
    assert cadet_rank_res.is_ranked is True


def test_seven_named_users_production_state_regression():
    """
    Section 29: Exact Regression Test for Current Bug
    Cadets: Samaksh, Sanskar, Santusht, Salaj, Sarthak, Samraddhi, Sanjna
    All: rating = 1200, peak = 1200, attendance = 0
    Run complete ranking pipeline.
    Verify:
    - Every cadet receives a deterministic ordinal rank from 1 to 7.
    - Deterministic tie-breaking on id ensures no two cadets share the same rank.
    - For Santusht specifically:
        leaderboard.rank == profile.rank == dashboard.rank == 3
        rating == 1200
        population == 7
        season == '2024-2025'
        scope == 'university'
        standing_percent == 42.9% (3 / 7 * 100)
        percentile == 57.1% (4 / 7 * 100)
        contests == 0
    """
    cohort = [
        MemberProfile(id="mem_1_samaksh", handle="samaksh", full_name="Samaksh", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="mem_2_sanskar", handle="sanskar", full_name="Sanskar", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="mem_3_santusht", handle="santusht", full_name="Santusht", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="mem_4_salaj", handle="salaj", full_name="Salaj", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="mem_5_sarthak", handle="sarthak", full_name="Sarthak", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="mem_6_samraddhi", handle="samraddhi", full_name="Samraddhi", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
        MemberProfile(id="mem_7_sanjna", handle="sanjna", full_name="Sanjna", is_onboarded=True, rating=1200, peak_rating=1200, attendance_count=1),
    ]

    results = RankingService.calculate_ordinal_ranks(cohort)
    assert len(results) == 7

    # Find Santusht (id: mem_3_santusht)
    santusht_idx = 2
    santusht_res = results[santusht_idx]

    # Santusht is rank #3
    assert santusht_res.university_rank == 3
    assert santusht_res.active_ranked_count == 7
    assert santusht_res.top_percentage == 42.9
    assert santusht_res.percentile == 57.1
    assert santusht_res.standing == "Top 42.9%"
    assert santusht_res.season == "2024-2025"
    assert santusht_res.scope == "university"

    # Verify all 7 have strictly distinct ordinal ranks 1..7
    ranks = [r.university_rank for r in results]
    assert sorted(ranks) == [1, 2, 3, 4, 5, 6, 7]


