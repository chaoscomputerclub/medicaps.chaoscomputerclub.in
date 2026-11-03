# Chaos Computer Club — Medi-Caps Chapter
# AI Interview Practice: Engineering Backlog
**Document Version:** 1.0.0  
**Format:** Epic -> Feature -> Task -> Acceptance Criteria  

---

## EPIC 00 — Discovery, Architecture & Verification
- **CCC-AI-001**: Audit repository frontend routes, React 19 / TypeScript reality, Redux store layout, and design system components.
  - *Status:* Done (Documented in `AI_INTERVIEW_ARCHITECTURE_AUDIT.md`).
- **CCC-AI-002**: Map backend FastAPI routing, asyncpg PostgreSQL engine, Redis connection singleton, and JWT authentication dependencies.
  - *Status:* Done (Documented in `AI_INTERVIEW_ARCHITECTURE_AUDIT.md`).
- **CCC-AI-003**: Inspect coding judge architecture and verify reuse boundaries with `DistributedFabricProvider` and `PracticeService`.
  - *Status:* Done (Documented in `AI_INTERVIEW_ARCHITECTURE_AUDIT.md`).
- **CCC-AI-004**: Formulate finite state machine, idempotency requirements, and candidate privacy boundaries.
  - *Status:* Done (Documented in `AI_INTERVIEW_ARCHITECTURE.md`).
- **CCC-AI-005**: Author PRD, Architecture, Test Plan, and Release Checklist.
  - *Status:* Done (All docs in `docs/ai-interview/`).

---

## EPIC 01 — Database & Session Lifecycle (Backend Core)
- **CCC-AI-101**: Define SQLAlchemy 2.0 ORM models for AI interviews.
  - *Models:* `InterviewSession`, `InterviewQuestion`, `InterviewAnswer`, `InterviewEvaluation`, `InterviewReport`, `CandidateProfile`.
  - *Files:* `backend/app/models/interview.py`, `backend/app/models/__init__.py`.
  - *Acceptance Criteria:* Clean relationships, cascaded deletes, proper foreign keys, datetime defaults.
- **CCC-AI-102**: Implement schema evolution & idempotent DDL migration in `ensure_database_integrity()`.
  - *Files:* `backend/app/core/db.py`.
  - *Acceptance Criteria:* `CREATE TABLE IF NOT EXISTS` for all 6 tables, indexes on `(session_id, order_index)`, `(member_id, state)`, `(idempotency_key)`.
- **CCC-AI-103**: Build `InterviewSessionManager` with strict state machine validation.
  - *Files:* `backend/app/services/interview/session_manager.py`.
  - *Acceptance Criteria:* Transitions enforced server-side. Unauthorized users receive `403`. Completed sessions reject edits.
- **CCC-AI-104**: Implement idempotent answer finalization.
  - *Files:* `backend/app/services/interview/session_manager.py`.
  - *Acceptance Criteria:* Submitting with identical `idempotency_key` returns existing answer record without re-evaluation.

---

## EPIC 02 — Setup, Registry & Dashboard API
- **CCC-AI-201**: Implement Category Registry & Session Configuration Schemas.
  - *Files:* `backend/app/schemas/interview.py`, `backend/app/services/interview/category_registry.py`.
  - *Acceptance Criteria:* 10 categories supported with default topics, question quotas, and rubric weights.
- **CCC-AI-202**: Implement Interview FastAPI Router & Endpoints.
  - *Files:* `backend/app/routers/interview.py`, `backend/main.py`, `backend/app/api/v1/router.py`.
  - *Endpoints:* `POST /sessions`, `GET /sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/start`, `POST /sessions/{id}/answer`, `POST /sessions/{id}/complete`, `DELETE /sessions/{id}`.
  - *Acceptance Criteria:* Authenticated with `get_current_member`. Full validation and ownership enforcement.

---

## EPIC 03 — LLM Provider Layer & Evaluation Engine
- **CCC-AI-301**: Build Resilient LLM Provider Abstraction.
  - *Files:* `backend/app/services/llm/provider.py`, `backend/app/services/llm/gemini_provider.py`, `backend/app/services/llm/mock_provider.py`.
  - *Acceptance Criteria:* Supports structured JSON extraction via Pydantic; deterministic mock provider for zero-key hermetic testing.
- **CCC-AI-302**: Build Interview Orchestrator & Adaptive Question Engine.
  - *Files:* `backend/app/services/interview/orchestrator_service.py`.
  - *Acceptance Criteria:* Dynamically formulates question plan, asks 1 question at a time, checks answer completeness, triggers follow-ups.
- **CCC-AI-303**: Build Evidence-Based Evaluation & Report Generator.
  - *Files:* `backend/app/services/interview/evaluation_service.py`.
  - *Acceptance Criteria:* Produces rubric scores (0-100), extracts quotes as evidence, flags gaps, creates model answers and practice recommendations.

---

## EPIC 04 — Frontend State & UI Workspace (Text MVP)
- **CCC-AI-401**: Build Redux Interview Slice & API Client.
  - *Files:* `src/store/slices/interviewSlice.ts`, `src/store/index.ts`, `src/features/interview/api.ts`.
  - *Acceptance Criteria:* Normalized state for sessions, active session, transcript items, report, loading/error states.
- **CCC-AI-402**: Build Interview Dashboard Page.
  - *Files:* `src/pages/InterviewDashboardPage.tsx`, `src/organization/components/PortalShell.tsx`.
  - *Acceptance Criteria:* Nav link in PortalShell, CTA to create interview, active session banner, history table, topic trends.
- **CCC-AI-403**: Build Interview Configuration Modal.
  - *Files:* `src/features/interview/components/InterviewConfigModal.tsx`.
  - *Acceptance Criteria:* Configures role, level, category, difficulty, duration, topics, job description. Validates before submit.
- **CCC-AI-404**: Build Interactive Text Interview Workspace.
  - *Files:* `src/pages/InterviewWorkspacePage.tsx`.
  - *Acceptance Criteria:* Timer, active question card, chronological transcript, answer composer with keyboard shortcut (`Cmd+Enter`), pause/resume, complete button.
- **CCC-AI-405**: Build Coaching & Feedback Report Page.
  - *Files:* `src/pages/InterviewReportPage.tsx`.
  - *Acceptance Criteria:* Score badge, executive summary, dimension bars, per-question evidence cards, model answers, recommended practice.

---

## EPIC 05 — Specialized Tracks (Coding, System Design, Behavioral)
- **CCC-AI-501**: Coding Interview Workspace with Monaco Editor & CCC Judge Integration.
  - *Files:* `src/features/interview/components/CodingWorkspacePanel.tsx`, `backend/app/services/interview/coding_harness.py`.
  - *Acceptance Criteria:* Split-pane layout, code execution against visible testcases via `PracticeService`, actual judge verdict parsed by AI.
- **CCC-AI-502**: System Design & Behavioral Track Custom Rubrics.
  - *Acceptance Criteria:* Track-specific rubrics (STAR method for behavioral, architecture & scalability for system design).

---

## EPIC 06 — Testing, Verification & Hardening
- **CCC-AI-601**: Backend Unit & Integration Tests.
  - *Files:* `backend/tests/test_ai_interview.py`.
  - *Acceptance Criteria:* Tests session creation, state transitions, idempotency, evaluation synthesis, ownership rejection.
- **CCC-AI-602**: Frontend Typecheck & Build Verification.
  - *Command:* `npm run typecheck && npm run build`.
  - *Acceptance Criteria:* 0 TypeScript errors, production bundle compiles cleanly.
