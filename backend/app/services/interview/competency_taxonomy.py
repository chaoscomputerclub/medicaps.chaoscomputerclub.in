"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.competency_taxonomy — Versioned Technical Competency Taxonomy

Defines:
- Hierarchical, versioned technical competency taxonomy across 10 engineering domains.
- Directed acyclic relationship graph (parent-child, prerequisites, cross-domain dependencies).
- Rubric dimension schemas and calibration defaults.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class CompetencyDomain(str, Enum):
    BACKEND = "BACKEND"
    FRONTEND = "FRONTEND"
    SYSTEM_DESIGN = "SYSTEM_DESIGN"
    DATABASE = "DATABASE"
    DSA = "DSA"
    DEVOPS = "DEVOPS"
    DISTRIBUTED_SYSTEMS = "DISTRIBUTED_SYSTEMS"
    SECURITY = "SECURITY"
    CLOUD = "CLOUD"
    TESTING = "TESTING"


class RelationshipType(str, Enum):
    PARENT_CHILD = "PARENT_CHILD"
    PREREQUISITE = "PREREQUISITE"
    CONCEPTUAL_DEPENDENCY = "CONCEPTUAL_DEPENDENCY"
    SHARED_KNOWLEDGE = "SHARED_KNOWLEDGE"
    CROSS_DOMAIN = "CROSS_DOMAIN"


@dataclass(frozen=True)
class RubricDimensionDef:
    key: str
    label: str
    weight: float
    description: str


DEFAULT_RUBRIC_DIMENSIONS = [
    RubricDimensionDef("technical_correctness", "Technical Correctness", 0.35, "Accuracy of core technical facts, mechanics, and syntax"),
    RubricDimensionDef("completeness", "Completeness", 0.20, "Coverage of essential concepts, edge cases, and failure modes"),
    RubricDimensionDef("conceptual_understanding", "Conceptual Depth", 0.20, "Grasp of internal mechanisms and trade-offs"),
    RubricDimensionDef("reasoning", "Engineering Reasoning", 0.15, "Logical justification, design choices, and complexity analysis"),
    RubricDimensionDef("communication", "Clarity & Structure", 0.10, "Structured exposition independent of accent or speech fluency"),
]


@dataclass
class CompetencyNodeDef:
    id: str
    label: str
    domain: CompetencyDomain
    description: str
    parent_id: Optional[str] = None
    prerequisites: List[str] = field(default_factory=list)
    related: List[str] = field(default_factory=list)
    default_bkt_l0: float = 0.25  # Prior mastery probability
    default_bkt_t: float = 0.15   # Transition / learning rate
    default_bkt_g: float = 0.10   # Guess probability
    default_bkt_s: float = 0.10   # Slip probability
    default_irt_b: float = 0.0    # Baseline difficulty parameter
    default_irt_a: float = 1.2    # Baseline discrimination parameter
    version: str = "1.0"


TAXONOMY_VERSION = "2026.1"

# Curated Technical Competency Knowledge Graph
COMPETENCY_REGISTRY: Dict[str, CompetencyNodeDef] = {
    # ── Database & Storage ──────────────────────────────────────────────────
    "db.indexing": CompetencyNodeDef(
        id="db.indexing",
        label="B-Tree & Hash Indexing",
        domain=CompetencyDomain.DATABASE,
        description="B-tree anatomy, clustered vs secondary indexes, compound index leftmost prefix rule, and write amplification",
        default_bkt_l0=0.30,
        default_irt_b=0.2,
    ),
    "db.transactions": CompetencyNodeDef(
        id="db.transactions",
        label="ACID & Isolation Levels",
        domain=CompetencyDomain.DATABASE,
        description="Dirty reads, non-repeatable reads, phantom reads, MVCC, 2PL, and serializable snapshot isolation",
        prerequisites=["db.indexing"],
        default_bkt_l0=0.20,
        default_irt_b=0.8,
    ),
    "db.sharding": CompetencyNodeDef(
        id="db.sharding",
        label="Horizontal Partitioning & Sharding",
        domain=CompetencyDomain.DATABASE,
        description="Consistent hashing, range-based vs directory-based sharding, distributed transactions, and rebalancing",
        prerequisites=["db.transactions"],
        related=["dist.consensus"],
        default_bkt_l0=0.15,
        default_irt_b=1.2,
    ),

    # ── Distributed Systems ─────────────────────────────────────────────────
    "dist.cap": CompetencyNodeDef(
        id="dist.cap",
        label="CAP & PACELC Theorems",
        domain=CompetencyDomain.DISTRIBUTED_SYSTEMS,
        description="Trade-offs between consistency, availability, and partition tolerance during network netsplits and normal ops",
        default_bkt_l0=0.35,
        default_irt_b=0.0,
    ),
    "dist.consensus": CompetencyNodeDef(
        id="dist.consensus",
        label="Distributed Consensus (Raft/Paxos)",
        domain=CompetencyDomain.DISTRIBUTED_SYSTEMS,
        description="Leader election, log replication, terms, quorum intersection, split-brain mitigation, and state machine replication",
        prerequisites=["dist.cap"],
        default_bkt_l0=0.10,
        default_irt_b=1.5,
    ),
    "dist.idempotency": CompetencyNodeDef(
        id="dist.idempotency",
        label="Idempotency & Message Deduplication",
        domain=CompetencyDomain.DISTRIBUTED_SYSTEMS,
        description="At-least-once delivery, idempotency keys, transactional outbox pattern, fencing tokens, and distributed leases",
        prerequisites=["dist.cap"],
        related=["db.transactions"],
        default_bkt_l0=0.25,
        default_irt_b=0.6,
    ),

    # ── Backend & Concurrency ───────────────────────────────────────────────
    "backend.async": CompetencyNodeDef(
        id="backend.async",
        label="Asynchronous I/O & Event Loops",
        domain=CompetencyDomain.BACKEND,
        description="Epoll/kqueue fundamentals, cooperatively scheduled tasks, non-blocking sockets, backpressure, and task starvation",
        default_bkt_l0=0.30,
        default_irt_b=0.4,
    ),
    "backend.concurrency": CompetencyNodeDef(
        id="backend.concurrency",
        label="Thread Safety & Lock Primitives",
        domain=CompetencyDomain.BACKEND,
        description="Mutexes, reader-writer locks, deadlock prevention, race conditions, atomic CAS operations, and memory barriers",
        prerequisites=["backend.async"],
        default_bkt_l0=0.20,
        default_irt_b=1.0,
    ),
    "backend.caching": CompetencyNodeDef(
        id="backend.caching",
        label="Distributed Caching Patterns",
        domain=CompetencyDomain.BACKEND,
        description="Cache-aside, write-through, write-behind, dogpiling/thundering herd prevention, TTLs, and stale-while-revalidate",
        related=["db.indexing"],
        default_bkt_l0=0.35,
        default_irt_b=0.1,
    ),

    # ── System Design ───────────────────────────────────────────────────────
    "sys.rate_limiting": CompetencyNodeDef(
        id="sys.rate_limiting",
        label="Rate Limiting & Traffic Shedding",
        domain=CompetencyDomain.SYSTEM_DESIGN,
        description="Token bucket, leaky bucket, sliding window counters, distributed Redis rate limiting, and 429 backpressure headers",
        related=["backend.caching"],
        default_bkt_l0=0.30,
        default_irt_b=0.5,
    ),
    "sys.scalability": CompetencyNodeDef(
        id="sys.scalability",
        label="High-Availability & Fault Tolerance",
        domain=CompetencyDomain.SYSTEM_DESIGN,
        description="Circuit breakers, bulkhead isolation, exponential backoff with jitter, health probes, and graceful degradation",
        prerequisites=["sys.rate_limiting"],
        related=["dist.cap"],
        default_bkt_l0=0.25,
        default_irt_b=0.9,
    ),

    # ── Algorithms & Data Structures ────────────────────────────────────────
    "dsa.trees_graphs": CompetencyNodeDef(
        id="dsa.trees_graphs",
        label="Tree & Graph Traversals",
        domain=CompetencyDomain.DSA,
        description="BFS, DFS, Dijkstra, topological sort, bipartite matching, and time/space complexity analysis",
        default_bkt_l0=0.40,
        default_irt_b=-0.2,
    ),
    "dsa.dp": CompetencyNodeDef(
        id="dsa.dp",
        label="Dynamic Programming & Memoization",
        domain=CompetencyDomain.DSA,
        description="Overlapping subproblems, optimal substructure, state transitions, bottom-up tabulation vs top-down memoization",
        prerequisites=["dsa.trees_graphs"],
        default_bkt_l0=0.20,
        default_irt_b=1.1,
    ),

    # ── DevOps & Cloud ──────────────────────────────────────────────────────
    "devops.containers": CompetencyNodeDef(
        id="devops.containers",
        label="Containerization & Sandboxing",
        domain=CompetencyDomain.DEVOPS,
        description="Linux cgroups, namespaces, seccomp, rootless execution, capability dropping, and read-only overlay filesystems",
        default_bkt_l0=0.30,
        default_irt_b=0.3,
    ),
    "devops.observability": CompetencyNodeDef(
        id="devops.observability",
        label="Metrics, Logs & Distributed Traces",
        domain=CompetencyDomain.DEVOPS,
        description="Prometheus RED/USE metrics, structured JSON logging with correlation IDs, OpenTelemetry spans, and cardinality control",
        default_bkt_l0=0.35,
        default_irt_b=0.2,
    ),
}


class CompetencyTaxonomyService:
    """Provides querying, traversal, and dependency validation over the competency graph."""

    @classmethod
    def get_competency(cls, competency_id: str) -> Optional[CompetencyNodeDef]:
        return COMPETENCY_REGISTRY.get(competency_id)

    @classmethod
    def list_all(cls, domain: Optional[CompetencyDomain] = None) -> List[CompetencyNodeDef]:
        nodes = list(COMPETENCY_REGISTRY.values())
        if domain:
            nodes = [n for n in nodes if n.domain == domain]
        return nodes

    @classmethod
    def get_prerequisites_closure(cls, competency_id: str) -> Set[str]:
        """Returns all transitive prerequisite IDs for a given competency."""
        visited: Set[str] = set()

        def dfs(curr_id: str):
            node = COMPETENCY_REGISTRY.get(curr_id)
            if not node:
                return
            for prereq in node.prerequisites:
                if prereq not in visited:
                    visited.add(prereq)
                    dfs(prereq)

        dfs(competency_id)
        return visited

    @classmethod
    def get_competency_edges(cls) -> List[Dict[str, Any]]:
        """Returns directed edges representing relationships across competencies."""
        edges = []
        for node in COMPETENCY_REGISTRY.values():
            for prereq in node.prerequisites:
                edges.append({
                    "source": prereq,
                    "target": node.id,
                    "relationship": RelationshipType.PREREQUISITE.value,
                    "weight": 1.0,
                })
            for rel in node.related:
                # Directed edge for conceptual affinity
                edges.append({
                    "source": node.id,
                    "target": rel,
                    "relationship": RelationshipType.CONCEPTUAL_DEPENDENCY.value,
                    "weight": 0.6,
                })
        return edges

