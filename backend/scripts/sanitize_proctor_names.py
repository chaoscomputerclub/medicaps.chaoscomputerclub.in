"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Script: sanitize_proctor_names.py
Sanitizes existing contest records and campus passes in the database, replacing any faculty names
with official CCC Proctor Command titles.
"""

import asyncio
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select
from app.core.db import AsyncSessionLocal, init_db
from app.models.contest import OfflineContest
from app.models.campus_pass import CampusPass
from app.core.cache import delete_cache_pattern


async def sanitize():
    print("=" * 70)
    print("⚡ [CCC] Sanitizing Proctor Names in Database")
    print("=" * 70)

    await init_db()

    async with AsyncSessionLocal() as db:
        # 1. Update Contests chief_proctors
        res = await db.execute(select(OfflineContest))
        contests = res.scalars().all()
        updated_contests = 0
        for contest in contests:
            proctors = contest.chief_proctors or []
            has_faculty = any(
                ("Ratnesh" in str(p) or "Litoriya" in str(p) or "Shrivastava" in str(p) or "Panse" in str(p) or "Faculty" in str(p))
                for p in proctors
            )
            if has_faculty or not proctors:
                contest.chief_proctors = ["Chief Proctor (CCC Core)", "CCC Operations Desk"]
                updated_contests += 1

        # 2. Update CampusPasses checked_in_by
        p_res = await db.execute(select(CampusPass))
        passes = p_res.scalars().all()
        updated_passes = 0
        for p in passes:
            if p.checked_in_by and ("Ratnesh" in p.checked_in_by or "Litoriya" in p.checked_in_by or "Shrivastava" in p.checked_in_by or "Faculty" in p.checked_in_by):
                p.checked_in_by = "Chief Proctor (CCC Core)"
                updated_passes += 1

        await db.commit()
        print(f"✓ Sanitized {updated_contests} contest records.")
        print(f"✓ Sanitized {updated_passes} campus pass records.")

    # 3. Clear caches
    await delete_cache_pattern("contest*")
    await delete_cache_pattern("contests*")
    await delete_cache_pattern("pass*")
    await delete_cache_pattern("portal*")
    print("✓ Cleared all related cache keys.")
    print("=" * 70)
    print("⚡ Proctor Name Sanitization Complete.")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(sanitize())
