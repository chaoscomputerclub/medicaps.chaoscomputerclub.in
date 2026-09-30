"""
Chaos Computer Club — Medi-Caps Chapter Backend Test Suite
Session-wide fixtures and database initialization.
"""

import pytest
import pytest_asyncio
from app.core.db import init_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Ensure database tables, schema, and indexes exist before test execution."""
    try:
        await init_db()
    except Exception as e:
        print(f"Notice during test database initialization: {e}")


@pytest_asyncio.fixture(autouse=True)
async def cleanup_connections_per_test():
    yield
    from app.core.db import engine
    try:
        await engine.dispose()
    except Exception:
        pass

