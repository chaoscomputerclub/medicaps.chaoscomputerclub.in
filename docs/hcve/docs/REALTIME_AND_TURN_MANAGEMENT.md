# Real-Time Audio, Streaming and Turn Management

## 1. Design goals

- Full-duplex audio where transport and client support it.
- Low-latency partial processing.
- Reliable endpointing.
- Prompt interruption.
- Bounded buffers and backpressure.
- No stale audio after cancellation.
- Resilience to jitter, packet loss, reconnects, and provider stalls.

## 2. Audio frame contract

Every frame should carry:
- session ID;
- stream ID;
- sequence number;
- capture timestamp;
- codec/format metadata or negotiated format reference;
- payload length;
- payload.

Validate size and sequence before processing. Never trust client-supplied identifiers as authorization.

## 3. VAD versus endpointing

VAD answers: “Does this frame likely contain speech?”

Endpointing answers: “Has the speaker likely completed the current utterance?”

They are separate decisions. Endpointing may use silence duration, language-model hypotheses, acoustic context, and turn-taking policy. Thresholds must be calibrated for language, microphone, noise, and use case.

## 4. Barge-in policy

A barge-in candidate occurs when speech is detected while assistant audio is being delivered. Confirmation should consider:
- VAD confidence;
- duration/persistence;
- echo cancellation status;
- whether the signal is likely assistant playback leakage;
- current response state;
- product-configured interruption sensitivity.

Do not use a single universal silence or speech threshold for every environment.

## 5. Cancellation propagation

Cancellation must reach:
1. LLM stream;
2. response planner;
3. TTS request;
4. TTS worker queue;
5. egress stream;
6. client playback queue.

Each layer must check cancellation before accepting new output. Since network and provider cancellation may be best-effort, the client must discard chunks with a cancelled response ID.

## 6. Backpressure

- Bound ingress and egress buffers.
- Define queue overflow policy.
- Prefer dropping stale partial hypotheses over blocking microphone ingestion.
- Never silently reorder audio chunks.
- Record dropped-frame metrics.
- Apply admission control to GPU inference.

## 7. Reconnection

- Session token must be short-lived and scoped.
- Reconnect must verify session ownership.
- Resume only when sequence/state can be reconciled.
- If audio continuity cannot be guaranteed, create a new stream generation ID and discard stale frames.
- Expire abandoned sessions.

## 8. Test scenarios

- Normal speech and silence.
- Long pause inside sentence.
- Fast speech.
- Background television.
- Echo from speakers.
- User interruption at beginning/middle/end of assistant sentence.
- User continues speaking while assistant cancels.
- TTS provider stalls.
- Network jitter and packet loss.
- Client reconnects during speech.
- Duplicate and out-of-order frames.
