"""
Chaos Computer Club — Medi-Caps Chapter
engine/peer_fabric/registry.py — Peer Registry & Membership Lifecycle
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.redis import get_redis
from app.engine.peer_fabric.models import (
    PeerAdvertisement,
    PeerHeartbeat,
    PeerRecord,
    PeerState,
    PeerType,
)

logger = logging.getLogger("ccc.p2p.registry")

REDIS_ACTIVE_PEERS_SET = "ccc:peers:active"
REDIS_PEER_RECORD_PREFIX = "ccc:peer:record:"
REDIS_PEER_HEARTBEAT_PREFIX = "ccc:peer:heartbeat:"
HEARTBEAT_TTL_SECONDS = 15
REAP_THRESHOLD_SECONDS = 30


class PeerRegistry:
    """
    Decentralized, Redis/Postgres-backed Peer Registry managing dynamic
    federation, heartbeats, draining, and membership state transitions.
    """

    @classmethod
    async def register(cls, ad: PeerAdvertisement) -> PeerRecord:
        """Enroll or update a peer advertisement."""
        redis = get_redis()
        now = datetime.now(timezone.utc)
        record = PeerRecord(
            advertisement=ad,
            status=PeerState.HEALTHY,
            last_heartbeat=now,
        )

        record_key = f"{REDIS_PEER_RECORD_PREFIX}{ad.peer_id}"
        await redis.set(record_key, record.model_dump_json())
        await redis.sadd(REDIS_ACTIVE_PEERS_SET, ad.peer_id)

        # Set initial heartbeat lease
        hb_key = f"{REDIS_PEER_HEARTBEAT_PREFIX}{ad.peer_id}"
        await redis.setex(hb_key, HEARTBEAT_TTL_SECONDS, now.isoformat())

        logger.info("✓ Peer '%s' registered from provider '%s' (Roles: %s)",
                    ad.peer_id, ad.provider, [r.value for r in ad.service_types])
        return record

    @classmethod
    async def record_heartbeat(cls, hb: PeerHeartbeat) -> Optional[PeerRecord]:
        """Update live telemetry and renew heartbeat lease."""
        redis = get_redis()
        record_key = f"{REDIS_PEER_RECORD_PREFIX}{hb.peer_id}"
        raw = await redis.get(record_key)
        if not raw:
            return None

        data = json.loads(raw if isinstance(raw, str) else raw.decode())
        record = PeerRecord(**data)
        record.last_heartbeat = hb.timestamp
        record.telemetry = hb
        record.status = hb.status

        # If high resource utilization, mark DEGRADED
        if hb.cpu_utilization_percent > 90.0 or hb.quota_state.value == "WARNING":
            record.status = PeerState.DEGRADED

        await redis.set(record_key, record.model_dump_json())
        hb_key = f"{REDIS_PEER_HEARTBEAT_PREFIX}{hb.peer_id}"
        await redis.setex(hb_key, HEARTBEAT_TTL_SECONDS, hb.timestamp.isoformat())
        await redis.sadd(REDIS_ACTIVE_PEERS_SET, hb.peer_id)
        return record

    @classmethod
    async def drain(cls, peer_id: str) -> bool:
        """Transition peer to DRAINING state to reject new requests."""
        redis = get_redis()
        record_key = f"{REDIS_PEER_RECORD_PREFIX}{peer_id}"
        raw = await redis.get(record_key)
        if not raw:
            return False

        data = json.loads(raw if isinstance(raw, str) else raw.decode())
        record = PeerRecord(**data)
        record.status = PeerState.DRAINING
        await redis.set(record_key, record.model_dump_json())
        logger.info("Peer '%s' transitioned to DRAINING.", peer_id)
        return True

    @classmethod
    async def get_all_peers(cls) -> List[PeerRecord]:
        """Retrieve all registered peers and enforce heartbeat timeouts."""
        redis = get_redis()
        peer_ids = await redis.smembers(REDIS_ACTIVE_PEERS_SET)
        records: List[PeerRecord] = []
        now = datetime.now(timezone.utc)

        for pid_bytes in peer_ids:
            pid = pid_bytes.decode() if isinstance(pid_bytes, bytes) else str(pid_bytes)
            raw = await redis.get(f"{REDIS_PEER_RECORD_PREFIX}{pid}")
            if not raw:
                await redis.srem(REDIS_ACTIVE_PEERS_SET, pid)
                continue

            data = json.loads(raw if isinstance(raw, str) else raw.decode())
            record = PeerRecord(**data)

            # Check heartbeat liveness
            hb_alive = await redis.exists(f"{REDIS_PEER_HEARTBEAT_PREFIX}{pid}")
            if not hb_alive:
                delta = (now - record.last_heartbeat).total_seconds()
                if delta > REAP_THRESHOLD_SECONDS:
                    record.status = PeerState.OFFLINE
                    await redis.srem(REDIS_ACTIVE_PEERS_SET, pid)
                else:
                    record.status = PeerState.SUSPECT
                await redis.set(f"{REDIS_PEER_RECORD_PREFIX}{pid}", record.model_dump_json())

            records.append(record)
        return records

    @classmethod
    async def get_healthy_peers(cls, role: Optional[PeerType] = None) -> List[PeerRecord]:
        all_peers = await cls.get_all_peers()
        healthy = [p for p in all_peers if p.status in (PeerState.HEALTHY, PeerState.DEGRADED)]
        if role:
            healthy = [p for p in healthy if role in p.advertisement.service_types]
        return healthy
