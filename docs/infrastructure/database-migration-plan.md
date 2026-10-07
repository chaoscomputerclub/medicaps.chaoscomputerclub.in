# CCC Medi-Caps — Database Migration Plan: VPS PostgreSQL to Supabase PostgreSQL 16

> **Source**: PostgreSQL 16 on VPS (`143.198.38.205`, `ccc_medicaps`)  
> **Destination**: Supabase Managed PostgreSQL 16 (`ap-south-1` Mumbai)  
> **Authoritative Guarantee**: Zero data loss, zero table drops without backup, checksum validation prior to traffic cutover.

---

## 1. Schema & Entity Inventory

The database migration encompasses the following authoritative tables and relations:

| Table Name | Primary Key | Foreign Keys & Constraints | Indexes | Critical Data / Semantics |
|---|---|---|---|---|
| `member_profiles` | `id` (UUIDv4) | `UNIQUE(handle)`, `UNIQUE(email)`, `UNIQUE(prn)` | `ix_member_profiles_handle`, `ix_member_profiles_role`, `ix_member_profiles_rating` | Student credentials, ratings, Peak rating, PRN |
| `offline_contests` | `id` (UUIDv4) | `UNIQUE(slug)` | `ix_offline_contests_status_starts`, `ix_offline_contests_slug` | Contests metadata, timing windows, published state |
| `problems` | `id` (UUIDv4) | `UNIQUE(slug)` | `ix_problems_difficulty`, `ix_problems_topic` | Master library problems, function signatures, testcases |
| `contest_problems` | `id` (UUIDv4) | `FK(contest_id -> offline_contests.id)`, `FK(problem_id -> problems.id)` | `ix_contest_problems_contest_id` | Contest-specific problems, points, testcase overrides |
| `contest_submissions`| `id` (UUIDv4) | `FK(contest_id)`, `FK(problem_id)`, `FK(member_id)` | `ix_contest_submissions_contest_problem_verdict`, `ix_contest_submissions_contest_member` | Student code, verdicts, points, measured latencies |
| `scoreboard_entries` | `id` (UUIDv4) | `FK(contest_id)`, `FK(member_id)`, `UNIQUE(contest_id, member_id)` | `ix_scoreboard_contest_score_penalty`, `ix_scoreboard_contest_rank` | Deterministic rankings, scores, penalties |
| `contest_registrations`| `id` (UUIDv4)| `FK(contest_id)`, `FK(member_id)`, `UNIQUE(contest_id, member_id)`| `ix_contest_registrations_contest_status` | Confirmed online registrations |
| `judge_jobs` | `id` (UUIDv4) | Reference to submissions & contests | `ix_judge_jobs_state_deadline`, `ix_judge_jobs_submission_id` | Execution state machine, active attempt pointers |
| `judge_job_attempts` | `id` (UUIDv4) | `FK(job_id -> judge_jobs.id)` | `ix_judge_job_attempts_lease_id`, `ix_judge_job_attempts_state` | Attempt tracking, node leases, timing breakdown |
| `outbox_events` | `id` (UUIDv4) | — | `ix_outbox_events_status_created` | Transactional event journal for at-least-once SSE pub |
| `resource_versions` | `resource_id` | — | Monotonic versioning | Distributed resource version locks & tracking |
| `rating_histories` | `id` (UUIDv4) | `FK(contest_id)`, `FK(member_id)` | `ix_rating_histories_member_contest` | Rating progression history |
| `trust_proofs` | `id` (UUIDv4) | `FK(contest_id)`, `FK(member_id)` | `ix_trust_proofs_member_contest` | Cryptographic trust-of-proof records |
| `campus_passes` | `id` (UUIDv4) | `FK(contest_id)`, `FK(member_id)` | `ix_campus_passes_code` | Digital admission tokens (virtual passes) |

---

## 2. Step-by-Step Migration Execution

```
[ PHASE A: Schema Init ]
   Create tables, sequences, types, indexes on Supabase target
          │
          ▼
[ PHASE B: Data Migration ]
   Stream tables via pg_dump / pg_restore or custom pipeline
          │
          ▼
[ PHASE C: Integrity Audit ]
   Row counts, MD5 checksums, FK relationship checks
          │
          ▼
[ PHASE D: Shadow Validation ]
   Cloud Run reads from Supabase; verify query latency & parity
          │
          ▼
[ PHASE E: Write Cutover ]
   Enable writes to Supabase primary; set old VPS to read-only
```

### Step 1: Schema Migration
Execute baseline migration DDL (`0001_initial_schema.sql` through `0005_outbox_events_enhancements.sql`) and `app.core.db.init_db()` against Supabase:
```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h "$SUPABASE_DB_HOST" \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f backend/migrations/0001_initial_schema.sql
```

### Step 2: Data Extraction & Safe Loading
Using `pg_dump` with data-only flags (`--data-only --disable-triggers`):
```bash
pg_dump -h 127.0.0.1 -U ccc_admin -d ccc_medicaps \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --format=custom \
  --file=ccc_medicaps_data.dump

pg_restore -h "$SUPABASE_DB_HOST" -p 5432 -U postgres -d postgres \
  --data-only \
  --disable-triggers \
  ccc_medicaps_data.dump
```

### Step 3: Row Count & Checksum Parity Verification
Execute query parity script comparing source and destination:
```sql
SELECT 'member_profiles' AS tbl, count(*) FROM member_profiles
UNION ALL SELECT 'offline_contests', count(*) FROM offline_contests
UNION ALL SELECT 'problems', count(*) FROM problems
UNION ALL SELECT 'contest_problems', count(*) FROM contest_problems
UNION ALL SELECT 'contest_submissions', count(*) FROM contest_submissions
UNION ALL SELECT 'scoreboard_entries', count(*) FROM scoreboard_entries
UNION ALL SELECT 'contest_registrations', count(*) FROM contest_registrations
UNION ALL SELECT 'judge_jobs', count(*) FROM judge_jobs
UNION ALL SELECT 'judge_job_attempts', count(*) FROM judge_job_attempts
UNION ALL SELECT 'outbox_events', count(*) FROM outbox_events;
```

### Step 4: Sequence and Trigger Realignment
Ensure monotonic sequences and version trackers are reset to $\max(\text{id}) + 1$.

---

## 3. Rollback & Fail-Safe Strategy

If Supabase experiences unexpected degradation during canary write phase:
1. **Immediate Fallback**: Cloud Run environment variable `DATABASE_URL` is switched back to VPS endpoint (`postgresql+asyncpg://ccc_admin:...@143.198.38.205:5432/ccc_medicaps`).
2. **Data Reconciliation**: Any delta written to Supabase is dumped using `WHERE created_at > $CUTOVER_TIMESTAMP` and replayed into VPS PostgreSQL.
3. **No Drop Invariant**: Old VPS PostgreSQL database is never dropped or emptied during migration. It remains untouched as a read/write standby for 14 days following successful cutover.
