# 08 — Implementation Architecture and APIs

## Logical modules
Domain Catalog, Blueprint Registry, Curriculum/Taxonomy Store, Authoring/Validation Pipeline, Dataset Registry, Knowledge Ingestion/Retrieval, Question Adapter, Judge Adapter, Adaptive Graph Runtime, Session/Report Service, Model Registry, Background Worker, Admin UI, Candidate UI.

Prefer modular boundaries in the existing backend before creating microservices.

## Candidate APIs
- `GET /api/interview-domains`
- `GET /api/interview-domains/{slug}`
- `GET /api/interviews/{slug}`
- `POST /api/interview-sessions` body: `{ "interview_slug": "backend", "resume_id": null }`
- `GET /api/interview-sessions/{id}`
- `POST /api/interview-sessions/{id}/responses`
- `GET /api/interview-sessions/{id}/report`
- `GET /api/interview-sessions`

No candidate endpoint accepts arbitrary graph definitions or custom rubrics.

## Admin APIs
- `POST /api/admin/domains`
- `POST /api/admin/domains/{slug}/blueprints`
- `POST /api/admin/blueprints/{id}/validate`
- `POST /api/admin/blueprints/{id}/generate-dataset`
- `POST /api/admin/blueprints/{id}/run-evaluation`
- `POST /api/admin/blueprints/{id}/publish`
- `GET /api/admin/blueprints/{id}/coverage`
- `GET /api/admin/blueprints/{id}/versions`

All admin routes require authorization and audit logs.

## Version pinning
Each session records blueprint, taxonomy, prompt pack, evaluator, inference runtime/model, embedding, and graph-runtime versions.

## Events
BlueprintValidated, BlueprintPublished, ResumeProcessingCompleted, SessionCreated, QuestionGenerated, ResponseSubmitted, ResponseEvaluated, CompetencyStateUpdated, NodeTransitioned, InterviewCompleted, ReportGenerated.

Use idempotent consumers and transactional outbox when events cross transaction boundaries.
