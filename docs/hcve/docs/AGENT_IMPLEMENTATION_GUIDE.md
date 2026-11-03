# Coding Agent Implementation Guide

This document is the operating contract for any AI coding agent or engineering team implementing HCVE.

## 1. Source of truth

Before changing code, read:
1. `README.md`
2. `docs/PRD.md`
3. `docs/SYSTEM_REQUIREMENTS.md`
4. `docs/ARCHITECTURE.md`
5. Relevant engine specification
6. Relevant Mermaid diagram(s)
7. Relevant backlog epic and acceptance criteria
8. Relevant ADRs

The Mermaid files in `/diagrams` are normative architecture references. If implementation requires changing a diagram, update the diagram and explain the change in an ADR or pull request.

## 2. Execution discipline

**Production target — not an MVP:** implement the full applicable product scope in `docs/PRD.md`. Incremental vertical slices are for safe engineering and integration; they do not authorize stopping after a demo, prototype, or P0 milestone. P0/P1/P2 are sequencing priorities only. Keep every requirement traceable to backlog work, implementation, tests, and production evidence. Do not mark the project complete until all applicable production acceptance gates pass.

- Work one backlog story at a time.
- Break each story into independently verifiable subtasks.
- Do not implement future epics opportunistically.
- Do not replace a provider interface with provider-specific logic in domain code.
- Do not add dependencies without explaining why.
- Do not claim a feature is complete without tests and evidence.
- Preserve existing project conventions when integrating into an existing repository.
- Ask for clarification when product policy, credentials, deployment target, or data-retention choice is missing.

## 3. Required workflow for each story

1. Read story and dependencies.
2. Inspect repository structure and existing conventions.
3. Identify impacted components and diagrams.
4. Propose implementation plan and files to change.
5. Implement a complete, testable vertical slice that advances the production architecture; do not substitute a throwaway prototype for the production component.
6. Add unit tests.
7. Add component/integration tests where relevant.
8. Run lint, type checks, and tests.
9. Update API/schema docs.
10. Update Mermaid diagrams if behaviour or topology changed.
11. Record decisions in ADR.
12. Report files changed, tests run, results, known limitations, and next story.

## 4. Architecture constraints

- Modular monolith first.
- Explicit interfaces between runtime, perception, dialogue, expression, rendering, and memory.
- Async I/O and bounded queues.
- Per-session serialized state transitions.
- Cancellation token propagated end to end.
- Versioned JSON contracts.
- No raw audio/transcript logging by default.
- Provider capability metadata is mandatory.
- Long-term memory must respect consent and retention policy.

## 5. Required adapter interfaces

Define protocols/abstract interfaces for:
- `STTAdapter`
- `LLMAdapter`
- `TTSAdapter`
- `AudioTransport`
- `SessionRepository`
- `MemoryRepository`
- `EventBus`
- `Clock`
- `MetricsRecorder`

Use fake implementations for deterministic tests.

## 6. Definition of ready

A story is ready when:
- objective is clear;
- acceptance criteria are testable;
- dependencies are known;
- contract changes are identified;
- data/security impact is reviewed;
- diagrams are referenced.

## 7. Definition of done

A story is done when:
- acceptance criteria pass;
- tests cover success and failure cases;
- no known regression is introduced;
- observability is present;
- docs and diagrams are current;
- no secrets or sensitive user content are committed;
- reviewer can reproduce the result.

## 8. Prohibited shortcuts

- Do not hardcode one provider throughout the codebase.
- Do not assume all TTS models support emotion, pitch, pace, or streaming.
- Do not use silence alone as the sole turn-finalization signal.
- Do not assume generated text was fully spoken after interruption.
- Do not persist all conversations as long-term memory.
- Do not use a single giant prompt as a substitute for dialogue state and runtime control.
- Do not describe the implementation as “exactly ChatGPT Voice” or claim access to proprietary internals.

## 9. Agent task output format

For every completed story, report:
- Story ID and title
- Scope completed
- Files created/modified
- Interfaces/contracts changed
- Tests executed and results
- Diagram/document updates
- Known gaps
- Recommended next backlog item

## 10. Open-source-first implementation policy (mandatory)

**Do not build every capability from scratch.** Before implementing a subsystem, the agent must research and evaluate mature open-source projects, libraries, SDKs, reference implementations, and permissively licensed code that can satisfy the requirement.

The goal is to **integrate, adapt, and compose existing proven components** into HCVE—not reinvent commodity infrastructure.

### Required discovery workflow

For each substantial backlog story:

1. Identify the exact capability needed and its acceptance criteria.
2. Search for existing open-source projects and maintained libraries that solve all or part of it.
3. Prefer projects with active maintenance, clear documentation, production usage evidence, security practices, and compatible licenses.
4. Inspect the actual repository, APIs, extension points, dependency tree, and limitations before deciding.
5. Compare at least two viable options for foundational choices where practical.
6. Record the decision in an ADR or a short evaluation note.
7. Integrate through HCVE's internal adapter/interface boundaries.
8. Add HCVE-specific glue code, policy, orchestration, tests, and observability.
9. Preserve upstream attribution and license notices.
10. Revisit the decision if the selected project becomes unmaintained or fails acceptance criteria.

### Preferred reuse areas

Evaluate existing projects before writing custom implementations for:

- WebRTC, real-time media transport, audio routing, and streaming.
- VAD, noise suppression, echo cancellation, resampling, and audio codecs.
- STT and TTS model runtimes and serving frameworks.
- LLM provider clients and structured-output validation.
- Agent orchestration or graph execution, where it genuinely helps.
- Redis/PostgreSQL clients, queues, event transport, and distributed tracing.
- Metrics, logging, testing, load generation, and evaluation harnesses.
- Client-side microphone capture and audio playback.

Candidate projects may include LiveKit Agents, Pipecat, Silero VAD, Whisper/faster-whisper, Qwen3-TTS, CosyVoice, Fish Speech, Piper, OpenTelemetry, and other suitable projects. These are candidates to evaluate—not mandatory dependencies or endorsements. Verify current maintenance, API fit, hardware requirements, and license before adoption.

### What HCVE should own

Prefer custom code where it creates the product's differentiation or where existing tools do not meet requirements:

- Provider-independent contracts and capability registry.
- Expression schema, persona policy, and conflict resolution.
- Cross-provider orchestration and session lifecycle policy.
- Dialogue state and response delivery accounting.
- Turn coordination and end-to-end cancellation semantics.
- Memory policy, provenance, consent, and retention controls.
- Evaluation methodology and HCVE-specific quality metrics.
- Integration glue and application-facing API/SDK.

### Reuse decision matrix

For each candidate, record:

| Criterion | Questions |
|---|---|
| Functional fit | Does it satisfy the required behaviour and acceptance criteria? |
| Integration | Can it fit behind an HCVE interface without invasive forks? |
| Maintenance | Is it actively maintained? Are releases and issues handled? |
| License | Is the license compatible with the intended distribution and commercial use? |
| Security | Are dependencies, vulnerabilities, and supply-chain risks understood? |
| Performance | Does it meet latency, throughput, and resource requirements in a benchmark? |
| Extensibility | Can HCVE add required policy and lifecycle behaviour? |
| Exit cost | Can the component be replaced without rewriting the domain layer? |

### Forking and code-merging policy

- Prefer upstream packages and public APIs over copying source files.
- If code must be copied or merged, verify the exact license and preserve copyright, attribution, and required notices.
- Keep modifications small and isolated.
- Prefer a maintained fork or upstream contribution over an untracked private fork.
- Document upstream repository URL, version/commit, license, local modifications, and update strategy.
- Never copy code from a repository with an incompatible, unclear, or missing license.
- Do not paste large third-party codebases into HCVE merely because they are open source.
- Do not merge a project wholesale if only one module or adapter is needed.

### Build-versus-buy/reuse decision

Implement from scratch only when:
- no suitable maintained project exists;
- existing projects cannot meet a hard requirement;
- integration cost is demonstrably higher than a focused implementation; or
- HCVE's differentiated behaviour requires custom logic.

The agent must explain why reuse was rejected before starting a custom implementation of a major capability.

### Required story output

Add these fields to every implementation report:
- Open-source projects/libraries evaluated.
- Selected dependency and exact version/commit, if adopted.
- License and attribution review.
- Code reused versus custom code written.
- Benchmark or compatibility evidence.
- Known upstream limitations and upgrade strategy.

**Default rule: reuse infrastructure; build HCVE's differentiated orchestration and experience.**

## 11. Production completion obligations

Before declaring HCVE complete, the agent/team must:
- Trace every applicable PRD requirement to a backlog story, implementation location, automated/manual test, and evidence.
- Complete all applicable P0, P1, and P2 scope; do not treat P1/P2 as optional post-MVP enhancements.
- Implement production authentication, tenant isolation, quotas, privacy/consent controls, retention/deletion, and secure provider configuration.
- Verify failure handling, provider fallback, cancellation, reconnect, backpressure, capacity limits, and graceful degradation.
- Deliver production observability, dashboards, alerts, runbooks, deployment/rollback, backup/restore, and recovery procedures.
- Run documented load, soak, resilience, security, privacy, compatibility, accessibility, and human quality evaluations.
- Complete every applicable gate in `docs/PRODUCTION_READINESS.md` and `docs/PRD.md`.

A successful local demo, passing unit tests, or a single happy-path conversation is not production acceptance.
