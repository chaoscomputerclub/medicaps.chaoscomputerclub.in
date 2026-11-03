# HCVE Production Readiness and Launch Checklist

## Purpose

This checklist defines the evidence required to call HCVE production-ready. It is mandatory and applies to the complete product, not merely the first end-to-end demo. Check an item only when implementation and evidence exist.

## 1. Requirements traceability
- [ ] Every applicable PRD functional and non-functional requirement maps to backlog work.
- [ ] Every story has acceptance criteria, tests, owner, and evidence.
- [ ] All P0/P1/P2 requirements are complete or have a formally approved non-applicability decision.
- [ ] API, event, schema, and configuration compatibility policies are documented.

## 2. Runtime and media
- [ ] Full-duplex streaming is verified on supported transports and clients.
- [ ] VAD, endpointing, turn detection, barge-in, and cancellation are tested under noise and overlapping speech.
- [ ] Chunk ordering, timestamps, buffering, jitter, backpressure, and stale-output suppression are verified.
- [ ] Reconnect, session expiry, device changes, and partial-turn recovery are tested.
- [ ] Per-session serialization, concurrency limits, quotas, and resource cleanup are verified.

## 3. Intelligence, expression and rendering
- [ ] STT/LLM/TTS adapters declare capabilities, versions, limitations, and health.
- [ ] Provider switching, timeout, circuit breaker, fallback, and provider outage behaviour are tested.
- [ ] Expression schema validation, persona policy, conflict resolution, and unsupported-control reporting are tested.
- [ ] Voice identity consistency and expression continuity are evaluated across chunks and turns.
- [ ] Pronunciation, multilingual behaviour, and supported code-switching scenarios are tested.
- [ ] Memory consent, provenance, correction, expiry, export/deletion, and retrieval safety are verified.

## 4. Security, privacy and abuse prevention
- [ ] Threat model and security review are complete.
- [ ] Authentication, authorization, tenant isolation, session token scope, rate limits, and abuse controls are tested.
- [ ] TLS, secret management, encryption at rest, dependency/container scanning, and patch policy are implemented.
- [ ] Audio/transcript retention is disabled by default unless explicitly configured and consented.
- [ ] Consent, disclosure, deletion, and data-subject workflows are tested end to end.
- [ ] Logs/traces do not leak audio, transcripts, credentials, or sensitive memory content.
- [ ] Voice identity/voice cloning restrictions and authorization checks are enforced.

## 5. Reliability and performance
- [ ] Approved SLOs exist for availability, TTFA, turn latency, interruption latency, error rate, and recovery.
- [ ] Load tests cover expected peak concurrency and documented headroom.
- [ ] Soak tests reveal no unbounded memory, queue, connection, or GPU-resource growth.
- [ ] Network impairment tests cover latency, jitter, packet loss, disconnects, and bandwidth constraints.
- [ ] Chaos/failure tests cover Redis, PostgreSQL, transport, model providers, queues, and inference workers.
- [ ] Backpressure, load shedding, retry budgets, idempotency, and graceful degradation are verified.
- [ ] Capacity model and per-minute/per-session cost model are documented.

## 6. Operations and deployment
- [ ] CI/CD, reproducible artifacts, environment configuration, migrations, and rollback are verified.
- [ ] Liveness/readiness checks, metrics, distributed traces, dashboards, and actionable alerts exist.
- [ ] Operational runbooks cover incidents, provider outages, degraded mode, scaling, and data recovery.
- [ ] Backup and restore have been tested; RPO/RTO are documented and approved.
- [ ] GPU/CPU worker scheduling, autoscaling or manual scaling procedures, and capacity limits are documented.
- [ ] On-call ownership, escalation path, and release approval are assigned.

## 7. Client and developer experience
- [ ] Supported browsers, OS versions, devices, audio devices, codecs, and permission states are documented.
- [ ] Client handles microphone permission denial, device removal, playback restrictions, reconnects, and interruption UX.
- [ ] Public API/SDK examples, authentication setup, provider configuration, and error semantics are documented.
- [ ] Accessibility and keyboard/screen-reader behaviour are reviewed for supported clients.

## 8. Quality evaluation
- [ ] A versioned evaluation corpus covers accents, languages, noise, speaking styles, interruptions, and edge cases.
- [ ] Objective metrics are reported by provider/model/hardware/network profile and percentile.
- [ ] Human evaluation measures naturalness, conversational appropriateness, expression adherence, voice consistency, and turn-taking.
- [ ] Regression evaluation runs for every material model, prompt, adapter, or runtime change.
- [ ] Quality regressions have thresholds, owners, and rollback criteria.

## 9. Launch decision
- [ ] All applicable checklist items are complete with links to evidence.
- [ ] Known limitations and accepted risks are documented with owners and expiry dates.
- [ ] Product, engineering, security/privacy, and operations owners approve launch.
- [ ] Rollback and incident response have been rehearsed.

**Launch rule:** a demo is not a release candidate. Any unchecked applicable item blocks production sign-off.
