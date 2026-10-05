# DATABASE DATA INTEGRITY SCAN REPORT
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Database:** PostgreSQL 16 (Relational Engine)  
**Execution Timestamp:** 2026-10-05T08:15:47+05:30  
**Branch:** `audit/state-consistency-hardening`  

---

## 1. INTEGRITY SCAN RESULTS

An automated diagnostic scan was executed against the active database across all core domain tables: `offline_contests`, `member_profiles`, `contest_registrations`, `contest_submissions`, `scoreboard_entries`, `rating_history`, `judge_jobs`, and `judge_job_attempts`.

| Table | Constraint / Invariant Tested | Violating Rows | Finding Status | Repair Strategy | Risk Level |
|---|---|---|---|---|---|
| `contest_registrations` | Unique contestant per contest: `(contest_id, member_id)` | 0 | CLEAN | N/A (Guaranteed by `uq_contest_member_reg`) | Low |
| `rating_history` | At most one rating update per contest per member: `(contest_id, member_id)` | 0 | CLEAN | Enforce DB unique constraint in SQLAlchemy model | Low |
| `scoreboard_entries` | At most one ranking row per contest per member: `(contest_id, member_id)` | 0 | CLEAN | N/A (Guaranteed by `uq_scoreboard_contest_member`) | Low |
| `contest_submissions` | Referential integrity to parent contest (`contest_id` $\to$ `offline_contests.id`) | 0 | CLEAN | N/A (Cascade foreign key active) | Low |
| `contest_submissions` | Referential integrity to challenge problem (`problem_id` $\to$ `contest_problems.id`) | 0 | CLEAN | N/A (Cascade foreign key active) | Low |
| `contest_submissions` | Referential integrity to cadet profile (`member_id` $\to$ `member_profiles.id`) | 0 | CLEAN | N/A (Cascade foreign key active) | Low |
| `offline_contests` | Canonical lifecycle states (`upcoming`, `live`, `finished`) | 0 | CLEAN | Validate transitions in dynamic contest service | Low |
| `judge_jobs` | Finalized jobs (`COMPLETED`, `FAILED`) must clear `active_attempt_id` | 0 | CLEAN | Conditional CAS update in `AttemptManager` | Low |
| `contest_registrations` | Orphan registrations referencing non-existent member profiles | 0 | CLEAN | Foreign key constraint active | Low |

---

## 2. STRUCTURAL MODEL VULNERABILITIES IDENTIFIED

While no active data corruption is present in existing rows, the following structural model gaps represent latent risks under high concurrent load:

1. **`RatingHistory` SQLAlchemy Model:** Missing explicit `UniqueConstraint("contest_id", "member_id", name="uq_rating_history_contest_member")` in model `__table_args__`. While the DDL in `ensure_database_integrity` attempts creation, the ORM model lacked the declared constraint.
2. **Registration Row Lock:** `register_for_contest` lacked row-level lock (`with_for_update()`) on `OfflineContest`, creating a race condition window where concurrent registrations could exceed `seat_capacity`.
3. **Ratings Participant Filter:** `_apply_final_ratings` included any registration with `status == "confirmed"`, causing unparticipated members to receive scoreboard entries and rating deltas.
4. **HTTP Idempotency Header:** Missing `Idempotency-Key` interceptor on mutation endpoints.
