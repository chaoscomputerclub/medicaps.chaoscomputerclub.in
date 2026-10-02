"""
Chaos Computer Club — Medi-Caps Chapter
routers/metrics.py — Prometheus /metrics Exposition Endpoint
"""

from __future__ import annotations

import logging
from typing import List
from fastapi import APIRouter, Response
from fastapi.responses import PlainTextResponse

from app.core.queue.redis_queue import RedisQueueEngine
from app.core.worker_registry import WorkerRegistry
from app.core.cache.metrics import CacheSyncMetrics

logger = logging.getLogger("ccc.metrics")

router = APIRouter(tags=["Metrics"])


def _format_metric(name: str, doc: str, metric_type: str, lines: List[str]) -> str:
    if not lines:
        return ""
    header = f"# HELP {name} {doc}\n# TYPE {name} {metric_type}\n"
    return header + "\n".join(lines) + "\n"


@router.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics() -> Response:
    """
    Exposes system metrics in standard Prometheus text exposition format (version 0.0.4).
    Scraped by Prometheus / VictoriaMetrics for cluster telemetry & alerting.
    """
    out: List[str] = []

    # ─── 1. Queue Metrics ────────────────────────────────────────────────────────
    try:
        queue_metrics = await RedisQueueEngine.get_all_metrics()

        pending_lines = []
        processing_lines = []
        delayed_lines = []
        dlq_lines = []
        active_lines = []

        for q_name, stats in queue_metrics.items():
            pending_lines.append(f'ccc_queue_pending{{queue="{q_name}"}} {stats.get("pending", 0)}')
            processing_lines.append(f'ccc_queue_processing{{queue="{q_name}"}} {stats.get("processing", 0)}')
            delayed_lines.append(f'ccc_queue_delayed{{queue="{q_name}"}} {stats.get("delayed", 0)}')
            dlq_lines.append(f'ccc_queue_dead_letter{{queue="{q_name}"}} {stats.get("dead_letter", 0)}')
            active_lines.append(f'ccc_queue_total_active{{queue="{q_name}"}} {stats.get("total_active", 0)}')

        out.append(_format_metric("ccc_queue_pending", "Number of pending jobs in queue", "gauge", pending_lines))
        out.append(_format_metric("ccc_queue_processing", "Number of actively processing jobs in queue", "gauge", processing_lines))
        out.append(_format_metric("ccc_queue_delayed", "Number of delayed jobs in queue", "gauge", delayed_lines))
        out.append(_format_metric("ccc_queue_dead_letter", "Number of dead letter jobs in queue", "gauge", dlq_lines))
        out.append(_format_metric("ccc_queue_total_active", "Total active jobs across pending, processing, delayed", "gauge", active_lines))
    except Exception as exc:
        logger.debug("Error collecting queue metrics: %s", exc)

    # ─── 2. Worker Registry Metrics ──────────────────────────────────────────────
    try:
        summary = await WorkerRegistry.get_registry_summary()
        out.append(_format_metric("ccc_workers_total", "Total registered judge workers", "gauge", [f"ccc_workers_total {summary.get('total_workers', 0)}"]))
        out.append(_format_metric("ccc_workers_healthy", "Healthy judge workers", "gauge", [f"ccc_workers_healthy {summary.get('healthy', 0)}"]))
        out.append(_format_metric("ccc_workers_suspect", "Suspect judge workers (missing heartbeats)", "gauge", [f"ccc_workers_suspect {summary.get('suspect', 0)}"]))
        out.append(_format_metric("ccc_workers_offline", "Offline judge workers", "gauge", [f"ccc_workers_offline {summary.get('offline', 0)}"]))
        out.append(_format_metric("ccc_workers_draining", "Draining judge workers", "gauge", [f"ccc_workers_draining {summary.get('draining', 0)}"]))
        out.append(_format_metric("ccc_worker_available_slots_total", "Total available execution slots across healthy workers", "gauge", [f"ccc_worker_available_slots_total {summary.get('total_available_slots', 0)}"]))

        w_running = []
        w_avail = []
        w_cpu = []
        w_ram = []
        for w in summary.get("workers", []):
            wid = w["worker_id"]
            host = w["hostname"]
            w_running.append(f'ccc_worker_running_jobs{{worker_id="{wid}",hostname="{host}"}} {w["running_jobs"]}')
            w_avail.append(f'ccc_worker_available_slots{{worker_id="{wid}",hostname="{host}"}} {w["available_slots"]}')
            w_cpu.append(f'ccc_worker_cpu_pct{{worker_id="{wid}",hostname="{host}"}} {w["cpu_pct"]}')
            w_ram.append(f'ccc_worker_ram_free_mb{{worker_id="{wid}",hostname="{host}"}} {w["ram_free_mb"]}')

        if w_running:
            out.append(_format_metric("ccc_worker_running_jobs", "Currently running jobs on worker", "gauge", w_running))
            out.append(_format_metric("ccc_worker_available_slots", "Available execution slots on worker", "gauge", w_avail))
            out.append(_format_metric("ccc_worker_cpu_pct", "Worker host CPU utilization percent", "gauge", w_cpu))
            out.append(_format_metric("ccc_worker_ram_free_mb", "Worker host free RAM in MB", "gauge", w_ram))
    except Exception as exc:
        logger.debug("Error collecting worker metrics: %s", exc)

    # ─── 3. Cache & Sync Observability ──────────────────────────────────────────
    try:
        c_metrics = CacheSyncMetrics.get_instance()
        out.append(_format_metric("ccc_cache_hits_total", "Cumulative cache hits", "counter", [f"ccc_cache_hits_total {c_metrics.cache_hit_total}"]))
        out.append(_format_metric("ccc_cache_misses_total", "Cumulative cache misses", "counter", [f"ccc_cache_misses_total {c_metrics.cache_miss_total}"]))
        out.append(_format_metric("ccc_cache_updates_total", "Cumulative cache updates", "counter", [f"ccc_cache_updates_total {c_metrics.cache_update_total}"]))
        out.append(_format_metric("ccc_cache_invalidations_total", "Cumulative cache invalidations", "counter", [f"ccc_cache_invalidations_total {c_metrics.cache_invalidation_total}"]))
        out.append(_format_metric("ccc_sse_connections_active", "Active SSE client connections", "gauge", [f"ccc_sse_connections_active {c_metrics.sse_connections_active}"]))
        out.append(_format_metric("ccc_sse_events_sent_total", "Cumulative SSE events sent to clients", "counter", [f"ccc_sse_events_sent_total {c_metrics.sse_events_sent_total}"]))
        out.append(_format_metric("ccc_sse_events_dropped_total", "Cumulative SSE events dropped", "counter", [f"ccc_sse_events_dropped_total {c_metrics.sse_events_dropped_total}"]))
        out.append(_format_metric("ccc_sse_reconnect_total", "Cumulative SSE client reconnects", "counter", [f"ccc_sse_reconnect_total {c_metrics.sse_reconnect_total}"]))
    except Exception as exc:
        logger.debug("Error collecting cache metrics: %s", exc)

    # ─── 4. Process Resource Telemetry ──────────────────────────────────────────
    try:
        import psutil
        proc = psutil.Process()
        mem_info = proc.memory_info()
        out.append(_format_metric("ccc_process_memory_rss_bytes", "Resident Memory Size of backend process", "gauge", [f"ccc_process_memory_rss_bytes {mem_info.rss}"]))
        out.append(_format_metric("ccc_process_cpu_percent", "CPU utilization of backend process", "gauge", [f"ccc_process_cpu_percent {proc.cpu_percent(interval=None)}"]))
    except Exception:
        pass

    # ─── 5. Autoscaler Telemetry ────────────────────────────────────────────────
    try:
        from app.core.autoscaler import Autoscaler
        a_status = Autoscaler.get_instance().get_status()
        out.append(_format_metric("ccc_autoscale_concurrency_current", "Current dynamic judge concurrency cap", "gauge", [f"ccc_autoscale_concurrency_current {a_status.get('current_concurrency', 4)}"]))
        out.append(_format_metric("ccc_autoscale_pressure_ratio", "Current queue pressure ratio", "gauge", [f"ccc_autoscale_pressure_ratio {a_status.get('pressure_ratio', 0.0)}"]))
        out.append(_format_metric("ccc_autoscale_alert_active", "1 if scaling alert is active, 0 otherwise", "gauge", [f"ccc_autoscale_alert_active {1 if a_status.get('scaling_alert_active') else 0}"]))
    except Exception as exc:
        logger.debug("Error collecting autoscale metrics: %s", exc)

    # ─── 6. Execution Observability Telemetry ────────────────────────────────────
    try:
        from app.engine.observability import ExecutionObservability
        from app.engine.circuit_breaker import CodeboxCircuitBreaker
        obs = ExecutionObservability.get_instance()
        for metric_name, val in obs.metrics.items():
            out.append(_format_metric(f"ccc_{metric_name}", f"Execution metric: {metric_name}", "gauge", [f"ccc_{metric_name} {val}"]))
        cb = CodeboxCircuitBreaker.get_instance()
        cb_state = await cb.get_state()
        state_num = 0 if cb_state.value == "CLOSED" else (1 if cb_state.value == "HALF_OPEN" else 2)
        out.append(_format_metric("ccc_circuit_breaker_state", "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)", "gauge", [f"ccc_circuit_breaker_state {state_num}"]))
    except Exception as exc:
        logger.debug("Error collecting execution observability metrics: %s", exc)

    content = "".join(filter(None, out))
    return PlainTextResponse(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")
