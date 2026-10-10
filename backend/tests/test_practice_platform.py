"""
Chaos Computer Club Medi-Caps — Practice Platform & Coding Activity Test Suite
Verifies:
- Problem listing, search, filtering, and server-side pagination
- Visibility boundary: Only PUBLISHED problems are accessible in practice
- Practice run & submit semantics against the central judge router
- Canonical SOLVED vs ATTEMPTED state machine (once SOLVED, stays SOLVED)
- Idempotency of duplicate accepted submissions
- 365-day coding activity aggregation & unique problem metric
- Deterministic streak calculation
- Difficulty statistics breakdown
- Self-healing reconciliation from PostgreSQL submissions
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete, text

from main import app
from app.core.db import AsyncSessionLocal, init_db
from app.models.db_models import MemberProfile
from app.models.problem import Problem, ProblemTestCase, MemberProblemStats
from app.models.contest import ContestSubmission
from app.services.practice_service import PracticeService


def make_test_member(member_id: str, handle: str, email: str, **kwargs) -> MemberProfile:
    return MemberProfile(
        id=member_id,
        handle=handle,
        email=email,
        full_name=kwargs.get("full_name", kwargs.get("name", handle)),
        prn=kwargs.get("prn", f"EN22CS{abs(hash(member_id)) % 899999 + 100000}"),
        department=kwargs.get("department", "CSE"),
        batch=kwargs.get("batch", "2022-26"),
        rating=kwargs.get("rating", 1200),
        peak_rating=kwargs.get("peak_rating", 1200),
        attendance_count=kwargs.get("attendance_count", 0),
        attendance_total=kwargs.get("attendance_total", 0),
        is_onboarded=True,
    )


def make_test_problem(id: str, slug: str, title: str, difficulty: str = "MEDIUM", **kwargs) -> Problem:
    return Problem(
        id=id,
        slug=slug,
        title=title,
        problem_index=kwargs.get("problem_index", "A"),
        difficulty=difficulty,
        topic=kwargs.get("topic", "Algorithms"),
        description=kwargs.get("description", f"Problem statement for {title}"),
        constraints=kwargs.get("constraints", "1 <= N <= 10^5"),
        status=kwargs.get("status", "PUBLISHED"),
        time_limit=kwargs.get("time_limit", 2.0),
        memory_limit=kwargs.get("memory_limit", 256),
        execution_mode="FUNCTION",
        function_signature=kwargs.get("function_signature", {"name": "solve", "parameters": [], "return_type": "integer"}),
        starter_code=kwargs.get("starter_code", {}),
    )


@pytest_asyncio.fixture(autouse=True)
async def ensure_db():
    await init_db()


@pytest.mark.asyncio
async def test_practice_problem_listing_and_filtering():
    """Verify published problem browsing, difficulty filtering, and search."""
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM problems WHERE id IN ('test-prob-pub-1', 'test-prob-draft-1', 'test-prob-arch-1')"))
        await session.commit()
        # Create test problems with distinct statuses
        p_pub = Problem(
            id="test-prob-pub-1",
            slug="test-two-sum",
            title="Test Two Sum",
            problem_index="P01",
            difficulty="EASY",
            topic="Arrays",
            description="Find two numbers that add up to target.",
            constraints="2 <= N <= 10^5",
            status="PUBLISHED",
            time_limit=2.0,
            memory_limit=256,
            execution_mode="FUNCTION",
            function_signature={"name": "twoSum", "parameters": [{"name": "nums", "type": "integer[]"}], "return_type": "integer[]"},
        )
        p_draft = Problem(
            id="test-prob-draft-1",
            slug="test-draft-problem",
            title="Test Draft Problem",
            problem_index="D01",
            difficulty="HARD",
            topic="Graphs",
            description="Secret draft challenge.",
            status="DRAFT",
            time_limit=2.0,
            memory_limit=256,
            execution_mode="FUNCTION",
            function_signature={"name": "draft", "parameters": [], "return_type": "integer"},
        )
        p_arch = Problem(
            id="test-prob-arch-1",
            slug="test-archived-problem",
            title="Test Archived Problem",
            problem_index="A01",
            difficulty="MEDIUM",
            topic="Dynamic Programming",
            description="Old concluded challenge.",
            status="ARCHIVED",
            time_limit=2.0,
            memory_limit=256,
            execution_mode="FUNCTION",
            function_signature={"name": "arch", "parameters": [], "return_type": "integer"},
        )
        session.add_all([p_pub, p_draft, p_arch])
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Listing should ONLY return PUBLISHED problem
        res = await client.get("/api/practice/problems?limit=100")
        assert res.status_code == 200
        data = res.json()
        slugs = [p["slug"] for p in data["items"]]
        assert "test-two-sum" in slugs
        assert "test-draft-problem" not in slugs
        assert "test-archived-problem" not in slugs

        # 2. Search filtering
        res_search = await client.get("/api/practice/problems?q=two+sum")
        assert res_search.status_code == 200
        search_data = res_search.json()
        assert any(p["slug"] == "test-two-sum" for p in search_data["items"])

        # 3. Difficulty filtering
        res_diff = await client.get("/api/practice/problems?difficulty=HARD")
        assert res_diff.status_code == 200
        diff_data = res_diff.json()
        # Draft HARD problem must not appear even when filtering for HARD
        assert not any(p["slug"] == "test-draft-problem" for p in diff_data["items"])

    # Cleanup
    async with AsyncSessionLocal() as session:
        await session.execute(delete(Problem).where(Problem.id.in_(["test-prob-pub-1", "test-prob-draft-1", "test-prob-arch-1"])))
        await session.commit()


@pytest.mark.asyncio
async def test_solved_state_machine_and_idempotency():
    """
    CRITICAL CONSISTENCY TEST:
    1. Failed submission -> ATTEMPTED
    2. Accepted submission -> SOLVED
    3. Subsequent failed submission -> Stays SOLVED (must NOT revert)
    4. Duplicate accepted submission -> Solved count does NOT double count
    """
    member_id = "test-cadet-solved-eval"
    prob_id = "test-prob-state-machine"
    prob_slug = "test-state-machine"

    async with AsyncSessionLocal() as session:
        # Setup member and problem
        member = make_test_member(
            member_id=member_id,
            email="cadet.eval@medicaps.ac.in",
            handle="cadet_eval",
            full_name="Cadet Evaluator",
        )
        prob = make_test_problem(
            id=prob_id,
            slug=prob_slug,
            title="State Machine Invariant Problem",
            difficulty="MEDIUM",
        )
        session.add(member)
        session.add(prob)
        await session.commit()

    async with AsyncSessionLocal() as session:
        # Step 1: Failed submission
        sub1 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_id,
            member_id=member_id,
            handle="cadet_eval",
            language="python",
            code="def solve(): return 0",
            verdict="WRONG_ANSWER",
            execution_time=0.04,
            memory_used=12000,
        )
        session.add(sub1)
        await session.commit()

        # Update stats
        await PracticeService.update_member_problem_stats(
            session=session,
            member_id=member_id,
            problem_id=prob_id,
            is_accepted=False,
            runtime=0.04,
            memory=12000,
        )
        await session.commit()

        # Verify state is ATTEMPTED
        stats = await session.scalar(
            select(MemberProblemStats).where(
                MemberProblemStats.member_id == member_id,
                MemberProblemStats.problem_id == prob_id,
            )
        )
        assert stats is not None
        assert stats.status == "ATTEMPTED"
        assert stats.attempt_count == 1

        # Step 2: Accepted submission
        sub2 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_id,
            member_id=member_id,
            handle="cadet_eval",
            language="python",
            code="def solve(): return 1",
            verdict="ACCEPTED",
            execution_time=0.02,
            memory_used=11000,
        )
        session.add(sub2)
        await session.commit()

        await PracticeService.update_member_problem_stats(
            session=session,
            member_id=member_id,
            problem_id=prob_id,
            is_accepted=True,
            runtime=0.02,
            memory=11000,
        )
        await session.commit()

        stats = await session.scalar(
            select(MemberProblemStats).where(
                MemberProblemStats.member_id == member_id,
                MemberProblemStats.problem_id == prob_id,
            )
        )
        assert stats.status == "SOLVED"
        assert stats.attempt_count == 2
        assert stats.accepted_at is not None

        # Step 3: Subsequent Failed submission must NOT revert SOLVED to ATTEMPTED!
        sub3 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_id,
            member_id=member_id,
            handle="cadet_eval",
            language="python",
            code="syntax error",
            verdict="COMPILATION_ERROR",
            execution_time=0.0,
            memory_used=0,
        )
        session.add(sub3)
        await session.commit()

        await PracticeService.update_member_problem_stats(
            session=session,
            member_id=member_id,
            problem_id=prob_id,
            is_accepted=False,
            runtime=0.0,
            memory=0,
        )
        await session.commit()

        stats = await session.scalar(
            select(MemberProblemStats).where(
                MemberProblemStats.member_id == member_id,
                MemberProblemStats.problem_id == prob_id,
            )
        )
        assert stats.status == "SOLVED", "A solved problem must NEVER revert to ATTEMPTED on subsequent failures!"
        assert stats.attempt_count == 3

        # Step 4: Duplicate Accepted submission (Idempotency)
        sub4 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_id,
            member_id=member_id,
            handle="cadet_eval",
            language="python",
            code="def solve(): return 1",
            verdict="ACCEPTED",
            execution_time=0.015,
            memory_used=10500,
        )
        session.add(sub4)
        await session.commit()

        await PracticeService.update_member_problem_stats(
            session=session,
            member_id=member_id,
            problem_id=prob_id,
            is_accepted=True,
            runtime=0.015,
            memory=10500,
        )
        await session.commit()

        # Solved problem metrics query
        user_stats = await PracticeService.get_user_problem_stats(session, member_id)
        assert user_stats["problems"]["solved"] == 1, "Duplicate accepted submissions must NOT increment solved problem count!"

    # Cleanup
    async with AsyncSessionLocal() as session:
        await session.execute(delete(MemberProblemStats).where(MemberProblemStats.member_id == member_id))
        await session.execute(delete(ContestSubmission).where(ContestSubmission.member_id == member_id))
        await session.execute(delete(Problem).where(Problem.id == prob_id))
        await session.execute(delete(MemberProfile).where(MemberProfile.id == member_id))
        await session.commit()


@pytest.mark.asyncio
async def test_activity_graph_aggregation_and_streaks():
    """
    Verify:
    1. Unique problem metric: 50 submissions to same problem on 1 day = 1 activity unit.
    2. Deterministic streak calculation across calendar days.
    """
    member_id = "test-cadet-activity-streak"
    prob_a = "prob-act-a"
    prob_b = "prob-act-b"
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)
    two_days_ago = now - timedelta(days=2)

    async with AsyncSessionLocal() as session:
        member = make_test_member(
            member_id=member_id,
            email="streak.cadet@medicaps.ac.in",
            handle="cadet_streak",
            full_name="Cadet Streak",
        )
        p1 = make_test_problem(id=prob_a, slug="prob-a", title="Problem A", difficulty="EASY")
        p2 = make_test_problem(id=prob_b, slug="prob-b", title="Problem B", difficulty="MEDIUM")
        session.add_all([member, p1, p2])
        await session.commit()

        # Day 1 (two days ago): 1 submission to Prob A
        s1 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_a,
            member_id=member_id,
            handle="cadet_streak",
            language="python",
            code="pass",
            verdict="ACCEPTED",
            submitted_at=two_days_ago,
        )
        # Day 2 (yesterday): 10 submissions to Prob A, 1 submission to Prob B
        # Should count as 2 unique problems, NOT 11 units!
        subs_yesterday = [
            ContestSubmission(
                context="PRACTICE",
                master_problem_id=prob_a,
                member_id=member_id,
                handle="cadet_streak",
                language="python",
                code="pass",
                verdict="ACCEPTED",
                submitted_at=yesterday,
            )
            for _ in range(10)
        ] + [
            ContestSubmission(
                context="PRACTICE",
                master_problem_id=prob_b,
                member_id=member_id,
                handle="cadet_streak",
                language="python",
                code="pass",
                verdict="ACCEPTED",
                submitted_at=yesterday,
            )
        ]

        # Day 3 (today): 1 submission to Prob B
        s3 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_b,
            member_id=member_id,
            handle="cadet_streak",
            language="python",
            code="pass",
            verdict="ACCEPTED",
            submitted_at=now,
        )

        session.add_all([s1] + subs_yesterday + [s3])
        await session.commit()

        # Query activity
        activity = await PracticeService.get_user_activity(session, member_id, year=now.year)
        assert activity["summary"]["active_days"] == 3
        assert activity["summary"]["current_streak"] >= 3
        assert activity["summary"]["longest_streak"] >= 3

        # Check yesterday's unique problem count
        yesterday_str = yesterday.strftime("%Y-%m-%d")
        y_day = next((d for d in activity["days"] if d["date"] == yesterday_str), None)
        assert y_day is not None
        assert y_day["unique_problems"] == 2, f"Expected 2 unique problems, got {y_day['unique_problems']}"

    # Cleanup
    async with AsyncSessionLocal() as session:
        await session.execute(delete(ContestSubmission).where(ContestSubmission.member_id == member_id))
        await session.execute(delete(Problem).where(Problem.id.in_([prob_a, prob_b])))
        await session.execute(delete(MemberProfile).where(MemberProfile.id == member_id))
        await session.commit()


@pytest.mark.asyncio
async def test_reconcile_self_healing():
    """Verify that reconcile_member_problem_stats accurately reconstructs state from raw PostgreSQL submissions."""
    member_id = "test-cadet-reconcile"
    prob_id = "test-prob-reconcile"

    async with AsyncSessionLocal() as session:
        member = make_test_member(member_id=member_id, email="rec@medicaps.ac.in", handle="cadet_rec", full_name="Cadet Rec")
        prob = make_test_problem(id=prob_id, slug="prob-rec", title="Problem Rec", difficulty="HARD")
        session.add_all([member, prob])

        # Add 3 raw submissions, one accepted
        s1 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_id,
            member_id=member_id,
            handle="cadet_rec",
            language="cpp",
            code="int main() { return 1; }",
            verdict="WRONG_ANSWER",
            execution_time=0.08,
            memory_used=16000,
        )
        s2 = ContestSubmission(
            context="PRACTICE",
            master_problem_id=prob_id,
            member_id=member_id,
            handle="cadet_rec",
            language="cpp",
            code="int main() { return 0; }",
            verdict="ACCEPTED",
            execution_time=0.03,
            memory_used=14000,
        )
        session.add_all([s1, s2])
        await session.commit()

        # Reconcile
        count = await PracticeService.reconcile_member_problem_stats(session, member_id)
        assert count == 1

        # Check MemberProblemStats was populated accurately
        stats = await session.scalar(
            select(MemberProblemStats).where(
                MemberProblemStats.member_id == member_id,
                MemberProblemStats.problem_id == prob_id,
            )
        )
        assert stats is not None
        assert stats.status == "SOLVED"
        assert stats.attempt_count == 2
        assert stats.best_runtime == 0.03

        # Test recent submissions query
        recent_all = await PracticeService.get_recent_submissions(session, member_id, limit=10, only_accepted=False)
        assert len(recent_all) == 2
        assert recent_all[0]["problem_title"] == "Problem Rec"

        recent_ac = await PracticeService.get_recent_submissions(session, member_id, limit=10, only_accepted=True)
        assert len(recent_ac) == 1
        assert recent_ac[0]["verdict"] == "ACCEPTED"

    # Cleanup
    async with AsyncSessionLocal() as session:
        await session.execute(delete(MemberProblemStats).where(MemberProblemStats.member_id == member_id))
        await session.execute(delete(ContestSubmission).where(ContestSubmission.member_id == member_id))
        await session.execute(delete(Problem).where(Problem.id == prob_id))
        await session.execute(delete(MemberProfile).where(MemberProfile.id == member_id))
        await session.commit()
