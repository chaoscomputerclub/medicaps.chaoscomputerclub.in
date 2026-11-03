-- Migration: 0006_ai_interview_hardening.sql
-- Implements CCC-AI-0101, DATA_AND_MIGRATION_SPEC & VOICE_INTEGRATION_CONTRACT
-- Adds resume intelligence, candidate consent, voice session links, idempotency hashing, and turn metadata.

-- 1. Base Interview Tables (if not exist)
CREATE TABLE IF NOT EXISTS interview_sessions (
    id VARCHAR(36) PRIMARY KEY,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    target_role VARCHAR(100) NOT NULL,
    experience_level VARCHAR(20) NOT NULL DEFAULT 'ENTRY_LEVEL',
    category VARCHAR(40) NOT NULL DEFAULT 'TECHNICAL',
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    preferred_language VARCHAR(30) NOT NULL DEFAULT 'python',
    focus_topics JSON NOT NULL DEFAULT '[]'::json,
    job_description TEXT,
    resume_notes TEXT,
    state VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    current_question_index INTEGER NOT NULL DEFAULT 0,
    total_questions_planned INTEGER NOT NULL DEFAULT 4,
    plan_metadata JSON NOT NULL DEFAULT '{}'::json,
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Interview Sessions Columns & Concurrency Token
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'TEXT';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS plan_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS rubric_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS provider_profile VARCHAR(50) NOT NULL DEFAULT 'default';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS failure_code VARCHAR(50);
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS failure_at TIMESTAMPTZ;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_interview_sessions_member_created ON interview_sessions(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_member_state ON interview_sessions(member_id, state, updated_at DESC);

-- 3. Interview Questions Columns
CREATE TABLE IF NOT EXISTS interview_questions (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    parent_question_id VARCHAR(36) REFERENCES interview_questions(id) ON DELETE SET NULL,
    question_type VARCHAR(30) NOT NULL DEFAULT 'PRIMARY',
    topic VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    prompt TEXT NOT NULL,
    code_starter TEXT,
    judge_problem_slug VARCHAR(100),
    expected_criteria JSON NOT NULL DEFAULT '[]'::json,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS plan_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS competency_key VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL_EXECUTION';
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS committed_at TIMESTAMPTZ;
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS metadata JSON NOT NULL DEFAULT '{}'::json;

CREATE INDEX IF NOT EXISTS ix_interview_questions_session_order ON interview_questions(session_id, order_index);

-- 4. Interview Answers Columns & Idempotency Constraints
CREATE TABLE IF NOT EXISTS interview_answers (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_id VARCHAR(36) NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    answer_text TEXT NOT NULL,
    submitted_code TEXT,
    judge_result JSON,
    audio_duration_seconds FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64);
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS processing_state VARCHAR(20) NOT NULL DEFAULT 'COMMITTED';
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS transcript_source VARCHAR(20) NOT NULL DEFAULT 'TEXT';
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS transcript_confidence FLOAT;
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS client_turn_id VARCHAR(36);
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS worker_fence VARCHAR(36);
ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS provider_usage JSON NOT NULL DEFAULT '{}'::json;

CREATE INDEX IF NOT EXISTS ix_interview_answers_session_created ON interview_answers(session_id, created_at);

-- 5. Interview Evaluations
CREATE TABLE IF NOT EXISTS interview_evaluations (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_id VARCHAR(36) NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    answer_id VARCHAR(36) NOT NULL REFERENCES interview_answers(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    rubric_scores JSON NOT NULL DEFAULT '{}'::json,
    strengths JSON NOT NULL DEFAULT '[]'::json,
    gaps JSON NOT NULL DEFAULT '[]'::json,
    evidence_quotes JSON NOT NULL DEFAULT '[]'::json,
    model_answer TEXT NOT NULL,
    follow_up_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS rubric_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS evaluation_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS confidence_band VARCHAR(20) NOT NULL DEFAULT 'HIGH';
ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS limitations JSON NOT NULL DEFAULT '[]'::json;
ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) NOT NULL DEFAULT 'MODEL';

-- 6. Interview Reports
CREATE TABLE IF NOT EXISTS interview_reports (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 0,
    verdict VARCHAR(40) NOT NULL DEFAULT 'PRACTICE_MILESTONE',
    executive_summary TEXT NOT NULL,
    dimension_breakdown JSON NOT NULL DEFAULT '{}'::json,
    top_strengths JSON NOT NULL DEFAULT '[]'::json,
    areas_to_improve JSON NOT NULL DEFAULT '[]'::json,
    recommended_practice JSON NOT NULL DEFAULT '[]'::json,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interview_reports ADD COLUMN IF NOT EXISTS report_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_reports ADD COLUMN IF NOT EXISTS rubric_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_reports ADD COLUMN IF NOT EXISTS plan_version VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE interview_reports ADD COLUMN IF NOT EXISTS supersedes_report_id VARCHAR(36);
ALTER TABLE interview_reports ADD COLUMN IF NOT EXISTS confidence_and_limitations JSON NOT NULL DEFAULT '{}'::json;

-- 7. Candidate Profiles
CREATE TABLE IF NOT EXISTS candidate_profiles (
    id VARCHAR(36) PRIMARY KEY,
    member_id VARCHAR(36) NOT NULL UNIQUE REFERENCES member_profiles(id) ON DELETE CASCADE,
    declared_skills JSON NOT NULL DEFAULT '[]'::json,
    demonstrated_strengths JSON NOT NULL DEFAULT '[]'::json,
    developmental_gaps JSON NOT NULL DEFAULT '[]'::json,
    preferred_tracks JSON NOT NULL DEFAULT '[]'::json,
    resume_summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS declared_projects JSON NOT NULL DEFAULT '[]'::json;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS learning_goals JSON NOT NULL DEFAULT '[]'::json;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS context_consent BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 8. Candidate Resume Assets & Facts
CREATE TABLE IF NOT EXISTS candidate_resume_assets (
    id VARCHAR(36) PRIMARY KEY,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    storage_key VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    detected_mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    size_bytes INTEGER NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    scan_status VARCHAR(30) NOT NULL DEFAULT 'CLEAN',
    parse_status VARCHAR(30) NOT NULL DEFAULT 'PARSED',
    consent_status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    retention_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_candidate_resume_assets_member_created ON candidate_resume_assets(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_resume_facts (
    id VARCHAR(36) PRIMARY KEY,
    asset_id VARCHAR(36) NOT NULL REFERENCES candidate_resume_assets(id) ON DELETE CASCADE,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    fact_type VARCHAR(30) NOT NULL,
    normalized_value TEXT NOT NULL,
    source_page INTEGER,
    source_section VARCHAR(100),
    extraction_confidence FLOAT NOT NULL DEFAULT 1.0,
    candidate_status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    candidate_corrected_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_candidate_resume_facts_asset ON candidate_resume_facts(asset_id);
CREATE INDEX IF NOT EXISTS ix_candidate_resume_facts_member ON candidate_resume_facts(member_id);

-- 9. Candidate Consents
CREATE TABLE IF NOT EXISTS candidate_consents (
    id VARCHAR(36) PRIMARY KEY,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    purpose VARCHAR(50) NOT NULL,
    scope_ref VARCHAR(100),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    policy_version VARCHAR(20) NOT NULL DEFAULT '1.0'
);

CREATE INDEX IF NOT EXISTS ix_candidate_consents_member ON candidate_consents(member_id);

-- 10. Authenticated HCVE Voice Links
CREATE TABLE IF NOT EXISTS interview_voice_links (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    hcve_session_id VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    consent_id VARCHAR(36) REFERENCES candidate_consents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_interview_voice_links_session ON interview_voice_links(session_id);
CREATE INDEX IF NOT EXISTS ix_interview_voice_links_member ON interview_voice_links(member_id);
