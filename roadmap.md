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
- Backend: versioned `/api/v1` surface with a single aggregation point plus `/api/v1/meta`;
  new `contest_lifecycle_service` owning the funnel rules; assessment router now enforces
  the 24-hour window and anchors the 2-hour timer to the server-recorded start.

## Open
- Authenticated screens (assessment workspace, ranking with own row, QR pass, final room)
  are not browser-verified here: sign-in needs an email code that only the mail inbox sees.
- Dashboard feed still renders chapter announcements; converting it fully into a
  contest-first activity feed is the next pass.
- Backend changes take effect after the FastAPI server is redeployed.
