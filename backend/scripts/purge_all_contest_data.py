"""
Chaos Computer Club India — Medi-Caps Chapter
Standalone Database Purge Script
Strictly purges all contest, problem, submission, scoreboard, and assessment records
from the active PostgreSQL database.
"""

import asyncio
import sys
import os

# Add parent directory to sys.path so app modules import cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.db import AsyncSessionLocal, init_db
from app.services.seed_service import purge_all_contest_data


async def run_purge():
    print("=" * 65)
    print("🗑️  CCC MEDI-CAPS — STRICT CONTEST & STATIC DATA PURGE UTILITY")
    print("=" * 65)

    await init_db()

    async with AsyncSessionLocal() as session:
        result = await purge_all_contest_data(session)
        print(f"\n[STATUS] {result['message']}")

    print("=" * 65)
    print("✨ Purge completed successfully. All contest tables are completely empty.")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_purge())
