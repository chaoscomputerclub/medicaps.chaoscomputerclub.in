# Observability, Testing and Evaluation

## 1. Correlation model

Propagate:
- trace_id
- session_id
- turn_id
- response_id
- provider_request_id
- audio_stream_id
- segment_id

## 2. Core metrics

### Latency
- session_setup_ms
- audio_ingress_delay_ms
- vad_decision_ms
- stt_partial_latency_ms
- stt_final_latency_ms
- llm_first_token_ms
- expression_resolution_ms
- tts_first_chunk_ms
- time_to_first_audio_ms
- interruption_to_playback_stop_ms
- end_to_end_turn_ms

### Reliability
- session_creation_success_total
- provider_error_total
- stream_disconnect_total
- audio_frame_drop_total
- cancellation_failure_total
- fallback_activation_total
- malformed_model_output_total

### Resource
- active_sessions
- queue_depth by worker/provider
- GPU utilization and memory
- CPU/memory usage
- cost per session minute

## 3. Logging rules

- Structured logs only.
- No raw audio by default.
- No full transcript by default.
- Redact secrets and user identifiers.
- Use sampled traces for high-volume paths.
- Keep provider error details but remove credentials and sensitive payloads.

## 4. Test pyramid

### Unit
Schema validation, expression resolution, state transitions, segmenter, capability mapping, retry policy.

### Component
Fake STT/LLM/TTS adapters, cancellation, queue backpressure, session repository.

### Integration
Real provider sandbox, Redis/PostgreSQL, transport handshake, streaming, reconnection.

### End-to-end
Speak → transcribe → respond → synthesize → interrupt → recover.

### Load and resilience
Concurrent sessions, slow provider, provider outage, packet loss, GPU saturation, Redis outage, process restart.

## 5. Quality evaluation

Maintain a versioned test set with:
- short and long utterances;
- ambiguous references;
- code-switching;
- accents and varied speech rates;
- background noise;
- interruptions;
- emotional language without assuming user emotion;
- multi-turn context references;
- provider failure scenarios.

Human reviewers should rate:
- response relevance;
- conversational timing;
- naturalness;
- prosody appropriateness;
- voice consistency;
- interruption handling;
- context retention.

Do not treat automated emotion classification as ground truth.

## 6. Release gates

Each release publishes:
- provider/model versions;
- test corpus version;
- latency percentiles;
- failure rates;
- human-evaluation summary;
- known limitations;
- regressions and mitigations.
