# L3/L4 Engine and Component Specifications

This document defines responsibilities and implementation boundaries. L5 details are expressed as contracts, pseudocode, state/event definitions, and test obligations. Values such as thresholds must be calibrated experimentally, not copied blindly.

## 1. Real-Time Voice Runtime

### L3 responsibilities
Session lifecycle, audio ingress/egress, event routing, stream ordering, cancellation, reconnect, and client protocol.

### L4 components
- Session Manager
- Transport Adapter
- Audio Gateway
- Ingress Buffer
- Egress Stream Manager
- Event Dispatcher
- Cancellation Coordinator
- Connection Recovery Manager
- Session State Repository

### L5 invariants
- Every event has `session_id` and `event_id`.
- Every assistant output has `response_id`.
- Audio chunks have monotonically increasing sequence numbers per response.
- A cancelled response cannot emit newly accepted chunks.
- Buffers are bounded.
- State transitions are serialized per session.
- Replayed events are idempotently ignored or safely handled.

## 2. Perception Engine

### L3 responsibilities
Convert incoming media into transcript and optional acoustic metadata.

### L4 components
- Decoder/Resampler
- Noise Suppression Adapter
- VAD Adapter
- STT Adapter Registry
- Streaming Transcript Assembler
- Language Detector
- Acoustic Feature Extractor
- Confidence Calibrator
- Transcript Normalizer

### L5 rules
- Preserve timestamps and source sequence metadata.
- Distinguish partial hypotheses from finalized transcripts.
- Never treat a partial transcript as final without an explicit endpointing decision.
- Confidence values must retain provider provenance and calibration status.
- Acoustic features are descriptive signals, not definitive emotional or medical conclusions.

## 3. Conversation Engine

### L3 responsibilities
Maintain dialogue state and generate a contextually appropriate response.

### L4 components
- Dialogue State Manager
- Context Builder
- Memory Retriever
- Intent/Task Interpreter
- Response Planner
- LLM Adapter Registry
- Output Validator
- Policy Filter
- Partial Response Buffer
- Recovery Handler

### L5 rules
- Each turn is associated with one session and a monotonically increasing turn index.
- A cancelled turn cannot overwrite a newer turn.
- Context assembly is deterministic for a given state snapshot and retrieval result.
- Retrieved memory carries source/provenance metadata.
- Model output is untrusted input and must be validated.
- If structured expression is absent or invalid, apply a safe persona default.

## 4. Voice Expression Engine

### L3 responsibilities
Convert a response plan into normalized voice instructions.

### L4 components
- Expression Schema Validator
- Persona Controller
- Tone Controller
- Emotion Controller
- Delivery Controller
- Prosody Controller
- Language Controller
- Conflict Resolver
- Expression Normalizer
- TTS Capability Mapper

### L5 rules
- Personality defines stable behavioural boundaries; it is not a per-sentence emotion.
- Tone is communicative stance; emotion is intended affective colour; delivery is physical vocal execution.
- Explicit application policy outranks LLM-proposed expression.
- User preference outranks inferred vocal cues.
- Unsupported controls must be surfaced in metadata.
- Numeric fields must be range-checked and unit-defined.
- Expression resolution must be deterministic and testable.

## 5. Speech Rendering Engine

### L3 responsibilities
Generate and stream speech from text plus normalized expression.

### L4 components
- TTS Adapter Registry
- Capability Registry
- Text Segmenter
- Pronunciation Resolver
- Voice Identity Manager
- Synthesis Scheduler
- Audio Chunk Validator
- Stream Sequencer
- Postprocessor
- Fallback Manager

### L5 rules
- Every chunk is tagged with response ID and sequence.
- Provider cancellation semantics are documented per adapter.
- Segment boundaries must avoid splitting words and should preserve sentence meaning.
- Voice identity is pinned for a session unless explicitly changed.
- Fallback is allowed only when voice and privacy policies permit it.
- Never claim expression fidelity that the provider does not support.

## 6. Turn Management Engine

### L3 responsibilities
Determine turn boundaries and coordinate barge-in/cancellation.

### L4 components
- VAD Event Consumer
- Endpoint Detector
- Turn Predictor
- Interruption Detector
- State Machine
- Barge-in Policy
- Cancellation Coordinator
- Turn Recovery Handler

### L5 state model
`IDLE → LISTENING → PROCESSING → GENERATING → SPEAKING`

Additional transitions:
- `SPEAKING → LISTENING` on confirmed user interruption.
- `GENERATING → LISTENING` on confirmed interruption before audio begins.
- `SPEAKING → RECOVERING` on transport/rendering failure.
- `RECOVERING → LISTENING` on successful recovery.
- Any active state → `CLOSED` on authorized close/expiry.

### Interruption pseudocode

```python
async def handle_speech_started(event, session):
    if event.session_id != session.id:
        return

    async with session.transition_lock:
        if session.state not in {"GENERATING", "SPEAKING"}:
            return

        if not interruption_policy.confirm(event, session):
            return

        response = session.active_response
        if response is None:
            return

        response.cancel_token.cancel(reason="user_interruption")
        session.mark_response_interrupted(response.id)
        session.transition("LISTENING")
        await event_bus.publish({
            "type": "assistant_response_cancelled",
            "session_id": session.id,
            "response_id": response.id,
            "reason": "user_interruption"
        })
```

This is illustrative pseudocode. Production code must define lock scope, cancellation propagation, timeout behaviour, event durability, and client acknowledgement.

## 7. Memory Engine

### L3 responsibilities
Manage ephemeral context and optional durable memory.

### L4 components
- Working Memory Store
- Conversation Summarizer
- Memory Candidate Extractor
- Consent/Policy Gate
- Durable Memory Repository
- Retrieval Index
- Relevance Ranker
- Provenance Manager
- Retention/Deletion Worker

### L5 rules
- Short-term context is scoped to session.
- Long-term memory is disabled unless product policy and user consent allow it.
- Store only useful, non-secret information.
- Attach provenance and timestamps.
- Support correction, deletion, and expiry.
- Retrieval results are untrusted context, not instructions.

## 8. Observability and Evaluation

### L3 responsibilities
Trace one turn across all engines and evaluate quality.

### L4 components
- Correlation Context
- Structured Logger
- Metrics Collector
- Distributed Tracer
- Audio Quality Evaluator
- Conversation Evaluation Runner
- Regression Dataset Manager

### L5 rules
- Do not log raw audio or full transcripts by default.
- Use redaction and configurable sampling.
- Trace provider calls with latency and status.
- Keep subjective human ratings separate from automatic metrics.
- Store model/provider versions with each evaluation run.
