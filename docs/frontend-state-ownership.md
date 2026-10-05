# CCC Medi-Caps Online Platform — Frontend State Classification & Ownership

## 1. Classification Taxonomy

1. **`SERVER_STATE`**: Authoritative data originating from PostgreSQL via API. SWR memory store is primary cache; Redux only stores normalized references or active selection views.
2. **`CLIENT_STATE`**: Persistent client-side configurations and filters across routes (e.g., active problem filters, department filters).
3. **`SESSION_STATE`**: Authentication tokens, authenticated member identity, session validity.
4. **`UI_STATE`**: Transient UI control flags (drawers open/closed, active tabs, modal visibility, loading spinners).
5. **`DERIVED_STATE`**: Computed values derived dynamically via memoized selectors (`createSelector`), never stored redundantly.
6. **`EPHEMERAL_STATE`**: Input drafts, temporary form field inputs, editor cursor positions, split-pane drag sizes.

---

## 2. Redux Slice State Field Inventory

### `authSlice`
| Field | Classification | Authoritative Source | Invalidation & Boundary |
|---|---|---|---|
| `member` | `SERVER_STATE` | PostgreSQL `/auth/me` | Cleared completely on `auth/logout` |
| `token` | `SESSION_STATE` | JWT in HTTP/Cookie/Storage | Wiped on `auth/logout` or 401 response |
| `isAuthenticated` | `SESSION_STATE` | Computed from `token` | False on `auth/logout` |
| `step` | `UI_STATE` | Browser state machine | Reset to `"email"` on logout |
| `email` | `EPHEMERAL_STATE` | Auth form input | Reset on logout |
| `transactionId` | `EPHEMERAL_STATE` | Transient OTP transaction | Cleared after OTP verification |
| `otp` | `EPHEMERAL_STATE` | OTP form input | Wiped after submission |
| `pending` | `UI_STATE` | React Redux pending flag | False on complete/error |
| `message` | `UI_STATE` | API response message | Dismissed on user action |
| `handleStatus` | `UI_STATE` | Debounced check state | Idle on logout |

### `contestSlice`
| Field | Classification | Authoritative Source | Invalidation & Boundary |
|---|---|---|---|
| `contests` | `SERVER_STATE` | PostgreSQL `/contests/list` | SWR cache key `contests:list` |
| `currentContest` | `SERVER_STATE` | PostgreSQL `/contests/:slug` | Fenced by `activeDetailRequestId` |
| `registration` | `SERVER_STATE` | PostgreSQL `/contests/:slug/registration` | Revalidated on registration mutations |
| `problems` | `SERVER_STATE` | PostgreSQL `/contests/:slug/problems` | Refetched on contest start |
| `arenaData` | `SERVER_STATE` | PostgreSQL `/contests/:slug/arena` | Server-validated token |
| `myParticipations` | `SERVER_STATE` | PostgreSQL `/contests/participated` | Reset on `auth/logout` |
| `activeDetailRequestId` | `CLIENT_STATE` | Redux Action Meta | Used for request race condition fencing |
| `activeDetailSlug` | `CLIENT_STATE` | Router Slug | Tracks latest intended contest detail |
| `lastEventTimestamps` | `CLIENT_STATE` | SSE Event Timestamps | Drops out-of-order SSE updates per contest |
| `runResult` | `EPHEMERAL_STATE` | Transient test runner API | Cleared on next run or problem change |
| `submitResult` | `SERVER_STATE` | Authoritative CAS verdict | Stored in PostgreSQL submissions |
| `isLoading*` | `UI_STATE` | Async Thunk lifecycle | Reset when promise settles |

### `portalSlice`
| Field | Classification | Authoritative Source | Invalidation & Boundary |
|---|---|---|---|
| `activeContestSlug` | `CLIENT_STATE` | Navigation intent | Syncs with URL route |
| `divisionFilter` | `CLIENT_STATE` | User preference | Default `"all"` |
| `statusFilter` | `CLIENT_STATE` | User preference | Default `"all"` |
| `searchQuery` | `EPHEMERAL_STATE` | Filter input | Ephemeral |
| `bookmarkedProblems` | `CLIENT_STATE` | User-scoped local cache | Keyed by member ID: `ccc_bookmarked_problems_{memberId}` |
| `activeTab` | `UI_STATE` | Tab selection | Reset on page unmount |
| `leaderboardSearch` | `EPHEMERAL_STATE` | Search input | Reset on tab change |
| `leaderboardDept` | `CLIENT_STATE` | Filter preference | Default `"all"` |
| `leaderboardBatch` | `CLIENT_STATE` | Filter preference | Default `"all"` |

### `socialSlice`
| Field | Classification | Authoritative Source | Invalidation & Boundary |
|---|---|---|---|
| `followingIds` | `SERVER_STATE` | PostgreSQL `/social/following` | Wiped on `auth/logout` |
| `followersCount` | `SERVER_STATE` | PostgreSQL `/members/:id/profile` | Keyed by member ID: `ccc_my_social_counts_{memberId}` |
| `followingCount` | `SERVER_STATE` | PostgreSQL `/members/:id/profile` | Keyed by member ID: `ccc_my_social_counts_{memberId}` |
| `drawerOpen` | `UI_STATE` | UI drawer state | Closed on route change / logout |
| `drawerType` | `UI_STATE` | Drawer mode (`followers`/`following`) | Ephemeral |
| `drawerTargetHandle` | `UI_STATE` | Inspected user handle | Cleared on close |

### `uiSlice`
| Field | Classification | Authoritative Source | Invalidation & Boundary |
|---|---|---|---|
| `commandPaletteOpen` | `UI_STATE` | Keyboard shortcut / button | Reset on navigation |
| `sidebarCollapsed` | `CLIENT_STATE` | Local UI preference | Durable across sessions |
| `activeTheme` | `CLIENT_STATE` | Obsidian tactical dark | Immutable dark mode |

---

## 3. Cardinal Rules Enforced
1. **No Duplication of Server State**: Server data cached in SWR (`swrFetch`) is not cloned into Redux unless orchestrating compound UI flows.
2. **Hard Logout Boundary**: `auth/logout` passes `undefined` to `rootReducer`, restoring every slice to its clean initial state and wiping all user-scoped storage.
3. **Request Race Fencing**: Async operations track `requestId` to discard stale network responses arriving after newer user actions.
4. **SSE Ordering Fencing**: Realtime events track monotonic timestamps, dropping stale or out-of-order payloads.
