# DATA MIGRATION PLAN — SAFE EXPAND-AND-CONTRACT DE-MEDICAPS SPECIFICATION

**Protocol Standard:** Production Safe Expand-and-Contract  
**Zero Data Loss Invariant:** Existing user IDs, rating histories, contest submissions, and scores MUST be preserved with 100% integrity.

---

## 1. Migration Overview

To transform the schema without risking database downtime, broken relations, or regression:
1. **Expand Phase (Additive):** Create new tables (`organizations`, `organization_domains`, `organization_memberships`, `organization_invitations`, `platform_policies`, `user_consents`, `platform_settings`, `platform_settings_audit`). Add optional columns to existing tables (`visibility`, `organization_id`, `locale`, `timezone`, `platform_role`).
2. **Backfill Phase (Idempotent):**
   - Insert default organization record for Medi-Caps University (`slug = 'medicaps-university'`).
   - Associate verified domain `medicaps.ac.in` with this organization.
   - Backfill all existing `member_profiles` having `@medicaps.ac.in` emails into `organization_memberships` (role: `ADMIN` if `is_core_member` is true, else `MEMBER`).
   - Assign existing campus contests (e.g. `medicaps-offline-open-2026`) to `organization_id = (SELECT id FROM organizations WHERE slug = 'medicaps-university')` and `visibility = 'organization_private'`.
   - Seed canonical platform legal policies (`TERMS_OF_SERVICE`, `PRIVACY_POLICY`, `CONTEST_RULES`, `CODE_OF_CONDUCT`, `ACCEPTABLE_USE`) at version `1.0.0`.
   - Seed default platform settings.
3. **Contract Phase (Future Migration):** Obsolete constraints and unused legacy columns remain dormant or nullable. No column is dropped until all client paths have operated stably for $\ge 30$ days.

---

## 2. SQL Migration DDL Specification (0008_global_platform_and_organizations.sql)

```sql
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
    id VARCHAR(36) PRIMARY KEY,
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
```

---

## 3. Backfill Execution Procedure

```sql
-- Step A: Insert Default Medi-Caps University Workspace
INSERT INTO organizations (id, slug, name, description, organization_type, website, is_verified)
VALUES (
    'org-medicaps-university-default',
    'medicaps-university',
    'Medi-Caps University',
    'Official academic chapter and competitive programming arena for Medi-Caps University.',
    'UNIVERSITY',
    'https://www.medicaps.ac.in',
    TRUE
) ON CONFLICT (slug) DO NOTHING;

-- Step B: Insert Verified Domain Claim
INSERT INTO organization_domains (id, organization_id, domain, is_verified)
VALUES (
    'dom-medicaps-ac-in-default',
    'org-medicaps-university-default',
    'medicaps.ac.in',
    TRUE
) ON CONFLICT (domain) DO NOTHING;

-- Step C: Backfill Memberships for existing @medicaps.ac.in Cadets
INSERT INTO organization_memberships (id, organization_id, member_id, role, status, joined_at)
SELECT 
    'mem-' || id,
    'org-medicaps-university-default',
    id,
    CASE WHEN is_core_member THEN 'ADMIN' ELSE 'MEMBER' END,
    'ACTIVE',
    created_at
FROM member_profiles
WHERE email ILIKE '%@medicaps.ac.in'
ON CONFLICT (organization_id, member_id) DO NOTHING;

-- Step D: Map Existing Campus Contests as Organization-Private
UPDATE offline_contests
SET 
    organization_id = 'org-medicaps-university-default',
    visibility = 'organization_private'
WHERE slug ILIKE '%medicaps%' OR title ILIKE '%medi-caps%';
```

---

## 4. Rollback and Disaster Recovery

- **Non-Destructive Operations:** All columns added are nullable or carry safe defaults.
- **Rollback SQL:** If code needs to be reverted, newly added tables and columns do not impede previous code versions because no pre-existing columns or constraints were removed or modified.
- **Database Snapshot:** A point-in-time snapshot is taken before executing migration DDL via `scripts/db_backup.py`.
