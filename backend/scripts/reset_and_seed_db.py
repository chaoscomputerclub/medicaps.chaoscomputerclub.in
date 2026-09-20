"""
Chaos Computer Club India — Database Clean Reset Utility
Drops all tables, creates fresh empty schemas with zero mock or static data.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.db import engine, Base
import app.models.db_models  # noqa: F401


async def reset_db():
    print("=" * 60)
    print("⚡ [CCC] Database Clean Drop & Fresh Empty Schema Creation")
    print("=" * 60)

    # 1. Drop all tables
    print("🛑 Step 1: Dropping all existing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("  ✓ All tables dropped successfully.")

    # 2. Recreate all tables
    print("\n📦 Step 2: Creating all tables with clean schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  ✓ Tables created successfully (Zero static data).")

    print("\n" + "=" * 60)
    print("🎉 DATABASE HAS BEEN CLEANLY RECREATED IN PURE STATE!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(reset_db())
