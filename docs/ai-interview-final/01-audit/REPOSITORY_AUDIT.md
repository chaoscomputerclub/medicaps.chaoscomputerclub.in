# Repository Audit — Supplied `medicaps-code.zip`

## 1. Executive result

The repository is not a blank project. It contains a substantial first implementation of AI Interview Practice. The work is therefore an integration and hardening program, not a greenfield build.

The source archive includes the following relevant implementation:

| Area | Existing repository evidence | Audit conclusion |
|---|---|---|
| Frontend | `src/pages/InterviewDashboardPage.tsx`, `InterviewWorkspacePage.tsx`, `InterviewReportPage.tsx`, `src/features/interview/*`, `src/store/slices/interviewSlice.ts` | Core screens and client state exist. Verify all controls against server lifecycle and error states. |
| API | `backend/app/routers/interview.py`, `backend/app/schemas/interview.py` | Interview category/session lifecycle endpoints and typed schemas exist. |
| Persistence | `backend/app/models/interview.py` | Session, question, answer, evaluation, report, candidate profile ORM entities exist. |
| Orchestration | `backend/app/services/interview/langgraph_orchestrator.py` | LangGraph graph and typed state exist. |
| Alternate orchestration | `backend/app/services/interview/orchestrator_service.py` | A second orchestration service exists; consolidate responsibilities and remove ambiguous duplicate ownership. |
| Candidate context | `candidate_context_service.py` | Bounded context construction exists; currently includes PRN and accepts free-text resume notes/JD. |
| Categories | `category_registry.py` | Curated category metadata exists. |
| LLM | `backend/app/services/llm/*` | Provider interface, Gemini, OpenAI-compatible and deterministic mock adapters exist. |
| Voice | `backend/app/services/hcve/*` | HCVE session/runtime/transport/expression and TTS adapters exist. |
| Sarvam | `sarvam_tts_adapter.py` | TTS adapter exists; not proof of complete speech-to-speech interview support. |
| Tests | `backend/tests/test_ai_interview.py`, `backend/tests/hcve/*` | Domain and voice tests exist. Must expand for persistence, restart recovery, ownership, concurrency and true integration. |
| Existing docs | `docs/ai-interview/*`, `docs/ai-interview-v2/*`, `docs/hcve/*` | Several earlier documents exist. Some statements conflict with the supplied code and are superseded by this audit. |

## 2. Corrections to older repository documentation

The older `docs/ai-interview/AI_INTERVIEW_ARCHITECTURE_AUDIT.md` says there was no LLM provider layer, no interview models, and no audio pipeline. Those statements are stale relative to the supplied archive. The current repository contains all three to varying degrees.

The older audit also describes the frontend as React/TypeScript correctly, but earlier planning elsewhere assumed JSX. The source reality is TypeScript; all new code must match it.

## 3. Critical gaps to close

### P0 — release blockers

1. **In-memory LangGraph checkpointing**
   - Current code imports `MemorySaver` and creates a module-level `_LANGGRAPH_CHECKPOINTER`.
   - This is not durable across process restart, deployment replacement, or worker reassignment.
   - Replace with a supported persistent checkpointer backed by PostgreSQL (or a repository-approved durable implementation). Use a stable thread key derived from the interview session and verify owner/session binding at the application layer.

2. **Unsafe production provider fallback**
   - `get_llm_provider()` silently returns `DeterministicMockLLMProvider` when no configured real provider is found.
   - Introduce explicit environment modes: `development`, `test`, `production`.
   - In production, fail startup/readiness if a required real provider is missing or if configured provider initialization fails. Mock must require explicit opt-in and must be visibly marked as simulated in the UI/API.

3. **Voice identity and ownership boundary**
   - HCVE session creation accepts caller-supplied `owner_id` or `anon_user`.
   - Candidate-facing voice must derive owner from authenticated server context, not request body. Link the voice session to the interview session and verify both on every read, close, interrupt, and media operation.

4. **Candidate prompt data minimization**
   - `CandidateContextService.build_bounded_context()` currently includes `member.prn`.
   - Remove PRN and all direct identifiers. Use internal opaque IDs only for database joins; never place them in prompts.

5. **Durable schema evolution**
   - Interview models exist, but the feature needs explicit migration coverage, uniqueness constraints, indexes, and deployment-safe migration/rollback instructions.
   - Runtime `create_all`/idempotent DDL must not be the only release mechanism for new interview schema changes.

6. **Answer idempotency and race handling**
   - A unique `idempotency_key` exists in the answer model and request schema.
   - Verify atomic transaction behavior for concurrent duplicate submissions, key scope, payload mismatch, and response replay. A uniqueness constraint alone does not provide a complete idempotency contract.

7. **Test database and integration execution**
   - The first attempted backend test invocation was blocked because a valid test `DATABASE_URL` was not configured in the execution environment.
   - No claim is made that the full test suite passes. Add isolated test database provisioning and ensure tests cannot target production.

### P1 — complete product gaps

- Resume upload, malware/type/size validation, parsing, structured extraction, user review/correction, provenance, versioning, retention and deletion.
- A single interview lifecycle authority across API service, LangGraph and frontend.
- Structured event/status contract for asynchronous work and reconnect.
- Complete voice turn integration: capture, STT finalization, text confirmation, answer submission, TTS, interruption, reconnect, and fallback.
- Report consistency and rubric versioning.
- Admin-authorable and versioned interview catalogue if the product requires staff-managed content.
- Coding track integration only after sandbox boundary and judge result contracts are audited.
- End-to-end accessibility and failure-state verification.

## 4. Existing implementation boundaries to preserve

- Keep FastAPI and existing auth dependency conventions.
- Keep SQLAlchemy async session patterns and PostgreSQL.
- Keep existing Redis service for ephemeral coordination, rate limits and event fanout where justified.
- Keep existing React/TypeScript routes, Redux Toolkit, API client, and visual primitives.
- Keep LLM provider adapters behind the existing provider abstraction.
- Keep HCVE as a modular voice subsystem behind stable contracts; do not create an independent identity store.
- Keep existing judge execution isolated from API process.

## 5. Files to inspect/change first

| File | Change |
|---|---|
| `backend/app/services/interview/langgraph_orchestrator.py` | Replace MemorySaver, remove prompt identifiers, make transitions/retries durable and deterministic. |
| `backend/app/services/llm/factory.py` | Explicit environment policy; no silent mock in production. |
| `backend/app/services/interview/candidate_context_service.py` | Remove PRN; structured, provenance-aware and consent-filtered context. |
| `backend/app/routers/hcve.py` | Authenticated ownership; link HCVE session to interview session; reject caller-supplied owner. |
| `backend/app/services/hcve/session.py` | Durable/expiring session contract; ownership metadata and state transitions. |
| `backend/app/services/hcve/runtime.py` | Cancellation, fencing, final transcript and adapter error handling. |
| `backend/app/models/interview.py` | Add resume assets/facts/consent, rubric/plan versioning, voice link and operational fields as needed. |
| `backend/app/core/db.py` and `backend/migrations/` | Versioned schema migration and safe startup behavior. |
| `backend/app/routers/interview.py` | API contract consistency, concurrency control, report and profile endpoints. |
| `src/features/interview/*`, `src/pages/Interview*`, `src/store/slices/interviewSlice.ts` | Align UI with authoritative API states, errors, retries, voice and resume workflows. |

## 6. What this audit does not establish

- It does not prove current production deployment health.
- It does not prove Sarvam account quotas, model names, endpoints or streaming behavior.
- It does not prove all test suites pass.
- It does not prove the current DB has the same schema as the ORM models.
- It does not prove all UI controls are fully connected.
- It does not prove candidate code execution is safe for interview use.

These items require execution against the actual deployment, provider account and configured test infrastructure.
