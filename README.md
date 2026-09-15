# Chaos Computer Club (CCC) — Medi-Caps University Chapter

[![Production Status](https://img.shields.io/badge/Production-Live-success?style=flat-square&logo=nginx&logoColor=white)](https://medicaps.chaoscomputerclub.in)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Tailwind%20v4-blue?style=flat-square&logo=react)](https://medicaps.chaoscomputerclub.in)
[![Backend API](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://medicaps.chaoscomputerclub.in/api/docs)
[![Code Execution](https://img.shields.io/badge/Judge%20Engine-CodeBox%20%7C%20Docker%20%7C%20Isolate-orange?style=flat-square&logo=docker&logoColor=white)](https://medicaps.chaoscomputerclub.in)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](./LICENSE)

---

## 📌 Overview

The **CCC Medi-Caps Chapter Platform** is a full-stack, enterprise-grade competitive programming arena, member portal, and offline tournament management ecosystem designed for the **Chaos Computer Club (CCC) Chapter at Medi-Caps University**.

Engineered for ultra-low latency, air-gapped lab resilience, and anti-cheat enforcement, the platform powers end-to-end university coding competitions—from **Phase 1 Online Qualifiers** and **Automated Top 30 Cutoffs** to **Phase 2 On-Campus Offline Finals** with cryptographic trust-of-proof verification.

---

## 🚀 Key Features & Capabilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CCC PLATFORM CAPABILITIES                        │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ 🏆 Contest Lifecycle │ ⚡ Sandboxed Judge   │ 🔐 Cryptographic Proofs       │
│ • Phase 1 Qualifiers │ • CodeBox Engine     │ • HMAC/Ed25519 Result Signing │
│ • Automated Cutoffs  │ • Docker / Isolate   │ • Verifiable QR Campus Passes │
│ • Phase 2 Lab Finals │ • Sub-second Exec    │ • Tamper-proof Public Ledger  │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ 📊 Division Ratings  │ 🌐 External Telemetry│ 🛡️ Built-in QA & Simulation   │
│ • Div 1 / 2 / 3 Ranks│ • LeetCode Sync      │ • E2E Contest Simulation      │
│ • Frozen Scoreboards │ • CodeChef Telemetry │ • Zero-Mock Automated Testing │
│ • Live Time-Penalty  │ • GitHub Activity    │ • Resilience Health Probes    │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

### 1. 🏆 Multi-Stage Tournament Management
- **Phase 1 (Online Qualifier)**: Timed online rounds with randomized problem sets, live penalty tracking, and anti-cheat blur/tab detection.
- **Automated Cutoff Resolution**: Instantaneous determination and promotion of the **Top 30 Qualifiers** to offline rounds.
- **Phase 2 (Offline Lab Finals)**: Air-gapped offline arena with local judge fallback, supervisor controls, and workstation IP locks.
- **Dynamic Contest States**: Full lifecycle states (`UPCOMING`, `REGISTRATION_OPEN`, `LOBBY`, `RUNNING`, `FROZEN`, `COMPLETED`, `ARCHIVED`).

### 2. ⚡ High-Performance Sandboxed Judge (CodeBox Engine)
- **Multi-Language Support**: Isolated execution for **C, C++, Python, JavaScript, TypeScript, and Java**.
- **Defense-in-Depth Isolation**: Linux cgroups, memory caps, CPU time quotas, and disabled network access.
- **Multi-Provider Fallback Matrix**:
  1. `CodeBox Engine` (Microservice worker queue with Redis & BullMQ)
  2. `Docker Container Pool` (Pre-warmed local containers for sub-100ms spin-up)
  3. `Interleet Engine` / `Judge0 API` (Distributed cloud judge)
  4. `Local Subprocess Isolation` (Local execution fallback)

### 3. 🔐 Cryptographic Proof of Merit & Campus Passes
- **Trust-of-Proof Verification**: Every submission result, leaderboard ranking, and certificate is signed using asymmetric cryptographic tokens (HMAC-SHA256 / Ed25519).
- **Public Proof Explorer**: Anyone can verify student scores and certificate authenticity at `/portal/verify`.
- **Digital & Printable Campus Passes**: Generates dynamic QR passes for student entry into physical university labs during offline contest phases.

### 4. 📈 University Rating Ladder & Leaderboards
- **Division System**: Automated rank categorization into **Division 1 (Grandmasters)**, **Division 2 (Specialists)**, and **Division 3 (Novices)** based on competitive performance.
- **Real-Time Scoreboards**: Live scoreboards with configurable scoreboard freezing during final contest windows to heighten suspense.

### 5. 🌐 Member Profiles & External Telemetry
- **Unified Coder Profile**: Aggregates external competitive coding statistics from **LeetCode**, **CodeChef**, and **GitHub**.
- **Activity & Submission Heatmaps**: Visualizes member consistency, problem-solving streaks, and badge milestones.

---

## 🏗️ Architecture & Tech Stack

```
                                  CLIENT TIER
                 ┌───────────────────────────────────────────┐
                 │  React 19 + TypeScript + Vite + Tailwind  │
                 │  Monaco Editor • Radix UI • Recharts      │
                 └─────────────────────┬─────────────────────┘
                                       │ HTTPS / WSS
                                       ▼
                              REVERSE PROXY & CDN
                 ┌───────────────────────────────────────────┐
                 │             Nginx / Caddy SSL             │
                 │    medicaps.chaoscomputerclub.in:443      │
                 └──────────────┬─────────────┬──────────────┘
                                │             │
                /api (REST)     │             │  Static SPA Assets
                                ▼             ▼
                        ┌──────────────┐ ┌──────────────┐
                        │ FastAPI App  │ │ Dist Bundle  │
                        │ Port: 8000   │ │ /var/www/... │
                        └──────┬───────┘ └──────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │ SQLite/PgSQL │   │ Redis Queue  │   │ CodeBox Judge│
     │ SQLAlchemy   │   │  & Caching   │   │ Engine (Node)│
     │ Async Session│   │  Port: 6379  │   │ Port: 3000   │
     └──────────────┘   └──────────────┘   └──────┬───────┘
                                                  │
                                          ┌───────┴───────┐
                                          ▼               ▼
                                   ┌──────────────┐┌──────────────┐
                                   │ Docker Pool  ││ Linux Isolate│
                                   │ Container VMs││  Subprocess  │
                                   └──────────────┘└──────────────┘
```

### Technology Matrix

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5.8, Vite 8, Tailwind CSS v4, Radix UI Primitives, Monaco Editor, Lucide Icons, Recharts, React Router v7, Redux Toolkit |
| **Backend API** | FastAPI, Python 3.11+, Pydantic v2, SQLAlchemy 2.0 (AsyncIO), `aiosqlite` / `asyncpg`, Uvicorn |
| **Execution Engine** | `codebox-engine` (Node.js microservice), BullMQ, Docker Engine SDK, Linux Isolate, Caddy |
| **Data & Cache** | SQLite (Air-gapped) / PostgreSQL (Cloud), Redis 7+ for execution queues and telemetry cache |
| **Security & Auth** | JWT with asymmetric signatures, BCrypt password hashing, OTP generation, CORS regex enforcement |
| **Deployment** | Systemd, Nginx, GSD Deployment Protocol, DigitalOcean Cloud droplet (`143.198.38.205`) |

---

## 📁 Repository Structure

```
medicaps.chaoscomputerclub.in/
├── src/                               # ⚛️ Frontend Single Page Application (React 19)
│   ├── components/                    # Reusable UI component library (Radix primitives)
│   ├── organization/                  # CCC Portal shell, navigation, header, status badges
│   ├── pages/                         # Core view pages (Arena, Contests, Leaderboard, Verify, etc.)
│   ├── services/                      # Frontend API clients and backend communication layer
│   ├── types/                         # TypeScript domain types and API contract schemas
│   ├── AppRoutes.tsx                  # Client-side route declarations & route guards
│   └── main.tsx                       # React application bootstrap
│
├── backend/                           # 🐍 High-Throughput REST API (FastAPI)
│   ├── app/
│   │   ├── api/v1/                    # Versioned API routes (/api/v1)
│   │   ├── core/                      # Configuration, async DB session, Redis connector
│   │   ├── engine/                    # Judge Engine abstraction layer
│   │   │   ├── docker/                # Prewarmed Docker container pools
│   │   │   └── providers/             # CodeBox, Docker, Interleet, Judge0, Local providers
│   │   ├── middleware/                # Contest eligibility and security middleware
│   │   ├── models/                    # SQLAlchemy async ORM models & database schemas
│   │   ├── routers/                   # Modular API controllers (auth, contests, leaderboard, etc.)
│   │   ├── schemas/                   # Pydantic validation schemas
│   │   └── services/                  # Business logic (Contest lifecycle, QA tests, Passes, Rating)
│   ├── keys/                          # Asymmetric signature keys & cryptography assets
│   ├── main.py                        # FastAPI entrypoint, lifespan manager & health probes
│   └── requirements.txt               # Backend dependencies
│
├── codebox-engine/                    # ⚡ Microservice Execution Sandbox (Node.js)
│   ├── src/
│   │   ├── api/                       # Fastify / Express submission ingestion endpoints
│   │   ├── executor/                  # Docker, Firecracker, Isolate sandbox executors
│   │   ├── languages/                 # Language compilers, flags, and memory constraints
│   │   └── queue/                     # BullMQ / Redis job queue consumers
│   ├── docker-compose.yml             # Sandbox container stack definitions
│   └── Caddyfile                      # Internal secure proxy configuration
│
├── drizzle/                           # 🗄️ Database migration metadata & snapshots
├── scripts/                           # 🛠️ DevOps, verification & sync automation scripts
│   └── gsd_sync.sh                    # Production GSD push-and-pull continuous deployment pipeline
├── .env.example                       # Root environment variable template
├── AGENTS.md                          # Repository operating principles & deployment rules
└── package.json                       # Frontend dependencies and Vite build scripts
```

---

## 🚦 Quick Start & Local Development

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` ([Download](https://nodejs.org/))
- **Python**: `3.11+` ([Download](https://www.python.org/))
- **Docker Engine**: (Optional, required for sandboxed local code execution)
- **Redis**: (Optional, required for CodeBox worker queues)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/ChaosComputerClub-India/medicaps.chaoscomputerclub.in.git
cd medicaps.chaoscomputerclub.in
```

---

### Step 2: Set Up & Run Backend

1. Navigate to the backend directory and create a virtual environment:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

2. Install Python dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Start the FastAPI development server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The API and interactive Swagger documentation will be available at:
- **API Endpoint**: `http://localhost:8000`
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc UI**: `http://localhost:8000/redoc`

---

### Step 3: Set Up & Run Frontend

1. Open a new terminal in the project root and install Node dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Launch the Vite development server:
```bash
npm run dev
```
The frontend portal will be accessible at: `http://localhost:8081`

---

### Step 4: (Optional) Run Code Execution Engine

To run the local isolated code execution sandbox:
```bash
cd codebox-engine
npm install
npm run dev
```

---

## ⚙️ Environment Configuration

### Frontend (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base HTTP endpoint for the backend API | `http://localhost:8000/api` |

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PROJECT_NAME` | Name of the FastAPI application | `CCC Medi-Caps Arena API` |
| `HOST` | Server host binding | `0.0.0.0` |
| `PORT` | Server listening port | `8000` |
| `SECRET_KEY` | 32+ character key for JWT token signing | *(Set a secure random secret)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Lifetime of authentication sessions | `10080` (7 days) |
| `DATABASE_URL` | SQLAlchemy async connection URI | `sqlite+aiosqlite:///./ccc_medicaps.db` |
| `FRONTEND_URL` | Base URL of the client for CORS validation | `http://localhost:8081` |
| `JUDGE_PROVIDER` | Execution backend (`codebox`, `docker`, `local`, `interleet`, `judge0`) | `codebox` |
| `CODEBOX_URL` | Microservice URL for the CodeBox Engine | `http://127.0.0.1:3000` |
| `DEV_MODE` | Enables developer bypasses and rapid testing | `true` (in local) / `false` (in prod) |

---

## 🔌 API Endpoints Reference

The backend provides both root `/api` and versioned `/api/v1` routes:

### Core Endpoints

```
Authentication & Users
POST   /api/auth/register              # Register new student / member
POST   /api/auth/login                 # Obtain JWT access token
GET    /api/auth/me                    # Current authenticated profile

Contests & Arena
GET    /api/contests                   # List all active, upcoming & past contests
GET    /api/contests/{slug}            # Contest overview & metadata
GET    /api/contests/{slug}/problems   # Contest problem list
POST   /api/contests/{slug}/submit     # Submit solution for grading
GET    /api/contests/{slug}/results    # Top rankings & participant results
GET    /api/contests/{slug}/qualifiers # Top 30 qualified list for Phase 2

Campus Passes & Cryptographic Proofs
GET    /api/passes/my-passes           # User's generated campus entry passes
GET    /api/passes/verify/{token}      # Gate coordinator pass scanner validation
GET    /api/verify/{proof_id}          # Cryptographic proof-of-result verification

Leaderboard & Ratings
GET    /api/leaderboard/university     # University-wide competitive programming ladder
GET    /api/leaderboard/division/{div} # Filtered by Division 1, 2, or 3
GET    /api/leaderboard/batch/{year}   # Filtered by graduation year

System & Health
GET    /api/health                     # Production readiness probe & judge status
```

---

## 🚢 Production Deployment & GSD Sync Protocol

All production code updates follow the strict **GET SHIT DONE (GSD)** sync pipeline:

```bash
./scripts/gsd_sync.sh "feat: describe your change here"
```

### What the Sync Script Automates:
1. **Local Verification**: Executes `npm run build` locally to ensure zero TypeScript or bundling errors.
2. **Atomic Git Push**: Commits and pushes changes directly to `origin/main`.
3. **Server Auto-Pull**: Connects over SSH to the production server (`root@143.198.38.205`) and syncs repository state.
4. **Zero-Downtime Service Reload**:
   - Synchronizes updated backend code and restarts `ccc-medicaps-api.service`.
   - Rsyncs production frontend assets to `/var/www/ccc-medicaps/.output/public/`.
   - Reloads Nginx reverse proxy configurations.
5. **Live Health Verification**: Pings production probes and verifies HTTP `200 OK` status on the live platform.

---

## 🧪 Testing & Quality Assurance

### Frontend Build & Lint Checks
```bash
# Type check and build verification
npm run build

# Code style linting
npm run lint
```

### Backend E2E Contest Simulation Harness
The backend includes a comprehensive test suite that simulates end-to-end user registration, submission grading, leaderboard freezing, and cutoff resolution:
```bash
cd backend
source .venv/bin/activate
python scripts/test_contest_funnel.py
```

---

## 🛡️ Security & Sandbox Isolation Guarantees

- **Code Isolation**: All untrusted user code runs in unprivileged sandbox containers with strict seccomp filters.
- **Resource Limits**:
  - Max CPU Time: `2.0 seconds`
  - Max Memory: `256 MB`
  - Network: Fully air-gapped (`--net=none`)
  - File System: Read-only root with ephemeral `tmpfs` mounts
- **Anti-Cheat Telemetry**: Blur events, tab switches, and clipboard paste payloads are recorded and correlated with submission timestamps.
- **HMAC Signatures**: Contest results and pass tokens are cryptographically sealed against tampering.

---

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`).
2. Verify all builds and tests pass locally (`npm run build`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to your branch and open a Pull Request.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  <b>Chaos Computer Club — Medi-Caps University Chapter</b><br>
  <i>"All creatures welcome."</i>
</p>
