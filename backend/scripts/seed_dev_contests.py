import asyncio
import os
import sys

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = "/Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend"
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select
from app.core.db import AsyncSessionLocal, init_db
from app.models.db_models import OfflineContest, Assessment, ContestProblem, AssessmentProblem
from app.services.seed_service import seed_database, DEV_ASSESSMENT_SLUG, DEV_CONTEST_SLUG

async def main():
    print("⚡ Initializing database & running seed_database...")
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed_database(session)

        # Print summary
        c_res = await session.execute(select(OfflineContest))
        contests = c_res.scalars().all()
        print("\n=== Current Database Offline Contests ===")
        for c in contests:
            print(f"- [{c.status.upper()}] Slug: {c.slug} | Title: {c.title}")
            print(f"  Starts At: {c.starts_at} | Ends At: {c.ends_at}")

        a_res = await session.execute(select(Assessment))
        assessments = a_res.scalars().all()
        print("\n=== Current Database Assessments ===")
        for a in assessments:
            print(f"- Slug: {a.slug} | Title: {a.title} | Active: {a.is_active}")
            print(f"  Starts At: {a.starts_at} | Ends At: {a.ends_at}")

    print("\n✓ Seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
