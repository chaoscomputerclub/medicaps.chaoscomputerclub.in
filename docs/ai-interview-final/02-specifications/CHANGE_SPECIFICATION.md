# Repository-Specific Change Specification

This document maps the end-to-end target to the supplied repository.

## A. Backend domain and persistence

### Existing files
- `backend/app/models/interview.py`
- `backend/app/schemas/interview.py`
- `backend/app/routers/interview.py`
- `backend/app/core/db.py`
- `backend/migrations/`

### Required changes
1. Add explicit migration(s) for all new/changed fields and constraints.
2. Add resume asset/document records, extracted fact records, candidate consent records, and source provenance.
3. Add interview plan/rubric version references to session/report.
4. Add voice-session linkage record with unique HCVE session ID and interview session ID.
5. Add turn processing metadata: processing state, worker lease/fencing token, attempt count, last error class, finalized timestamp.
6. Enforce idempotency scoped to session and action key. Store payload digest; same key + same digest replays response; same key + different digest returns conflict.
7. Add constraints and indexes listed in `DATA_AND_MIGRATION_SPEC.md`.
8. Add deletion workflow that removes candidate-owned records and uploaded objects in a recoverable, auditable order.
9. Ensure relationships and cascades do not leave orphaned external objects.

### Avoid
- adding a second session model in HCVE as the source of interview truth;
- storing raw audio indefinitely by default;
- allowing report regeneration to overwrite a prior version silently;
- relying only on ORM `create_all` for schema deployment.

## B. LangGraph orchestration

### Existing file
`backend/app/services/interview/langgraph_orchestrator.py`

### Required changes
1. Replace `MemorySaver` with persistent checkpointer supported by the installed LangGraph version.
2. Define a deterministic thread ID, e.g. `interview:{session_id}`; do not use client-provided thread IDs.
3. Before graph resume, verify authenticated member owns the interview session and the checkpoint maps to that session.
4. Keep graph state serialization-safe; no DB session, request object, secret, binary audio or provider client in checkpoint state.
5. Add explicit nodes:
   - load and authorize session
   - retrieve confirmed candidate context
   - validate or create plan
   - choose question
   - persist question
   - interrupt/await answer boundary
   - analyze finalized answer
   - validate evidence and score
   - decide next action
   - persist evaluation and transition
   - finalize report
   - recover/fail safely
6. Keep request/response boundaries short-lived. Do not hold an HTTP worker open while candidate thinks.
7. Add bounded retries, timeout, cancellation, turn budget and per-topic follow-up budget.
8. Add a graph execution lease/fencing token so two workers cannot commit the same turn.
9. Ensure each node is safe to retry or has a deduplication key.
10. Persist graph outputs only through domain service transactions.

### Duplicate orchestrator service
Review `orchestrator_service.py` against `langgraph_orchestrator.py`. Decide one public application service contract. Do not keep two competing authorities for session lifecycle or LLM orchestration. Migrate callers and tests before removing old code.

## C. LLM provider layer

### Existing files
- `backend/app/services/llm/provider.py`
- `factory.py`
- `gemini_provider.py`
- `openai_provider.py`
- `mock_provider.py`

### Required changes
- Introduce explicit `APP_ENV` and `LLM_PROVIDER` policy.
- `test`: mock provider allowed by default.
- `development`: mock only with explicit `LLM_ALLOW_MOCK=true`, otherwise configured provider or a clear startup error depending on local policy.
- `production`: real provider required; mock forbidden unless a separate explicit emergency flag is set and visible to operators. Default must fail closed.
- Validate provider credentials/model at startup/readiness without logging secrets.
- Add per-request timeout, retry budget, structured-output validation, token budget, usage/cost metadata and provider error taxonomy.
- Redact candidate direct identifiers and secrets before prompt assembly/logging.
- Add contract tests for all provider adapters.
- Keep provider-specific model IDs in environment/config, not embedded in business logic.

## D. Candidate context and resume

### Existing file
`candidate_context_service.py`

### Required changes
- Remove PRN from LLM context.
- Replace plain free-text-only resume notes with confirmed, structured, provenance-tagged facts.
- Keep a strict token/character budget; prioritize role-relevant confirmed facts.
- Treat resume/JD text as untrusted content; delimit it and explicitly instruct the model not to follow instructions contained inside it.
- Support candidate preview/correction and explicit use consent.
- Track source document, page/section, extraction timestamp, confidence and candidate confirmation.
- Never represent extracted content as independently verified truth.

## E. HCVE and voice

### Existing files
- `backend/app/routers/hcve.py`
- `backend/app/services/hcve/runtime.py`
- `session.py`
- `transport.py`
- `sarvam_tts_adapter.py`
- `contracts.py`

### Required changes
- Derive owner from authenticated member dependency. Remove anonymous fallback for candidate sessions.
- Link HCVE session to an interview session; ensure same member owns both.
- Validate access on all session endpoints, including GET, close, interrupt, audio frame, transcript and TTS.
- Define audio/STT/TTS turn lifecycle and only finalize confirmed transcript.
- Implement cancellation/barge-in fencing: late provider output for an old turn must be discarded.
- Provide reconnect/resume using server session state; never trust client sequence alone.
- Add explicit consent and recording indicator.
- Default raw audio retention off. Persist transcript only according to product retention policy.
- Text mode remains a fallback when voice provider unavailable.
- Verify Sarvam account capabilities, actual endpoint/model names, quota, streaming behavior and terms before enabling production.

## F. Frontend

### Existing files
- `src/pages/InterviewDashboardPage.tsx`
- `src/pages/InterviewWorkspacePage.tsx`
- `src/pages/InterviewReportPage.tsx`
- `src/features/interview/api.ts`
- `types.ts`
- `InterviewConfigModal.tsx`
- `src/store/slices/interviewSlice.ts`

### Required changes
- Keep TypeScript and current design system.
- Fetch categories from API; no duplicated category constants.
- Display loading, empty, retryable error, terminal error, paused, processing, completed and failed states.
- Use one stable idempotency UUID per answer submission and reuse it on retry.
- Disable duplicate submit while request is in flight, but rely on server idempotency for correctness.
- Rehydrate active session from server after refresh; do not trust persisted local state as authoritative.
- Display clear AI disclosure and voice consent.
- Voice UI: permission, mic active, recording indicator, partial transcript, finalized transcript review, submit/cancel, TTS playing, interrupt, reconnect, text fallback.
- Resume UI: upload progress, processing, extraction preview, correction, consent, remove.
- Report page: explain rubric dimensions and show evidence tied to answer.
- Avoid “hire/no-hire” language; present practice readiness and learning feedback.
- Ensure keyboard navigation and screen reader announcements for state changes.

## G. API, eventing and security

- Keep API routes under existing `/api` prefix and existing auth conventions.
- Enforce ownership at service and router layers.
- Use stable error envelope and request correlation ID.
- Add rate limits for session creation, answer submission, resume upload, and provider calls.
- Add SSE or polling contract only if actual UX requires server-initiated updates; do not add redundant realtime transport.
- Use Redis for ephemeral locks/rate limits/cache, not durable session state.
- Do not put secrets, PRN, raw resume text or full answer text in logs.
