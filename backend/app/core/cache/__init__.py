"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Core Cache & Real-Time Cache Synchronization Package
Exposes backwards-compatible caching primitives alongside the production CacheSyncEngine.
"""

from app.core.cache.base import (
    CCCJsonEncoder,
    delete_cache,
    delete_cache_pattern,
    generate_etag,
    get_cache,
    set_cache,
)
from app.core.cache.contracts import (
    CacheSyncEvent,
    SyncResult,
    SyncStatus,
    SyncStrategy,
)
from app.core.cache.atomic_cas import (
    execute_atomic_cas_sync,
    get_cached_resource_version,
)
from app.core.cache.singleflight import (
    SingleFlight,
    single_flight,
)
from app.core.cache.swr import (
    SWREngine,
    swr_engine,
)
from app.core.cache.coalescing import (
    EventCoalescer,
    coalescer,
)
from app.core.cache.metrics import (
    CacheSyncMetrics,
    metrics,
)
from app.core.cache.sync_engine import (
    CacheSyncEngine,
    cache_sync_engine,
)

__all__ = [
    # Base cache primitives (backwards compatibility)
    "CCCJsonEncoder",
    "get_cache",
    "set_cache",
    "delete_cache",
    "delete_cache_pattern",
    "generate_etag",

    # Synchronization Contracts
    "CacheSyncEvent",
    "SyncStrategy",
    "SyncStatus",
    "SyncResult",

    # Atomic CAS & Versioning
    "execute_atomic_cas_sync",
    "get_cached_resource_version",

    # Concurrency & Resilience
    "SingleFlight",
    "single_flight",
    "SWREngine",
    "swr_engine",
    "EventCoalescer",
    "coalescer",

    # Telemetry
    "CacheSyncMetrics",
    "metrics",

    # Synchronization Coordinator
    "CacheSyncEngine",
    "cache_sync_engine",
]
