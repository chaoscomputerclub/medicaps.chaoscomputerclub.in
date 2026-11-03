# Final Implementation Backlog

This backlog is ordered by dependency. Tasks are scoped to the supplied repository. A task is complete only when its acceptance criteria and tests pass.

## EPIC 0 — Baseline and repository guardrails

### CCC-AI-0001 — Establish deterministic test environment
- Add documented disposable PostgreSQL test service and Redis test service where required.
- Configure test-only `DATABASE_URL`.
- Add guard preventing test suite from connecting to production database.
- Acceptance: backend tests start in clean environment; production DB URL is rejected.

### CCC-AI-0002 — Establish frontend baseline
- Run `npm ci`, `npm run typecheck`, `npm run build`.
- Capture existing failures separately from new regressions.
- Acceptance: baseline report stored; no unrelated refactors mixed into interview work.

### CCC-AI-0003 — Consolidate orchestration ownership
- Compare `orchestrator_service.py` and `langgraph_orchestrator.py`.
- Define one application service interface.
- Migrate callers and tests.
- Acceptance: no duplicated lifecycle authority; public API behavior unchanged unless documented.

## EPIC 1 — Persistence and migration

### CCC-AI-0101 — Add versioned interview migration
- Add columns/tables/constraints from DATA_AND_MIGRATION_SPEC.
- Include upgrade and forward-fix/rollback notes.
- Acceptance: fresh install and upgrade from current schema both pass.

### CCC-AI-0102 — Add optimistic concurrency and turn lease
- Add session version, processing lease and fencing token.
- Acceptance: concurrent workers cannot commit the same turn.

### CCC-AI-0103 — Harden idempotency
- Scope key to session, store normalized payload digest.
- Same key/same payload replays result; same key/different payload returns conflict.
- Acceptance: concurrent duplicate requests produce one answer and one evaluation.

### CCC-AI-0104 — Version plans, rubrics and reports
- Persist immutable version identifiers.
- Acceptance: historical report remains tied to original versions.

## EPIC 2 — Provider safety

### CCC-AI-0201 — Implement environment-aware LLM factory
- Explicit test/development/staging/production policy.
- No silent mock fallback in production.
- Acceptance: production startup/readiness fails closed when real provider unavailable.

### CCC-AI-0202 — Provider contract and observability
- Normalize errors, timeouts, usage and structured output validation.
- Acceptance: provider tests cover timeout, 429, 5xx, auth failure and invalid JSON.

### CCC-AI-0203 — Prompt data minimization
- Remove PRN and direct identifiers.
- Add redaction tests.
- Acceptance: prompt fixture contains no PRN/email/phone/token.

## EPIC 3 — Durable LangGraph

### CCC-AI-0301 — Replace MemorySaver
- Add persistent checkpointer compatible with pinned LangGraph.
- Acceptance: checkpoint resumes after app process restart.

### CCC-AI-0302 — Bind checkpoint to authorized session
- Server-generated thread ID; owner/session validation.
- Acceptance: cross-member checkpoint resume returns 404/403 and leaks no state.

### CCC-AI-0303 — Implement transactional turn orchestration
- Claim lease, persist answer, evaluate, commit next state.
- Acceptance: retry and worker crash do not duplicate candidate-visible turn.

### CCC-AI-0304 — Recovery/reconciliation
- Reconcile DB rows and graph checkpoint.
- Acceptance: test crash at each transition boundary.

## EPIC 4 — Lifecycle/API correctness

### CCC-AI-0401 — Canonical state machine service
- Centralize legal transitions and invariants.
- Acceptance: invalid transitions consistently return stable 409 errors.

### CCC-AI-0402 — Stable error envelope
- Add error codes and correlation IDs.
- Acceptance: frontend can distinguish retryable and terminal errors.

### CCC-AI-0403 — Owner-scoped query layer
- Verify session, question, answer, report and nested resources.
- Acceptance: cross-member tests cover every route.

### CCC-AI-0404 — Pagination and report versioning
- Stable cursor/offset ordering; immutable report versions.
- Acceptance: no duplicate/missing session list items across pages.

## EPIC 5 — Candidate profile and resume

### CCC-AI-0501 — Private resume upload pipeline
- Validate type/size, malware scan, private storage, safe parser worker.
- Acceptance: invalid/malicious/oversized files rejected.

### CCC-AI-0502 — Fact extraction and provenance
- Extract typed facts with page/section provenance and confidence.
- Acceptance: every fact maps to source.

### CCC-AI-0503 — Candidate review and consent
- UI for edit/confirm/reject and consent.
- Acceptance: unconfirmed facts never enter prompt context.

### CCC-AI-0504 — Deletion propagation
- Delete source, facts, embeddings/cache.
- Acceptance: deleted facts cannot be retrieved in later sessions.

## EPIC 6 — Voice integration

### CCC-AI-0601 — Authenticated HCVE binding
- Remove request-supplied owner authority and anonymous fallback.
- Link HCVE to interview session.
- Acceptance: all HCVE endpoints enforce owner.

### CCC-AI-0602 — Voice turn pipeline
- STT partial/final, transcript confirmation, normal answer endpoint.
- Acceptance: partial transcript never creates answer.

### CCC-AI-0603 — Barge-in and fencing
- Cancel TTS/LLM response and discard stale output.
- Acceptance: late response from previous turn cannot play or commit.

### CCC-AI-0604 — Provider verification and fallback
- Verify Sarvam account details; text fallback.
- Acceptance: provider outage does not corrupt interview state.

## EPIC 7 — Frontend completion

### CCC-AI-0701 — Reconcile frontend lifecycle with API
- Rehydrate from server; render all states.
- Acceptance: refresh during every lifecycle state restores correct screen.

### CCC-AI-0702 — Idempotent answer UX
- Stable key on retry; no new key until new answer action.
- Acceptance: double click/network retry yields one answer.

### CCC-AI-0703 — Resume workflow screens
- Upload, extraction, review, consent, delete.
- Acceptance: all API states represented.

### CCC-AI-0704 — Voice workspace
- Permission, recording, provisional/final transcript, interrupt, reconnect, text fallback.
- Acceptance: accessibility and voice integration E2E tests pass.

### CCC-AI-0705 — Evidence-linked report
- Per-question evidence, rubric explanation, practice actions.
- Acceptance: every displayed quote maps to stored answer.

## EPIC 8 — Interview content and quality

### CCC-AI-0801 — Curated catalogue audit
- Verify category registry coverage and remove duplicated constants.
- Acceptance: API is source of truth.

### CCC-AI-0802 — Role-specific plan quality
- Add versioned plans/rubrics for supported tracks.
- Acceptance: human-reviewed evaluation set meets agreed quality threshold.

### CCC-AI-0803 — Admin authoring (conditional)
- Only implement if required by product owner.
- Acceptance: immutable publish versions and audit log.

## EPIC 9 — Security, QA and release

### CCC-AI-0901 — Security tests
- IDOR, upload abuse, prompt injection, rate limit, secret redaction.
- Acceptance: all critical tests pass.

### CCC-AI-0902 — End-to-end tests
- Text full lifecycle, resume, voice, recovery, deletion.
- Acceptance: stable in CI with deterministic providers.

### CCC-AI-0903 — Load and failure tests
- Concurrent sessions, duplicate submissions, provider outage, Redis restart, app restart.
- Acceptance: agreed SLOs met under measured workload.

### CCC-AI-0904 — Production readiness review
- Backup/restore, dashboards, alerts, runbooks, rollback.
- Acceptance: release checklist signed; no open P0 findings.

## Definition of done (all tasks)

- Code reviewed and typed/linted.
- Unit and integration tests added.
- API/UI contract updated.
- Security/privacy impact reviewed.
- Metrics/logging added where operationally relevant.
- Migration and rollback path documented.
- No secrets or real candidate data in fixtures.
- Existing platform regression suite passes.
