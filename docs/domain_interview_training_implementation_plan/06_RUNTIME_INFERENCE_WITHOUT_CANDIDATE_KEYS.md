# 06 — Runtime Inference Without Candidate API Keys

Candidates never provide provider keys. The platform owner configures the runtime.

## Runtime options
1. Reuse an existing server-side provider integration in the repository.
2. Self-host a compatible model behind a private internal endpoint. Validate license, hardware/VRAM, throughput, context length, structured output reliability, concurrency, quantization impact, and operating cost.
3. Use an approved managed endpoint with credentials stored server-side. This remains an external service, even though candidates do not manage keys.

## Coding agent limitation
Coding-agent access in an IDE/chat session does not automatically provide the application with a supported production inference API or deployment permission. Use it for offline authoring, code, tests, and QA. If the exact coding-agent model is requested for live interviews, verify an authorized API/deployment path. Do not scrape, automate, or proxy its UI.

## Backend abstraction
Provide methods such as `generate_question`, `evaluate_response`, `embed_text`, and `health_check`. Implement adapters for the selected runtime. Secrets belong in environment/secret manager, never frontend or logs.

## Failure behavior
Question generation failure → approved question-bank fallback.
Judge failure → persist response as pending and retry idempotently; never pretend it was scored.
Embedding failure → allow no-resume path or approved degraded mode.
ML selector failure → deterministic graph rules.
