#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform — Test User Provisioning Script
Pre-creates 50+ deterministic student personas in PostgreSQL and seeds their OTP sessions in Redis.
Enables instant HTTP-based authentication for Locust virtual users.
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import redis.asyncio as aioredis

# Ensure root directory is in sys.path
ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))

from tests.load.config.settings import settings
from backend.app.models.member import MemberProfile
from backend.app.lib.otp import hash_otp

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.loadtest.seed_users")


async def main():
    settings.enforce_production_safety()

    data_file = Path(__file__).resolve().parent.parent / "data" / "users.json"
    with open(data_file, "r") as f:
        users_data = json.load(f)

    logger.info("Connecting to PostgreSQL: %s", settings.DATABASE_URL.split("@")[-1])
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    logger.info("Connecting to Redis: %s", settings.REDIS_URL.split("@")[-1])
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    created_count = 0
    updated_count = 0

    async with async_session() as db:
        for u in users_data:
            email = u["email"].strip().lower()
            handle = u["handle"]
            full_name = u["full_name"]
            prn = f"0827CS221{u['index']:03d}"
            otp = u.get("default_otp", "123456")

            # 1. Upsert Member Profile in Database
            stmt = select(MemberProfile).where(MemberProfile.email == email)
            res = await db.execute(stmt)
            member = res.scalars().first()

            if not member:
                member = MemberProfile(
                    email=email,
                    handle=handle,
                    full_name=full_name,
                    prn=prn,
                    department="CSE",
                    batch="2022-26",
                    rating=1200,
                    peak_rating=1200,
                    is_onboarded=True,
                    is_core_member=False,
                )
                db.add(member)
                created_count += 1
            else:
                member.handle = handle
                member.full_name = full_name
                member.is_onboarded = True
                updated_count += 1

            # 2. Seed OTP in Redis for HTTP verify-otp authentication
            payload = json.dumps({
                "email": email,
                "hashedOTP": hash_otp(otp),
                "attempts": 0,
                "transaction_id": f"txn_{u['username']}",
            })
            await redis_client.setex(f"otp:email:{email}", 86400, payload)
            await redis_client.setex(f"otp:txn_{u['username']}", 86400, payload)

        await db.commit()

    await engine.dispose()
    await redis_client.close()

    logger.info("✓ User Provisioning Complete: %d created, %d updated in DB & Redis.", created_count, updated_count)


if __name__ == "__main__":
    asyncio.run(main())
