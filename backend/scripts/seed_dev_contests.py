import asyncio
import os
import sys

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select
from app.core.db import AsyncSessionLocal, init_db
from app.models.db_models import OfflineContest, Assessment
from app.services.seed_service import purge_all_contest_data

async def main():
    print("⚡ Purging all static and contest data (Zero Static Data Standard)...")
    await init_db()
    async with AsyncSessionLocal() as session:
        res = await purge_all_contest_data(session)
        print(f"Status: {res['message']}")

        # Print summary
        c_res = await session.execute(select(OfflineContest))
        contests = c_res.scalars().all()
        print(f"\nRemaining Database Offline Contests: {len(contests)}")

        a_res = await session.execute(select(Assessment))
        assessments = a_res.scalars().all()
        print(f"Remaining Database Assessments: {len(assessments)}")

    print("\n✓ Clean verification complete!")

if __name__ == "__main__":
    asyncio.run(main())
