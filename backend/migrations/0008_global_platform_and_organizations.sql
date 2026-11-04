-- Migration 0008: Global Platform, Optional Organizations, and Versioned Policy Framework
-- Chaos Computer Club — Expand-and-Contract Architecture

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(36) PRIMARY KEY,
    slug VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    organization_type VARCHAR(30) NOT NULL DEFAULT 'COMMUNITY',
    logo_url VARCHAR(500),
    website VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create organization_domains table
CREATE TABLE IF NOT EXISTS organization_domains (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain VARCHAR(100) NOT NULL UNIQUE,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create organization_memberships table
CREATE TABLE IF NOT EXISTS organization_memberships (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    invited_by VARCHAR(36) REFERENCES member_profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_organization_member UNIQUE (organization_id, member_id)
);

-- 4. Create organization_invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(120) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_by VARCHAR(36) REFERENCES member_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create platform_policies table
CREATE TABLE IF NOT EXISTS platform_policies (
    id VARCHAR(36) PRIMARY KEY,
    policy_type VARCHAR(40) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT NOT NULL DEFAULT 'Initial version',
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_policy_type_version_locale UNIQUE (policy_type, version, locale)
);

-- 6. Create user_consents table
CREATE TABLE IF NOT EXISTS user_consents (
    id VARCHAR(36) PRIMARY KEY,
    member_id VARCHAR(36) NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
    policy_id VARCHAR(36) REFERENCES platform_policies(id) ON DELETE SET NULL,
    policy_type VARCHAR(40) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    source VARCHAR(40) NOT NULL DEFAULT 'SIGNUP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create platform_settings and platform_settings_audit tables
CREATE TABLE IF NOT EXISTS platform_settings (
    id VARCHAR(36) PRIMARY KEY,
    key VARCHAR(80) NOT NULL UNIQUE,
    value_json JSON NOT NULL DEFAULT '{}'::json,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings_audit (
    id VARCHAR(36) PRIMARY KEY,
    setting_key VARCHAR(80) NOT NULL,
    old_value_json JSON,
    new_value_json JSON NOT NULL,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    client_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Add optional global fields to member_profiles
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en';
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS platform_role VARCHAR(30) NOT NULL DEFAULT 'USER';

-- 9. Add resource visibility & organization scope to offline_contests
ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS visibility VARCHAR(30) NOT NULL DEFAULT 'public';
ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS rules_version VARCHAR(20) NOT NULL DEFAULT '1.0.0';

-- 10. Add rules acceptance tracking to contest_registrations
ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS rules_version_accepted VARCHAR(20);
ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS rules_accepted_at TIMESTAMPTZ;

-- 11. Create Indexes for High-Concurrency Lookups
CREATE INDEX IF NOT EXISTS ix_org_memberships_member ON organization_memberships(member_id);
CREATE INDEX IF NOT EXISTS ix_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS ix_org_domains_domain ON organization_domains(domain);
CREATE INDEX IF NOT EXISTS ix_user_consents_member ON user_consents(member_id, policy_type);
CREATE INDEX IF NOT EXISTS ix_offline_contests_visibility ON offline_contests(visibility);
CREATE INDEX IF NOT EXISTS ix_offline_contests_org ON offline_contests(organization_id);

-- 12. Backfill: Default Medi-Caps University Organization Workspace
INSERT INTO organizations (id, slug, name, description, organization_type, website, is_verified)
VALUES (
    'org-medicaps-university-default',
    'medicaps-university',
    'Medi-Caps University',
    'Official academic chapter and competitive programming workspace for Medi-Caps University.',
    'UNIVERSITY',
    'https://www.medicaps.ac.in',
    TRUE
) ON CONFLICT (slug) DO NOTHING;

-- Backfill: Verified domain claim for Medi-Caps
INSERT INTO organization_domains (id, organization_id, domain, is_verified)
VALUES (
    'dom-medicaps-ac-in-default',
    'org-medicaps-university-default',
    'medicaps.ac.in',
    TRUE
) ON CONFLICT (domain) DO NOTHING;

-- Backfill: Memberships for existing cadets
INSERT INTO organization_memberships (id, organization_id, member_id, role, status, joined_at)
SELECT 
    md5('mem-' || id),
    'org-medicaps-university-default',
    id,
    CASE WHEN is_core_member THEN 'ADMIN' ELSE 'MEMBER' END,
    'ACTIVE',
    created_at
FROM member_profiles
WHERE email ILIKE '%@medicaps.ac.in'
ON CONFLICT (organization_id, member_id) DO NOTHING;

-- Backfill: Preserve legacy campus contests as organization-private
UPDATE offline_contests
SET 
    organization_id = 'org-medicaps-university-default',
    visibility = 'organization_private'
WHERE (slug ILIKE '%medicaps%' OR title ILIKE '%medi-caps%')
  AND organization_id IS NULL;
