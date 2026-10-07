# CCC Medi-Caps Infrastructure — Legacy Pre-Migration Baseline & Audit (Decommissioned)

> **Audit Date**: 2026-10-07  
> **Status**: **RETIRED & DECOMMISSIONED** — Replaced by Distributed Free-Tier Cloud Architecture  
> **Legacy Target**: Single VPS (Host `143.198.38.205`, 4 GB RAM, 2 vCPUs)  
> **Current Production Architecture**: Cloudflare + Vercel + Google Cloud Run + Supabase PostgreSQL + Upstash Redis + Cloudinary CDN  

---

## 1. Executive Summary (Historical Baseline)

The legacy Chaos Computer Club platform was historically anchored to a single virtual private server (DigitalOcean droplet at `143.198.38.205`), which has now been completely retired:
- **RAM**: 4 GB total
- **vCPU**: 2 virtual cores
- **OS**: Ubuntu Linux
- **Architecture**: Monolithic colocated deployment where all layers compete for memory and CPU cycles.

---

## 2. Current Service Topology & Port Allocation

| Component | Technology | Process / Host | Ports / Protocol | Responsibilities |
|---|---|---|---|---|
| **Reverse Proxy / TLS** | Nginx 1.24+ | Systemd (`nginx.service`) | `80` (HTTP), `443` (HTTPS/HTTP2) | SSL termination (Let's Encrypt), static asset serving, rate limiting, upstream proxying |
| **Ingress Tunnel** | Cloudflare Tunnel (`cloudflared`) | Systemd | Outbound HTTPS | Routes `medicaps.chaoscomputerclub.in` and `medicaps-api.chaoscomputerclub.in` to local port 443 |
| **API Server & Monolith** | FastAPI / Uvicorn (2 workers) | Systemd (`ccc-medicaps-api.service`) | `8000` (internal HTTP) | Authentication, contest lifecycle, submission ingestion, scoreboard generation, SSE streaming, in-process worker runner |
| **Primary Database** | PostgreSQL 16 | Systemd (`postgresql.service`) | `5432` (TCP, Unix Socket) | Authoritative state: members, contests, submissions, scoreboard entries, outbox events, judge jobs |
| **Coordination & Cache** | Redis 7 | Systemd (`redis-server.service`) | `6379` (TCP) | SingleFlight deduplication, sliding-window rate limiting, distributed locks, SSE event relay Pub/Sub, replay buffers |
| **Media & Object Storage** | MinIO (Self-hosted S3) | Systemd / Docker | `9000` (API), `9002` (Console) | User profile avatars, contest banners, raw assets |
| **Judge Engine Fallback** | Codebox Engine | Docker Container | `3000` (HTTP) | Single-worker / multi-worker code sandbox fallback |
| **Distributed Node Agent** | Go `node-agent` v2.1 | Systemd / Outbound CLI | Outbound HTTP/gRPC to API | Hardware capability discovery, local Docker container pool, testcase runner |

---

## 3. Data Ownership & Runtime Paths

### 3.1 Authoritative Data
- **PostgreSQL 16** is the single source of truth for:
  - `member_profiles` (identities, ratings, PRN credentials)
  - `offline_contests` (contest metadata, problem definitions, timing windows)
  - `contest_problems` (problem specs, function signatures, testcases)
  - `contest_submissions` (student code, final verdicts, execution telemetry)
  - `scoreboard_entries` (deterministic ranks, point totals, penalty seconds)
  - `judge_jobs` and `judge_job_attempts` (execution state machine, leases)
  - `outbox_events` (transactional event journal for at-least-once broadcast)

### 3.2 Ephemeral / Coordination Data
- **Redis 7** owns:
  - `ccc:queue:*` — Job queues and FIFO buffers
  - `ccc:lease:*` — Active execution lease locks
  - `ccc:node:*` — Worker heartbeats, registration manifests, capabilities
  - `ccc:realtime:events` — Pub/Sub channel for inter-worker SSE distribution
  - `ccc:sse:replay:*` — Circular ZSET holding up to 100 recent events for `Last-Event-ID` recovery
  - Rate limiting sliding windows (`ratelimit:*`) and OTP session states

### 3.3 Static Frontend Data
- Vite / React SPA compiled to `dist/`, rsync'd to `/var/www/ccc-medicaps/.output/public/` and served via Nginx with local file cache.

---

## 4. Current Deployment Model

1. **Trigger**: Push to GitHub `main` branch.
2. **CI Pipeline** (`.github/workflows/deploy.yml`):
   - GitHub runner checks out code, runs `npm run build` on frontend.
   - Connects via SSH to `143.198.38.205` (`root`).
   - `git reset --hard origin/main`.
   - Rsyncs `backend/` to `/root/projects/ccc-medicaps-api/`.
   - Runs database migration check via Python.
   - Executes `systemctl restart ccc-medicaps-api.service`.
   - Executes `node-agent/deploy.sh`.
   - Rsyncs frontend `dist/` to `/var/www/ccc-medicaps/.output/public/`.
   - Executes `systemctl reload nginx`.

---

## 5. In-Process Worker Colocation Bottleneck

Inside `backend/main.py` lifespan:
1. `queue_manager.start_all()` runs in-process:
   - `JudgeWorker` (concurrency = 4)
   - `ContestLifecycleWorker` (concurrency = 2)
   - `EmailWorker`
   - `WebhookWorker`
   - `MaintenanceWorker` (reaper)
   - `CacheSyncWorker`
2. `start_background_tasks(AsyncSessionLocal)`
3. `start_redis_event_relay()` (Redis Pub/Sub SSE bridge)
4. `get_resource_governor().start()` (worker heartbeat sweep)
5. `Autoscaler.get_instance().start()` (polling queue depth)
6. `ReconciliationWorker.get_instance().start()` (polling stuck jobs)
7. Fast-API web request handlers (2 Uvicorn workers).

### Consequence:
When a live contest starts with 50–100 students:
- Python FastAPI processes consume 500 MB–1.2 GB RAM.
- Active SSE streams keep hundreds of open file descriptors and coroutines alive.
- Compiling C++/Java/Rust or launching Docker sandboxes consumes 1–2 GB RAM and 100% of the 2 vCPUs.
- PostgreSQL and Redis suffer memory pressure, leading to Linux OOM killer invocations or API request timeouts (504 Gateway Timeout).

---

## 6. Offline / Physical Check-in Remnants Inventory

Audit of legacy artifacts remaining from previous physical event iterations:
- **Table `offline_contests`**: Primary contest table in PostgreSQL.
  - *Status*: **KEEP & ALIAS**. Dropping or renaming in place risks data loss and foreign key breakage. It is mapped to the online product model.
- **Columns `seat_assigned`, `checked_in_at`, `campus_pass_code` in `contest_registrations`**:
  - *Status*: **DEPRECATE**. Populated with default `"ONLINE"` sentinel values. No physical seat allocation or QR gating is enforced.
- **Router `/api/passes` & Model `CampusPass`**:
  - *Status*: **DEPRECATE**. Retained for backward-compatible virtual pass access tokens; physical check-in semantics removed.
- **Docstrings & Comments**: "Air-gapped", "LAN check-in", "Offline contest management":
  - *Status*: **STALE DOCUMENTATION — MIGRATE / UPDATE**. Replace with "Online LeetCode-like Competitive Programming Arena".

---

## 7. Secrets Inventory (Current VPS State)

- `DATABASE_URL`: `postgresql+asyncpg://ccc_admin:CCC_Prod_Sec_Pass_2026_912@127.0.0.1:5432/ccc_medicaps`
- `SECRET_KEY`: `ccc_prod_secret_key_912_2026_medicaps_super_secure`
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`: RSA 2048-bit PEM keypairs
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth credentials
- `SMTP_USER` / `SMTP_PASSWORD`: Hostinger transactional email credentials
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`: MinIO admin credentials
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`: Anti-bot turnstile credentials
- `JUDGE_AGENT_SECRET`: Shared node enrollment token

---

## 8. Failure Domains of Current State

1. **VPS Hardware / Network Failure**: Complete platform outage (API, DB, Redis, media, judge, static web).
2. **VPS Memory Exhaustion (OOM)**: Simultaneous judge execution crashes PostgreSQL or FastAPI daemon.
3. **Database Corruption**: Colocated disk I/O saturated by Docker container image pulls and compilation caches.
4. **Single-Point-of-Failure**: All secrets and operational layers reside on a single root-access machine.
