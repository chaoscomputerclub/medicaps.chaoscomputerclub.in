"""
Chaos Computer Club — Medi-Caps Chapter
lib/chunking.py — High-performance data chunking, batch slicing, and concurrency throttling.
"""

import asyncio
from typing import Any, AsyncGenerator, Callable, Coroutine, Generator, Iterable, List, Sequence, TypeVar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")
R = TypeVar("R")


def chunk_list(items: Sequence[T], chunk_size: int = 100) -> Generator[Sequence[T], None, None]:
    """Yield successive chunks of `chunk_size` from a sequence."""
    if chunk_size <= 0:
        chunk_size = 100
    for i in range(0, len(items), chunk_size):
        yield items[i : i + chunk_size]


async def gather_with_concurrency(
    max_concurrency: int,
    *coros: Coroutine[Any, Any, R],
) -> List[R]:
    """
    Execute coroutines concurrently up to `max_concurrency` using an asyncio.Semaphore.
    Prevents burst overload on downstream microservices, containers, or databases.
    """
    sem = asyncio.Semaphore(max_concurrency)

    async def _sem_wrapper(coro: Coroutine[Any, Any, R]) -> R:
        async with sem:
            return await coro

    return await asyncio.gather(*(_sem_wrapper(c) for c in coros))


async def chunked_in_query(
    session: AsyncSession,
    model: Any,
    column: Any,
    values: Sequence[Any],
    chunk_size: int = 200,
    order_by_col: Any = None,
) -> List[Any]:
    """
    Query rows matching `column.in_(values)` by chunking `values` into slices of `chunk_size`.
    Prevents SQL parser query length exhaustion (e.g. SQLite / Postgres variable limits).
    """
    if not values:
        return []

    distinct_values = list(dict.fromkeys(values))
    all_results: List[Any] = []

    for val_chunk in chunk_list(distinct_values, chunk_size):
        stmt = select(model).where(column.in_(val_chunk))
        if order_by_col is not None:
            stmt = stmt.order_by(order_by_col)
        res = await session.execute(stmt)
        all_results.extend(res.scalars().all())

    return all_results
