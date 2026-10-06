# THREE-LEVEL END-TO-END ARCHITECTURE SPECIFICATION
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Scope:** Macro System, Microservice/Data Flow, and Deep Execution/State Engine  
**Status:** PRODUCTION AS-BUILT FORENSIC SPECIFICATION  

---

## 1. Architectural Narrative & System Levels

The Chaos Computer Club architecture is structured across three complementary levels of detail:

1. **Level 1 (System / Macro Architecture)**: Depicts the physical infrastructure, network ingress boundaries, core persistence layers, and compute nodes.
2. **Level 2 (Service / Data Flow Architecture)**: Traces application service boundaries, caching layers, transactional outbox relays, and the execution router fabric.
3. **Level 3 (Event / State / Execution Architecture)**: Traces the precise millisecond-level causal progression of mutations from User Action $\to$ PostgreSQL Row Locks $\to$ Transactional Outbox $\to$ Redis Pub/Sub $\to$ SSE $\to$ Redux $\to$ React DOM, including attempt leasing and conditional CAS fences.

---

## 2. Level 1 — Macro Architecture Diagram

```mermaid
graph TB
    subgraph ClientTier ["Edge & Client Tier"]
        Browser["User Browser (React 18 SPA)"]
        EventSource["EventSource (W3C SSE Client)"]
        IoTDevice["IoT Turnstile / Hardware Scanner"]
    end

    subgraph IngressTier ["Edge & Ingress Tier"]
        Cloudflare["Cloudflare Edge (WAF, SSL, Turnstile)"]
        Nginx["Nginx Reverse Proxy (:80 / :443)"]
    end

    subgraph ControlPlane ["FastAPI Control Plane"]
        FastAPI["FastAPI ASGI Cluster (Uvicorn Workers)"]
        OutboxRelay["Transactional Outbox Relayer Loop"]
        RedisRelay["Multi-Worker Redis SSE Relay Task"]
    end

    subgraph PersistenceTier ["Authoritative Storage & Coordination"]
        Postgres[(PostgreSQL 16 Engine<br/>Authoritative Source of Truth)]
        Redis[(Redis 7 Coordination Hub<br/>Queues, Leases, Replay Buffer)]
    end

    subgraph ComputeFabric ["Compute & Execution Fabric"]
        ExecRouter["Central Execution Router"]
        NodeAgent1["Distributed Node Agent 1 (Bare-Metal / Mac Mini)"]
        NodeAgent2["Distributed Node Agent 2 (Linux Workstation)"]
        Codebox["Codebox Isolated Sandbox Container"]
        LocalSandbox["Local In-Process Fallback Sandbox"]
    end

    Browser -->|HTTPS REST| Cloudflare
    EventSource -->|text/event-stream| Cloudflare
    IoTDevice -->|Webhook POST| Cloudflare
    Cloudflare --> Nginx
    Nginx --> FastAPI

    FastAPI -->|ACID Read/Write| Postgres
    FastAPI -->|Cache / Queue / Lock| Redis
    OutboxRelay -->|Poll Pending| Postgres
    OutboxRelay -->|Enqueue / Publish| Redis
    RedisRelay -->|Subscribe ccc:realtime:events| Redis
    RedisRelay -->|Fan-Out to Clients| EventSource

    FastAPI --> ExecRouter
    ExecRouter -->|Claim / Heartbeat| Redis
    ExecRouter -.->|gRPC / HTTP Job| NodeAgent1
    ExecRouter -.->|gRPC / HTTP Job| NodeAgent2
    ExecRouter -->|Docker / cgroups| Codebox
    ExecRouter -->|Subprocess| LocalSandbox

    classDef primary fill:#1e1e24,stroke:#f97316,stroke-width:2px,color:#fff;
    classDef storage fill:#18181b,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef edge fill:#09090b,stroke:#a855f7,stroke-width:2px,color:#fff;

    class Browser,EventSource,FastAPI,ExecRouter primary;
    class Postgres,Redis storage;
    class Cloudflare,Nginx edge;
```

---

## 3. Level 2 — Service & Data Flow Architecture Diagram

```mermaid
graph TD
    subgraph FrontendApp ["Frontend Application Layer"]
        Router["AppRoutes / Page Views"]
        ReduxStore["Redux Toolkit Global Store"]
        SWRStore["globalSwrStore (SWR Cache)"]
        SSEMultiplexer["GlobalSseMultiplexer (realtime.ts)"]
    end

    subgraph ApiControllers ["FastAPI Modular Controllers"]
        ContestCtrl["ContestController"]
        LeaderboardCtrl["LeaderboardController / ScoreboardController"]
        EventsCtrl["EventsController (/events/stream)"]
        NodesCtrl["NodesController (/api/nodes/*)"]
        WebhookCtrl["WebhookController (/webhooks/*)"]
    end

    subgraph DomainServices ["Core Business Services"]
        ContestExecService["ContestExecutionService"]
        DynamicContestService["DynamicContestService"]
        AttemptMgr["AttemptManager (Result Fencing)"]
        Broadcaster["EventBroadcaster & Outbox Relay"]
        CacheEngine["CacheSyncEngine (Atomic CAS Lua)"]
    end

    subgraph StoragePipeline ["Persistence & Outbox Pipeline"]
        DBTx["PostgreSQL Transaction (Advisory Locks)"]
        OutboxTable[("outbox_events Table")]
        RedisQueue[("Redis ChaosQueue Engine")]
        RedisZSet[("Redis Replay Buffer (ZSET: 100 items)")]
        RedisPubSub[("Redis Channel: ccc:realtime:events")]
    end

    Router -->|Dispatch Thunk| ReduxStore
    Router -->|Query Read| SWRStore
    ReduxStore -->|HTTP JSON| ContestCtrl
    SWRStore -->|HTTP JSON| LeaderboardCtrl
    SSEMultiplexer -->|GET SSE| EventsCtrl

    ContestCtrl --> ContestExecService
    ContestCtrl --> DynamicContestService
    LeaderboardCtrl --> CacheEngine
    EventsCtrl --> Broadcaster
    NodesCtrl --> AttemptMgr

    ContestExecService --> DBTx
    ContestExecService --> OutboxTable
    AttemptMgr --> DBTx

    DBTx -->|Commit| OutboxTable
    OutboxTable -->|Polled by Background Worker| Broadcaster
    Broadcaster --> RedisZSet
    Broadcaster --> RedisPubSub
    Broadcaster --> RedisQueue

    RedisPubSub -->|Cross-Worker Relay| EventsCtrl
    EventsCtrl -->|W3C SSE Push| SSEMultiplexer
    SSEMultiplexer -->|applyRealtimeEvent| ReduxStore
    SSEMultiplexer -->|invalidateSwrCache| SWRStore
```

---

## 4. Level 3 — Event, State & Submission Execution Architecture Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Cadet as Cadet Browser
    participant Arena as ContestArenaPage (React)
    participant Redux as Redux contestSlice
    participant API as FastAPI /arena/submit
    participant ExecSvc as ContestExecutionService
    participant Router as ExecutionRouter
    participant Node as Distributed Node / Codebox
    participant DB as PostgreSQL 16
    participant Outbox as outbox_events
    participant Redis as Redis 7 (Coordination)
    participant Broadcaster as EventBroadcaster (SSE)
    participant Mux as GlobalSseMultiplexer

    Cadet->>Arena: Clicks "Submit Code" (⌘⏎)
    Arena->>Redux: dispatch(submitArenaCodeThunk)
    Redux->>API: POST /api/contests/:slug/arena/submit
    API->>ExecSvc: submit_arena_code()
    
    Note over ExecSvc,Redis: Check 2s Redis Dedup Barrier (sub_debounce)
    ExecSvc->>Redis: SET sub_debounce NX EX 2
    Redis-->>ExecSvc: OK

    Note over ExecSvc,DB: Rollback read connection before sandbox execution
    ExecSvc->>DB: db.rollback()
    
    ExecSvc->>Router: router.execute()
    Router->>DB: AttemptManager.create_job() + create_attempt()
    DB-->>Router: Created attempt_1 (state=STARTED, lease_id)
    Router->>Node: Dispatch Job with Time/Memory Limits
    Node-->>Router: Execution Result (verdict=ACCEPTED, runtime=14ms)
    
    Router->>DB: AttemptManager.finalize_attempt(attempt_1, COMPLETED)
    Note over Router,DB: Atomic CAS: UPDATE judge_jobs WHERE active_attempt_id = attempt_1
    DB-->>Router: FinalizeResult.SUCCESS

    Note over ExecSvc,DB: Open DB Transaction & Acquire Advisory Lock
    ExecSvc->>DB: SELECT pg_advisory_xact_lock('scoreboard:cid')
    ExecSvc->>DB: INSERT INTO contest_submissions
    ExecSvc->>DB: ContestRepository.re_rank_scoreboard()
    ExecSvc->>Outbox: record_outbox_event('realtime', 'submission_evaluated')
    ExecSvc->>DB: COMMIT TRANSACTION
    DB-->>ExecSvc: Committed

    Note over ExecSvc,Redis: Invalidate Cache Patterns
    ExecSvc->>Redis: DEL cache:scoreboard:slug*
    ExecSvc->>Redis: DEL cache:contest:detail:slug*

    ExecSvc->>Broadcaster: relay_outbox_events() -> broadcast_event()
    Broadcaster->>Redis: ZADD ccc:sse:replay:contest:slug (version, payload)
    Broadcaster->>Redis: PUBLISH ccc:realtime:events (payload)
    
    Redis-->>Broadcaster: Redis Event Relay Received
    Broadcaster-->>Mux: SSE Frame: event: submission_evaluated (id: version)
    Mux->>Mux: handleRawMessage()
    Mux->>Arena: Subscribed Handler Called
    Arena->>Arena: setSolvedProblemIds(), toast.success()
    Mux->>Redux: dispatch(applyRealtimeEvent)
    Redux->>Redux: contestSlice Reducer: update status / timestamps
    Arena-->>Cadet: Instant Zero-Flicker Scoreboard & Status Update
```
