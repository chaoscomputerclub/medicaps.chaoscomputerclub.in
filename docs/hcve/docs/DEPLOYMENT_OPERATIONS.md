# Deployment and Operations

## 1. Initial topology

- API/runtime instances: CPU-oriented, horizontally scalable.
- STT/TTS inference workers: CPU or GPU according to selected model.
- LLM provider: hosted API or separately operated inference service.
- Redis: ephemeral session state and bounded queues where required.
- PostgreSQL: durable configuration, persona profiles, consent and optional memory metadata.
- Object storage: disabled unless media retention is an explicit product requirement.

## 2. Local development

Provide:
- Docker Compose for Redis and PostgreSQL.
- `.env.example` with placeholder names only.
- fake adapters for deterministic tests.
- one real provider adapter behind environment configuration.
- sample web client.
- seed persona configuration.

## 3. Environments

- Local: fake adapters and developer credentials.
- Development: shared sandbox providers and synthetic test data.
- Staging: production-like transport, quotas, and model versions.
- Production: secrets manager, network restrictions, autoscaling, backups, alerting.

## 4. Scaling

Scale API/runtime based on active sessions, event-loop saturation, network throughput, and memory per session. Scale inference workers based on queue delay, GPU utilization, VRAM, and model-specific concurrency.

Do not autoscale solely on CPU if GPU queue time is the bottleneck.

## 5. Reliability controls

- Per-provider timeout.
- Circuit breaker.
- Bounded retry with jitter for safe/idempotent operations.
- No retry of non-idempotent synthesis unless request IDs support deduplication.
- Queue admission control.
- Graceful worker drain.
- Dead-letter or failure capture for asynchronous jobs where appropriate.

## 6. Operational runbooks required before production

- Provider outage.
- GPU worker saturation.
- Redis unavailable.
- PostgreSQL unavailable.
- High audio frame drop rate.
- Excessive TTFA.
- Cancellation failure.
- Credential rotation.
- Data deletion request.
- Rollback after schema migration.
