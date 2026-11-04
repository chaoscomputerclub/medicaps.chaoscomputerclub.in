# Global Platform Transformation — Test & Verification Report
**Date:** 2026-11-04  
**Release Version:** 1.7.0  
**Test Suite:** `backend/tests/test_global_platform.py`  
**Execution Environment:** macOS / Linux (Local & Production Ephemeral Services)  

---

## 1. Automated Test Results

```text
============================= test session starts ==============================
platform darwin -- Python 3.12.12, pytest-9.1.1, pluggy-1.6.0
rootdir: /Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in
configfile: pytest.ini
plugins: asyncio-1.4.0, anyio-4.15.1, langsmith-0.14.14, locust-2.46.6
asyncio: mode=Mode.AUTO

backend/tests/test_global_platform.py::test_global_email_normalization_allows_personal_emails PASSED [ 11%]
backend/tests/test_global_platform.py::test_global_email_normalization_respects_strict_flag_if_enabled PASSED [ 22%]
backend/tests/test_global_platform.py::test_list_organizations_endpoint PASSED [ 33%]
backend/tests/test_global_platform.py::test_get_organization_by_slug PASSED [ 44%]
backend/tests/test_global_platform.py::test_policies_list_and_detail PASSED [ 55%]
backend/tests/test_global_platform.py::test_user_consent_recording PASSED [ 66%]
backend/tests/test_global_platform.py::test_contest_rules_version_acceptance PASSED [ 77%]
backend/tests/test_global_platform.py::test_organization_private_contest_gate PASSED [ 88%]
backend/tests/test_global_platform.py::test_admin_settings_rbac_and_audit PASSED [100%]

============================== 9 passed in 2.26s ===============================
```

---

## 2. Test Coverage Analysis

### 2.1 Identity Decoupling
- **`test_global_email_normalization_allows_personal_emails`**: Confirms that when `ENFORCE_STRICT_EMAIL_DOMAIN` is `False` (default for global arena), valid personal emails (`user@gmail.com`, `eng@chaoscomputerclub.in`) successfully validate through Pydantic without raising HTTP 403.
- **`test_global_email_normalization_respects_strict_flag_if_enabled`**: Confirms that when `ENFORCE_STRICT_EMAIL_DOMAIN` is explicitly set to `True`, non-organization emails are rejected with descriptive HTTP 403 errors.

### 2.2 Multi-Tenant Organization Workspaces
- **`test_list_organizations_endpoint`**: Validates `GET /api/organizations` returns the verified workspace list, including the default `medicaps-university` organization.
- **`test_get_organization_by_slug`**: Tests fetching organization by unique slug and verifies 404 behavior for unknown organizations.

### 2.3 Statutory Legal Policies & Immutable Consent Ledger
- **`test_policies_list_and_detail`**: Validates that all 5 required statutory policies are active and return markdown content (`TERMS_OF_SERVICE`, `PRIVACY_POLICY`, `CONTEST_RULES`, `CODE_OF_CONDUCT`, `ACCEPTABLE_USE`).
- **`test_user_consent_recording`**: Verifies that when an authenticated user accepts a policy, an immutable consent row is recorded in `user_consents` and retrievable via `GET /api/policies/me/consents`.

### 2.4 Contest Engine Visibility & Rules Gate
- **`test_contest_rules_version_acceptance`**: Verifies that registration requires matching `rules_version_accepted` (e.g. `1.0.0`). Rejects mismatched versions with HTTP 400. Automatically logs user consent under `source = "CONTEST_REGISTRATION"`.
- **`test_organization_private_contest_gate`**: Verifies that contests flagged `visibility = "organization_private"` cannot be registered by non-members of that organization, returning HTTP 403 Forbidden.

### 2.5 Admin Platform Settings & Audit Ledger
- **`test_admin_settings_rbac_and_audit`**: Verifies that regular users cannot access or alter platform settings (HTTP 403), while administrators can update settings and each modification records an entry in `platform_settings_audit`.

---

## 3. Production Deployment Signoff

- **Git Commit:** `9431041` pushed to `origin/main`
- **Frontend Student Portal Build:** Compiled with 0 errors via Vite (`dist/`)
- **Frontend Admin Console Build:** Compiled with 0 errors (`dist-admin/`)
- **Remote Host:** `root@143.198.38.205`
- **Systemd Service:** `ccc-medicaps-api.service` active and operational
- **Live Version Probe:** `curl -s https://medicaps.chaoscomputerclub.in/api/health` -> `version: "1.7.0"`, `status: "operational"`
- **Live Organizations Probe:** `curl -s https://medicaps.chaoscomputerclub.in/api/organizations` -> 200 OK
- **Live Policies Probe:** `curl -s https://medicaps.chaoscomputerclub.in/api/policies` -> 5 active published policies
