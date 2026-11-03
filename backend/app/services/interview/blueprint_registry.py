"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.blueprint_registry — Admin-Authored Interview Blueprint Registry & Graph Validator

Provides the authoritative, immutable graph definitions, node-level instruction contracts,
rubrics, transition rules, and deterministic graph integrity validation for published interview tracks.
Candidates select published blueprints; they never author or mutate them.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field, AliasChoices

logger = logging.getLogger("ccc.interview.blueprints")


# ─── PYDANTIC DATA CONTRACTS ──────────────────────────────────────────────────

class EvaluationCriterion(BaseModel):
    id: str
    weight: float = 1.0
    description: Optional[str] = None


class EvaluationRubric(BaseModel):
    criteria: List[EvaluationCriterion] = Field(default_factory=list)
    scale: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    rubric_version: str = "1.0.0"


class QuestionPolicy(BaseModel):
    format: str = "scenario"  # scenario, coding, system_architecture, behavioral_star
    difficulty: str = "intermediate"  # foundational, intermediate, advanced
    instructions: str
    code_required: bool = False
    starter_code: Optional[str] = None


class BlueprintNode(BaseModel):
    node_id: str
    node_type: str = "question"  # question, assessment, terminal
    title: str
    competency_ids: List[str] = Field(default_factory=list)
    learning_objective: str
    prerequisites: List[str] = Field(default_factory=list)
    question_policy: QuestionPolicy
    evaluation_rubric: EvaluationRubric
    expected_evidence: List[str] = Field(default_factory=list)
    transition_policy: Dict[str, Any] = Field(default_factory=lambda: {"type": "score_band"})
    max_attempts: int = 1
    timeout_seconds: Optional[int] = None
    fallback_question: Optional[str] = None  # Mandatory on question nodes via validator


class BlueprintEdge(BaseModel):
    from_node_id: str = Field(..., validation_alias=AliasChoices("from_node_id", "source_node_id"))
    to_node_id: str = Field(..., validation_alias=AliasChoices("to_node_id", "target_node_id"))
    priority: int = 1
    condition: Dict[str, Any] = Field(default_factory=dict)
    default: bool = False
    reason_code: Optional[str] = None


class CompletionPolicy(BaseModel):
    min_completed_nodes: int = 3
    max_steps: int = 6
    terminal_node_required: bool = True
    early_exit_on_failure: bool = False


class RuntimePolicy(BaseModel):
    allow_code: bool = False
    allow_voice: bool = True
    default_language: str = "python"
    timeout_minutes: int = 45


class PublicMetadata(BaseModel):
    difficulty: str = "INTERMEDIATE"  # EASY, INTERMEDIATE, HARD, EXPERT
    duration_minutes: int = 45
    topics: List[str] = Field(default_factory=list)
    badge: str
    icon: str
    supports_code: bool = False
    supports_diagrams: bool = False


class InterviewBlueprint(BaseModel):
    blueprint_id: str
    version: str = "1.0.0"
    schema_version: str = "1.0.0"
    slug: str
    title: str
    description: str
    category: str  # TECHNICAL or OTHER
    domain: str  # Backend, Frontend, DSA, etc.
    status: str = "published"  # draft, validating, published, retired
    entry_node_ids: List[str]
    nodes: Dict[str, BlueprintNode]
    edges: List[BlueprintEdge]
    completion_policy: CompletionPolicy = Field(default_factory=CompletionPolicy)
    runtime_policy: RuntimePolicy = Field(default_factory=RuntimePolicy)
    public_metadata: PublicMetadata


# ─── GRAPH INTEGRITY VALIDATOR ───────────────────────────────────────────────

class BlueprintGraphValidator:
    """
    Performs deterministic graph topology and content integrity validation
    before any blueprint can be published or executed.
    """

    @staticmethod
    def validate(blueprint: InterviewBlueprint) -> List[str]:
        errors: List[str] = []

        # 1. Identity & metadata checks
        if not blueprint.blueprint_id or not blueprint.blueprint_id.strip():
            errors.append("Blueprint must have a non-empty blueprint_id.")
        if not blueprint.version or not blueprint.version.strip():
            errors.append("Blueprint must have an explicit immutable version string.")
        if not blueprint.slug or not blueprint.slug.strip():
            errors.append("Blueprint must have a non-empty unique slug.")
        if not blueprint.entry_node_ids:
            errors.append("Blueprint must define at least one entry_node_id.")

        node_keys = set(blueprint.nodes.keys())

        # 2. Entry nodes validation
        for entry_id in blueprint.entry_node_ids:
            if entry_id not in node_keys:
                errors.append(f"Entry node '{entry_id}' is not defined in nodes dictionary.")

        # 3. Terminal nodes validation
        terminal_nodes = [nid for nid, node in blueprint.nodes.items() if node.node_type == "terminal"]
        if blueprint.completion_policy.terminal_node_required and not terminal_nodes:
            errors.append("Completion policy requires a terminal node, but no node has node_type='terminal'.")

        # 4. Node integrity
        for nid, node in blueprint.nodes.items():
            if node.node_id != nid:
                errors.append(f"Node dictionary key '{nid}' does not match internal node_id '{node.node_id}'.")
            if not node.title or not node.title.strip():
                errors.append(f"Node '{nid}' missing title.")
            if not node.learning_objective or not node.learning_objective.strip():
                errors.append(f"Node '{nid}' missing learning_objective.")
            if node.node_type == "question":
                if not node.fallback_question or not node.fallback_question.strip():
                    errors.append(f"Question node '{nid}' must provide a deterministic fallback_question.")
                if not node.question_policy.instructions:
                    errors.append(f"Question node '{nid}' missing question_policy instructions.")
                if not node.evaluation_rubric.criteria:
                    errors.append(f"Question node '{nid}' missing evaluation rubric criteria.")

            # Prerequisites check
            for prereq in node.prerequisites:
                if prereq not in node_keys:
                    errors.append(f"Node '{nid}' specifies unknown prerequisite node '{prereq}'.")

        # 5. Edge reference & reachability checks
        adjacency: Dict[str, List[str]] = {nid: [] for nid in node_keys}
        for idx, edge in enumerate(blueprint.edges):
            if edge.from_node_id not in node_keys:
                errors.append(f"Edge {idx}: from_node_id '{edge.from_node_id}' does not exist.")
            if edge.to_node_id not in node_keys:
                errors.append(f"Edge {idx}: to_node_id '{edge.to_node_id}' does not exist.")
            if edge.from_node_id in node_keys and edge.to_node_id in node_keys:
                adjacency[edge.from_node_id].append(edge.to_node_id)

        # Reachability from entry nodes (BFS)
        reachable: Set[str] = set()
        queue = list(blueprint.entry_node_ids)
        while queue:
            curr = queue.pop(0)
            if curr not in reachable:
                reachable.add(curr)
                for nxt in adjacency.get(curr, []):
                    if nxt not in reachable:
                        queue.append(nxt)

        unreachable = node_keys - reachable
        if unreachable:
            errors.append(f"Nodes unreachable from any entry node: {sorted(list(unreachable))}")

        # Check that terminal nodes are reachable from at least one entry node
        if terminal_nodes:
            reachable_terminals = [t for t in terminal_nodes if t in reachable]
            if not reachable_terminals:
                errors.append("No terminal node is reachable from any entry node.")

        return errors


# ─── PRE-SEEDED AUTHORITATIVE BLUEPRINTS REGISTRY ────────────────────────────

def _create_standard_nodes(track_slug: str, domain: str, questions: List[Dict[str, Any]], supports_code: bool = False) -> Dict[str, BlueprintNode]:
    nodes: Dict[str, BlueprintNode] = {}
    for i, q in enumerate(questions):
        nid = f"{track_slug}.n{i + 1}"
        nodes[nid] = BlueprintNode(
            node_id=nid,
            node_type="question",
            title=q["title"],
            competency_ids=q.get("competencies", [f"{track_slug}.core"]),
            learning_objective=q["objective"],
            prerequisites=[f"{track_slug}.n{i}"] if i > 0 else [],
            question_policy=QuestionPolicy(
                format="coding" if supports_code and q.get("is_coding") else "scenario",
                difficulty=q.get("difficulty", "intermediate"),
                instructions=q["instructions"],
                code_required=supports_code and q.get("is_coding", False),
                starter_code=q.get("starter_code"),
            ),
            evaluation_rubric=EvaluationRubric(
                criteria=[
                    EvaluationCriterion(id="correctness", weight=0.4, description="Accuracy of concepts and code"),
                    EvaluationCriterion(id="tradeoffs", weight=0.3, description="Evaluation of scalability, memory, and performance trade-offs"),
                    EvaluationCriterion(id="communication", weight=0.3, description="Clarity, structure, and edge-case handling"),
                ],
                scale=[0, 1, 2, 3, 4],
            ),
            expected_evidence=q.get("expected_evidence", ["Clear algorithmic reasoning", "Edge case analysis"]),
            fallback_question=q["fallback"],
        )

    # Terminal node
    term_id = f"{track_slug}.terminal"
    nodes[term_id] = BlueprintNode(
        node_id=term_id,
        node_type="terminal",
        title=f"{domain} Simulation Concluded",
        learning_objective="Final assessment aggregation and synthesis",
        question_policy=QuestionPolicy(
            format="terminal",
            difficulty="foundational",
            instructions="Conclude interview and summarize candidate outcomes.",
        ),
        evaluation_rubric=EvaluationRubric(),
        fallback_question="Interview concluded.",
    )
    return nodes


def _create_sequential_edges(track_slug: str, count: int) -> List[BlueprintEdge]:
    edges: List[BlueprintEdge] = []
    for i in range(1, count):
        edges.append(
            BlueprintEdge(
                from_node_id=f"{track_slug}.n{i}",
                to_node_id=f"{track_slug}.n{i + 1}",
                priority=1,
                default=True,
                reason_code="PROGRESSION",
            )
        )
    # Edge from last question to terminal
    edges.append(
        BlueprintEdge(
            from_node_id=f"{track_slug}.n{count}",
            to_node_id=f"{track_slug}.terminal",
            priority=1,
            default=True,
            reason_code="COMPLETION",
        )
    )
    return edges


def _build_preseeded_catalog() -> Dict[str, InterviewBlueprint]:
    blueprints: Dict[str, InterviewBlueprint] = {}

    catalog_specs = [
        {
            "slug": "frontend-engineering",
            "title": "Frontend Engineering & Web Performance",
            "description": "Browser rendering pipelines, React 19 reconciliation, Core Web Vitals, state management, and modern Web APIs.",
            "category": "TECHNICAL",
            "domain": "Frontend",
            "badge": "Client-Side",
            "icon": "Monitor",
            "supports_code": True,
            "supports_diagrams": False,
            "difficulty": "INTERMEDIATE",
            "duration": 45,
            "topics": ["React 19 Fiber", "Core Web Vitals", "Event Loop", "CSS Box Model", "SSR & Hydration"],
            "questions": [
                {
                    "title": "Browser Event Loop & Task Scheduling",
                    "objective": "Assess deep understanding of microtasks vs macrotasks and DOM paint cycles.",
                    "instructions": "Ask the candidate how the browser manages rendering frames with requestAnimationFrame vs Promise microtasks.",
                    "fallback": "Explain the difference between microtasks (like Promises) and macrotasks (like setTimeout) in the browser event loop, and how they affect the rendering frame rate.",
                    "expected_evidence": ["microtask queue precedence", "requestAnimationFrame timing", "layout thrashing"],
                },
                {
                    "title": "React Reconciliation & Virtual DOM",
                    "objective": "Assess knowledge of React Fiber architecture, concurrency, and rendering optimization.",
                    "instructions": "Inquire about how React reconciles state updates and how keys prevent unnecessary DOM unmounts.",
                    "fallback": "How does React's Fiber reconciler work, and why are stable keys required when rendering dynamic lists?",
                    "expected_evidence": ["diffing algorithm", "Fiber fiber-tree swap", "memoization trade-offs"],
                },
                {
                    "title": "Core Web Vitals & Web Performance Optimization",
                    "objective": "Assess practical strategies to diagnose and improve LCP, INP, and CLS.",
                    "instructions": "Present an e-commerce page with slow LCP and high Interaction to Next Paint (INP). Ask for mitigation steps.",
                    "fallback": "How would you diagnose and fix a critical Largest Contentful Paint (LCP) regression on a high-traffic e-commerce landing page?",
                    "expected_evidence": ["resource hints (preload, preconnect)", "main thread blocking reduction", "image optimization"],
                },
                {
                    "title": "Component Architecture & State Design",
                    "objective": "Assess scalable UI design patterns, accessibility, and decoupled state management.",
                    "instructions": "Ask how to build a high-performance, accessible combobox/autocomplete component with virtualized lists.",
                    "fallback": "Design an accessible, virtualized autocomplete combobox component. What ARIA attributes and performance safeguards are needed?",
                    "expected_evidence": ["ARIA combobox roles", "list virtualization", "keyboard navigation"],
                },
            ],
        },
        {
            "slug": "backend-engineering",
            "title": "Backend Engineering & Distributed APIs",
            "description": "Deep-dive into REST/gRPC API architecture, PostgreSQL ACID transactions, connection pooling, and resilient worker queues.",
            "category": "TECHNICAL",
            "domain": "Backend",
            "badge": "Server-Side",
            "icon": "Server",
            "supports_code": False,
            "supports_diagrams": True,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["PostgreSQL ACID", "Redis Pub/Sub", "Kafka Streaming", "Connection Pooling", "Idempotency Keys"],
            "questions": [
                {
                    "title": "Idempotent API Design for Payment Webhooks",
                    "objective": "Assess ability to handle network retries, race conditions, and duplicate delivery safely.",
                    "instructions": "Ask the candidate to architect an idempotent webhook consumer for Stripe payment intents.",
                    "fallback": "How do you design an API endpoint to be strictly idempotent using unique idempotency keys, Redis distributed locks, and database transactions?",
                    "expected_evidence": ["idempotency key hashing", "database unique constraint", "in-flight lock expiry"],
                },
                {
                    "title": "PostgreSQL Isolation Levels & Concurrency",
                    "objective": "Assess understanding of dirty reads, phantom reads, and MVCC mechanics under load.",
                    "instructions": "Ask how PostgreSQL implements Read Committed vs Repeatable Read and how to mitigate write skew.",
                    "fallback": "Explain the difference between Read Committed and Serializable isolation levels in PostgreSQL. How does MVCC resolve concurrent updates without locking reads?",
                    "expected_evidence": ["WAL logs", "snapshot isolation", "write skew prevention"],
                },
                {
                    "title": "Distributed Caching & Cache Invalidation",
                    "objective": "Assess cache-aside, write-through, and stampede prevention mechanisms.",
                    "instructions": "Ask how to prevent cache stampedes (thundering herd) on sudden cache expiration for viral entities.",
                    "fallback": "Explain the cache-aside pattern with Redis. How do you prevent cache stampede when an extremely popular cache key expires?",
                    "expected_evidence": ["mutex locking", "probabilistic early expiration (XFetch)", "stale-while-revalidate"],
                },
                {
                    "title": "Asynchronous Background Processing & Dead-Letter Queues",
                    "objective": "Assess resilient worker task distribution, retry backoff, and poison message handling.",
                    "instructions": "Ask how to architect a resilient message queue consumer with exponential backoff and dead-letter queues.",
                    "fallback": "How would you design a distributed worker pipeline using Celery/Kafka that safely retries transient failures with jitter and routes poison messages to a dead-letter queue?",
                    "expected_evidence": ["exponential backoff with jitter", "idempotent message acknowledgment", "dead-letter quarantine"],
                },
            ],
        },
        {
            "slug": "python-specialist",
            "title": "Python Specialist & Runtime Mechanics",
            "description": "Python memory model, GIL, generators, asyncio event loops, metaclasses, and high-performance C-extensions.",
            "category": "TECHNICAL",
            "domain": "Python",
            "badge": "Language Core",
            "icon": "Code",
            "supports_code": True,
            "supports_diagrams": False,
            "difficulty": "INTERMEDIATE",
            "duration": 40,
            "topics": ["GIL & Free-Threading", "Asyncio Coroutines", "Generators & Itertools", "Memory Management & gc", "Metaclasses & Descriptors"],
            "questions": [
                {
                    "title": "Python Memory Model & Reference Counting",
                    "objective": "Assess understanding of CPython's reference counting, cyclic garbage collection, and small object allocators.",
                    "instructions": "Ask how Python manages memory deallocation and handles cyclic references between objects.",
                    "fallback": "How does CPython allocate and reclaim memory? Explain how reference counting and the generational garbage collector handle cyclic references.",
                    "expected_evidence": ["PyObject ob_refcnt", "generational GC (Gen 0, 1, 2)", "weakref module"],
                },
                {
                    "title": "Asyncio Event Loop vs Multithreading",
                    "objective": "Assess cooperative multitasking, tasks, futures, and thread pool delegation.",
                    "instructions": "Ask when to use asyncio vs multiprocessing for CPU-bound vs I/O-bound workloads under the GIL.",
                    "fallback": "Explain how Python's asyncio single-threaded event loop achieves high I/O concurrency. How does it differ from multithreading under the GIL?",
                    "expected_evidence": ["cooperative yield via await", "non-blocking selectors", "run_in_executor for CPU tasks"],
                },
                {
                    "title": "Descriptors & Python Metaprogramming",
                    "objective": "Assess knowledge of __get__, __set__, and how properties and ORMs are implemented.",
                    "instructions": "Ask how the descriptor protocol operates and how methods are bound to class instances.",
                    "fallback": "How does Python's descriptor protocol (__get__, __set__, __delete__) work, and how does Python use it under the hood to implement @property and bound methods?",
                    "expected_evidence": ["attribute lookup order", "data vs non-data descriptors", "metaclass __new__ vs __init__"],
                },
            ],
        },
        {
            "slug": "java-specialist",
            "title": "Java Enterprise & JVM Architecture",
            "description": "JVM memory regions, garbage collection algorithms (G1, ZGC), virtual threads, and Spring Boot microservice design.",
            "category": "TECHNICAL",
            "domain": "Java",
            "badge": "JVM Core",
            "icon": "Code",
            "supports_code": True,
            "supports_diagrams": False,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["JVM Memory & GC", "Project Loom Virtual Threads", "Spring Boot Architecture", "Java Concurrency & JMM", "ClassLoaders"],
            "questions": [
                {
                    "title": "JVM Memory Model & Garbage Collection Tuning",
                    "objective": "Assess understanding of Eden, Survivor, Tenured spaces, and modern low-latency GC (ZGC/G1).",
                    "instructions": "Ask how Java handles object promotion from young to tenured generation and how stop-the-world pauses are minimized.",
                    "fallback": "Explain the generational hypothesis in Java memory management. How does the G1 collector balance throughput and stop-the-world pause targets?",
                    "expected_evidence": ["eden/survivor/tenured partitions", "mark-sweep-compact", "card tables / remembered sets"],
                },
                {
                    "title": "Java Memory Model & Happens-Before Guarantees",
                    "objective": "Assess multi-threaded visibility, volatile semantics, and Atomic references.",
                    "instructions": "Inquire about volatile keyword guarantees, instruction reordering, and memory barriers.",
                    "fallback": "What guarantees does the 'volatile' keyword provide in Java under the Java Memory Model? How does it enforce visibility and prevent instruction reordering?",
                    "expected_evidence": ["happens-before relation", "CPU cache coherency (MESI)", "memory barriers"],
                },
                {
                    "title": "Project Loom & Virtual Threads vs Platform Threads",
                    "objective": "Assess modern high-throughput Java concurrency architectures.",
                    "instructions": "Ask how virtual threads reduce thread memory footprint and how carrier threads manage blocking operations.",
                    "fallback": "How do Java 21 Virtual Threads differ from OS platform threads, and how does the JVM schedule thousands of concurrent virtual threads over carrier thread pools?",
                    "expected_evidence": ["continuation unmounting", "thread-per-request scaling", "pinning caveats with synchronized"],
                },
            ],
        },
        {
            "slug": "cpp-systems",
            "title": "C++ Systems & High-Performance Engineering",
            "description": "RAII, move semantics, cache locality, smart pointers, template metaprogramming, and zero-overhead abstractions.",
            "category": "TECHNICAL",
            "domain": "C++",
            "badge": "Systems",
            "icon": "Terminal",
            "supports_code": True,
            "supports_diagrams": False,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["RAII & Move Semantics", "Smart Pointers & Memory", "Cache Locality & SIMD", "Template Metaprogramming", "Undefined Behavior"],
            "questions": [
                {
                    "title": "Move Semantics & Rvalue References",
                    "objective": "Assess std::move, universal references, and perfect forwarding.",
                    "instructions": "Ask how rvalue references eliminate unnecessary heap reallocations and how std::forward works.",
                    "fallback": "Explain move semantics in C++11. What is the difference between an lvalue and an rvalue reference, and what does std::move actually do at runtime?",
                    "expected_evidence": ["cast to rvalue", "resource pilfering without allocation", "std::forward perfect forwarding"],
                },
                {
                    "title": "Smart Pointers & Custom Deleters",
                    "objective": "Assess std::unique_ptr, std::shared_ptr, circular reference avoidance, and control blocks.",
                    "instructions": "Ask how std::shared_ptr manages the atomic reference count control block and when to use std::weak_ptr.",
                    "fallback": "How is std::shared_ptr implemented under the hood? Explain the internal control block, atomic increments, and how std::weak_ptr prevents reference cycles.",
                    "expected_evidence": ["control block allocation with make_shared", "atomic ref count overhead", "weak_ptr expired check"],
                },
                {
                    "title": "Cache Locality & Memory Alignment",
                    "objective": "Assess hardware memory hierarchy, L1/L2 cache lines, false sharing, and data-oriented design.",
                    "instructions": "Ask how memory alignment and array-of-structures vs structure-of-arrays impact CPU cache utilization.",
                    "fallback": "Why does a contiguous vector iterate significantly faster than a linked list in C++? Explain CPU cache line prefetching and false sharing in multi-threaded code.",
                    "expected_evidence": ["64-byte cache lines", "prefetcher spatial locality", "alignas and hardware_destructive_interference_size"],
                },
            ],
        },
        {
            "slug": "data-structures-algorithms",
            "title": "Data Structures & Algorithmic Problem Solving",
            "description": "Rigorous algorithmic inquiry: tree/graph traversals, dynamic programming, monotonic stacks, and asymptotic complexity.",
            "category": "TECHNICAL",
            "domain": "DSA",
            "badge": "Algorithms",
            "icon": "BrainCircuit",
            "supports_code": True,
            "supports_diagrams": False,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["Trees & Graphs", "Dynamic Programming", "Monotonic Stacks", "Binary Search Variants", "Amortized Complexity"],
            "questions": [
                {
                    "title": "Monotonic Stack for Next Greater Element",
                    "objective": "Assess ability to recognize O(N) stack patterns for bounded lookahead queries.",
                    "instructions": "Ask candidate to explain how to find the next greater temperature for an array in O(N) time.",
                    "fallback": "Explain how a monotonic decreasing stack solves the Next Greater Element problem in O(N) time and O(N) space. Walk through stack push/pop invariants.",
                    "expected_evidence": ["amortized O(1) per element", "pushing indices vs values", "stack invariant preservation"],
                },
                {
                    "title": "Dynamic Programming with Space Optimization",
                    "objective": "Assess state definition, transition equations, and reduction of memory from O(N*W) to O(W).",
                    "instructions": "Present the 0/1 Knapsack or Longest Common Subsequence problem and ask how to optimize memory.",
                    "fallback": "How do you solve the 0/1 Knapsack problem using dynamic programming? Explain the state transition equation and how to optimize space complexity from O(N*W) to O(W).",
                    "expected_evidence": ["optimal substructure", "overlapping subproblems", "reverse loop iteration for 1D array"],
                },
                {
                    "title": "Graph Traversal & Cycle Detection in Directed Graphs",
                    "objective": "Assess topological sort, Kahn's algorithm, and 3-color DFS cycle detection.",
                    "instructions": "Ask how to verify build dependency graphs or package installation order without deadlocks.",
                    "fallback": "Explain how to detect cycles in a directed graph using DFS (three-color state: unvisited, visiting, visited). How does this relate to topological sorting?",
                    "expected_evidence": ["back-edge detection", "in-degree tracking in Kahn's algorithm", "DAG definition"],
                },
            ],
        },
        {
            "slug": "database-architecture-sql",
            "title": "Database Architecture & SQL Optimization",
            "description": "Relational query execution plans, B-Tree indexes, isolation levels, write-ahead logs, and storage engine mechanics.",
            "category": "TECHNICAL",
            "domain": "Database",
            "badge": "Data Layer",
            "icon": "Database",
            "supports_code": False,
            "supports_diagrams": False,
            "difficulty": "INTERMEDIATE",
            "duration": 40,
            "topics": ["B-Tree & Hash Indexes", "Query Execution Plans", "PostgreSQL MVCC & WAL", "Deadlocks & Row Locks", "Normalization vs Denormalization"],
            "questions": [
                {
                    "title": "B-Tree Index Mechanics & Multi-Column Indexing",
                    "objective": "Assess understanding of index tree traversal, composite index ordering, and index-only scans.",
                    "instructions": "Ask how a composite index on (status, created_at, user_id) executes queries filtering on only created_at.",
                    "fallback": "How does a B-Tree index structure locate rows in O(log N)? Why does a composite index on (A, B, C) fail to optimize a query filtering only on B?",
                    "expected_evidence": ["leftmost prefix rule", "index-only scan / covering index", "leaf node linked list traversal"],
                },
                {
                    "title": "PostgreSQL Write-Ahead Logging & Crash Recovery",
                    "objective": "Assess durability guarantees, checkpointing, and WAL write buffers.",
                    "instructions": "Ask how relational databases guarantee ACID durability even if power fails mid-transaction.",
                    "fallback": "Explain how PostgreSQL uses Write-Ahead Logging (WAL) and checkpointing to guarantee ACID durability during unexpected hardware crashes.",
                    "expected_evidence": ["append-only sequential disk writes", "fsync flush guarantees", "ARIES recovery protocol"],
                },
                {
                    "title": "Deadlock Detection & Concurrency Mitigation",
                    "objective": "Assess lock escalation, row-level locks (SELECT FOR UPDATE), and deadlock graphs.",
                    "instructions": "Ask how deadlocks occur during concurrent balance transfers and how to systematically prevent them.",
                    "fallback": "How do database deadlocks occur in concurrent transactions updating the same rows? How does the database detect them, and how should applications prevent them?",
                    "expected_evidence": ["consistent lock acquisition ordering", "deadlock detection wait-for graph", "transaction retry logic"],
                },
            ],
        },
        {
            "slug": "machine-learning-engineering",
            "title": "Machine Learning Engineering & MLOps",
            "description": "Model training pipelines, feature engineering, loss formulation, data drift detection, and low-latency inference serving.",
            "category": "TECHNICAL",
            "domain": "Machine Learning",
            "badge": "Applied AI",
            "icon": "BrainCircuit",
            "supports_code": True,
            "supports_diagrams": False,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["Loss Functions & Optimization", "Data Leakage & Cross-Validation", "Model Quantization & Pruning", "Data Drift & Monitoring", "Feature Stores"],
            "questions": [
                {
                    "title": "Loss Function Selection & Class Imbalance",
                    "objective": "Assess understanding of Focal Loss, weighted Cross-Entropy, and evaluation metric trade-offs.",
                    "instructions": "Ask how to train an effective fraud detection model where positive fraud cases constitute only 0.1% of transactions.",
                    "fallback": "How do you design an ML training pipeline for extreme class imbalance (e.g. 0.1% fraud)? Compare resampling strategies with Focal Loss and PR-AUC evaluation.",
                    "expected_evidence": ["PR-AUC over ROC-AUC", "Focal Loss down-weighting easy negatives", "stratified k-fold cross-validation"],
                },
                {
                    "title": "Data Leakage & Feature Store Architecture",
                    "objective": "Assess prevention of temporal data leakage in time-series predictive modeling.",
                    "instructions": "Ask how feature stores maintain point-in-time correctness for historical training data.",
                    "fallback": "What is temporal data leakage in predictive modeling, and how does a modern feature store ensure point-in-time correct joins between features and target labels?",
                    "expected_evidence": ["as-of joins", "online vs offline feature store sync", "train/test split timestamp boundary"],
                },
                {
                    "title": "High-Throughput Low-Latency Model Inference",
                    "objective": "Assess quantization (INT8/FP16), TensorRT/ONNX runtime compilation, and batching.",
                    "instructions": "Ask how to serve deep learning model inferences under a strict 15ms p99 latency constraint.",
                    "fallback": "How would you optimize and deploy a PyTorch neural network to serve inferences under a strict 15ms p99 SLA? Discuss quantization, compilation, and dynamic batching.",
                    "expected_evidence": ["ONNX/TensorRT kernel fusion", "post-training quantization", "Triton dynamic batching"],
                },
            ],
        },
        {
            "slug": "ai-llm-engineering",
            "title": "AI & LLM Systems Engineering",
            "description": "RAG architectures, vector indexing, prompt guardrails, agent orchestration, fine-tuning, and semantic caching.",
            "category": "TECHNICAL",
            "domain": "AI / LLM",
            "badge": "Generative AI",
            "icon": "Sparkles",
            "supports_code": True,
            "supports_diagrams": True,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["RAG & Chunking Strategies", "Vector Indexing (HNSW)", "Prompt Injection & Guardrails", "Agent Tool-Use & ReAct", "Context Window Management"],
            "questions": [
                {
                    "title": "Advanced RAG & Retrieval Quality Optimization",
                    "objective": "Assess chunking, hybrid search (dense + sparse BM25), reciprocal rank fusion, and rerankers.",
                    "instructions": "Ask how to architect a RAG pipeline over 500k technical manuals where standard vector similarity fails on acronyms.",
                    "fallback": "How do you build a high-precision RAG system for domain-specific technical documentation? Compare dense vector search with hybrid BM25 search and cross-encoder rerankers.",
                    "expected_evidence": ["hybrid retrieval (Dense + Sparse)", "Reciprocal Rank Fusion (RRF)", "cross-encoder reranking"],
                },
                {
                    "title": "Prompt Injection Defense & Security Guardrails",
                    "objective": "Assess indirect prompt injection, delimiter fencing, and multi-stage classification guardrails.",
                    "instructions": "Ask how to protect an autonomous support agent from indirect prompt injections embedded in user-uploaded emails.",
                    "fallback": "Explain how indirect prompt injection attacks work against LLM agents. What defense-in-depth mechanisms (delimiters, secondary evaluator LLMs, output schemas) are effective?",
                    "expected_evidence": ["untrusted input delimitation", "system prompt instruction hierarchy", "pre/post guardrail classifiers"],
                },
                {
                    "title": "Autonomous Agent Loop & Tool Error Recovery",
                    "objective": "Assess tool calling, JSON schema enforcement, loop termination guarantees, and memory checkpointing.",
                    "instructions": "Ask how to architect a multi-step agent that interacts with external APIs without infinite loops or hallucinated arguments.",
                    "fallback": "Design a reliable LLM agent execution loop (e.g. ReAct). How do you enforce structured tool calling, handle invalid JSON, and guarantee bounded execution?",
                    "expected_evidence": ["constrained decoding / Pydantic schema", "maximum step counters", "idempotent tool execution"],
                },
            ],
        },
        {
            "slug": "devops-cloud-infrastructure",
            "title": "DevOps, SRE & Cloud Infrastructure",
            "description": "Container orchestration, Kubernetes ingress, Linux kernel observability, CI/CD pipelines, and zero-downtime releases.",
            "category": "TECHNICAL",
            "domain": "DevOps",
            "badge": "Infrastructure",
            "icon": "Cloud",
            "supports_code": False,
            "supports_diagrams": True,
            "difficulty": "HARD",
            "duration": 45,
            "topics": ["Docker & cgroups", "Kubernetes Ingress & Pods", "Prometheus & Grafana", "Linux Kernel Observability", "Zero-Downtime Blue/Green"],
            "questions": [
                {
                    "title": "Kubernetes Pod Lifecycle & Graceful Termination",
                    "objective": "Assess understanding of SIGTERM, preStop hooks, readiness probes, and zero-downtime rollouts.",
                    "instructions": "Ask how Kubernetes handles rolling updates so that active client connections are never dropped.",
                    "fallback": "Explain the step-by-step lifecycle when a Kubernetes pod is terminated during a rolling update. How do preStop hooks and readiness probes prevent dropped HTTP requests?",
                    "expected_evidence": ["endpoint slice propagation delay", "SIGTERM handling", "connection draining"],
                },
                {
                    "title": "Linux cgroups & Memory Limit OOM Killers",
                    "objective": "Assess container resource isolation, cgroups v2, and dmesg diagnostics.",
                    "instructions": "Ask what occurs when a containerized process exceeds its configured memory limit and how to debug it.",
                    "fallback": "How does Linux use cgroups to enforce container memory and CPU limits? Explain what happens when a process exceeds its memory limit (OOM killer) and how you diagnose it.",
                    "expected_evidence": ["cgroups v2 memory.max", "OOM score calculation", "dmesg and kernel events"],
                },
                {
                    "title": "Zero-Downtime Database Migrations in CI/CD",
                    "objective": "Assess expand-and-contract pattern, safe column deprecation, and rolling deployment safety.",
                    "instructions": "Ask how to rename a heavily queried database column in production without taking any downtime.",
                    "fallback": "How do you rename a critical column in a high-traffic production PostgreSQL database without incurring any application downtime? Walk through the expand-and-contract pattern.",
                    "expected_evidence": ["dual writing / view mapping", "backfilling in background batches", "atomic cutover"],
                },
            ],
        },
        {
            "slug": "system-design-distributed",
            "title": "High-Scale Distributed System Design",
            "description": "Architect distributed web systems, evaluate consistency models, partitioning, replication, and fault tolerance.",
            "category": "TECHNICAL",
            "domain": "System Design",
            "badge": "Distributed",
            "icon": "Layers",
            "supports_code": False,
            "supports_diagrams": True,
            "difficulty": "EXPERT",
            "duration": 50,
            "topics": ["Distributed Rate Limiting", "CAP Theorem Trade-offs", "Message Queues & Eventual Consistency", "Database Sharding & Consistent Hashing", "Failure Domains & Bulkheading"],
            "questions": [
                {
                    "title": "Distributed Rate Limiter for 100k RPS",
                    "objective": "Assess Token Bucket, Leaky Bucket, Sliding Window Log, and Redis cluster synchronization.",
                    "instructions": "Ask candidate to architect a multi-region distributed rate limiter with minimal latency overhead.",
                    "fallback": "Design a distributed rate limiter supporting 100,000 requests per second across three geographical regions. What algorithms (Token Bucket vs Sliding Window Counter) and data stores would you use?",
                    "expected_evidence": ["Sliding Window Counter algorithm", "Redis Lua script atomicity", "local token batching to reduce network RTT"],
                },
                {
                    "title": "Consistent Hashing & Database Sharding",
                    "objective": "Assess horizontal partitioning, hash rings, virtual nodes, and rebalancing costs.",
                    "instructions": "Ask how consistent hashing distributes keys across a dynamic cluster when nodes join or fail.",
                    "fallback": "Explain how consistent hashing with virtual nodes works in distributed databases (like Cassandra/DynamoDB). How does it prevent massive data reshuffling when nodes join or fail?",
                    "expected_evidence": ["hash ring topology", "virtual nodes for uniform distribution", "replication factor along the ring"],
                },
                {
                    "title": "Eventual Consistency & Distributed Sagas",
                    "objective": "Assess 2-Phase Commit vs Choreography/Orchestration Saga patterns for multi-service transactions.",
                    "instructions": "Ask how an e-commerce platform coordinates orders, payments, and inventory without distributed locks.",
                    "fallback": "How do you maintain data consistency across distributed microservices (e.g. Order, Payment, Inventory) without two-phase commit? Compare Choreographed vs Orchestrated Sagas.",
                    "expected_evidence": ["compensating transactions", "outbox pattern for message publishing", "idempotent consumer events"],
                },
            ],
        },
        {
            "slug": "hr-screening-culture",
            "title": "HR Screening & Cultural Alignment",
            "description": "Initial human resources qualification, career trajectory, team dynamics, compensation alignment, and communication skills.",
            "category": "OTHER",
            "domain": "HR",
            "badge": "HR Screening",
            "icon": "Users",
            "supports_code": False,
            "supports_diagrams": False,
            "difficulty": "FOUNDATIONAL",
            "duration": 30,
            "topics": ["Career Trajectory", "Workplace Values", "Collaboration & Remote Dynamics", "Conflict Resolution", "Growth Goals"],
            "questions": [
                {
                    "title": "Professional Trajectory & Motivations",
                    "objective": "Assess alignment with organizational mission, passion for craft, and reasons for transition.",
                    "instructions": "Ask candidate to walk through their engineering journey, what motivates them, and why they are exploring new opportunities.",
                    "fallback": "Could you walk me through your professional engineering journey, highlight what motivates you to do your best work, and describe what you are looking for in your next role?",
                    "expected_evidence": ["articulate career narrative", "clear intrinsic motivations", "informed interest in team mission"],
                },
                {
                    "title": "Collaboration & Cross-Functional Teamwork",
                    "objective": "Assess how candidate communicates with product managers, designers, and junior teammates.",
                    "instructions": "Ask for an example of working with a challenging stakeholder to align on deadlines and requirements.",
                    "fallback": "Tell me about a time you worked with cross-functional stakeholders (such as product managers or designers) who had conflicting priorities. How did you build consensus?",
                    "expected_evidence": ["empathy for non-technical partners", "constructive compromise", "focus on business outcomes"],
                },
                {
                    "title": "Navigating Feedback & Continuous Growth",
                    "objective": "Assess receptivity to constructive criticism and personal growth mindset.",
                    "instructions": "Ask how candidate received difficult feedback during a code review or performance cycle and how they adapted.",
                    "fallback": "Describe a situation where you received difficult or critical feedback on your work. How did you process it, and what concrete steps did you take to improve?",
                    "expected_evidence": ["non-defensive posture", "proactive self-reflection", "actionable behavior change"],
                },
            ],
        },
        {
            "slug": "behavioral-leadership-star",
            "title": "Behavioral & Engineering Leadership (STAR)",
            "description": "Structured STAR-method inquiry into complex technical disagreements, production incident postmortems, and mentorship.",
            "category": "OTHER",
            "domain": "Behavioral",
            "badge": "Leadership",
            "icon": "Users",
            "supports_code": False,
            "supports_diagrams": False,
            "difficulty": "HARD",
            "duration": 40,
            "topics": ["Technical Disagreements", "Production Outages & Accountability", "Mentoring & Talent Growth", "Delivering Under Ambiguity", "Ownership & Bias for Action"],
            "questions": [
                {
                    "title": "High-Stakes Technical Disagreement",
                    "objective": "Assess STAR-method explanation of resolving architectural or team conflict with data.",
                    "instructions": "Ask candidate to describe a technical disagreement with a peer or lead and how they reached resolution.",
                    "fallback": "Using the STAR method (Situation, Task, Action, Result), tell me about a significant technical disagreement you had with a senior colleague. How did you resolve it constructively?",
                    "expected_evidence": ["structured STAR framework", "reliance on objective benchmarks/evidence", "disagree and commit maturity"],
                },
                {
                    "title": "Critical Production Incident & Blameless Postmortem",
                    "objective": "Assess accountability, calm incident response under fire, and root cause mitigation.",
                    "instructions": "Ask candidate about the most impactful production bug or outage they were involved in and lessons learned.",
                    "fallback": "Walk me through a severe production outage or critical bug you caused or helped resolve. What was your immediate response, how did you communicate, and what systemic safeguards did you implement afterward?",
                    "expected_evidence": ["clear accountability without finger-pointing", "blameless root cause analysis", "preventative engineering improvements"],
                },
                {
                    "title": "Delivering Impact Under Extreme Ambiguity",
                    "objective": "Assess bias for action, rapid prototyping, and de-risking vague requirements.",
                    "instructions": "Ask how candidate took an ill-defined requirement from conception to production delivery.",
                    "fallback": "Describe a project where requirements were vague or rapidly shifting. How did you define the problem, de-risk key assumptions, and deliver measurable business value?",
                    "expected_evidence": ["proactive stakeholder interviews", "incremental delivery slices", "measurable business impact"],
                },
            ],
        },
    ]

    for spec in catalog_specs:
        slug = spec["slug"]
        domain = spec["domain"]
        nodes = _create_standard_nodes(
            track_slug=slug,
            domain=domain,
            questions=spec["questions"],
            supports_code=spec["supports_code"],
        )
        edges = _create_sequential_edges(track_slug=slug, count=len(spec["questions"]))
        entry_node_ids = [f"{slug}.n1"]

        bp = InterviewBlueprint(
            blueprint_id=slug,
            version="1.0.0",
            slug=slug,
            title=spec["title"],
            description=spec["description"],
            category=spec["category"],
            domain=domain,
            status="published",
            entry_node_ids=entry_node_ids,
            nodes=nodes,
            edges=edges,
            completion_policy=CompletionPolicy(
                min_completed_nodes=len(spec["questions"]),
                max_steps=len(spec["questions"]) + 2,
                terminal_node_required=True,
            ),
            runtime_policy=RuntimePolicy(
                allow_code=spec["supports_code"],
                allow_voice=True,
                default_language="python",
                timeout_minutes=spec["duration"],
            ),
            public_metadata=PublicMetadata(
                difficulty=spec["difficulty"],
                duration_minutes=spec["duration"],
                topics=spec["topics"],
                badge=spec["badge"],
                icon=spec["icon"],
                supports_code=spec["supports_code"],
                supports_diagrams=spec["supports_diagrams"],
            ),
        )

        validation_errors = BlueprintGraphValidator.validate(bp)
        if validation_errors:
            logger.error(f"FATAL: Blueprint '{slug}' failed integrity validation: {validation_errors}")
            raise ValueError(f"Blueprint '{slug}' is invalid: {validation_errors}")

        blueprints[slug] = bp

    return blueprints


# Singleton registry instance
_PRESEEDED_BLUEPRINTS: Dict[str, InterviewBlueprint] = _build_preseeded_catalog()
_DYNAMIC_BLUEPRINTS: Dict[str, InterviewBlueprint] = {}


class BlueprintRegistryService:
    """
    Authoritative service managing published interview blueprints and track catalog.
    Enforces that candidate sessions execute immutable, validated graph blueprints.
    Integrates directly with PostgreSQL relational tables (interview_domains, interview_blueprints).
    """

    @classmethod
    def register_blueprint(cls, blueprint: InterviewBlueprint) -> None:
        """Dynamically registers or updates an in-memory blueprint."""
        _DYNAMIC_BLUEPRINTS[blueprint.slug] = blueprint

    @classmethod
    def clear_dynamic_blueprints(cls) -> None:
        """Clears all dynamically registered blueprints, resetting to pre-seeded state."""
        _DYNAMIC_BLUEPRINTS.clear()

    @classmethod
    def list_published_tracks(cls, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Synchronous getter returning all published tracks with public metadata.
        Excludes all internal rubrics, prompt instructions, and graph edge mechanics.
        Combines dynamic and pre-seeded catalogs.
        """
        all_blueprints = {**_PRESEEDED_BLUEPRINTS, **_DYNAMIC_BLUEPRINTS}
        tracks = []
        for bp in all_blueprints.values():
            if bp.status != "published":
                continue
            if category and category.upper() != "ALL" and bp.category.upper() != category.upper():
                continue
            tracks.append({
                "slug": bp.slug,
                "title": bp.title,
                "description": bp.description,
                "category": bp.category,
                "domain": bp.domain,
                "difficulty": bp.public_metadata.difficulty,
                "duration_minutes": bp.public_metadata.duration_minutes,
                "topics": bp.public_metadata.topics,
                "badge": bp.public_metadata.badge,
                "icon": bp.public_metadata.icon,
                "supports_code": bp.public_metadata.supports_code,
                "supports_diagrams": bp.public_metadata.supports_diagrams,
                "version": bp.version,
            })
        return tracks

    @classmethod
    def get_track_detail(cls, slug: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves detailed public metadata for a specific track by slug.
        """
        all_blueprints = {**_PRESEEDED_BLUEPRINTS, **_DYNAMIC_BLUEPRINTS}
        bp = all_blueprints.get(slug)
        if not bp or bp.status != "published":
            return None
        return {
            "slug": bp.slug,
            "title": bp.title,
            "description": bp.description,
            "category": bp.category,
            "domain": bp.domain,
            "difficulty": bp.public_metadata.difficulty,
            "duration_minutes": bp.public_metadata.duration_minutes,
            "topics": bp.public_metadata.topics,
            "badge": bp.public_metadata.badge,
            "icon": bp.public_metadata.icon,
            "supports_code": bp.public_metadata.supports_code,
            "supports_diagrams": bp.public_metadata.supports_diagrams,
            "total_questions": len([n for n in bp.nodes.values() if n.node_type == "question"]),
            "version": bp.version,
        }

    @classmethod
    def get_blueprint(cls, slug: str, version: Optional[str] = None) -> Optional[InterviewBlueprint]:
        """
        Resolves the exact published blueprint version.
        If version is omitted, returns the currently active published version.
        """
        all_blueprints = {**_PRESEEDED_BLUEPRINTS, **_DYNAMIC_BLUEPRINTS}
        bp = all_blueprints.get(slug)
        if not bp:
            return None
        if version and bp.version != version:
            logger.warning(f"Requested blueprint version {version} for {slug}, currently loaded is {bp.version}")
        return bp

    @classmethod
    async def get_blueprint_async(
        cls, slug: str, version: Optional[str] = None, db: Optional[Any] = None
    ) -> Optional[InterviewBlueprint]:
        """
        Asynchronous database lookup for a published blueprint by slug and version.
        Falls back to in-memory catalog if not found in database.
        """
        if not db:
            return cls.get_blueprint(slug, version=version)

        from sqlalchemy import select
        from app.models.interview import (
            InterviewBlueprintModel,
            InterviewBlueprintVersionModel,
        )

        try:
            stmt = select(InterviewBlueprintModel, InterviewBlueprintVersionModel).join(
                InterviewBlueprintVersionModel,
                InterviewBlueprintModel.active_version_id == InterviewBlueprintVersionModel.id,
            ).where(
                InterviewBlueprintModel.slug == slug,
                InterviewBlueprintModel.status == "PUBLISHED",
            )
            if version:
                stmt = select(InterviewBlueprintModel, InterviewBlueprintVersionModel).join(
                    InterviewBlueprintVersionModel,
                    InterviewBlueprintModel.id == InterviewBlueprintVersionModel.blueprint_id,
                ).where(
                    InterviewBlueprintModel.slug == slug,
                    InterviewBlueprintVersionModel.version == version,
                    InterviewBlueprintVersionModel.status == "PUBLISHED",
                )

            row = (await db.execute(stmt)).first()
            if row and row[1].graph_data:
                return InterviewBlueprint.model_validate(row[1].graph_data)
        except Exception as err:
            logger.warning("DB query failed in get_blueprint_async: %s — using in-memory catalog.", err)

        return cls.get_blueprint(slug, version=version)

    @classmethod
    async def sync_preseeded_to_db(cls, db: Any) -> None:
        """
        Synchronizes pre-seeded blueprints into the relational PostgreSQL database tables:
        interview_domains, interview_blueprints, interview_blueprint_versions.
        """
        from sqlalchemy import select
        from app.models.interview import (
            InterviewDomain,
            InterviewBlueprintModel,
            InterviewBlueprintVersionModel,
        )

        try:
            for bp in _PRESEEDED_BLUEPRINTS.values():
                # 1. Ensure domain exists
                domain_stmt = select(InterviewDomain).where(InterviewDomain.slug == bp.slug)
                domain_res = await db.execute(domain_stmt)
                domain_obj = domain_res.scalars().first()

                if not domain_obj:
                    domain_obj = InterviewDomain(
                        slug=bp.slug,
                        name=bp.domain,
                        description=bp.description,
                        category=bp.category,
                        icon_key=bp.public_metadata.icon,
                        display_order=0,
                        is_active=True,
                    )
                    db.add(domain_obj)
                    await db.flush()
                else:
                    domain_obj.name = bp.domain
                    db.add(domain_obj)

                # 2. Ensure blueprint root exists
                bp_stmt = select(InterviewBlueprintModel).where(InterviewBlueprintModel.slug == bp.slug)
                bp_res = await db.execute(bp_stmt)
                bp_obj = bp_res.scalars().first()

                if not bp_obj:
                    bp_obj = InterviewBlueprintModel(
                        domain_id=domain_obj.id,
                        slug=bp.slug,
                        title=bp.title,
                        description=bp.description,
                        status="PUBLISHED",
                    )
                    db.add(bp_obj)
                    await db.flush()

                # 3. Ensure active version exists
                ver_stmt = select(InterviewBlueprintVersionModel).where(
                    InterviewBlueprintVersionModel.blueprint_id == bp_obj.id,
                    InterviewBlueprintVersionModel.version == bp.version,
                )
                ver_res = await db.execute(ver_stmt)
                ver_obj = ver_res.scalars().first()

                if not ver_obj:
                    ver_obj = InterviewBlueprintVersionModel(
                        blueprint_id=bp_obj.id,
                        version=bp.version,
                        schema_version=bp.schema_version,
                        status="PUBLISHED",
                        graph_data=bp.model_dump(),
                        public_metadata=bp.public_metadata.model_dump(),
                        created_by="SYSTEM",
                    )
                    db.add(ver_obj)
                    await db.flush()

                bp_obj.active_version_id = ver_obj.id
                bp_obj.status = "PUBLISHED"

            await db.commit()
            logger.info("Successfully synchronized %d preseeded blueprints to database.", len(_PRESEEDED_BLUEPRINTS))
        except Exception as e:
            await db.rollback()
            logger.warning("Notice on sync_preseeded_to_db: %s", e)

    @classmethod
    async def list_published_tracks_async(
        cls, category: Optional[str] = None, db: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Database-driven catalog list query.
        Returns published tracks from the relational database, or falls back to in-memory catalog.
        """
        if not db:
            return cls.list_published_tracks(category=category)

        from sqlalchemy import select
        from app.models.interview import (
            InterviewDomain,
            InterviewBlueprintModel,
            InterviewBlueprintVersionModel,
        )

        try:
            stmt = (
                select(InterviewBlueprintModel, InterviewBlueprintVersionModel, InterviewDomain)
                .join(InterviewDomain, InterviewBlueprintModel.domain_id == InterviewDomain.id)
                .join(
                    InterviewBlueprintVersionModel,
                    InterviewBlueprintModel.active_version_id == InterviewBlueprintVersionModel.id,
                )
                .where(
                    InterviewDomain.is_active == True,
                    InterviewBlueprintModel.status == "PUBLISHED",
                    InterviewBlueprintVersionModel.status == "PUBLISHED",
                )
                .order_by(InterviewDomain.display_order.asc(), InterviewDomain.created_at.asc())
            )

            if category and category.upper() != "ALL":
                stmt = stmt.where(InterviewDomain.category == category.upper())

            results = (await db.execute(stmt)).all()

            if not results:
                # First run: sync pre-seeded blueprints to DB and retry
                await cls.sync_preseeded_to_db(db)
                results = (await db.execute(stmt)).all()

            if not results:
                return cls.list_published_tracks(category=category)

            tracks = []
            for bp_model, ver_model, domain_model in results:
                meta = ver_model.public_metadata or {}
                tracks.append({
                    "slug": bp_model.slug,
                    "title": bp_model.title,
                    "description": bp_model.description,
                    "category": domain_model.category,
                    "domain": domain_model.name,
                    "difficulty": meta.get("difficulty", "MEDIUM"),
                    "duration_minutes": meta.get("duration_minutes", 30),
                    "topics": meta.get("topics", []),
                    "badge": meta.get("badge", domain_model.name),
                    "icon": meta.get("icon", domain_model.icon_key),
                    "supports_code": meta.get("supports_code", True),
                    "supports_diagrams": meta.get("supports_diagrams", False),
                    "version": ver_model.version,
                })
            return tracks
        except Exception as err:
            logger.warning("DB query failed in list_published_tracks_async: %s — using in-memory catalog.", err)
            return cls.list_published_tracks(category=category)

    @classmethod
    async def get_track_detail_async(cls, slug: str, db: Optional[Any] = None) -> Optional[Dict[str, Any]]:
        """
        Database-driven track detail query by slug.
        """
        if not db:
            return cls.get_track_detail(slug)

        from sqlalchemy import select
        from app.models.interview import (
            InterviewDomain,
            InterviewBlueprintModel,
            InterviewBlueprintVersionModel,
        )

        try:
            stmt = (
                select(InterviewBlueprintModel, InterviewBlueprintVersionModel, InterviewDomain)
                .join(InterviewDomain, InterviewBlueprintModel.domain_id == InterviewDomain.id)
                .join(
                    InterviewBlueprintVersionModel,
                    InterviewBlueprintModel.active_version_id == InterviewBlueprintVersionModel.id,
                )
                .where(
                    InterviewBlueprintModel.slug == slug,
                    InterviewBlueprintModel.status == "PUBLISHED",
                )
            )
            row = (await db.execute(stmt)).first()
            if not row:
                return cls.get_track_detail(slug)

            bp_model, ver_model, domain_model = row
            meta = ver_model.public_metadata or {}
            graph = ver_model.graph_data or {}
            nodes = graph.get("nodes", {})
            total_q = len([n for n in nodes.values() if n.get("node_type") == "question"])
            domain_name = graph.get("domain") or domain_model.name

            return {
                "slug": bp_model.slug,
                "title": bp_model.title,
                "description": bp_model.description,
                "category": domain_model.category,
                "domain": domain_name,
                "difficulty": meta.get("difficulty", "MEDIUM"),
                "duration_minutes": meta.get("duration_minutes", 30),
                "topics": meta.get("topics", []),
                "badge": meta.get("badge", domain_model.name),
                "icon": meta.get("icon", domain_model.icon_key),
                "supports_code": meta.get("supports_code", True),
                "supports_diagrams": meta.get("supports_diagrams", False),
                "total_questions": total_q or 3,
                "version": ver_model.version,
            }
        except Exception as err:
            logger.warning("DB query failed in get_track_detail_async: %s — using in-memory fallback.", err)
            return cls.get_track_detail(slug)

