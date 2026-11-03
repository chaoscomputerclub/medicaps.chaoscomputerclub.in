# Interview Arena — Implementation Gap Report
**Document ID:** CCC-AI-GAP-001  
**Author:** Antigravity Zero-Hallucination Engineering  
**Baseline Commit Version:** 1.4.4  
**Date:** 2026-11-03  

---

## 1. Executive Summary

This report establishes the baseline discovery and architectural comparison between the current repository implementation and the authoritative requirements specified in `Interview_Arena_Implementation_Requirements.zip`.

The platform's goal is to turn the AI Interview Arena into a **streamlined, published track practice catalog** where:
1. **Candidates do NOT create or configure custom interviews.**
2. **All tracks, graph structures, node instructions, rubrics, and transition rules are platform-authored, versioned, and immutable.**
3. **Candidates simply select a published track (e.g. Backend, Frontend, DSA, System Design, HR) and practice.**
4. **Resume upload is purely optional personalization context; it never alters graph topology or certifies competency.**
5. **Existing working backend services, models, and UI tokens must be reused and extended incrementally without speculative rewrites.**

---

## 2. Existing Repository State (Reconnaissance)

### 2.1 Backend Architecture
- **Language / Framework:** Python 3.12, FastAPI, SQLAlchemy 2.0 (asyncio + asyncpg), PostgreSQL 16, Redis 7.
- **Routing:** Mounted under `/api/v1/interview` via `backend/app/routers/interview.py`.
- **Existing Models (`backend/app/models/interview.py`):**
  - `InterviewSession`: Session lifecycle (`CREATED`, `PREPARING`, `ASKING`, `EVALUATING`, `PAUSED`, `COMPLETED`, `ABANDONED`, `FAILED`), version pinning, score tracking.
  - `InterviewQuestion`: Stored question instances with difficulty, question type, prompt, starter code.
  - `InterviewAnswer`: Submitted answers with idempotency keys.
  - `InterviewEvaluation`: Turn evaluation with rubric scores, strengths, gaps, evidence quotes, and model answers.
  - `InterviewReport`: Executive summary, dimensional breakdowns, top strengths, areas to improve, practice items.
  - `CandidateProfile`, `CandidateResumeAsset`, `CandidateResumeFact`, `CandidateConsent`, `InterviewVoiceLink`: Provenance-tracked resume parsing, consent, and HCVE voice binding.
- **Existing Services (`backend/app/services/interview/`):**
  - `langgraph_orchestrator.py`: Durable disk-checkpointer, session state transitions, turn evaluation, report synthesis, voice binding.
  - `category_registry.py`: Curated category metadata dictionary (`TECHNICAL`, `CODING`, `DSA`, `SYSTEM_DESIGN`, `BACKEND`, `FRONTEND`, `DEVOPS`, `DATABASE_SQL`, `BEHAVIORAL`, `MIXED`).
  - `competency_taxonomy.py`: Versioned competency graph with prerequisites.
  - `adaptive_selector.py`: Adaptive next-question selection utility.
  - `bkt_engine.py` & `irt_engine.py`: Bayesian Knowledge Tracing and Item Response Theory estimators.
  - `candidate_context_service.py`: Candidate context and resume provenance link.

### 2.2 Frontend Architecture
- **Framework:** React 19, TypeScript, Vite 8, Redux Toolkit, Tailwind CSS v4, Radix UI Primitives.
- **Pages & Components:**
  - `src/pages/InterviewDashboardPage.tsx`: Metric cards, track categories, and historical sessions table. Currently includes "New Interview" modal launcher.
  - `src/pages/InterviewWorkspacePage.tsx`: Full turn stream, Monaco code/text editor, live voice STT and barge-in playback, turn-level stable idempotency key.
  - `src/pages/InterviewReportPage.tsx`: Evidence-linked turn audit, dimensional competency breakdown, positive readiness milestones, dossier regeneration.
  - `src/features/interview/components/ResumeManagerModal.tsx`: Complete resume upload, consent, fact review, and deletion modal.
  - `src/features/interview/components/InterviewConfigModal.tsx`: Candidate custom-interview configuration wizard (to be replaced with published track practice).
  - `src/store/slices/interviewSlice.ts`: Complete async thunks and synchronous actions.

---

## 3. Gap Analysis Matrix

| Requirement Area | Specification Requirement | Current Repository State | Gap & Action Plan |
| :--- | :--- | :--- | :--- |
| **Database-Driven Domain Catalog** | Domains & blueprints persisted in PostgreSQL relational tables (`interview_domains`, `interview_blueprints`, `interview_blueprint_versions`). Dynamic DB addition immediately appears in catalog. | Catalog loaded from in-memory pre-seeded dictionary in `blueprint_registry.py`. | **Gap 1 (P0):** Create relational entities for `InterviewDomain`, `InterviewBlueprintModel`, `InterviewBlueprintVersionModel`, `InterviewDomainDataset`. Persist blueprints to DB and make catalog query DB with cached fallback. |
| **Catalog & Candidate Flow** | Candidates browse published tracks; **NO custom-interview creation**. | "New Interview" button removed; direct practice cards active with blueprint details dialog. | **Resolved:** Verified in `InterviewDashboardPage.tsx`. |
| **Admin Training & Publishing Workflow** | Admin endpoints for domain creation, draft blueprint authoring, graph validation, dataset generation, gold evaluation, and immutable publish. | Pre-seeded static registry only. No admin API for dynamic authoring/publishing. | **Gap 2 (P0):** Implement `/api/admin/domains` and `/api/admin/blueprints` router with role-gated endpoints for validation, dataset creation, judge calibration, and publishing. |
| **Dataset & Judge Calibration Harness** | Synthetic examples, gold-set validation, adversarial tests, judge-vs-gold evaluation reports. | Unit tests in `test_interview_blueprints.py` and `test_ai_interview.py`. | **Gap 3 (P1):** Implement dataset generation and evaluation harness (`DatasetHarnessService`) with structured JSONL schemas and agreement metrics. |
| **Candidate API Surface Aliasing** | Standard paths matching spec: `/api/interview-domains`, `/api/interviews/{slug}`, `/api/interview-sessions`. | Mounted under `/interview/tracks` and `/interview/sessions`. | **Gap 4 (P0):** Add direct top-level route aliases matching `08_IMPLEMENTATION_ARCHITECTURE_AND_APIS.md` so all client conventions succeed. |
| **Runtime Inference & No-Key Invariant** | Server-side inference without candidate keys; rubric-grounded judge; fallback question bank on LLM outage. | `MockLLMProvider` and existing LLM factory; fallback questions embedded in blueprint nodes. | **Gap 5 (P0):** Ensure judge evaluation schema adheres strictly to criterion bounds [0, 4], extracts verbatim evidence quotes, and defends against prompt injection. |
| **Session Creation API** | `POST /api/interview-sessions` accepting `interview_slug` and optional `resume_id`. | `POST /interview/sessions` requires `InterviewConfigCreate` (role, category, difficulty, duration). | **Gap 4 (P0):** Update `create_interview_session` to accept `interview_slug` + optional `resume_id`, resolving and pinning the active published blueprint version. Keep backward compatibility. |
| **Graph Integrity Validator** | Validation of node uniqueness, reachability, entry/terminal nodes, bounded cycles before publishing. | Not formally centralized in a graph validator module. | **Gap 5 (P0):** Implement `BlueprintGraphValidator` with deterministic checks for node reachability, acyclic/bounded paths, and fallback questions. |
| **Pre-Seeded Catalog** | 13 Published Tracks: Frontend, Backend, Python, Java, C++, DSA, Database, ML, AI/LLM, DevOps, System Design, HR, Behavioral. | Categories exist, but structured blueprints with nodes and rubrics are unseeded. | **Gap 6 (P0):** Create production seed definitions for all 13 tracks with curated learning objectives, rubrics, and fallback questions. |
| **Optional Resume Integration** | Resume personalizes retrieval context; does not mutate graph or certify skills. | Candidate context service already links facts; requires clear unverified claim boundary. | **Gap 7 (P1):** Ensure resume claims are strictly passed as untrusted candidate context to node prompts, never increasing verified rubric scores directly. |

---

## 4. Smallest Safe Implementation Plan (No-Rewrite Principle)

1. **Epic 1: Track Catalog & Published Blueprints (Backend)**
   - Implement `backend/app/services/interview/blueprint_registry.py`:
     - Model versioned blueprints, nodes (`question`, `assessment`, `terminal`), edges, and completion policies.
     - Implement `BlueprintGraphValidator` enforcing schema, reachability, and fallbacks.
     - Pre-seed 13 comprehensive published blueprints for all tracks.
   - Update `backend/app/schemas/interview.py`:
     - Add `InterviewTrackSummary`, `InterviewTrackDetail`, and `SessionCreateBySlug` schemas.
   - Update `backend/app/routers/interview.py`:
     - Add `GET /interview/tracks` and `GET /interview/tracks/{slug}`.
     - Enhance `POST /interview/sessions` to support `{ "interview_slug": slug, "resume_id": optional }`.
2. **Epic 2: Candidate Catalog Experience (Frontend)**
   - Update `src/features/interview/types.ts` & `src/features/interview/api.ts`:
     - Add track list and detail API calls.
   - Overhaul `src/pages/InterviewDashboardPage.tsx`:
     - Remove "New Interview" custom builder button.
     - Render Technical Tracks grid (Frontend, Backend, Python, Java, C++, DSA, Database, ML, AI/LLM, DevOps, System Design) with clear "Practice" CTA.
     - Render Other Rounds grid (HR, Behavioral).
     - Wire single-click "Practice" action to create session from track slug + optional uploaded resume.
     - Retain Telemetry Metric cards, Resume Intelligence button/modal, and History table.
3. **Epic 3: Session Graph Execution & Pinned Versioning**
   - In `LangGraphInterviewOrchestrator`:
     - Pin `blueprint_id` and `blueprint_version` upon session creation.
     - Initialize session node state from blueprint entry node.
     - Execute node questions and transitions according to authored edges.
4. **Epic 4: Verification & Deliverables**
   - Run full unit/integration tests with `pytest`.
   - Run type checks (`tsc --noEmit`) and Vite production build (`npm run build`).
   - Document `IMPLEMENTATION_STATUS.md`.

