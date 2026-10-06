# STATE MANAGEMENT MAP & CLASSIFICATION TAXONOMY
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Scope:** Distributed Client-Server State Topology & Synchronization Contract  
**Status:** FORENSIC AUDIT COMPLETE · ZERO SPECULATIVE STATE SLICES  

---

## 1. The 9 Canonical State Categories

Every state value in the CCC platform belongs to exactly one category in this taxonomy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       A. AUTHORITATIVE SERVER STATE                         │
│             PostgreSQL 16 Engine · ACID Transactions · Row Locks            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────┐                             ┌───────────────────────┐
│B. DERIVED SERVER STATE│                             │C. REDIS EPHEMERAL ST. │
│ Scoreboard, Ratings,  │                             │ Queues, Leases, Locks,│
│ Attendance Aggregates │                             │ Circular Replay Buffer│
└───────────┬───────────┘                             └───────────┬───────────┘
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       ▼ (REST / SSE Sync)
┌─────────────────────────────────────────────────────────────────────────────┐
│                          D. FRONTEND SERVER CACHE                           │
│     SWR Memory Store (`globalSwrStore`) · Session Storage Hydration Cache   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ E. REDUX GLOBAL STATE │  │ F. LOCAL COMPONENT ST.│  │  G. URL / ROUTER ST.  │
│ 6 Slices: auth, ui,   │  │ useState / useRef     │  │ Route Params, Filters,│
│ portal, contest,      │  │ Editor Models,        │  │ Active Slugs, Tabs    │
│ social, assessment    │  │ Terminal Buffers      │  │                       │
└───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘
            │                          │                          │
            └──────────────────────────┼──────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 H. PERSISTED BROWSER STATE (LocalStorage)                   │
│        JWT Tokens, Stored Member Profile, Bookmarked Problems per UID       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    I. TRANSIENT UI STATE (Animation/DOM)                    │
│      Drawer Visibility, Split-Pane Widths, Tooltips, Toast Notifications    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive State Inventory & Ownership Map

### Category A: Authoritative Server State (PostgreSQL 16)
| State Entity | Owner Subsystem | Storage Table | Writer Function | Invalidation & Mutator Flow |
|---|---|---|---|---|
| Cadet Profile & Identity | Auth / Member Service | `member_profiles` | `update_profile`, `complete_onboarding` | Updates DB row, deletes `cache:member:*`, publishes `member_profile_updated` |
| Contest Metadata & Rules | Contest Domain Service | `offline_contests` | `DynamicContestService.create_contest / update_contest` | Updates DB row, deletes `cache:contest:*`, publishes `contest_updated` |
| Contest Registrations | Contest Registration Service | `contest_registrations` | `ContestService.register_for_contest / unregister` | Inserts/deletes DB row, writes `outbox_events`, deletes `cache:reg_status:*` |
| Problem Spec & Testcases | Problem Management Service | `problems`, `problem_testcases` | `AdminProblemService.upsert_problem` | Updates DB, invalidates compilation cache, deletes `cache:contest:problems:*` |
| Submissions & Verdicts | Contest Execution Service | `contest_submissions` | `ContestExecutionService.submit_arena_code` | Inserts DB row under `pg_advisory_xact_lock`, writes outbox event |
| Judge Jobs & Attempts | Compute Fabric Router | `judge_jobs`, `judge_job_attempts` | `AttemptManager.create_job`, `finalize_attempt` | Atomic CAS `UPDATE ... WHERE active_attempt_id=:id` |
| Campus QR Passes | Pass Service | `campus_passes` | `PassService.generate_pass / verify_and_check_in` | Commits DB status `checked_in`, deletes `cache:passes:*`, emits SSE |

---

### Category B: Derived Server State (Computed Server Facts)
| State Entity | Derivation Basis | Storage Location | Invalidation / Recomputation Path |
|---|---|---|---|
| Contest Scoreboard Matrix | Sum of accepted problem points, penalty seconds sum | `scoreboard_entries` | Recomputed in DB via `ContestRepository.re_rank_scoreboard()` on each `ACCEPTED` submission under transaction lock |
| Global Rating Standing (Elo) | Historical contest results & relative rank | `member_profiles.rating`, `rating_history` | Recomputed exclusively at contest conclusion via `DynamicContestService._apply_final_ratings()` |
| Contest Attendance Total | Finished contests attended by cadet | `member_profiles.attendance_count` | Recomputed from distinct `scoreboard_entries` on contest deletion or conclusion |
| Problem Solved Count | Count of distinct members with `ACCEPTED` verdict | `contest_problems.solved_count` | Atomically incremented inside submission evaluation transaction if first solve |

---

### Category C: Redis Ephemeral State (Redis 7 Coordination Plane)
| Key Pattern | Redis Structure | Purpose & Authority | TTL | Cleanup Mechanism |
|---|---|---|---|---|
| `ccc:queue:fabric:pending` | List | Execution Job Queue (Work items awaiting worker claim) | Ephemeral | Popped by workers via `RPOPLPUSH` |
| `ccc:queue:fabric:processing` | List | In-flight execution jobs leased by workers | Ephemeral | Cleaned by `FabricReaper` on expired lease |
| `ccc:job:{job_id}` | String (JSON) | Worker dispatch metadata & job status tracking | 86,400s (24h) | Redis TTL expiry |
| `ccc:lease:{job_id}` | String | Distributed worker lease fence | 30s | Heartbeat extension or reaper expiration |
| `ccc:sse:replay:{channel}` | Sorted Set (ZSET) | Circular replay buffer for `Last-Event-ID` recovery | 86,400s | Trimmed to max 100 items via `ZREMRANGEBYRANK` |
| `ccc:realtime:events` | Pub/Sub Channel | Multi-process ASGI worker real-time message bus | Zero (Transient) | Origin loopback suppression via `_instance_id` |
| `sub_debounce:{cid}:{pid}:{uid}:{hash}` | String | 2-second submission debounce barrier | 2s | Redis NX TTL expiry |
| `ccc:sync:idem:{event_id}` | String | Idempotency guard for `CacheSyncEngine` | 3,600s (1h) | Redis TTL expiry |
| `ccc:version:{resource_id}` | String | Monotonic version tracker for Cache CAS engine | 604,800s (7d) | Redis TTL expiry |

---

### Category D: Frontend Server Cache (SWR Memory Store)
| Cache Pattern Key | Target Query Payload | Default Stale Time | Invalidation Trigger |
|---|---|---|---|
| `contests:list` | All upcoming, live, and concluded contests | 30s | SSE `contest_created`, `contest_status_changed`, `contest_concluded` |
| `contest:detail:{slug}` | Single contest metadata & overview | 30s | SSE `contest_updated`, `contest_timer_reset`, `contest_status_changed` |
| `contest:problems:{slug}` | Problems list and starter codes | 30s | SSE `contest_updated` |
| `scoreboard:{slug}` | Official problem-matrix contest scoreboard | 10s | SSE `submission_evaluated`, `submission_completed`, `resync_required` |
| `leaderboard:*` | Global university Elo rating standings | 60s | SSE `leaderboard_updated`, `ratings_updated` |
| `student:profile:{handle}` | Public cadet portfolio and stats | 60s | SSE `member_profile_updated`, `ratings_updated` |
| `passes:my_pass:{slug}` | Cadet campus QR admission pass | 30s | SSE `pass_checked_in`, `contest_registered` |

---

### Category E: Redux Global State (Redux Toolkit)
| Slice Name | Primary State Fields | Authoritative Source | Synchronization & Wipe Boundaries |
|---|---|---|---|
| `authSlice` | `member`, `token`, `isAuthenticated`, `step` | PostgreSQL `/api/auth/me` & JWT | Wiped to `initialState` on `auth/logout` via `rootReducer` |
| `contestSlice` | `contests`, `currentContest`, `registration`, `problems`, `myParticipations` | PostgreSQL `/api/contests/*` | Updated immediately by `applyRealtimeEvent`, fenced by `lastEventTimestamps` |
| `socialSlice` | `followingIds`, `followersCount`, `followingCount`, `drawerOpen` | PostgreSQL `/api/social/*` | Synced via SSE `member_profile_updated`, wiped on logout |
| `assessmentSlice` | `assessment`, `session`, `problems`, `codeMap`, `submissionsMap` | PostgreSQL `/api/assessment/*` | Managed locally during screening, finalized on finish |
| `portalSlice` | `divisionFilter`, `statusFilter`, `bookmarkedProblems`, `activeTab` | Client preferences & User bookmarks | Bookmarks keyed by UID in LocalStorage |
| `uiSlice` | `commandPaletteOpen`, `sidebarCollapsed`, `activeTheme` | Client UI layout preferences | `sidebarCollapsed` persisted in LocalStorage |

---

### Category F: Local Component State (React Hooks)
| Component | Hook / Variable | State Purpose | Persistence |
|---|---|---|---|
| `ContestArenaPage` | `remainingSeconds` | Monitored countdown timer in arena | Synchronized via SSE `arena_timer_reset` & clock tick |
| `ContestArenaPage` | `currentCode` | In-progress editor code buffer for active problem | Local component state; restored from starter code |
| `ContestArenaPage` | `submissionHistory` | Local submission list for active problem tab | Saved to `localStorage: ccc_submissions_{slug}_{pid}` |
| `ContestArenaPage` | `solvedProblemIds` | Set of solved problems in current session | Saved to `localStorage: ccc_solved_{slug}` |
| `AssessmentWorkspacePage` | `antiCheatViolations` | Tab-switch / fullscreen breach counter | Telemetry synced to `/api/assessment/telemetry` |
| `LeaderboardPage` | `searchQuery`, `deptFilter` | Client-side filter query in standings | Ephemeral component state |

---

### Category G: URL / Router State (React Router v6)
| Route Pattern | URL State Parameters | Consumer Component | Invalidation on Route Change |
|---|---|---|---|
| `/contests/:slug` | `slug` (Contest Identifier) | `ContestOverviewPage`, `PortalShell` | Sets `activeDetailSlug`, fetches contest detail |
| `/contests/:slug/arena` | `slug` | `ContestArenaPage` | Connects contest SSE stream `contest:{slug}` |
| `/contests/:slug/lobby` | `slug` | `ContestLobbyPage` | Polls/streams check-in status |
| `/contests/:slug/summary` | `slug` | `ContestSummaryPage` | Displays final personal score & matrix |
| `/profile/:handle` | `handle` (Cadet Username) | `ProfilePage` | Loads public cadet dossier |

---

### Category H: Persisted Browser State (Browser Storage)
| Storage Key | Storage API | Content Schema | Wipe Boundary |
|---|---|---|---|
| `ccc_medicaps_token` | `localStorage` | Raw JWT Auth Bearer string | Removed immediately on `clearToken()` / logout |
| `ccc_medicaps_member` | `localStorage` | Serialized `Member` JSON object | Removed on `clearToken()` |
| `ccc_my_social_counts_{uid}` | `localStorage` | `{followers_count, following_count}` | Removed on logout for that UID |
| `ccc_bookmarked_problems_{uid}`| `localStorage` | Array of bookmarked problem IDs | Isolated per user ID |
| `__ccc_swr_cache_{identity}__` | `sessionStorage` | Serialized SWR memory store | Wiped on `ccc:auth-changed` event |

---

### Category I: Transient UI State
| UI Control | Location | Mechanism |
|---|---|---|
| Command Palette Dialog | `uiSlice.commandPaletteOpen` | Keyboard shortcut `⌘K` / `Ctrl+K` |
| Cadet Hover Card | `CadetProfileHoverCard` | Radix HoverCard open/close state |
| Code Execution Console Drawer | `ContestArenaPage.isDrawerCollapsed` | Collapsible split-view drawer |
| Testcase Tab Switcher | `ContestArenaPage.activeConsoleTab` | Tab state (`testcases` vs `output`) |
| Toast Notifications | `sonner` Toaster | In-memory message stack |
