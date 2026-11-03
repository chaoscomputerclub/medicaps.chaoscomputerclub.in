# Chaos Computer Club — Medi-Caps Chapter
# AI Interview Practice: Architecture Audit & Feasibility Dossier
**Document Version:** 1.0.0  
**Target Environment:** Chaos Computer Club Medi-Caps Platform  
**Auditor:** Antigravity Engineering Lead  

---

## 1. Executive Summary

This architecture audit examines the existing Chaos Computer Club (CCC) Medi-Caps codebase to assess readiness, identify reusable infrastructure, define missing capabilities, and establish concrete technical boundaries for the **AI Interview Practice** feature (inspired by Interleet).

The objective is to build a structured, realistic, personalized AI interview simulation natively inside the CCC platform without introducing duplicate services or brittle abstractions.

---

## 2. Existing Codebase Audit Findings

### 2.1 Frontend Architecture
- **Framework:** React 19 (`react` 19.2.0, `react-dom` 19.2.0) with Vite 6 (`@tailwindcss/vite` 4.2.1).
- **Language Reality Check:** The project uses **TypeScript (`.tsx` and `.ts`)**, contrary to the preliminary assumption of `.jsx`. Type safety is strictly validated via `tsc --noEmit` in both local scripts and GitHub Actions CI (`.github/workflows/pr_check.yml`). All new interview components must be strictly typed in TypeScript (`.tsx`).
- **State Management:** Redux Toolkit (`@reduxjs/toolkit` 2.12.0, `react-redux` 9.3.0) with global root reducer combining `auth`, `portal`, `ui`, `assessment`, `social`, and `contest`. Authentication logout automatically resets all slice states.
- **Routing:** `react-router-dom` v7.1.5 with `AppRoutes.tsx`. Authenticated routes are enclosed in `<AuthGuard>` and nested within `<PortalShell>`. Navigation employs speculative hover-intent prefetching via `usePrefetchOnIntent()`.
- **UI & Design System:**
  - Styling: Tailwind CSS v4 with dark obsidian aesthetic (`#09090b` / `#18181b`), emerald/lime/cyan accents, and Radix UI primitives.
  - Component Primitives in `src/components/ui/`: Accordion, AlertDialog, Avatar, Badge, Button, Card, Checkbox, Dialog, Drawer, DropdownMenu, Input, Label, Progress, RadioGroup, ResizablePanels, ScrollArea, Select, Sheet, Skeleton, Slider, Switch, Tabs, Textarea, Tooltip.
  - Code Editor: `@monaco-editor/react` (v4.7.0) used in `PracticeProblemPage` and `ContestArenaPage`.
  - Notifications: `sonner` (v2.0.7).
  - Markdown: `marked` (14.1.4) + `dompurify` (3.4.16).

### 2.2 Backend Architecture
- **Framework:** FastAPI with Python 3.12, Uvicorn, and Starlette.
- **API Organization:** Router prefix `/api` with dual mounting for `/api/v1/` aggregated via `backend/app/api/v1/router.py`.
- **Database:** PostgreSQL 16+ via SQLAlchemy 2.0 with async engine (`asyncpg`), connection pooling (`pool_size=settings.DB_POOL_SIZE`, `pool_pre_ping=True`), and `AsyncSessionLocal`.
  - *Schema Evolution:* Managed in `backend/app/core/db.py` via `init_db()` and `ensure_database_integrity()` with idempotent DDL statements (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- **Coordination & Cache:** Redis 7 via `redis.asyncio` (`backend/app/core/redis.py`) singleton with auto-loop recovery, connection ping, pub/sub, and lock capabilities.
- **Authentication:** JWT Bearer tokens and HttpOnly cookies extracted via `extract_access_token()`. Dependency `get_current_member` returns `MemberProfile` model. `require_onboarded` validates onboarding status.
- **Realtime Push:** Server-Sent Events (SSE) via `backend/app/routers/events.py` and `backend/app/services/event_broadcaster.py` powered by Redis pub/sub. Multiplexed on the client through `src/lib/realtime.ts`.
- **Coding Judge:** Pluggable execution architecture in `backend/app/engine/providers/factory.py` supporting `DistributedFabricProvider`, `CodeboxProvider`, `DockerSandboxProvider`, and `LocalSandboxProvider`. Function execution with parameter normalization and testcase validation already exists.

### 2.3 Gaps & Missing Capabilities
1. **Zero Existing LLM Provider:** The repository currently has no LLM SDKs, no OpenAI/Anthropic/Gemini client abstractions, and no prompt execution engine. A resilient LLM provider layer must be implemented.
2. **No Interview Data Models:** No tables exist for interview sessions, questions, candidate answers, evaluations, or coaching reports.
3. **No Speech / Audio Pipeline:** No external speech provider is configured. The browser Web Speech API (`SpeechRecognition` / `speechSynthesis`) can be leveraged client-side with a strict provider interface and automatic text fallback.

---

## 3. Component Reuse Matrix

| Feature Module | Existing CCC Component to Reuse | New Component Required |
| :--- | :--- | :--- |
| **Authentication & RBAC** | `app.middleware.auth.get_current_member`, `require_onboarded`, `AuthGuard` | Interview session ownership guard |
| **State Management** | Redux Toolkit `store/index.ts`, `useAppDispatch`, `useAppSelector` | `src/store/slices/interviewSlice.ts` |
| **UI Primitives** | Radix UI primitives (`Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Textarea`, `ScrollArea`) | Interview Dashboard, Config Modal, Workspace, Report views |
| **Code Execution** | `PracticeService.run_code`, `get_judge_provider()` | Coding interview question runner integration |
| **Code Editor** | Monaco editor wrapper (`@monaco-editor/react`) | Coding interview editor panel |
| **Realtime Updates** | Redis pub/sub, SSE event relay | `GET /api/interview/sessions/{id}/stream` (or SSE broadcast) |
| **Durable Storage** | PostgreSQL 16 engine, `AsyncSessionLocal`, `ensure_database_integrity` | Tables: `interview_sessions`, `interview_questions`, `interview_answers`, `interview_evaluations`, `interview_reports`, `candidate_profiles` |
| **Cache & Deduplication**| Redis 7 (`app.core.redis.get_redis`) | Idempotency keys (`idemp:answer:{key}`), rate limits |
| **LLM Orchestration** | *None* | `app.services.llm.provider.LLMProvider` (Gemini, OpenAI-compatible, Deterministic Mock) |
| **Candidate Intel** | `MemberProfile` ORM model | `CandidateContextService` (skills, projects, bounded context) |

---

## 4. Technical Constraints & Invariants

1. **PostgreSQL as Authoritative Source of Truth:**
   - All session states, finalized answers, evaluations, and reports MUST be persisted durably to PostgreSQL before acknowledging clients.
   - Redis is used strictly for transient coordination, session locking, and cache invalidation.
2. **Strict Backend State Enforcement:**
   - The frontend cannot unilaterally transition interview state. Every action (`start`, `answer`, `pause`, `resume`, `complete`) is validated and executed server-side.
3. **Idempotency on Answer Submissions:**
   - Student answer finalization accepts an `idempotency_key` (UUID). Retries or double-clicks return the existing answer record without double-evaluating or generating duplicate questions.
4. **Offline & CI Determinism:**
   - The system MUST include a `DeterministicMockLLMProvider` allowing unit tests, API QA fuzzers, and CI quality gates (`pr_check.yml`) to pass without live internet access or external API keys.
5. **Privacy & Data Minimization:**
   - Context injected into LLM prompts is strictly bounded (maximum 1,500 tokens of candidate profile).
   - Students can review, edit, and delete their candidate profile and interview history.
