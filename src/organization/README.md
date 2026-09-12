# CCC Member Portal — frontend notes

Frontend only. No backend, no auth server, no judge. Everything below is mock data
shaped exactly like the eventual API responses so swapping in real endpoints is a
change of one file (`src/portal/api.ts`).

## Routes

| Route                           | Screen                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| `/login`                        | Email → six-digit OTP sign-in                                       |
| `/signup`                       | Name / handle / email → OTP confirmation                            |
| `/recover`                      | Recovery code for a lost account                                    |
| `/portal`                       | Dashboard: stats, registered events, open problems, recent activity |
| `/portal/events`                | Upcoming / past tabs                                                |
| `/portal/events/$eventSlug`     | Event detail + register / withdraw                                  |
| `/portal/problems`              | Archive with search, difficulty, status and tag filters             |
| `/portal/problems/$problemSlug` | Prompt, constraints, editor, submission history                     |
| `/portal/profile`               | Identity, skills, contribution history, all achievements            |

## Data layer

- `types.ts` — API contracts (`Member`, `ClubEvent`, `Problem`, `Submission`,
  `Achievement`, `ActivityItem`). Snake_case fields, ISO timestamps, explicit
  nullables.
- `fixtures.ts` — two fixture sets: an established member (`Riya Kulkarni`) and a
  brand-new member (`Arjun Menon`) with empty lists for zero-state review. Event
  dates are generated relative to now, so upcoming events stay upcoming.
- `api.ts` — async functions with simulated latency (~420ms). Session-local
  mutable state, so RSVP changes and submissions persist until reload.
- `queries.ts` — TanStack Query options, keyed by data mode.
- `data-mode.tsx` — the sidebar "New-member view" switch flips fixture sets. This
  is a review control; remove it when real data lands.

## Deliberate limitations

- OTP accepts any six digits; no code is actually emailed and no session is created.
- Sign-in navigates to `/portal` without a guard — every portal route is reachable
  directly.
- Submissions are queued and never executed; there is no judge or test runner.
- The editor is a gutter + tab-aware textarea rather than Monaco: no execution
  engine exists yet and the portal's weight/motion budget rules out an editor bundle.
- Profile edits and RSVPs are lost on reload.

## Motion budget

180ms route fade, one-time 35ms row stagger, 120–150ms hover/focus colour shifts,
shape-matched skeletons, fast dialogs and toasts. None of the root site's cinematic
motion (Lenis, magnetic cursor, marquees, 3D) runs inside the portal. All of it
honours `prefers-reduced-motion`.

## Folder layout (updated)

The member application lives in one folder, separate from the marketing site:

```
src/organization/
  components/   PortalShell, shared portal UI primitives, CodeEditor, auth chrome
  data/         types.ts, fixtures.ts, api.ts, queries.ts, data-mode.tsx
  README.md
```

TanStack Router requires route files to stay under `src/routes/portal/*`; those
files are thin page components that import everything else from
`@/organization/*`.

## Competition surfaces

- `/portal/contests` — contest index with state tabs, format notes and scoring reference.
- `/portal/contests/$contestSlug` — briefing, rules, problem set (sealed while upcoming), standings, registration.
- `/portal/leaderboard` — season / all-time / rookie boards with rank movement, table on desktop and stacked rows on mobile.

Contest and leaderboard data lives in the same fixture/API/query layer as the
rest of the portal, keyed by data mode so the new-member zero-state stays
reviewable.
