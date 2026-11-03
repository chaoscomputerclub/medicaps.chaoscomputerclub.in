CHAOS COMPUTER CLUB — MEDI-CAPSAI INTERVIEW PRACTICE
Core Feature Engineering Document | Inspired by Interleet
1. Purpose
Build a structured AI interview simulation feature native to the existing CCC Medi-Caps platform. Interleet is inspiration, not the target application. The product should adapt questions to candidate context and answers, evaluate with evidence, and generate actionable coaching.
2. Architecture assumptions to verify
React + Vite using JSX; Redux Toolkit.
FastAPI backend; PostgreSQL 16 for durable state; Redis 7 for coordination/cache.
Inspect existing authentication, UI components, LLM integrations, WebSocket/speech infrastructure, and coding judge before implementing.
Reuse existing architecture. Do not create duplicate infrastructure or deploy without authorization.
3. Core feature modules
Interview dashboard
Start sessions, view history, resume recoverable sessions, review reports and evidence-backed topic trends. Never fabricate user metrics.
Interview setup
Choose role, experience, interview category, difficulty, duration, coding language, topic focus, and optional resume/job description. Validate on the backend.
Candidate intelligence
Extract skills and projects from authorized sources. Separate claimed skills from demonstrated ability, track evidence, allow corrections, and bound context size.
Adaptive interviewer
Ask one primary question at a time. Select relevant follow-ups, adapt difficulty, track topic coverage, avoid duplicates, and respect time limits.
Text interview MVP
Question display, answer composer, finalization, transcript, processing/error states, session persistence, recovery, and final report.
Voice interviews
Add after text mode is stable. Support speech-to-text, text-to-speech, partial/final transcripts, interruption, reconnect, and text fallback.
Coding harness
Reuse the existing CCC judge if suitable. Separate actual execution correctness from LLM evaluation of reasoning and complexity.
System design and behavioral
Use track-specific question flows and rubrics; assess trade-offs and evidence rather than buzzwords or speaking style alone.
Evaluation and coaching
Provide rubric-based feedback, evidence, uncertainties, stronger explanations, and targeted next practice. Avoid unsupported score precision.
History and analytics
Persist sessions, show topic trends, compare only compatible rubrics, and support retention/deletion controls.
Provider orchestration
Centralize provider selection, structured output validation, timeout/retry policy, prompt versioning, usage/cost tracking, and fallback.
Security and reliability
Enforce authorization, idempotency, session isolation, durable writes, rate limits, safe errors, and observability.
4. Interview lifecycle
Suggested states: CREATED, PREPARING, ASKING, AWAITING_ANSWER, EVALUATING, SELECTING_NEXT_QUESTION, PAUSED, COMPLETING, COMPLETED, FAILED. Adapt to existing conventions. Backend validates every transition.
5. Core data concepts
InterviewSession: owner, configuration, state, timestamps, version.
InterviewQuestion: session, prompt, topic, difficulty, rubric/source metadata.
InterviewAnswer: question reference, finalized answer/transcript reference, idempotency key, timestamps.
Evaluation: rubric version, dimension assessments, supporting evidence, uncertainty, evaluator/model version.
CandidateProfile: structured claims and projects with source/evidence, correction history, profile version.
InterviewReport: summary, strengths, gaps, recommendations, generation status, version references.
PostgreSQL is authoritative for durable sessions, finalized answers, and completed reports. Redis is not the sole durable store.
6. Hierarchical backlog
EPIC 00 — Discovery and architecture
CCC-AI-001 Audit interview routes and existing code.
CCC-AI-002 Map auth, models, providers, WebSockets, UI.
CCC-AI-003 Audit coding judge reuse.
CCC-AI-004 Define state machine and privacy boundaries.
CCC-AI-005 Document architecture decisions and budgets.
EPIC 01 — Persistence and lifecycle
CCC-AI-101 Define session/question/answer/evaluation/report models.
CCC-AI-102 Add safe migrations and justified indexes.
CCC-AI-103 Enforce ownership and state transitions.
CCC-AI-104 Add idempotent answer finalization.
CCC-AI-105 Test restart recovery.
EPIC 02 — Setup and dashboard
CCC-AI-201 Build dashboard and states.
CCC-AI-202 Build configuration form and category registry.
CCC-AI-203 Validate config and create sessions.
CCC-AI-204 Add history/report navigation.
CCC-AI-205 Add UI/API/authorization tests.
EPIC 03 — Candidate intelligence
CCC-AI-301 Extract resume/project context.
CCC-AI-302 Normalize skills and match job descriptions.
CCC-AI-303 Track evidence-backed topic performance.
CCC-AI-304 Build bounded context and correction flow.
CCC-AI-305 Add privacy and deletion controls.
EPIC 04 — Orchestration and text MVP
CCC-AI-401 Implement state machine.
CCC-AI-402 Generate interview plan.
CCC-AI-403 Implement next-question and follow-up policy.
CCC-AI-404 Add coverage, adaptation, repetition guards.
CCC-AI-405 Build text interview UI.
CCC-AI-406 Add recoverable failures and resume.
CCC-AI-407 Test complete interview end to end.
EPIC 05 — LLM and evaluation
CCC-AI-501 Reuse/create provider abstraction.
CCC-AI-502 Validate structured model output.
CCC-AI-503 Version prompts and rubrics.
CCC-AI-504 Evaluate answers with evidence and uncertainty.
CCC-AI-505 Generate reports and recommendations.
CCC-AI-506 Create reviewed evaluation regression set.
EPIC 06 — Specialized tracks
CCC-AI-601 Create technical topic registry.
CCC-AI-602 Integrate coding interview with existing judge.
CCC-AI-603 Add system design flow.
CCC-AI-604 Add behavioral flow.
CCC-AI-605 Add track-specific tests.
EPIC 07 — Voice
CCC-AI-701 Define speech provider interfaces.
CCC-AI-702 Add microphone and transcription.
CCC-AI-703 Add TTS and playback controls.
CCC-AI-704 Distinguish partial/final transcripts.
CCC-AI-705 Add reconnect and duplicate-event protection.
CCC-AI-706 Test voice failures without losing finalized answers.
EPIC 08 — Release and reliability
CCC-AI-801 Add history and compatible score comparisons.
CCC-AI-802 Add rate limits, audit events, usage tracking.
CCC-AI-803 Add performance/recovery tests.
CCC-AI-804 Complete accessibility/security checks.
CCC-AI-805 Write rollout and rollback plan.
7. Recommended release sequence
MVP: configuration, durable text interview, adaptive follow-ups, evaluation report, history.
Release 2: resume/project personalization, topic history, targeted recommendations.
Release 3: coding judge integration, system design, behavioral tracks.
Release 4: voice with reconnect and interruption recovery.
Release 5: advanced analytics and evaluation calibration.
8. Quality gates
Retries must not duplicate finalized answers or questions.
Provider failure must not fabricate questions, scores, or execution results.
All routes enforce ownership and authorization.
Coding correctness comes from the actual judge, not an LLM guess.
Scoring uses explicit rubrics and evidence; uncertainty is represented.
Test malformed model output, timeouts, database failure, reconnects, duplicate requests, and unauthorized access.
No production deployment without explicit authorization.
9. Definition of done
A student can configure and complete a text interview, receive an evidence-backed report, and revisit persisted results. Relevant tests pass, recovery and authorization are verified, and no production deployment occurs without explicit authorization.
10. Next action for the coding agent
Audit the actual CCC repository; create the architecture audit, PRD, backlog, test plan, and release checklist; then implement the smallest dependency-complete set of tasks for a reliable text-interview MVP. Keep each task reviewable and test it before proceeding.