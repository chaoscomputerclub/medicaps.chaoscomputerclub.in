"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Script: launch_official_contests.py
Launches 1 Official Weekly Contest and 1 Official Biweekly Contest with:
- Rich problem sets (A, B, C, D)
- LeetCode-style function/class Solution starter codes (Python, C++, JS, Java)
- Clean parameter-based database test cases (Sample + Hidden)
- Cache invalidation and clean DB transaction
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select, delete
from app.core.db import AsyncSessionLocal, init_db
from app.models.db_models import (
    OfflineContest,
    ContestProblem,
    Assessment,
    AssessmentProblem,
    now_utc,
)
from app.core.cache import delete_cache_pattern
from app.services.seed_service import purge_all_contest_data
from app.services.contest_schedule_service import get_next_wednesday_schedule


OFFICIAL_WEEKLY_PROBLEMS = [
    {
        "index": "A",
        "title": "Campus Pass String Validator",
        "difficulty": "EASY",
        "points": 100,
        "topic": "String Manipulation & Hashing",
        "description": "At Medi-Caps University, campus pass numbers are issued as alphanumeric strings. Two passes are considered a 'mirror pair' if one string is the exact reverse of the other (e.g., 'AB' and 'BA'). Given an array of pass strings, determine the total count of valid unordered mirror pairs (i < j where passes[i] is the reverse of passes[j]).",
        "input_format": "passes = [\"string_1\", \"string_2\", ...]",
        "output_format": "Return an integer representing the total count of valid mirror pairs.",
        "constraints": "1 <= passes.length <= 100,000\n1 <= passes[i].length <= 20\npasses[i] consists of alphanumeric characters.",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def countMirrorPairs(self, passes: list[str]) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <string>\n#include <unordered_map>\n#include <algorithm>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int countMirrorPairs(vector<string>& passes) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "javascript": "/**\n * @param {string[]} passes\n * @return {number}\n */\nvar countMirrorPairs = function(passes) {\n    // Write your solution here\n};\n",
            "java": "class Solution {\n    public int countMirrorPairs(String[] passes) {\n        // Write your solution here\n        return 0;\n    }\n}\n"
        },
        "sample_testcases": [
            {
                "stdin": "passes = [\"AB\", \"BA\", \"CD\", \"DC\"]",
                "expected_output": "2",
                "explanation": "Valid mirror pairs are ('AB', 'BA') and ('CD', 'DC')."
            },
            {
                "stdin": "passes = [\"ABC\", \"CBA\", \"ABC\"]",
                "expected_output": "2",
                "explanation": "Passes 0 and 1 are mirrors ('ABC', 'CBA'), and passes 1 and 2 are mirrors ('CBA', 'ABC')."
            }
        ],
        "hidden_testcases": [
            {"stdin": "passes = [\"HELLO\"]", "expected_output": "0", "weight": 1.0},
            {"stdin": "passes = [\"AA\", \"AA\", \"AA\", \"BB\", \"BB\", \"CC\"]", "expected_output": "4", "weight": 2.0},
            {"stdin": "passes = [\"XYZ\", \"ZYX\", \"XYZ\", \"ZYX\"]", "expected_output": "4", "weight": 2.0}
        ]
    },
    {
        "index": "B",
        "title": "Medi-Caps Lab Router Bandwidth Allocation",
        "difficulty": "MEDIUM",
        "points": 200,
        "topic": "Greedy & Priority Queue",
        "description": "The Medi-Caps lab router has M megabits of total bandwidth to distribute among K competing lab processes. Process i requires at least min_i bandwidth and can consume at most max_i bandwidth, yielding utility = allocated_bandwidth * priority_i. Find the maximum total utility achievable such that the sum of allocated bandwidth does not exceed M and every process receives at least its minimum requirement. If the total minimum requirements exceed M, return -1.",
        "input_format": "k = <integer>\nm = <integer>\nprocesses = [[min_i, max_i, priority_i], ...]",
        "output_format": "Return the maximum total utility achievable, or -1 if impossible.",
        "constraints": "1 <= k <= 10^5\n1 <= m <= 10^9\n0 <= min_i <= max_i <= 10^5\n1 <= priority_i <= 1000",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def maxBandwidthUtility(self, k: int, m: int, processes: list[list[int]]) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxBandwidthUtility(int k, int m, vector<vector<int>>& processes) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "javascript": "/**\n * @param {number} k\n * @param {number} m\n * @param {number[][]} processes\n * @return {number}\n */\nvar maxBandwidthUtility = function(k, m, processes) {\n    // Write your solution here\n};\n",
            "java": "class Solution {\n    public int maxBandwidthUtility(int k, int m, int[][] processes) {\n        // Write your solution here\n        return 0;\n    }\n}\n"
        },
        "sample_testcases": [
            {
                "stdin": "k = 3\nm = 12\nprocesses = [[2, 5, 3], [1, 4, 5], [3, 3, 3]]",
                "expected_output": "44",
                "explanation": "Min sum is 2+1+3=6 <= 12. Remaining 6 bandwidth is allocated greedily by priority: process 2 (prio 5) gets 4 with utility 20, process 1 (prio 3) gets 5 with utility 15, process 3 (prio 3) gets 3 with utility 9 => total = 20 + 15 + 9 = 44."
            },
            {
                "stdin": "k = 2\nm = 5\nprocesses = [[3, 6, 10], [4, 8, 10]]",
                "expected_output": "-1",
                "explanation": "Min bandwidth 3+4=7 exceeds total available m=5, so return -1."
            }
        ],
        "hidden_testcases": [
            {"stdin": "k = 1\nm = 100\nprocesses = [[10, 50, 10]]", "expected_output": "500", "weight": 1.0},
            {"stdin": "k = 3\nm = 20\nprocesses = [[5, 10, 4], [5, 10, 8], [5, 10, 2]]", "expected_output": "110", "weight": 2.0}
        ]
    },
    {
        "index": "C",
        "title": "Air-Gapped Quantum Key Distribution",
        "difficulty": "MEDIUM",
        "points": 300,
        "topic": "Graph Dijkstra & Dynamic Programming",
        "description": "An air-gapped lab network consists of N workstations numbered 1 to N and M bidirectional communication channels. Each channel connects workstation u and v with latency L (in milliseconds). Workstation 1 needs to transmit an encrypted cryptographic key to workstation N. You may deploy at most K quantum booster repeaters at intermediate workstations. A repeater reduces the latency of its adjacent outgoing channel by half (floor division). Find the minimum total transmission latency from workstation 1 to workstation N.",
        "input_format": "n = <integer>\nm = <integer>\nk = <integer>\nchannels = [[u, v, latency], ...]",
        "output_format": "Return the minimum total transmission latency from workstation 1 to n.",
        "constraints": "2 <= n <= 1000\n1 <= m <= 10^4\n0 <= k <= 10\n1 <= latency <= 10^6",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def minTransmissionLatency(self, n: int, m: int, k: int, channels: list[list[int]]) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <queue>\n#include <tuple>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int minTransmissionLatency(int n, int m, int k, vector<vector<int>>& channels) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "javascript": "/**\n * @param {number} n\n * @param {number} m\n * @param {number} k\n * @param {number[][]} channels\n * @return {number}\n */\nvar minTransmissionLatency = function(n, m, k, channels) {\n    // Write your solution here\n};\n",
            "java": "class Solution {\n    public int minTransmissionLatency(int n, int m, int k, int[][] channels) {\n        // Write your solution here\n        return 0;\n    }\n}\n"
        },
        "sample_testcases": [
            {
                "stdin": "n = 4\nm = 4\nk = 1\nchannels = [[1, 2, 10], [2, 4, 10], [1, 3, 20], [3, 4, 5]]",
                "expected_output": "15",
                "explanation": "Path 1 -> 2 -> 4 has latency 10 + 10 = 20. With 1 booster on edge (1,2), latency becomes 5 + 10 = 15. Path 1 -> 3 -> 4 with booster on (1,3) gives 10 + 5 = 15."
            }
        ],
        "hidden_testcases": [
            {"stdin": "n = 3\nm = 2\nk = 0\nchannels = [[1, 2, 100], [2, 3, 200]]", "expected_output": "300", "weight": 1.0},
            {"stdin": "n = 3\nm = 2\nk = 1\nchannels = [[1, 2, 100], [2, 3, 200]]", "expected_output": "200", "weight": 2.0}
        ]
    },
    {
        "index": "D",
        "title": "Subnet Packet Collision Minimizer",
        "difficulty": "HARD",
        "points": 400,
        "topic": "Dynamic Programming & Bitmask",
        "description": "Given N network packets each with a start time, duration, and priority score, schedule a subset of non-overlapping packets to maximize the total priority score while adhering to subnet channel capacity constraints.",
        "input_format": "packets = [[start_time, end_time, priority], ...]",
        "output_format": "Return the maximum possible sum of priority scores.",
        "constraints": "1 <= packets.length <= 10^5\n1 <= start_time < end_time <= 10^9\n1 <= priority <= 10^6",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def maxPacketPriority(self, packets: list[list[int]]) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxPacketPriority(vector<vector<int>>& packets) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "javascript": "/**\n * @param {number[][]} packets\n * @return {number}\n */\nvar maxPacketPriority = function(packets) {\n    // Write your solution here\n};\n",
            "java": "class Solution {\n    public int maxPacketPriority(int[][] packets) {\n        // Write your solution here\n        return 0;\n    }\n}\n"
        },
        "sample_testcases": [
            {
                "stdin": "packets = [[1, 3, 50], [2, 4, 10], [3, 5, 40]]",
                "expected_output": "90",
                "explanation": "Select intervals [1,3] (score 50) and [3,5] (score 40) => total 90."
            }
        ],
        "hidden_testcases": [
            {"stdin": "packets = [[1, 2, 5], [2, 3, 5], [3, 4, 5], [1, 4, 20]]", "expected_output": "20", "weight": 1.0},
            {"stdin": "packets = [[1, 10, 100], [2, 5, 200]]", "expected_output": "200", "weight": 2.0}
        ]
    }
]


async def launch_contests(force: bool = False):
    print("=" * 70)
    print("⚡ [CCC] Launching / Verifying Official Weekly Contest on Medi-Caps Portal")
    print("=" * 70)

    await init_db()

    async with AsyncSessionLocal() as db:
        # Check if an active or upcoming contest already exists in DB
        existing_res = await db.execute(
            select(OfflineContest).where(
                (OfflineContest.slug == "weekly-contest-1") |
                (OfflineContest.status.in_(["upcoming", "live"]))
            )
        )
        existing_contest = existing_res.scalars().first()

        if existing_contest and not force:
            print("\n🔒 [IMMUTABLE TIMERS ACTIVE]")
            print(f"  ✓ Official contest '{existing_contest.title}' ({existing_contest.slug}) is already established.")
            print(f"  ✓ Starts at (UTC): {existing_contest.starts_at}")
            print(f"  ✓ Ends at (UTC):   {existing_contest.ends_at}")

            clean_summary = (
                "Wednesday algorithmic showdown for Medi-Caps students. 4 algorithmic challenges "
                "testing graph traversal, greedy optimization, and dynamic programming. "
                "Open to all students — ratings update on the university leaderboard."
            )
            clean_rules = [
                "Schedule: Every Wednesday from 3:00 PM to 4:30 PM IST in the online arena.",
                "Format: 4 algorithmic problems ranging from Easy to Hard in a 90-minute live session.",
                "Open Access: All enrolled Medi-Caps University students are eligible to participate.",
                "Submissions: Evaluated via CodeBox automated sandbox with sub-millisecond precision.",
                "Leaderboard: Official university Elo ratings are updated on the global scoreboard following contest completion."
            ]
            existing_contest.summary = clean_summary
            existing_contest.rules = clean_rules
            existing_contest.venue = "Online Arena · Open to All Students"
            existing_contest.environment = "Online Arena · GCC 14 / Clang 18 / Python 3.12 / Java 21"
            existing_contest.seat_capacity = 1000

            assess_res = await db.execute(
                select(Assessment).where(Assessment.contest_id == existing_contest.id)
            )
            existing_assess = assess_res.scalars().first()
            if existing_assess:
                existing_assess.title = "Weekly Contest 1 — Live Algorithmic Arena"
                existing_assess.summary = "Official weekly algorithmic contest for Medi-Caps students. Solve all 4 challenges within 90 minutes."

            # Synchronize LeetCode starter codes and test cases into existing problems
            for p_data in OFFICIAL_WEEKLY_PROBLEMS:
                if existing_assess:
                    ap_res = await db.execute(
                        select(AssessmentProblem).where(
                            AssessmentProblem.assessment_id == existing_assess.id,
                            AssessmentProblem.problem_index == p_data["index"]
                        )
                    )
                    ap = ap_res.scalars().first()
                    if ap:
                        ap.starter_codes = p_data["starter_codes"]
                        ap.sample_testcases = p_data["sample_testcases"]
                        ap.hidden_testcases = p_data["hidden_testcases"]
                        ap.input_format = p_data["input_format"]
                        ap.output_format = p_data["output_format"]
                        ap.constraints = p_data["constraints"]

                cp_res = await db.execute(
                    select(ContestProblem).where(
                        ContestProblem.contest_id == existing_contest.id,
                        ContestProblem.problem_index == p_data["index"]
                    )
                )
                cp = cp_res.scalars().first()
                if cp:
                    cp.starter_codes = p_data["starter_codes"]
                    cp.sample_testcases = p_data["sample_testcases"]
                    cp.hidden_testcases = p_data["hidden_testcases"]
                    cp.input_format = p_data["input_format"]
                    cp.output_format = p_data["output_format"]
                    cp.constraints = p_data["constraints"]

            await db.commit()
            print("  ✓ Updated contest content, starter codes, and LeetCode test cases in DB.")
            try:
                await delete_cache_pattern("cache:*")
                print("  ✓ Redis cache invalidated.")
            except Exception as e:
                print("Notice on cache delete:", e)
            return

        if force or not existing_contest:
            print("\n🔹 Purging old contest records for clean canonical schedule...")
            await purge_all_contest_data(db)
            print("  ✓ Old contest data purged cleanly.")

        # Canonical Wednesday Schedule: Every Wednesday 3:00 PM – 4:30 PM IST (09:30 – 11:00 UTC)
        weekly_starts, weekly_ends, weekly_checkin, assess_opens, assess_closes = get_next_wednesday_schedule()

        now = datetime.now(timezone.utc)

        # =====================================================================
        # 1. WEEKLY CONTEST 1
        # =====================================================================
        print("\n🔹 [1/1] Creating Weekly Contest 1 (Canonical Wednesday Schedule)...")
        print(f"  Starts at (UTC): {weekly_starts.isoformat()} (Wednesday 3:00 PM IST)")
        print(f"  Ends at (UTC):   {weekly_ends.isoformat()} (Wednesday 4:30 PM IST)")
        print(f"  Check-in (UTC):  {weekly_checkin.isoformat()} (Wednesday 2:00 PM IST)")
        print(f"  Screening Open:  {assess_opens.isoformat()} (Tuesday 3:00 PM IST - Exactly 24h prior)")
        print(f"  Screening Close: {assess_closes.isoformat()} (Wednesday 1:00 PM IST - Exactly 2h prior)")

        weekly_contest = OfflineContest(
            slug="weekly-contest-1",
            title="CCC Weekly Contest 1",
            season="Season 2026",
            status="upcoming",
            division="open",
            cadence="weekly",
            edition=1,
            starts_at=weekly_starts,
            ends_at=weekly_ends,
            check_in_opens_at=weekly_checkin,
            venue="Online Arena · Open to All Students",
            seat_capacity=1000,
            registered_count=0,
            problem_count=4,
            environment="Online Arena · GCC 14 / Clang 18 / Python 3.12 / Java 21",
            chief_proctors=["Chief Proctor (CCC Core)", "CCC Operations Desk"],
            prize_pool="₹15,000 Cash Prize + Merit Certificates",
            sponsor="Chaos Computer Club Medi-Caps Chapter",
            summary="Wednesday algorithmic showdown for Medi-Caps students. 4 algorithmic challenges testing graph traversal, greedy optimization, and dynamic programming. Open to all students — ratings update on the university leaderboard.",
            rules=[
                "Schedule: Every Wednesday from 3:00 PM to 4:30 PM IST in the online arena.",
                "Format: 4 algorithmic problems ranging from Easy to Hard in a 90-minute live session.",
                "Open Access: All enrolled Medi-Caps University students are eligible to participate.",
                "Submissions: Evaluated via CodeBox automated sandbox with sub-millisecond precision.",
                "Leaderboard: Official university Elo ratings are updated on the global scoreboard following contest completion."
            ],
            created_at=now_utc(),
        )
        db.add(weekly_contest)
        await db.flush()

        # Linked Assessment for Weekly 1
        weekly_assessment = Assessment(
            contest_id=weekly_contest.id,
            slug="weekly-contest-1",
            title="Weekly Contest 1 — Live Algorithmic Arena",
            summary="Official weekly algorithmic contest for Medi-Caps students. Solve all 4 challenges within 90 minutes.",
            duration_minutes=90,
            starts_at=assess_opens, # Strictly unlocks 24 hours prior (Tuesday 3:00 PM IST)
            ends_at=assess_closes, # Strictly closes 2 hours before physical contest (Wednesday 1:00 PM IST)
            is_active=True,
            max_violations=3,
            created_at=now_utc(),
        )
        db.add(weekly_assessment)
        await db.flush()

        # Weekly 1 Assessment Problems (4 problems)
        for p_data in OFFICIAL_WEEKLY_PROBLEMS:
            ap = AssessmentProblem(
                assessment_id=weekly_assessment.id,
                problem_index=p_data["index"],
                title=p_data["title"],
                difficulty=p_data["difficulty"],
                points=p_data["points"],
                description=p_data["description"],
                input_format=p_data["input_format"],
                output_format=p_data["output_format"],
                constraints=p_data["constraints"],
                time_limit=p_data["time_limit"],
                memory_limit=p_data["memory_limit"],
                starter_codes=p_data["starter_codes"],
                sample_testcases=p_data["sample_testcases"],
                hidden_testcases=p_data["hidden_testcases"],
                created_at=now_utc(),
            )
            db.add(ap)

            # Mirror to ContestProblem for the Arena
            cp = ContestProblem(
                contest_id=weekly_contest.id,
                problem_index=p_data["index"],
                title=p_data["title"],
                topic=p_data["topic"],
                points=p_data["points"],
                solved_count=0,
                difficulty=p_data["difficulty"],
                description=p_data["description"],
                input_format=p_data["input_format"],
                output_format=p_data["output_format"],
                constraints=p_data["constraints"],
                time_limit=p_data["time_limit"],
                memory_limit=p_data["memory_limit"],
                starter_codes=p_data["starter_codes"],
                sample_testcases=p_data["sample_testcases"],
                hidden_testcases=p_data["hidden_testcases"],
            )
            db.add(cp)

        print("  ✓ Weekly Contest 1 and 4 LeetCode-style problem challenges created.")

        await db.commit()

        # Invalidate Redis Caches
        try:
            await delete_cache_pattern("cache:*")
            print("\n✓ Redis cache invalidated.")
        except Exception as e:
            print("Notice on cache delete:", e)

    print("\n" + "=" * 70)
    print("✨ WEEKLY CONTEST 1 SUCCESSFULLY LAUNCHED!")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Launch or Ensure Official CCC Contests")
    parser.add_argument("--force", action="store_true", help="Force wipe and recreate contest with canonical Wednesday timers")
    args = parser.parse_args()
    asyncio.run(launch_contests(force=args.force))
