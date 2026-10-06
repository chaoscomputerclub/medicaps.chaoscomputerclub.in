# Regression Test Coverage Gaps

Identifies historical production bugs that lack permanent automated regression tests.

## Critical & High Priority Gaps

### `REG-0037` — fix(db): revert invalid expire_on_rollback parameter
- **Commit:** `1ef2a5a` (2026-10-01T06:21:53+05:30)
- **Severity:** `HIGH` | **Category:** `AUTH_SESSION`
- **Invariant:** `AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS`
- **Root Cause:** SQLAlchemy 2.0 AsyncSession does not support expire_on_rollback.
Reverts to the previous valid session factory configuration.

The greenlet error will be fixed properly at the call sites in
the execution services (refresh objects after rollback or snapshot
data before rollback instead of relying on post-rollback access).
- **Affected Files:** `backend/app/core/db.py`

### `REG-0042` — feat(infra): end-to-end structured trace IDs (X-Request-ID, contextvar, job correlation_id)
- **Commit:** `ed051b9` (2026-10-01T00:33:02+05:30)
- **Severity:** `HIGH` | **Category:** `REQUEST_RACE`
- **Invariant:** `OLDER_ASYNC_RESPONSE_MUST_NEVER_OVERWRITE_NEWER_STATE`
- **Root Cause:** feat(infra): end-to-end structured trace IDs (X-Request-ID, contextvar, job correlation_id)
- **Affected Files:** `backend/app/middleware/trace_id.py`, `backend/app/modules/contests/contest_controller.py`, `backend/main.py`

### `REG-0058` — Revert "feat: remediate Google OAuth verification requirements and establish public pages"
- **Commit:** `81e6ef5` (2026-09-27T22:06:28+05:30)
- **Severity:** `HIGH` | **Category:** `AUTH_SESSION`
- **Invariant:** `AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS`
- **Root Cause:** This reverts commit a56237337da467e44e5350f1478662a57614cc23.
- **Affected Files:** `.planning/qa/UI_BUTTONS_AUDIT.md`, `.planning/qa/api_contract_report.json`, `.planning/qa/ui_buttons_audit_report.json`, `backend/app/api/v1/router.py`, `backend/app/modules/assessments/assessment_service.py`

### `REG-0060` — feat: remediate Google OAuth verification requirements and establish public pages
- **Commit:** `a562373` (2026-09-27T21:54:59+05:30)
- **Severity:** `HIGH` | **Category:** `AUTH_SESSION`
- **Invariant:** `AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS`
- **Root Cause:** feat: remediate Google OAuth verification requirements and establish public pages
- **Affected Files:** `.planning/qa/UI_BUTTONS_AUDIT.md`, `.planning/qa/api_contract_report.json`, `.planning/qa/ui_buttons_audit_report.json`, `backend/app/api/v1/router.py`, `backend/app/modules/assessments/assessment_service.py`

### `REG-0078` — fix(a11y): upgrade RatingChart, ScoreboardMatrix, and CampusPassCard empty states to text-zinc-400 for WCAG AA compliance
- **Commit:** `3e245b0` (2026-09-25T23:14:50+05:30)
- **Severity:** `HIGH` | **Category:** `RATING`
- **Invariant:** `RATING_CALCULATION_AND_FINALIZATION_MUST_BE_STRICTLY_IDEMPOTENT`
- **Root Cause:** fix(a11y): upgrade RatingChart, ScoreboardMatrix, and CampusPassCard empty states to text-zinc-400 for WCAG AA compliance
- **Affected Files:** `src/organization/components/CampusPassCard.tsx`, `src/organization/components/RatingChart.tsx`, `src/organization/components/ScoreboardMatrix.tsx`

### `REG-0092` — fix(auth): keep user logged in persistently with 30-day sessions, proactive keepalive, and resilient AuthGuard
- **Commit:** `e55fe81` (2026-09-24T22:02:06+05:30)
- **Severity:** `HIGH` | **Category:** `AUTH_SESSION`
- **Invariant:** `AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS`
- **Root Cause:** fix(auth): keep user logged in persistently with 30-day sessions, proactive keepalive, and resilient AuthGuard
- **Affected Files:** `backend/app/controllers/auth_controller.py`, `backend/app/core/config.py`, `backend/app/core/security.py`, `backend/app/routers/auth.py`, `src/lib/auth.ts`

### `REG-0112` — fix(perf): eliminate navigation lag, WebGL loop leaks, and redundant auth thunks
- **Commit:** `bcec2b6` (2026-09-23T19:07:28+05:30)
- **Severity:** `CRITICAL` | **Category:** `CROSS_USER_LEAK`
- **Invariant:** `LOGOUT_MUST_PURGE_ALL_USER_SCOPED_STATE_PREVENTING_CROSS_USER_LEAKAGE`
- **Root Cause:** fix(perf): eliminate navigation lag, WebGL loop leaks, and redundant auth thunks
- **Affected Files:** `.planning/qa/UI_BUTTONS_AUDIT.md`, `.planning/qa/frontend_e2e_report.json`, `.planning/qa/ui_buttons_audit_report.json`, `public/trophy.png`, `public/trophy.webp`

### `REG-0117` — fix: replace 1200 elo with email address in portal sidebar
- **Commit:** `f336997` (2026-09-22T18:00:26+05:30)
- **Severity:** `HIGH` | **Category:** `RATING`
- **Invariant:** `RATING_CALCULATION_AND_FINALIZATION_MUST_BE_STRICTLY_IDEMPOTENT`
- **Root Cause:** fix: replace 1200 elo with email address in portal sidebar
- **Affected Files:** `.planning/QA.md`, `.planning/qa/API_QA_REPORT.md`, `.planning/qa/UI_BUTTONS_AUDIT.md`, `.planning/qa/api_qa_report.json`, `.planning/qa/frontend_e2e_report.json`

### `REG-0121` — fix: unify rank telemetry and resolve avatar persistence in database
- **Commit:** `1530e2c` (2026-09-22T16:59:54+05:30)
- **Severity:** `HIGH` | **Category:** `SCOREBOARD`
- **Invariant:** `SCOREBOARD_STANDING_MUST_HAVE_EXACTLY_ONE_AUTHORITATIVE_SOURCE`
- **Root Cause:** fix: unify rank telemetry and resolve avatar persistence in database
- **Affected Files:** `.planning/QA.md`, `.planning/qa/API_QA_REPORT.md`, `.planning/qa/UI_BUTTONS_AUDIT.md`, `.planning/qa/api_qa_report.json`, `.planning/qa/frontend_e2e_report.json`

### `REG-0130` — fix(profile): populate battles, history, proofs, achievements and resolve enrollment number extraction
- **Commit:** `8c4d267` (2026-09-22T04:38:27+05:30)
- **Severity:** `HIGH` | **Category:** `STATE_MANAGEMENT`
- **Invariant:** `OPERATION_MUST_SATISFY_STRICT_STATE_MANAGEMENT_CONTRACT`
- **Root Cause:** fix(profile): populate battles, history, proofs, achievements and resolve enrollment number extraction
- **Affected Files:** `.planning/QA.md`, `.planning/qa/API_QA_REPORT.md`, `.planning/qa/UI_BUTTONS_AUDIT.md`, `.planning/qa/api_qa_report.json`, `.planning/qa/frontend_e2e_report.json`

### `REG-0220` — feat: production backend hardening
- **Commit:** `1d6198c` (2026-09-14T15:07:20+05:30)
- **Severity:** `HIGH` | **Category:** `AUTH_SESSION`
- **Invariant:** `AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS`
- **Root Cause:** Rate Limiting (Redis sliding window):
- New middleware/rate_limit.py — sliding-window rate limiter via Redis
  pipeline (ZREMRANGEBYSCORE + ZCARD + ZADD + EXPIRE).
  Fails open when Redis is unavailable (no false positives).
- /run endpoint: 30 req/60s per user (sample-test spam protection)
- /submit endpoint: 5 req/60s per user (judge queue protection)

Background Tasks (production async workers):
- New services/background_tasks_service.py with two coroutines:
  1. session_expiry_loop (60s interval): auto-submits in-progress
     AssessmentSessions whose 120-min clock has expired. Without this,
     a session is only closed on the user's next request.
  2. auto_qualify_loop (120s interval): after the assessment window
     closes marks the Top-30 AssessmentSessions as is_top_30_qualified,
     so the live contest gate works without organiser intervention.
- Both tasks are idempotent and cancel cleanly on lifespan shutdown.

Lifespan update (main.py):
- Spawns background tasks at startup and cancels them on shutdown.
- /api/health now reports redis + judge_provider status in body.

Seed service fix:
- Timing reset is now guarded: starts_at is NOT updated if any
  in-progress sessions exist. Prevents the 2hr server-anchored timer
  from being invalidated when the process restarts mid-contest.

Admin endpoints (routers/admin.py):
- POST /api/admin/sessions/sweep  — force-runs the session sweeper
- POST /api/admin/qualify/run     — force-runs auto-qualify check
- **Affected Files:** `backend/app/middleware/rate_limit.py`, `backend/app/routers/admin.py`, `backend/app/routers/assessment.py`, `backend/app/services/background_tasks_service.py`, `backend/app/services/seed_service.py`

### `REG-0222` — fix(seed): anchor Round 1 window so 10s countdown opens assessment for 24 hours
- **Commit:** `992dfd9` (2026-09-14T14:42:02+05:30)
- **Severity:** `HIGH` | **Category:** `SSE_ORDERING`
- **Invariant:** `SSE_EVENTS_MUST_OBEY_MONOTONIC_ORDERING_AND_DISCARD_STALE_TIMESTAMPS`
- **Root Cause:** fix(seed): anchor Round 1 window so 10s countdown opens assessment for 24 hours
- **Affected Files:** `backend/app/routers/contests.py`, `backend/app/services/seed_service.py`

