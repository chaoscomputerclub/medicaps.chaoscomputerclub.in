#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform — Test Data Seeding Script
Ensures an active live contest exists with 4 problems, testcases, and valid Redis lifecycle state.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import redis.asyncio as aioredis

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))

from tests.load.config.settings import settings
from backend.app.models.contest import OfflineContest, ContestProblem

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.loadtest.seed_data")


async def main():
    settings.enforce_production_safety()

    slug = settings.LOAD_TEST_CONTEST_SLUG or "weekly-contest-01"
    logger.info("Ensuring target contest exists: %s", slug)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    problems_file = Path(__file__).resolve().parent.parent / "data" / "problems.json"
    with open(problems_file, "r") as f:
        problem_fixtures = json.load(f)

    async with async_session() as db:
        stmt = select(OfflineContest).where(OfflineContest.slug == slug)
        res = await db.execute(stmt)
        contest = res.scalars().first()

        now = datetime.now(timezone.utc)
        starts_at = now - timedelta(hours=1)
        ends_at = now + timedelta(hours=3)

        if not contest:
            logger.info("Creating contest '%s' in database...", slug)
            contest = OfflineContest(
                slug=slug,
                title="Weekly Competitive Arena #01",
                season="Spring 2026",
                status="live",
                division="open",
                starts_at=starts_at,
                ends_at=ends_at,
                check_in_opens_at=starts_at,
                venue="Computer Science Complex, Lab 4",
                seat_capacity=500,
                problem_count=len(problem_fixtures),
                environment="GCC 14 / Clang 18 / Python 3.12 / OpenJDK 21",
                summary="Official weekly competitive programming arena.",
                rules=["No external LLMs", "Strict time limits"],
            )
            db.add(contest)
            await db.flush()

            # Seed problems
            for p_fix in problem_fixtures:
                problem = ContestProblem(
                    contest_id=contest.id,
                    problem_index=p_fix["problem_index"],
                    title=p_fix["title"],
                    topic=p_fix["topic"],
                    points=p_fix["points"],
                    difficulty=p_fix.get("difficulty", "MEDIUM"),
                    description=p_fix["description"],
                    execution_mode="STDIN",
                    sample_testcases=p_fix.get("testcases", [])[:2],
                    hidden_testcases=p_fix.get("testcases", []),
                    starter_codes={
                        "python": "# Write your code here\n",
                        "cpp": "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}\n",
                    },
                )
                db.add(problem)
        else:
            # Ensure contest status is live
            contest.status = "live"
            contest.ends_at = ends_at

        await db.commit()

        # Update Redis contest lifecycle state
        await redis_client.set(f"ccc:contest:{slug}:lifecycle_state", "live")
        logger.info("✓ Contest '%s' is LIVE in PostgreSQL and Redis.", slug)

    await engine.dispose()
    await redis_client.close()


if __name__ == "__main__":
    asyncio.run(main())
