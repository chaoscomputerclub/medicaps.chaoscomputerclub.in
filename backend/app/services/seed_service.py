"""
Chaos Computer Club — Seed Service
Completely blank database policy: no dummy/static records are seeded.
"""
from sqlalchemy.ext.asyncio import AsyncSession

async def seed_database(db: AsyncSession):
    """No-op: Database remains completely blank."""
    pass
