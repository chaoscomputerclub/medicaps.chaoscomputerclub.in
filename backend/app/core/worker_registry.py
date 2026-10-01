"""
Chaos Computer Club — Medi-Caps Chapter
core/worker_registry.py — Distributed Worker Registry

Manages the set of all registered judge workers (cloud + laptop agent).
Every worker registers via POST /workers/register, sends heartbeats every
5-10s, and is automatically marked OFFLINE when the heartbeat TTL expires.

Redis layout:
  ccc:worker:{id}              HASH   — static + live metadata
  ccc:worker:{id}:heartbeat    STRING — Unix timestamp, TTL=WORKER_HEARTBEAT_TTL_S
  ccc:workers:active           SET    — IDs of currently-healthy workers
  ccc:workers:all              SET    — IDs of all ever-registered workers
"""

from __future__ import annotations

import logging
import time
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.redis import get_redis

logger = logging.getLogger("ccc.worker_registry")

HEARTBEAT_TTL_S = 30
SUSPECT_AFTER_S = 10
REGISTRY_KEY_PREFIX = "ccc:worker"
ACTIVE_SET_KEY = "ccc:workers:active"
ALL_SET_KEY = "ccc:workers:all"


class WorkerStatus(str, Enum):
    HEALTHY = "healthy"
    SUSPECT = "suspect"
    OFFLINE = "offline"
    DRAINING = "draining"


class WorkerInfo:
    __slots__ = (
        "worker_id", "hostname", "cpu_cores", "cpu_threads",
        "memory_mb", "available_memory_mb", "max_concurrency", "running_jobs",
        "languages", "status", "agent_version", "docker_version",
        "registered_at", "last_heartbeat", "cpu_pct", "ram_free_mb", "available_slots",
    )

    def __init__(
        self,
        worker_id: str,
        hostname: str,
        cpu_cores: int,
        cpu_threads: int,
        memory_mb: int,
        available_memory_mb: int,
        max_concurrency: int,
        running_jobs: int,
        languages: List[str],
        status: WorkerStatus,
        agent_version: str,
        docker_version: str,
        registered_at: float,
        last_heartbeat: float,
        cpu_pct: float = 0.0,
        ram_free_mb: int = 0,
    ):
        self.worker_id = worker_id
        self.hostname = hostname
        self.cpu_cores = cpu_cores
        self.cpu_threads = cpu_threads
        self.memory_mb = memory_mb
        self.available_memory_mb = available_memory_mb
        self.max_concurrency = max_concurrency
        self.running_jobs = running_jobs
        self.languages = languages
        self.status = status
        self.agent_version = agent_version
        self.docker_version = docker_version
        self.registered_at = registered_at
        self.last_heartbeat = last_heartbeat
        self.cpu_pct = cpu_pct
        self.ram_free_mb = ram_free_mb
        self.available_slots = max(0, max_concurrency - running_jobs)

    def to_redis_dict(self) -> Dict[str, str]:
        return {
            "worker_id": self.worker_id,
            "hostname": self.hostname,
            "cpu_cores": str(self.cpu_cores),
            "cpu_threads": str(self.cpu_threads),
            "memory_mb": str(self.memory_mb),
            "available_memory_mb": str(self.available_memory_mb),
            "max_concurrency": str(self.max_concurrency),
            "running_jobs": str(self.running_jobs),
            "languages": ",".join(self.languages),
            "status": self.status.value,
            "agent_version": self.agent_version,
            "docker_version": self.docker_version,
            "registered_at": str(self.registered_at),
            "last_heartbeat": str(self.last_heartbeat),
            "cpu_pct": str(self.cpu_pct),
            "ram_free_mb": str(self.ram_free_mb),
        }

    @classmethod
    def from_redis_dict(cls, d: Dict[str, str]) -> "WorkerInfo":
        return cls(
            worker_id=d["worker_id"],
            hostname=d.get("hostname", "unknown"),
            cpu_cores=int(d.get("cpu_cores", 1)),
            cpu_threads=int(d.get("cpu_threads", 1)),
            memory_mb=int(d.get("memory_mb", 1024)),
            available_memory_mb=int(d.get("available_memory_mb", 512)),
            max_concurrency=int(d.get("max_concurrency", 4)),
            running_jobs=int(d.get("running_jobs", 0)),
            languages=d.get("languages", "python").split(","),
            status=WorkerStatus(d.get("status", "offline")),
            agent_version=d.get("agent_version", "unknown"),
            docker_version=d.get("docker_version", "unknown"),
            registered_at=float(d.get("registered_at", 0)),
            last_heartbeat=float(d.get("last_heartbeat", 0)),
            cpu_pct=float(d.get("cpu_pct", 0.0)),
            ram_free_mb=int(d.get("ram_free_mb", 0)),
        )


class WorkerRegistry:
    """Redis-backed registry for all judge workers."""

    @staticmethod
    def _worker_key(worker_id: str) -> str:
        return f"{REGISTRY_KEY_PREFIX}:{worker_id}"

    @staticmethod
    def _heartbeat_key(worker_id: str) -> str:
        return f"{REGISTRY_KEY_PREFIX}:{worker_id}:heartbeat"

    @classmethod
    async def register(
        cls,
        hostname: str,
        cpu_cores: int,
        cpu_threads: int,
        memory_mb: int,
        max_concurrency: int,
        languages: List[str],
        agent_version: str,
        docker_version: str,
        worker_id: Optional[str] = None,
    ) -> WorkerInfo:
        r = get_redis()
        wid = worker_id or f"worker-{hostname}-{uuid4().hex[:8]}"
        now = time.time()
        info = WorkerInfo(
            worker_id=wid, hostname=hostname, cpu_cores=cpu_cores,
            cpu_threads=cpu_threads, memory_mb=memory_mb,
            available_memory_mb=memory_mb, max_concurrency=max_concurrency,
            running_jobs=0, languages=languages, status=WorkerStatus.HEALTHY,
            agent_version=agent_version, docker_version=docker_version,
            registered_at=now, last_heartbeat=now, cpu_pct=0.0, ram_free_mb=memory_mb,
        )
        pipe = r.pipeline()
        pipe.hset(cls._worker_key(wid), mapping=info.to_redis_dict())
        pipe.set(cls._heartbeat_key(wid), str(now), ex=HEARTBEAT_TTL_S)
        pipe.sadd(ACTIVE_SET_KEY, wid)
        pipe.sadd(ALL_SET_KEY, wid)
        await pipe.execute()
        logger.info("Worker registered: %s (host=%s, cores=%d, mem=%dMB)", wid, hostname, cpu_cores, memory_mb)
        return info

    @classmethod
    async def heartbeat(
        cls,
        worker_id: str,
        cpu_pct: float = 0.0,
        ram_free_mb: int = 0,
        running_jobs: int = 0,
        available_memory_mb: Optional[int] = None,
        status: WorkerStatus = WorkerStatus.HEALTHY,
    ) -> bool:
        r = get_redis()
        now = time.time()
        exists = await r.exists(cls._worker_key(worker_id))
        if not exists:
            logger.warning("Heartbeat from unknown worker %s", worker_id)
            return False
        pipe = r.pipeline()
        pipe.hset(cls._worker_key(worker_id), mapping={
            "cpu_pct": str(cpu_pct),
            "ram_free_mb": str(ram_free_mb),
            "running_jobs": str(running_jobs),
            "available_memory_mb": str(available_memory_mb or ram_free_mb),
            "last_heartbeat": str(now),
            "status": status.value,
        })
        pipe.set(cls._heartbeat_key(worker_id), str(now), ex=HEARTBEAT_TTL_S)
        pipe.sadd(ACTIVE_SET_KEY, worker_id)
        await pipe.execute()
        return True

    @classmethod
    async def get_worker_health(cls, worker_id: str) -> WorkerStatus:
        r = get_redis()
        hb = await r.get(cls._heartbeat_key(worker_id))
        if hb is None:
            return WorkerStatus.OFFLINE
        age = time.time() - float(hb)
        if age < SUSPECT_AFTER_S:
            return WorkerStatus.HEALTHY
        return WorkerStatus.SUSPECT

    @classmethod
    async def mark_offline(cls, worker_id: str) -> None:
        r = get_redis()
        await r.hset(cls._worker_key(worker_id), "status", WorkerStatus.OFFLINE.value)
        await r.srem(ACTIVE_SET_KEY, worker_id)
        logger.warning("Worker %s marked OFFLINE", worker_id)

    @classmethod
    async def mark_draining(cls, worker_id: str) -> None:
        r = get_redis()
        await r.hset(cls._worker_key(worker_id), "status", WorkerStatus.DRAINING.value)
        await r.srem(ACTIVE_SET_KEY, worker_id)
        logger.info("Worker %s marked DRAINING", worker_id)

    @classmethod
    async def get_worker(cls, worker_id: str) -> Optional[WorkerInfo]:
        r = get_redis()
        data = await r.hgetall(cls._worker_key(worker_id))
        if not data:
            return None
        info = WorkerInfo.from_redis_dict(data)
        info.status = await cls.get_worker_health(worker_id)
        info.available_slots = max(0, info.max_concurrency - info.running_jobs)
        return info

    @classmethod
    async def get_all_active_workers(cls) -> List[WorkerInfo]:
        r = get_redis()
        worker_ids = await r.smembers(ACTIVE_SET_KEY)
        workers = []
        for wid in worker_ids:
            info = await cls.get_worker(wid)
            if info:
                if info.status == WorkerStatus.OFFLINE:
                    await r.srem(ACTIVE_SET_KEY, wid)
                    await r.hset(cls._worker_key(wid), "status", WorkerStatus.OFFLINE.value)
                else:
                    workers.append(info)
        return workers

    @classmethod
    async def list_active(cls) -> List[WorkerInfo]:
        """Alias for get_all_active_workers for autoscaler compatibility."""
        return await cls.get_all_active_workers()
    async def get_all_workers(cls) -> List[WorkerInfo]:
        r = get_redis()
        worker_ids = await r.smembers(ALL_SET_KEY)
        workers = []
        for wid in worker_ids:
            info = await cls.get_worker(wid)
            if info:
                workers.append(info)
        return workers

    @classmethod
    async def unregister(cls, worker_id: str) -> None:
        r = get_redis()
        pipe = r.pipeline()
        pipe.srem(ACTIVE_SET_KEY, worker_id)
        pipe.srem(ALL_SET_KEY, worker_id)
        pipe.delete(cls._worker_key(worker_id))
        pipe.delete(cls._heartbeat_key(worker_id))
        await pipe.execute()
        logger.info("Worker %s unregistered cleanly", worker_id)

    @classmethod
    async def increment_running_jobs(cls, worker_id: str) -> None:
        r = get_redis()
        await r.hincrby(cls._worker_key(worker_id), "running_jobs", 1)

    @classmethod
    async def decrement_running_jobs(cls, worker_id: str) -> None:
        r = get_redis()
        await r.hincrby(cls._worker_key(worker_id), "running_jobs", -1)

    @classmethod
    async def get_registry_summary(cls) -> Dict[str, Any]:
        workers = await cls.get_all_workers()
        healthy = [w for w in workers if w.status == WorkerStatus.HEALTHY]
        suspect = [w for w in workers if w.status == WorkerStatus.SUSPECT]
        offline = [w for w in workers if w.status == WorkerStatus.OFFLINE]
        draining = [w for w in workers if w.status == WorkerStatus.DRAINING]
        total_slots = sum(w.available_slots for w in healthy + suspect)
        return {
            "total_workers": len(workers),
            "healthy": len(healthy),
            "suspect": len(suspect),
            "offline": len(offline),
            "draining": len(draining),
            "total_available_slots": total_slots,
            "workers": [
                {
                    "worker_id": w.worker_id,
                    "hostname": w.hostname,
                    "status": w.status.value,
                    "running_jobs": w.running_jobs,
                    "available_slots": w.available_slots,
                    "cpu_pct": w.cpu_pct,
                    "ram_free_mb": w.ram_free_mb,
                    "last_heartbeat": w.last_heartbeat,
                    "agent_version": w.agent_version,
                }
                for w in workers
            ],
        }
