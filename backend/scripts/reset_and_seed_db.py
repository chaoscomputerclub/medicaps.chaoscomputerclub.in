"""
Chaos Computer Club India — Database Reset & Seeding Utility
Drops all tables, creates fresh schemas with all columns, and seeds official contest & assessment data.
"""

import asyncio
import sys
import os

from app.core.db import engine, AsyncSessionLocal, Base
from app.services.seed_service import seed_initial_data


async def reset_and_seed():
    print("=" * 60)
    print("⚡ [CCC] Database Clean Drop, Schema Recreate & Fresh Seeding")
    print("=" * 60)

    # 1. Drop all tables
    print("🛑 Step 1: Dropping all existing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("  ✓ All tables dropped successfully.")

    # 2. Recreate all tables
    print("\n📦 Step 2: Creating all tables with updated schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  ✓ Tables created successfully.")

    # 3. Seed initial data
    print("\n🌱 Step 3: Seeding official contests, assessments, problems & testcases...")
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)
    print("  ✓ Official data seeded successfully.")

    print("\n" + "=" * 60)
    print("🎉 DATABASE HAS BEEN CLEANLY DROPPED, RECREATED & SEEDED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(reset_and_seed())
