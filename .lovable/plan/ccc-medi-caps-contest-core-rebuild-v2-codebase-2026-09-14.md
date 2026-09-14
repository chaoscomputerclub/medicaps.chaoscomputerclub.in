# CCC Medi-Caps — Contest Core Rebuild (v2 codebase)

## What this does

Replaces this project with your uploaded v2 codebase, then rebuilds the contest
experience end to end around the two-round flow, in LeetCode's contest style,
using one consistent shadcn component language. The existing dark CCC theme,
colours, and fonts stay exactly as they are.

Your Python server stays the backend (it is live and answering right now). Its
code lives in this repo under `backend/`, so it gets restructured and extended
here too; you deploy it as you do today.

## Step 1 — Adopt the uploaded version

- Copy the uploaded project over this one (app code, `backend/`, styles, config),
  excluding build output, caches, git metadata, and the bundled SQLite file.
- Keep this project's dev/build configuration so preview keeps working.
- Drop the now-unused Lovable Cloud data calls from app code; your server is the
  single source of data.
- Confirm the app builds and the live API answers before changing behaviour.

## Step 2 — Contest model (weekly / biweekly, two rounds)

One contest = a Weekly or Biweekly edition with two rounds:

```text
Round 1  Online Assessment      opens after registration, closes 24h after opening
         2 hours once started   timer keeps running; cannot be paused or restarted
              |
         auto-scored -> live ranking -> hard Top 30 cutoff
              |
Round 2  Offline Final          on campus, QR pass required, Top 30 only
```

Rules enforced on the server:
- Assessment is only startable while the final contest is not live and before
  the final contest day.
- Assessment window auto-closes 24 hours after it opens.
- A started session runs a fixed 2-hour clock, server-authoritative, and
  auto-submits at zero even if the browser closed.
- Top 30 by score then penalty time qualify; qualification issues a QR pass.

## Step 3 — Pages

Contest area, all LeetCode-shaped and all data-driven:

- Contests hub — Weekly/Biweekly cards, live/upcoming/past tabs, countdown.
- Contest detail — rounds explainer, timeline, rules, register, my status.
- Assessment lobby — eligibility, window countdown, start confirmation.
- Assessment workspace — problem list, description pane, Monaco editor,
  language picker, run against samples, submit, verdict panel, testcase results,
  live 2-hour clock, autosave, finish dialog.
- Assessment ranking — LeetCode contest ranking table: rank, member, score,
  finish time, per-problem cells, my pinned row, search, and an unmistakable
  Top 30 cutoff line.
- Qualification result — qualified (with pass) or not qualified, with standing.
- Offline final access — QR campus pass, venue, seat, reporting time, check-in
  window; locked state with reason for everyone else.
- Final contest room — problem set and standings view for the 30 finalists,
  gated by pass check-in.
- My contests — history with round outcomes, rating change, certificates.
- Feed and dashboard reworked to contest events (registration open, assessment
  live, results out, qualifiers announced, final results).

Every page ships loading skeletons, empty states, and error states.

## Step 4 — UI consistency pass

Replace the hand-rolled markup and one-off CSS classes with shadcn primitives
(Card, Table, Tabs, Badge, Button, Dialog, Sheet, Progress, Tooltip, Select,
Skeleton, Sonner) driven by the existing theme tokens. No new colours, fonts,
radii, or animations. Custom CSS shrinks to layout-only helpers.

## Step 5 — Backend architecture

Restructure `backend/app` for maintainability and add what the flow needs:

```text
backend/app
  api/v1/routers/      thin HTTP layer, one router per resource
  services/            contest lifecycle, assessment, scoring, ranking,
                       qualification, passes, rating, notifications
  repositories/        all database access
  models/              SQLAlchemy tables
  schemas/             request/response contracts
  engine/              judge, executors, judge provider adapters
  core/                config, db, security, cache, storage, tasks
  workers/             scheduled jobs (window close, auto-submit, finalise)
```

New/changed endpoints cover contest lifecycle, registration, session
start/heartbeat/auto-submit, run/submit, ranking with cutoff, qualification and
pass issue/verify, final-round check-in, and history. Everything is versioned
under `/api/v1` with the current paths kept working.

Judging: your server already has its own sandbox executors, so they stay the
default. I add a pluggable judge provider so an external service (Judge0) can be
switched on with a key in the server's own environment — chosen per your answer,
without throwing away what already works.

Fresh realistic seed data: two editions (one past, one upcoming), problems with
sample and hidden tests, ~120 participants, full Round 1 rankings straddling the
Top 30 line, issued passes, and finished final results.

## Step 6 — Verification

Build, typecheck, and lint clean; browser pass over every page and state at
desktop and mobile widths; no console errors; timer, ranking, and pass flows
exercised against the live API.

## Notes and decisions to flag

- The Python server cannot run inside Lovable's preview host. Preview talks to
  your deployed API, so backend changes here take effect once you deploy them.
- Round 1 stays code-based with Monaco, per your flow. The multiple-choice
  variant is dropped.
- A Judge0 key is only needed if you switch the provider on; it belongs in your
  server's environment, not here.
