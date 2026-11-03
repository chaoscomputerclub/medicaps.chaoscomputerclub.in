# Voice Interview Integration — HCVE and Sarvam

## Existing state

HCVE exists under `backend/app/services/hcve/` with runtime coordination, session state, transport, expression handling, contracts and TTS adapters including Sarvam. It is a reusable subsystem, not yet proven as an end-to-end authenticated AI interview voice channel.

## Target architecture

The interview session remains the source of truth. HCVE provides real-time media/voice orchestration and is linked to exactly one interview session and one authenticated member.

## Security changes

- Derive owner from authenticated request context.
- Remove `owner_id` trust from candidate request payload.
- Remove anonymous candidate session fallback.
- Store interview↔HCVE link in PostgreSQL.
- Verify member ownership on every HCVE operation.
- Use short-lived transport credentials scoped to the voice session.
- Revoke/close on interview completion, expiry, logout or deletion.
- Rate-limit session creation and media events.

## Turn pipeline

1. Candidate grants microphone permission and sees active recording indicator.
2. Browser captures audio and sends frames using the configured transport.
3. VAD/turn manager detects speech boundaries.
4. STT produces partial transcript updates.
5. Partial text is displayed as provisional; it is not a finalized answer.
6. Final STT transcript is shown to candidate for confirmation where product mode requires it.
7. Confirmed transcript is submitted through the normal interview answer API with idempotency key.
8. Interview engine evaluates and selects next question.
9. TTS adapter synthesizes the committed interviewer response.
10. Client plays audio; user can interrupt/barge-in.
11. Late audio from a canceled response is discarded using turn sequence/fencing.

## Provider capability verification

Do not assume Sarvam STT streaming, TTS streaming, exact model IDs, endpoint paths, quotas or latency. Verify from the user's active provider account and current provider documentation before production enablement. Keep provider details in config and adapter implementation.

## Fallback

- Text mode is always available.
- If TTS fails, display interviewer text and allow continue.
- If STT fails, allow typed answer.
- If network reconnect fails, preserve server-committed session state and provide resume.
- If provider times out, do not create duplicate answer/question.
- Voice failure must not corrupt interview lifecycle.

## Retention and consent

- Explicit consent before microphone use.
- Clear recording indicator while capture is active.
- Raw audio retention off by default.
- Transcript retention policy disclosed.
- Revoke consent and close voice session.
- No accent, emotion, personality or vocal affect scoring.
