# Product Requirement Document (PRD)
# Chaos Computer Club (CCC) — Medi-Caps University Chapter Platform

**Document Version:** `3.0.0-PRODUCTION`  
**System Status:** `Active / Production Live`  
**Author:** Chaos Computer Club Core Engineering & Architecture Team  
**Institution:** Medi-Caps University, Indore  
**Production Domains:**  
- **Cadet Portal:** [`https://medicaps.chaoscomputerclub.in`](https://medicaps.chaoscomputerclub.in)  
- **Admin Command Console:** [`https://admin.chaoscomputerclub.in`](https://admin.chaoscomputerclub.in)  
- **API Gateway:** [`https://medicaps-api.chaoscomputerclub.in/api`](https://medicaps-api.chaoscomputerclub.in/api)  

---

## 1. Executive Summary & Product Vision

### 1.1 Product Purpose
The **Chaos Computer Club (CCC) Medi-Caps Chapter Platform** is an enterprise-grade competitive programming arena, member intelligence hub, and tournament execution platform designed specifically for students at Medi-Caps University, Indore.

The platform provides a unified competitive programming experience:
1. **Regular Campus Contests:** Weekly Contests, Biweekly Contests, and Special Invitationals with LeetCode-style algorithmic challenges (Easy, Medium, Hard).
2. **Live Competitive Arena:** Dedicated Monaco IDE with multi-language code execution, immediate sample test verification, hidden testcase grading, and automated anti-cheat telemetry.
3. **Official Standings & Elo Ladder:** Real-time contest standings based on points and penalty minutes, driving the campus-wide 5-tier Star Rating ladder (1★ Explorer to 5★ Grandmaster).
4. **Student Intelligence Dossier:** Tamper-proof member profiles tracking campus contest attendance, Elo rating trajectory, and external competitive telemetry across LeetCode, CodeChef, and GitHub.

### 1.2 Core Product Tenets
- **Zero-Friction Access:** Every registered Medi-Caps student competes directly in the official contest arena. Artificial screening cutoffs and physical gate-check barriers are eliminated.
- **Academic Rigor & Anti-Cheat:** Passwordless institutional email authentication (`@medicaps.ac.in`), window blur/focus tracking, and copy-paste throttling during live rounds.
- **Precision Judging:** Sub-second code grading powered by the isolated CodeBox execution engine running sandboxed containers with strict CPU and memory bounds.
- **Authentic Recognition:** Official campus rank and star tiers are awarded exclusively through verified tournament participation.

---

## 2. System Architecture & Topology

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       DNS ROUTING LAYER (Cloudflare)                           │
│     medicaps.chaoscomputerclub.in (Cadet)    │  admin.chaoscomputerclub.in (Command Center)     │
└───────────────────────────────────────┬─────────────────────────────────┬───────────────────────┘
                                        │                                 │
                                        ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRODUCTION SERVER (143.198.38.205)                            │
│                                           NGINX REVERSE PROXY                                   │
│  ├── /var/www/ccc-medicaps/.output/public/ (Student SPA Bundle - React 19 / Port 8081 dev)      │
│  ├── /var/www/ccc-medicaps-admin/          (Admin Console Bundle - React 19 / Port 8082 dev)    │
│  └── /api/* -> Proxy to FastAPI Application Service (Uvicorn / Port 8002)                       │
└───────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                FASTAPI ASYNC APPLICATION CORE (Python 3.12)                     │
│  ├── Institutional Auth (@medicaps.ac.in)      ├── Contest Lifecycle State Machine              │
│  ├── Assessment & Arena Workspace Engine       ├── CodeBox Sandboxed Judge Dispatcher           │
│  ├── Star Division & Elo Rating Engine         ├── OpenAPI 3.1 Webhooks & SSE Broadcaster       │
└──────────────┬────────────────────────┬─────────────────────────────────┬───────────────────────┘
               │                        │                                 │
               ▼                        ▼                                 ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌───────────────────────────────────────┐
│   DATABASE PERSISTENCE   │ │      REDIS 7+ CACHE      │ │      CODEBOX EXECUTION ENGINE         │
│ PostgreSQL 16 (AsyncIO)  │ │  - Session Tokens        │ │  - Multi-language Compiler / Runtime │
│ (ccc_medicaps / 5432)    │ │  - Real-time Leaderboard │ │  - Docker / Cgroup Isolation          │
│                          │ │  - SWR Invalidation Cache│ │  - Resource Quotas (2.0s / 256MB)     │
└──────────────────────────┘ └──────────────────────────┘ └───────────────────────────────────────┘
```

---

## 3. User Personas & Role-Based Access Control (RBAC)

The platform establishes clean, explicit permission tiers:

| Role | Target Persona | Authentication | Scope & Access Rights |
| :--- | :--- | :--- | :--- |
| **Guest** | Public visitors, university recruiters | None | View landing page, public leaderboard, contest problem summaries, and public verification explorer. |
| **Cadet** | Enrolled Medi-Caps students | `@medicaps.ac.in` + 6-digit OTP | Enter live contest arena, run/submit code, participate in weekly tournaments, view standings, follow peers, manage profile. |
| **Chief Proctor / Admin** | CCC Chapter Leads, Contest Organizers | Admin Proctor Secret Key / PIN | Create/clone contests, edit problem testcases, trigger contest state transitions, view live submissions telemetry. |

### 3.1 Permission Matrix

| Capability | Guest | Cadet | Chief Proctor / Admin |
| :--- | :---: | :---: | :---: |
| Browse Contests & Problem Archive | ✅ | ✅ | ✅ |
| View University Leaderboard & Standings | ✅ | ✅ | ✅ |
| Register for Scheduled Tournaments | ❌ | ✅ | ❌ |
| Enter Live Contest Arena (Monaco IDE) | ❌ | ✅ | ❌ |
| Run Sample Test Cases & Submit Code | ❌ | ✅ | ❌ |
| View Personal Rating History & Rank | ❌ | ✅ | ❌ |
| Follow / Unfollow Peer Cadets | ❌ | ✅ | ❌ |
| Create, Edit, or Clone Contests | ❌ | ❌ | ✅ |
| Change Contest Lifecycle (Live / Concluded) | ❌ | ❌ | ✅ |
| Edit Contest Problems & Starter Codes | ❌ | ❌ | ✅ |

---

## 4. Feature Specifications & User Journeys

### 4.1 Authentication & Onboarding
- **Restricted Access:** Exclusively open to Medi-Caps University email addresses (`*@medicaps.ac.in`).
- **Passwordless Verification:** 6-digit cryptographic OTP delivered directly via institutional SMTP with a 10-minute validity window.
- **Onboarding Ledger:** First-time users register their Full Name, unique Handle (`@handle`), Enrollment Number (`PRN`), Department (`CSE`, `IT`, `AIDS`, `CSBS`, `ECE`, etc.), and Batch (`2022-26`, `2023-27`, `2024-28`, `2025-29`).
- **Clean Logout Ejection:** Logging out clears Redux auth state, purges all session/local storage tokens, and immediately redirects to `/auth`, preventing zombie unauthenticated sessions.

### 4.2 Contests Hub & Registration
- **Schedule Awareness:** Clear categorization of Upcoming, Live, and Concluded tournaments with localized Indian Standard Time (IST) clocks.
- **One-Click Registration:** Cadets register for upcoming contests in a single click, reserving their entry for the live round.
- **Contest Standby Lobby:** Features countdown timer, contest rules, score calculation parameters, and live status updates.

### 4.3 Live Contest Arena (Assessment Studio)
- **Split-Screen Monaco IDE:** Ergonomic side-by-side problem statement viewer and full-featured code editor.
- **Multi-Language Runtimes:** Full native starter codes provided in **C, C++, Python 3.12, Java 21, JavaScript, and TypeScript**.
- **Interactive Sandbox Execution:**
  - `Run Code`: Executes solution against sample testcases with formatted diff view, execution time (ms), and console stdout/stderr.
  - `Submit`: Grades solution against hidden stress testcases and updates total contest score.
- **Anti-Cheat Monitoring:** Monitors window focus changes and logs alerts if candidates switch windows during active rounds.

### 4.4 Contest Standings & Scoreboard
- **Rank Calculation:** Ranked by total points (descending), then penalty minutes (ascending).
- **Podium Accolades:** Highlighted 🥇 Gold, 🥈 Silver, and 🥉 Bronze indicators for top 3 finishes.
- **Interactive Inspection:** Searchable by cadet name or handle, with optional department filtering.
- **Scoreboard Sealing:** Supports freezing the live scoreboard during the final phase of a contest to build suspense.

### 4.5 University Leaderboard & Star Divisions
- **Star Rating Ladder:**
  - **5★ Grandmaster:** Rating $\ge 2000$
  - **4★ Master:** Rating $1800 - 1999$
  - **3★ Candidate Master:** Rating $1600 - 1799$
  - **2★ Specialist:** Rating $1400 - 1599$
  - **1★ Explorer:** Rating $< 1400$
- **Strict Participation Gating:** Only cadets with active contest attendance (`attendance_count > 0`) are assigned official ranks on the leaderboard. Cadets with 0 attendance display cleanly as "Unranked".
- **Bot/QA Shield:** Automated test bot accounts (e.g. `qa_organizer`) are strictly filtered from public leaderboards.

---

## 5. Non-Functional & Quality Standards

- **Performance:** Sub-100ms API response latency on cached endpoints; sub-2.5s code sandbox execution cycle.
- **Aesthetics & Anti-Slop:** Strict compliance with `DESIGN.md` (Obsidian palette, electric lime accents, tabular monospace numerals, zero generic AI placeholders).
- **Resilience:** Automatic failover between primary PostgreSQL and local SQLite databases; Redis SWR caching with graceful degradation.
- **Automated Verification:** All code modifications must pass the 4-stage automated QA gatekeeper (`./scripts/gsd_qa_gate.sh`) prior to production deployment.
