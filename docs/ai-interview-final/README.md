# CCC AI Interview Practice — Final Repository-Specific Implementation Documentation

**Package status:** Final implementation baseline  
**Repository audited:** `medicaps-code.zip`  
**Product:** Chaos Computer Club — Medi-Caps AI Interview Practice  
**Architecture:** Existing FastAPI + PostgreSQL + Redis + React/TypeScript + LangGraph + HCVE voice runtime

## Purpose

This package specifies the complete end-to-end changes required to turn the existing repository implementation into a secure, durable, testable, production-operable AI interview product. It is written against the supplied repository, not a hypothetical greenfield application.

This is the final documentation baseline. It is not a claim that the changes have already been implemented.

## Read first

1. `01-audit/REPOSITORY_AUDIT.md` — what exists, what is missing, and important corrections to older audit documents.
2. `02-specifications/END_TO_END_TARGET.md` — target behavior and complete product scope.
3. `02-specifications/CHANGE_SPECIFICATION.md` — concrete changes mapped to existing files.
4. `03-contracts/API_CONTRACTS.md` — target API behavior and payload contracts.
5. `03-contracts/DATA_AND_MIGRATION_SPEC.md` — target relational model, constraints, migrations.
6. `03-contracts/LANGGRAPH_RUNTIME_CONTRACT.md` — durable graph execution and turn lifecycle.
7. `03-contracts/VOICE_INTEGRATION_CONTRACT.md` — how HCVE and Sarvam connect to an authenticated interview.
8. `05-backlog/IMPLEMENTATION_BACKLOG.md` — dependency-ordered implementation work with acceptance criteria.
9. `06-operations/RELEASE_AND_OPERATIONS.md` — deployment, verification, rollback, monitoring.

## Repository facts that govern this plan

- The supplied frontend is React 19 + TypeScript (`.tsx`/`.ts`), Vite 6, Redux Toolkit and React Router. New work must remain TypeScript. Do not follow older assumptions that this repository is JSX-only.
- The existing AI interview domain is already present: SQLAlchemy models, Pydantic schemas, FastAPI router, category registry, candidate context service, orchestration services, LangGraph graph, LLM adapters, frontend pages, API client, Redux slice, and tests.
- The LangGraph module currently imports and uses `MemorySaver`. That is process-memory checkpointing, not durable restart-safe persistence.
- The LLM factory currently falls back to `DeterministicMockLLMProvider` when a real provider is not configured. This is useful in tests/development but must not silently happen in production.
- The interview domain models are defined in `backend/app/models/interview.py`. The repository uses `backend/app/core/db.py` schema initialization and existing SQL migration files; this feature needs an explicit, versioned migration path rather than relying solely on implicit runtime DDL.
- HCVE is a separate voice runtime with its own session state, coordinator, transport and provider adapters. Its `/sessions` creation accepts `owner_id` from request data with an anonymous fallback. It must be bound to the authenticated member and interview session before it is used as a candidate-facing interview voice channel.
- Sarvam TTS adapter exists. The presence of a TTS adapter does not establish that end-to-end voice interviews, streaming STT, production quotas, or current provider capabilities have been verified.
- Candidate context builder currently includes a member PRN in its prompt context. Remove direct identifiers from LLM context; use a non-identifying candidate reference if needed.
- The existing interview model has durable session/question/answer/evaluation/report/profile entities, but the complete resume upload, extraction review, consent, provenance and deletion workflow is not established by the inspected implementation.

## Non-negotiable implementation rules

1. Repository-first: reuse existing modules and patterns; no duplicate app or parallel interview service.
2. PostgreSQL is the authoritative record. Redis is coordination/cache only.
3. LangGraph is orchestration, not the authority for permissions, transactions or state transitions.
4. Every candidate-visible turn is committed before it is returned.
5. Answer submission is idempotent and concurrency-safe.
6. No production mock provider fallback.
7. No LLM prompt receives PRN, email, auth tokens, or unrelated personal data.
8. Voice sessions are authenticated, owner-scoped, linked to an interview session, and revocable.
9. Candidate code is never executed in the API process. Reuse the existing judge only through its existing sandbox/provider boundary after a separate coding-track security gate.
10. No claim of production readiness until the release gates in this package pass.

## Suggested implementation order

Repository audit and baseline tests → migration and data constraints → provider configuration safety → durable graph checkpointing → lifecycle and idempotency hardening → frontend workflow consistency → resume pipeline → voice linkage → evaluation/report quality → security/load/E2E verification → staged release.

## Delivery contents

- Repository audit and gap register
- End-to-end target specification
- File-level change specification
- API and event contracts
- Data and migration specification
- LangGraph execution contract
- LLM provider policy
- Resume intelligence contract
- Voice/Sarvam/HCVE integration contract
- Evaluation and reporting contract
- Security/privacy contract
- Frontend UX/state contract
- Mermaid diagrams
- Granular implementation backlog
- Test matrix
- Release and operations runbook
- Architecture decision records
