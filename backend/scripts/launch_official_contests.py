"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Script: launch_official_contests.py
Launches 1 Official Weekly Contest and 1 Official Biweekly Contest with:
- Rich problem sets (A, B, C, D)
- Phase 1 Online Screening Assessments
- Complete starter codes & multi-category testcases (Samples + Hidden)
- Cache invalidation and clean DB transaction
"""

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


async def launch_contests():
    print("=" * 70)
    print("⚡ [CCC] Launching Official Weekly & Biweekly Contests on Medi-Caps Portal")
    print("=" * 70)

    await init_db()

    now = datetime.now(timezone.utc)
    weekly_starts = now + timedelta(days=1)
    weekly_ends = weekly_starts + timedelta(hours=2)
    weekly_checkin = weekly_starts - timedelta(hours=1)

    biweekly_starts = now + timedelta(days=3)
    biweekly_ends = biweekly_starts + timedelta(hours=2)
    biweekly_checkin = biweekly_starts - timedelta(hours=1)

    async with AsyncSessionLocal() as db:
        # Strictly purge any old contest, submission, registration, or pass records
        print("\n🔹 Purging old contest records...")
        await purge_all_contest_data(db)
        print("  ✓ Old contest data purged cleanly.")

        # =====================================================================
        # 1. WEEKLY CONTEST 1
        # =====================================================================
        print("\n🔹 [1/1] Creating Weekly Contest 1...")
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
            venue="Medi-Caps University Main Computing Lab (Lab 04)",
            seat_capacity=60,
            registered_count=0,
            problem_count=4,
            environment="Air-Gapped Workstation LAN · Clang 18 / GCC 14 / Python 3.12",
            chief_proctors=["Chief Proctor (CCC Core)", "CCC Operations Desk"],
            prize_pool="₹15,000 Cash Prize + Merit Certificates",
            sponsor="Chaos Computer Club Medi-Caps Chapter",
            summary="Sunday algorithmic showdown for Medi-Caps cadets. 4 algorithmic challenges testing graph traversal, greedy optimization, and dynamic programming. Top 30 online screening qualifiers advance to the air-gapped lab final.",
            rules=[
                "Phase 1 Online Screening: 120-minute timed round in anti-cheat browser arena.",
                "Top 30 verified scorers qualify for the Phase 2 on-premise air-gapped lab final.",
                "Submissions evaluated via CodeBox with sub-millisecond precision.",
                "Standard penalty: 20 minutes per non-accepted submission on tie-breaks."
            ],
            created_at=now_utc(),
        )
        db.add(weekly_contest)
        await db.flush()

        # Linked Assessment for Weekly 1
        weekly_assessment = Assessment(
            contest_id=weekly_contest.id,
            slug="weekly-contest-1",
            title="Weekly Contest 1 — Online Screening Round",
            summary="Phase 1 online qualification round for CCC Weekly Contest 1. Solve all 4 challenges within 120 minutes.",
            duration_minutes=120,
            starts_at=now - timedelta(minutes=10), # Opened right now for instant testing
            ends_at=weekly_starts - timedelta(hours=2), # Closes 2 hours before physical contest
            is_active=True,
            max_violations=3,
            created_at=now_utc(),
        )
        db.add(weekly_assessment)
        await db.flush()

        # Weekly 1 Assessment Problems (4 problems)
        weekly_assessment_problems_data = [
            {
                "index": "A",
                "title": "Campus Pass String Validator",
                "difficulty": "EASY",
                "points": 100,
                "topic": "String Manipulation & Hashing",
                "description": "At Medi-Caps University, campus pass numbers are issued as alphanumeric strings. Two passes are considered a 'mirror pair' if one string is the exact reverse of the other (e.g., 'AB' and 'BA'). Given a list of N pass strings, determine the total count of valid unordered mirror pairs (i < j where passes[i] is the reverse of passes[j]).",
                "input_format": "The first line contains an integer N (1 <= N <= 10^5).\nThe following N lines (or space-separated tokens) each contain a non-empty alphanumeric pass string of length <= 20.",
                "output_format": "Print a single integer representing the total number of valid mirror pairs.",
                "constraints": "1 <= N <= 100,000\n1 <= length of each string <= 20\nCharacters are alphanumeric.",
                "time_limit": 2.0,
                "memory_limit": 256,
                "starter_codes": {
                    "python": "import sys\n\ndef main():\n    input_data = sys.stdin.read().split()\n    if not input_data:\n        return\n    n = int(input_data[0])\n    passes = input_data[1:n+1]\n    # TODO: Calculate valid mirror pairs\n    pass\n\nif __name__ == '__main__':\n    main()\n",
                    "cpp": "#include <iostream>\n#include <vector>\n#include <string>\n#include <unordered_map>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    int n;\n    if (!(cin >> n)) return 0;\n    // TODO: Calculate valid mirror pairs\n    return 0;\n}\n",
                    "javascript": "const fs = require('fs');\n\nfunction main() {\n    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n    if (!input || !input[0]) return;\n    const n = parseInt(input[0], 10);\n    const passes = input.slice(1, n + 1);\n    // TODO: Calculate valid mirror pairs\n}\n\nmain();\n",
                    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int n = sc.nextInt();\n        // TODO: Calculate valid mirror pairs\n    }\n}\n"
                },
                "sample_testcases": [
                    {
                        "stdin": "4\nAB\nBA\nCD\nDC",
                        "expected_output": "2",
                        "explanation": "Pairs are ('AB', 'BA') and ('CD', 'DC')."
                    },
                    {
                        "stdin": "3\nABC\nCBA\nABC",
                        "expected_output": "2",
                        "explanation": "Passes 0 and 1 are mirrors ('ABC', 'CBA'), passes 1 and 2 are mirrors ('CBA', 'ABC')."
                    }
                ],
                "hidden_testcases": [
                    {"stdin": "1\nHELLO", "expected_output": "0", "weight": 1.0},
                    {"stdin": "6\nAA\nAA\nAA\nBB\nBB\nCC", "expected_output": "4", "weight": 2.0},
                    {"stdin": "4\nXYZ\nZYX\nXYZ\nZYX", "expected_output": "4", "weight": 2.0}
                ]
            },
            {
                "index": "B",
                "title": "Medi-Caps Lab Router Bandwidth Allocation",
                "difficulty": "MEDIUM",
                "points": 200,
                "topic": "Greedy & Priority Queue",
                "description": "The Medi-Caps lab router has M megabits of total bandwidth to distribute among K competing lab processes. Process i requires at least min_i bandwidth and can consume at most max_i bandwidth, yielding utility = allocated_bandwidth * priority_i. Find the maximum total utility achievable such that the sum of allocated bandwidth does not exceed M and every process receives at least its minimum requirement. If the total minimum requirements exceed M, output -1.",
                "input_format": "First line: Two integers K and M.\nNext K lines: Three space-separated integers for process i: min_i, max_i, priority_i.",
                "output_format": "Output the maximum total utility achievable, or -1 if impossible.",
                "constraints": "1 <= K <= 10^5\n1 <= M <= 10^9\n0 <= min_i <= max_i <= 10^5\n1 <= priority_i <= 1000",
                "time_limit": 2.0,
                "memory_limit": 256,
                "starter_codes": {
                    "python": "import sys\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    if not lines:\n        return\n    # TODO: Solve Bandwidth Allocation\n\nif __name__ == '__main__':\n    main()\n",
                    "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // TODO: Solve Bandwidth Allocation\n    return 0;\n}\n",
                    "javascript": "const fs = require('fs');\n\nfunction main() {\n    const lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n    if (!lines.length || !lines[0]) return;\n    // TODO: Solve Bandwidth Allocation\n}\n\nmain();\n",
                    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // TODO: Solve Bandwidth Allocation\n    }\n}\n"
                },
                "sample_testcases": [
                    {
                        "stdin": "3 10\n2 5 3\n1 4 5\n3 3 2",
                        "expected_output": "44",
                        "explanation": "Min sum is 2+1+3 = 6 <= 10. Remaining 4 bandwidth is allocated to process 2 (highest priority 5) giving 1+3=4 bandwidth with utility 4*5=20, process 1 gets 2+1=3 bandwidth with utility 3*3=9, process 3 gets 3 with utility 3*2=6 => total = 20 + 15 + 6 = 44."
                    },
                    {
                        "stdin": "2 5\n3 6 10\n4 8 10",
                        "expected_output": "-1",
                        "explanation": "Min bandwidth 3+4=7 exceeds total available M=5, so output -1."
                    }
                ],
                "hidden_testcases": [
                    {"stdin": "1 100\n10 50 10", "expected_output": "500", "weight": 1.0},
                    {"stdin": "3 20\n5 10 4\n5 10 8\n5 10 2", "expected_output": "130", "weight": 2.0}
                ]
            },
            {
                "index": "C",
                "title": "Air-Gapped Quantum Key Distribution",
                "difficulty": "MEDIUM",
                "points": 300,
                "topic": "Graph Dijkstra & Dynamic Programming",
                "description": "An air-gapped lab network consists of N workstations numbered 1 to N and M bidirectional communication channels. Each channel connects workstation u and v with latency L (in milliseconds). Workstation 1 needs to transmit an encrypted cryptographic key to workstation N. You may deploy at most K quantum booster repeaters at intermediate workstations. A repeater reduces the latency of its adjacent outgoing channel by half (floor division). Find the minimum total transmission latency from workstation 1 to workstation N.",
                "input_format": "First line: N, M, K\nNext M lines: u, v, L",
                "output_format": "Print the minimum latency from workstation 1 to N.",
                "constraints": "2 <= N <= 1000\n1 <= M <= 10^4\n0 <= K <= 10\n1 <= L <= 10^6",
                "time_limit": 2.0,
                "memory_limit": 256,
                "starter_codes": {
                    "python": "import sys, heapq\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    if not lines:\n        return\n    # TODO: Multi-state Dijkstra\n\nif __name__ == '__main__':\n    main()\n",
                    "cpp": "#include <iostream>\n#include <vector>\n#include <queue>\n#include <tuple>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // TODO: Multi-state Dijkstra\n    return 0;\n}\n",
                    "javascript": "const fs = require('fs');\n\nfunction main() {\n    const lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n    // TODO: Multi-state Dijkstra\n}\n\nmain();\n",
                    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // TODO: Multi-state Dijkstra\n    }\n}\n"
                },
                "sample_testcases": [
                    {
                        "stdin": "4 4 1\n1 2 10\n2 4 10\n1 3 20\n3 4 5",
                        "expected_output": "15",
                        "explanation": "Path 1 -> 2 -> 4 has latency 10 + 10 = 20. With 1 booster on edge (1,2), latency becomes 5 + 10 = 15. Path 1 -> 3 -> 4 with booster on (1,3) gives 10 + 5 = 15."
                    }
                ],
                "hidden_testcases": [
                    {"stdin": "3 2 0\n1 2 100\n2 3 200", "expected_output": "300", "weight": 1.0},
                    {"stdin": "3 2 1\n1 2 100\n2 3 200", "expected_output": "200", "weight": 2.0}
                ]
            },
            {
                "index": "D",
                "title": "Subnet Packet Collision Minimizer",
                "difficulty": "HARD",
                "points": 400,
                "topic": "Dynamic Programming & Bitmask",
                "description": "Given N network packets each with a start time, duration, and priority score, schedule a subset of non-overlapping packets to maximize the total priority score while adhering to subnet channel capacity constraints.",
                "input_format": "First line: N\nNext N lines: start_time, end_time, priority",
                "output_format": "Print the maximum possible sum of priority scores.",
                "constraints": "1 <= N <= 10^5\n1 <= start_time < end_time <= 10^9\n1 <= priority <= 10^6",
                "time_limit": 2.0,
                "memory_limit": 256,
                "starter_codes": {
                    "python": "import sys, bisect\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    if not lines:\n        return\n    # TODO: Weighted Interval Scheduling with Binary Search & DP\n\nif __name__ == '__main__':\n    main()\n",
                    "cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // TODO: Weighted Interval Scheduling\n    return 0;\n}\n",
                    "javascript": "const fs = require('fs');\n\nfunction main() {\n    // TODO: Weighted Interval Scheduling\n}\n\nmain();\n",
                    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // TODO: Weighted Interval Scheduling\n    }\n}\n"
                },
                "sample_testcases": [
                    {
                        "stdin": "3\n1 3 50\n2 4 10\n3 5 40",
                        "expected_output": "90",
                        "explanation": "Select intervals [1,3] (score 50) and [3,5] (score 40) => total 90."
                    }
                ],
                "hidden_testcases": [
                    {"stdin": "4\n1 2 5\n2 3 5\n3 4 5\n1 4 20", "expected_output": "20", "weight": 1.0},
                    {"stdin": "2\n1 10 100\n2 5 200", "expected_output": "200", "weight": 2.0}
                ]
            }
        ]

        for p_data in weekly_assessment_problems_data:
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

        print("  ✓ Weekly Contest 1 and 4 problem challenges created.")

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
    asyncio.run(launch_contests())
