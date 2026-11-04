# MASTER IMPLEMENTATION PROMPT — TRANSFORM THE EXISTING PROJECT INTO A GLOBAL PLATFORM

You are the principal architect and implementation agent. Transform this existing university-specific project into a globally accessible, institution-neutral platform. Remove the hard dependency on MediCaps University and any university-specific eligibility, identity, branding, contest, legal, domain, or deployment assumptions.

Do not rebuild from scratch. Audit the repository, preserve working features, reuse compatible components, and make incremental, reviewable changes. Do not blindly replace every occurrence of “MediCaps”: historical records, migration mappings, and optional organization data may need to retain it.

## Product outcome

- Global individual accounts; no university email, student ID, campus, enrollment, or institutional membership required for public signup or public features.
- Organizations (universities, companies, bootcamps, communities) are optional workspaces. A user may belong to zero, one, or multiple organizations.
- Public global interviews, coding challenges, contests, leaderboards, profiles, and reports, each with explicit visibility and ownership rules.
- Platform-level Terms and Conditions, Privacy Policy, Contest Rules, Code of Conduct, and other applicable policies, versioned with recorded acceptance.
- Parent marketing website at the root domain, e.g. `domainname.com`; product at `app.domainname.com`; optional `api.domainname.com`, `admin.domainname.com`, `docs.domainname.com`, and `status.domainname.com`.
- Centralized domain, URL, branding, email, SEO, feature-flag, and platform settings.
- Existing data preserved through tested migrations and rollback/forward-fix plans.

## Non-negotiable rules

1. Audit before editing. Reproduce the current application and establish a regression baseline.
2. No blind global string replacement. Classify every occurrence and its purpose.
3. No destructive migration without backup, dry run, verification, and rollback plan.
4. No university gate in public registration, login, interviews, challenges, contests, leaderboards, or profiles.
5. Organization membership is optional and separate from platform identity.
6. Public/private resource authorization is enforced server-side.
7. Replace hard-coded domains with validated configuration; do not weaken CORS, cookies, auth, or security.
8. Preserve existing features and historical records.
9. Do not claim DNS, TLS, legal approval, or production deployment is complete unless actually verified.
10. Implement in phases with tests and high-risk review checkpoints.

## Phase 0 — complete repository audit (mandatory)

Inspect frontend routes/components/forms/guards/copy/assets/SEO; backend routes/middleware/auth/authorization/models; database schema/migrations/indexes/triggers/seeds/fixtures; email/OTP/reset/invitation templates; file storage; Redis/cache/queues/jobs/webhooks; contests/submissions/scoring/leaderboards; legal documents/consent; Docker/reverse proxy/DNS/TLS/CORS/cookies/OAuth/CI/CD/environment variables.

Search case-insensitively for `Medicaps`, `MediCaps`, `medicaps`, `medicaps.ac.in`, campus, college, university, student, enrollment, student ID, institutional email, hard-coded IDs, logos, and legacy hostnames. Inspect context and classify:
- hard restriction / authorization
- UI branding and copy
- optional organization feature
- historical data/audit
- contest eligibility or scope
- legal/policy text
- deployment/domain config
- tests, fixtures, seeds

Create `GLOBALIZATION_AUDIT.md` with file paths, code locations, behavior, risk, dependencies, proposed fix, migration needs, current feature inventory, architecture map, and unknowns. Do not start schema changes before this audit.

## Phase 1 — global identity and optional organizations

Refactor identity so users belong to the platform, not to a university.

Target conceptual entities (adapt to existing schema; do not duplicate unnecessarily):
- `users`: global identity, normalized unique email, auth state/status, timestamps.
- `user_profiles`: display name, avatar, locale, timezone, optional profile metadata.
- `organizations`: optional institution/company/community workspace.
- `organization_memberships`: user_id, organization_id, role, status, joined_at, inviter.
- `organization_domains`: verified domain claims for optional workspace discovery/invitations only; never a global signup restriction.
- `invitations`: hashed token, organization, role, expiry, status.
- `policies` and `user_consents`: exact policy version, accepted timestamp, user, locale, source.

Requirements:
- Remove university email suffix and student-ID validation from public signup/login.
- Accept ordinary personal and work/school email addresses.
- Keep email verification, password hashing, OTP expiry, session rotation, account recovery, abuse controls.
- Never infer authorization from an email domain.
- Signup must work with no organization selected.
- One account can join multiple organizations.
- Separate platform roles from organization roles and resource permissions.
- Resolve all roles and memberships server-side; never trust client-supplied role/org IDs.
- Add regression tests for users with zero, one, and multiple organizations.

## Phase 2 — globalize all product features

Audit every query, route, middleware, and UI filter for implicit institution scope.

**Interviews:** published public interview packs available globally; session/report ownership tied to global user ID; private organization packs require explicit organization scope.

**Challenges:** public challenges global by default; private/unlisted visibility explicit; preserve sandbox isolation, rate limits, ownership, and anti-abuse.

**Contests:** each contest has explicit scope `public`, `unlisted`, or `organization_private`; eligibility is defined per contest, not inherited from a university. Support registration windows, UTC start/end timestamps, localized display, participant limits, attempt/submission limits, scoring, penalties, tie-breaks, disqualification policy, and rules acceptance. Organization-only contests must reference an organization and verify membership. Existing MediCaps contests must remain historical/private organization contests unless an owner explicitly approves public release.

**Leaderboards:** global, contest, and optional organization scopes; explicit privacy, tie-break, rating, and anti-abuse policies. Prevent private data leakage.

**Profiles/reports:** explicit public/private visibility; reports and sessions accessible only to owner and authorized reviewers. Remove student-record dependencies from public profile flows.

## Phase 3 — legal and contest policy framework

Create public routes and footer links for:
- Terms and Conditions
- Privacy Policy
- Contest Rules / Contest Terms
- Code of Conduct
- Acceptable Use Policy
- Cookie Policy where applicable
- Refund/Cancellation Policy if paid features exist
- Organization/Workspace Terms if applicable

Do not fabricate legally approved content. Create draft placeholders and flag for qualified legal review. Store policy ID, version, locale, effective date, publication state, content, and change summary. Record immutable acceptance of the exact version with timestamp/user/source. Contest registration must show and record the applicable contest rules version. Never pre-check consent. Separate mandatory contractual acceptance from optional marketing consent. Material policy changes can require re-acceptance.

## Phase 4 — parent website and application split

Target:
- `https://domainname.com`: marketing/parent site, product overview, features, domains, how it works, pricing if applicable, about, contact, blog/resources, legal pages.
- `https://app.domainname.com`: login, dashboard, interviews, challenges, contests, leaderboard, profile, settings.
- `https://api.domainname.com`: optional API host if useful.
- `https://admin.domainname.com`: optional protected admin host or keep secure admin routes under app.
- `https://docs.domainname.com`, `https://status.domainname.com`: optional.

Do not split deployments or create microservices without a clear operational reason. Existing apps can be routed by reverse proxy/host configuration.

Parent site: institution-neutral copy, clear app CTA, responsive/accessibility, accurate SEO metadata, canonical URLs, sitemap, robots, Open Graph, structured data only when accurate. Do not index private app pages.

Application: neutral language, correct deep links, centralized links, auth redirect handling. Marketing and app navigation should be distinct but visually coherent.

## Phase 5 — centralized domain and URL settings

Use typed, validated configuration adapted to the current stack. Example variables:
`PLATFORM_NAME`, `PLATFORM_BASE_DOMAIN`, `MARKETING_BASE_URL`, `APP_BASE_URL`, `API_BASE_URL`, `ADMIN_BASE_URL`, `PUBLIC_WEB_ORIGIN`, `CORS_ALLOWED_ORIGINS`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, `SUPPORT_EMAIL`, `ASSET_BASE_URL`, `CANONICAL_URL`, `ENVIRONMENT`.

Requirements:
- Apex/root domain serves parent site; app subdomain serves application.
- HTTP redirects to HTTPS; canonical www/non-www policy is consistent.
- Exact CORS allowlist; never wildcard credentials.
- Host header allowlist prevents host-header injection.
- Prefer host-only secure cookies unless cross-subdomain sharing is required.
- OTP, password reset, invitation, contest, and email links use configured app URL.
- OAuth callback URLs are exact and environment-specific.
- Local, staging, and production configs are separate.
- Validate required settings at startup and fail clearly.
- Document A/AAAA/CNAME records, reverse proxy vhosts, TLS issuance/renewal, CDN mode, firewall, health checks, and rollback.
- Future custom domains are out of scope unless justified; do not prematurely build tenant custom-domain routing.

## Phase 6 — platform settings

Centralize platform identity/brand, public URLs/allowed hosts, signup/auth policy, locale/timezone defaults, feature flags, contest defaults/limits, email sender/support contacts, legal versions, maintenance mode, upload limits, and rate limits.

Settings need typed schemas, validation, server-side authorization, audit logs (actor/before/after/time), cache invalidation/versioning, safe defaults, and environment override policy. Store secrets in a secret manager/environment, never ordinary settings rows. Organization admins must not change global platform settings.

## Phase 7 — global UX, localization, accessibility

Remove institution-specific wording from labels, forms, empty states, errors, emails, onboarding, and footer. Use neutral terms: account, profile, organization/workspace only when relevant. Do not force organization selection. Support locale/timezone preferences, localized date/time/number/currency formatting, UTC storage, accessible labels/focus/keyboard/contrast/semantics, responsive layouts. Remove India-only phone/date/currency assumptions from global flows unless region-specific.

## Phase 8 — migration and compatibility

Before production migration: backup DB and storage metadata, verify restore, export row counts/relationships, test on production-like copy, document rollback and forward-fix.

Use expand-and-contract:
1. Add optional organization and visibility relations without dropping old columns.
2. Backfill organization records for existing institution-scoped data.
3. Add explicit resource scopes.
4. Deploy code reading the new model with safe legacy fallback.
5. Verify counts, ownership, permissions, historical submissions/reports.
6. Remove university checks from public flows.
7. Update UI, emails, legal and URLs.
8. Keep legacy columns until all code paths and reports are migrated.
9. Drop obsolete constraints/columns only in a later migration after verification.

Preserve user IDs where possible, historical submissions/scores/audit events, and consent. Do not make old private contests public by default. Do not redirect unrelated old routes to homepage.

## Phase 9 — security and abuse controls

Global availability increases attack surface. Preserve/improve email verification, account recovery, rate limits, bot controls, contest anti-cheat, code execution sandbox, CSRF/XSS/SQLi/SSRF/IDOR/mass-assignment/path-traversal protection, secure uploads and private storage, signed URLs, organization isolation, admin least privilege/MFA where available, audit logging, secret rotation, security headers, TLS, dependency scanning, backups and restore tests. University email is not a security control.

## Phase 10 — test, release, operate

Test:
- signup/login using personal non-university email;
- signup with no organization;
- multi-organization membership;
- global public interview/challenge/contest discovery;
- private organization resource isolation;
- contest rules version acceptance;
- report/session ownership and IDOR;
- apex vs app host routing;
- CORS/cookies/OAuth/reset/invitation/email links;
- canonical/SEO/noindex;
- config validation;
- legacy data preservation.

Run unit/integration/e2e/migration/accessibility/security/build/type/lint tests. Deploy in staging, migration dry-run, backup, compatibility backend, frontend/parent site, DNS/TLS cutover, external smoke tests, monitoring, rollback readiness.

## Required deliverables

`GLOBALIZATION_AUDIT.md`, `TARGET_ARCHITECTURE.md`, `DATA_MIGRATION_PLAN.md`, `DOMAIN_AND_DNS_RUNBOOK.md`, `LEGAL_POLICY_IMPLEMENTATION.md`, `SECURITY_REVIEW.md`, `TEST_REPORT.md`, `IMPLEMENTATION_STATUS.md`, migrations/rollback scripts, updated `.env.example` without secrets, API docs, parent-site/app routing, admin settings, tests, deployment/rollback runbook.

## Definition of done

- No hard-coded university restriction in public signup/login/interviews/challenges/contests/leaderboards/profiles.
- A user can register with a normal personal email and use public features without organization membership.
- Organizations are optional and private scopes remain isolated.
- Historical MediCaps data is preserved with intended privacy.
- Legal pages and contest rules are versioned; acceptance is recorded.
- Root and app subdomains work via centralized config.
- CORS, cookies, OAuth, emails, canonical URLs, and assets use environment configuration.
- Admin platform settings are secure and audited.
- Tests prove global access and private organization boundaries.
- DNS/TLS and production migration are actually verified.
- No task is marked complete without implementation and test evidence.

## Execution protocol

Work incrementally. Before each phase, list exact files, migrations, risks, and tests. Implement, run tests, summarize changed files and evidence. Pause for owner review at identity/schema changes, authorization changes, production migration, legal publication, and DNS cutover. Never delete legacy code/data until replacement is verified. Do not claim production completion from local tests alone.
