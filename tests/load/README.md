# Production-Grade Locust Virtual User Testing Environment
## Chaos Computer Club Medi-Caps Chapter — Synthetic Student Load Suite

---

### 1. Overview & Objectives

This framework simulates **50 realistic concurrent student cadets** interacting simultaneously with the **Medi-Caps Competitive Programming Platform** (`https://medicaps.chaoscomputerclub.in`).

Rather than emitting synthetic HTTP pings, this suite exercises the **full end-to-end distributed system under realistic student behavior patterns**:
- Authentic institutional email authentication (`@medicaps.ac.in`) with OTP verification.
- Campus contest exploration, registration status checks, and seat allocations.
- Real-time live arena workspace discovery and problem description loads.
- Interactive **Run Code** execution testing Codebox admission control and thread isolation.
- Formal **Submit Code** lifecycle triggering distributed Go worker queue dispatch, Docker sandboxing, attempt fencing, and database scoreboard mutations.
- **Server-Sent Events (SSE)** real-time push event subscriptions, dropouts, and `Last-Event-ID` recovery.
- Scalable from 50 concurrent users to **100, 250, 500, and 1,000 users** without framework redesign.

---

### 2. Critical Safety Requirement: Production Guard

To prevent accidental load execution against live student contests or production databases, this framework incorporates a **hard safety gate**:

1. Target configuration requires explicit environment variables:
   - `LOAD_TEST_ENVIRONMENT` (`local`, `staging`, `dev`, `production`)
   - `LOAD_TEST_BASE_URL` (`http://localhost:8000`, etc.)
2. If `LOAD_TEST_ENVIRONMENT=production` or `medicaps.chaoscomputerclub.in` is targeted, execution is **strictly aborted** unless accompanied by:
   ```bash
   ALLOW_PRODUCTION_LOAD_TEST=true
   ```
3. Never use production user accounts or delete production data.

---

### 3. Architecture & Directory Layout

```
tests/load/
├── README.md                  # Comprehensive operating documentation & runbook
├── requirements.txt           # Python dependencies (locust, requests, asyncpg, redis, etc.)
├── pyproject.toml             # Packaging and pytest configuration
├── .env.example               # Environment template with safety guards
├── locust.conf                # Default headless and HTML reporting config
├── locustfile.py              # Master Locust entrypoint & custom metric hooks
│
├── config/
│   ├── settings.py            # Pydantic settings with safety gate validation
│   └── scenarios.py           # Predefined load scenarios (Smoke, Normal 50, Burst, Soak)
│
├── users/
│   ├── student.py             # NormalStudentUser (60%) & RunCodeHeavyUser (10%)
│   ├── contest_student.py     # ActiveContestantUser (25%)
│   └── reconnecting_student.py# ReconnectingStudentUser (5%)
│
├── workflows/
│   ├── auth.py                # OTP login, verify, onboarding, profile, logout
│   ├── dashboard.py           # Dashboard load, contest previews, health telemetry
│   ├── contest.py             # Contest details, registration checks, check-in
│   ├── problem.py             # Problem previews, arena workspace data
│   ├── run_code.py            # Sample run code against live sandboxes
│   ├── submission.py          # Formal submission, bounded polling, idempotency
│   ├── leaderboard.py         # Scoreboard & university ladder telemetry
│   └── realtime.py            # SSE streams, disconnection, replay recovery
│
├── clients/
│   └── api_client.py          # Tagged Locust HTTP client wrapper with trace correlation
│
├── assertions/
│   └── response_checks.py     # Strict response validation & failure classification
│
├── utilities/
│   ├── correlation.py         # Distributed tracing headers (X-Load-Test-ID, etc.)
│   └── credentials.py         # Thread-safe virtual student account checkout pool
│
├── data/
│   ├── users.json             # 50 deterministic student profiles
│   ├── problems.json          # Curated algorithmic challenges with testcases
│   └── submissions.json       # Solution templates (AC, WA, CE, TLE in Python/C++/Java/JS)
│
└── scripts/
    ├── create_test_users.py   # Provisions 50 test members in DB & seeds OTPs in Redis
    ├── seed_test_data.py      # Seeds active live contest with 4 problem papers
    ├── cleanup_test_data.py   # Purges LOADTEST_ namespace data with --confirm flag
    └── run_50_users.sh        # Automated execution wrapper with reporting
```

---

### 4. Virtual Student Personas

Virtual users are distributed according to calibrated behavioral weights:

| Persona | Weight | Behavior Pattern |
|---|---|---|
| **`NormalStudentUser`** | **60%** | Realistic pace (`2-5s` wait). Log in -> View dashboard -> Enter arena -> Think -> Run code sample -> Submit solution -> Check scoreboard. |
| **`ActiveContestantUser`** | **25%** | Aggressive contestant (`1.5-3.5s` wait). Rapid problem cycling -> Multiple code submissions -> Immediate scoreboard ranking review. |
| **`RunCodeHeavyUser`** | **10%** | Trial-and-error student (`1-3s` wait). Frequent Run Code execution with custom stdin, validating Codebox admission and queue isolation. |
| **`ReconnectingStudentUser`** | **5%** | Unstable connection (`3-7s` wait). Subscribes to SSE -> Submits solution -> Drops connection (5s) -> Reconnects via `Last-Event-ID` -> Asserts convergence. |

---

### 5. Setup & Installation

#### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r tests/load/requirements.txt
```

#### 2. Configure Environment
```bash
cp tests/load/.env.example tests/load/.env
# Edit tests/load/.env with your local or staging server configuration
```

#### 3. Provision Test Accounts & Seed Contest Data
```bash
# Provisions 50 deterministic students in PostgreSQL and sets Redis OTPs (123456)
python tests/load/scripts/create_test_users.py

# Seeds active contest 'weekly-contest-01' with 4 problems and opens arena
python tests/load/scripts/seed_test_data.py
```

---

### 6. Execution Scenarios & Commands

#### Scenario A: Quick Smoke Verification (5 Users, 2 Minutes)
```bash
./tests/load/scripts/run_50_users.sh smoke
```

#### Scenario B: Standard Live Contest (50 Users, 10 Minutes, Spawn 5/sec)
```bash
./tests/load/scripts/run_50_users.sh normal_50
```

#### Scenario C: Submission Burst Spike (50 Users, Spawn 10/sec)
```bash
./tests/load/scripts/run_50_users.sh submission_burst
```

#### Scenario D: Run-Code Admission Saturation (50 Users)
```bash
./tests/load/scripts/run_50_users.sh run_code_load
```

#### Scenario E: Long-Duration Soak (20 Users, 30 Minutes)
```bash
./tests/load/scripts/run_50_users.sh soak
```

#### Interactive Locust Web UI
```bash
locust -f tests/load/locustfile.py --host=http://localhost:8000
# Open http://localhost:8089 in your browser
```

---

### 7. Server-Side Observability & Monitoring Runbook

During synthetic load runs, monitor server telemetry using these queries:

#### 1. PostgreSQL (Connection Pool & Query Latency)
```sql
-- Active connections and state
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Slowest queries during the run
SELECT query, calls, total_exec_time, mean_exec_time 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC LIMIT 5;

-- In-flight judge attempts and job backlog
SELECT state, count(*) FROM judge_jobs GROUP BY state;
```

#### 2. Redis Coordination Plane (Queues & Admission)
```bash
# Monitor fabric queue backlog
redis-cli LLEN ccc:queue:fabric:pending
redis-cli LLEN ccc:queue:fabric:processing

# Check active node capacity and heartbeats
redis-cli KEYS "ccc:node:*:heartbeat"
redis-cli HGETALL ccc:node:laptop_01:info

# Check Codebox admission permits
redis-cli GET ccc:admission:codebox:permits
redis-cli LLEN ccc:admission:codebox:wait_queue
```

#### 3. Prometheus Metrics (`GET /metrics`)
- `ccc_judge_attempts_total{provider="fabric", status="completed"}`
- `ccc_judge_stale_results_total` (Must remain 0)
- `ccc_circuit_breaker_state{provider="codebox"}` (0 = Closed, 2 = Open)
- `ccc_outbox_events_total{status="DELIVERED"}`
- `ccc_node_active_count`

---

### 8. Test Data Cleanup

To cleanly remove test accounts, test submissions, and test OTPs without touching live data:

```bash
python tests/load/scripts/cleanup_test_data.py --confirm
```

---

### 9. Pass / Fail Acceptance Gates

| Gate Metric | Threshold | Consequence if Exceeded |
|---|---|---|
| **HTTP Error Rate** | **< 2.0%** | Hard Fail — Infrastructure or route defect. |
| **p95 Read API Latency** | **< 1,000 ms** | Degraded — Database or Redis cache contention. |
| **p95 Submit Latency** | **< 1,500 ms** | Degraded — Admission or queue contention. |
| **Permanently Stranded Jobs** | **0** | Critical Fail — Reconciliation defect. |
| **Stale Results Accepted** | **0** | Critical Fail — Distributed fencing defect. |
| **Circuit Breaker Storm** | **0** | Critical Fail — Provider failure cascading. |
