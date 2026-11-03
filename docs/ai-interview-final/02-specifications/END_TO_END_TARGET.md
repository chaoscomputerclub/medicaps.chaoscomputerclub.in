# End-to-End Product Specification

## 1. Product outcome

Deliver a realistic, adaptive AI interview practice product inside the existing CCC Medi-Caps platform. The experience must behave like a structured interview session rather than a free-form chatbot.

The candidate must be able to configure an interview, provide optional context, conduct a complete interview in text or supported voice mode, recover from interruptions, and receive an evidence-based coaching report.

The AI must identify itself as AI. It must not infer personality, protected traits, accent quality, emotion, or hiring suitability.

## 2. Candidate journey

1. Candidate opens Interview dashboard.
2. Candidate sees catalogue, previous sessions, progress and available tracks.
3. Candidate chooses a curated track or creates a custom interview.
4. Candidate configures target role, seniority, interview type, difficulty, duration, focus topics, language and mode.
5. Candidate may attach a resume or add project/context notes.
6. Resume is validated, parsed and presented for review. Nothing extracted is treated as verified until the candidate confirms or corrects it.
7. Candidate sees the interview plan summary and consent notices.
8. Candidate starts the session.
9. Interviewer introduces itself, explains the format and asks one primary question.
10. Candidate answers in text or voice.
11. The answer is finalized once. Partial speech transcripts are not committed as final answers.
12. The system evaluates the answer against the current rubric, extracts answer evidence and decides whether to clarify, probe, or move to the next planned topic.
13. The candidate can pause, resume, skip where allowed, or end.
14. At completion, a report is generated and committed.
15. Candidate reviews strengths, gaps, evidence, per-question feedback and next practice actions.
16. Session history and compatible comparison are available later.

## 3. Catalogue baseline

Initial catalogue tracks:

- Full Stack Java Developer
- MERN Stack Developer
- Python Backend Developer
- React Developer
- DevOps / Platform Engineer
- QA / SDET
- Data Engineer
- Behavioral
- HR
- System Design
- Coding / Problem Solving

The existing category registry is the source to reconcile against. Do not duplicate hard-coded catalogues in frontend and backend. API category metadata is authoritative. Admin authoring/versioning can be added as a separate capability if current static registry proves insufficient.

## 4. Interview configuration

Required:
- target role
- experience level
- category/track
- difficulty
- duration
- preferred language when coding applies
- interview mode: text or voice (voice only if enabled and provider-ready)

Optional:
- focus topics
- job description
- resume/profile context
- candidate-selected language for conversation, if supported
- custom round composition if the planner supports it

Validation:
- durations limited to supported values or an explicitly configured range.
- category/mode compatibility checked server-side.
- focus topics bounded in count and length.
- job description and candidate notes bounded in size.
- unknown category rejected with a stable validation error.
- all user-supplied content treated as untrusted data, not system instructions.

## 5. Interview lifecycle

Canonical states:

`DRAFT → READY → PREPARING → IN_PROGRESS → AWAITING_ANSWER → PROCESSING_ANSWER → IN_PROGRESS`

Terminal or side states:
- `PAUSED`
- `FINALIZING`
- `COMPLETED`
- `FAILED`
- `ABANDONED`
- `EXPIRED`

Rules:
- API/domain service owns legal transitions.
- LangGraph proposes work and executes orchestration steps but cannot bypass state transition validation.
- Frontend reflects server state; it never invents or locally commits lifecycle state.
- Candidate-visible question must be durably committed before response.
- Completed sessions are immutable except permitted report annotations or deletion workflow.
- Failure is recoverable only when the last committed state and checkpoint can be reconciled.
- A session cannot have two active answer-processing workers for the same turn.

## 6. Adaptive interviewer behavior

The interviewer:
- asks one primary question at a time;
- refers to candidate-confirmed resume/project facts with provenance;
- probes actual answer details rather than asking generic follow-ups;
- adapts depth within configured difficulty and topic bounds;
- avoids repeating an already asked question;
- does not fabricate candidate facts;
- makes a clear transition between rounds/topics;
- gives no answer hints during an active interview unless the chosen mode explicitly allows coaching;
- closes naturally and explains next steps.

Decision outputs are constrained to:
`CLARIFY`, `PROBE_DEEPER`, `MOVE_NEXT`, `SKIP`, `PAUSE`, `COMPLETE`, `RECOVER`.

Every decision must include a reason code and satisfy policy limits. LLM-generated decisions are validated against server policy.

## 7. Track requirements

### Technical
Fundamentals, implementation detail, debugging, trade-offs and operational reasoning.

### Backend / Full Stack
API design, data modeling, concurrency, reliability, caching, security, observability and system boundaries.

### Frontend / React
State management, rendering, performance, accessibility, browser behavior, API integration and testing.

### DevOps / Platform
Linux, networking, containers, CI/CD, infrastructure, observability, incident response and reliability.

### QA / SDET
Test design, risk-based testing, automation, API/UI testing, flakiness, CI and defect analysis.

### Behavioral / HR
Structured experience questions; STAR-style evidence can be used as a coaching framework. Do not infer personality or protected attributes.

### System design
Requirements clarification, constraints, API/data model, architecture, scaling, failure modes, security, trade-offs and bottlenecks. Diagram support is optional and must not block a text response.

### Coding
Must use the existing isolated judge provider boundary. The API process must never execute candidate code. Only enable if sandbox isolation, resource limits, hidden-test handling, language policy and abuse controls pass separate security verification.

## 8. Reports

A report includes:
- overall score and rubric version;
- concise executive summary;
- dimension breakdown;
- per-question score and evidence quotes;
- strengths and improvement areas;
- ideal answer guidance or model answer;
- recommended exercises/practice;
- confidence/limitations;
- session metadata and plan version.

Scores must be traceable to candidate answers and rubric dimensions. Do not use a single score as a prediction of job performance or hiring outcome. “Verdict” labels that imply hiring recommendation should be removed or renamed to practice-readiness bands.

## 9. Candidate history and comparisons

- Candidate sees only their own sessions.
- Session list supports pagination and filters.
- Comparison is allowed only across compatible track, rubric version, and sufficiently similar configuration.
- Changed rubrics/plans are versioned; historical reports are not silently recalculated.
- Candidate deletion/export policies apply across resume files, extracted facts, session answers, reports and derived context.

## 10. Admin/content operations

If enabled:
- manage catalogue templates and versions;
- define role/seniority/difficulty/competency mappings;
- publish/unpublish;
- preview a template;
- track usage, failure rate, model cost and evaluation quality;
- maintain prompt/rubric versions and audit changes.

Do not allow admin content to inject arbitrary system prompts without validation and review.
