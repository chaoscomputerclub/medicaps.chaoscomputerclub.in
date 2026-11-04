# LEGAL AND POLICY IMPLEMENTATION SPECIFICATION

**Protocol Standard:** Versioned Contractual Policy & Immutable Consent Ledger  
**Compliance Target:** Global Standards (GDPR, CCPA, IT Rules, COPPA alignment)

---

## 1. Legal Architecture & Policy Types

The platform defines five distinct, versioned statutory policies:

| Policy Type | Slug / Key | Scope & Governance | Versioning Strategy |
|---|---|---|---|
| **Terms of Service** | `TERMS_OF_SERVICE` | Governs platform usage, individual account creation, intellectual property, contest eligibility, and platform liability | Major/Minor semantic version (`1.0.0`) |
| **Privacy Policy** | `PRIVACY_POLICY` | Details data collection (code submissions, audio telemetry, voice recordings, resume facts, cookies, analytics) and user data rights | Versioned with changelog summary |
| **Contest Rules** | `CONTEST_RULES` | Anti-cheat regulations, single-account rules, disqualified compiler injections, LLM assistance rules, and rating ELO adjustments | Bound per contest registration |
| **Code of Conduct** | `CODE_OF_CONDUCT` | Professional conduct in community forums, peer following, social feed, and tournament chat | Standard community ethics |
| **Acceptable Use Policy** | `ACCEPTABLE_USE` | Bans fork bombs, reverse shell injections, network attacks against judge sandboxes, and resource abuse | Security boundary contract |

---

## 2. Immutable Consent Tracking Contract

### 2.1 Server-Side Data Invariants
- **No Pre-checked Consent:** Frontend forms MUST NOT pre-check consent checkboxes.
- **Granular Separation:** Mandatory contract acceptance (Terms & Privacy) is separated from optional email notifications.
- **Immutable Timestamping:** Every acceptance logs `member_id`, `policy_id`, `policy_type`, `version`, `accepted_at`, `ip_address`, and `user_agent`.
- **Contest Gate Enforcing:** Contest registration is physically blocked by the API unless the request payload includes `rules_version_accepted` matching the contest's current active `rules_version`.

### 2.2 Database Contract (`user_consents`)
```sql
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
```

---

## 3. Re-acceptance Workflow on Material Policy Updates

1. An admin publishes an updated policy version (e.g. Terms from `1.0.0` $\rightarrow$ `2.0.0`).
2. An API endpoint (`GET /api/policies/pending-consents`) calculates any unaccepted active policies for the authenticated user.
3. If pending mandatory policies exist, the frontend displays an unclosable policy modal summarizing the changes and requiring re-affirmation.
4. The user clicks "Accept Updated Terms" $\rightarrow$ `POST /api/policies/accept` logs the new consent record.
