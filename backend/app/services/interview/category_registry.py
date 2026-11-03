"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.category_registry — Interview Category Metadata & Curated Topics
"""

from typing import Dict, List, Any

INTERVIEW_CATEGORIES: Dict[str, Dict[str, Any]] = {
    "TECHNICAL": {
        "id": "TECHNICAL",
        "name": "General Technical Interview",
        "description": "Comprehensive engineering assessment spanning core CS fundamentals, concurrency, memory, and architecture.",
        "badge": "Core CS",
        "icon": "Terminal",
        "default_topics": ["Operating Systems", "Networking", "Concurrency", "Database Indexing", "Memory Models"],
        "supports_code": False,
        "supports_diagrams": False,
        "default_questions": 4,
    },
    "CODING": {
        "id": "CODING",
        "name": "Live Coding & Algorithm Arena",
        "description": "Interactive coding challenge with integrated Monaco editor and live compiler verification.",
        "badge": "Live IDE",
        "icon": "Code",
        "default_topics": ["Two Pointers", "Sliding Window", "Monotonic Stacks", "Hash Maps & Sets", "Binary Search"],
        "supports_code": True,
        "supports_diagrams": False,
        "default_questions": 3,
    },
    "DSA": {
        "id": "DSA",
        "name": "Data Structures & Algorithms Deep-Dive",
        "description": "Rigorous theoretical and applied algorithmic problem solving with asymptotic complexity analysis.",
        "badge": "Algorithmic",
        "icon": "BrainCircuit",
        "default_topics": ["Trees & Graphs", "Dynamic Programming", "Bit Manipulation", "Heaps & Greedy", "Segment Trees"],
        "supports_code": True,
        "supports_diagrams": False,
        "default_questions": 3,
    },
    "SYSTEM_DESIGN": {
        "id": "SYSTEM_DESIGN",
        "name": "High-Scale System Design",
        "description": "Architect distributed web architectures, evaluate consistency models, partitioning, and resilience.",
        "badge": "Distributed",
        "icon": "Layers",
        "default_topics": ["Distributed Caching", "Rate Limiting", "Message Queues", "CAP Theorem", "Database Sharding"],
        "supports_code": False,
        "supports_diagrams": True,
        "default_questions": 4,
    },
    "BACKEND": {
        "id": "BACKEND",
        "name": "Backend Engineering & API Design",
        "description": "Deep-dive into REST, gRPC, transactional ACID guarantees, connection pooling, and background worker queues.",
        "badge": "Server-Side",
        "icon": "Server",
        "default_topics": ["PostgreSQL ACID", "Redis Pub/Sub", "Kafka Streaming", "Connection Pooling", "Idempotency Keys"],
        "supports_code": False,
        "supports_diagrams": False,
        "default_questions": 4,
    },
    "FRONTEND": {
        "id": "FRONTEND",
        "name": "Frontend Engineering & Web Performance",
        "description": "Browser rendering pipelines, React 19 reconciliation, Core Web Vitals, state management, and accessibility.",
        "badge": "Client-Side",
        "icon": "Monitor",
        "default_topics": ["Virtual DOM & Fiber", "Core Web Vitals", "SSR vs Hydration", "Event Loop & Microtasks", "CSS Layout Engine"],
        "supports_code": False,
        "supports_diagrams": False,
        "default_questions": 4,
    },
    "DEVOPS": {
        "id": "DEVOPS",
        "name": "DevOps, SRE & Cloud Infrastructure",
        "description": "Container orchestration, CI/CD deployment pipelines, Linux kernel observability, and zero-downtime releases.",
        "badge": "Infrastructure",
        "icon": "Cloud",
        "default_topics": ["Docker & cgroups", "Kubernetes Ingress", "Prometheus & Grafana", "Linux Networking", "Blue/Green Deploys"],
        "supports_code": False,
        "supports_diagrams": False,
        "default_questions": 4,
    },
    "DATABASE_SQL": {
        "id": "DATABASE_SQL",
        "name": "Database Architecture & SQL Optimization",
        "description": "Query plan analysis, B-Tree indexes, isolation levels, write-ahead logs, and storage engine mechanics.",
        "badge": "Data Layer",
        "icon": "Database",
        "default_topics": ["Index Scan vs Seq Scan", "Postgres MVCC & WAL", "Deadlocks & Row Locks", "Normalization", "Analytical Window Functions"],
        "supports_code": False,
        "supports_diagrams": False,
        "default_questions": 4,
    },
    "BEHAVIORAL": {
        "id": "BEHAVIORAL",
        "name": "Behavioral & Leadership Principles",
        "description": "STAR-method evaluation of engineering leadership, team conflict resolution, failure postmortems, and ownership.",
        "badge": "Leadership",
        "icon": "Users",
        "default_topics": ["Technical Conflict", "Production Incidents", "Mentorship", "Delivering Under Pressure", "Navigating Ambiguity"],
        "supports_code": False,
        "supports_diagrams": False,
        "default_questions": 4,
    },
    "MIXED": {
        "id": "MIXED",
        "name": "Comprehensive Full-Stack Onsite",
        "description": "Holistic technical onsite simulation combining algorithm analysis, system architecture, and behavioral dynamics.",
        "badge": "Full Onsite",
        "icon": "Briefcase",
        "default_topics": ["Algorithmic Reasoning", "Data Modeling", "Production Debugging", "Architecture Trade-offs", "Cross-Team Alignment"],
        "supports_code": True,
        "supports_diagrams": True,
        "default_questions": 5,
    },
}


def get_all_categories() -> List[Dict[str, Any]]:
    """Returns list of all supported interview categories."""
    return list(INTERVIEW_CATEGORIES.values())


def get_category_config(category_id: str) -> Dict[str, Any]:
    """Retrieves metadata and defaults for a specific category."""
    cat = INTERVIEW_CATEGORIES.get(category_id.upper())
    if not cat:
        return INTERVIEW_CATEGORIES["TECHNICAL"]
    return cat
