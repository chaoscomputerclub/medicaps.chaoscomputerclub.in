"""
Chaos Computer Club — Medi-Caps Chapter
engine/peer_fabric/router.py — Multi-Factor Peer Selection Router
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.engine.peer_fabric.models import (
    PeerRecord,
    PeerState,
    PeerType,
    QuotaState,
)
from app.engine.peer_fabric.registry import PeerRegistry

logger = logging.getLogger("ccc.p2p.router")


class PeerRouter:
    """
    Stateless, multi-factor scoring peer router.
    Filters and ranks compute peers based on real-time telemetry,
    headroom, quota state, and observed reliability.
    """

    WEIGHT_HEALTH = 3.0
    WEIGHT_CAPACITY = 2.5
    WEIGHT_LATENCY = 1.5
    WEIGHT_QUOTA = 2.0
    WEIGHT_RELIABILITY = 1.0

    @classmethod
    async def select_peers(
        cls,
        required_role: PeerType,
        required_language: Optional[str] = None,
        limit: int = 5,
    ) -> List[PeerRecord]:
        candidates = await PeerRegistry.get_healthy_peers(role=required_role)
        qualified: List[tuple[float, PeerRecord]] = []

        for peer in candidates:
            # 1. Capability check
            if required_language:
                langs = [l.lower() for l in peer.advertisement.capabilities.judge_languages]
                if required_language.lower() not in langs and "*" not in langs:
                    continue

            # 2. Capacity check
            active_jobs = peer.telemetry.active_jobs if peer.telemetry else 0
            max_jobs = peer.advertisement.capacity.max_concurrent_jobs
            if active_jobs >= max_jobs:
                continue

            # 3. Quota check
            quota = peer.telemetry.quota_state if peer.telemetry else peer.advertisement.capacity.quota_state
            if quota == QuotaState.EXHAUSTED:
                continue

            # 4. Score calculation
            score = cls._calculate_score(peer, active_jobs, max_jobs, quota)
            qualified.append((score, peer))

        # Sort descending by score
        qualified.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in qualified[:limit]]

    @classmethod
    def _calculate_score(
        cls,
        peer: PeerRecord,
        active_jobs: int,
        max_jobs: int,
        quota: QuotaState,
    ) -> float:
        # Health factor
        health_score = 1.0 if peer.status == PeerState.HEALTHY else 0.4

        # Capacity factor (fraction of available headroom)
        capacity_score = max(0.0, 1.0 - (active_jobs / max(1, max_jobs)))

        # Latency factor (normalized)
        latency_ms = peer.telemetry.latency_p95_ms if peer.telemetry else 20.0
        latency_penalty = min(2.0, latency_ms / 100.0)

        # Quota factor
        quota_score = 1.0 if quota == QuotaState.NORMAL else (0.3 if quota == QuotaState.WARNING else 0.0)

        # Historical reliability
        reliability = peer.historical_success_rate

        total_score = (
            cls.WEIGHT_HEALTH * health_score
            + cls.WEIGHT_CAPACITY * capacity_score
            - cls.WEIGHT_LATENCY * latency_penalty
            + cls.WEIGHT_QUOTA * quota_score
            + cls.WEIGHT_RELIABILITY * reliability
        )
        return round(total_score, 4)

    @classmethod
    async def select_best_peer(
        cls,
        required_role: PeerType,
        required_language: Optional[str] = None,
    ) -> Optional[PeerRecord]:
        peers = await cls.select_peers(required_role, required_language, limit=1)
        return peers[0] if peers else None
