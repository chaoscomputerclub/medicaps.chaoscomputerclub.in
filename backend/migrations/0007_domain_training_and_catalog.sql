-- 0007_domain_training_and_catalog.sql
-- Relational Domain Catalog, Versioned Blueprints, and Training Datasets
-- Adheres to Domain_Interview_Training_Implementation_Plan (CCC-AI-DOMAIN-001)

CREATE TABLE IF NOT EXISTS interview_domains (
    id VARCHAR(36) PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'TECHNICAL',
    icon_key VARCHAR(50) NOT NULL DEFAULT 'code',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_interview_domains_slug ON interview_domains(slug);
CREATE INDEX IF NOT EXISTS ix_interview_domains_category_active ON interview_domains(category, is_active);

CREATE TABLE IF NOT EXISTS interview_blueprints (
    id VARCHAR(36) PRIMARY KEY,
    domain_id VARCHAR(36) NOT NULL REFERENCES interview_domains(id) ON DELETE CASCADE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    active_version_id VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_interview_blueprints_domain_id ON interview_blueprints(domain_id);
CREATE INDEX IF NOT EXISTS ix_interview_blueprints_slug ON interview_blueprints(slug);
CREATE INDEX IF NOT EXISTS ix_interview_blueprints_status ON interview_blueprints(status);

CREATE TABLE IF NOT EXISTS interview_blueprint_versions (
    id VARCHAR(36) PRIMARY KEY,
    blueprint_id VARCHAR(36) NOT NULL REFERENCES interview_blueprints(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    curriculum_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    taxonomy_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    prompt_pack_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    evaluation_pack_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    checksum VARCHAR(64),
    graph_data JSON NOT NULL DEFAULT '{}'::json,
    public_metadata JSON NOT NULL DEFAULT '{}'::json,
    validation_report JSON NOT NULL DEFAULT '{}'::json,
    coverage_report JSON NOT NULL DEFAULT '{}'::json,
    published_at TIMESTAMPTZ,
    created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_interview_blueprint_versions_bp_ver UNIQUE (blueprint_id, version)
);

CREATE INDEX IF NOT EXISTS ix_interview_blueprint_versions_bp ON interview_blueprint_versions(blueprint_id);
CREATE INDEX IF NOT EXISTS ix_interview_blueprint_versions_status ON interview_blueprint_versions(status);

CREATE TABLE IF NOT EXISTS interview_domain_datasets (
    id VARCHAR(36) PRIMARY KEY,
    blueprint_version_id VARCHAR(36) NOT NULL REFERENCES interview_blueprint_versions(id) ON DELETE CASCADE,
    dataset_type VARCHAR(40) NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    data_records JSON NOT NULL DEFAULT '[]'::json,
    checksum VARCHAR(64),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    evaluation_report JSON NOT NULL DEFAULT '{}'::json,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_interview_domain_datasets_bp_ver ON interview_domain_datasets(blueprint_version_id);
CREATE INDEX IF NOT EXISTS ix_interview_domain_datasets_type ON interview_domain_datasets(dataset_type);

