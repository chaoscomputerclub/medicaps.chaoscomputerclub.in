"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.graph_projection_service — Dynamic Competency Graph Projection

Projects authoritative BKT mastery states, IRT ability, and taxonomy relationships
into a frontend-ready live visualization graph with:
- Normalized status encodings (UNASSESSED, DEVELOPING, MASTERED, GAP).
- Deterministic topological layered coordinates (stable mental-map layout).
- Clear visual distinction between observed evidence and uncertainty.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from app.services.interview.bkt_engine import BKTEngine, CompetencyBKTState
from app.services.interview.competency_taxonomy import (
    COMPETENCY_REGISTRY,
    CompetencyDomain,
    CompetencyNodeDef,
    CompetencyTaxonomyService,
)


@dataclass
class GraphNode:
    id: str
    label: str
    domain: str
    description: str
    mastery_prob: float
    uncertainty: float
    evidence_count: int
    status: str  # UNASSESSED | DEVELOPING | MASTERED | GAP
    x: int
    y: int
    prerequisites: List[str] = field(default_factory=list)


@dataclass
class GraphEdge:
    source: str
    target: str
    relationship: str
    weight: float


@dataclass
class CompetencyGraphSnapshot:
    session_id: str
    version: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GraphProjectionService:
    """Projects session competency states into an incremental layered layout graph."""

    # Deterministic domain column offsets for layout stability
    DOMAIN_COLUMNS: Dict[CompetencyDomain, int] = {
        CompetencyDomain.DATABASE: 80,
        CompetencyDomain.DISTRIBUTED_SYSTEMS: 320,
        CompetencyDomain.BACKEND: 560,
        CompetencyDomain.SYSTEM_DESIGN: 800,
        CompetencyDomain.DSA: 1040,
        CompetencyDomain.DEVOPS: 1280,
    }

    @classmethod
    def compute_projection(
        cls,
        session_id: str,
        bkt_states: Dict[str, CompetencyBKTState],
        target_domains: Optional[Set[CompetencyDomain]] = None,
    ) -> CompetencyGraphSnapshot:
        """
        Projects current BKT state across all taxonomy competencies into layout nodes & edges.
        """
        nodes_out: List[Dict[str, Any]] = []
        domain_row_counters: Dict[CompetencyDomain, int] = {d: 0 for d in CompetencyDomain}

        # Track aggregate metrics
        total_count = 0
        assessed_count = 0
        mastered_count = 0
        gap_count = 0

        for comp_id, node_def in COMPETENCY_REGISTRY.items():
            if target_domains and node_def.domain not in target_domains:
                continue

            total_count += 1
            bkt = bkt_states.get(comp_id)

            if bkt:
                mastery = bkt.mastery_prob
                uncertainty = bkt.uncertainty
                evidence_count = bkt.evidence_count
                status_str = bkt.status()
            else:
                mastery = round(node_def.default_bkt_l0, 2)
                uncertainty = BKTEngine.calculate_uncertainty(mastery)
                evidence_count = 0
                status_str = "UNASSESSED"

            if evidence_count > 0:
                assessed_count += 1
            if status_str == "MASTERED":
                mastered_count += 1
            elif status_str == "GAP":
                gap_count += 1

            # Deterministic layered 2D coordinates
            col_x = cls.DOMAIN_COLUMNS.get(node_def.domain, 500)
            row_idx = domain_row_counters.get(node_def.domain, 0)
            domain_row_counters[node_def.domain] = row_idx + 1

            row_y = 100 + (row_idx * 160)

            nodes_out.append({
                "id": comp_id,
                "label": node_def.label,
                "domain": node_def.domain.value,
                "description": node_def.description,
                "mastery_prob": round(mastery, 3),
                "uncertainty": round(uncertainty, 3),
                "evidence_count": evidence_count,
                "status": status_str,
                "x": col_x,
                "y": row_y,
                "prerequisites": node_def.prerequisites,
            })

        # Generate relationships matching active nodes
        active_ids = {n["id"] for n in nodes_out}
        edges_out = [
            e for e in CompetencyTaxonomyService.get_competency_edges()
            if e["source"] in active_ids and e["target"] in active_ids
        ]

        coverage_pct = round((assessed_count / max(1, total_count)) * 100.0, 1)

        metrics = {
            "total_competencies": total_count,
            "assessed_count": assessed_count,
            "mastered_count": mastered_count,
            "gap_count": gap_count,
            "coverage_percentage": coverage_pct,
            "overall_health": "STRONG" if coverage_pct >= 60 and gap_count == 0 else "ASSESSING",
        }

        return CompetencyGraphSnapshot(
            session_id=session_id,
            version="2026.1",
            nodes=nodes_out,
            edges=edges_out,
            metrics=metrics,
        )

