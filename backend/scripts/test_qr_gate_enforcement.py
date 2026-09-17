"""
Verification script: Test strict QR check-in gate enforcement
Tests:
1. Top 30 candidate without check-in (pass status = 'issued') is BLOCKED from arena (require_checked_in=True).
2. Top 30 candidate without check-in CAN view contest detail/pass (require_checked_in=False).
3. Once scanned (pass status = 'checked_in'), arena access is UNLOCKED.
4. Revoked pass is BLOCKED.
5. Core member is ALLOWED.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.db import AsyncSessionLocal
from app.core.config import settings
from app.models.db_models import OfflineContest, MemberProfile, CampusPass, Assessment, AssessmentSession
from app.services.contest_eligibility_service import is_member_eligible_for_live_contest
from sqlalchemy import select, delete


async def run_tests():
    print("=== Testing Strict QR Gate Enforcement ===")
    # Temporarily disable dev bypass to test strict production security
    old_env_bypass = os.environ.get("DEV_BYPASS_RESTRICTIONS")
    old_env_mode = os.environ.get("DEV_MODE")
    os.environ["DEV_BYPASS_RESTRICTIONS"] = "false"
    os.environ["DEV_MODE"] = "false"
    settings.DEV_BYPASS_RESTRICTIONS = False
    settings.DEV_MODE = False

    async with AsyncSessionLocal() as db:
        # 1. Setup mock contest
        slug = "test-qr-gate-contest"
        await db.execute(delete(CampusPass).where(CampusPass.pass_code.startswith("TEST-QR-")))
        await db.execute(delete(OfflineContest).where(OfflineContest.slug == slug))
        await db.commit()

        now = datetime.now(timezone.utc)
        contest = OfflineContest(
            title="Test Air-Gapped Final",
            slug=slug,
            season="2026",
            division="DIV1",
            status="live",
            starts_at=now - timedelta(minutes=10),
            ends_at=now + timedelta(hours=2),
            venue="Lab 4, Campus Computing Complex",
            check_in_opens_at=now - timedelta(hours=1),
            seat_capacity=30,
            registered_count=1,
            problem_count=3,
            environment="Ubuntu 22.04 LTS · GCC 12 / Python 3.12",
            summary="Test summary for air-gapped final",
            rules=["Carry student ID", "No external devices"],
        )
        db.add(contest)
        await db.flush()

        # 2. Setup candidate member
        c_res = await db.execute(select(MemberProfile).where(MemberProfile.handle == "test_cadet_qr"))
        cadet = c_res.scalars().first()
        if not cadet:
            cadet = MemberProfile(
                handle="test_cadet_qr",
                full_name="Cadet Test QR",
                email="cadet.qr@medicaps.ac.in",
                is_core_member=False,
            )
            db.add(cadet)
            await db.flush()
        else:
            cadet.is_core_member = False
            await db.flush()

        # 3. Create issued CampusPass (unscanned / from home)
        test_pass = CampusPass(
            contest_id=contest.id,
            member_id=cadet.id,
            pass_code="TEST-QR-PASS01",
            seat_number="Lab-04-WS-12",
            qr_data=f"ccc://medicaps/contest/{contest.slug}/cadet/{cadet.handle}",
            check_in_status="issued",
            issued_at=now,
        )
        db.add(test_pass)
        await db.commit()

        # TEST 1: Unscanned candidate accessing arena (require_checked_in=True)
        is_eligible_arena, reason_arena = await is_member_eligible_for_live_contest(
            cadet, contest, db, require_checked_in=True
        )
        print(f"Test 1 [Unscanned Arena Access]: is_eligible={is_eligible_arena} | reason='{reason_arena}'")
        assert is_eligible_arena is False, f"Expected False, got {is_eligible_arena}"
        assert "Physical gate check-in required" in reason_arena or "proctor" in reason_arena
        print("  ✓ PASS: Unscanned cadet is strictly blocked from arena access.")

        # TEST 2: Unscanned candidate accessing contest details / pass view (require_checked_in=False)
        is_eligible_pass, reason_pass = await is_member_eligible_for_live_contest(
            cadet, contest, db, require_checked_in=False
        )
        print(f"Test 2 [Unscanned Pass View]: is_eligible={is_eligible_pass} | reason='{reason_pass}'")
        assert is_eligible_pass is True, f"Expected True, got {is_eligible_pass}"
        print("  ✓ PASS: Unscanned cadet can view contest details and QR pass.")

        # TEST 3: Candidate scans QR badge at lab gate -> status = 'checked_in'
        test_pass.check_in_status = "checked_in"
        test_pass.checked_in_at = datetime.now(timezone.utc)
        test_pass.checked_in_by = "Chief Proctor (CCC Core)"
        await db.commit()

        is_eligible_checked_in, reason_checked_in = await is_member_eligible_for_live_contest(
            cadet, contest, db, require_checked_in=True
        )
        print(f"Test 3 [Scanned Arena Access]: is_eligible={is_eligible_checked_in} | reason='{reason_checked_in}'")
        assert is_eligible_checked_in is True, f"Expected True, got {is_eligible_checked_in}"
        assert "Verified physical gate check-in" in reason_checked_in
        print("  ✓ PASS: Scanned cadet successfully gains access to live arena.")

        # TEST 4: Revoked pass
        test_pass.check_in_status = "revoked"
        await db.commit()
        is_eligible_revoked, reason_revoked = await is_member_eligible_for_live_contest(
            cadet, contest, db, require_checked_in=True
        )
        print(f"Test 4 [Revoked Pass]: is_eligible={is_eligible_revoked} | reason='{reason_revoked}'")
        assert is_eligible_revoked is False
        print("  ✓ PASS: Revoked pass is strictly denied access.")

        # TEST 5: Core chapter organizer bypass
        cadet.is_core_member = True
        await db.commit()
        is_eligible_core, reason_core = await is_member_eligible_for_live_contest(
            cadet, contest, db, require_checked_in=True
        )
        print(f"Test 5 [Core Member Proctor]: is_eligible={is_eligible_core} | reason='{reason_core}'")
        assert is_eligible_core is True
        print("  ✓ PASS: Core organizer has proctor access.")

        # Cleanup
        await db.execute(delete(CampusPass).where(CampusPass.pass_code == "TEST-QR-PASS01"))
        await db.execute(delete(OfflineContest).where(OfflineContest.slug == slug))
        await db.commit()

    if old_env_bypass is not None:
        os.environ["DEV_BYPASS_RESTRICTIONS"] = old_env_bypass
    if old_env_mode is not None:
        os.environ["DEV_MODE"] = old_env_mode
    print("\n🎉 ALL 5 STRICT QR GATE TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(run_tests())
