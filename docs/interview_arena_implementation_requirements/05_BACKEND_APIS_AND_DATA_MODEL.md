# 05 — Backend APIs and Data Model

## 1. Service boundaries

Prefer modular boundaries within the existing backend before creating microservices. Split into independently deployed services only where repository architecture, scaling, or isolation requirements justify it.

Logical modules:
- Interview Catalog.
- Blueprint Registry/Runtime.
- Session Orchestrator.
- Resume Intelligence.
- Candidate Context Retrieval.
- Evaluation.
- Reporting/History.
- Admin Publishing.

## 2. Suggested API contracts

### Catalog
- `GET /api/interviews/categories`
- `GET /api/interviews`
- `GET /api/interviews/{slug}`

Return only published, available interview definitions and public metadata. Never expose internal prompts, rubrics, secrets, or admin-only graph metadata.

### Resume
- `POST /api/resumes` — upload and create processing job.
- `GET /api/resumes/{resume_id}/status`
- `GET /api/resumes` — candidate's own resume documents.
- `DELETE /api/resumes/{resume_id}` — delete according to retention and dependency policy.

### Session
- `POST /api/interview-sessions`
  - Input: `interview_slug`, optional `resume_id`.
  - No custom graph or arbitrary node configuration.
- `GET /api/interview-sessions/{session_id}`
- `POST /api/interview-sessions/{session_id}/responses`
- `POST /api/interview-sessions/{session_id}/complete` (only if explicit completion action is supported)
- `GET /api/interview-sessions/{session_id}/report`
- `GET /api/interview-sessions`

### Admin
- `POST /api/admin/interview-blueprints`
- `PUT /api/admin/interview-blueprints/{id}/draft`
- `POST /api/admin/interview-blueprints/{id}/validate`
- `POST /api/admin/interview-blueprints/{id}/publish`
- `GET /api/admin/interview-blueprints`
- `GET /api/admin/interview-blueprints/{id}/versions`

All admin routes require authorization and audit logging.

## 3. Session creation validation

Reject session creation if:
- Interview slug does not exist.
- No published version is available.
- Candidate does not own the resume ID.
- Resume is not ready and degraded mode was not explicitly accepted.
- Candidate is not authorized or has exceeded configured limits.

On success:
- Pin blueprint version.
- Pin runtime/evaluator/prompt versions.
- Create session state.
- Return session ID, status, initial question, and safe progress metadata.

## 4. Suggested entities

- `interview_definition`
- `interview_blueprint_version`
- `interview_blueprint_node`
- `interview_blueprint_edge`
- `competency_definition`
- `resume_document`
- `resume_processing_job`
- `candidate_profile`
- `candidate_evidence`
- `candidate_graph_entity`
- `resume_embedding_chunk`
- `interview_session`
- `session_node_state`
- `interview_question_instance`
- `candidate_response`
- `evaluation_result`
- `session_competency_state`
- `interview_report`
- `model_prompt_version`
- `audit_event`

## 5. Persistence rules

- Blueprint versions are immutable after publication.
- Session stores blueprint version ID, not only logical interview ID.
- Responses and evaluation results are append-only or versioned.
- Store provenance for extracted resume facts and evaluation evidence.
- Use transactions for response + evaluation state transition where practical; otherwise use an idempotent event/outbox workflow.
- Use unique idempotency keys for upload jobs, response submissions, and session creation where retries may occur.
- Store vectors in a candidate-scoped namespace with metadata filters and deletion support.

## 6. Example session request

```json
{
  "interview_slug": "backend-engineering",
  "resume_id": null
}
```

This is the only candidate configuration required for the standard flow. Do not add arbitrary custom interview definitions to this endpoint.

## 7. Example session response

```json
{
  "session_id": "session_123",
  "status": "active",
  "blueprint": {
    "slug": "backend-engineering",
    "version": "3.2.0",
    "title": "Backend Engineering"
  },
  "current_question": {
    "question_id": "question_456",
    "text": "Explain how you would design an idempotent API endpoint.",
    "response_type": "text"
  },
  "progress": {
    "completed_nodes": 0,
    "total_required_nodes": 8
  }
}
```

## 8. Error format

Use a consistent envelope:
- `code`
- `message`
- `retryable`
- `request_id`
- optional safe `details`

Do not return stack traces, prompts, private resume text, or internal model reasoning.
