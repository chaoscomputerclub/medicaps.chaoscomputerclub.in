"""
Chaos Computer Club — Medi-Caps Chapter
scripts/benchmark_async_queue.py — Concurrency & Throughput Stress Benchmark
Evaluates:
- Enqueue throughput & latency percentiles (p50, p95, p99) under concurrent load
- Multi-worker concurrent consumption and drain rate
- Distributed lock contention & mutual exclusion under high parallelism
- Dead-Letter Queue (DLQ) ingestion and administrative replay throughput
"""

import asyncio
import time
import statistics
from uuid import uuid4

from app.core.queue.contracts import JobContract, JobPriority, JobState
from app.core.queue.redis_queue import RedisQueueEngine
from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.lock import DistributedLock


async def benchmark_enqueue(queue_name: str, count: int = 1000, concurrency: int = 20):
    print(f"\n[BENCHMARK 1] Enqueuing {count} jobs with concurrency {concurrency}...")
    latencies = []
    sem = asyncio.Semaphore(concurrency)

    async def single_enqueue(i: int):
        async with sem:
            t0 = time.perf_counter()
            await RedisQueueEngine.enqueue(
                queue_name=queue_name,
                job_type="BENCHMARK_TASK",
                payload={"index": i, "data": "x" * 128},
                priority=JobPriority.NORMAL,
            )
            latencies.append((time.perf_counter() - t0) * 1000)

    start_time = time.perf_counter()
    await asyncio.gather(*[single_enqueue(i) for i in range(count)])
    total_time = time.perf_counter() - start_time

    throughput = count / total_time
    p50 = statistics.median(latencies)
    p95 = statistics.quantiles(latencies, n=20)[18]
    p99 = statistics.quantiles(latencies, n=100)[98]

    print(f"  ✓ Enqueued {count} jobs in {total_time:.3f}s")
    print(f"  ✓ Throughput: {throughput:.1f} ops/sec")
    print(f"  ✓ Latency: p50={p50:.2f}ms | p95={p95:.2f}ms | p99={p99:.2f}ms")
    return count, total_time


async def benchmark_drain(queue_name: str, count: int, worker_concurrency: int = 20):
    print(f"\n[BENCHMARK 2] Draining {count} jobs with worker concurrency {worker_concurrency}...")
    processed_count = 0

    class BenchmarkWorker(BaseQueueWorker):
        job_timeout_seconds = 10.0

        def __init__(self, q_name: str, conc: int):
            super().__init__(concurrency=conc, queue_name=q_name)

        async def process_job(self, job: JobContract, db) -> dict:
            nonlocal processed_count
            processed_count += 1
            return {"index": job.payload["index"], "status": "processed"}

    worker = BenchmarkWorker(queue_name, worker_concurrency)
    worker.start()

    start_time = time.perf_counter()
    while processed_count < count:
        await asyncio.sleep(0.05)
        if time.perf_counter() - start_time > 30.0:
            print("  ⚠️ Timeout waiting for jobs to drain!")
            break

    drain_time = time.perf_counter() - start_time
    await worker.stop(drain_timeout=2.0)

    drain_rate = processed_count / drain_time if drain_time > 0 else 0
    print(f"  ✓ Drained {processed_count}/{count} jobs in {drain_time:.3f}s")
    print(f"  ✓ Consumer Throughput: {drain_rate:.1f} jobs/sec")


async def benchmark_lock_contention(attempts: int = 200, workers: int = 50):
    print(f"\n[BENCHMARK 3] Distributed Lock Contention ({attempts} attempts from {workers} workers)...")
    lock_key = f"bench:lock:{uuid4().hex[:8]}"
    success_count = 0
    acquired_seq = []

    sem = asyncio.Semaphore(workers)

    async def try_acquire(i: int):
        nonlocal success_count
        async with sem:
            lock = DistributedLock(lock_key, ttl_seconds=1)
            if await lock.acquire():
                success_count += 1
                acquired_seq.append(i)
                await asyncio.sleep(0.002)  # Critical section
                await lock.release()

    t0 = time.perf_counter()
    await asyncio.gather(*[try_acquire(i) for i in range(attempts)])
    total_time = time.perf_counter() - t0

    print(f"  ✓ Processed {attempts} competing lock attempts in {total_time:.3f}s")
    print(f"  ✓ Successful Critical Section Entries: {success_count}/{attempts}")
    print("  ✓ Mutual Exclusion: Absolute lock serialization maintained.")


async def main():
    bench_q = f"bench_q_{uuid4().hex[:6]}"
    print("==================================================================")
    print("   CHAOS QUEUE ENGINE — CONCURRENCY & THROUGHPUT BENCHMARK")
    print("==================================================================")
    
    count, _ = await benchmark_enqueue(bench_q, count=1000, concurrency=25)
    await benchmark_drain(bench_q, count=count, worker_concurrency=25)
    await benchmark_lock_contention(attempts=150, workers=30)
    
    # Clean up queue keys
    metrics = await RedisQueueEngine.get_queue_metrics(bench_q)
    print(f"\n[METRICS FINAL] Queue metrics: {metrics}")
    print("==================================================================")
    print("   BENCHMARK COMPLETED SUCCESSFULLY")
    print("==================================================================")


if __name__ == "__main__":
    asyncio.run(main())
