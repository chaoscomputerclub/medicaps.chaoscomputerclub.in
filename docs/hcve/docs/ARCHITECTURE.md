# HCVE Architecture Specification

## 1. Architecture style

Use a modular monolith initially, with explicit domain boundaries and asynchronous interfaces. Extract independently scalable services only when measured throughput, isolation, deployment cadence, or GPU resource constraints justify it.

Logical engines:
1. Real-Time Voice Runtime
2. Perception Engine
3. Conversation Engine
4. Voice Expression Engine
5. Speech Rendering Engine
6. Turn Management Engine
7. Memory Engine
8. Observability and Evaluation

## 2. Macro component responsibilities

### Runtime
Owns session lifecycle, transport, event routing, stream buffers, cancellation propagation, and client-facing protocol.

### Perception
Owns audio preprocessing, VAD integration, STT adapters, transcript normalization, language detection, and optional acoustic feature extraction.

### Conversation
Owns dialogue state, context assembly, LLM adapters, response policy, response planning, and output validation.

### Expression
Owns persona resolution, tone/emotion/delivery/prosody interpretation, normalization, conflict resolution, and provider capability mapping.

### Rendering
Owns TTS adapters, synthesis scheduling, segmentation, pronunciation, audio chunk metadata, and provider fallback.

### Turn management
Owns endpointing policy, turn-state transitions, interruption decisions, and response cancellation coordination.

### Memory
Owns session working memory, optional durable memory, retrieval, provenance, retention, and deletion.

## 3. Deployment boundaries

Initial deployment:
- `hcve-api`: FastAPI runtime/control plane.
- `hcve-workers`: async STT/LLM/TTS orchestration workers.
- `hcve-gpu-workers`: isolated model inference processes when self-hosting.
- Redis: ephemeral state, pub/sub or streams where justified, locks only when necessary.
- PostgreSQL: durable configuration, persona definitions, consent records, optional memory metadata.
- Object storage: only if explicitly enabled for retained media/evaluation datasets.

Do not split every logical engine into a network microservice at the start. Network hops can worsen latency and operational complexity.

## 4. Data flow

1. Client authenticates and creates session.
2. Runtime negotiates transport and audio format.
3. Client streams audio.
4. Perception produces partial/final events.
5. Turn manager decides whether utterance is complete.
6. Conversation engine builds context and calls LLM.
7. Response validator produces normalized response envelope.
8. Expression engine resolves expression plan.
9. Renderer segments text and invokes TTS.
10. Runtime streams ordered audio chunks.
11. Client plays audio and reports playback progress if supported.
12. On interruption, runtime cancels the response and updates delivered-text state.
13. Session state is updated; permitted memory operations occur asynchronously.

## 5. Concurrency model

Each session has a serialized state transition lane, while independent I/O operations are asynchronous. A response generation has a cancellation token. Events carry session, turn, and response IDs. Stale response IDs are discarded. GPU inference has bounded admission queues and explicit deadlines.

## 6. Provider adapter contract

Every adapter must declare:
- provider and model identifiers;
- supported input/output formats;
- streaming support;
- cancellation support and cancellation guarantees;
- supported languages;
- supported expression controls;
- voice identity capabilities;
- maximum payload/sequence constraints;
- timeout and retry policy;
- known limitations.

## 7. Architecture quality attributes

- Low latency: streaming and minimal blocking.
- Modularity: provider-independent interfaces.
- Reliability: idempotency, cancellation, bounded retries.
- Privacy: data minimization and explicit retention.
- Testability: deterministic adapters and fake clocks.
- Observability: cross-layer correlation.
- Evolvability: versioned schemas and ADRs.
