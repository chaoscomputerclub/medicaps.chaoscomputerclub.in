# Data Model and Migration Specification

## 1. Existing entities

The supplied repository already defines:
- `interview_sessions`
- `interview_questions`
- `interview_answers`
- `interview_evaluations`
- `interview_reports`
- `candidate_profiles`

Do not recreate these tables. Extend them through migrations and preserve existing records.

## 2. Existing fields to retain

### interview_sessions
Existing configuration includes target role, experience level, category, difficulty, duration, preferred language, focus topics, job description and resume notes. Existing lifecycle timestamps and question counters remain.

Add:
- `mode` (`TEXT`, `VOICE`)
- `language`
- `plan_version`
- `rubric_version`
- `provider_profile` (non-secret identifier)
- `last_committed_turn_id` if needed for reconciliation
- `failure_code`, `failure_at`
- `abandoned_at`, `expires_at`
- `version` integer for optimistic concurrency

### interview_questions
Retain parent-question relationship, type, topic, title, prompt, code starter, judge slug, expected criteria and order.

Add:
- `plan_version`
- `competency_key`
- `difficulty_level`
- `committed_at`
- `metadata` JSON with schema validation at application boundary.

### interview_answers
Retain text, submitted code, judge result and audio duration metadata.

Add:
- `payload_hash`
- `processing_state` (`RECEIVED`, `PROCESSING`, `COMMITTED`, `FAILED`)
- `finalized_at`
- `transcript_source`
- `transcript_confidence` (optional; never use as candidate ability score)
- `client_turn_id`
- `worker_fence`
- `provider_usage` JSON with cost/token metadata, no secrets.

### interview_evaluations
Add:
- `rubric_version`
- `evaluation_version`
- `confidence_band`
- `limitations` JSON
- `created_by`/evaluation source metadata (`MODEL`, `HUMAN_REVIEW`, `REVISED_MODEL`).

### interview_reports
Add:
- `report_version`
- `rubric_version`
- `plan_version`
- `generated_at`
- `supersedes_report_id`
- `confidence_and_limitations`.

### candidate_profiles
Add:
- explicit profile consent fields;
- structured projects;
- update/version metadata;
- deletion status if soft-delete is required.

## 3. New entities

### candidate_resume_assets
- `id` UUID/string primary key
- `member_id` FK
- `storage_key` opaque object storage key
- `original_filename` sanitized display value
- `detected_mime_type`
- `size_bytes`
- `sha256`
- `scan_status`
- `parse_status`
- `consent_status`
- `created_at`, `deleted_at`
- `retention_expires_at`

Do not store public object URLs. Keep storage private.

### candidate_resume_facts
- `id`
- `asset_id` FK
- `member_id` FK
- `fact_type`
- `normalized_value`
- `source_page`
- `source_section`
- `extraction_confidence`
- `candidate_status`
- `candidate_corrected_value`
- `created_at`, `updated_at`

### candidate_consents
- `id`
- `member_id`
- `purpose` (`RESUME_PARSE`, `USE_RESUME_IN_INTERVIEW`, `VOICE_CAPTURE`, `STORE_TRANSCRIPT`)
- `scope_ref`
- `granted_at`
- `revoked_at`
- `policy_version`

### interview_turn_jobs
- `id`
- `session_id`
- `question_id`
- `answer_id`
- `job_type`
- `status`
- `attempt_count`
- `lease_owner`
- `lease_expires_at`
- `fencing_token`
- `last_error_code`
- `created_at`, `updated_at`, `completed_at`

This can be represented by a transactional outbox/job table already present in the wider platform if the existing abstraction supports these semantics. Do not create a second generic queue without checking.

### interview_voice_links
- `id`
- `session_id` FK
- `member_id` FK
- `hcve_session_id` unique
- `status`
- `consent_id` FK
- `created_at`, `closed_at`, `expires_at`

### interview_rubric_versions / interview_plan_versions
Immutable published definitions:
- `id`
- `track_key`
- `version`
- `definition_json`
- `status`
- `created_by`
- `created_at`, `published_at`

If the existing category registry remains code-defined, persist its version/hash on sessions and defer admin CRUD until there is a genuine admin requirement.

## 4. Constraints and indexes

Required:
- `interview_answers` unique `(session_id, idempotency_key)`.
- `interview_answers` unique `(session_id, question_id)` if only one finalized answer per question is supported; otherwise define explicit answer revision semantics.
- `interview_reports` unique `(session_id, report_version)`.
- `interview_voice_links` unique `(hcve_session_id)`.
- Index sessions `(member_id, created_at DESC, id)`.
- Index sessions `(member_id, state, updated_at DESC)`.
- Index questions `(session_id, order_index)`.
- Index answers `(session_id, created_at)`.
- Index jobs `(status, lease_expires_at)`.
- Index resume assets `(member_id, created_at DESC)`.
- Foreign keys must enforce owner consistency in application/service logic; where possible use composite constraints to prevent cross-member linkage.

## 5. Migration rules

1. Create a new numbered SQL migration; do not edit historical migrations already deployed.
2. Add nullable columns first where existing rows need backfill.
3. Backfill deterministic defaults.
4. Add constraints after data validation.
5. Deploy code that can read both old and new shape if rolling deployment requires it.
6. Run migration in a transaction where supported.
7. Verify row counts, null counts, duplicates and FK integrity.
8. Only then enforce non-null/unique constraints.
9. Rollback must be documented. Destructive down migrations are not automatic; prefer forward-fix for data-bearing changes.
10. Runtime startup must not run destructive schema mutation.
11. Add migration integration tests against a disposable PostgreSQL instance.
12. Test both fresh database and upgrade from a representative existing schema.

## 6. Data retention and deletion

- Raw audio retention disabled by default.
- Resume files private and encrypted at rest by storage provider/infrastructure.
- Candidate can request deletion of resume and derived facts.
- Deletion propagates to extracted facts, embeddings if any, prompt caches and derived profile context.
- Historical report retention follows published policy; deletion requests must clearly define whether interview history is also deleted.
- Logs never contain raw resume content or full candidate answers by default.
