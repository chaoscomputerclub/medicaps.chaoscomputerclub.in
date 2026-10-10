# PROFILE API REUSE REPORT — ZERO DUPLICATE ENDPOINTS

**Project**: Chaos Computer Club Medi-Caps Competitive Programming Platform  
**Target Surface**: Profile & Cadet Dossier (`ProfilePage.tsx`)  
**Standard**: Strict API Reuse First Protocol — Zero Duplication of Endpoints.

---

## 1. Architectural Policy & Compliance

The cardinal directive of this migration was:
> **"Reuse existing APIs first. Only create a new API when the existing backend genuinely does not expose the required data. Never create duplicate endpoints that return data another API already provides."**

Before touching any code, a complete backend API audit was conducted across `backend/app/routers/` (`auth.py`, `practice.py`, `leaderboard.py`, `contests.py`). The audit confirmed that the platform's existing FastAPI architecture already possessed rich canonical endpoints.

Rather than creating redundant endpoints like `/profile/stats`, `/profile/badges`, `/profile/solved`, or `/user/activity`, the profile UI was wired directly to existing canonical endpoints.

---

## 2. API Reuse & Consumption Matrix

| Profile UI Surface / Requirement | Canonical Backend Endpoint | Router / Controller | Service / Database Query | Reused Without Duplicate? |
|---|---|---|---|:---:|
| **Cadet Identity, PRN, Avatar, Bio, Links** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `MemberService.get_full_profile`<br>`MemberService.get_student_public_profile` | **YES** (100% Reused) |
| **ELO Rating, Peak Rating, Tier** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `MemberProfile.rating`<br>`RatingService.get_rating_tier()` | **YES** (100% Reused) |
| **University Rank & Percentile** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `MemberRepository.compute_ranks()` (PostgreSQL dense rank) | **YES** (100% Reused) |
| **Verified Podiums & Attendance** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `MemberRepository.get_attendance_and_contest_counts()` | **YES** (100% Reused) |
| **Official Tournament Battle Logs** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `ScoreboardEntry` join `OfflineContest` | **YES** (100% Reused) |
| **Rating Trajectory (Historical Line Chart)** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `RatingHistory` join `OfflineContest` | **YES** (100% Reused) |
| **Campus Rating Bell Curve Distribution** | `GET /api/leaderboard/distribution` | `leaderboard.py`<br>`LeaderboardController` | `LeaderboardService.get_rating_distribution()` | **YES** (100% Reused) |
| **Authoritative Problem Solving Counts (Easy/Med/Hard)** | `GET /api/practice/stats`<br>`GET /api/practice/stats/{handle}` | `practice.py`<br>`PracticeRouter` | `PracticeService.get_user_problem_stats()` (`MemberProblemStats`) | **YES** (100% Reused) |
| **365-Day Coding Activity & Streaks** | `GET /api/practice/activity`<br>`GET /api/practice/activity/{handle}` | `practice.py`<br>`PracticeRouter` | `PracticeService.get_user_activity()` (PostgreSQL date aggregation) | **YES** (100% Reused) |
| **Recent Submissions Ledger (AC & All Submissions)** | `GET /api/practice/submissions/recent`<br>`GET /api/practice/submissions/recent/{handle}` | `practice.py`<br>`PracticeRouter` | `PracticeService.get_recent_submissions()` (`ContestSubmission` + `Problem`) | **YES** (100% Reused) |
| **Authoritative Chapter Badges & Milestones** | `GET /api/auth/me`<br>`GET /api/auth/profile/{handle}` | `auth.py`<br>`AuthController` | `MemberService.compute_achievements()` | **YES** (100% Reused) |

---

## 3. Data Integrity & Single Source of Truth

- **PostgreSQL as Canonical Source**:
  - `MemberProfile`: Cadet credentials, rating, peak rating, PRN, bio, department, batch.
  - `MemberProblemStats`: Authoritative problem-solving state machine (`UNATTEMPTED` $\rightarrow$ `ATTEMPTED` $\rightarrow$ `SOLVED`). Once solved, invariant guarantees status never reverts on subsequent failures.
  - `ContestSubmission`: Raw submission telemetry (context `PRACTICE` or `CONTEST`, verdict, execution time, memory used).
  - `ScoreboardEntry` & `OfflineContest`: Official campus contest participation, ranks, solved counts, rating deltas.
  - `StudentFollow`: Campus social follower and following connections.
- **Client Cache Synchronization**:
  - SWR cache keys partitioned by viewer target (`practice:stats:${handle}`, `practice:activity:${handle}`, `practice:submissions:recent:${handle}`).
  - Mutations and avatar updates trigger targeted SWR invalidation without full page reloads.
- **Duplicate Endpoint Count**: **0**.
