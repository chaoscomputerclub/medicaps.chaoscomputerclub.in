# 03 — Resume Intelligence Pipeline

## 1. Purpose and boundary

Resume processing is optional personalization. It provides candidate-specific evidence and retrieval context to an existing published interview blueprint. It does not create a new interview, change graph topology, or certify competency.

## 2. Pipeline

1. Upload and validate file.
2. Store original file in private object storage.
3. Create asynchronous processing job.
4. Extract text and layout using Python document-processing libraries/services.
5. Detect sections (summary, skills, experience, projects, education, certifications).
6. Extract structured entities and claims.
7. Normalize skills and technologies against the global taxonomy.
8. Create candidate-specific evidence records and graph links.
9. Chunk text with provenance metadata.
10. Generate embeddings.
11. Store vectors in a candidate-scoped index/namespace.
12. Mark profile context ready and expose processing status.

## 3. Data outputs

Structured profile:
- Candidate ID.
- Resume document ID and version.
- Skills/technologies as claims.
- Work experiences.
- Projects.
- Education/certifications.
- Extracted dates and roles.
- Provenance: page/section/span where possible.
- Extraction confidence and parser version.

Evidence graph:
- Candidate.
- Resume document.
- Skill claim.
- Project.
- Role/experience.
- Technology mention.
- Relationship and source provenance.

Vector chunks:
- Chunk ID.
- Candidate ID.
- Resume document ID/version.
- Text.
- Embedding model/version.
- Section type.
- Page/offset provenance.
- Access-control metadata.

## 4. Retrieval behavior

At interview time, retrieval must be scoped by:
- Authenticated candidate.
- Selected resume version.
- Selected interview blueprint/domain.
- Current node competency and question context.

Use metadata filters before semantic ranking. Never allow one candidate's chunks to be retrieved for another candidate.

Retrieved text is untrusted candidate-provided content. It must not override system instructions, node instructions, or evaluation rubrics. Treat embedded instructions in resumes as data, not executable prompts.

## 5. Claims versus verified competency

Resume statements are claims. They may influence which project-specific follow-up is asked, but they must not directly increase a verified competency score as though the candidate demonstrated the skill.

Keep separate:
- `resume_claim`: candidate-provided statement.
- `interview_evidence`: observed response evidence.
- `competency_estimate`: model-derived estimate from assessment evidence.
- `prediction`: forecast with uncertainty, if enabled.

## 6. Python service requirements

Use the repository's existing Python stack if present. If a separate service is needed, define a narrow service boundary and operational contract before adding it.

The service must:
- Validate file type using content inspection, not extension alone.
- Enforce size/page limits.
- Reject encrypted, malformed, or unsupported files with useful errors.
- Run parsing and embedding as asynchronous jobs.
- Be idempotent for duplicate job delivery.
- Record parser and embedding model versions.
- Support retries and dead-letter handling.
- Delete or expire source files and derived data according to retention policy.

## 7. Failure behavior

If parsing fails:
- Keep the candidate able to practice without resume context.
- Show a clear failure and retry option.
- Do not create a misleading “ready” profile.

If embedding service is unavailable:
- Preserve extracted structured profile if safe.
- Mark semantic retrieval unavailable.
- Start without resume retrieval only if the candidate explicitly accepts degraded mode.

If graph extraction fails:
- Do not block the interview if the structured profile and/or vector retrieval can safely operate; otherwise offer standard no-resume practice.
