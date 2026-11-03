# CCC AI Interview Practice — Core Engineering

Build this feature inside the CCC Medi-Caps project; Interleet is inspiration only.

## Core modules
- Interview dashboard and setup
- Candidate intelligence
- Adaptive interviewer and follow-ups
- Text interview MVP
- Voice interviews after text reliability
- Coding harness using existing judge
- System design and behavioral tracks
- Evidence-based evaluation and coaching
- History, analytics, provider orchestration, security

## Architecture
React/Vite JSX + Redux Toolkit, FastAPI, PostgreSQL as durable source of truth, Redis for coordination/cache. Verify repository reality before implementation and reuse existing auth, UI, providers, speech, and judge infrastructure.

## State flow
Create session → build context and plan → ask one question → finalize answer → evaluate evidence → choose follow-up/next topic or complete → persist report.

## Backlog
### EPIC 00 — Discovery and architecture
- CCC-AI-001 Audit interview routes and existing code.
- CCC-AI-002 Map auth, models, providers, WebSockets, UI.
- CCC-AI-003 Audit coding judge reuse.
- CCC-AI-004 Define state machine and privacy boundaries.
- CCC-AI-005 Document architecture decisions and budgets.
### EPIC 01 — Persistence and lifecycle
- CCC-AI-101 Define session/question/answer/evaluation/report models.
- CCC-AI-102 Add safe migrations and justified indexes.
- CCC-AI-103 Enforce ownership and state transitions.
- CCC-AI-104 Add idempotent answer finalization.
- CCC-AI-105 Test restart recovery.
### EPIC 02 — Setup and dashboard
- CCC-AI-201 Build dashboard and states.
- CCC-AI-202 Build configuration form and category registry.
- CCC-AI-203 Validate config and create sessions.
- CCC-AI-204 Add history/report navigation.
- CCC-AI-205 Add UI/API/authorization tests.
### EPIC 03 — Candidate intelligence
- CCC-AI-301 Extract resume/project context.
- CCC-AI-302 Normalize skills and match job descriptions.
- CCC-AI-303 Track evidence-backed topic performance.
- CCC-AI-304 Build bounded context and correction flow.
- CCC-AI-305 Add privacy and deletion controls.
### EPIC 04 — Orchestration and text MVP
- CCC-AI-401 Implement state machine.
- CCC-AI-402 Generate interview plan.
- CCC-AI-403 Implement next-question and follow-up policy.
- CCC-AI-404 Add coverage, adaptation, repetition guards.
- CCC-AI-405 Build text interview UI.
- CCC-AI-406 Add recoverable failures and resume.
- CCC-AI-407 Test complete interview end to end.
### EPIC 05 — LLM and evaluation
- CCC-AI-501 Reuse/create provider abstraction.
- CCC-AI-502 Validate structured model output.
- CCC-AI-503 Version prompts and rubrics.
- CCC-AI-504 Evaluate answers with evidence and uncertainty.
- CCC-AI-505 Generate reports and recommendations.
- CCC-AI-506 Create reviewed evaluation regression set.
### EPIC 06 — Specialized tracks
- CCC-AI-601 Create technical topic registry.
- CCC-AI-602 Integrate coding interview with existing judge.
- CCC-AI-603 Add system design flow.
- CCC-AI-604 Add behavioral flow.
- CCC-AI-605 Add track-specific tests.
### EPIC 07 — Voice
- CCC-AI-701 Define speech provider interfaces.
- CCC-AI-702 Add microphone and transcription.
- CCC-AI-703 Add TTS and playback controls.
- CCC-AI-704 Distinguish partial/final transcripts.
- CCC-AI-705 Add reconnect and duplicate-event protection.
- CCC-AI-706 Test voice failures without losing finalized answers.
### EPIC 08 — Release and reliability
- CCC-AI-801 Add history and compatible score comparisons.
- CCC-AI-802 Add rate limits, audit events, usage tracking.
- CCC-AI-803 Add performance/recovery tests.
- CCC-AI-804 Complete accessibility/security checks.
- CCC-AI-805 Write rollout and rollback plan.

## Release order
1. Text MVP.
2. Resume/project personalization.
3. Coding, system design, behavioral tracks.
4. Voice and recovery.
5. Advanced analytics and calibrated evaluation.

## Hard gates
Backend-enforced state and ownership; idempotent answer finalization; no fabricated judge results; evidence-based scoring; durable PostgreSQL records; tests for retries, provider/database failures, unauthorized access, and reconnects. No deployment without authorization.
