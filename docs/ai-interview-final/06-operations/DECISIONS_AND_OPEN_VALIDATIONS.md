# Architecture Decisions and External Validations

## Accepted decisions

### ADR-01 — Modular monolith first
Keep interview domain inside existing FastAPI application. Do not introduce microservices until measured load, independent scaling or team ownership justifies extraction.

### ADR-02 — PostgreSQL is authoritative
Sessions, questions, answers, evaluations, reports, consent and resume metadata are durable relational records. Redis is ephemeral coordination/cache.

### ADR-03 — LangGraph is workflow orchestration
Graph handles adaptive interview dialogue and resumable workflow. Application service owns auth, transactions, state transitions and idempotency.

### ADR-04 — Persistent checkpointing required
In-memory `MemorySaver` is not acceptable for production recovery. Use persistent checkpointer compatible with pinned dependencies.

### ADR-05 — Provider mock is test/development only
Production must not silently run deterministic mock as if it were a real interviewer.

### ADR-06 — HCVE is a voice subsystem, not identity authority
HCVE session must be linked to authenticated interview session and owner.

### ADR-07 — Text mode is always a fallback
Voice provider outage cannot block or corrupt text interview.

### ADR-08 — Resume facts require candidate confirmation
Extracted content is unverified until candidate confirms/corrects it.

### ADR-09 — Evidence-based feedback
Scores are practice signals tied to versioned rubrics and exact answer evidence; no hiring verdicts.

## Validations required before production

1. Exact installed LangGraph version and supported persistent checkpointer package/API.
2. PostgreSQL version/extension availability and migration execution in staging.
3. Actual Sarvam account API capabilities, model identifiers, quota, concurrency, streaming and latency.
4. Actual STT provider choice and whether STT is Sarvam or another adapter.
5. Object storage provider, encryption, private bucket policy and malware scanner.
6. Expected concurrent sessions and agreed SLOs; do not invent capacity numbers.
7. Existing Redis lock/pubsub semantics and outage behavior.
8. Existing judge integration security review before coding track enablement.
9. Candidate data retention/deletion policy approved by product/legal stakeholders.
10. Whether admin catalogue/rubric authoring is in release scope or code-versioned catalogue is sufficient.

No production values, provider endpoints, model IDs, credentials, quotas or latency targets should be invented in documentation or code.
