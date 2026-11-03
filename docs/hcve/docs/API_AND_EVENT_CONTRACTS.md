# API and Event Contract Specification

## 1. Contract rules

- Public HTTP APIs are versioned under `/v1`.
- Events include `schema_version`, `event_id`, `event_type`, `session_id`, and `timestamp`.
- Turn and response events include `turn_id` and/or `response_id`.
- All timestamps use RFC 3339 UTC.
- IDs are opaque strings.
- Events are idempotent by `event_id`.
- Unknown optional fields may be ignored; unknown enum values must be handled safely.
- Audio is transported as binary media frames, not base64 JSON for high-throughput streaming unless a constrained environment requires it.

## 2. Proposed control-plane endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/v1/sessions` | Create a session |
| GET | `/v1/sessions/{session_id}` | Read session status |
| DELETE | `/v1/sessions/{session_id}` | Close a session |
| POST | `/v1/sessions/{session_id}/interrupt` | Explicit client interruption |
| GET | `/health` | Process health |
| GET | `/ready` | Dependency readiness |
| GET | `/metrics` | Operational metrics (protected as appropriate) |

## 3. Session creation example

```json
{
  "application_id": "app_demo",
  "persona_id": "persona_default",
  "language": "en-IN",
  "transport": {
    "type": "webrtc",
    "audio_input": {
      "sample_rate_hz": 48000,
      "channels": 1
    },
    "audio_output": {
      "sample_rate_hz": 24000,
      "channels": 1
    }
  },
  "memory": {
    "mode": "session_only"
  }
}
```

## 4. Event envelope

```json
{
  "schema_version": "1.0",
  "event_id": "evt_opaque",
  "event_type": "user_speech_final",
  "session_id": "ses_opaque",
  "turn_id": "turn_opaque",
  "timestamp": "2026-10-31T10:00:00Z",
  "payload": {}
}
```

## 5. Core events

- `session.created`
- `session.closed`
- `audio.input.started`
- `audio.input.frame`
- `speech.started`
- `transcript.partial`
- `transcript.final`
- `user.turn.completed`
- `assistant.response.started`
- `assistant.text.delta`
- `assistant.expression.resolved`
- `assistant.audio.chunk`
- `assistant.response.completed`
- `assistant.response.cancelled`
- `provider.error`
- `session.recovering`

## 6. Audio chunk event metadata

```json
{
  "response_id": "resp_opaque",
  "segment_id": "seg_opaque",
  "sequence": 4,
  "format": {
    "codec": "pcm_s16le",
    "sample_rate_hz": 24000,
    "channels": 1
  },
  "duration_ms": 120,
  "payload_ref": "binary-frame-or-transport-payload"
}
```

The example shows control metadata only. Actual audio bytes travel in the negotiated media channel.

## 7. Cancellation semantics

- Cancellation is scoped to response ID.
- Cancellation is idempotent.
- Cancelled response IDs are tombstoned for the session lifetime or a bounded replay window.
- Client must discard late chunks for cancelled response IDs.
- Provider cancellation is best-effort unless the adapter contract guarantees otherwise.
- A new response must receive a new response ID.

## 8. Compatibility

- Add optional fields in minor-compatible changes.
- Breaking field meaning, requiredness, or enum semantics requires a major schema version.
- Maintain contract tests for each provider adapter and client SDK.
