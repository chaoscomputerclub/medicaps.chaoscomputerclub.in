# 07 — Security, Privacy, and Reliability

## 1. Authentication and authorization

- Candidate can access only their own resumes, sessions, responses, and reports.
- Admin endpoints require explicit admin role and server-side authorization.
- Never trust candidate ID supplied by the client; derive it from authenticated identity.
- Enforce ownership checks on every resume/session/report access.
- Apply rate limits to upload, session creation, response submission, and expensive model calls.

## 2. Resume security

- Validate actual file content and MIME type.
- Enforce file size, page count, and decompression limits.
- Malware scan where supported by infrastructure.
- Store files privately; use short-lived signed URLs if needed.
- Do not expose raw resume URLs publicly.
- Encrypt data in transit and at rest according to deployment capabilities.
- Define retention, deletion, and backup expiry.
- Ensure deletion covers original file, extracted text, graph facts, chunks, and vector records where legally/operationally required.

## 3. Prompt injection and untrusted content

Resume text, candidate responses, and retrieved chunks are untrusted inputs.
- Delimit retrieved content.
- Explicitly instruct models to treat it as data.
- Never allow retrieved text to override system or blueprint instructions.
- Validate model outputs against strict schemas.
- Apply output moderation and question policy checks.
- Do not expose internal prompts or hidden rubrics.

## 4. Reliability

- Resume processing is asynchronous, retryable, and idempotent.
- Response submission must be idempotent.
- Persist response before advancing the graph.
- Use an outbox/event pattern if evaluation and state updates cross transactional boundaries.
- Provide a deterministic fallback question when generation fails.
- Provide rules-based node selection if ML service is unavailable.
- Preserve session state across refresh and transient disconnects.
- Set timeouts and bounded retries for external model/vector services.

## 5. Observability

Record structured events:
- catalog request outcomes.
- resume job lifecycle.
- session creation and completion.
- node selection reason code.
- question generation validation result.
- evaluator latency and schema validity.
- state transition outcome.
- model/provider errors.
- report generation outcome.

Metrics:
- resume processing success rate and latency.
- interview start success rate.
- question generation success/fallback rate.
- evaluation latency and failure rate.
- session completion/abandonment rate.
- retrieval hit rate and cross-tenant isolation test results.
- cost per completed interview.

Do not log full resumes, raw candidate answers, credentials, or sensitive personal data by default. Use redaction and controlled access for debugging.
