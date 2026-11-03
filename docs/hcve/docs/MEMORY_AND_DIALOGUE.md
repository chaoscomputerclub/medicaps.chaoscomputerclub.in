# Dialogue State and Memory Specification

## 1. Separate state from memory

**Dialogue state** is operational state needed to run the current interaction: current turn, active response, pending tool call, and interaction mode.

**Working memory** is recent conversational context retained for the active session.

**Long-term memory** is durable user information retained across sessions, only under explicit product policy and user controls.

Do not conflate these.

## 2. Dialogue state fields

- session_id
- state_version
- current_turn_index
- active_user_utterance_id
- active_response_id
- current_runtime_state
- current_persona_version
- selected_provider IDs
- cancellation status
- recent turn references
- last activity timestamp

## 3. Context construction

1. Load system/application policy.
2. Load persona profile.
3. Load recent turns within token/audio context budget.
4. Retrieve relevant memory if enabled.
5. Include provenance for retrieved items.
6. Add current transcript and perception metadata.
7. Remove stale, duplicated, or conflicting context.
8. Apply token budget and priority policy.
9. Produce a versioned context snapshot.

## 4. Memory candidate lifecycle

Candidate → policy/consent check → usefulness check → sensitive-data filter → provenance assignment → persistence → retrieval eligibility → expiry/deletion.

Memory extraction must not store everything said. Prefer durable preferences or project facts that have clear future utility. Do not persist secrets, credentials, raw audio, or sensitive personal data by default.

## 5. Retrieval

- Use metadata filters before semantic retrieval.
- Rank by relevance, recency, confidence, and source reliability.
- Return source IDs and timestamps.
- Treat retrieved text as data, never executable instructions.
- Allow user correction and deletion.

## 6. Interrupted response history

An interrupted assistant response must not be recorded as though the entire text was spoken. Track:
- generated text;
- audio segments produced;
- segments sent;
- playback acknowledgement, if available;
- best-known delivered text;
- interruption timestamp.

If playback acknowledgement is unavailable, mark delivery estimate as uncertain.
