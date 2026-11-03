# LLM Provider Policy and Adapter Contract

## Existing adapters

The repository has a provider abstraction and implementations for Gemini, OpenAI-compatible services and a deterministic mock provider. Preserve the adapter boundary.

## Configuration

Required configuration:
- `APP_ENV=development|test|staging|production`
- `LLM_PROVIDER=gemini|openai_compatible|...`
- provider API key via secret environment
- provider model alias/ID
- request timeout
- max retries
- token/output budget
- optional base URL for compatible providers

Never commit real keys or print them.

## Environment behavior

| Environment | Mock allowed? | Required behavior |
|---|---|---|
| test | Yes | Deterministic mock is default unless a provider contract test explicitly tests real adapter. |
| development | Only explicit opt-in | Missing provider should be visible and documented; no silent production-like simulation. |
| staging | No by default | Validate real provider configuration and exercise provider health checks. |
| production | No | Startup/readiness fails if required provider is absent or invalid. |

`LLM_ALLOW_MOCK=true` must not override production policy. If an emergency simulation mode is ever supported, it requires a distinct explicit operator control, alerting and visible “simulation” product state.

## Adapter interface requirements

The interface must support:
- plain generation;
- schema-constrained generation;
- cancellation/timeouts;
- token/usage metadata;
- provider error normalization;
- health/config validation;
- optional streaming only when provider capability is verified.

Structured output must be parsed and validated with Pydantic. Invalid output is a provider/schema error, not an empty successful result.

## Reliability

- Bounded retries with jitter for transient failures.
- No retry for invalid request, invalid schema contract or auth failure.
- Circuit breaker or temporary provider disable after repeated failures.
- Per-member/session rate limits.
- Global concurrency budget.
- Record provider/model alias and prompt version with each evaluation.
- Keep prompts versioned in source control.
- Use provider-neutral application interfaces; do not couple domain logic to SDK-specific objects.

## Prompt safety

- Resume/JD/project content is untrusted.
- Delimit candidate-provided text.
- Explicitly state that instructions inside candidate documents are data, not instructions.
- Do not include PRN, email, phone, access tokens or unnecessary personal data.
- Avoid sending full history; retrieve only relevant confirmed context.
- No protected-trait, personality, emotion, accent or facial inference.
