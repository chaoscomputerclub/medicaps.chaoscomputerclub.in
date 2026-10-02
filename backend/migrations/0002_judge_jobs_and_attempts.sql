-- ==============================================================================
-- Migration: 0002_judge_jobs_and_attempts.sql
-- Chaos Computer Club India — Medi-Caps Chapter
-- Authoritative attempt-based execution tracking & strict result fencing
-- ==============================================================================

-- 1. Judge Jobs Table
CREATE TABLE IF NOT EXISTS judge_jobs (
    id VARCHAR(36) PRIMARY KEY,
    submission_id VARCHAR(36),
    contest_id VARCHAR(36),
    problem_id VARCHAR(36),
    member_id VARCHAR(36),
    state VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    provider VARCHAR(30),
    attempt_number INTEGER NOT NULL DEFAULT 0,
    active_attempt_id VARCHAR(36),
    deadline_at TIMESTAMPTZ,
    failure_code VARCHAR(50),
    execution_decision JSON,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_judge_jobs_submission_id ON judge_jobs(submission_id);
CREATE INDEX IF NOT EXISTS ix_judge_jobs_state ON judge_jobs(state);
CREATE INDEX IF NOT EXISTS ix_judge_jobs_active_attempt_id ON judge_jobs(active_attempt_id);
CREATE INDEX IF NOT EXISTS ix_judge_jobs_state_deadline ON judge_jobs(state, deadline_at);
CREATE INDEX IF NOT EXISTS ix_judge_jobs_contest_problem ON judge_jobs(contest_id, problem_id);

-- 2. Judge Job Attempts Table
CREATE TABLE IF NOT EXISTS judge_job_attempts (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES judge_jobs(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    provider VARCHAR(30) NOT NULL,
    node_id VARCHAR(50),
    lease_id VARCHAR(100),
    state VARCHAR(20) NOT NULL DEFAULT 'STARTED',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    heartbeat_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    queue_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    compile_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    execution_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    result_hash VARCHAR(64),
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_judge_job_attempts_job_id ON judge_job_attempts(job_id);
CREATE INDEX IF NOT EXISTS ix_judge_job_attempts_lease_id ON judge_job_attempts(lease_id);
CREATE INDEX IF NOT EXISTS ix_judge_job_attempts_state ON judge_job_attempts(state);
CREATE INDEX IF NOT EXISTS ix_judge_job_attempts_job_attempt ON judge_job_attempts(job_id, attempt_number);
