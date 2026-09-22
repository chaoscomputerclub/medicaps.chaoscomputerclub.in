# Technical Requirements Document (TRD)
# Chaos Computer Club (CCC) — Medi-Caps University Chapter Platform

**Document Version:** `3.0.0-PRODUCTION`  
**System Classification:** `Enterprise Competitive Programming Arena & Member Intelligence Hub`  
**Target Environment:** `DigitalOcean Production Node (143.198.38.205) / Linux Ubuntu 24.04 LTS`  
**Author:** Chaos Computer Club Core Architecture & Engineering Team  
**Institution:** Medi-Caps University, Indore  

---

## 1. System Overview & Architectural Topology

The **Chaos Computer Club (CCC) Medi-Caps Chapter Platform** is a decoupled, high-performance competitive programming ecosystem engineered for university-wide algorithmic tournaments, real-time code sandboxing, and immutable student merit records.

The architecture provides a zero-lag tournament experience for all participating cadets, featuring a dedicated live coding arena (Monaco IDE), asynchronous multi-language code execution via sandboxed container workers, real-time ICPC/LeetCode-style scoreboards, and automated university rating calculations.

### 1.1 Architectural Component Diagram

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#18181b',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ccff00',
    'lineColor': '#ccff00',
    'secondaryColor': '#27272a',
    'tertiaryColor': '#09090b',
    'edgeLabelBackground': '#18181b',
    'clusterBkg': '#0f0f11',
    'clusterBorder': '#ccff00'
  }
}}%%
flowchart TB
    subgraph Client_Tier [Client Presentation Layer]
        CadetPortal["Cadet Web Portal\n(medicaps.chaoscomputerclub.in)\nReact 19 + TypeScript + Vite\nPort 8081 (Dev)"]
        AdminConsole["Admin Command Console\n(admin.chaoscomputerclub.in)\nReact 19 + Vite Standalone\nPort 8082 (Dev)"]
    end

    subgraph Edge_Tier [Network & Reverse Proxy Layer]
        Cloudflare["Cloudflare Global Anycast DNS & Edge\n(DDoS Mitigation, SSL Offloading, WAF)"]
        Nginx["Production Nginx 1.24+ Reverse Proxy\n(/etc/nginx/sites-available/chaoscomputerclub.conf)\nTLS 1.2/1.3 + HTTP/2 + WebSocket Proxy"]
    end

    subgraph App_Tier [Application Service Layer]
        FastAPI["FastAPI High-Throughput Core (Python 3.12)\n(Uvicorn Multi-Worker / Port 8002)\nAsyncIO Event Loop"]
        ContestSM["Contest State Machine & Timer Engine\n(Lifecycle: Upcoming -> Live -> Concluded)"]
        RatingEngine["Elo Rating & Division Engine\n(Star Division Calculation 1★-5★)"]
        EventBroadcaster["Event Broadcaster & SSE Engine\n(Real-time Scoreboards & Leaderboards)"]
    end

    subgraph Judge_Tier [Sandboxed Execution Cluster]
        JudgeDispatch["Judge Engine Dispatcher\n(Provider Factory: CodeBox / Docker)"]
        CodeBoxWorker["CodeBox Microservice (Node.js 20 LTS)\nExpress + BullMQ Worker + Dockerode\nPort 3000"]
        ContainerPool["Pre-warmed Container Pool\n(Linux cgroups, 2.0s CPU, 256MB RAM)"]
    end

    subgraph Data_Tier [Persistence & Caching Tier]
        Postgres_DB[("PostgreSQL 16 AsyncIO DB\n(ccc_medicaps / 127.0.0.1:5432)")]
        Redis_Store[("Redis 7.0 In-Memory Store\n(Port 6379 / BullMQ Queues,\nSWR Cache, Telemetry)")]
    end

    CadetPortal -->|HTTPS / WSS| Cloudflare
    AdminConsole -->|HTTPS / WSS| Cloudflare

    Cloudflare -->|SSL Handshake| Nginx
    Nginx -->|SPA Static Bundle /var/www/ccc-medicaps| CadetPortal
    Nginx -->|Admin SPA Bundle /var/www/ccc-medicaps-admin| AdminConsole
    Nginx -->|Upstream Reverse Proxy 127.0.0.1:8002| FastAPI

    FastAPI --> ContestSM
    FastAPI --> RatingEngine
    FastAPI --> EventBroadcaster
    FastAPI --> JudgeDispatch

    JudgeDispatch -->|BullMQ Queue| Redis_Store
    JudgeDispatch -->|HTTP POST /submissions| CodeBoxWorker
    CodeBoxWorker --> ContainerPool

    FastAPI -->|Async Session Queries| Postgres_DB
    FastAPI -->|SWR Caching & Invalidation| Redis_Store
```

---

## 2. Technical Flow & Tournament Lifecycle Architecture

The platform's contest pipeline is a direct, single-phase competitive programming tournament model. Every registered cadet competes directly in the official contest arena, solves algorithmic problems, and earns points, penalties, and official Elo rating adjustments.

### 2.1 Unified Tournament Sequence Diagram

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#18181b',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ccff00',
    'lineColor': '#ccff00',
    'secondaryColor': '#27272a',
    'tertiaryColor': '#09090b',
    'noteBkgColor': '#18181b',
    'noteTextColor': '#ccff00',
    'noteBorderColor': '#ccff00',
    'actorBkg': '#18181b',
    'actorBorder': '#ccff00',
    'actorTextColor': '#ffffff',
    'actorLineColor': '#ccff00',
    'signalColor': '#ccff00',
    'signalTextColor': '#ffffff',
    'labelBoxBkgColor': '#18181b',
    'labelBoxBorderColor': '#ccff00',
    'labelTextColor': '#ffffff'
  }
}}%%
sequenceDiagram
    autonumber
    actor Cadet as 👤 Competitor Cadet
    participant Web as 💻 Cadet Portal (medicaps.*)
    participant API as ⚙️ FastAPI Backend (api.*)
    participant Redis as ⚡ Redis 7 Cache & Queue
    participant CodeBox as 📦 CodeBox Judge Engine
    participant DB as 🗄️ PostgreSQL Database
    participant Admin as 🖥️ Admin Console (admin.*)

    Note over Cadet,Admin: Contest Phase 1: Registration & Lobby Standby
    Cadet->>Web: Visit /contests/:slug
    Web->>API: POST /api/contests/:slug/register
    API->>DB: Record ContestRegistration
    API-->>Web: Registration Confirmed

    Note over Cadet,Admin: Contest Phase 2: Live Tournament Arena
    Admin->>API: Transition Contest to 'live'
    API->>Redis: Publish SSE 'contest_live' event
    Cadet->>Web: Enter /contests/:slug/arena
    Web->>API: GET /api/contests/:slug/problems
    API-->>Web: Problem Statements & LeetCode Starter Codes

    loop Challenge Solution Loop
        Cadet->>Web: Write Code in Monaco Editor (C++, Py, Java, JS, TS)
        alt Run Sample Cases
            Web->>API: POST /api/contests/:slug/problems/:problemId/run
            API->>CodeBox: Execute Sandboxed Code (Sample Inputs)
            CodeBox-->>API: Testcase Execution Verdict
            API-->>Web: Output, Stdout, Stderr, Runtime (ms)
        else Submit Solution
            Web->>API: POST /api/contests/:slug/problems/:problemId/submit
            API->>CodeBox: Execute against Hidden Testcases
            CodeBox-->>API: Verdict (AC, WA, TLE, MLE, CE, RE)
            API->>DB: Record ContestSubmission & Update ScoreboardEntry
            API->>Redis: Invalidate Scoreboard SWR Cache
            API-->>Web: Submission Verdict & Points Awarded
        end
    end

    Note over Cadet,Admin: Contest Phase 3: Final Adjudication & Rating Compute
    Admin->>API: Transition Contest to 'finished'
    API->>DB: Lock Submissions & Calculate Final Standings
    API->>API: Compute Elo Rating Deltas & Update Star Tiers (1★–5★)
    API->>DB: Save RatingHistory & Update MemberProfile
    API->>Redis: Invalidate Leaderboard Caches
    Cadet->>Web: View /contests/:slug/results
    Web->>API: GET /api/contests/:slug/ranking
    API-->>Web: Official Standings (Rank #, Score, Penalty, Podium)
```

---

## 3. Sandboxed Execution Engine (CodeBox & Judge0 Architecture)

The execution cluster safely evaluates arbitrary student code across 6 standard competitive programming runtimes with zero risk to the host operating system.

### 3.1 Runtime Specifications & Constraints

| Language | Compiler / Runtime | Standard | Memory Cap | Time Cap | Output Cap |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **C++** | `g++ 14.1.0` | `-std=c++20 -O2` | 256 MB | 2.0 s | 64 KB |
| **C** | `gcc 14.1.0` | `-std=c17 -O2` | 256 MB | 2.0 s | 64 KB |
| **Python** | `Python 3.12.3` | Optimized Bytecode | 256 MB | 4.0 s | 64 KB |
| **Java** | `OpenJDK 21.0.3` | Modern LTS Java | 512 MB | 3.0 s | 64 KB |
| **JavaScript** | `Node.js 20 LTS` | ES2023 | 256 MB | 2.5 s | 64 KB |
| **TypeScript** | `tsx / esbuild` | Strict Typecheck | 256 MB | 2.5 s | 64 KB |

### 3.2 Sandbox Security Isolation Layers
1. **Linux cgroups v2**: Memory limits (`memory.max = 256M`), CPU quotas (`cpu.max = 200000 100000`), PID limits (`pids.max = 64`).
2. **Network Isolation**: Zero network connectivity inside containers (`--network none`).
3. **Read-Only Root Filesystem**: Transient execution artifacts stored exclusively in in-memory `tmpfs` mounts with strict 16MB limits.
4. **Non-Root Execution**: Runs under unprivileged user `sandbox:sandbox` (UID 10001).

---

## 4. Relational Data Model & Persistence Architecture

The persistence tier runs on PostgreSQL 16 (production) with SQLAlchemy 2.0 AsyncIO ORM models.

### 4.1 Core Entity-Relationship Diagram

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#18181b',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ccff00',
    'lineColor': '#ccff00',
    'secondaryColor': '#27272a',
    'tertiaryColor': '#09090b'
  }
}}%%
erDiagram
    MEMBER_PROFILE ||--o{ CONTEST_REGISTRATION : registers
    MEMBER_PROFILE ||--o{ CONTEST_SUBMISSION : submits
    MEMBER_PROFILE ||--o{ RATING_HISTORY : achieves
    MEMBER_PROFILE ||--o{ SCOREBOARD_ENTRY : ranks_in

    OFFLINE_CONTEST ||--o{ CONTEST_PROBLEM : contains
    OFFLINE_CONTEST ||--o{ CONTEST_REGISTRATION : tracks
    OFFLINE_CONTEST ||--o{ CONTEST_SUBMISSION : records
    OFFLINE_CONTEST ||--o{ SCOREBOARD_ENTRY : compiles

    MEMBER_PROFILE {
        uuid id PK
        string email UK
        string handle UK
        string full_name
        string prn
        string department
        string batch
        int rating
        int peak_rating
        int attendance_count
        int attendance_total
        boolean is_core_member
        boolean is_onboarded
        string avatar_url
    }

    OFFLINE_CONTEST {
        uuid id PK
        string slug UK
        string title
        string status
        timestamp starts_at
        timestamp ends_at
        int duration_minutes
        int problem_count
        int registered_count
        string environment
        json rules
    }

    CONTEST_PROBLEM {
        uuid id PK
        uuid contest_id FK
        string problem_index
        string title
        string difficulty
        int points
        text description
        text input_format
        text output_format
        json starter_codes
        json sample_testcases
        json hidden_testcases
    }

    CONTEST_SUBMISSION {
        uuid id PK
        uuid contest_id FK
        uuid problem_id FK
        uuid member_id FK
        string language
        text code
        string verdict
        int points_awarded
        float execution_time_ms
        int memory_kb
        timestamp created_at
    }

    SCOREBOARD_ENTRY {
        uuid id PK
        uuid contest_id FK
        uuid member_id FK
        int rank
        string handle
        string full_name
        string department
        int score
        int solved
        int penalty_seconds
        int rating_delta
    }

    RATING_HISTORY {
        uuid id PK
        uuid member_id FK
        uuid contest_id FK
        int old_rating
        int new_rating
        int rank
        timestamp contested_at
    }
```

---

## 5. API Gateway & Service Contract Specifications

The FastAPI backend exposes clean, versioned, RESTful endpoints protected by RS256 JWT tokens.

### 5.1 Key Public & Competitor Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/send-otp` | Request passwordless login OTP | No |
| `POST` | `/api/auth/verify-otp` | Verify 6-digit OTP & retrieve JWT | No |
| `GET` | `/api/auth/me` | Fetch authenticated cadet profile | Yes (Bearer) |
| `PUT` | `/api/auth/profile` | Update profile bio, department, batch | Yes (Bearer) |
| `GET` | `/api/contests` | List active, upcoming, and past contests | No |
| `GET` | `/api/contests/:slug` | Detailed contest overview and rules | No |
| `POST` | `/api/contests/:slug/register` | Register authenticated cadet for contest | Yes (Bearer) |
| `GET` | `/api/contests/:slug/problems` | Access contest arena problem set | Yes (Bearer) |
| `POST` | `/api/contests/:slug/problems/:id/run` | Execute code against sample test cases | Yes (Bearer) |
| `POST` | `/api/contests/:slug/problems/:id/submit` | Submit code against official test cases | Yes (Bearer) |
| `GET` | `/api/contests/:slug/ranking` | Contest standings & scoreboard | No |
| `GET` | `/api/leaderboard` | University rating leaderboard | No |
| `GET` | `/api/leaderboard/departments` | Inter-department performance metrics | No |
| `GET` | `/api/leaderboard/distribution` | Rating distribution histogram | No |

---

## 6. Rating, Star Tier & Leaderboard Engine

The rating calculation engine adapts the standard Elo rating formula tailored to multi-participant competitive programming contests:

### 6.1 Star Tier Thresholds

$$\text{Tier} = \begin{cases} 
5★ \text{ Grandmaster} & \text{Rating} \ge 2000 \\
4★ \text{ Master} & 1800 \le \text{Rating} < 2000 \\
3★ \text{ Candidate Master} & 1600 \le \text{Rating} < 1800 \\
2★ \text{ Specialist} & 1400 \le \text{Rating} < 1600 \\
1★ \text{ Explorer} & \text{Rating} < 1400 
\end{cases}$$

### 6.2 Leaderboard Inclusion Policies
- **Strict Participant Gating**: Only cadets who have completed at least one official rated contest (`attendance_count > 0`) are listed in the official university standings.
- **Unranked State**: Registered cadets with 0 contest attendance are designated as "Unranked" with `university_rank = None` and `percentile = None`, preventing statistical distortion.
- **Bot/QA Account Shield**: Automated test bot accounts (e.g., `qa_organizer`, `qa.*@medicaps.ac.in`) are strictly excluded from all public leaderboard, histogram, and department aggregation queries.

---

## 7. Anti-Cheat, Security & Production Deployment Standards

### 7.1 Client-Side Anti-Cheat Telemetry
- **Window Focus & Tab Switching**: Fullscreen enforcement with warning counters recorded during active contest arena sessions.
- **Copy/Paste Controls**: Monaco editor blocks external clipboard insertion of formatted code blocks over predefined byte thresholds.

### 7.2 Get Shit Done (GSD) Deployment Protocol
All codebase changes must satisfy the project's automated verification pipeline prior to pushing:
1. `npm run build` & `npm run build:admin` (Clean TypeScript & Vite packaging).
2. `./scripts/gsd_qa_gate.sh` (51 in-process API contract tests, 16 frontend-to-backend user simulations, 303 UI element connectivity audits).
3. `./scripts/gsd_sync.sh "commit message"` (Atomic commit, push to GitHub `origin/main`, auto-pull and service reload on `root@143.198.38.205`, and live endpoint validation).
