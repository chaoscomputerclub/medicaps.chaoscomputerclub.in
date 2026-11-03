# HCVE — Human Conversational Voice Engine

> A model-independent, real-time conversational voice infrastructure for building natural, interruptible, expressive voice experiences.

**Status:** End-to-end production product and engineering specification  
**Specification version:** 0.1.0  
**Delivery model:** Agile, incremental, testable releases  
**Implementation stance:** Independent implementation based on observable product behaviours and public technology. This project does not reproduce or claim access to proprietary OpenAI internals, weights, prompts, or source code.

## Product delivery mandate

**Target outcome: a complete, production-ready HCVE feature.** Do not reinterpret this specification as an MVP brief. Build in dependency-ordered increments, but complete all applicable requirements, reliability controls, integrations, security/privacy controls, observability, evaluation, and operational procedures before declaring the feature done. P0/P1/P2 indicate implementation order—not optional scope.

## 1. What is HCVE?

HCVE separates conversational intelligence from voice expression and audio rendering. Applications connect to one real-time voice API while the engine coordinates audio input, perception, dialogue, memory, expression, speech synthesis, streaming, and interruption handling.

### Core design principle

- **Conversation Engine:** determines what to communicate.
- **Voice Expression Engine:** determines how the response should be expressed.
- **Speech Rendering Engine:** turns text and expression instructions into audio.
- **Real-Time Runtime:** coordinates the live session and streaming lifecycle.
- **Perception Engine:** interprets incoming audio and vocal signals.
- **Turn Management Engine:** handles turn boundaries, interruptions, and barge-in.
- **Memory Engine:** retrieves and maintains relevant conversational context.

## 2. Product goals

1. Deliver low-latency, full-duplex conversational interaction.
2. Support natural interruption and turn-taking.
3. Keep LLM, STT, and TTS providers replaceable.
4. Provide a universal expression contract for tone, emotion, personality, prosody, and delivery.
5. Maintain consistent voice identity and behavioural personality.
6. Support short-term session context and optional long-term memory.
7. Expose stable APIs and SDK-friendly events to multiple client applications.
8. Measure quality using latency, interruption, expression, reliability, and human-evaluation metrics.

## 3. Non-goals

- Recreating proprietary ChatGPT Voice internals or private model behaviour.
- Guaranteeing identical output across different TTS models.
- Inferring sensitive attributes or psychological states from a user's voice.
- Treating emotion inference as fact. Vocal cues are uncertain signals and must not override explicit user intent.
- General-purpose telephony/PSTN is excluded unless separately approved.

## 4. Documentation map

| Document | Purpose |
|---|---|
| `docs/PRD.md` | Product requirements, users, scope, success metrics |
| `docs/SYSTEM_REQUIREMENTS.md` | Functional and non-functional requirements |
| `docs/ARCHITECTURE.md` | Macro and subsystem architecture |
| `docs/EXECUTION_LIFECYCLE.md` | End-to-end runtime sequence |
| `docs/ENGINE_SPECIFICATIONS.md` | L3/L4 component-level specifications |
| `docs/EXPRESSION_ENGINE.md` | Expression model and controller behaviour |
| `docs/REALTIME_AND_TURN_MANAGEMENT.md` | Streaming, VAD, endpointing, interruption |
| `docs/MEMORY_AND_DIALOGUE.md` | Dialogue state, memory, retrieval and context |
| `docs/API_AND_EVENT_CONTRACTS.md` | API and event contract conventions |
| `docs/SECURITY_PRIVACY.md` | Security, privacy, retention and consent |
| `docs/OBSERVABILITY_AND_EVALUATION.md` | Metrics, traces, testing and quality gates |
| `docs/DEPLOYMENT_OPERATIONS.md` | Deployment topology and operations |
| `docs/PRODUCTION_READINESS.md` | Mandatory production launch checklist and evidence gates |
| `docs/AGENT_IMPLEMENTATION_GUIDE.md` | Instructions for coding agents and contributors |
| `docs/GLOSSARY.md` | Shared terminology |
| `backlog/PRODUCT_BACKLOG.md` | Epics, stories, subtasks and acceptance criteria |
| `backlog/SPRINT_PLAN.md` | Suggested incremental delivery plan |
| `adr/` | Architecture decision records |
| `contracts/schemas/` | Initial JSON Schema contracts |
| `diagrams/` | Mermaid source diagrams; treat these as architecture references |

## 5. Suggested initial technology choices

These are defaults, not hard dependencies. Validate them with a proof of concept and record changes as ADRs.

| Layer | Initial option | Replaceable? |
|---|---|---|
| Backend API | Python + FastAPI | Yes |
| Async runtime | asyncio / task groups | Yes |
| Real-time transport | WebRTC via LiveKit (preferred candidate); WebSocket only where justified by measured requirements | Yes |
| VAD | Silero VAD | Yes |
| STT | Whisper-compatible or streaming STT adapter | Yes |
| LLM | Provider-neutral adapter | Yes |
| TTS | Qwen3-TTS, CosyVoice, Fish Speech, Piper, or hosted provider adapters | Yes |
| Session/cache | Redis | Yes |
| Durable data | PostgreSQL | Yes |
| Observability | OpenTelemetry + Prometheus-compatible metrics | Yes |
| Client | React / React Native | Yes |
| Deployment | Docker; GPU worker pool where required | Yes |

## 6. Engineering principles

- Start as a **modular monolith** with strict internal interfaces.
- Split GPU-heavy STT/TTS inference into workers when measured load justifies it.
- Use asynchronous streaming and explicit cancellation.
- Every request, event, audio chunk, and generated response must have correlation identifiers.
- Every model adapter must declare capabilities and limitations.
- Never silently claim unsupported expression controls were applied.
- Keep user audio and transcripts out of ordinary logs by default.
- Make long-term memory opt-in and controllable.
- Build evaluation and observability into every delivery increment.

## 7. Implementation status and execution

This ZIP is the complete product specification and implementation backlog, not executable application source. The implementation agent must deliver the complete production scope defined in the PRD; it must not stop at a demo or MVP. The deployed application must provide:
- `.env.example`
- Docker Compose for local dependencies
- FastAPI application entry point
- health/readiness endpoints
- provider adapter configuration
- client demo
- automated test suite

Do not invent configuration keys or claim a deployment is operational until the corresponding implementation exists.

## 8. Definition of done

A feature is done only when:
1. Its acceptance criteria pass.
2. Unit and integration tests cover normal and failure paths.
3. API/event contracts are documented and versioned.
4. Logs, metrics, and traces exist without leaking sensitive content.
5. Cancellation, timeout, and retry behaviour are tested where relevant.
6. Mermaid diagrams are updated if architecture or lifecycle changes.
7. Documentation and ADRs reflect the implementation.
8. A reviewer can run the feature using documented steps.

## 9. Important quality boundary

“Human-like” is an evaluation target, not a single implementation feature. It depends on latency, dialogue quality, prosody, voice consistency, interruption behaviour, and context handling together. A JSON tone label alone cannot guarantee natural speech. TTS capabilities differ; adapters must map, approximate, or reject controls honestly.

## 10. Open-source-first development (mandatory)

**Do not execute the project from scratch.** Before implementing a capability, inspect existing open-source projects and libraries, compare their maturity, API fit, license, performance, and maintenance, then reuse or integrate suitable components. HCVE should own its differentiated orchestration, expression policy, provider-independent contracts, session/turn coordination, and product-specific logic—not reimplement commodity media and model infrastructure.

The coding agent is explicitly allowed to adapt or merge suitable open-source code when the license permits it. It must preserve attribution and license notices, document upstream versions and modifications, and avoid copying code with unclear or incompatible licensing. See `docs/AGENT_IMPLEMENTATION_GUIDE.md` for the mandatory evaluation and integration workflow.
