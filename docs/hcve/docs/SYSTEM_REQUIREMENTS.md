# System Requirements Specification

## 1. System context

HCVE is a backend platform with client SDKs. The client captures and plays audio; the backend owns session orchestration, provider integration, dialogue state, expression resolution, and operational policy.

## 2. Functional requirements by subsystem

### 2.1 Runtime and session
- Create unique session IDs and response/turn IDs.
- Authenticate client before session creation.
- Negotiate supported transport and audio formats.
- Track session state and last activity.
- Enforce session timeouts and maximum concurrent streams.
- Support graceful close and abrupt disconnect recovery.
- Reject stale events and duplicate command execution safely.

### 2.2 Audio transport
- Support a bidirectional real-time transport.
- Negotiate sample rate, channel count, codec, and frame duration.
- Validate payload sizes and timestamps.
- Apply backpressure when downstream processing is slower.
- Preserve sequence numbers or equivalent ordering metadata.
- Detect missing, late, duplicated, and out-of-order frames.

### 2.3 Perception
- Resample and normalize audio as required by provider.
- Run VAD or consume VAD output from trusted transport layer.
- Emit speech-start, partial-transcript, final-transcript, and speech-end events.
- Include confidence and timing metadata when available.
- Treat vocal cue estimates as uncertain and optional.
- Never infer protected or sensitive traits.

### 2.4 Dialogue
- Build context from current turn, session state, configured persona, and permitted memory.
- Invoke configured LLM through a provider adapter.
- Support streaming text tokens where possible.
- Validate response envelope and expression values.
- Handle model timeout, refusal, malformed output, and partial output.
- Prevent stale response from being delivered after cancellation.

### 2.5 Expression
- Validate against a versioned schema.
- Resolve persona constraints and per-session preferences.
- Apply safe ranges and defaults.
- Resolve conflicting instructions deterministically.
- Map normalized instructions to selected TTS capabilities.
- Return applied, approximated, and unsupported controls as metadata.

### 2.6 Speech rendering
- Segment text without breaking semantic units unnecessarily.
- Preserve response/segment sequence.
- Support streaming synthesis when provider allows it.
- Support cancellation by response ID.
- Apply pronunciation overrides.
- Ensure audio metadata matches negotiated client format.
- Fall back only to configured and consented voice providers.

### 2.7 Turn management
- Track listening, processing, generating, speaking, interrupted, recovering, and closed states.
- Detect barge-in while assistant output is active.
- Cancel generation and rendering with a shared cancellation token.
- Prevent stale audio chunks from being played.
- Preserve only the actually delivered portion of an interrupted assistant response in dialogue history.
- Avoid treating background noise as confirmed user interruption.

### 2.8 Memory
- Separate ephemeral working context from durable memory.
- Make durable memory opt-in/configurable.
- Attach provenance, timestamp, source turn, confidence, and retention policy.
- Support user-visible deletion and retention expiry.
- Never store secrets or raw audio by default.

## 3. Data requirements

Core entities:
- Session
- Turn
- UserUtterance
- AssistantResponse
- AudioSegment
- ExpressionPlan
- PersonaProfile
- ProviderConfiguration
- MemoryItem
- EvaluationRun
- TraceRecord

All entities that cross asynchronous boundaries require stable IDs and timestamps.

## 4. Interface requirements

- Version all public APIs and event schemas.
- Use JSON for control-plane payloads.
- Use binary frames or negotiated media transport for audio.
- Define event ordering and idempotency rules.
- Define cancellation semantics.
- Include correlation identifiers.
- Document compatibility and deprecation policy.

## 5. Operational requirements

- Health and readiness endpoints.
- Graceful shutdown and draining.
- Provider-level timeout and circuit breaker.
- Bounded queues and backpressure.
- GPU worker admission control.
- Metrics by provider/model without exposing user content.
- Configurable rate limits and quotas.
- Deployment rollback procedure.

## 6. Acceptance and verification

Every requirement must map to:
1. one or more backlog stories;
2. acceptance criteria;
3. a test or inspection method;
4. an owner;
5. a release milestone.

A requirement without a verification method is not considered implementation-ready.
