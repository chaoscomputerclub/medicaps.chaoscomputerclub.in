# 🧪 Chaos Computer Club India — Automated API QA Report
**Generated At:** 2026-09-15T22:14:34.549379+00:00  
**Target Environment:** Production Live Gateway (`https://medicaps.chaoscomputerclub.in`)  
**Execution Time:** 20722.29ms  
**Overall Success Rate:** **89.58%** (43/48 Passed, 5 Failed)

## Category Breakdown
| Category | Passed | Total | Rate | Avg Latency |
| :--- | :--- | :--- | :--- | :--- |
| **System & Health** | 1 | 1 | 100.0% | 1192.2ms |
| **Authentication** | 10 | 12 | 83.33% | 475.8ms |
| **Contests** | 4 | 4 | 100.0% | 393.5ms |
| **Leaderboards & Ratings** | 4 | 4 | 100.0% | 357.8ms |
| **Scoreboards** | 2 | 2 | 100.0% | 355.2ms |
| **Trust of Proof** | 2 | 2 | 100.0% | 355.5ms |
| **Campus Passes** | 2 | 2 | 100.0% | 363.8ms |
| **Campus Feed** | 2 | 2 | 100.0% | 409.6ms |
| **Social & OG** | 4 | 6 | 66.67% | 352.1ms |
| **Versioned v1 Gateway** | 3 | 3 | 100.0% | 456.6ms |
| **Dynamic Contest Engine** | 7 | 7 | 100.0% | 453.2ms |
| **Assessment Service** | 0 | 1 | 0.0% | 340.0ms |
| **Validation & Edge Cases** | 2 | 2 | 100.0% | 356.1ms |

## Test Case Results
| ID | Category | Name | Method | Endpoint | Status | Latency | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HEALTH-01` | System & Health | Production Health Probe & Infrastructure Readiness | `GET` | `/api/health` | 200 | 1192.2ms | ✅ PASS |
| `AUTH-01` | Authentication | RSA 256 JWT Public Key Fetch | `GET` | `/api/auth/jwt-public-key` | 200 | 352.1ms | ✅ PASS |
| `AUTH-02` | Authentication | Handle Availability Check (Available) | `GET` | `/api/auth/check-handle?handle=qa_cadet_unique_99` | 200 | 437.9ms | ✅ PASS |
| `AUTH-03` | Authentication | Non-Medi-Caps Email Rejection | `POST` | `/api/auth/send-otp` | 422 | 348.6ms | ✅ PASS |
| `AUTH-04` | Authentication | Valid Medi-Caps OTP Dispatch | `POST` | `/api/auth/send-otp` | 200 | 1621.5ms | ✅ PASS |
| `AUTH-05` | Authentication | Unauthenticated Profile Access (401 Rejection) | `GET` | `/api/auth/me` | 401 | 337.1ms | ✅ PASS |
| `AUTH-06` | Authentication | Authenticated Member Profile Fetch (/me) | `GET` | `/api/auth/me` | 401 | 395.6ms | ❌ FAIL (401) |
| `AUTH-07` | Authentication | Student Public Profile View (/profile/{handle}) | `GET` | `/api/auth/profile/qa_organizer` | 200 | 396.8ms | ✅ PASS |
| `AUTH-08` | Authentication | Student Public Profile View Alias (/users/{handle}) | `GET` | `/api/auth/users/qa_organizer` | 200 | 339.3ms | ✅ PASS |
| `AUTH-09` | Authentication | Authenticated Full Profile Alias (/profile/full) | `GET` | `/api/auth/profile/full` | 401 | 335.8ms | ❌ FAIL (401) |
| `AUTH-10` | Authentication | Student Public Profile View with Leading @ (@qa_organizer) | `GET` | `/api/auth/profile/@qa_organizer` | 200 | 336.3ms | ✅ PASS |
| `AUTH-11` | Authentication | Non-Existent Cadet Profile 404 Assertion | `GET` | `/api/auth/profile/non_existent_cadet_9999` | 404 | 335.5ms | ✅ PASS |
| `AUTH-12` | Authentication | Student Profile Deep Metric Schema Verification | `GET` | `/api/auth/profile/qa_organizer` | 200 | 472.6ms | ✅ PASS |
| `CONTEST-01` | Contests | List Official Campus Contests | `GET` | `/api/contests` | 200 | 395.7ms | ✅ PASS |
| `CONTEST-02` | Contests | Get Specific Contest Overview (Weekly #42) | `GET` | `/api/contests/weekly-contest-42` | 200 | 353.5ms | ✅ PASS |
| `CONTEST-03` | Contests | Get Contest Problem Arena (Weekly #42) | `GET` | `/api/contests/weekly-contest-42/problems` | 200 | 348.1ms | ✅ PASS |
| `CONTEST-04` | Contests | Non-Existent Contest 404 Assertion | `GET` | `/api/contests/invalid-contest-slug-nonexistent` | 404 | 476.6ms | ✅ PASS |
| `LEADER-01` | Leaderboards & Ratings | University Overall Leaderboard Standings | `GET` | `/api/leaderboard` | 200 | 354.3ms | ✅ PASS |
| `LEADER-02` | Leaderboards & Ratings | Departmental Aggregate Ratings | `GET` | `/api/leaderboard/departments` | 200 | 359.2ms | ✅ PASS |
| `LEADER-03` | Leaderboards & Ratings | Rating Distribution Histogram | `GET` | `/api/leaderboard/distribution` | 200 | 341.7ms | ✅ PASS |
| `LEADER-04` | Leaderboards & Ratings | Rating Distribution Histogram Defensive Schema Assertion | `GET` | `/api/leaderboard/distribution` | 200 | 376.0ms | ✅ PASS |
| `SCORE-01` | Scoreboards | Contest Scoreboard Matrix (Weekly #42) | `GET` | `/api/scoreboards/weekly-contest-42` | 200 | 361.6ms | ✅ PASS |
| `SCORE-02` | Scoreboards | Contest Scoreboard Division Filtering | `GET` | `/api/scoreboards/weekly-contest-42?division=division_1` | 200 | 348.9ms | ✅ PASS |
| `PROOF-01` | Trust of Proof | List Cryptographic Trust Proofs | `GET` | `/api/verify/proofs` | 200 | 346.9ms | ✅ PASS |
| `PROOF-02` | Trust of Proof | Tamper-Proof Verification Query (Invalid Token) | `POST` | `/api/verify` | 200 | 364.2ms | ✅ PASS |
| `PASS-01` | Campus Passes | List Contest Attendees for Proctors | `GET` | `/api/passes/contest/weekly-contest-42/attendees` | 200 | 356.6ms | ✅ PASS |
| `PASS-02` | Campus Passes | Invalid Pass Code Lookup (404) | `GET` | `/api/passes/INVALID_PASS_9999` | 404 | 370.9ms | ✅ PASS |
| `FEED-01` | Campus Feed | List Campus Announcements & Bulletins | `GET` | `/api/feed/announcements` | 200 | 426.8ms | ✅ PASS |
| `FEED-02` | Campus Feed | Filter Announcements by Category | `GET` | `/api/feed/announcements?kind=system` | 200 | 392.4ms | ✅ PASS |
| `SOCIAL-01` | Social & OG | Cadet Followers Network Query | `GET` | `/api/social/qa_organizer/followers` | 200 | 375.5ms | ✅ PASS |
| `SOCIAL-02` | Social & OG | Cadet Following Network Query | `GET` | `/api/social/qa_organizer/following` | 200 | 347.1ms | ✅ PASS |
| `SOCIAL-03` | Social & OG | My Following IDs Endpoint | `GET` | `/api/social/my-following-ids` | 401 | 345.0ms | ❌ FAIL (401) |
| `SOCIAL-04` | Social & OG | Handle Sanitization With Leading @ | `GET` | `/api/social/@qa_organizer/followers` | 200 | 337.0ms | ✅ PASS |
| `SOCIAL-05` | Social & OG | Self Follow Rejection (400) | `POST` | `/api/social/follow/qa_organizer` | 401 | 361.1ms | ❌ FAIL (401) |
| `SOCIAL-06` | Social & OG | Peer Profile Followers Drawer Query with Leading @ | `GET` | `/api/social/@qa_organizer/following` | 200 | 346.6ms | ✅ PASS |
| `V1-01` | Versioned v1 Gateway | v1 Metadata & System Probe | `GET` | `/api/v1/meta` | 200 | 488.1ms | ✅ PASS |
| `V1-02` | Versioned v1 Gateway | v1 Contests Resource Gateway | `GET` | `/api/v1/contests` | 200 | 337.5ms | ✅ PASS |
| `V1-03` | Versioned v1 Gateway | v1 Leaderboard Resource Gateway | `GET` | `/api/v1/leaderboard` | 200 | 544.1ms | ✅ PASS |
| `DYNAMIC-01` | Dynamic Contest Engine | Launch Preset Contest (QA Weekly #999) | `POST` | `/api/admin/contests/preset/launch` | 201 | 408.4ms | ✅ PASS |
| `DYNAMIC-02` | Dynamic Contest Engine | Add Problem D Dynamically with Testcases | `POST` | `/api/admin/contests/weekly-contest-999/problems` | 200 | 372.9ms | ✅ PASS |
| `DYNAMIC-03` | Dynamic Contest Engine | Update Contest Specifications & Max Seats | `PUT` | `/api/admin/contests/weekly-contest-999` | 200 | 347.5ms | ✅ PASS |
| `DYNAMIC-04` | Dynamic Contest Engine | Transition Contest Lifecycle (Upcoming -> Live) | `POST` | `/api/admin/contests/weekly-contest-999/status` | 200 | 508.1ms | ✅ PASS |
| `DYNAMIC-05` | Dynamic Contest Engine | Clone Contest into Edition #2 | `POST` | `/api/admin/contests/weekly-contest-999/clone` | 201 | 513.8ms | ✅ PASS |
| `DYNAMIC-06` | Dynamic Contest Engine | Cascade Delete QA Contests | `DELETE` | `/api/admin/contests/weekly-contest-999` | 200 | 447.9ms | ✅ PASS |
| `DYNAMIC-07` | Dynamic Contest Engine | Cascade Delete Cloned QA Contest | `DELETE` | `/api/admin/contests/weekly-contest-999-v2` | 200 | 573.9ms | ✅ PASS |
| `ASSESS-01` | Assessment Service | Fetch Screening Assessment Status (Weekly #42) | `GET` | `/api/assessment/weekly-contest-42` | 401 | 340.0ms | ❌ FAIL (401) |
| `EDGE-01` | Validation & Edge Cases | Admin Dynamic Create Payload Missing Required Fields (422) | `POST` | `/api/admin/contests` | 422 | 367.3ms | ✅ PASS |
| `EDGE-02` | Validation & Edge Cases | Contest Registration Without Auth (401 Rejection) | `POST` | `/api/contests/weekly-contest-42/register` | 401 | 344.9ms | ✅ PASS |
