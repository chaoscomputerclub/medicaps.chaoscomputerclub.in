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
    from app.core.config import settings
    settings.ALLOW_UNSANDBOXED_EXECUTION = True
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
    try:
        from app.engine.circuit_breaker import CodeboxCircuitBreaker
        await CodeboxCircuitBreaker.get_instance().record_success()
    except Exception:
        pass

