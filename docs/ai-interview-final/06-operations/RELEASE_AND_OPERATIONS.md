# Release, Deployment and Operations

## 1. Environments

Use separate:
- local development;
- CI/test;
- staging;
- production.

Never point tests or local destructive scripts at production DB. Store secrets outside source control.

## 2. Configuration

Backend:
- `APP_ENV`
- `DATABASE_URL`
- `REDIS_URL`
- `LLM_PROVIDER`
- provider API key
- provider model alias
- LLM timeout/retry/token budget
- resume storage endpoint/bucket/credentials
- malware scanner endpoint/config
- allowed upload MIME/size/page count
- voice provider configuration
- voice session TTL
- raw audio retention flag (default false)
- rate limits
- public API origin / CORS

Do not add provider-specific credentials to frontend `VITE_*` variables.

## 3. Deployment sequence

1. Backup PostgreSQL and verify restore point.
2. Deploy additive schema migration.
3. Verify migration checks.
4. Deploy backend compatible with old/new schema.
5. Verify health/readiness and provider configuration.
6. Deploy frontend.
7. Enable text interview feature flag for internal cohort.
8. Run smoke tests.
9. Enable resume pipeline after security checks.
10. Enable voice only after provider and ownership gates pass.
11. Expand rollout gradually while monitoring.

## 4. Readiness

Readiness must fail when:
- production LLM provider missing/invalid;
- database unavailable;
- required checkpoint store unavailable;
- required resume scanner/storage unavailable when resume upload feature enabled.

Optional voice provider outage should disable voice mode while text mode remains healthy.

## 5. Monitoring

Metrics:
- session creation/start/completion/failure counts;
- answer processing latency;
- graph node duration and retries;
- checkpoint resume failures;
- provider latency, timeout, 429, 5xx and token usage;
- duplicate answer replay and idempotency conflict counts;
- voice STT/TTS latency and interruption rate;
- resume scan/parse failures;
- queue/lease age;
- report generation time;
- DB pool saturation and Redis health.

Alerts:
- production mock provider detected;
- persistent checkpointer unavailable;
- elevated failed interview turns;
- repeated provider failures;
- stale turn leases;
- cross-owner authorization failure spike;
- migration/DB integrity failure;
- storage scanner outage.

## 6. Backup and restore

- PostgreSQL backup schedule and retention defined by platform policy.
- Verify restore in non-production on a schedule.
- Object storage backup/versioning policy for resume assets.
- Redis does not need durable backup for interview truth; loss must not lose sessions or answers.
- Checkpointer storage backup/recovery follows DB policy.

## 7. Rollback

- Prefer feature flag disable for new interview capability.
- Do not drop columns/tables during rollback.
- Roll back app version only if schema remains backward-compatible.
- If schema migration is destructive, use forward-fix rather than automatic down migration.
- Preserve answer/session rows and report history.
- Disable voice independently if HCVE/provider issue occurs.

## 8. Operational runbooks

### LLM outage
- Confirm provider status and credentials.
- Disable new sessions or show unavailable state if no real provider.
- Do not enable mock in production.
- Keep committed sessions readable.
- Retry only transient failed turns.

### Checkpoint mismatch
- Pause affected session processing.
- Compare DB lifecycle/turn rows with graph checkpoint.
- Use reconciliation procedure.
- Never replay candidate-visible question blindly.

### Voice outage
- Stop new voice session creation.
- Keep existing text interview path available.
- Close/revoke invalid voice sessions.
- Preserve confirmed transcript and session state.

### Resume scanner/parser outage
- Disable upload acceptance or hold uploads in quarantine.
- Do not parse unscanned files.
- Inform candidate and allow text context entry as fallback.
