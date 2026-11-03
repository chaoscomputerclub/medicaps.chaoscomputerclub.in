# Security, Privacy and Abuse Controls

## Authentication and authorization

- Use existing CCC authentication dependency.
- Every session/profile/resume/report/voice resource is owner-scoped.
- Do not accept `member_id`, `owner_id`, PRN or role from candidate request body as authority.
- Admin endpoints require explicit admin RBAC.
- Test cross-member access for every resource and nested child record.

## Prompt/data boundary

- Remove PRN from candidate context.
- Exclude email, phone, auth tokens and unrelated profile data.
- Candidate uploads and job descriptions are untrusted data.
- Prompt logs disabled or redacted by default.
- Secrets only from server-side secret store/environment.

## Upload security

- MIME sniffing, extension allowlist, file size/page count limit.
- Malware scan.
- Private object storage.
- Parser sandbox/time/memory limits.
- Safe filenames and opaque object keys.
- No macro/script execution.
- Rate limit and quota per member.

## API abuse controls

- Session creation rate limit.
- Answer submission rate limit.
- Resume upload quota.
- Provider concurrency and token budget.
- Voice session cap and frame-size/rate limits.
- Idempotency and anti-replay.
- Request correlation IDs.

## Data lifecycle

- Explicit consent for resume use and voice capture.
- Raw audio retention off by default.
- Documented transcript/report retention.
- Export/delete workflow.
- Revocation stops future use; define active-session behavior.
- Deletion cascades through derived facts, vector entries and cache.

## AI safety

- No hiring decisions.
- No protected trait inference.
- No emotion/personality/voice/accent scoring.
- No fabricated candidate history.
- Model output schema validation.
- Candidate-provided instructions cannot override system policy.
- Model/provider outages degrade to text or explicit unavailable state, not fake AI output.

## Audit

Record administrative actions and consent changes. Do not record raw answer content in security audit logs.
