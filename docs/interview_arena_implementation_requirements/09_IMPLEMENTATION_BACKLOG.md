# 09 — Implementation Backlog

Priorities: **P0** blocks core release; **P1** important; **P2** follow-up.

## Epic 0 — Repository discovery and baseline

- [ ] P0 Inspect repository structure, framework versions, route map, auth, database, storage, queue, and existing interview implementation.
- [ ] P0 Run existing application and reproduce the broken Interview Arena flow.
- [ ] P0 Identify reusable components, existing API contracts, and current data model.
- [ ] P0 Produce a gap report mapping current implementation to this specification.
- [ ] P0 Add/confirm regression tests before modifying existing behavior.

**Acceptance:** Agent can explain the current flow and proposes the smallest safe implementation plan. No rewrite has occurred.

## Epic 1 — Published interview catalog

- [ ] P0 Define interview definition and published blueprint metadata schema.
- [ ] P0 Seed initial published catalog entries for available tracks.
- [ ] P0 Add catalog/category/detail APIs.
- [ ] P0 Replace empty/hardcoded frontend track area with API-driven cards.
- [ ] P0 Remove candidate-facing custom interview creation action.
- [ ] P0 Add loading, empty, and error states.

**Acceptance:** Candidate can browse and select real published tracks.

## Epic 2 — Blueprint registry and validation

- [ ] P0 Define versioned blueprint, node, edge, and competency contracts.
- [ ] P0 Implement schema and graph integrity validator.
- [ ] P0 Enforce immutable published versions.
- [ ] P0 Implement active-version lookup and session pinning.
- [ ] P1 Add admin draft/publish endpoints or secure authoring workflow.
- [ ] P1 Add simulation/test fixtures for authored graph paths.

**Acceptance:** Runtime can load only valid published blueprint versions.

## Epic 3 — Candidate session flow

- [ ] P0 Implement session creation from interview slug only, plus optional resume ID.
- [ ] P0 Initialize per-session graph state.
- [ ] P0 Implement first eligible node selection.
- [ ] P0 Return first question and session state.
- [ ] P0 Implement response submission and persistence.
- [ ] P0 Implement session resume after page refresh.
- [ ] P0 Implement completion and report snapshot.

**Acceptance:** Candidate completes an interview without configuring a custom interview.

## Epic 4 — Question and evaluation runtime

- [ ] P0 Implement node-constrained question generation.
- [ ] P0 Implement strict output schemas and question validation.
- [ ] P0 Implement rubric-based structured evaluation.
- [ ] P0 Persist evidence and criterion-level results.
- [ ] P0 Implement deterministic rules-based adaptive selector.
- [ ] P0 Implement approved fallback questions.
- [ ] P1 Add model-based ranking behind a feature flag after offline evaluation.

**Acceptance:** Every question and transition is traceable to a node in the pinned blueprint.

## Epic 5 — Resume intelligence

- [ ] P1 Implement secure PDF/DOCX upload.
- [ ] P1 Implement asynchronous processing job and status API.
- [ ] P1 Implement Python extraction and section classification.
- [ ] P1 Normalize extracted skills/projects/experience to taxonomy.
- [ ] P1 Store candidate evidence with provenance.
- [ ] P1 Chunk resume and generate embeddings.
- [ ] P1 Implement candidate-scoped retrieval with metadata filters.
- [ ] P1 Add resume context to question generation without changing graph topology.
- [ ] P1 Implement retry, failure, and degraded-mode behavior.
- [ ] P1 Implement deletion/retention workflow.

**Acceptance:** Resume can personalize questions while the same published blueprint remains in use.

## Epic 6 — Results and history

- [ ] P0 Implement session history API and UI.
- [ ] P0 Implement report generation from persisted evidence.
- [ ] P0 Show competency outcomes and actionable feedback.
- [ ] P1 Show progress trends across sessions with version-aware comparisons.
- [ ] P1 Clearly distinguish observed results from resume claims and predictions.

**Acceptance:** Candidate can inspect prior completed sessions and understand the basis of feedback.

## Epic 7 — Security, reliability, and operations

- [ ] P0 Enforce candidate ownership for all resources.
- [ ] P0 Enforce admin role for authoring/publishing.
- [ ] P0 Add idempotency to response and processing jobs.
- [ ] P0 Add rate limits, upload validation, and safe error handling.
- [ ] P0 Add structured metrics and redacted logs.
- [ ] P0 Test cross-candidate data isolation.
- [ ] P1 Add model/prompt/blueprint version observability.
- [ ] P1 Add retry queues and dead-letter inspection.

**Acceptance:** Core flows survive transient failures without corrupting graph or session state.

## Suggested delivery sequence

1. Epic 0.
2. Epics 1 and 2.
3. Epics 3 and 4 using rules-based adaptation.
4. Epic 6.
5. Epic 5.
6. Epic 7 hardening and P1 learned-model rollout.

Do not block the core no-resume interview flow on resume intelligence or advanced ML.
