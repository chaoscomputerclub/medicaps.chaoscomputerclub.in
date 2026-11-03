# 10 — Coding Agent Execution Guide

## Mission

Implement the requirements in this pack in the existing repository. The goal is a working end-to-end Interview Arena, not a fresh scaffold or a speculative rewrite.

## Mandatory rules

1. **Inspect before editing.** Map the repository, runtime, routes, auth, persistence, queues, storage, frontend components, and existing interview code.
2. **Do not start from scratch.** Reuse existing code and open-source libraries where appropriate. Integrate selectively; do not copy large projects blindly.
3. **Do not replace the stack** without a written, evidence-based proposal and approval.
4. **Do not build candidate custom interviews.** There is no custom-interview builder or arbitrary candidate configuration.
5. **Treat interview definitions as admin-authored.** Candidate can only select published tracks.
6. **Keep UI simple.** Preserve existing design system and avoid unnecessary screens.
7. **Keep blueprints immutable after publish.** Runtime state is session-specific.
8. **Resume is optional.** No-resume practice must work independently.
9. **Do not claim ML capabilities that are not implemented and validated.** Start with deterministic rules where needed; add learned algorithms behind flags only after evaluation.
10. **Do not expose internal prompts, rubrics, graph editor, or model configuration to candidates.**
11. **Do not silently remove existing features.** Identify conflicts and preserve behavior unless the specification explicitly changes it.
12. **Test each vertical slice.** Include unit, integration, and frontend tests as appropriate.

## Execution protocol

### Phase 1 — Discovery
- Inspect all relevant source files.
- Run the application and reproduce current behavior.
- Identify existing interview endpoints and schemas.
- Identify existing LLM, embedding, graph, and queue integrations.
- Write `IMPLEMENTATION_GAP_REPORT.md` with file paths and evidence.

### Phase 2 — Plan
- Produce a task plan with dependencies.
- Identify migrations and rollback plan.
- Define API contracts and state transitions before wiring UI.
- Confirm which existing libraries/services can be reused.

### Phase 3 — Incremental implementation
Implement one vertical slice at a time:
1. Catalog API + frontend catalog.
2. Published blueprint registry and validation.
3. Session creation + first question.
4. Response + evaluation + adaptive transition.
5. Completion + report + history.
6. Optional resume ingestion and retrieval.
7. Admin authoring/publishing and operational hardening.

Do not implement all layers as disconnected placeholders.

### Phase 4 — Verification
- Run formatting, lint, type checks, unit tests, integration tests, and build.
- Exercise full no-resume candidate flow.
- Exercise resume upload and personalized flow.
- Test candidate isolation and admin authorization.
- Verify published blueprint immutability and session version pinning.
- Record known limitations and unimplemented requirements honestly.

## Required deliverables

- `IMPLEMENTATION_GAP_REPORT.md`
- Updated source code and migrations.
- API documentation or updated OpenAPI schema.
- Tests for all critical paths.
- Updated environment variable example without secrets.
- Deployment/worker instructions if new background processing is added.
- `IMPLEMENTATION_STATUS.md` mapping each requirement to implemented files/tests/status.

## Definition of done

The feature works end to end in the existing application. The candidate sees published interviews, optionally adds a resume, starts a session, answers questions, receives adaptive follow-ups, and sees a report. Admin-authored blueprints are versioned and immutable during active sessions. No candidate custom-interview functionality exists.
