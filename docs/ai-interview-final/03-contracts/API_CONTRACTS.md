# API Contracts — Target Behavior

The routes below describe the stable external contract to implement. Preserve existing paths where possible; if an existing route differs, update the frontend and API together and document the compatibility decision.

Base prefix: existing `/api` mounting. Authentication: existing authenticated member dependency. All session endpoints are owner-scoped.

## 1. Categories

`GET /api/interview/categories`

Response: array of category objects:
```json
[
  {
    "id": "BACKEND",
    "name": "Backend Engineering",
    "description": "APIs, data, concurrency and reliability",
    "badge": "Technical",
    "icon": "backend",
    "default_topics": ["API design", "SQL", "concurrency"],
    "supports_code": false,
    "supports_diagrams": false
  }
]
```
Backend category registry is authoritative.

## 2. Candidate profile

`GET /api/interview/profile`
`PATCH /api/interview/profile`
`DELETE /api/interview/profile`

Profile fields:
- `declared_skills: string[]`
- `projects: CandidateProject[]`
- `preferred_tracks: string[]`
- `learning_goals: string[]`
- `context_consent: boolean`
- `updated_at`

Never expose internal member identifiers beyond existing auth contract. Do not return PRN in prompt context.

## 3. Resume assets

`POST /api/interview/resumes` — multipart upload.
- Accept configured PDF/DOCX/TXT only.
- Enforce size, page count, MIME sniffing and malware scan.
- Return `202` with `asset_id`, `status=PROCESSING`.
- Do not return extracted facts as confirmed.

`GET /api/interview/resumes/{asset_id}` — status and extraction preview.
`PATCH /api/interview/resumes/{asset_id}/facts` — candidate edits/confirms extracted facts.
`POST /api/interview/resumes/{asset_id}/consent` — explicit consent to use this asset in interviews.
`DELETE /api/interview/resumes/{asset_id}` — deletion request and status.

Extraction fact shape:
```json
{
  "fact_id": "uuid",
  "kind": "PROJECT|SKILL|EXPERIENCE|EDUCATION|ACHIEVEMENT",
  "value": "Designed an async job processing service",
  "source": {"document_id": "uuid", "page": 2, "section": "Projects"},
  "confidence": 0.87,
  "candidate_status": "UNREVIEWED|CONFIRMED|CORRECTED|REJECTED"
}
```
Confidence is extraction confidence, not truth probability.

## 4. Session setup and history

`POST /api/interview/sessions`
```json
{
  "target_role": "Backend Engineer",
  "experience_level": "ENTRY_LEVEL",
  "category": "BACKEND",
  "difficulty": "MEDIUM",
  "duration_minutes": 45,
  "preferred_language": "python",
  "focus_topics": ["FastAPI", "PostgreSQL", "distributed systems"],
  "job_description": null,
  "resume_asset_ids": [],
  "mode": "TEXT",
  "language": "en"
}
```
Return session with `state=CREATED`, `plan_version`, `rubric_version`, and metadata.

`GET /api/interview/sessions?limit=20&offset=0&state=COMPLETED`
`GET /api/interview/sessions/{session_id}`

Pagination must have a stable ordering (created_at DESC, id DESC).

## 5. Lifecycle

`POST /api/interview/sessions/{id}/start`
`POST /api/interview/sessions/{id}/pause`
`POST /api/interview/sessions/{id}/resume`
`POST /api/interview/sessions/{id}/complete`
`POST /api/interview/sessions/{id}/abandon`

All return authoritative session state. Illegal transitions return `409 SESSION_STATE_CONFLICT`.

## 6. Answer submission

`POST /api/interview/sessions/{id}/answer`

Headers:
`Idempotency-Key: <UUID>`

Body:
```json
{
  "question_id": "uuid",
  "answer_text": "I would use an outbox to make event publication reliable...",
  "submitted_code": null,
  "transcript_source": "TEXT",
  "transcript_final": true,
  "client_turn_id": "uuid"
}
```

Rules:
- Question must belong to session.
- Session must be in `AWAITING_ANSWER`.
- Authenticated member must own session.
- `transcript_final` must be true.
- The same idempotency key and same normalized payload returns the original result.
- Same key with different payload returns `409 IDEMPOTENCY_KEY_REUSED`.
- Concurrent requests for one question cannot create multiple committed answers/evaluations.
- Return only after answer record and turn processing status are durable. If evaluation is asynchronous, return `202 PROCESSING` with poll/stream location; do not pretend it is complete.

## 7. Turn status and report

`GET /api/interview/sessions/{id}/turns/{turn_id}`
`GET /api/interview/sessions/{id}/report`
`POST /api/interview/sessions/{id}/report/regenerate` (admin/explicit policy only; versioned output)

Report regeneration must create a new report version, never overwrite historical report silently.

## 8. Voice binding

`POST /api/interview/sessions/{id}/voice-session`
- Requires authenticated member and session ownership.
- Server derives `owner_id`; request cannot set it.
- Returns HCVE session ID, transport, expiry, supported capabilities and consent requirements.

`POST /api/interview/sessions/{id}/voice-session/{voice_id}/interrupt`
`DELETE /api/interview/sessions/{id}/voice-session/{voice_id}`

HCVE internal endpoints must not become an ownership bypass. Every transport event must bind voice ID, interview ID, owner ID and turn sequence.

## 9. Error envelope

```json
{
  "error": {
    "code": "SESSION_STATE_CONFLICT",
    "message": "This interview cannot accept an answer in its current state.",
    "retryable": false,
    "correlation_id": "uuid",
    "details": {}
  }
}
```

Required codes:
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `SESSION_STATE_CONFLICT`
- `IDEMPOTENCY_KEY_REUSED`
- `TURN_ALREADY_PROCESSING`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_TIMEOUT`
- `RESUME_REJECTED`
- `CONSENT_REQUIRED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Do not expose stack traces, provider secrets, raw prompt content or internal database errors.
