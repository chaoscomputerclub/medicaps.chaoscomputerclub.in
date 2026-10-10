# FORENSIC AUDIT — CCC CADET PROFILE REAL-DATA MIGRATION

**Target File**: `src/pages/ProfilePage.tsx` and Child Components  
**Date**: October 2026  
**Auditor**: Antigravity Engineering Agent  
**Standard**: 100% Real Database-Driven Telemetry, Zero Fake/Mock/Synthesized Fallbacks, PostgreSQL Sole Source of Truth.

---

## 1. Executive Summary

A comprehensive forensic audit of `ProfilePage.tsx` and all subordinate components (`SolvedProblemsCard.tsx`, `BadgesCard.tsx`, `CodingActivityGraph.tsx`, `RecentSubmissionsCard.tsx`, `RatingChart.tsx`, `RatingDistributionCard.tsx`) was conducted to identify any static, hardcoded, placeholder, derived, or synthetically fabricated statistics.

All statistics, gauges, heatmaps, badges, and ledgers are now verified to be powered exclusively by real PostgreSQL data fetched through authoritative backend endpoints with zero duplicate APIs created.

---

## 2. Field-by-Field Telemetry Classification Matrix

| Surface / Component | Metric / UI Field | Prior State / Risk | Migrated State | Data Source (Backend / DB) |
|---|---|---|---|---|
| **Header Dossier** | Display Name | Potential fallback to static string | Resolved via `formatFullName(member.full_name)` or `@handle` | `MemberProfile.full_name`, `MemberProfile.handle` |
| **Header Dossier** | Avatar Image | Broken fallback or synthetic default | Uploadable MinIO S3 URL with fallback to initials | `MemberProfile.avatar_url` |
| **Header Dossier** | Enrollment (PRN) | Masked regex fallback or placeholder | Real `member.prn` extracted from verified record | `MemberProfile.prn` |
| **Header Dossier** | Department & Batch | Omitted or static strings | Real cadet metadata | `MemberProfile.department`, `MemberProfile.batch` |
| **Header Dossier** | Campus Email | Publicly leaked or hardcoded | Authenticated cadet's email; campus-protected for peers | `MemberProfile.email` |
| **Header Dossier** | University Tier | Hardcoded `"1★ Explorer"` | Dynamic rating tier from `RatingService.get_rating_tier()` | `MemberProfile.rating` |
| **Header Dossier** | Social Followers / Following | Unsynchronized local state | Real counts from `StudentFollow` table | `StudentFollow` via `MemberRepository.get_social_counts` |
| **4-Metric Bento** | Rating | Synthetic `1200` default | Real ELO rating | `MemberProfile.rating` |
| **4-Metric Bento** | Peak Rating | Uncalculated or hardcoded | Real historical peak rating | `MemberProfile.peak_rating` or `max(RatingHistory)` |
| **4-Metric Bento** | University Rank | Fake placeholder rank | Authoritative dense rank or `"Unranked"` | `MemberRepository.compute_ranks()` (`is_ranked`, `university_rank`) |
| **4-Metric Bento** | Podiums | Mock `0` or static number | Sum of verified top-3 finishes in official scoreboards | `ScoreboardEntry.rank <= 3` from `OfflineContest` |
| **4-Metric Bento** | Contests Attended | Phantom `"0/1"` state | Strict resolution: `attended / total_contests` (or `"0/0"` if no contests held) | `MemberRepository.get_attendance_and_contest_counts` |
| **Solved Problems** | Total Published | Hardcoded `|| 100` fallback | Real published count `problems.total` (honest `0` if empty) | `PracticeService.get_user_problem_stats` / `Problem` |
| **Solved Problems** | Solved Count | Local derivation | Authoritative `problems.solved` from PostgreSQL | `MemberProblemStats.status == 'SOLVED'` |
| **Solved Problems** | Easy Solved / Total | Static proportion | Real count of solved Easy problems vs total published Easy | `MemberProblemStats` join `Problem` (`difficulty='EASY'`) |
| **Solved Problems** | Medium Solved / Total | Static proportion | Real count of solved Medium problems vs total published Medium | `MemberProblemStats` join `Problem` (`difficulty='MEDIUM'`) |
| **Solved Problems** | Hard Solved / Total | Static proportion | Real count of solved Hard problems vs total published Hard | `MemberProblemStats` join `Problem` (`difficulty='HARD'`) |
| **Solved Problems** | Gauge Arc | Div/0 error or mock 100% | Multi-segment radial SVG arc scaled to real proportions | `SolvedProblemsCard.tsx` (computed from real counts) |
| **Badges Showcase** | Badge Count | `Math.max(1, earnedList.length)` (forced minimum 1 badge) | Honest count `earnedList.length` (displays `0` when none earned) | `MemberService.compute_achievements()` |
| **Badges Showcase** | Displayed Badges | Hardcoded static 3 badges (Tier, Verified, Cadet) | Dynamic rendering of cadet's real earned achievements with lock state if 0 | `MemberService.compute_achievements()` |
| **Badges Showcase** | Most Recent Badge | Static fallback or hardcoded string | Title of most recently unlocked achievement or `"None unlocked yet"` | `earnedList[earnedList.length - 1]` |
| **Coding Activity** | Total Submissions | Fake year-end sum | Sum of real submissions in past 365 days | `ContestSubmission` aggregation in PostgreSQL |
| **Coding Activity** | Active Days | Derived from client state | Authoritative distinct calendar days with submissions | `PracticeService.get_user_activity` |
| **Coding Activity** | Longest Streak | Unreliable client estimate | Authoritative database-aggregated consecutive submission streak | `PracticeService.get_user_activity` |
| **Coding Activity** | 52-Week Heatmap | Mock cells | 365 real date cells mapped to distinct problem activity | `PracticeService.get_user_activity` (`days` array) |
| **Recent Submissions** | Submission List | Mock battles or hardcoded rows | Real joined problem submissions via `get_recent_submissions` | `ContestSubmission` joined with `Problem` |
| **Recent Submissions** | Verdicts & Runtimes | Synthesized status tags | Real verdicts (`ACCEPTED`, `WRONG_ANSWER`, `TLE`) & execution times | `ContestSubmission.verdict`, `ContestSubmission.execution_time` |
| **Rating History** | Trajectory Points | Synthetic spline points | Historical rating progression per contested tournament | `RatingHistory` join `OfflineContest` |
| **Rating Distribution**| University Bell Curve | Hardcoded histogram bins | Real rating distribution of all active Medi-Caps cadets | `GET /api/leaderboard/distribution` |
| **Tournament Battles** | Attended Contests | Static placeholder array | Real offline lab contest entries with verified certificates | `ScoreboardEntry` join `OfflineContest` |
| **Achievements Ledger**| Milestones Unlocked | Client-side synthetic injection | Server-side verified achievements | `MemberService.compute_achievements()` |

---

## 3. Eliminated Anti-Patterns

1. **Eliminated `|| 100` Fallback in `SolvedProblemsCard`**:
   - *Previous*: `const totalPublished = problems.total || ... || 100;`
   - *Fix*: `const totalPublished = problems.total || (diff.easy.total + diff.medium.total + diff.hard.total) || 0;` with loading state `… / …`.
2. **Eliminated Forced `Math.max(1, earnedList.length)` in `BadgesCard`**:
   - *Previous*: Forcing 1 badge even when 0 achievements exist.
   - *Fix*: Honest `0` badge count with an accessible empty state explaining how to earn chapter badges.
3. **Eliminated Hardcoded Badge Trio in `BadgesCard`**:
   - *Previous*: Hardcoded SVG icons for "Tier", "Verified", "Cadet".
   - *Fix*: Maps over actual server-provided `achievements` with dynamic tier/podium/solver/veteran badge cards.
4. **Eliminated Client-Side Achievement Fabrication in `ProfilePage`**:
   - *Previous*: `if (achievements.length === 0 && m) { achievements = [ ... synthesized ... ] }`
   - *Fix*: Server calculates authoritative achievements in `MemberService.compute_achievements()` for both authenticated self-profile (`/auth/me`) and peer profiles (`/auth/profile/{handle}`).
5. **Eliminated Empty Recent Submissions Fallback**:
   - *Previous*: `RecentSubmissionsCard` only accepted `battles`.
   - *Fix*: Wires `practiceApi.getRecentSubmissions()` returning joined problem titles, difficulty tags, execution metrics, and relative timestamps.
