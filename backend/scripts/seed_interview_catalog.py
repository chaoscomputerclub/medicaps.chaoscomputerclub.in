"""
Chaos Computer Club — Medi-Caps Chapter
scripts/seed_interview_catalog.py — Seed & Verify Interview Tracks & Blueprints in PostgreSQL

Usage:
    PYTHONPATH=. python3 scripts/seed_interview_catalog.py
"""

import asyncio
import os
import sys

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select, func
from app.core.db import AsyncSessionLocal, init_db
from app.models.interview import (
    InterviewDomain,
    InterviewBlueprintModel,
    InterviewBlueprintVersionModel,
)
from app.services.interview.blueprint_registry import BlueprintRegistryService


async def main():
    print("=" * 70)
    print("⚡ SEEDING & SYNCHRONIZING INTERVIEW TRACKS TO DATABASE")
    print("=" * 70)

    # 1. Initialize DB and run DDL
    print("→ Running init_db() and schema integrity checks...")
    await init_db()

    # 2. Sync blueprints
    async with AsyncSessionLocal() as session:
        print("→ Synchronizing pre-seeded blueprints via BlueprintRegistryService...")
        await BlueprintRegistryService.sync_preseeded_to_db(session)

        # 3. Query & report domains
        d_res = await session.execute(
            select(InterviewDomain).order_by(InterviewDomain.display_order, InterviewDomain.slug)
        )
        domains = d_res.scalars().all()
        print(f"\n✓ Found {len(domains)} Interview Domains in PostgreSQL:")
        for d in domains:
            print(f"  • [{d.category}] {d.name} ({d.slug}) - active={d.is_active}")

        # 4. Query & report blueprints
        bp_res = await session.execute(
            select(InterviewBlueprintModel).order_by(InterviewBlueprintModel.slug)
        )
        blueprints = bp_res.scalars().all()
        print(f"\n✓ Found {len(blueprints)} Interview Blueprints in PostgreSQL:")
        for bp in blueprints:
            print(f"  • {bp.title} ({bp.slug}) - status={bp.status}")

        # 5. Query & report versions
        ver_count = await session.scalar(select(func.count(InterviewBlueprintVersionModel.id)))
        print(f"\n✓ Total Blueprint Versions stored: {ver_count}")

    print("\n" + "=" * 70)
    print("✨ ALL INTERVIEW TRACKS AND BLUEPRINTS SUCCESSFULLY SEEDED!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())

