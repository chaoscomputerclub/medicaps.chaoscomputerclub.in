#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
tests/load/scripts/provision_loadtest_suite.py

Orchestrates Phase 1 and Phase 2 provisioning:
1. Creates isolated contest 'loadtest-arena-50' with 4 curated deterministic problems (A, B, C, D).
2. Provisions 50 dedicated test student identities ('loadtest-student-001' to 'loadtest-student-050').
3. Enrolls and checks in all 50 virtual students to ensure zero gate rejection.
4. Generates independent, server-signed JWT access tokens and exports to tests/load/data/loadtest_identities.json.
5. Provides deterministic cleanup with `--cleanup` flag.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add project root to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
LOAD_DIR = SCRIPT_DIR.parent
ROOT_DIR = LOAD_DIR.parents[1]
BACKEND_DIR = ROOT_DIR / "backend" if (ROOT_DIR / "backend").exists() else ROOT_DIR

for p in [str(ROOT_DIR), str(BACKEND_DIR), str(LOAD_DIR.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import redis.asyncio as aioredis
from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings as backend_settings
from app.core.security import create_access_token
from app.models.db_models import (
    MemberProfile,
    OfflineContest,
    ContestProblem,
    ContestRegistration,
    ContestSubmission,
    ScoreboardEntry,
)
from app.models.judge_job import JudgeJob, JudgeJobAttempt
from tests.load.config.settings import settings as load_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.loadtest.provision")

CONTEST_SLUG = "loadtest-arena-50"
USER_COUNT = 50


async def cleanup_suite(db: AsyncSession, redis_client: aioredis.Redis) -> None:
    """Deterministic teardown of all load test artifacts."""
    logger.info("🧹 Initiating cleanup of loadtest artifacts...")

    # 1. Fetch contest ID
    res = await db.execute(select(OfflineContest).where(OfflineContest.slug == CONTEST_SLUG))
    contest = res.scalars().first()
    contest_id = str(contest.id) if contest else None

    # 2. Fetch load test student IDs
    member_res = await db.execute(
        select(MemberProfile.id).where(MemberProfile.handle.like("loadtest-student-%"))
    )
    loadtest_member_ids = [str(mid) for mid in member_res.scalars().all()]
    logger.info("Found %d loadtest members to clean up.", len(loadtest_member_ids))

    if contest_id or loadtest_member_ids:
        # Delete Judge Job Attempts and Jobs
        if contest_id:
            await db.execute(delete(JudgeJobAttempt).where(JudgeJobAttempt.job_id.in_(
                select(JudgeJob.id).where(JudgeJob.contest_id == contest_id)
            )))
            await db.execute(delete(JudgeJob).where(JudgeJob.contest_id == contest_id))

        if loadtest_member_ids:
            await db.execute(delete(JudgeJobAttempt).where(JudgeJobAttempt.job_id.in_(
                select(JudgeJob.id).where(JudgeJob.member_id.in_(loadtest_member_ids))
            )))
            await db.execute(delete(JudgeJob).where(JudgeJob.member_id.in_(loadtest_member_ids)))

            # Delete Submissions
            await db.execute(delete(ContestSubmission).where(ContestSubmission.member_id.in_(loadtest_member_ids)))
            # Delete Scoreboard Entries
            await db.execute(delete(ScoreboardEntry).where(ScoreboardEntry.member_id.in_(loadtest_member_ids)))
            # Delete Registrations
            await db.execute(delete(ContestRegistration).where(ContestRegistration.member_id.in_(loadtest_member_ids)))
            # Delete Member Profiles
            await db.execute(delete(MemberProfile).where(MemberProfile.id.in_(loadtest_member_ids)))

    if contest_id:
        await db.execute(delete(ScoreboardEntry).where(ScoreboardEntry.contest_id == contest_id))
        await db.execute(delete(ContestRegistration).where(ContestRegistration.contest_id == contest_id))
        await db.execute(delete(ContestProblem).where(ContestProblem.contest_id == contest_id))
        await db.execute(delete(OfflineContest).where(OfflineContest.id == contest_id))

    await db.commit()

    # Redis Cleanup
    keys_to_delete = [
        f"ccc:contest:{CONTEST_SLUG}:lifecycle_state",
        f"cache:scoreboard:{CONTEST_SLUG}*",
        f"cache:contest:detail:{CONTEST_SLUG}*",
        f"cache:contest:problems:{CONTEST_SLUG}*",
    ]
    for pattern in keys_to_delete:
        cursor = 0
        while True:
            cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
            if keys:
                await redis_client.delete(*keys)
            if cursor == 0:
                break

    # Remove exported JSON file
    export_path = LOAD_DIR / "data" / "loadtest_identities.json"
    if export_path.exists():
        export_path.unlink()
        logger.info("Removed %s", export_path)

    logger.info("✓ Cleanup complete: All loadtest students, problems, and contest state removed.")


async def provision_suite(db: AsyncSession, redis_client: aioredis.Redis) -> list[dict]:
    """Execute complete provisioning for Phase 1 & Phase 2."""
    now = datetime.now(timezone.utc)
    starts_at = now - timedelta(hours=1)
    ends_at = now + timedelta(hours=24)

    # ─────────────────────────────────────────────────────────────────────────────
    # Phase 2: Isolated Contest + 4 Curated Problems
    # ─────────────────────────────────────────────────────────────────────────────
    logger.info("Setting up contest '%s' in PostgreSQL...", CONTEST_SLUG)
    contest_stmt = select(OfflineContest).where(OfflineContest.slug == CONTEST_SLUG)
    contest = (await db.execute(contest_stmt)).scalars().first()

    problems_file = LOAD_DIR / "data" / "problems.json"
    with open(problems_file, "r") as f:
        problem_fixtures = json.load(f)

    if not contest:
        contest = OfflineContest(
            slug=CONTEST_SLUG,
            title="Load Test Arena #50",
            season="Spring 2026",
            status="live",
            division="open",
            starts_at=starts_at,
            ends_at=ends_at,
            check_in_opens_at=starts_at,
            venue="Distributed Node Arena Lab",
            seat_capacity=500,
            problem_count=len(problem_fixtures),
            environment="Python 3.12 / GCC 14 / Clang 18",
            summary="Isolated load test arena with 4 deterministic known-good problems.",
            rules=["Strict time limits", "Standard I/O"],
        )
        db.add(contest)
        await db.flush()
        logger.info("✓ Created OfflineContest (id=%s, slug=%s)", contest.id, CONTEST_SLUG)
    else:
        contest.status = "live"
        contest.starts_at = starts_at
        contest.ends_at = ends_at
        contest.problem_count = len(problem_fixtures)
        await db.flush()
        logger.info("✓ Updated existing OfflineContest (id=%s, slug=%s)", contest.id, CONTEST_SLUG)

    # Delete existing problems for fresh idempotent setup
    await db.execute(delete(ContestProblem).where(ContestProblem.contest_id == contest.id))
    await db.flush()

    for p_fix in problem_fixtures:
        prob = ContestProblem(
            contest_id=contest.id,
            problem_index=p_fix["problem_index"],
            title=p_fix["title"],
            topic=p_fix["topic"],
            points=p_fix["points"],
            difficulty=p_fix["difficulty"],
            description=p_fix["description"],
            execution_mode="STDIN",
            time_limit=3.0,
            memory_limit=256,
            sample_testcases=p_fix["testcases"][:2],
            hidden_testcases=p_fix["testcases"],
            starter_codes={
                "python": "# Write your solution here\n",
                "cpp": "#include <iostream>\nusing namespace std;\nint main() { return 0; }\n",
            },
        )
        db.add(prob)
    await db.flush()
    logger.info("✓ Seeded 4 deterministic problems (A, B, C, D) for contest %s", CONTEST_SLUG)

    # Update Redis contest lifecycle state
    await redis_client.set(f"ccc:contest:{CONTEST_SLUG}:lifecycle_state", "live")

    # ─────────────────────────────────────────────────────────────────────────────
    # Phase 1: 50 Isolated Test Student Identities
    # ─────────────────────────────────────────────────────────────────────────────
    logger.info("Provisioning %d isolated test student accounts...", USER_COUNT)
    identities: list[dict] = []

    for i in range(1, USER_COUNT + 1):
        handle = f"loadtest-student-{i:03d}"
        email = f"{handle}@medicaps.ac.in"
        full_name = f"Loadtest Student {i:03d}"
        prn = f"LT2026{i:04d}"

        # Fetch or create member
        m_stmt = select(MemberProfile).where(MemberProfile.handle == handle)
        member = (await db.execute(m_stmt)).scalars().first()

        if not member:
            member = MemberProfile(
                email=email,
                handle=handle,
                full_name=full_name,
                prn=prn,
                department="Computer Science",
                batch="2023-27",
                rating=1200,
                peak_rating=1200,
                is_onboarded=True,
                is_core_member=False,
            )
            db.add(member)
            await db.flush()
        else:
            member.email = email
            member.full_name = full_name
            member.is_onboarded = True
            await db.flush()

        # Enroll in contest registrations table
        reg_stmt = select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
        registration = (await db.execute(reg_stmt)).scalars().first()
        if not registration:
            registration = ContestRegistration(
                contest_id=contest.id,
                member_id=member.id,
                status="confirmed",
                registered_at=now,
                checked_in_at=now,
                seat_assigned=f"LAB1-S{i:02d}",
            )
            db.add(registration)
        else:
            registration.checked_in_at = now
            registration.status = "confirmed"

        # Generate independent server-signed JWT token
        token_payload = {
            "sub": str(member.id),
            "email": member.email,
            "handle": member.handle,
            "type": "access",
        }
        access_token = create_access_token(token_payload, expires_delta=timedelta(days=7))

        identities.append({
            "index": i,
            "id": str(member.id),
            "handle": member.handle,
            "username": member.handle,
            "email": member.email,
            "full_name": member.full_name,
            "token": access_token,
            "access_token": access_token,
            "contest_slug": CONTEST_SLUG,
        })

    await db.commit()
    logger.info("✓ Successfully committed 50 isolated student identities and participant registrations.")

    # Export identities JSON for Locust & test suites
    export_path = LOAD_DIR / "data" / "loadtest_identities.json"
    with open(export_path, "w") as f:
        json.dump(identities, f, indent=2)
    logger.info("✓ Exported %d student identities with valid server JWTs to %s", len(identities), export_path)

    return identities


async def main():
    parser = argparse.ArgumentParser(description="Load Test Suite Provisioning & Teardown")
    parser.add_argument("--cleanup", action="store_true", help="Delete all load test artifacts and users")
    args = parser.parse_args()

    engine = create_async_engine(load_settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    redis_client = aioredis.from_url(load_settings.REDIS_URL, decode_responses=True)

    try:
        async with async_session() as db:
            if args.cleanup:
                await cleanup_suite(db, redis_client)
            else:
                await provision_suite(db, redis_client)
    finally:
        await engine.dispose()
        await redis_client.close()


if __name__ == "__main__":
    asyncio.run(main())
