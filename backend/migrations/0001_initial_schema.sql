-- ==============================================================================
-- Migration: 0001_initial_schema.sql
-- Chaos Computer Club India — Medi-Caps Chapter
-- Baseline schema definition for PostgreSQL 16+
-- ==============================================================================

-- 1. Member Profiles
CREATE TABLE IF NOT EXISTS member_profiles (
    id VARCHAR(36) PRIMARY KEY,
    handle VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    prn VARCHAR(20) UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    department VARCHAR(50) NOT NULL DEFAULT 'Computer Science',
    batch VARCHAR(10) NOT NULL DEFAULT '2026',
    division VARCHAR(20) NOT NULL DEFAULT 'open',
    rating INTEGER NOT NULL DEFAULT 1200,
    peak_rating INTEGER NOT NULL DEFAULT 1200,
    attendance_count INTEGER NOT NULL DEFAULT 0,
    attendance_total INTEGER NOT NULL DEFAULT 0,
    is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(20) NOT NULL DEFAULT 'cadet',
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Offline Contests
CREATE TABLE IF NOT EXISTS offline_contests (
    id VARCHAR(36) PRIMARY KEY,
    slug VARCHAR(80) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    season VARCHAR(30) NOT NULL DEFAULT 'Season 2026',
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    division VARCHAR(20) NOT NULL DEFAULT 'open',
    cadence VARCHAR(20) NOT NULL DEFAULT 'weekly',
    edition INTEGER NOT NULL DEFAULT 1,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    check_in_opens_at TIMESTAMPTZ NOT NULL,
    venue VARCHAR(120) NOT NULL DEFAULT 'Online Arena',
    seat_capacity INTEGER NOT NULL DEFAULT 1000,
    registered_count INTEGER NOT NULL DEFAULT 0,
    problem_count INTEGER NOT NULL DEFAULT 4,
    environment VARCHAR(150) NOT NULL DEFAULT 'GCC 14 / Clang 18 / Python 3.12 / Java 21',
    chief_proctors JSON NOT NULL DEFAULT '[]'::json,
    prize_pool VARCHAR(100) DEFAULT '',
    sponsor VARCHAR(100) DEFAULT 'Chaos Computer Club',
    summary TEXT DEFAULT '',
    rules JSON NOT NULL DEFAULT '[]'::json,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Resource Versions
CREATE TABLE IF NOT EXISTS resource_versions (
    resource_id VARCHAR(120) PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Problems & Test Cases
CREATE TABLE IF NOT EXISTS problems (
    id VARCHAR(36) PRIMARY KEY,
    problem_index VARCHAR(5) NOT NULL DEFAULT 'A',
    title VARCHAR(120) NOT NULL,
    slug VARCHAR(80) UNIQUE NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    topic VARCHAR(60) NOT NULL DEFAULT 'Algorithms',
    points INTEGER NOT NULL DEFAULT 100,
    description TEXT NOT NULL,
    constraints TEXT,
    input_format TEXT,
    output_format TEXT,
    execution_mode VARCHAR(20) NOT NULL DEFAULT 'FUNCTION',
    function_signature JSON NOT NULL DEFAULT '{}'::json,
    starter_code JSON NOT NULL DEFAULT '{}'::json,
    time_limit DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    memory_limit INTEGER NOT NULL DEFAULT 256,
    evaluation_config JSON NOT NULL DEFAULT '{}'::json,
    sandbox_config JSON NOT NULL DEFAULT '{}'::json,
    reference_solution JSON DEFAULT '{}'::json,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Outbox Events
CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(36) PRIMARY KEY,
    event_type VARCHAR(60) NOT NULL,
    aggregate_id VARCHAR(60) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
