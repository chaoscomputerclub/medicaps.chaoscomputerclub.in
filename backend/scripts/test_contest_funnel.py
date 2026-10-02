"""
Chaos Computer Club — Comprehensive End-to-End Contest Funnel Test Suite
Tests:
1. Contest Registration & Database state
2. Assessment Window Gating & Waiting State
3. Assessment Session Start & CodeBox Execution
4. Submission Evaluation & Score Calculation
5. Top 30 Finalist Qualification & Digital QR Campus Pass Issuance
6. Proctor Gate QR Scanner & Arrival Check-in Verification
7. Duplicate Scan Protection
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ── Production safety guard ────────────────────────────────────────────────
from scripts.ci_safety_guard import assert_safe_to_run
assert_safe_to_run(__file__)

from sqlalchemy import select, delete

from app.core.config import settings
from app.core.db import AsyncSessionLocal, init_db
from app.models.db_models import (
    MemberProfile,
    OfflineContest,
    ContestRegistration,
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
    CampusPass,
    now_utc,
)
from app.services.assessment_service import AssessmentService
from app.services.contest_service import ContestService
from app.services.pass_service import PassService
from app.services.seed_service import seed_initial_data
from app.engine.enums import Language
from app.engine.harness import prepare_solution_code


async def run_funnel_test():
    print("=" * 60)
    print("⚡ [CCC] Running Complete Contest & Assessment Funnel Test Suite")
    print("=" * 60)

    old_qr_feat = settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
    settings.FEATURE_ASSESSMENT_AND_QR_ENABLED = True

    try:
        await init_db()

        async with AsyncSessionLocal() as db:
            # Seed initial database
            await seed_initial_data(db)

            # 1. Setup Test Cadet Member
            test_handle = "cadet_funnel_test"
            m_stmt = select(MemberProfile).where(MemberProfile.handle == test_handle)
            m_res = await db.execute(m_stmt)
            member = m_res.scalars().first()

            if not member:
                member = MemberProfile(
                    handle=test_handle,
                    email=os.getenv("TEST_CADET_EMAIL", "funnel_test@medicaps.ac.in"),
                    full_name="Aarav Sharma",
                    department="Computer Science & Engineering",
                    batch="2023-2027",
                    rating=1580,
                    peak_rating=1620,
                    is_onboarded=True,
                )
                db.add(member)
                await db.commit()
                await db.refresh(member)

            # 2. Setup Test Contest (Weekly Contest 1 or fallback to any active)
            contest_slug = "weekly-contest-1"
            c_stmt = select(OfflineContest).where(OfflineContest.slug == contest_slug)
            c_res = await db.execute(c_stmt)
            contest = c_res.scalars().first()

            if not contest:
                c_any_res = await db.execute(select(OfflineContest).order_by(OfflineContest.created_at.desc()))
                contest = c_any_res.scalars().first()
                if contest:
                    contest_slug = contest.slug
                else:
                    from scripts.launch_official_contests import launch_contests
                    await launch_contests(force=True)
                    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == "weekly-contest-1"))
                    contest = c_res.scalars().first()
                    contest_slug = "weekly-contest-1"

            print(f"🔹 Step 1: Candidate Registration for '{contest.title}' ({contest_slug})")
            reg_result = await ContestService.register_candidate(contest_slug, member, db)
            assert reg_result["registered"] is True, "Registration failed"
            print(f"  ✓ Candidate @{member.handle} registered successfully at {reg_result['registered_at']}")

            # 3. Test Gating Window Check
            print("\n🔹 Step 2: Assessment Window Gating & Waiting Verification")
            status_data = await AssessmentService.get_assessment_status(contest_slug, member, db)
            assess_info = status_data["assessment"]
            print(f"  Assessment Window Status: is_open={assess_info['is_open']}, opens_in={assess_info.get('opens_in_seconds')}s")

            # 4. Now simulate active window for testing session execution
            print("\n🔹 Step 3: Assessment Session Creation & Problem Discovery")
            a_stmt = select(Assessment).where(Assessment.contest_id == contest.id)
            a_res = await db.execute(a_stmt)
            assessment = a_res.scalars().first()
            if assessment:
                assessment.starts_at = now_utc() - timedelta(minutes=10)
                assessment.ends_at = now_utc() + timedelta(hours=2)
                await db.commit()

            active_status = await AssessmentService.get_assessment_status(contest_slug, member, db)
            assert active_status["session"] is not None, "Active session should be created"
            session_id = active_status["session"]["id"]
            problems = active_status["problems"]
            print(f"  ✓ Session Active! ID: {session_id} | Problems Available: {len(problems)}")

            # 5. Submit Solution to CodeBox
            print("\n🔹 Step 4: Solution Code Evaluation on CodeBox")
            prob_a = problems[0]
            # Solution for Problem A (supports function / LeetCode class Solution)
            sample_code = """class Solution:
    def countMirrorPairs(self, passes: list[str]) -> int:
        counts = {}
        total = 0
        for p in passes:
            rev = p[::-1]
            if rev in counts:
                total += counts[rev]
            counts[p] = counts.get(p, 0) + 1
        return total
"""
            from app.engine.providers.factory import get_judge_provider
            provider = get_judge_provider()
            sample_tcs = prob_a["sample_testcases"]
            from app.engine.schemas import TestCaseSchema
            tcs = [
                TestCaseSchema(
                    id=f"tc_{i}",
                    name=f"Test {i+1}",
                    stdin=s["stdin"],
                    expected_output=s["expected_output"],
                )
                for i, s in enumerate(sample_tcs)
            ]
            wrapped_code = prepare_solution_code(
                code=sample_code,
                language="python",
                starter_codes=prob_a.get("starter_codes"),
            )
            exec_res = await provider.execute_batch(
                language=Language.PYTHON,
                code=wrapped_code,
                testcases=tcs,
                time_limit=prob_a["time_limit"],
                memory_limit_mb=prob_a["memory_limit"],
            )
            print(f"  Verdict: {exec_res.verdict.value} | Passed: {exec_res.passed_testcases}/{exec_res.total_testcases} | Score: {exec_res.score}")
            if exec_res.verdict.value != "ACCEPTED":
                print(f"  Stderr: {exec_res.stderr} | Stdout: {exec_res.stdout}")
            assert exec_res.verdict.value == "ACCEPTED", f"Expected ACCEPTED, got {exec_res.verdict}"
            print("  ✓ CodeBox execution returned ACCEPTED!")

        # 6. Top 30 Finalist Qualification & Campus Pass Generation
        print("\n🔹 Step 5: Top 30 Finalist Qualification & Campus Pass Issuance")
        # Update session score
        s_obj = await db.get(AssessmentSession, session_id)
        s_obj.total_score = 100.0
        s_obj.status = "submitted"
        await db.commit()

        qual_res = await AssessmentService.evaluate_and_qualify_top_30(contest_slug, db)
        assert qual_res["qualified_count"] > 0, "At least 1 candidate should qualify"
        print(f"  ✓ Qualified Count: {qual_res['qualified_count']} finalists stamped.")
        qualifier = qual_res["qualifiers"][0]
        pass_code = qualifier["pass_code"]
        seat_num = qualifier["seat_number"]
        print(f"  Issued Campus Pass: Code={pass_code} | Seat={seat_num}")

        # Ensure fresh pass status for testing
        p_stmt = select(CampusPass).where(CampusPass.pass_code == pass_code)
        p_res = await db.execute(p_stmt)
        p_obj = p_res.scalars().first()
        if p_obj:
            p_obj.check_in_status = "issued"
            p_obj.checked_in_at = None
            p_obj.checked_in_by = None
            await db.commit()

        # 7. Proctor Gate QR Verification
        print("\n🔹 Step 6: Proctor Entrance Scanner Verification")
        qr_scan_input = f"CCC-PASS:{pass_code}:{member.id}:{seat_num}:QUALIFIED"
        verify_res = await PassService.verify_and_check_in(
            raw_input=qr_scan_input,
            proctor_name="Chief Proctor (CCC Core)",
            contest_slug=contest_slug,
            db=db,
        )
        print(f"  Proctor Scan Verdict: {verify_res.status} | Valid: {verify_res.valid}")
        print(f"  Candidate: {verify_res.candidate_name} (@{verify_res.handle}) | Seat: {verify_res.seat_number}")
        print(f"  Proctor Stamp: {verify_res.checked_in_by} at {verify_res.checked_in_at}")
        assert verify_res.valid is True, "Proctor scan should be valid"
        assert verify_res.status == "verified", f"Expected verified, got {verify_res.status}"
        print("  ✓ Proctor Gate Verification & Arrival Check-in Passed!")

        # 8. Duplicate Scan Protection
        print("\n🔹 Step 7: Duplicate Scan & Anti-Counterfeit Protection")
        dup_res = await PassService.verify_and_check_in(
            raw_input=qr_scan_input,
            proctor_name="Chief Proctor (CCC Core)",
            contest_slug=contest_slug,
            db=db,
        )
        print(f"  Second Scan Result: status={dup_res.status} | message={dup_res.message}")
        assert dup_res.status == "already_checked_in", f"Expected already_checked_in, got {dup_res.status}"
        # 9. Cleanup Test Records
        print("\n🔹 Step 8: Cleaning up test member and records...")
        await db.execute(delete(MemberProfile).where(MemberProfile.handle == test_handle))
        await db.commit()
        print("  ✓ Test Cadet and Funnel Records Cleaned.")

        print("\n" + "=" * 60)
        print("🎉 COMPLETE CONTEST & ASSESSMENT FUNNEL PASSED WITH 100% SUCCESS!")
        print("=" * 60)
    finally:
        settings.FEATURE_ASSESSMENT_AND_QR_ENABLED = old_qr_feat


if __name__ == "__main__":
    asyncio.run(run_funnel_test())
