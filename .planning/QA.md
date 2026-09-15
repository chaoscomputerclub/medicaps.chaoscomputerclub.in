# 🧪 Chaos Computer Club India — Automated API QA Report
**Generated At:** 2026-09-15T22:13:07.800975+00:00  
**Execution Time:** 2225.38ms  
**Overall Success Rate:** **89.58%** (43/48 Passed, 5 Failed)

## Category Breakdown
| Category | Passed | Total | Rate | Avg Latency |
| :--- | :--- | :--- | :--- | :--- |
| **System & Health** | 1 | 1 | 100.0% | 62.4ms |
| **Authentication** | 12 | 12 | 100.0% | 158.8ms |
| **Contests** | 2 | 4 | 50.0% | 6.3ms |
| **Leaderboards & Ratings** | 4 | 4 | 100.0% | 2.3ms |
| **Scoreboards** | 0 | 2 | 0.0% | 1.6ms |
| **Trust of Proof** | 2 | 2 | 100.0% | 2.4ms |
| **Campus Passes** | 2 | 2 | 100.0% | 2.3ms |
| **Campus Feed** | 2 | 2 | 100.0% | 1.9ms |
| **Social & OG** | 6 | 6 | 100.0% | 3.0ms |
| **Versioned v1 Gateway** | 3 | 3 | 100.0% | 8.6ms |
| **Dynamic Contest Engine** | 7 | 7 | 100.0% | 6.0ms |
| **Assessment Service** | 0 | 1 | 0.0% | 2.3ms |
| **Validation & Edge Cases** | 2 | 2 | 100.0% | 1.3ms |

## Test Case Results
| ID | Category | Name | Method | Endpoint | Status | Latency | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
|  | System & Health | Production Health Probe & Infrastructure Readiness |  |  | 200 | 62.4ms | ✅ PASS |
|  | Authentication | RSA 256 JWT Public Key Fetch |  |  | 200 | 3.7ms | ✅ PASS |
|  | Authentication | Handle Availability Check (Available) |  |  | 200 | 2.0ms | ✅ PASS |
|  | Authentication | Non-Medi-Caps Email Rejection |  |  | 422 | 1.4ms | ✅ PASS |
|  | Authentication | Valid Medi-Caps OTP Dispatch |  |  | 200 | 1851.6ms | ✅ PASS |
|  | Authentication | Unauthenticated Profile Access (401 Rejection) |  |  | 401 | 3.3ms | ✅ PASS |
|  | Authentication | Authenticated Member Profile Fetch (/me) |  |  | 200 | 24.4ms | ✅ PASS |
|  | Authentication | Student Public Profile View (/profile/{handle}) |  |  | 200 | 10.3ms | ✅ PASS |
|  | Authentication | Student Public Profile View Alias (/users/{handle}) |  |  | 200 | 2.0ms | ✅ PASS |
|  | Authentication | Authenticated Full Profile Alias (/profile/full) |  |  | 200 | 1.9ms | ✅ PASS |
|  | Authentication | Student Public Profile View with Leading @ (@qa_organizer) |  |  | 200 | 1.6ms | ✅ PASS |
|  | Authentication | Non-Existent Cadet Profile 404 Assertion |  |  | 404 | 1.4ms | ✅ PASS |
|  | Authentication | Student Profile Deep Metric Schema Verification |  |  | 200 | 1.5ms | ✅ PASS |
|  | Contests | List Official Campus Contests |  |  | 200 | 18.9ms | ✅ PASS |
|  | Contests | Get Specific Contest Overview (Weekly #42) |  |  | 404 | 3.0ms | ❌ FAIL (404) |
|  | Contests | Get Contest Problem Arena (Weekly #42) |  |  | 404 | 1.8ms | ❌ FAIL (404) |
|  | Contests | Non-Existent Contest 404 Assertion |  |  | 404 | 1.6ms | ✅ PASS |
|  | Leaderboards & Ratings | University Overall Leaderboard Standings |  |  | 200 | 4.5ms | ✅ PASS |
|  | Leaderboards & Ratings | Departmental Aggregate Ratings |  |  | 200 | 2.1ms | ✅ PASS |
|  | Leaderboards & Ratings | Rating Distribution Histogram |  |  | 200 | 1.5ms | ✅ PASS |
|  | Leaderboards & Ratings | Rating Distribution Histogram Defensive Schema Assertion |  |  | 200 | 1.1ms | ✅ PASS |
|  | Scoreboards | Contest Scoreboard Matrix (Weekly #42) |  |  | 404 | 1.8ms | ❌ FAIL (404) |
|  | Scoreboards | Contest Scoreboard Division Filtering |  |  | 404 | 1.4ms | ❌ FAIL (404) |
|  | Trust of Proof | List Cryptographic Trust Proofs |  |  | 200 | 3.1ms | ✅ PASS |
|  | Trust of Proof | Tamper-Proof Verification Query (Invalid Token) |  |  | 200 | 1.7ms | ✅ PASS |
|  | Campus Passes | List Contest Attendees for Proctors |  |  | 200 | 3.3ms | ✅ PASS |
|  | Campus Passes | Invalid Pass Code Lookup (404) |  |  | 404 | 1.3ms | ✅ PASS |
|  | Campus Feed | List Campus Announcements & Bulletins |  |  | 200 | 2.4ms | ✅ PASS |
|  | Campus Feed | Filter Announcements by Category |  |  | 200 | 1.4ms | ✅ PASS |
|  | Social & OG | Cadet Followers Network Query |  |  | 200 | 6.4ms | ✅ PASS |
|  | Social & OG | Cadet Following Network Query |  |  | 200 | 2.0ms | ✅ PASS |
|  | Social & OG | My Following IDs Endpoint |  |  | 200 | 2.1ms | ✅ PASS |
|  | Social & OG | Handle Sanitization With Leading @ |  |  | 200 | 2.6ms | ✅ PASS |
|  | Social & OG | Self Follow Rejection (400) |  |  | 400 | 3.2ms | ✅ PASS |
|  | Social & OG | Peer Profile Followers Drawer Query with Leading @ |  |  | 200 | 1.5ms | ✅ PASS |
|  | Versioned v1 Gateway | v1 Metadata & System Probe |  |  | 200 | 23.6ms | ✅ PASS |
|  | Versioned v1 Gateway | v1 Contests Resource Gateway |  |  | 200 | 1.3ms | ✅ PASS |
|  | Versioned v1 Gateway | v1 Leaderboard Resource Gateway |  |  | 200 | 1.0ms | ✅ PASS |
|  | Dynamic Contest Engine | Launch Preset Contest (QA Weekly #999) |  |  | 201 | 8.2ms | ✅ PASS |
|  | Dynamic Contest Engine | Add Problem D Dynamically with Testcases |  |  | 200 | 7.1ms | ✅ PASS |
|  | Dynamic Contest Engine | Update Contest Specifications & Max Seats |  |  | 200 | 3.1ms | ✅ PASS |
|  | Dynamic Contest Engine | Transition Contest Lifecycle (Upcoming -> Live) |  |  | 200 | 4.2ms | ✅ PASS |
|  | Dynamic Contest Engine | Clone Contest into Edition #2 |  |  | 201 | 5.7ms | ✅ PASS |
|  | Dynamic Contest Engine | Cascade Delete QA Contests |  |  | 200 | 8.2ms | ✅ PASS |
|  | Dynamic Contest Engine | Cascade Delete Cloned QA Contest |  |  | 200 | 5.2ms | ✅ PASS |
|  | Assessment Service | Fetch Screening Assessment Status (Weekly #42) |  |  | 404 | 2.3ms | ❌ FAIL (404) |
|  | Validation & Edge Cases | Admin Dynamic Create Payload Missing Required Fields (422) |  |  | 422 | 1.4ms | ✅ PASS |
|  | Validation & Edge Cases | Contest Registration Without Auth (401 Rejection) |  |  | 401 | 1.3ms | ✅ PASS |
