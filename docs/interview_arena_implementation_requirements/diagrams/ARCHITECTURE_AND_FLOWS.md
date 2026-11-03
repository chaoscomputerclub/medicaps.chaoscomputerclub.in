# Architecture and Flow Diagrams

## System architecture

```mermaid
flowchart TD
    C[Candidate UI] --> API[Existing Backend API]
    A[Admin Authoring] --> API
    API --> CAT[Interview Catalog]
    API --> REG[Blueprint Registry]
    API --> ORCH[Interview Orchestrator]
    API --> RES[Resume API]
    CAT --> DB[(Application Database)]
    REG --> DB
    ORCH --> DB
    ORCH --> QG[Question Generation]
    ORCH --> EV[Rubric Evaluation]
    ORCH --> SEL[Adaptive Node Selector]
    SEL --> REG
    RES --> JOB[Background Job Queue]
    JOB --> PY[Python Resume Processor]
    PY --> EX[Text and Section Extraction]
    EX --> KG[Candidate Evidence Graph]
    EX --> EMB[Embedding Generation]
    KG --> DB
    EMB --> VDB[(Candidate-scoped Vector Store)]
    ORCH --> RET[Context Retrieval]
    RET --> VDB
    ORCH --> REPORT[Report Generator]
    REPORT --> DB
```

## Candidate flow

```mermaid
flowchart TD
    A[Open Interview Arena] --> B[Browse Published Tracks]
    B --> C[Select Track]
    C --> D{Resume context available?}
    D -->|No| E[Create Session]
    D -->|Yes| F[Attach Candidate Context]
    F --> E
    E --> G[Pin Blueprint Version]
    G --> H[Initialize Session Graph State]
    H --> I[Show First Question]
    I --> J[Submit Response]
    J --> K[Evaluate Against Node Rubric]
    K --> L[Update Session Competency State]
    L --> M{Completion policy met?}
    M -->|No| N[Select Next Eligible Node]
    N --> I
    M -->|Yes| O[Freeze Assessment Snapshot]
    O --> P[Show Report and History]
```

## Optional resume processing

```mermaid
flowchart TD
    A[PDF or DOCX Upload] --> B[Validate File]
    B --> C[Private Object Storage]
    C --> D[Async Processing Job]
    D --> E[Python Text Extraction]
    E --> F[Section and Entity Extraction]
    F --> G[Normalize Skills and Projects]
    G --> H[Candidate Evidence Records]
    E --> I[Chunk with Provenance]
    I --> J[Embedding Model]
    J --> K[Candidate-scoped Vector Index]
    H --> L[Resume Context Ready]
    K --> L
```

## Response evaluation sequence

```mermaid
sequenceDiagram
    participant UI as Candidate UI
    participant API as Backend API
    participant OR as Orchestrator
    participant BP as Blueprint Registry
    participant LLM as Evaluator/Question Model
    participant DB as Database

    UI->>API: Submit response + idempotency key
    API->>OR: Validate session ownership and active node
    OR->>BP: Load pinned node and rubric
    OR->>DB: Persist response
    OR->>LLM: Evaluate response against rubric
    LLM-->>OR: Structured evaluation
    OR->>OR: Validate schema and update session state
    OR->>BP: Resolve eligible outgoing nodes
    OR->>LLM: Generate next node question
    OR->>DB: Persist evaluation, transition, next question
    OR-->>API: Updated session state
    API-->>UI: Evaluation feedback/progress + next question
```

## Blueprint lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Validating
    Validating --> Draft: Validation failed
    Validating --> Approved: Validation passed
    Approved --> Published: Authorized publish
    Published --> Retired: Replaced or retired
    Retired --> [*]
```

## Important boundaries

- The blueprint graph is authored and versioned; the candidate session only maintains a runtime overlay.
- Resume context is optional and candidate-scoped.
- The candidate cannot alter graph topology or node instructions.
- The graph selector must only return nodes belonging to the pinned blueprint version.
- A deterministic fallback path must exist if model services fail.
