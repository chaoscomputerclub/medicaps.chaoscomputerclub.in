# 08 — Testing and Acceptance Criteria

## 1. Repository regression

- Existing routes, authentication, sidebar, and unrelated product features continue to work.
- Existing design tokens and components are reused where possible.
- No unrelated framework or database migration is introduced.

## 2. Catalog and UX

- Catalog displays only published interviews.
- Technical and other-round categories render correctly.
- Empty categories do not render broken placeholders.
- No candidate custom-interview creation entry point exists.
- Every visible Practice action maps to a real published interview.
- Candidate can start without a resume.
- Track detail shows accurate public metadata.

## 3. Resume pipeline

- Valid PDF and DOCX can be uploaded.
- Invalid, oversized, encrypted, and malformed files fail safely.
- Processing status is visible.
- Retry is idempotent.
- Extracted facts include provenance.
- Embeddings are scoped to the owner.
- Resume claims do not directly increase verified competency.
- Resume failure does not block no-resume practice.

## 4. Blueprint and graph

- Published graph is immutable.
- Session pins blueprint version.
- Invalid graph cannot publish.
- Unreachable required nodes and unbounded cycles are rejected.
- Runtime cannot select a node outside the pinned graph.
- Session state changes do not mutate blueprint data.

## 5. Adaptive runtime

- Initial state is deterministic for the same blueprint and runtime configuration.
- Candidate response is persisted before state advances.
- Evaluator output is schema-validated.
- Node selection respects prerequisites and completion policy.
- Rules-based fallback works when learned models are unavailable.
- Question-generation failure uses an approved fallback.
- Every score links to evidence and rubric criteria.
- Predictions, if enabled, are labeled separately from observed performance.

## 6. Security

- Candidate A cannot access Candidate B's resume, vectors, sessions, or reports.
- Candidate cannot call admin endpoints.
- Resume prompt injection cannot alter system/blueprint instructions.
- Upload and model endpoints are rate limited.
- Sensitive data is excluded from standard logs.

## 7. Performance and operational tests

Set targets after measuring the existing deployment. Suggested initial service objectives:
- Catalog API p95 under 500 ms under expected load.
- Session creation p95 under 3 seconds excluding model generation.
- Resume processing status endpoint p95 under 500 ms.
- No duplicate response evaluation for repeated idempotency key.
- Graceful degradation when LLM or vector provider is unavailable.

These are proposed targets, not claims about current system performance.

## 8. Release gate

Do not release until:
- All P0 backlog items pass.
- Candidate can complete a full no-resume interview.
- Candidate can complete a full resume-context interview.
- Published blueprint immutability is verified.
- Tenant isolation tests pass.
- Report provenance and version metadata are present.
- Existing application regression suite passes.
