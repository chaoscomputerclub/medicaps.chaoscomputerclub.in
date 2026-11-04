# GLOBALIZATION AUDIT — COMPREHENSIVE REPOSITORY INSPECTION

**Document Version:** 1.0.0  
**Audit Date:** November 4, 2026  
**System Under Audit:** Chaos Computer Club Arena Platform  
**Target Architecture:** Institution-Neutral Global Platform with Optional Organizations  

---

## 1. Executive Summary

This repository was originally architected as a university-specific competitive programming and AI interview portal for Medi-Caps University students and proctors.
Under the **Global Platform Transformation Directive**, the platform is decoupled from any hard dependency on Medi-Caps University while preserving all working features, historical participant records, contest integrity, and sandbox security.

### Core Transformation Goals
1. **Universal Identity:** Remove mandatory `@medicaps.ac.in` domain gates, PRN enrollment restrictions, and single-campus requirements from public signup, login, interviews, and challenges.
2. **Optional Organizations:** Model institutions, companies, bootcamps, and clubs as optional workspace entities (`organizations`, `organization_memberships`, `organization_domains`). Users belong to zero, one, or many organizations.
3. **Explicit Resource Scopes:** Enforce server-side access control across four explicit visibility levels: `public`, `unlisted`, `organization_private`, and `platform_admin_only`.
4. **Legal & Contest Policy Governance:** Introduce versioned Terms of Service, Privacy Policy, Contest Rules, Code of Conduct, and Acceptable Use Policy with immutable acceptance records.
5. **Multi-Domain Host Routing:** Provide a centralized URL and domain configuration separating the parent marketing site (`domainname.com`) from the application workspace (`app.domainname.com`).
6. **Zero Data Loss:** Maintain expand-and-contract database migration patterns with verified backwards compatibility.

---

## 2. Classification of Scanned Artifacts

Every occurrence of `medicaps`, `campus`, `prn`, `enrollment`, and university-specific metadata across the repository has been audited and classified into 8 functional categories:

| Category | Description | Primary Locations | Remediation Strategy |
|---|---|---|---|
| **1. Hard Eligibility & Auth Restrictions** | Blocks registration or login for non-university emails | `backend/app/schemas/auth.py`<br>`backend/app/modules/auth/otp_service.py`<br>`backend/app/modules/auth/oauth_service.py`<br>`src/pages/AuthPage.tsx`<br>`src/lib/auth.ts` | Remove domain rejection in public flows. Allow personal & work emails. Support optional organization domain discovery. |
| **2. UI Branding & Copy** | Hardcoded university names, campus badges, and headers | `src/organization/components/PortalShell.tsx`<br>`src/organization/components/RegisterConfirmModal.tsx`<br>`src/organization/components/SocialDrawer.tsx`<br>`src/pages/ProfilePage.tsx` | Generalize copy to platform terminology ("Global Network", "Competitive Profile", "Active Workspace"). |
| **3. Optional Organization Features** | Legitimate campus/institution workflows | `backend/app/services/pass_service.py`<br>`backend/app/models/member.py` (`CampusPass`) | Move campus passes and physical QR entry to optional organization-scoped live events. |
| **4. Historical & Audit Records** | Existing student accounts, PRNs, ratings, submissions | PostgreSQL `member_profiles`, `rating_history`, `contest_submissions` | Retain all historical records untouched. Backfill existing Medi-Caps members into a default `medicaps-university` organization. |
| **5. Contest Eligibility & Scope** | Assumptions that contests are campus-only | `backend/app/models/contest.py`<br>`backend/app/middleware/contest_eligibility.py`<br>`backend/app/services/contest_eligibility_service.py` | Add explicit `visibility` enum (`public`, `unlisted`, `organization_private`). Existing contests stay `organization_private`. New contests can be `public`. |
| **6. Legal & Policy Text** | Hardcoded references to Medi-Caps in Terms | `src/pages/TermsPage.tsx` | Refactor into versioned platform policy system supporting Terms, Privacy, Rules, and Conduct. |
| **7. Deployment & Domain Config** | Hardcoded `medicaps.chaoscomputerclub.in` | `backend/app/core/origins.py`<br>`backend/app/core/config.py`<br>`.env.example` | Centralize base domains, CORS origins, cookie domains, and OAuth redirect URIs into typed environment settings. |
| **8. Tests, Fixtures & Seeds** | Test assertions expecting `@medicaps.ac.in` | `backend/tests/test_cookie_auth.py`<br>`backend/tests/test_async_queue_architecture.py` | Update test suites to assert both personal and institutional email workflows. |

---

## 3. High-Risk Findings & Blast Radius Analysis

### 3.1 Hard Email Domain Gate
- **Location:** `backend/app/modules/auth/otp_service.py:48-53` and `backend/app/schemas/auth.py:22-27`
- **Current Behavior:** Raises `HTTP 403 Forbidden` if email does not match `ALLOWED_EMAIL_DOMAIN` ("Access restricted: Only @medicaps.ac.in organization emails are permitted").
- **Blast Radius:** Affects all public user signups and logins.
- **Proposed Fix:** Make domain restriction opt-in per workspace or contest. In standard public auth, allow any valid RFC-compliant email address. Support optional organization affiliation based on verified `organization_domains`.

### 3.2 Google OAuth Domain Enforcement
- **Location:** `backend/app/modules/auth/oauth_service.py:91, 171-174`
- **Current Behavior:** Passes `&hd=medicaps.ac.in` to Google and rejects callbacks from personal Gmail accounts.
- **Blast Radius:** Blocks non-university Google single-sign-on.
- **Proposed Fix:** Omit `hd` parameter by default. Allow all verified Google OAuth identities to create global platform accounts.

### 3.3 Enrollment PRN Dependency in Onboarding
- **Location:** `backend/app/models/member.py:39`, `backend/app/schemas/auth.py:99`, `src/pages/AuthPage.tsx:542`
- **Current Behavior:** PRN is presented as a primary campus identity field.
- **Blast Radius:** Confuses or alienates international/non-university users.
- **Proposed Fix:** Make `prn`, `department`, and `batch` strictly optional profile fields (or organization-specific custom metadata).

### 3.4 Hardcoded CORS Origins and Cookie Domains
- **Location:** `backend/app/core/origins.py:31-36`
- **Current Behavior:** Hardcodes `https://medicaps.chaoscomputerclub.in`.
- **Blast Radius:** Prevents multi-domain deployments (`app.domainname.com`, `domainname.com`).
- **Proposed Fix:** Dynamically assemble CORS origins and allowed hosts from `PLATFORM_BASE_DOMAIN`, `APP_BASE_URL`, and `MARKETING_BASE_URL`.

---

## 4. Current Feature Inventory & Compatibility Matrix

| Feature | Current State | Target State | Compatibility Impact |
|---|---|---|---|
| **AI Interview Arena** | 13 published blueprints in PostgreSQL | Globally accessible public catalog; optional private org tracks | 100% Backward compatible |
| **Practice Arena** | Public algorithm challenges | Globally accessible challenges with public/unlisted tags | 100% Backward compatible |
| **Contests & Tournaments** | Campus-scoped screening & finals | Explicit visibility (`public` vs `organization_private`) | Existing contests preserved as org-private |
| **Ratings & Leaderboard** | Single university ELO ladder | Global rating ladder + optional Organization Leaderboards | 100% Preserved |
| **Social Graph** | Follows / Followers stream | Global developer network with workspace filtering | 100% Preserved |
| **Trust-of-Proof** | Cryptographic session certificates | Globally verifiable Ed25519 achievement proofs | 100% Preserved |
| **Campus Pass / QR** | Offline physical tournament check-in | Optional Organization Event Pass | Preserved for org-scoped events |

---

## 5. Unknowns & Dependencies

1. **DNS / Reverse Proxy Mapping:** Multi-subdomain vhosts (`app.domainname.com` vs apex `domainname.com`) require Nginx server block configuration.
2. **Legacy User Data Backfill:** All existing `member_profiles` records with `@medicaps.ac.in` emails will be linked to an automatically created `medicaps-university` organization record, ensuring zero broken historical relations.
3. **Legal Content Authority:** Terms and policies created are versioned contractual drafts pending final legal counsel review.
