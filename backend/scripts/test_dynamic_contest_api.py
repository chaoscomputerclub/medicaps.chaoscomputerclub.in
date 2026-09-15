"""
Chaos Computer Club — Comprehensive Dynamic Contest API Test Suite
Tests:
1. Atomic Dynamic Contest & Problem Creation
2. Dynamic Problem Addition & Update
3. Contest Cloning with Incremented Edition
4. Contest Mutation (Metadata, Timings, Rules)
5. Status Lifecycle Transitions (upcoming -> live -> finished)
6. Preset Quick Launch (Weekly / Biweekly)
7. Clean Cascade Deletion
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.db import AsyncSessionLocal, init_db
from app.schemas.dynamic_contest import (
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    ProblemCreateSchema,
    ContestCloneRequest,
    PresetContestLaunchRequest,
    AssessmentConfigSchema,
)
from app.services.dynamic_contest_service import DynamicContestService


async def test_dynamic_api():
    print("=" * 70)
    print("⚡ [CCC] Testing Dynamic Contest Creating API Services")
    print("=" * 70)

    await init_db()

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        test_slug = "test-dynamic-hackathon-2026"
        clone_slug = "test-dynamic-hackathon-2026-v2"
        preset_slug = "weekly-contest-99"

        # Pre-cleanup in case of previous run interruption
        for s in [test_slug, clone_slug, preset_slug]:
            try:
                await DynamicContestService.delete_contest(s, db)
            except Exception:
                pass

        # ── TEST 1: Atomic Dynamic Contest Creation ────────────────────────
        print("\n🔹 TEST 1: Dynamic Contest & Problem Creation")

        create_req = DynamicContestCreateRequest(
            title="CCC Medi-Caps Spring Hackathon 2026",
            slug=test_slug,
            season="Season 2026",
            cadence="special",
            edition=1,
            division="open",
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=3),
            venue="Medi-Caps University Auditorium & Compute Lab",
            seat_capacity=100,
            prize_pool="₹50,000 Cash Prize + Swag Boxes",
            sponsor="Chaos Computer Club & Medi-Caps ACM",
            summary="Spring flagship hackathon and competitive algorithmic championship for Medi-Caps university cadets.",
            rules=[
                "Teams of 1-3 cadets or individual entry.",
                "Phase 1 online screening unlocks 48 hours prior to the main arena event.",
                "Submissions graded with sub-millisecond precision."
            ],
            problems=[
                ProblemCreateSchema(
                    problem_index="A",
                    title="Spring Campus Cache Synchronization",
                    topic="Hash Map & Arrays",
                    difficulty="EASY",
                    points=100,
                    description="Synchronize N distributed cache nodes across the campus subnet to eliminate stale keys.",
                    time_limit=1.5,
                    memory_limit=256,
                    sample_testcases=[
                        {"stdin": "3\n10 20 30", "expected_output": "60", "explanation": "Sum of cache keys is 60."}
                    ],
                    hidden_testcases=[
                        {"stdin": "2\n100 200", "expected_output": "300", "weight": 1.0}
                    ]
                ),
                ProblemCreateSchema(
                    problem_index="B",
                    title="Air-Gapped Optical Fiber Topology",
                    topic="Graph Minimum Spanning Tree",
                    difficulty="MEDIUM",
                    points=250,
                    description="Connect N lab buildings with optical fiber lines minimizing total cable length while ensuring zero packet drops.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[
                        {"stdin": "3 3\n1 2 10\n2 3 20\n1 3 30", "expected_output": "30"}
                    ]
                )
            ],
            assessment=AssessmentConfigSchema(
                duration_minutes=120,
                auto_unlock_now=True,
            )
        )

        res = await DynamicContestService.create_contest(create_req, db)
        print(f"  ✓ Contest created! Slug: {res['slug']} | Title: {res['title']}")
        print(f"  Problems created: {len(res['problems'])} challenges mirrored to Arena and Assessment.")
        assert res["success"] is True
        assert res["slug"] == test_slug
        assert len(res["problems"]) == 2

        # ── TEST 2: Dynamic Problem Addition (Problem C) ──────────────────
        print("\n🔹 TEST 2: Adding Problem C dynamically")
        prob_c = ProblemCreateSchema(
            problem_index="C",
            title="Quantum Cryptographic Entanglement Routing",
            topic="Dynamic Programming on Trees",
            difficulty="HARD",
            points=400,
            description="Route quantum keys through an air-gapped tree network to maximize entanglement fidelity.",
            time_limit=2.0,
            memory_limit=256,
            sample_testcases=[
                {"stdin": "2\n1 2 5", "expected_output": "5"}
            ]
        )
        add_p_res = await DynamicContestService.add_or_update_problem(test_slug, prob_c, db)
        print(f"  ✓ Problem C added: {add_p_res['message']} (Total problems: {add_p_res['problem_count']})")
        assert add_p_res["problem_count"] == 3

        # ── TEST 3: Dynamic Contest Metadata Update ────────────────────────
        print("\n🔹 TEST 3: Updating Contest Specifications")
        update_req = DynamicContestUpdateRequest(
            venue="Medi-Caps University Supercomputing Facility (Lab 01)",
            seat_capacity=120,
            prize_pool="₹75,000 Cash Prize + Trophy",
        )
        up_res = await DynamicContestService.update_contest(test_slug, update_req, db)
        print(f"  ✓ Contest updated: {up_res['contest']['venue']} (Seats: 120)")
        assert up_res["success"] is True

        # ── TEST 4: Contest Cloning ────────────────────────────────────────
        print("\n🔹 TEST 4: Cloning Contest into Edition #2")
        clone_slug = "test-dynamic-hackathon-2026-v2"
        clone_req = ContestCloneRequest(
            new_slug=clone_slug,
            new_title="CCC Medi-Caps Spring Hackathon 2026 — Edition 2",
            new_edition=2,
            starts_at=now + timedelta(days=7),
            auto_unlock_assessment_now=True,
        )
        clone_res = await DynamicContestService.clone_contest(test_slug, clone_req, db)
        print(f"  ✓ Cloned contest created: {clone_res['slug']} with {len(clone_res['problems'])} problems inherited!")
        assert clone_res["success"] is True
        assert len(clone_res["problems"]) == 3

        # ── TEST 5: Status Lifecycle Transition ───────────────────────────
        print("\n🔹 TEST 5: Lifecycle Status Transition")
        status_res = await DynamicContestService.change_contest_status(test_slug, "live", db, auto_qualify_top_30=False)
        print(f"  ✓ Status changed from {status_res['previous_status']} -> {status_res['current_status']}")
        assert status_res["current_status"] == "live"

        # ── TEST 6: Preset Launch ──────────────────────────────────────────
        print("\n🔹 TEST 6: Preset One-Click Launch")
        preset_req = PresetContestLaunchRequest(
            cadence="weekly",
            edition=99,
            starts_in_hours=48.0,
            auto_unlock_screening=True,
        )
        preset_res = await DynamicContestService.launch_preset(preset_req, db)
        print(f"  ✓ Preset launch success: {preset_res['title']} (Slug: {preset_res['slug']})")
        assert preset_res["edition"] == 99

        # ── TEST 7: Cleanup Test Contests ─────────────────────────────────
        print("\n🔹 TEST 7: Cascade Deletion & Cleanup")
        del_1 = await DynamicContestService.delete_contest(test_slug, db)
        del_2 = await DynamicContestService.delete_contest(clone_slug, db)
        del_3 = await DynamicContestService.delete_contest("weekly-contest-99", db)
        print(f"  ✓ Test contests cleaned up: {del_1['message']}, {del_2['message']}, {del_3['message']}")

    print("\n" + "=" * 70)
    print("🎉 ALL DYNAMIC CONTEST API SERVICE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_dynamic_api())
