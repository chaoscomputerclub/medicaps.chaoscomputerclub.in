# Product Backlog — Epics, Stories and Subtasks

Backlog is ordered by dependency and risk. Estimate stories using team planning; do not treat suggested sprint placement as a fixed commitment.

## Epic E0 — Repository and engineering foundation

### HCVE-001: Establish project skeleton
**Priority:** P0  
**Acceptance:** App starts locally; health endpoint responds; configuration is environment-driven.

Subtasks:
- [ ] Create backend package structure.
- [ ] Add FastAPI application factory.
- [ ] Add `/health` and `/ready`.
- [ ] Add structured configuration loading.
- [ ] Add `.env.example` with placeholders.
- [ ] Add Dockerfile and local compose dependencies.
- [ ] Add linting, formatting, type-check and test commands.
- [ ] Add CI pipeline for checks.

### HCVE-002: Define domain contracts
**Priority:** P0  
**Acceptance:** Versioned models validate; contract tests pass.

Subtasks:
- [ ] Define Session, Turn, Response and AudioSegment IDs.
- [ ] Define event envelope.
- [ ] Define expression plan schema.
- [ ] Define provider capability model.
- [ ] Define error taxonomy.
- [ ] Add JSON schema validation tests.
- [ ] Document compatibility policy.

## Epic E1 — Session and real-time runtime

### HCVE-010: Create session lifecycle
**Priority:** P0  
**Acceptance:** Create/read/close session works with ownership checks and expiry.

Subtasks:
- [ ] Implement Session domain model.
- [ ] Implement session repository interface.
- [ ] Add in-memory repository for tests.
- [ ] Add Redis repository implementation.
- [ ] Implement create/get/close endpoints.
- [ ] Add session TTL and cleanup.
- [ ] Add authorization tests.
- [ ] Add lifecycle metrics.

### HCVE-011: Implement audio transport ingress
**Priority:** P0  
**Acceptance:** Client audio frames are accepted, validated, ordered, and routed.

Subtasks:
- [ ] Choose initial transport through ADR.
- [ ] Define audio format negotiation.
- [ ] Implement transport adapter interface.
- [ ] Validate frame metadata and payload limits.
- [ ] Add sequence/timestamp checks.
- [ ] Add bounded ingress buffer.
- [ ] Add backpressure and overflow policy.
- [ ] Add packet-loss and out-of-order tests.

### HCVE-012: Implement audio egress
**Priority:** P0  
**Acceptance:** Ordered audio chunks reach client; stale response chunks are rejected.

Subtasks:
- [ ] Define audio chunk envelope.
- [ ] Implement egress sequencer.
- [ ] Add response ID validation.
- [ ] Add client playback queue contract.
- [ ] Add playback acknowledgement if transport supports it.
- [ ] Test missing, duplicate, and stale chunks.

## Epic E2 — Perception and speech recognition

### HCVE-020: Integrate VAD
**Priority:** P0  
**Acceptance:** Speech-start/end candidates are emitted with timing and confidence metadata.

Subtasks:
- [ ] Define VAD adapter interface.
- [ ] Integrate selected VAD provider.
- [ ] Normalize audio format.
- [ ] Emit speech-start events.
- [ ] Emit speech-end candidates.
- [ ] Add configurable thresholds.
- [ ] Test silence, noise, speech, and echo cases.

### HCVE-021: Integrate streaming STT
**Priority:** P0  
**Acceptance:** Partial and final transcript events include timestamps and provider metadata.

Subtasks:
- [ ] Define STT adapter interface.
- [ ] Implement one provider adapter.
- [ ] Build transcript assembler.
- [ ] Distinguish partial from final hypotheses.
- [ ] Normalize punctuation and whitespace without changing meaning.
- [ ] Add timeout and provider error mapping.
- [ ] Add deterministic fake STT.
- [ ] Add integration tests.

### HCVE-022: Add endpointing policy
**Priority:** P0  
**Acceptance:** Turn completion is not based on silence alone; tests cover pauses and continued speech.

Subtasks:
- [ ] Define endpointing input features.
- [ ] Implement baseline silence + VAD policy.
- [ ] Add transcript-finalization signal.
- [ ] Add configurable language/use-case profile.
- [ ] Add false endpoint and delayed endpoint tests.
- [ ] Record endpoint latency metrics.

## Epic E3 — Dialogue and LLM orchestration

### HCVE-030: Implement dialogue state manager
**Priority:** P0  
**Acceptance:** State transitions are serialized and stale turns cannot overwrite newer state.

Subtasks:
- [ ] Define dialogue state model.
- [ ] Define allowed state transitions.
- [ ] Implement per-session transition lock/actor.
- [ ] Add state versioning.
- [ ] Add stale event rejection.
- [ ] Add transition unit tests.

### HCVE-031: Implement LLM adapter
**Priority:** P0  
**Acceptance:** One provider can be called through a provider-neutral interface with timeout and cancellation.

Subtasks:
- [ ] Define LLMAdapter protocol.
- [ ] Implement selected provider adapter.
- [ ] Support streaming text where available.
- [ ] Normalize provider errors.
- [ ] Add timeout and cancellation.
- [ ] Add fake LLM adapter.
- [ ] Add contract tests.

### HCVE-032: Build context and response planner
**Priority:** P0  
**Acceptance:** Context is assembled from policy, persona, recent turns and current utterance with a bounded token budget.

Subtasks:
- [ ] Implement context builder.
- [ ] Define response envelope.
- [ ] Implement response planner defaults.
- [ ] Validate model output.
- [ ] Handle malformed structured output.
- [ ] Handle partial response cancellation.
- [ ] Add context snapshot tests.

## Epic E4 — Voice Expression Engine

### HCVE-040: Implement expression schema and validator
**Priority:** P0  
**Acceptance:** Valid expression plans pass; invalid values and text spans are rejected or safely normalized.

Subtasks:
- [ ] Implement schema from `contracts/schemas/expression_plan.schema.json`.
- [ ] Add schema version handling.
- [ ] Validate enums and numeric ranges.
- [ ] Validate emphasis spans against response text.
- [ ] Add strict and forward-compatible modes.
- [ ] Add schema regression tests.

### HCVE-041: Implement persona controller
**Priority:** P0  
**Acceptance:** Persona constraints and defaults are applied deterministically.

Subtasks:
- [ ] Define persona profile model.
- [ ] Define allowed ranges and prohibited combinations.
- [ ] Implement persona repository.
- [ ] Implement precedence rules.
- [ ] Add versioned persona loading.
- [ ] Add conflict resolution tests.

### HCVE-042: Implement tone, emotion and delivery controllers
**Priority:** P1  
**Acceptance:** Each dimension remains distinct and produces normalized instructions.

Subtasks:
- [ ] Define tone taxonomy.
- [ ] Define emotion taxonomy including neutral.
- [ ] Define delivery dimensions.
- [ ] Implement independent controllers.
- [ ] Add defaults and range clamps.
- [ ] Add contradictory instruction tests.

### HCVE-043: Implement prosody and language controllers
**Priority:** P1  
**Acceptance:** Pauses/emphasis align to text and language settings are validated.

Subtasks:
- [ ] Define prosody schema.
- [ ] Implement text span validation.
- [ ] Define language/locale registry.
- [ ] Add pronunciation lexicon interface.
- [ ] Add code-switching metadata.
- [ ] Add tests for changed text alignment.

### HCVE-044: Implement TTS capability mapper
**Priority:** P0  
**Acceptance:** Each requested control is classified applied, approximated, unsupported, or ignored by policy.

Subtasks:
- [ ] Define provider capability registry.
- [ ] Define normalized-to-provider mapping interface.
- [ ] Implement one adapter mapping.
- [ ] Add unsupported-control reporting.
- [ ] Add capability matrix tests.

## Epic E5 — Speech Rendering

### HCVE-050: Define TTS adapter contract
**Priority:** P0  
**Acceptance:** Fake and real TTS adapters implement the same contract.

Subtasks:
- [ ] Define synthesize and stream methods.
- [ ] Define cancel semantics.
- [ ] Define supported format metadata.
- [ ] Define voice capability metadata.
- [ ] Add fake TTS adapter.
- [ ] Add adapter contract tests.

### HCVE-051: Integrate first TTS provider
**Priority:** P0  
**Acceptance:** Text and resolved expression produce valid audio chunks through the runtime.

Subtasks:
- [ ] Select provider using ADR.
- [ ] Implement provider adapter.
- [ ] Normalize audio format.
- [ ] Handle provider streaming.
- [ ] Add timeout and cancellation.
- [ ] Add voice identity pinning.
- [ ] Add integration tests.

### HCVE-052: Implement segmentation and sequencing
**Priority:** P1  
**Acceptance:** Text is segmented at safe boundaries and audio chunks preserve response ordering.

Subtasks:
- [ ] Implement sentence/phrase segmenter.
- [ ] Preserve punctuation and semantic boundaries.
- [ ] Attach segment IDs and sequence numbers.
- [ ] Prevent word-level splits.
- [ ] Add streaming buffer policy.
- [ ] Test long responses and partial text.

### HCVE-053: Add pronunciation and fallback
**Priority:** P1  
**Acceptance:** Configured pronunciation overrides work; fallback is policy- and voice-compatible.

Subtasks:
- [ ] Define pronunciation dictionary format.
- [ ] Implement text normalization hook.
- [ ] Define fallback policy.
- [ ] Implement circuit breaker.
- [ ] Preserve voice identity constraints.
- [ ] Test provider outage and fallback.

## Epic E6 — Turn management and interruption

### HCVE-060: Implement turn state machine
**Priority:** P0  
**Acceptance:** All documented transitions are validated and illegal transitions rejected.

Subtasks:
- [ ] Implement state enum.
- [ ] Implement transition table.
- [ ] Add transition event log.
- [ ] Add per-session serialization.
- [ ] Add state machine tests.

### HCVE-061: Implement barge-in detection
**Priority:** P0  
**Acceptance:** User speech during assistant output triggers confirmed interruption without excessive noise-triggered cancels.

Subtasks:
- [ ] Subscribe to VAD speech-start events.
- [ ] Implement interruption policy.
- [ ] Add echo/noise guard.
- [ ] Add configurable sensitivity.
- [ ] Test genuine interruption and background noise.

### HCVE-062: Implement end-to-end cancellation
**Priority:** P0  
**Acceptance:** LLM, TTS, egress, and client discard stale output after cancellation.

Subtasks:
- [ ] Define shared cancellation token.
- [ ] Propagate token through LLM adapter.
- [ ] Propagate token through TTS adapter.
- [ ] Stop egress writes.
- [ ] Add client stale-response filtering.
- [ ] Track delivered text where possible.
- [ ] Test race conditions and late chunks.

## Epic E7 — Memory

### HCVE-070: Implement session working memory
**Priority:** P0  
**Acceptance:** Recent turns are available during session and expire after configured TTL.

Subtasks:
- [ ] Define turn storage model.
- [ ] Implement bounded context window.
- [ ] Add summarization policy if needed.
- [ ] Add session expiry.
- [ ] Test multi-turn reference resolution.

### HCVE-071: Add optional long-term memory
**Priority:** P1  
**Acceptance:** Durable memory is consent-gated, sourced, retrievable, correctable, and deletable.

Subtasks:
- [ ] Define memory item schema.
- [ ] Add consent/policy gate.
- [ ] Implement candidate usefulness filter.
- [ ] Add provenance fields.
- [ ] Implement retrieval and ranking.
- [ ] Implement expiry and deletion.
- [ ] Add privacy tests.

## Epic E8 — Observability, quality and security

### HCVE-080: Add distributed tracing and metrics
**Priority:** P0  
**Acceptance:** One turn can be traced across engines and provider calls.

Subtasks:
- [ ] Define correlation context.
- [ ] Instrument runtime.
- [ ] Instrument STT/LLM/TTS adapters.
- [ ] Add latency histograms.
- [ ] Add queue and cancellation metrics.
- [ ] Redact content from logs.

### HCVE-081: Build end-to-end evaluation harness
**Priority:** P1  
**Acceptance:** A fixed test set can replay test cases and publish comparable results.

Subtasks:
- [ ] Define test case format.
- [ ] Add synthetic audio fixtures.
- [ ] Add scripted interruption cases.
- [ ] Record model/provider versions.
- [ ] Add automated metrics.
- [ ] Add human rating rubric.
- [ ] Publish regression report.

### HCVE-082: Security and privacy controls
**Priority:** P0  
**Acceptance:** Auth, session isolation, secret handling, retention and deletion are tested.

Subtasks:
- [ ] Add authentication middleware.
- [ ] Add session ownership checks.
- [ ] Add rate limits and payload limits.
- [ ] Configure secret handling.
- [ ] Add retention policy.
- [ ] Add deletion workflow.
- [ ] Add security test checklist.

## Epic E9 — Client SDK and demo

### HCVE-090: Build web demo
**Priority:** P1  
**Acceptance:** User can start a session, speak, hear response, interrupt, and close session.

Subtasks:
- [ ] Implement session creation client.
- [ ] Implement microphone permission UX.
- [ ] Implement audio capture and transport.
- [ ] Implement playback queue.
- [ ] Implement stale response filtering.
- [ ] Show listening/speaking/interrupted states.
- [ ] Add reconnect and error UX.

### HCVE-091: Publish client SDK contract
**Priority:** P2  
**Acceptance:** SDK API and lifecycle are documented with sample integration.

Subtasks:
- [ ] Define SDK public methods.
- [ ] Define event subscription API.
- [ ] Add typed event models.
- [ ] Add sample app.
- [ ] Add API compatibility tests.
