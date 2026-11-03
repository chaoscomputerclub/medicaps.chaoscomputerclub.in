# End-to-End Execution Lifecycle

## 1. Session creation

1. Client obtains application credential.
2. Client requests session creation.
3. API authenticates and authorizes.
4. Runtime creates session ID and initial state.
5. Runtime loads persona and provider configuration.
6. Runtime negotiates codec, sample rate, channels, and transport.
7. Client receives session configuration and connection details.

## 2. User speech

1. Client captures microphone frames.
2. Audio gateway validates session and frame metadata.
3. Audio frames enter bounded ingress buffer.
4. Audio preprocessor performs required conversion.
5. VAD emits speech-start and speech-end candidates.
6. STT adapter emits partial transcript updates.
7. Endpoint detector decides when a turn is complete.
8. Final transcript and timing metadata are emitted.
9. Turn manager transitions session from listening to processing.

## 3. Response planning

1. Dialogue state manager loads current session state.
2. Context builder combines system policy, persona, recent turns, and permitted retrieved memory.
3. LLM adapter sends request.
4. Streaming tokens may be buffered for safe sentence/phrase boundaries.
5. Response validator checks schema, policy, and content.
6. Response planner assigns intent and expression defaults if model output omits them.

## 4. Expression resolution

1. Validate expression schema version.
2. Load persona constraints.
3. Apply application-level policy.
4. Resolve conflicting tone/emotion/delivery instructions.
5. Clamp numeric values to documented ranges.
6. Apply language and pronunciation configuration.
7. Query TTS capability registry.
8. Map controls to provider-native parameters.
9. Mark controls as applied, approximated, unsupported, or omitted.

## 5. Speech synthesis and streaming

1. Segment text at semantic boundaries.
2. Assign response ID and segment sequence.
3. Submit synthesis request.
4. Receive first audio chunk.
5. Validate format and sequence.
6. Stream chunk to client.
7. Continue synthesis while transport drains.
8. Track delivery/playback progress where available.
9. Mark response complete after all chunks are delivered and playback completion policy is satisfied.

## 6. Interruption

1. Microphone remains active during assistant playback when full-duplex mode is enabled.
2. VAD detects candidate user speech.
3. Interruption policy confirms barge-in using confidence and state.
4. Turn manager marks response as interrupted.
5. Shared cancellation token is signalled.
6. LLM generation, TTS synthesis, and pending stream writes are cancelled.
7. Client discards chunks belonging to cancelled response ID.
8. Dialogue history stores only text known to have been delivered, with uncertainty noted if playback acknowledgement is unavailable.
9. Incoming speech continues through perception.
10. A new turn is created.

## 7. Completion and cleanup

- Release stream buffers and provider resources.
- Persist only permitted metadata.
- Apply retention expiry.
- Emit final trace and quality metrics.
- Close session or return to listening state.

## 8. Sequence diagram

See `../diagrams/sequence_end_to_end.mmd`.
