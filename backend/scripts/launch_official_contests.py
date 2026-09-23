"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Script: launch_official_contests.py
Launches 1 Official Weekly Contest and 1 Official Biweekly Contest with:
- Canonical schedules with live active countdowns
- Rich algorithmic problem sets (A, B, C, D)
- LeetCode-style function/class Solution starter codes (Python, C++, JS, Java, TS)
- Clean parameter-based database test cases (Sample + Hidden)
- Cache invalidation and clean DB transaction
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional

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
from app.services.contest_schedule_service import get_next_wednesday_schedule, IST


def get_next_saturday_schedule(
    reference_dt: Optional[datetime] = None,
) -> Tuple[datetime, datetime, datetime, datetime, datetime]:
    """
    Computes canonical Saturday Biweekly contest timestamps:
    - starts_at: Saturday 20:00 IST (14:30 UTC)
    - ends_at: Saturday 22:00 IST (16:30 UTC)
    - check_in_opens_at: Saturday 19:00 IST (13:30 UTC)
    - assessment_opens_at: Friday 20:00 IST (14:30 UTC) [strictly 24h prior]
    - assessment_closes_at: Saturday 18:00 IST (12:30 UTC) [strictly 2h prior]
    """
    if reference_dt is None:
        reference_dt = datetime.now(timezone.utc)
    elif reference_dt.tzinfo is None:
        reference_dt = reference_dt.replace(tzinfo=timezone.utc)

    dt_ist = reference_dt.astimezone(IST)
    days_ahead = (5 - dt_ist.weekday()) % 7  # Saturday is weekday 5
    if days_ahead == 0 and (dt_ist.hour > 22 or (dt_ist.hour == 22 and dt_ist.minute >= 0)):
        days_ahead = 7

    target_date = dt_ist.date() + timedelta(days=days_ahead)
    starts_at_ist = datetime(target_date.year, target_date.month, target_date.day, 20, 0, 0, tzinfo=IST)
    ends_at_ist = datetime(target_date.year, target_date.month, target_date.day, 22, 0, 0, tzinfo=IST)
    checkin_ist = datetime(target_date.year, target_date.month, target_date.day, 19, 0, 0, tzinfo=IST)
    assess_opens_ist = starts_at_ist - timedelta(hours=24)
    assess_closes_ist = datetime(target_date.year, target_date.month, target_date.day, 18, 0, 0, tzinfo=IST)

    return (
        starts_at_ist.astimezone(timezone.utc),
        ends_at_ist.astimezone(timezone.utc),
        checkin_ist.astimezone(timezone.utc),
        assess_opens_ist.astimezone(timezone.utc),
        assess_closes_ist.astimezone(timezone.utc),
    )


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
            "c": "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint countMirrorPairs(char** passes, int passesSize) {\n    // Write your solution here\n    return 0;\n}\n",
            "java": "class Solution {\n    public int countMirrorPairs(String[] passes) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
            "javascript": "/**\n * @param {string[]} passes\n * @return {number}\n */\nvar countMirrorPairs = function(passes) {\n    // Write your solution here\n};\n",
            "typescript": "function countMirrorPairs(passes: string[]): number {\n    // Write your solution here\n    return 0;\n};\n"
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
            "c": "#include <stdio.h>\n#include <stdlib.h>\n\nlong long maxBandwidthUtility(int k, long long m, int** processes, int processesSize, int* processesColSize) {\n    // Write your solution here\n    return 0;\n}\n",
            "java": "class Solution {\n    public int maxBandwidthUtility(int k, int m, int[][] processes) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
            "javascript": "/**\n * @param {number} k\n * @param {number} m\n * @param {number[][]} processes\n * @return {number}\n */\nvar maxBandwidthUtility = function(k, m, processes) {\n    // Write your solution here\n};\n",
            "typescript": "function maxBandwidthUtility(k: number, m: number, processes: number[][]): number {\n    // Write your solution here\n    return 0;\n};\n"
        },
        "sample_testcases": [
            {
                "stdin": "k = 3\nm = 12\nprocesses = [[2, 5, 3], [1, 4, 5], [3, 3, 3]]",
                "expected_output": "44",
                "explanation": "Min sum is 2+1+3=6 <= 12. Remaining 6 bandwidth is allocated greedily by priority: process 2 (prio 5) gets 4 with utility 20, process 1 (prio 3) gets 5 with utility 15, process 3 (prio 3) gets 3 with utility 9 => total = 20 + 15 + 9 = 44."
            },
            {
                "stdin": "k = 2\nm = 4\nprocesses = [[3, 5, 10], [2, 4, 20]]",
                "expected_output": "-1",
                "explanation": "Minimum requirements sum is 3 + 2 = 5, which exceeds total capacity 4."
            }
        ],
        "hidden_testcases": [
            {"stdin": "k = 1\nm = 100\nprocesses = [[10, 50, 2]]", "expected_output": "100", "weight": 1.0},
            {"stdin": "k = 4\nm = 20\nprocesses = [[1, 5, 1], [2, 6, 2], [3, 7, 3], [4, 8, 4]]", "expected_output": "64", "weight": 2.0}
        ]
    },
    {
        "index": "C",
        "title": "Air-Gapped Quantum Key Distribution",
        "difficulty": "MEDIUM",
        "points": 300,
        "topic": "Graph Dijkstra & Dynamic Programming",
        "description": "A campus network has N workstations connected by M bidirectional fiber optic links, each with latency L_i. To secure the air-gapped lab, you may activate up to K quantum repeater nodes. Activating a repeater at any node halves the latency of all links directly connected to it (if both endpoints of a link have repeaters, the latency is divided by 4, rounded down). Determine the minimum possible latency to transmit a cryptographic key from workstation 1 to workstation N.",
        "input_format": "n = <integer>\nm = <integer>\nk = <integer>\nedges = [[u, v, latency], ...]",
        "output_format": "Return an integer representing the minimum latency from workstation 1 to N.",
        "constraints": "2 <= n <= 1000\n1 <= m <= 5000\n0 <= k <= 10\n1 <= u, v <= n\n1 <= latency <= 10^6",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def minKeyDistributionLatency(self, n: int, m: int, k: int, edges: list[list[int]]) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <queue>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int minKeyDistributionLatency(int n, int m, int k, vector<vector<int>>& edges) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "c": "#include <stdio.h>\n#include <stdlib.h>\n\nint minKeyDistributionLatency(int n, int m, int k, int** edges, int edgesSize, int* edgesColSize) {\n    // Write your solution here\n    return 0;\n}\n",
            "java": "class Solution {\n    public int minKeyDistributionLatency(int n, int m, int k, int[][] edges) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
            "javascript": "/**\n * @param {number} n\n * @param {number} m\n * @param {number} k\n * @param {number[][]} edges\n * @return {number}\n */\nvar minKeyDistributionLatency = function(n, m, k, edges) {\n    // Write your solution here\n};\n",
            "typescript": "function minKeyDistributionLatency(n: number, m: number, k: number, edges: number[][]): number {\n    // Write your solution here\n    return 0;\n};\n"
        },
        "sample_testcases": [
            {
                "stdin": "n = 4\nm = 4\nk = 1\nedges = [[1, 2, 10], [2, 4, 10], [1, 3, 20], [3, 4, 5]]",
                "expected_output": "15",
                "explanation": "Without repeaters, path 1->2->4 takes 20. Activating repeater at node 2 reduces edges (1,2) and (2,4) to 5+5=10. Path 1->3->4 with repeater at node 3 gives 10+2=12. Optimal is 1->2->4 with repeater at 2 giving 15."
            }
        ],
        "hidden_testcases": [
            {"stdin": "n = 2\nm = 1\nk = 0\nedges = [[1, 2, 50]]", "expected_output": "50", "weight": 1.0},
            {"stdin": "n = 3\nm = 3\nk = 2\nedges = [[1, 2, 100], [2, 3, 100], [1, 3, 300]]", "expected_output": "50", "weight": 2.0}
        ]
    },
    {
        "index": "D",
        "title": "Subnet Packet Collision Minimizer",
        "difficulty": "HARD",
        "points": 400,
        "topic": "Dynamic Programming & Bitmask",
        "description": "A cluster of N packet transmission windows is scheduled. Transmission i starts at time start_i, ends at end_i, and carries a priority score score_i. Two transmissions collide if their intervals overlap (start_i < end_j and start_j < end_i). Select a subset of non-colliding transmissions to maximize the sum of priority scores.",
        "input_format": "packets = [[start_time, end_time, priority], ...]",
        "output_format": "Return the maximum possible sum of priority scores.",
        "constraints": "1 <= packets.length <= 10^5\n1 <= start_time < end_time <= 10^9\n1 <= priority <= 10^6",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def maxPacketPriority(self, packets: list[list[int]]) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxPacketPriority(vector<vector<int>>& packets) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "c": "#include <stdio.h>\n#include <stdlib.h>\n\nlong long maxPacketPriority(int** packets, int packetsSize, int* packetsColSize) {\n    // Write your solution here\n    return 0;\n}\n",
            "java": "class Solution {\n    public int maxPacketPriority(int[][] packets) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
            "javascript": "/**\n * @param {number[][]} packets\n * @return {number}\n */\nvar maxPacketPriority = function(packets) {\n    // Write your solution here\n};\n",
            "typescript": "function maxPacketPriority(packets: number[][]): number {\n    // Write your solution here\n    return 0;\n};\n"
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


OFFICIAL_BIWEEKLY_PROBLEMS = [
    {
        "index": "A",
        "title": "Cadet Workstation Matrix Shift",
        "difficulty": "EASY",
        "points": 100,
        "topic": "Matrix & Array Manipulation",
        "description": "Given an M x N 2D grid of cadet seat numbers and an integer k, shift the grid elements cyclically by k positions. Element at grid[i][j] moves to grid[i][j + 1], element at grid[i][n - 1] moves to grid[i + 1][0], and element at grid[m - 1][n - 1] moves to grid[0][0]. Return the shifted 2D grid.",
        "input_format": "grid = [[...], ...], k = <int>",
        "output_format": "Return the shifted 2D grid.",
        "constraints": "1 <= grid.length, grid[0].length <= 50\n-1000 <= grid[i][j] <= 1000\n0 <= k <= 100",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def shiftGrid(self, grid: list[list[int]], k: int) -> list[list[int]]:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<int>> shiftGrid(vector<vector<int>>& grid, int k) {\n        // Write your solution here\n        return grid;\n    }\n};\n",
            "java": "class Solution {\n    public int[][] shiftGrid(int[][] grid, int k) {\n        // Write your solution here\n        return grid;\n    }\n}\n",
            "javascript": "var shiftGrid = function(grid, k) {\n    // Write your solution here\n};\n",
            "typescript": "function shiftGrid(grid: number[][], k: number): number[][] {\n    // Write your solution here\n    return grid;\n};\n"
        },
        "sample_testcases": [
            {
                "stdin": "grid = [[1,2,3],[4,5,6],[7,8,9]], k = 1",
                "expected_output": "[[9,1,2],[3,4,5],[6,7,8]]",
                "explanation": "Every element shifts right by 1 position cyclically."
            }
        ],
        "hidden_testcases": [
            {"stdin": "grid = [[3,8,1,9],[19,7,2,5],[4,6,11,10],[12,0,21,13]], k = 4", "expected_output": "[[12,0,21,13],[3,8,1,9],[19,7,2,5],[4,6,11,10]]", "weight": 1.0}
        ]
    },
    {
        "index": "B",
        "title": "Medi-Caps Secure Subnet Partitions",
        "difficulty": "MEDIUM",
        "points": 200,
        "topic": "Prefix Sums & Modulo Hashing",
        "description": "Given an integer array traffic representing packet counts on consecutive subnets and an integer k, return the number of non-empty subarrays with sum divisible by k.",
        "input_format": "traffic = [...], k = <int>",
        "output_format": "Return an integer count of valid subarrays.",
        "constraints": "1 <= traffic.length <= 30000\n-10000 <= traffic[i] <= 10000\n2 <= k <= 10000",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def subarraysDivByK(self, traffic: list[int], k: int) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nclass Solution {\npublic:\n    int subarraysDivByK(vector<int>& traffic, int k) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "java": "class Solution {\n    public int subarraysDivByK(int[] traffic, int k) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
            "javascript": "var subarraysDivByK = function(traffic, k) {\n    // Write your solution here\n};\n",
            "typescript": "function subarraysDivByK(traffic: number[], k: number): number {\n    // Write your solution here\n    return 0;\n};\n"
        },
        "sample_testcases": [
            {
                "stdin": "traffic = [4,5,0,-2,-3,1], k = 5",
                "expected_output": "7",
                "explanation": "There are 7 subarrays with sum divisible by 5."
            }
        ],
        "hidden_testcases": [
            {"stdin": "traffic = [5], k = 9", "expected_output": "0", "weight": 1.0}
        ]
    },
    {
        "index": "C",
        "title": "Server Rack Heat Dissipation Tree",
        "difficulty": "MEDIUM",
        "points": 300,
        "topic": "Tree DP & Depth First Search",
        "description": "You are given a tree with n server nodes labeled 0 to n - 1 rooted at node 0. Each node has heat output values[i]. You can place at most c independent cooling units such that no two cooled nodes are directly connected. Maximize the total heat mitigated by the cooled nodes.",
        "input_format": "n = <int>, edges = [[u, v], ...], values = [...], c = <int>",
        "output_format": "Return maximum mitigated heat sum.",
        "constraints": "1 <= n <= 10^4\n1 <= values[i] <= 10^5\n0 <= c <= n",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def maxHeatDissipation(self, n: int, edges: list[list[int]], values: list[int], c: int) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxHeatDissipation(int n, vector<vector<int>>& edges, vector<int>& values, int c) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            "java": "class Solution {\n    public int maxHeatDissipation(int n, int[][] edges, int[] values, int c) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
            "javascript": "var maxHeatDissipation = function(n, edges, values, c) {\n    // Write your solution here\n};\n",
            "typescript": "function maxHeatDissipation(n: number, edges: number[][], values: number[], c: number): number {\n    // Write your solution here\n    return 0;\n};\n"
        },
        "sample_testcases": [
            {
                "stdin": "n = 3, edges = [[0,1],[0,2]], values = [15,15,15], c = 2",
                "expected_output": "30",
                "explanation": "Pick node 1 and node 2 => 15 + 15 = 30."
            }
        ],
        "hidden_testcases": [
            {"stdin": "n = 1, edges = [], values = [100], c = 1", "expected_output": "100", "weight": 1.0}
        ]
    },
    {
        "index": "D",
        "title": "Air-Gapped Cryptographic Signature DAG",
        "difficulty": "HARD",
        "points": 400,
        "topic": "DAG Dynamic Programming",
        "description": "Given a directed acyclic graph of n certificate authorities with directed edges [[u, v, reliability], ...], find the path from authority 0 to authority n - 1 that visits at least k intermediate nodes with the maximum cumulative reliability score. If no such path exists, return -1.",
        "input_format": "n = <int>, edges = [[u, v, score], ...], k = <int>",
        "output_format": "Return maximum path reliability score or -1.",
        "constraints": "2 <= n <= 500\n0 <= edges.length <= 10000\n1 <= k <= n",
        "time_limit": 2.0,
        "memory_limit": 256,
        "starter_codes": {
            "python": "class Solution:\n    def maxDAGReliability(self, n: int, edges: list[list[int]], k: int) -> int:\n        # Write your solution here\n        pass\n",
            "cpp": "#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxDAGReliability(int n, vector<vector<int>>& edges, int k) {\n        // Write your solution here\n        return -1;\n    }\n};\n",
            "java": "class Solution {\n    public int maxDAGReliability(int n, int[][] edges, int k) {\n        // Write your solution here\n        return -1;\n    }\n}\n",
            "javascript": "var maxDAGReliability = function(n, edges, k) {\n    // Write your solution here\n};\n",
            "typescript": "function maxDAGReliability(n: number, edges: number[][], k: number): number {\n    // Write your solution here\n    return -1;\n};\n"
        },
        "sample_testcases": [
            {
                "stdin": "n = 4, edges = [[0,1,10],[1,3,20],[0,3,50],[0,2,5],[2,3,25]], k = 1",
                "expected_output": "30",
                "explanation": "Path 0 -> 1 -> 3 has 1 intermediate node and score 10 + 20 = 30."
            }
        ],
        "hidden_testcases": [
            {"stdin": "n = 3, edges = [[0,2,100]], k = 1", "expected_output": "-1", "weight": 1.0}
        ]
    }
]


async def launch_contests(force: bool = False):
    print("=" * 70)
    print("⚡ [CCC] Launching / Verifying Official Contests on Medi-Caps Portal")
    print("=" * 70)

    await init_db()

    async with AsyncSessionLocal() as db:
        # Check if canonical weekly-contest-1 already exists
        weekly_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == "weekly-contest-1"))
        existing_weekly = weekly_res.scalars().first()

        # Remove any lingering biweekly contest (deprecated)
        bw_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == "biweekly-contest-1"))
        existing_biweekly = bw_res.scalars().first()
        if existing_biweekly:
            await db.execute(delete(OfflineContest).where(OfflineContest.slug == "biweekly-contest-1"))
            await db.commit()
            print("\n🗑️  Removed deprecated Biweekly Contest 1 from production DB.")

        now = datetime.now(timezone.utc)

        # If canonical weekly contest already exists and is upcoming/live, preserve it
        if existing_weekly and not force:
            if existing_weekly.ends_at > now:
                print("\n🔒 [IMMUTABLE TIMER ACTIVE]")
                print(f"  ✓ Weekly: {existing_weekly.title} (Starts: {existing_weekly.starts_at})")
                return

        print("\n🔹 Purging legacy contest records for clean canonical schedule...")
        await purge_all_contest_data(db)
        print("  ✓ Old contest data purged cleanly.")

        # =====================================================================
        # WEEKLY CONTEST 1 (Wednesday 3:00 PM – 4:30 PM IST)
        # =====================================================================
        weekly_starts, weekly_ends, weekly_checkin, w_assess_opens, w_assess_closes = get_next_wednesday_schedule()

        print("\n🔹 [1/1] Creating Weekly Contest 1 (Canonical Wednesday Schedule)...")
        print(f"  Starts at (UTC): {weekly_starts.isoformat()} (Wednesday 3:00 PM IST)")
        print(f"  Ends at (UTC):   {weekly_ends.isoformat()} (Wednesday 4:30 PM IST)")

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
            chief_proctors=["Dr. Ratnesh Litoriya (Chief Proctor)", "Prof. Amit Shrivastava", "Prof. Prashant Panse"],
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

        weekly_assessment = Assessment(
            contest_id=weekly_contest.id,
            slug="weekly-contest-1",
            title="Weekly Contest 1 — Live Algorithmic Arena",
            summary="Official weekly algorithmic contest for Medi-Caps students. Solve all 4 challenges within 90 minutes.",
            duration_minutes=90,
            starts_at=w_assess_opens,
            ends_at=w_assess_closes,
            is_active=True,
            max_violations=3,
            created_at=now_utc(),
        )
        db.add(weekly_assessment)
        await db.flush()

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

        print("  ✓ Weekly Contest 1 and 4 LeetCode-style problems created.")

        await db.commit()

        try:
            await delete_cache_pattern("cache:*")
            print("\n✓ Redis cache invalidated.")
        except Exception as e:
            print("Notice on cache delete:", e)

    print("\n" + "=" * 70)
    print("✨ CANONICAL WEEKLY CONTEST 1 SUCCESSFULLY LAUNCHED!")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Launch or Ensure Official CCC Contests")
    parser.add_argument("--force", action="store_true", help="Force wipe and recreate contests with canonical timers")
    args = parser.parse_args()
    asyncio.run(launch_contests(force=args.force))

