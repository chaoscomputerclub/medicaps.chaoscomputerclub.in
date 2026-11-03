# Security, Privacy and Responsible Voice Data Handling

## 1. Threat model

Protect:
- live audio streams;
- transcripts;
- session credentials;
- persona and provider configuration;
- memory records;
- voice identity assets;
- operational traces.

Threats include unauthorized session access, replay, cross-session leakage, prompt injection through transcripts/memory, provider credential exposure, data retention beyond policy, and denial of service through oversized or excessive audio streams.

## 2. Authentication and authorization

- Authenticate application and end-user/session according to deployment model.
- Scope session tokens to one session and limited lifetime.
- Enforce ownership checks on all session operations.
- Rotate provider secrets and store them in a secret manager.
- Apply per-application and per-user quotas.
- Protect metrics and administrative endpoints.

## 3. Transport and storage

- Use TLS for control and media transport where applicable.
- Encrypt durable data at rest.
- Do not store raw audio by default.
- Separate operational metadata from content data.
- Redact tokens, secrets, and sensitive content from logs.
- Restrict access to retained evaluation samples.

## 4. Consent and retention

- Explain whether audio/transcripts are processed by external providers.
- Configure retention per application and data category.
- Support deletion requests for durable memory and retained media.
- Use explicit opt-in for long-term memory and voice cloning.
- Make recording/retention status visible to the client where relevant.

## 5. Model and prompt security

- Treat transcript, retrieved memory, tool output, and LLM output as untrusted data.
- Validate structured output against schema and policy.
- Do not execute arbitrary code or commands from model output.
- Keep system and application policy separate from user content.
- Limit tool permissions and validate tool arguments.

## 6. Voice cloning and impersonation

Any voice cloning feature requires documented rights, explicit consent, revocation, and abuse controls. Do not use a person's voice identity without authorization. Production deployments must use licensed or provider-supplied voices unless a separately approved, consent-verified voice-cloning capability is implemented.

## 7. Privacy-preserving observability

Default logs should include IDs, timings, provider/model identifiers, statuses, and error classes—not raw audio or full transcripts. Content sampling for evaluation must be opt-in, access-controlled, and retention-limited.
