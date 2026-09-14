# CCC Medi-Caps — Contest Core Rebuild

## Done

- Adopted the uploaded project version as the working codebase (theme untouched).
- Added a same-origin `/api/*` gateway so previews talk to the FastAPI contest service
  without CORS or a second origin.
- New contest feature layer (`src/features/contest/`): typed API client, query options,
  lifecycle rules (24h Round 1 window, immutable 2h session, Top 30 cut), shared UI.
- Rebuilt with consistent shadcn primitives:
  - Contests hub: featured next edition, weekly/biweekly/upcoming/past views, past table.
  - Contest overview: phase-aware call to action, contest clock, rounds timeline, rules,
    problem set, registration dialog.
  - Round 1 ranking: search, qualified/eliminated views, Top 30 cut-off divider, pinned
    own standing.
  - Qualification & QR campus pass page.
  - Final contest room: check-in, workstation, sealed problem set, proctors.
  - Legacy `/assessment` link now redirects into the full-screen Monaco workspace.
  - Pre-assessment lobby with the unmissable non-pausable timer warning and rules
    acknowledgement, plus a skippable first-contest explainer.
  - Final results / winners page, and a final-results link from a completed contest.
  - Dashboard "What's happening" panel is now a contest-derived activity feed
    (registration open, Round 1 window, Top 30 announced, final live/complete).
- Backend: versioned `/api/v1` surface with a single aggregation point plus `/api/v1/meta`;
  new `contest_lifecycle_service` owning the funnel rules; assessment router now enforces
  the 24-hour window and anchors the 2-hour timer to the server-recorded start.
- Backend scale/architecture:
  - Pluggable judge providers (`app/engine/providers`): local sandbox by default,
    Judge0-compatible external service via `JUDGE_PROVIDER=judge0` + `JUDGE0_KEY`.
  - `judge_queue_service`: async worker pool so judging never blocks a request;
    same interface a Redis/Celery queue would use later.
  - `ranking_service`: cached ranking with invalidation on submit/finish, and the
    sealed-until-window-closes policy for Round 1 ranking (frontend renders the
    sealed state with the publish time).

## Open

- Authenticated screens (assessment workspace, ranking with own row, QR pass, final room)
  are not browser-verified here: sign-in needs an email code that only the mail inbox sees.
- Backend changes take effect after the FastAPI server is redeployed.

## Contest UX redesign

- [x] Apply selected Modernist Grid Hub with real contest rows and phase-aware countdowns.
- [x] Simplify overview actions, status labels, and schedule presentation.
- [x] Rebuild the hub in the selected CCC cyber-glass direction with contest visuals, top contestants, compact history, and a beginner-readable two-round path.
- [x] Carry the rounded glass hierarchy and simpler language into contest details, rankings, and My Contests.
- [x] Redesign contest details with a focused action area, milestone countdown, two-step journey, compact rules, and cleaner problem list.
- [ ] Validate signed-in screens: blocked by external email-code authentication.
