# Technical Requirements Document (TRD)
# Chaos Computer Club (CCC) — Medi-Caps University Chapter Platform

**Document Version:** `2.4.0-PRODUCTION`  
**System Classification:** `Mission-Critical / Air-Gapped Hybrid Tournament Engine`  
**Target Environment:** `DigitalOcean Production Node (143.198.38.205) / Linux Ubuntu 24.04 LTS`  
**Author:** Chaos Computer Club Core Architecture & Engineering Team  
**Institution:** Medi-Caps University, Indore  

---

## 1. System Overview & Architectural Topology

The **Chaos Computer Club (CCC) Medi-Caps Chapter Platform** is a decoupled, multi-tier system engineered for low-latency competitive programming tournaments, automated student screening, and physical air-gapped lab finals. 

The architecture segregates the user-facing attack surface from the internal judging cluster and isolates competitive candidates from tournament management.

### 1.1 Architectural Component Diagram

```mermaid
flowchart TB
    subgraph Client_Tier [Client Presentation Layer]
        CadetPortal["Cadet Web Portal\n(medicaps.chaoscomputerclub.in:443)\nReact 19 + TypeScript + Vite\nPort 8081 (Dev)"]
        AdminConsole["Admin & Proctor Command Console\n(admin.chaoscomputerclub.in:443)\nReact 19 + Vite Standalone\nPort 8082 (Dev)"]
        IoTScanner["Hardware Gate Scanner / Turnstile\n(Laser Barcode / Webcam Scan)\nREST & Webhook Sink"]
    end

    subgraph Edge_Tier [Network & Reverse Proxy Layer]
        Cloudflare["Cloudflare Global Anycast DNS & Edge\n(DDoS Mitigation, SSL Offloading, WAF)"]
        Nginx["Production Nginx 1.24+ Reverse Proxy\n(/etc/nginx/sites-available/chaoscomputerclub.conf)\nTLS 1.2/1.3 + SSE Buffering Disabled"]
    end

    subgraph App_Tier [Application Service Layer]
        FastAPI["FastAPI High-Throughput Core (Python 3.12)\n(Uvicorn Multi-Worker / Port 8002)\nAsyncIO Event Loop"]
        EligibilityMW["Contest Eligibility Middleware\n(Live Final Workstation Gate Lock)"]
        EventBroadcaster["Event Broadcaster & SSE Engine\n(OpenAPI 3.1.0 Webhooks & Stream)"]
    end

    subgraph Judge_Tier [Sandboxed Execution Cluster]
        JudgeDispatch["Judge Engine Dispatcher\n(Provider Factory: CodeBox / Docker)"]
        CodeBoxWorker["CodeBox Microservice (Node.js 20 LTS)\nExpress + BullMQ Worker + Dockerode\nPort 3000"]
        ContainerPool["Pre-warmed Container Pool\n(Linux cgroups, 2.0s CPU, 256MB RAM)"]
    end

    subgraph Data_Tier [Persistence & Caching Tier]
        SQLite_DB[("SQLAlchemy 2.0 AsyncIO DB\n(ccc_medicaps.db / PostgreSQL)")]
        Redis_Store[("Redis 7.0 In-Memory Store\n(Port 6379 / BullMQ Queues,\nSWR Cache, Telemetry)")]
    end

    CadetPortal -->|HTTPS / WSS| Cloudflare
    AdminConsole -->|HTTPS / WSS| Cloudflare
    IoTScanner -->|HTTPS| Cloudflare

    Cloudflare -->|SSL Handshake| Nginx
    Nginx -->|SPA Static Bundle /var/www/ccc-medicaps| CadetPortal
    Nginx -->|Admin SPA Bundle /var/www/ccc-medicaps-admin| AdminConsole
    Nginx -->|Upstream Reverse Proxy 127.0.0.1:8002| FastAPI

    FastAPI --> EligibilityMW
    FastAPI --> EventBroadcaster
    FastAPI --> JudgeDispatch

    JudgeDispatch -->|BullMQ Queue| Redis_Store
    JudgeDispatch -->|HTTP POST /submissions| CodeBoxWorker
    CodeBoxWorker --> ContainerPool

    FastAPI -->|Async Session Queries| SQLite_DB
    FastAPI -->|SWR Caching & Invalidation| Redis_Store
```

---

## 2. Technical Flow & Journey Architecture

The platform's operational core governs the progression from online registration to physical air-gapped lab adjudication.

### 2.1 Complete Two-Phase Tournament Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Cadet as Competitor Cadet
    participant Web as Cadet Portal (medicaps.*)
    participant API as FastAPI Backend (api.*)
    participant Redis as Redis 7 Cache & Queue
    participant CodeBox as CodeBox Judge Engine
    participant DB as Relational Database
    actor Proctor as Chief Proctor (Gate)
    participant Admin as Admin Console (admin.*)

    Note over Cadet,Admin: Phase 1: Online Screening Assessment
    Cadet->>Web: Navigate to /portal/contests/:slug/lobby
    Web->>API: POST /api/contests/:slug/register
    API->>DB: Record ContestRegistration
    Cadet->>Web: Click "Confirm & Launch Assessment"
    Web->>API: POST /api/assessment/:slug/start
    API->>DB: Initialize AssessmentSession (started_at = NOW_UTC, 120m limit)
    API-->>Web: Session Unlocked + Problem Statement Payload

    loop Assessment Challenge Solve
        Cadet->>Web: Write Code in Monaco Editor (C++, Py, Java, TS)
        alt Run Sample Cases
            Web->>API: POST /api/assessment/:slug/run
            API->>CodeBox: Execute Sandboxed Code (Sample Inputs)
            CodeBox-->>API: Testcase Execution Verdict
            API-->>Web: Output, Stdout, Stderr, Runtime (ms)
        else Submit Solution
            Web->>API: POST /api/assessment/:slug/submit
            API->>CodeBox: Execute against Hidden Testcases
            CodeBox-->>API: Evaluation Verdict (AC, WA, TLE, MLE)
            API->>DB: Save AssessmentSubmission & Update Total Score
            API->>Redis: Invalidate SWR Leaderboard Keys
        end
        opt Anti-Cheat Trigger
            Web->>API: POST /api/assessment/:slug/anti-cheat (window.onblur / visibilitychange)
            API->>DB: Increment anti_cheat_violations
            Note over Web,API: If violations > max_violations (3), session auto-disqualified
        end
    end

    Note over API,Admin: Automatic Top 30 Finalist Qualification
    Admin->>API: POST /api/assessment/:slug/qualify-top30
    API->>DB: Evaluate Screening Scores + Tie-Breaking Penalties
    API->>DB: Mark Top 30 cadets: is_top_30_qualified = True
    API->>DB: Issue CampusPass (Unique pass_code + Seat LAB-04-WS-01..30)
    API->>Admin: Outbound Webhook: top30_qualified

    Note over Cadet,Admin: Phase 2: Physical Lab Turnstile Entry & Check-In
    Cadet->>Web: View /portal/contests/:slug/qualified
    Web-->>Cadet: Render Digital QR Campus Pass
    Cadet->>Proctor: Present QR Pass at Medi-Caps Lab 04 Gate
    Proctor->>Admin: Scan QR via Laser / Camera (/admin gate scanner)
    Admin->>API: POST /api/passes/verify { pass_code_or_qr }
    API->>DB: Check Pass Validity & Duplicate Scan Lock
    API->>DB: Update CampusPass (check_in_status = 'checked_in', checked_in_at = NOW)
    API->>Admin: SSE Broadcast: pass_checked_in (Seat & Identity)
    Admin-->>Proctor: Visual Green: "ADMISSION GRANTED -> Proceed to LAB-04-WS-12"

    Note over Cadet,Admin: Phase 2: Air-Gapped Live Arena
    Cadet->>Web: Navigate to /portal/contests/:slug/arena
    Web->>API: GET /api/contests/:slug/arena
    Note over API: ContestEligibilityMiddleware verifies physical gate check_in_status
    API-->>Web: Seat Confirmed + Live Arena Unlocked
    Admin->>API: POST /api/webhooks/contest-event { action: 'start_live' }
    API->>Web: SSE Broadcast: contest_status_changed (LIVE)
    Web-->>Cadet: Unseal Final Problems & Start Countdown Clock
```

---

## 3. Database Entity-Relationship (ER) Specifications

The persistence tier is architected with strict foreign key constraints, cascading policies, and indexing across high-read paths.

```mermaid
erDiagram
    MEMBER_PROFILE ||--o{ RATING_HISTORY : "tracks"
    MEMBER_PROFILE ||--o{ CONTEST_REGISTRATION : "registers"
    MEMBER_PROFILE ||--o{ ASSESSMENT_SESSION : "attempts"
    MEMBER_PROFILE ||--o{ CAMPUS_PASS : "holds"
    MEMBER_PROFILE ||--o{ TRUST_PROOF : "issued"
    MEMBER_PROFILE ||--o{ STUDENT_FOLLOW : "follower"
    MEMBER_PROFILE ||--o{ STUDENT_FOLLOW : "following"

    OFFLINE_CONTEST ||--o{ CONTEST_PROBLEM : "contains"
    OFFLINE_CONTEST ||--o{ CONTEST_REGISTRATION : "enrolls"
    OFFLINE_CONTEST ||--|| ASSESSMENT : "preceded_by"
    OFFLINE_CONTEST ||--o{ CAMPUS_PASS : "authorizes"
    OFFLINE_CONTEST ||--o{ TRUST_PROOF : "certifies"
    OFFLINE_CONTEST ||--o{ SCOREBOARD_ENTRY : "ranks"

    ASSESSMENT ||--o{ ASSESSMENT_PROBLEM : "evaluates"
    ASSESSMENT ||--o{ ASSESSMENT_SESSION : "hosts"

    ASSESSMENT_SESSION ||--o{ ASSESSMENT_SUBMISSION : "submits"

    MEMBER_PROFILE {
        string id PK "UUID4"
        string handle UK "Unique alphanumeric handle"
        string full_name "Legal student name"
        string email UK "Institutional @medicaps.ac.in"
        string prn UK "University Enrollment ID"
        string department "CSE, IT, AIDS, CSBS, ECE"
        string batch "2022-26, 2023-27, etc."
        int rating "Current Elo rating (default: 1200)"
        int peak_rating "All-time highest rating"
        int attendance_count "Total verified contests attended"
        int attendance_total "Aggregate season events"
        boolean is_core_member "Chapter organizer privileges"
        boolean is_onboarded "Profile configuration gate"
        string avatar_url "CDN / MinIO storage path"
        string github_username "External telemetry handle"
        string bio "Bio text"
        datetime created_at "UTC creation timestamp"
    }

    OFFLINE_CONTEST {
        string id PK "UUID4"
        string slug UK "Unique URL slug"
        string title "Official contest name"
        string season "Season identifier (Season 2026)"
        string status "upcoming | live | finished"
        string division "open | division_1 | division_2"
        string cadence "weekly | biweekly | special"
        datetime starts_at "Contest start bell timestamp"
        datetime ends_at "Contest conclusion timestamp"
        datetime check_in_opens_at "Gate scanner activation"
        string venue "Medi-Caps Lab 04"
        int seat_capacity "Workstation physical limits"
        int registered_count "Active candidate registrations"
        int problem_count "Number of challenge problems"
        string environment "Air-gapped LAN environment info"
        json chief_proctors "Authorized Proctor list"
        json rules "Contest specific regulations"
    }

    ASSESSMENT {
        string id PK "UUID4"
        string contest_id FK "References OFFLINE_CONTEST.id"
        string slug UK "Unique assessment slug"
        string title "Assessment title"
        int duration_minutes "Session duration (90-120 min)"
        datetime starts_at "Window opening timestamp"
        datetime ends_at "Window closing timestamp"
        boolean is_active "Online screening availability"
        int max_violations "Anti-cheat limit (Default: 3)"
    }

    ASSESSMENT_SESSION {
        string id PK "UUID4"
        string assessment_id FK "References ASSESSMENT.id"
        string member_id FK "References MEMBER_PROFILE.id"
        string handle "Cadet handle cache"
        datetime started_at "Immutable session start clock"
        datetime submitted_at "Final submission timestamp"
        string status "in_progress | submitted | disqualified"
        float total_score "Total points earned"
        int total_penalty_seconds "Time penalty sum"
        int anti_cheat_violations "Focus loss counter"
        boolean is_top_30_qualified "Cutoff promotion status"
    }

    CAMPUS_PASS {
        string id PK "UUID4"
        string member_id FK "References MEMBER_PROFILE.id"
        string contest_id FK "References OFFLINE_CONTEST.id"
        string pass_code UK "Unique pass string"
        string seat_number "Lab workstation assignment"
        text qr_data "Formatted payload for laser/cam"
        string check_in_status "issued | checked_in | revoked"
        datetime issued_at "Pass issuance timestamp"
        datetime checked_in_at "Physical scan timestamp"
        string checked_in_by "Proctor station ID"
    }

    TRUST_PROOF {
        string id PK "UUID4"
        string certificate_id UK "Unique certificate identifier"
        string contest_id FK "References OFFLINE_CONTEST.id"
        string member_id FK "References MEMBER_PROFILE.id"
        string sha256_digest UK "Cryptographic result hash"
        string proctor_stamp "Official signature stamp"
        string attendance_stamp "Station verification proof"
        int score "Final points achieved"
        int rank "Final position"
        datetime issued_at "UTC timestamp"
        string status "verified | revoked"
    }
```

---

## 4. UML Class Architecture & Object-Oriented Domain Layer

The backend uses a modular, service-oriented domain model implemented via Pydantic v2 schemas and SQLAlchemy 2.0 ORM mappers.

```mermaid
classDiagram
    class MemberService {
        +authenticate_or_create(email: str) MemberProfile
        +verify_otp(email: str, code: str) str
        +complete_onboarding(member_id: str, data: OnboardSchema) MemberProfile
        +sync_external_telemetry(member: MemberProfile) TelemetryPayload
    }

    class DynamicContestService {
        +create_contest(payload: ContestCreateSchema) OfflineContest
        +transition_lifecycle(slug: str, new_status: str) OfflineContest
        +get_arena_workspace(slug: str, member: MemberProfile) ArenaData
        +freeze_scoreboard(slug: str) bool
    }

    class PassService {
        +issue_pass(contest_id: str, member_id: str, seat: str) CampusPass
        +verify_and_check_in(raw_qr: str, proctor: str, slug: str) PassVerifyResponse
        +list_contest_attendees(slug: str) List~ContestAttendeeItem~
        +parse_qr_or_code(raw: str) str
    }

    class RatingService {
        +calculate_rating_deltas(standings: List~StandingsItem~) List~RatingDeltaTuple~
        +get_rating_tier(rating: int) str
        +get_tier_label(tier: str) str
        +commit_rating_adjustments(contest_id: str) void
    }

    class EventBroadcaster {
        +broadcast_event(event_name: str, payload: dict) void
        +register_outbound_webhook(url: str) void
        +sse_event_generator(client_id: str) AsyncGenerator
    }

    class JudgeDispatcher {
        +dispatch_submission(submission: SubmissionPayload) JudgeResult
        +get_provider(name: str) IJudgeProvider
        +ping_engine() bool
    }

    class IJudgeProvider {
        <<interface>>
        +execute(code: str, lang: str, testcases: list) JudgeResult
        +healthy() bool
    }

    class CodeBoxProvider {
        -client: HttpClient
        -workerQueue: BullMQClient
        +execute(code: str, lang: str, testcases: list) JudgeResult
        +healthy() bool
    }

    class DockerProvider {
        -dockerPool: ContainerPool
        +execute(code: str, lang: str, testcases: list) JudgeResult
        +healthy() bool
    }

    IJudgeProvider <|.. CodeBoxProvider
    IJudgeProvider <|.. DockerProvider
    JudgeDispatcher --> IJudgeProvider
    DynamicContestService --> PassService
    DynamicContestService --> EventBroadcaster
    PassService --> EventBroadcaster
    DynamicContestService --> RatingService
```

---

## 5. State Machine & Lifecycle Specifications

### 5.1 Contest Lifecycle State Transition Model

```mermaid
stateDiagram-v2
    [*] --> UPCOMING : Admin provisions contest
    UPCOMING --> REGISTRATION_OPEN : starts_at - 7 days
    REGISTRATION_OPEN --> PHASE_1_SCREENING : assessment.starts_at reached
    PHASE_1_SCREENING --> EVALUATION_CUTOFF : assessment.ends_at reached
    EVALUATION_CUTOFF --> FINALISTS_PROMOTED : qualify-top30 executed
    FINALISTS_PROMOTED --> GATE_CHECKIN_OPEN : check_in_opens_at (starts_at - 1h)
    GATE_CHECKIN_OPEN --> LIVE_FINAL : start_live triggered by Proctor
    LIVE_FINAL --> SCOREBOARD_FROZEN : ends_at - 15 minutes
    SCOREBOARD_FROZEN --> FINISHED : ends_at reached / finish triggered
    FINISHED --> ARCHIVED : Ratings applied & Proofs signed
    ARCHIVED --> [*]
```

### 5.2 Assessment Session Lifecycle Model

```mermaid
stateDiagram-v2
    [*] --> IN_PROGRESS : Cadet clicks "Start Session"
    IN_PROGRESS --> IN_PROGRESS : Code Tested / Run Code
    IN_PROGRESS --> IN_PROGRESS : Code Evaluated / Submit Solution
    IN_PROGRESS --> DISQUALIFIED : anti_cheat_violations > max_violations (3)
    IN_PROGRESS --> SUBMITTED : Cadet explicitly submits final paper
    IN_PROGRESS --> SUBMITTED : Server countdown reaches 00:00:00 (Auto-lock)
    DISQUALIFIED --> [*] : Score = 0.0 (Excluded from Top 30)
    SUBMITTED --> QUALIFIED_TOP_30 : Rank <= 30 on final evaluation
    SUBMITTED --> ELIMINATED : Rank > 30
    QUALIFIED_TOP_30 --> [*] : Campus Pass Issued
    ELIMINATED --> [*] : Certificate of Participation
```

---

## 6. Functional & Technical System Logic

### 6.1 Elo / Competitive Rating Delta Formulation
Rating adjustments follow a scaled relative performance algorithm calculated upon contest finalization:

$$\text{Expected Rank } E_i = \frac{N}{2.0}$$

$$\text{Performance Factor } P_i = \frac{E_i - R_i}{E_i}$$

Where $N$ is total contest participants, and $R_i$ is actual finishing rank.

$$\Delta_i = \begin{cases} 
80 + (4 - R_i) \times 15 & \text{if } R_i \le 3 \\
30 + (P_i \times 35) & \text{if } R_i \le 0.2N \\
10 + (P_i \times 20) & \text{if } R_i \le 0.5N \\
\max(-35, \lfloor P_i \times 25 \rfloor) & \text{otherwise}
\end{cases}$$

$$\text{New Rating } = \max(800, \text{Old Rating} + \Delta_i)$$

### 6.2 Tie-Breaking & Scoreboard Penalty Logic
In both Phase 1 and Phase 2, ranks are resolved strictly in order:
1. **Primary Sort:** Descending order of Total Solved Score.
2. **Secondary Sort:** Ascending order of Cumulative Penalty Time:

$$\text{Total Penalty} = \sum_{p \in \text{Accepted Problems}} \left( T_{\text{solve}}(p) + 20\text{ min} \times W(p) \right)$$

Where:
- $T_{\text{solve}}(p)$ is the elapsed duration from contest start until problem $p$ received `ACCEPTED`.
- $W(p)$ is the count of non-accepted attempts submitted prior to the first accepted run.

### 6.3 Gate Lock Enforcement Algorithm (`ContestEligibilityMiddleware`)
When a student initiates an HTTP or WebSocket handshake to enter `/api/contests/{slug}/arena`:
1. Check if `contest.status == "live"`.
2. Extract user identity from the verified RS256 Bearer Token.
3. If user is flagged as `is_core_member = True`, authorize access immediately (proctor observation mode).
4. Query `CampusPass` where `member_id == user.id` and `contest_id == contest.id`.
5. If no pass exists, return `403 Forbidden` (`reason = "Not qualified in Round 1 screening"`).
6. If `campus_pass.check_in_status != "checked_in"`, return `403 Forbidden` (`reason = "Physical gate check-in required. Scan your QR pass at the entrance turnstile"`).
7. If `campus_pass.check_in_status == "revoked"`, return `403 Forbidden` (`reason = "Pass has been revoked by Chief Proctor"`).
8. If all checks pass, bind workstation seat `campus_pass.seat_number` to session and stream challenge statements.

---

## 7. Integration & API Specifications

### 7.1 Key REST Endpoints

```
POST /api/auth/send-otp
Body: { "email": "cadet@medicaps.ac.in" }
Response: 200 OK { "message": "Verification code dispatched", "expires_in": 600 }

POST /api/auth/verify-otp
Body: { "email": "cadet@medicaps.ac.in", "code": "849201" }
Response: 200 OK { "token": "eyJhbGciOiJSUzI1NiIs...", "is_onboarded": true, "member": {...} }

POST /api/contests/{slug}/arena/run
Headers: Authorization: Bearer <TOKEN>
Body: {
  "problem_id": "prob-uuid",
  "language": "cpp",
  "source_code": "#include <iostream>...",
  "stdin": "5\n1 2 3 4 5"
}
Response: 200 OK {
  "success": true,
  "verdict": "ACCEPTED",
  "stdout": "15\n",
  "time_ms": 12,
  "memory_kb": 2048
}

POST /api/passes/verify
Headers: Authorization: Bearer <PROCTOR_TOKEN>
Body: {
  "pass_code_or_qr": "CCC-PASS:W01-8392:mem-uuid:LAB-04-WS-12:QUALIFIED",
  "contest_slug": "weekly-contest-1"
}
Response: 200 OK {
  "valid": true,
  "status": "verified",
  "candidate_name": "Santusht Kotai",
  "handle": "santush011200",
  "seat_number": "LAB-04-WS-12",
  "checked_in_at": "2026-09-18T05:30:00Z"
}
```

### 7.2 OpenAPI 3.1.0 Webhook Event Contracts

The platform exposes an asynchronous outbound webhook engine compliant with the OpenAPI 3.1.0 Webhooks Specification:

```json
{
  "event": "pass_checked_in",
  "timestamp": "2026-09-18T05:30:12.450Z",
  "data": {
    "pass_code": "CCC-PASS-W01-8392",
    "seat_number": "LAB-04-WS-12",
    "candidate_name": "Santusht Kotai",
    "handle": "santush011200",
    "department": "CSE",
    "checked_in_by": "Chief Proctor (CCC Core)",
    "status": "checked_in"
  }
}
```

```json
{
  "event": "top30_qualified",
  "timestamp": "2026-09-18T05:00:00.000Z",
  "data": {
    "contest_slug": "weekly-contest-1",
    "total_candidates": 240,
    "qualified_count": 30,
    "qualifiers": [
      {
        "rank": 1,
        "handle": "en23cs301927",
        "full_name": "Cadet One",
        "score": 400.0,
        "seat_number": "LAB-04-WS-01",
        "pass_code": "CCC-W01-PC01"
      }
    ]
  }
}
```

---

## 8. Security, Hardening & Compliance Matrix

| Security Layer | Technical Mechanism | Threat Mitigated |
| :--- | :--- | :--- |
| **Authentication** | Asymmetric RS256/Ed25519 JWT signatures + Bcrypt hash (Cost: 12) | Token forgery, credential interception, rainbow table replay |
| **Identity Boundary** | Strict email domain regex validation (`@medicaps.ac.in`) | Non-student infiltration, Sybil attacks |
| **Gate Security** | Single-use QR pass payload + DB duplicate scan detection lock | Proxy attendance, credential sharing, barcode cloning |
| **Lab Arena Access** | Workstation IP check + Physical proctor admission stamp enforcement | Remote unauthorized arena access, home submissions |
| **Anti-Cheat Engine** | Window focus tracking (`blur`, `visibilitychange`) + Max 3 violations | Dual-monitor searching, unauthorized tab browsing |
| **Execution Sandbox** | Linux cgroups, no-network jail, 2.0s timeout, memory quotas | Fork bombs, DDoS against host, data exfiltration, socket binding |
| **Result Verification** | Immutable SHA-256 result digest + Asymmetric proctor stamp | Certificate tampering, resume forgery, score modification |
| **Web Protection** | Cloudflare WAF, Nginx rate-limiting (`limit_req_zone`), CORS regex | DDoS, brute-force OTP flooding, unauthorized cross-origin requests |

---

## 9. Infrastructure, Deployment & DevOps (GSD Protocol)

### 9.1 Hosting & Deployment Specifications
- **Hardware Node:** DigitalOcean Droplet (`143.198.38.205`).
- **OS Environment:** Ubuntu 24.04 LTS x86_64.
- **Process Supervision:** Systemd units:
  - `ccc-medicaps-api.service`: Multi-worker FastAPI Uvicorn application (Port 8002).
  - `nginx.service`: Edge reverse proxy, SSL termination, and static SPA serving.
  - `redis-server.service`: In-memory data store for queues, SWR cache, and rate-limits.

### 9.2 Zero-Downtime Continuous Deployment Protocol (`./scripts/gsd_sync.sh`)
Every deployment executes a 5-step transactional pipeline:
1. **Local Build & QA Gate (`./scripts/gsd_qa_gate.sh`):**
   - TypeScript 5.8 strict compilation checks (`pnpm build` & `pnpm build:admin`).
   - 51-point API integration test validation suite.
   - Interactive UI element backend connectivity auditor (ensuring 0 non-functional placeholders).
2. **Atomic Git Synchronization:**
   - Adds modifications, commits with descriptive changelog, and pushes to `origin/main`.
3. **Remote Production Pull:**
   - SSH pull onto server directory `/root/projects/medicaps.chaoscomputerclub.in`.
4. **Service Synchronization & Reload:**
   - Rsyncs Python backend modules to `/root/projects/ccc-medicaps-api/`.
   - Rsyncs pre-compiled student SPA to `/var/www/ccc-medicaps/.output/public/`.
   - Rsyncs pre-compiled admin console SPA to `/var/www/ccc-medicaps-admin/`.
   - Graceful systemd reload (`systemctl restart ccc-medicaps-api.service`).
5. **Live Health Probe Validation:**
   - Verifies `HTTP 200` on `medicaps.chaoscomputerclub.in`, `admin.chaoscomputerclub.in`, and `/api/health`.

---

## 10. System Constraints, Assumptions & Scalability Limits

### 10.1 System Constraints
1. **Air-Gapped Operation:** The live arena environment operates in Lab 04 with network connectivity isolated from public internet submission vectors.
2. **Hardware Seat Capacity:** The physical arena is constrained to 30 workstations per round (`LAB-04-WS-01` to `LAB-04-WS-30`).
3. **Execution Resource Quotas:** Maximum 2.0s wall-clock time and 256MB RAM per code submission execution.
4. **Institutional Sovereignty:** Strictly student-organized and student-governed; zero dependencies on academic faculty accounts or administrative intervention.

### 10.2 Scalability & Concurrency Metrics
- **Concurrent Screening Users:** Tested and verified up to `1,200 concurrent active assessment sessions` per droplet node.
- **Judge Throughput:** Prewarmed container pool processes `60 executions/minute` per CPU core; scalable horizontally via additional CodeBox worker nodes.
- **Cache Hit Ratio:** Redis SWR caching layer achieves `> 94% cache hits` on public contest lobby and leaderboard queries.

---

## 11. Appendix & Technical Acronyms

- **AC:** Accepted (Judge verdict indicating all testcases passed within limits).
- **BullMQ:** Redis-backed distributed job and message queue for Node.js.
- **cgroups:** Linux kernel feature that isolates resource usage (CPU, memory, disk I/O) of process groups.
- **Ed25519:** Edwards-curve Digital Signature Algorithm offering high speed and high cryptographic resilience.
- **GSD:** Get Shit Done protocol; the automated QA and deployment framework enforcing production quality gates.
- **PRN:** Permanent Registration Number; university student ID.
- **RS256:** RSA Signature with SHA-256 asymmetric cryptographic algorithm.
- **SSE:** Server-Sent Events; unidirectional HTTP streaming protocol for real-time telemetry.
- **SWR:** Stale-While-Revalidate caching strategy used across frontend queries.
