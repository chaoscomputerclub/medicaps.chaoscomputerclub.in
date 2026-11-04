# ACCEPTANCE AND RELEASE CHECKLIST

## Public access
- [ ] Signup works with personal/non-university email.
- [ ] No student ID, enrollment, campus, university membership required.
- [ ] Onboarding works without organization selection.
- [ ] Verification/reset/invitation links use configured app URL.

## Product
- [ ] Public interviews and challenges are global.
- [ ] Public contests are discoverable and governed by contest-specific rules.
- [ ] Private organization contests remain restricted.
- [ ] Global and scoped leaderboards respect visibility.
- [ ] Reports and sessions are owner/reviewer restricted.

## Legal
- [ ] Terms and Conditions and Privacy Policy are versioned.
- [ ] Contest rules version shown and accepted before registration.
- [ ] Consent is not preselected.
- [ ] Material policy updates trigger configured re-acceptance.

## Domains
- [ ] Root domain serves parent website.
- [ ] App subdomain serves application.
- [ ] API routing and health checks work.
- [ ] HTTPS/canonical redirects work.
- [ ] Exact CORS allowlist and secure cookie scope.
- [ ] OAuth, email, OTP, invitation, reset links use environment config.
- [ ] Public sitemap excludes private app routes.

## Admin and security
- [ ] Platform settings typed, validated, authorized, audited.
- [ ] Secrets are not stored as plaintext ordinary settings.
- [ ] Organization admins cannot change global settings.
- [ ] IDOR and cross-organization tests pass.
- [ ] Contest anti-abuse and code sandbox remain active.
- [ ] No production secret is committed or exposed.

## Release
- [ ] Backup restore tested.
- [ ] Legacy data preserved and mapped.
- [ ] Unit/integration/e2e/build/type/lint tests pass.
- [ ] Migration dry-run passes.
- [ ] DNS/TLS verified externally.
- [ ] Post-cutover smoke tests and monitoring are active.
- [ ] Rollback plan is ready.
