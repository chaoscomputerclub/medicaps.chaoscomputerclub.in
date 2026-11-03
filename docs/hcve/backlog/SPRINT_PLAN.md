# Production Delivery Plan — Agile Workstreams

This is a dependency-driven execution sequence for the **complete production scope**. Sprints/workstreams are implementation increments, not MVP/release-scope boundaries. Every requirement in the PRD and backlog remains in scope through production acceptance. Sprint length and capacity should be set by the team. Do not promise dates before provider selection and latency benchmarks.

## Sprint 0 — Discovery and technical spikes
- Confirm product use case and target platforms.
- Benchmark candidate transport.
- Benchmark one STT and one TTS provider.
- Verify streaming and cancellation support.
- Establish baseline latency.
- Record ADRs for transport, providers, and deployment.

**Exit:** Architecture risks and provider limitations are documented.

## Sprint 1 — Foundation and session lifecycle
- HCVE-001 project skeleton.
- HCVE-002 domain contracts.
- HCVE-010 session lifecycle.
- Initial CI, fake adapters, health/readiness.

**Exit:** A session can be created and closed; contracts validate.

## Sprint 2 — Audio ingress and perception
- HCVE-011 audio ingress.
- HCVE-020 VAD.
- HCVE-021 first STT adapter.
- HCVE-022 baseline endpointing.

**Exit:** Microphone audio becomes a finalized transcript event.

## Sprint 3 — Dialogue and LLM
- HCVE-030 dialogue state.
- HCVE-031 LLM adapter.
- HCVE-032 context builder and response planner.

**Exit:** A transcript produces a validated response envelope.

## Sprint 4 — Expression and first TTS
- HCVE-040 expression schema.
- HCVE-041 persona controller.
- HCVE-044 capability mapper.
- HCVE-050 TTS contract.
- HCVE-051 first TTS adapter.

**Exit:** A response is expressed and rendered to audio.

## Sprint 5 — Streaming and interruption
- HCVE-012 audio egress.
- HCVE-052 segmentation.
- HCVE-060 state machine.
- HCVE-061 barge-in.
- HCVE-062 cancellation.

**Exit:** End-to-end voice interaction supports interruption and stale audio suppression.

## Sprint 6 — Production reliability, security and observability
- HCVE-080 tracing/metrics.
- HCVE-082 security/privacy.
- Provider timeouts, backpressure, failure tests.
- Baseline load and resilience testing.

**Exit:** Core runtime has measurable reliability evidence; this is an intermediate engineering gate, not production acceptance.

## Sprint 7+ — Production completeness and advanced capabilities
- Complete consented long-term memory lifecycle and user controls.
- Multi-provider support, capability discovery, failover and tested provider replacement.
- Multilingual and code-switching support plus pronunciation management.
- Advanced expression/prosody and voice consistency controls.
- Supported client SDK/reference clients and device/network recovery.
- Evaluation dashboard, replay tooling with privacy controls, and human review workflow.
- Native audio model adapters where selected and supported.
- Autoscaling, capacity planning, backup/restore, disaster recovery, security validation, accessibility, and operational runbooks.
- Full production acceptance campaign against every applicable gate in `docs/PRD.md` and `docs/PRODUCTION_READINESS.md`.

## Sprint operating cadence

- Planning: select stories based on dependencies and capacity.
- Daily: update status and surface blockers.
- Review: demonstrate working behaviour, not slideware.
- Retrospective: identify process and architecture improvements.
- Backlog refinement: keep acceptance criteria testable.

## Workflow states

`BACKLOG → READY → IN_PROGRESS → CODE_REVIEW → QA → DONE`

Use `BLOCKED` as a flag with a reason, not as a silent parking lot.

## Definition of ready
Clear goal, testable acceptance criteria, dependencies, contract impact, security impact, and referenced diagrams.

## Definition of done
Tests pass, observability exists, docs/diagrams are current, no secrets are committed, and implementation evidence is recorded.

## Mandatory final production hardening workstream

Do not close the project after the first end-to-end demonstration. Before production sign-off, execute and evidence:
- Full functional traceability from every PRD requirement to code, tests, and deployment configuration.
- Load/soak/chaos/network impairment testing at approved capacity.
- Security, privacy, abuse, tenant-isolation, and dependency/license reviews.
- Provider outage, fallback, reconnect, cancellation, and recovery drills.
- SLO dashboards, alerts, runbooks, backup/restore, rollback, and disaster recovery.
- Cross-platform client/device compatibility and accessibility testing.
- Human quality evaluation and documented release sign-off.

The project is complete only when all applicable production acceptance gates pass; unfinished work must remain visible in the backlog and blocks production sign-off.
