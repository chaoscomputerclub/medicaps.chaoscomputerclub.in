#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform — Test Data Cleanup Script
Safely purges synthetic load-test submissions, registrations, and user profiles
matching the LOADTEST namespace. Requires explicit --confirm argument.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
import redis.asyncio as aioredis

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))

from tests.load.config.settings import settings
from backend.app.models.member import MemberProfile
from backend.app.models.contest import ContestSubmission, ContestRegistration, ScoreboardEntry

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.loadtest.cleanup")


async def cleanup(confirm: bool = False):
    settings.enforce_production_safety()

    if not confirm:
        logger.error("🛑 Cleanup aborted: You MUST pass --confirm to delete test data.")
        sys.exit(1)

    prefix = settings.LOAD_TEST_USERNAME_PREFIX
    logger.info("Purging test data matching prefix '%s'...", prefix)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async with async_session() as db:
        # 1. Fetch all test member IDs
        stmt = select(MemberProfile.id).where(MemberProfile.email.like(f"{prefix}%"))
        res = await db.execute(stmt)
        member_ids = res.scalars().all()

        if member_ids:
            logger.info("Found %d test student members to clean up.", len(member_ids))

            # Cascade delete submissions, registrations, and scoreboard entries
            await db.execute(delete(ContestSubmission).where(ContestSubmission.member_id.in_(member_ids)))
            await db.execute(delete(ContestRegistration).where(ContestRegistration.member_id.in_(member_ids)))
            await db.execute(delete(ScoreboardEntry).where(ScoreboardEntry.member_id.in_(member_ids)))
            await db.execute(delete(MemberProfile).where(MemberProfile.id.in_(member_ids)))
            await db.commit()
            logger.info("✓ Deleted database records for %d test members.", len(member_ids))
        else:
            logger.info("No test members matching '%s' found in database.", prefix)

    # Clean up Redis OTP keys
    keys = await redis_client.keys(f"otp:email:{prefix}*")
    keys.extend(await redis_client.keys(f"otp:txn_{prefix}*"))
    if keys:
        await redis_client.delete(*keys)
        logger.info("✓ Deleted %d Redis OTP keys.", len(keys))

    await engine.dispose()
    await redis_client.close()
    logger.info("✓ Cleanup complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Safely clean up load test entities.")
    parser.add_argument("--confirm", action="store_true", help="Explicit confirmation to execute purge")
    args = parser.parse_args()
    asyncio.run(cleanup(confirm=args.confirm))
