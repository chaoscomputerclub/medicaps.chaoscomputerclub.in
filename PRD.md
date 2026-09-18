# Product Requirement Document (PRD)
# Chaos Computer Club (CCC) — Medi-Caps University Chapter Platform

**Document Version:** `2.4.0-PRODUCTION`  
**System Status:** `Active / Production Live`  
**Author:** Chaos Computer Club Core Engineering & Architecture Team  
**Institution:** Medi-Caps University, Indore  
**Production Domains:**  
- **Cadet Portal:** [`https://medicaps.chaoscomputerclub.in`](https://medicaps.chaoscomputerclub.in)  
- **Admin & Proctor Console:** [`https://admin.chaoscomputerclub.in`](https://admin.chaoscomputerclub.in)  
- **API Gateway:** [`https://medicaps-api.chaoscomputerclub.in/api`](https://medicaps-api.chaoscomputerclub.in/api)  

---

## 1. Executive Summary & Product Vision

### 1.1 Product Purpose
The **Chaos Computer Club (CCC) Medi-Caps Chapter Platform** is a specialized, dual-frontend competitive programming arena, member intelligence hub, and hybrid tournament execution engine. Designed specifically for Medi-Caps University cadets, the system facilitates rigorous algorithmic evaluation through a two-stage competitive pipeline:
1. **Phase 1 (Online Screening Assessment):** Browser-based, anti-cheat gated, timed algorithmic screening.
2. **Phase 2 (Air-Gapped Lab Final):** Physical, on-premise, air-gapped hardware lab contest conducted in the Medi-Caps Computing Complex (Lab 04).

### 1.2 Core Philosophy: "Offline by Design"
Unlike commercial competitive programming platforms that conduct contests entirely over public internet connections, the CCC Medi-Caps Chapter operates under a zero-trust, hardware-verified model:
- **No Remote Lab Access:** Remote internet access to the final arena is strictly prohibited. Finalists cannot view problems or submit code until their physical presence is authenticated at the computing lab turnstile.
- **Cryptographic Gate Verification:** Candidates must present a single-use digital QR Campus Pass issued upon qualifying in the Top 30.
- **Physical Station Binding:** Each qualified cadet is bound to a dedicated physical hardware workstation (`LAB-04-WS-01` through `LAB-04-WS-30`).
- **Cryptographic Trust of Proof:** All final standings, solve times, and certificates are signed with immutable SHA-256 digests and cryptographic signatures publicly verifiable on an immutable ledger.
- **Strict Student Independence:** Operated autonomously by the Chaos Computer Club student chapter; all operational, proctoring, and judging responsibilities reside strictly with CCC Core Organizers and Chief Proctors.

---

## 2. System Architecture & Topology

The platform implements a modern, decoupled dual-frontend, single-gateway architecture to guarantee physical isolation between candidate competitors and contest operators.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       DNS ROUTING LAYER (Cloudflare)                           │
│     medicaps.chaoscomputerclub.in (Student)  │  admin.chaoscomputerclub.in (Command Center)     │
└───────────────────────────────────────┬─────────────────────────────────┬───────────────────────┘
                                        │                                 │
                                        ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRODUCTION SERVER (143.198.38.205)                            │
│                                           NGINX REVERSE PROXY                                   │
│  ├── /var/www/ccc-medicaps/.output/public/ (Student SPA Bundle - React 19 / Port 8081 dev)      │
│  ├── /var/www/ccc-medicaps-admin/          (Admin Console Bundle - React 19 / Port 8082 dev)    │
│  └── /api/* -> Proxy to FastAPI Application Service (Uvicorn / Port 8000)                       │
└───────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                FASTAPI ASYNC APPLICATION CORE (Python 3.12)                     │
│  ├── Authentication & Onboarding      ├── Dynamic Contest State Machine                         │
│  ├── Assessment & Anti-Cheat Engine   ├── CodeBox Sandboxed Judge Dispatcher                    │
│  ├── Campus Pass & Gate Security      ├── Rating & Division Calculation Engine                  │
│  ├── OpenAPI 3.1 Webhooks Subsystem   └── SSE Real-Time Event Stream Broadcaster                │
└──────────────┬────────────────────────┬─────────────────────────────────┬───────────────────────┘
               │                        │                                 │
               ▼                        ▼                                 ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌───────────────────────────────────────┐
│   DATABASE PERSISTENCE   │ │      REDIS 7+ CACHE      │ │      CODEBOX EXECUTION ENGINE         │
│ SQLAlchemy 2.0 (AsyncIO) │ │  - Session Tokens        │ │  - Multi-language Compiler / Runtime │
│ SQLite (Air-gapped) /    │ │  - Real-time Leaderboard │ │  - Docker / Cgroup Isolation          │
│ PostgreSQL (Cloud Sync)  │ │  - SWR Invalidation Cache│ │  - Resource Quotas (2.0s / 256MB)     │
└──────────────────────────┘ └──────────────────────────┘ └───────────────────────────────────────┘
```

### 2.1 Dual Frontend Separation
| Attribute | Cadet Portal | Admin & Proctor Console |
| :--- | :--- | :--- |
| **Domain** | `medicaps.chaoscomputerclub.in` | `admin.chaoscomputerclub.in` |
| **Target User** | Competitors, Cadets, Students, Guests | Chief Proctors, Gate Guards, Contest Controllers |
| **Local Port** | `8081` (`pnpm dev`) | `8082` (`pnpm dev:admin`) |
| **Dist Output** | `dist/` | `dist-admin/` |
| **Nginx Root** | `/var/www/ccc-medicaps/.output/public/` | `/var/www/ccc-medicaps-admin/` |
| **Admin Route Inclusion**| **Strictly ZERO** (All admin routes removed) | Full operational surface |
| **Primary Theme** | Dark cyber-glass with neon accents | Crimson tactical command grid |

---

## 3. Role-Based Access Control (RBAC) & User Personas

The application establishes five distinct security tiers:

| Role | Description | Authentication Method | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Guest / Anonymous** | Public visitor or prospective cadet. | None | Can view landing page, public leaderboard, problem list (summaries only), and public certificate verification explorer. |
| **Registered Cadet** | Verified Medi-Caps student. | Institutional Email (`@medicaps.ac.in`) + 6-digit OTP verification. | Access to dashboard, contest registration, lobby, 120-min Phase 1 assessment, external telemetry sync, social follows, and personal pass view. |
| **Top 30 Finalist** | Cadet qualified in top 30 during Phase 1. | System-promoted status based on screening score. | Awarded digital QR Campus Pass, assigned workstation seat (`Lab-04-WS-xx`), permitted entry to physical lab arena upon gate scan. |
| **Chief Proctor** | Hardware turnstile / entrance proctor. | Proctor Secret Key / PIN clearance on Admin console. | Access to Air-Gapped Gate QR Scanner, attendee workstation roster, manual entry overrides, real-time admission telemetry. |
| **Contest Controller** | Core Chapter Lead / Organizer. | Proctor Secret Key clearance on Admin console. | Can trigger contest state transitions, start Round 2 live final, conclude & lock arena, override countdown clocks, dispatch webhooks. |

### 3.1 Permission Matrix

| Capability / Action | Guest | Registered Cadet | Top 30 Finalist | Chief Proctor | Contest Controller |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Public Leaderboard & Verify Proofs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register for Scheduled Contests | ❌ | ✅ | ✅ | ❌ | ❌ |
| Enter Phase 1 Assessment Workspace | ❌ | ✅ | ✅ | ❌ | ❌ |
| View Digital Campus QR Pass | ❌ | ❌ | ✅ | ❌ | ❌ |
| Enter Live Arena prior to Gate Scan | ❌ | ❌ | ❌ (Blocked) | ❌ | ❌ |
| Enter Live Arena after Gate Scan | ❌ | ❌ | ✅ (Unlocked) | ❌ | ❌ |
| Scan & Validate QR Badges at Lab Gate | ❌ | ❌ | ❌ | ✅ | ✅ |
| View Assigned Workstation Seat Roster | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export Attendee Roster (CSV) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Start Live Round 2 Final (`start_live`)| ❌ | ❌ | ❌ | ❌ | ✅ |
| Conclude Contest & Lock Submissions | ❌ | ❌ | ❌ | ❌ | ✅ |
| Override Arena Countdown Clock | ❌ | ❌ | ❌ | ❌ | ✅ |
| Register OpenAPI 3.1 Outbound Webhooks | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. Deep Feature Specifications & Expected Behavior

### 4.1 Identity, Authentication & Cadet Onboarding
- **Feature Overview:** Passwordless, cryptographic authentication exclusively restricted to Medi-Caps University students.
- **Importance:** Enforces academic integrity, prevents sockpuppeting, and ensures that only enrolled students compete for University rank and division standing.
- **Expected Behavior & Rules:**
  - Accepted email addresses must match `@medicaps.ac.in` (configurable regex supports test domains in development).
  - A 6-digit cryptographic numeric OTP is generated and stored in `otp_store` with a strict 10-minute expiry window.
  - Upon first authentication, the user enters an immutable onboarding sequence:
    - **Full Name** (Student university record)
    - **Handle** (Unique alphanumeric tag, e.g., `@en23cs301927`)
    - **PRN** (Enrollment ID / Permanent Registration Number, e.g., `EN23CS301927`)
    - **Department** (`CSE`, `IT`, `AIDS`, `Cyber Security`, `CSBS`, `ECE`, `Other`)
    - **Batch** (`2022-26`, `2023-27`, `2024-28`, `2025-29`, `Alumni / Special`)
  - Once onboarded, PRN and institutional email are permanently locked to the member record.
  - Authentication tokens are issued as asymmetric RS256/Ed25519 signed JSON Web Tokens (JWT) valid for 30 days.

---

### 4.2 Member Intelligence & External Telemetry Hub
- **Feature Overview:** A unified competitive profile reflecting both on-platform performance and external activity across LeetCode, CodeChef, and GitHub.
- **Importance:** Provides recruiters, organizers, and peers with an accurate, tamper-proof appraisal of a student's real engineering capability.
- **User Access & Capabilities:**
  - View personal and peer profiles via `/portal/profile` or direct handle link `/u/:handle`.
  - Connect external usernames for LeetCode, CodeChef, and GitHub.
  - View live telemetry: global ranking, problems solved breakdown (Easy / Medium / Hard), contest rating trajectory, and activity heatmaps.
  - View verified university contest history: attendance count, rating milestones, division badge, and verified certificates.
  - Edit profile bio, links, and avatar image (stored via `/api/storage/avatar`).

---

### 4.3 Peer Social Graph & Activity Bulletin
- **Feature Overview:** A campus-wide social graph connecting engineering cadets across departments and batches.
- **Importance:** Encourages collaborative study, healthy intra-department rivalry, and peer-to-peer benchmarking.
- **Capabilities:**
  - One-click Follow / Unfollow toggle on any cadet profile (`/api/social/follow/{handle}`).
  - Social Drawer listing a cadet's "Followers" and "Following" rosters with live rating badges.
  - Campus Activity Bulletin (`/portal/feed`): Real-time feed broadcasting contest announcements, Top 30 qualification declarations, and rating promotions.

---

### 4.4 Contest Discovery, Cadence & Lifecycle Engine
- **Feature Overview:** The central engine managing university coding tournaments across three standard cadences:
  1. **Weekly Contests:** Fast-paced, 4-problem algorithmic showdowns designed for continuous skill sharpening.
  2. **Bi-Weekly Contests:** Heavy-duty, high-point tournaments featuring complex optimization and dynamic programming.
  3. **Special Hack Battles:** Flagship, division-restricted or university-wide invitationals.
- **Contest Lifecycle States:**
  ```
  [UPCOMING] ──► [REGISTRATION_OPEN] ──► [PHASE 1 SCREENING (24h)] ──► [TOP 30 CUTOFF] ──► [ROUND 2 LIVE FINAL] ──► [FINISHED]
  ```
- **User Access & Capabilities:**
  - Browse featured, upcoming, and past contests on the Contests Hub (`/portal/contests`).
  - View comprehensive contest briefs: starts/ends at, venue (Lab 04), seat capacity (60), prize pool, rules, and chief proctors.
  - One-click Registration (`POST /api/contests/{slug}/register`): Enrolls cadet into the contest and provisions participation records.

---

### 4.5 Phase 1: Online Screening Assessment & Anti-Cheat Engine
- **Feature Overview:** A secure, timed browser arena for preliminary evaluation before physical lab seating.
- **Importance:** Filters hundreds of applicants down to the top 30 performing finalists in a fair, standardized manner.
- **Technical & Operational Behavior:**
  - **Screening Window:** The screening round opens for an aggregate 24-hour availability window.
  - **Session Duration:** Once a cadet clicks "Confirm & Launch Assessment" from the Lobby, an immutable **120-minute (or 90-minute) non-pausable timer** starts on the server.
  - **Single Attempt Rule:** A cadet cannot pause, reset, or restart their session. Closing the browser does not halt the server countdown.
  - **Integrated Monaco Editor:** Supports syntax highlighting, bracket matching, indentation, and starter templates for Python, C++, Java, and JavaScript.
  - **Real-Time CodeBox Execution:**
    - Cadets can test solutions against sample testcases using the **"Run Code"** action.
    - Cadets execute formal evaluations against hidden testcases using the **"Submit Solution"** action.
  - **Anti-Cheat Enforcement:**
    - **Tab Blur & Window Focus Tracking:** The interface monitors `document.visibilityState` and `window.onblur`. Switching tabs, opening secondary windows, or leaving fullscreen immediately increments the violation counter.
    - **Violation Threshold:** If a cadet exceeds `max_violations` (default: 3), the session is automatically locked and submitted in a disqualified state.
    - **Auto-Submission at Zero:** When the server countdown reaches 00:00:00, the session locks immediately, evaluates all saved buffers, and prevents further keystrokes.

---

### 4.6 Automated Top 30 Finalist Qualification Pipeline
- **Feature Overview:** A fully automated algorithmic ranking and promotion engine executed upon Phase 1 completion.
- **Importance:** Eliminates human bias, manual spreadsheet errors, and delay in advancing finalists to physical lab competition.
- **Rules of Evaluation:**
  1. **Primary Metric:** Total score accrued across solved assessment challenges (up to 400 points).
  2. **Tie-Breaking Metric:** Penalty minutes calculated as `Time to Solve + (20 minutes * Incorrect Submissions)`.
  3. **Cutoff Line:** Ranks 1 through 30 receive the `is_top_30_qualified = True` flag.
- **Automated Actions Executed:**
  - Generates a unique, tamper-proof `CampusPass` record for each of the 30 finalists.
  - Assigns physical workstation seats in sequential order (`Lab-04-WS-01` to `Lab-04-WS-30`).
  - Broadcasts the `top30_qualified` event to outbound webhooks and SSE listeners.
  - Updates the student's contest journey view with the qualification unlock screen.

---

### 4.7 Single-Use Cryptographic Campus QR Pass & Air-Gapped Gate Lock
- **Feature Overview:** A cryptographic digital gate pass required for entry into Medi-Caps University Computing Lab 04.
- **Importance:** Guarantees that only authentic, qualified students sit at contest workstations and prevents proxy attendance.
- **Pass Structure & Visual Identity:**
  - Renders a clean QR badge containing a formatted cryptographic token:
    ```
    CCC-PASS:<PASS_CODE>:<MEMBER_ID>:<SEAT_NUMBER>:QUALIFIED
    ```
  - Displays Candidate Name, Handle, Enrollment PRN, Seat Assignment, and Venue (`Lab 04`).
- **Physical Gate Lock Enforcement:**
  - A qualified finalist navigating to `/portal/contests/:slug/arena` prior to check-in is **strictly blocked** by a full-screen gate lock:
    > *"Physical Gate Lock: Present your QR code to the proctor at the lab entrance to check in."*
  - The Live Arena will refuse WebSocket/SSE connections and API challenge retrieval (`HTTP 403 Forbidden`) until the pass is officially scanned and marked `checked_in` in the database.

---

### 4.8 Phase 2: On-Premise Air-Gapped Lab Arena
- **Feature Overview:** The high-intensity, physical finals environment where the Top 30 solve advanced challenges in person.
- **Importance:** Completely eliminates remote AI code generation, external assistance, and unauthorized collaboration.
- **Arena Specifications:**
  - **Workstation Binding:** The interface validates that the cadet is seated at their assigned workstation (`assigned_seat`).
  - **Sealed Problem Set:** Problem statements remain encrypted and sealed until the Chief Proctor sounds the start bell and transitions contest status to `live`.
  - **Live Scoreboard Freeze:** In the final 15 minutes of competition, the public scoreboard freezes to preserve suspense for the post-contest awards ceremony.
  - **Proctor Clock Overrides:** In case of campus network disruptions or power fluctuations, Chief Proctors can broadcast immediate timer pauses or extensions via SSE/Webhooks with 0ms polling delay.

---

### 4.9 University Rating Ladder & Division System
- **Feature Overview:** A skill rating framework adapted from the Elo/Glicko competitive algorithm.
- **Importance:** Provides longitudinal tracking of student algorithmic growth across semesters.
- **Division Tiers:**
  - **Division 1 (Grandmasters & Masters):** Rating `1800+` (Championship problem tier).
  - **Division 2 (Specialists):** Rating `1400 - 1799` (Core dynamic programming & graph theory).
  - **Division 3 (Novices & Cadets):** Rating `< 1400` (Foundational algorithms & data structures).
- **Rating Dynamics:**
  - Rating adjustments are calculated on contest finalization based on expected vs. actual placement.
  - Historical trajectories are stored in `rating_history` and rendered on member profiles via interactive SVG charts.

---

### 4.10 Cryptographic Proof-of-Merit & Public Ledger
- **Feature Overview:** A tamper-proof public ledger for university certificates and contest achievements.
- **Importance:** Prevents resume fraud and allows external employers to independently verify student credentials.
- **Data Integrity Guarantee:**
  - Every certificate generates an immutable `TrustProof` containing:
    - `certificate_id` (e.g. `CCC-CERT-2026-W01-07`)
    - `prn_hash` (One-way SHA-256 hash of student PRN)
    - `sha256_digest` (Cryptographic hash of score, rank, contest slug, and timestamp)
    - `proctor_stamp` (`Chief Proctor (CCC Core)`)
  - Any external party can verify authenticity at [`https://medicaps.chaoscomputerclub.in/portal/verify`](https://medicaps.chaoscomputerclub.in/portal/verify) without logging in.

---

### 4.11 Dedicated Proctor & Admin Command Center (`admin.chaoscomputerclub.in`)
- **Feature Overview:** An isolated operations dashboard completely decoupled from the student-facing website.
- **Operational Panels:**
  1. **Gate QR Scanner (`GateScannerPanel.tsx`):**
     - Accepts inputs from handheld laser barcode scanners, webcams, or manual text entry.
     - Performs instant verification against `POST /api/passes/verify`.
     - Displays immediate visual admission verdicts: `ADMISSION GRANTED` (Emerald), `ALREADY CHECKED IN` (Cyan), `INVALID PASS` (Red).
  2. **Workstation Roster (`AttendeesPanel.tsx`):**
     - Complete 30-seat grid of the physical lab.
     - Live count of checked-in finalists vs. pending arrivals.
     - One-click manual "Admit" override in case of damaged candidate device screens.
     - CSV Export (`ccc_<contest>_attendees.csv`) for university administrative records.
  3. **Contest Operations (`ContestOperationsPanel.tsx`):**
     - Instant lifecycle state transition triggers (`start_live`, `finish`).
     - Real-time countdown timer controls (Reset to 90 min, 60 min, or custom duration).
     - Automated "Compute & Issue Top 30 Passes" button.
  4. **Webhooks & Real-Time Event Stream (`WebhooksMonitorPanel.tsx`):**
     - Live stream log of all platform broadcast events via Server-Sent Events (SSE).
     - External outbound webhook sink registration interface.

---

### 4.12 High-Performance Sandboxed Judge (CodeBox Engine)
- **Feature Overview:** Isolated execution sandbox for user submitted code.
- **Execution Limits:**
  - Standard CPU Time Limit: `2.0 seconds`
  - Memory Quota: `256 MB`
  - Disabled system calls: Fork bombs, raw socket creation, filesystem traversal outside `/tmp`.
- **Supported Languages & Compilers:**
  - C (GCC 14 / Clang 18)
  - C++ (GCC 14 / C++20 standard)
  - Python 3.12 (Isolated venv)
  - JavaScript / TypeScript (Node.js 20 LTS / Bun)
  - Java 21 (OpenJDK 21 LTS)

---

### 4.13 OpenAPI 3.1.0 Inbound & Outbound Webhook Subsystem
- **Feature Overview:** Real-time event subscription system replacing expensive client polling loops.
- **Outbound Webhook Specifications:**
  - `pass_checked_in`: Dispatched when a finalist's QR pass is scanned at the lab gate.
  - `contest_status_changed`: Dispatched when contest transitions between `upcoming`, `live`, and `finished`.
  - `top30_qualified`: Dispatched when Phase 1 scores are computed and passes are awarded.
  - `submission_evaluated`: Dispatched when CodeBox completes evaluation of a candidate's code submission.
  - `arena_timer_reset`: Dispatched when an administrator alters the live arena clock.

---

## 5. Technical Specifications & API Surface

### 5.1 Key REST Endpoints

| Category | Method | Path | Description |
| :--- | :---: | :--- | :--- |
| **Auth** | `POST` | `/api/auth/send-otp` | Generate and dispatch 6-digit email OTP. |
| **Auth** | `POST` | `/api/auth/verify-otp` | Verify OTP, issue JWT authentication token. |
| **Auth** | `POST` | `/api/auth/onboard` | Set student handle, PRN, batch, and department. |
| **Contests** | `GET` | `/api/contests` | List all upcoming, live, and archived contests. |
| **Contests** | `GET` | `/api/contests/{slug}` | Retrieve detailed contest specification. |
| **Contests** | `POST` | `/api/contests/{slug}/register` | Register authenticated cadet for contest. |
| **Contests** | `GET` | `/api/contests/{slug}/registration-status` | Get user registration & qualification status. |
| **Contests** | `GET` | `/api/contests/{slug}/arena` | Retrieve air-gapped arena workspace (Gate protected). |
| **Contests** | `POST` | `/api/contests/{slug}/arena/run` | Test code execution against sample cases. |
| **Contests** | `POST` | `/api/contests/{slug}/arena/submit`| Submit code for formal judging in arena. |
| **Assessment** | `POST` | `/api/assessment/{slug}/start` | Launch Phase 1 session & start 120-min countdown. |
| **Assessment** | `POST` | `/api/assessment/{slug}/submit` | Submit code challenge in screening assessment. |
| **Assessment** | `POST` | `/api/assessment/{slug}/anti-cheat` | Record window blur/tab switch violation. |
| **Assessment** | `POST` | `/api/assessment/{slug}/qualify-top30` | Evaluate Round 1 scores & issue Top 30 passes. |
| **Passes** | `GET` | `/api/passes/my-pass` | Get active user's latest campus entry pass. |
| **Passes** | `POST` | `/api/passes/verify` | Scan & verify QR pass code at lab gate. |
| **Passes** | `GET` | `/api/passes/contest/{slug}/attendees` | Get workstation attendee roster for proctor view. |
| **Webhooks** | `POST` | `/api/webhooks/gate-scan` | Inbound scan event from IoT gate turnstiles. |
| **Webhooks** | `POST` | `/api/webhooks/register-outbound` | Register external webhook listener sink. |
| **Events** | `GET` | `/api/events/stream` | Real-time Server-Sent Events (SSE) broadcast. |

---

## 6. Non-Functional & Operational Requirements

### 6.1 Performance & Latency
- **API Response Time:** P95 response time for unauthenticated routes `< 50ms`; authenticated database queries `< 120ms`.
- **Code Execution Throughput:** CodeBox worker turnaround time `< 800ms` for compilation and sample case verification.
- **Real-Time Broadcast:** Webhook & SSE dispatch latency `< 15ms` from state mutation to socket transmission.

### 6.2 Security & Anti-Tampering
- **Zero Remote Lab Access:** Network IP filtering and database gate checks prohibit external IP addresses from submitting arena solutions without a valid gate proctor check-in stamp.
- **Asymmetric Token Signing:** Pass tokens and certificate digests are computed using cryptographically secure algorithms resistant to brute-force tampering.
- **CORS Protection:** Strict origin filtering allows requests solely from verified chapter domains (`medicaps.chaoscomputerclub.in`, `admin.chaoscomputerclub.in`).

### 6.3 Compliance with Chapter Identity
- **Student Ownership:** Under no circumstances should any academic or university faculty names be hardcoded into proctor lists, default session stamps, or UI headers.
- **Official Titles:** All supervisory references must use official club titles: `Chief Proctor (CCC Core)`, `CCC Operations Desk`, `Lab Proctor Command`.

---

## 7. Automated Testing, QA Gates & Continuous Deployment

All software modifications are bound to the **GSD (Get Shit Done) Production Protocol**:
1. **Pre-Commit QA Gate (`./scripts/gsd_qa_gate.sh`):**
   - **TypeScript Strict Compilation:** `pnpm build` and `pnpm build:admin` must compile with 0 errors.
   - **Backend API Contract Validation:** Automated test suites verify authentication, contest gating, and pass issuance.
   - **UI Backend Connectivity Audit:** All buttons and interactive triggers must have functional API/routing bindings (0 dead placeholders permitted).
2. **Atomic Git Synchronization:** Pushed exclusively to `origin/main` without history rewriting.
3. **Automated Server Deployment (`./scripts/gsd_sync.sh`):**
   - Pulls latest commit to production droplet (`143.198.38.205`).
   - Syncs verified frontend bundles to Nginx root directories.
   - Restarts FastAPI systemd daemon (`ccc-medicaps-api.service`).
   - Executes live endpoint health checks (`200 OK`).

---

## 8. Appendix & Glossary

- **Air-Gapped:** An isolated local area network completely disconnected from external internet connections during competition.
- **CodeBox:** The proprietary sandboxed execution environment executing and evaluating candidate algorithmic programs.
- **Campus Pass:** A digitally signed, single-use QR credential permitting entry past the proctor check-in desk into University Lab 04.
- **PRN:** Permanent Registration Number; the unique enrollment identifier issued by Medi-Caps University to enrolled students.
- **Scoreboard Freeze:** A contest phase during the final 15 minutes where live standings are hidden from competitors to maximize suspense.
- **Top 30:** The elite 30 cadets advancing from Phase 1 Online Screening to the Phase 2 On-Premise Final.
