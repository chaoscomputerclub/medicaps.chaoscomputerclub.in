"""
Chaos Computer Club — Event Coalescing Coordinator
Buffers high-frequency discardable events (e.g. rapid scoreboard ticks)
within a micro-batch window so only the latest monotonic version is emitted.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, Coroutine, Dict, Optional

from app.core.cache.contracts import CacheSyncEvent
from app.core.cache.metrics import metrics

logger = logging.getLogger("ccc.cache.coalescing")


class EventCoalescer:
    """Coalesces rapid intermediate events for the same coalesce_key."""

    def __init__(self, window_seconds: float = 0.25):
        self.window_seconds = window_seconds
        self._pending: Dict[str, CacheSyncEvent] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def submit(
        self,
        event: CacheSyncEvent,
        flush_handler: Callable[[CacheSyncEvent], Coroutine[None, None, Any]],
    ) -> bool:
        """
        Submit an event for coalescing.
        If coalesce_key is not specified, bypass coalescing.
        Returns True if queued for coalescing, False if bypassed.
        """
        if not event.coalesce_key:
            return False

        ck = event.coalesce_key
        async with self._lock:
            existing = self._pending.get(ck)
            if existing is not None:
                # Retain whichever has the higher version
                if event.version > existing.version:
                    self._pending[ck] = event
                    metrics.inc_coalesced()
                    logger.debug("Coalesced event for '%s' to version %d", ck, event.version)
                return True

            # First event in window: store and schedule flush
            self._pending[ck] = event
            loop = asyncio.get_running_loop()
            self._tasks[ck] = loop.create_task(self._scheduled_flush(ck, flush_handler))
            return True

    async def _scheduled_flush(
        self,
        coalesce_key: str,
        flush_handler: Callable[[CacheSyncEvent], Coroutine[None, None, Any]],
    ) -> None:
        try:
            await asyncio.sleep(self.window_seconds)
            event_to_flush: Optional[CacheSyncEvent] = None
            async with self._lock:
                event_to_flush = self._pending.pop(coalesce_key, None)
                self._tasks.pop(coalesce_key, None)

            if event_to_flush is not None:
                logger.debug("Flushing coalesced event for '%s' (v%d)", coalesce_key, event_to_flush.version)
                await flush_handler(event_to_flush)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Error flushing coalesced event for '%s': %s", coalesce_key, exc)


coalescer = EventCoalescer()
