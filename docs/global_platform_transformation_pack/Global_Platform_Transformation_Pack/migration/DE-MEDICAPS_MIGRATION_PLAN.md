# DE-MEDICAPS MIGRATION PLAN

## Classify before changing
1. Hard eligibility/auth restriction — remove from public flows.
2. Branding/copy — replace with neutral platform language.
3. Optional institution feature — generalize to organization/workspace.
4. Historical/audit data — preserve.
5. Legacy contest — retain as private organization contest unless owner approves public release.
6. Deployment hostname/config — centralize.
7. Test/fixture/seed — update or explicitly retain as legacy migration fixture.

## Safe sequence
1. Backup DB and storage metadata; verify restore.
2. Add optional organization tables/relations without dropping legacy columns.
3. Backfill organization records for existing institutional data.
4. Add explicit resource visibility/scope fields.
5. Deploy code reading new model with legacy fallback.
6. Verify counts, relationships, ownership, reports, permissions.
7. Remove public university auth/feature checks.
8. Update UI, email, legal copy and URL generation.
9. Configure hostnames, reverse proxy, TLS and DNS.
10. After stable verification, remove obsolete constraints/columns in a separate migration.

## Invariants
- Preserve user IDs where possible.
- Users may have zero, one, or multiple organizations.
- Historical submissions keep participant mapping.
- Private legacy content never becomes public by accident.
- Consent history retains exact policy versions and timestamps.
- Reports/sessions remain owner-bound.

## Rollback
Keep old columns/mappings until verified. Use expand-and-contract. Retain backups and migration logs. Define forward-fix for additive changes. Never roll back in a way that discards new accounts or contest submissions.
