"""
Chaos Computer Club — Seed CCC TEST 1 Problem Suite
Seeds the 4 complete DSA problems (A, B, C, D) with 3 sample cases + 15 hidden cases each
into the Master Problem Vault and links them to CCC TEST 1 (Contest Arena & Assessment).
"""

import asyncio
import logging
import os
import sys
from typing import Any, Dict, List

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.ci_safety_guard import assert_safe_to_run
assert_safe_to_run(__file__)

from sqlalchemy import select, update
from app.core.db import AsyncSessionLocal
from app.models.contest import OfflineContest, ContestProblem
from app.models.assessment import Assessment, AssessmentProblem
from app.schemas.problem import ProblemCreateRequest, TestCaseInputSchema
from app.schemas.dynamic_contest import ProblemSaveRequest, TestCaseCreateSchema
from app.services.problem_service import ProblemService
from app.services.dynamic_contest_service import DynamicContestService
from app.engine.contracts import FunctionSignature, DataType, ParameterDefinition

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CCC_TEST_1_SEEDER")

PROBLEMS_DATA = [
    # ============================================================
    # PROBLEM A — EASY: Packet Collision (Two Sum)
    # ============================================================
    {
        "title": "Packet Collision",
        "slug": "packet-collision",
        "problem_index": "A",
        "difficulty": "EASY",
        "topic": "Hashing",
        "points": 100,
        "time_limit": 2.0,
        "memory_limit": 256,
        "description": "Given an array of integers representing packet timestamps and a target latency, return the indices of two distinct packets whose values add up to the target. Exactly one valid pair exists.",
        "constraints": "2 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nExactly one valid answer exists.",
        "execution_mode": "FUNCTION",
        "function_name": "packetCollision",
        "function_signature": {
            "name": "packetCollision",
            "parameters": [
                {"name": "nums", "type": "integer[]"},
                {"name": "target", "type": "integer"}
            ],
            "return_type": "integer[]"
        },
        "sample_testcases": [
            {
                "testcase_id": "A-SAMPLE-01",
                "input": {"nums": [2, 7, 11, 15], "target": 9},
                "expected_output": [0, 1],
                "explanation": "nums[0] + nums[1] = 2 + 7 = 9.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 1
            },
            {
                "testcase_id": "A-SAMPLE-02",
                "input": {"nums": [3, 2, 4], "target": 6},
                "expected_output": [1, 2],
                "explanation": "nums[1] + nums[2] = 2 + 4 = 6.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 2
            },
            {
                "testcase_id": "A-SAMPLE-03",
                "input": {"nums": [3, 3], "target": 6},
                "expected_output": [0, 1],
                "explanation": "The two elements are both 3.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 3
            }
        ],
        "hidden_testcases": [
            {"testcase_id": "A-TC-01", "input": {"nums": [10, 20], "target": 30}, "expected_output": [0, 1], "is_hidden": True, "weight": 1.0, "order": 1},
            {"testcase_id": "A-TC-02", "input": {"nums": [-3, 4, 7, 1], "target": 1}, "expected_output": [0, 1], "is_hidden": True, "weight": 1.0, "order": 2},
            {"testcase_id": "A-TC-03", "input": {"nums": [5, -2, 9, 4], "target": 2}, "expected_output": [1, 3], "is_hidden": True, "weight": 1.0, "order": 3},
            {"testcase_id": "A-TC-04", "input": {"nums": [1, 6, 4, 7], "target": 8}, "expected_output": [0, 3], "is_hidden": True, "weight": 1.0, "order": 4},
            {"testcase_id": "A-TC-05", "input": {"nums": [8, 1, 6, 2], "target": 9}, "expected_output": [0, 1], "is_hidden": True, "weight": 1.0, "order": 5},
            {"testcase_id": "A-TC-06", "input": {"nums": [-10, -20, 5, 30], "target": -30}, "expected_output": [0, 1], "is_hidden": True, "weight": 1.0, "order": 6},
            {"testcase_id": "A-TC-07", "input": {"nums": [100, 200, 300, 400], "target": 700}, "expected_output": [2, 3], "is_hidden": True, "weight": 1.0, "order": 7},
            {"testcase_id": "A-TC-08", "input": {"nums": [0, 4, 0, 8], "target": 0}, "expected_output": [0, 2], "is_hidden": True, "weight": 1.0, "order": 8},
            {"testcase_id": "A-TC-09", "input": {"nums": [11, 22, 33, 44], "target": 55}, "expected_output": [1, 2], "is_hidden": True, "weight": 1.0, "order": 9},
            {"testcase_id": "A-TC-10", "input": {"nums": [-100, 50, 75, 25], "target": 125}, "expected_output": [1, 2], "is_hidden": True, "weight": 1.0, "order": 10},
            {"testcase_id": "A-TC-11", "input": {"nums": [9, 14, 21, 30], "target": 35}, "expected_output": [1, 2], "is_hidden": True, "weight": 1.0, "order": 11},
            {"testcase_id": "A-TC-12", "input": {"nums": [2, 8, 13, 17], "target": 25}, "expected_output": [1, 3], "is_hidden": True, "weight": 1.0, "order": 12},
            {"testcase_id": "A-TC-13", "input": {"nums": [-5, -8, 3, 10], "target": 5}, "expected_output": [0, 3], "is_hidden": True, "weight": 1.0, "order": 13},
            {"testcase_id": "A-TC-14", "input": {"nums": [6, 12, 18, 24], "target": 30}, "expected_output": [1, 2], "is_hidden": True, "weight": 1.0, "order": 14},
            {"testcase_id": "A-TC-15", "input": {"nums": [1000000000, -999999999, 7], "target": 1}, "expected_output": [0, 1], "is_hidden": True, "weight": 1.0, "order": 15}
        ]
    },

    # ============================================================
    # PROBLEM B — EASY: Rotated Campus Search (Binary Search)
    # ============================================================
    {
        "title": "Rotated Campus Search",
        "slug": "rotated-campus-search",
        "problem_index": "B",
        "difficulty": "EASY",
        "topic": "Binary Search",
        "points": 100,
        "time_limit": 2.0,
        "memory_limit": 256,
        "description": "Given a sorted array that has been rotated at an unknown position, return the index of target. All values in the array are distinct. Return -1 if target does not exist.",
        "constraints": "1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9\nAll elements are distinct.",
        "execution_mode": "FUNCTION",
        "function_name": "rotatedSearch",
        "function_signature": {
            "name": "rotatedSearch",
            "parameters": [
                {"name": "nums", "type": "integer[]"},
                {"name": "target", "type": "integer"}
            ],
            "return_type": "integer"
        },
        "sample_testcases": [
            {
                "testcase_id": "B-SAMPLE-01",
                "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 0},
                "expected_output": 4,
                "explanation": "Target 0 is located at index 4.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 1
            },
            {
                "testcase_id": "B-SAMPLE-02",
                "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 3},
                "expected_output": -1,
                "explanation": "Target 3 does not exist.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 2
            },
            {
                "testcase_id": "B-SAMPLE-03",
                "input": {"nums": [1], "target": 1},
                "expected_output": 0,
                "explanation": "The only element is the target.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 3
            }
        ],
        "hidden_testcases": [
            {"testcase_id": "B-TC-01", "input": {"nums": [3, 4, 5, 1, 2], "target": 1}, "expected_output": 3, "is_hidden": True, "weight": 1.0, "order": 1},
            {"testcase_id": "B-TC-02", "input": {"nums": [3, 4, 5, 1, 2], "target": 5}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 2},
            {"testcase_id": "B-TC-03", "input": {"nums": [6, 7, 8, 1, 2, 3, 4, 5], "target": 2}, "expected_output": 4, "is_hidden": True, "weight": 1.0, "order": 3},
            {"testcase_id": "B-TC-04", "input": {"nums": [6, 7, 8, 1, 2, 3, 4, 5], "target": 7}, "expected_output": 1, "is_hidden": True, "weight": 1.0, "order": 4},
            {"testcase_id": "B-TC-05", "input": {"nums": [10, 20, 30, 40, 50], "target": 10}, "expected_output": 0, "is_hidden": True, "weight": 1.0, "order": 5},
            {"testcase_id": "B-TC-06", "input": {"nums": [10, 20, 30, 40, 50], "target": 50}, "expected_output": 4, "is_hidden": True, "weight": 1.0, "order": 6},
            {"testcase_id": "B-TC-07", "input": {"nums": [50, 60, 70, 10, 20, 30, 40], "target": 60}, "expected_output": 1, "is_hidden": True, "weight": 1.0, "order": 7},
            {"testcase_id": "B-TC-08", "input": {"nums": [50, 60, 70, 10, 20, 30, 40], "target": 35}, "expected_output": -1, "is_hidden": True, "weight": 1.0, "order": 8},
            {"testcase_id": "B-TC-09", "input": {"nums": [8, 9, 10, 11, 1, 2, 3, 4, 5, 6, 7], "target": 4}, "expected_output": 7, "is_hidden": True, "weight": 1.0, "order": 9},
            {"testcase_id": "B-TC-10", "input": {"nums": [8, 9, 10, 11, 1, 2, 3, 4, 5, 6, 7], "target": 11}, "expected_output": 3, "is_hidden": True, "weight": 1.0, "order": 10},
            {"testcase_id": "B-TC-11", "input": {"nums": [-5, -3, -1, 0, 2, 4], "target": -3}, "expected_output": 1, "is_hidden": True, "weight": 1.0, "order": 11},
            {"testcase_id": "B-TC-12", "input": {"nums": [4, 5, -3, -2, -1, 0, 1, 2, 3], "target": -2}, "expected_output": 3, "is_hidden": True, "weight": 1.0, "order": 12},
            {"testcase_id": "B-TC-13", "input": {"nums": [2, 3, 4, 5, 6, 7, 1], "target": 1}, "expected_output": 6, "is_hidden": True, "weight": 1.0, "order": 13},
            {"testcase_id": "B-TC-14", "input": {"nums": [2, 3, 4, 5, 6, 7, 1], "target": 6}, "expected_output": 4, "is_hidden": True, "weight": 1.0, "order": 14},
            {"testcase_id": "B-TC-15", "input": {"nums": [100, 200, 300, 400, 500, 600], "target": 350}, "expected_output": -1, "is_hidden": True, "weight": 1.0, "order": 15}
        ]
    },

    # ============================================================
    # PROBLEM C — MEDIUM: Campus Network Route (BFS Shortest Path)
    # ============================================================
    {
        "title": "Campus Network Route",
        "slug": "campus-network-route",
        "problem_index": "C",
        "difficulty": "MEDIUM",
        "topic": "Graph Algorithms",
        "points": 150,
        "time_limit": 2.0,
        "memory_limit": 256,
        "description": "Given an undirected unweighted campus network, return the minimum number of connections required to travel from source to destination. Return -1 if the destination cannot be reached.",
        "constraints": "1 <= n <= 10^5\n0 <= connections.length <= 2 * 10^5\n0 <= connections[i][0], connections[i][1] < n\nThe graph is undirected.",
        "execution_mode": "FUNCTION",
        "function_name": "minimumHops",
        "function_signature": {
            "name": "minimumHops",
            "parameters": [
                {"name": "n", "type": "integer"},
                {"name": "connections", "type": "integer[][]"},
                {"name": "source", "type": "integer"},
                {"name": "destination", "type": "integer"}
            ],
            "return_type": "integer"
        },
        "sample_testcases": [
            {
                "testcase_id": "C-SAMPLE-01",
                "input": {
                    "n": 6,
                    "connections": [[0, 1], [1, 2], [2, 3], [0, 4], [4, 3], [3, 5]],
                    "source": 0,
                    "destination": 5
                },
                "expected_output": 3,
                "explanation": "0 -> 4 -> 3 -> 5 requires 3 connections.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 1
            },
            {
                "testcase_id": "C-SAMPLE-02",
                "input": {
                    "n": 5,
                    "connections": [[0, 1], [1, 2], [2, 3]],
                    "source": 0,
                    "destination": 4
                },
                "expected_output": -1,
                "explanation": "Node 4 is disconnected.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 2
            },
            {
                "testcase_id": "C-SAMPLE-03",
                "input": {
                    "n": 4,
                    "connections": [[0, 1], [1, 2], [2, 3]],
                    "source": 2,
                    "destination": 2
                },
                "expected_output": 0,
                "explanation": "Source and destination are the same node.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 3
            }
        ],
        "hidden_testcases": [
            {"testcase_id": "C-TC-01", "input": {"n": 2, "connections": [[0, 1]], "source": 0, "destination": 1}, "expected_output": 1, "is_hidden": True, "weight": 1.0, "order": 1},
            {"testcase_id": "C-TC-02", "input": {"n": 3, "connections": [[0, 1], [1, 2]], "source": 0, "destination": 2}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 2},
            {"testcase_id": "C-TC-03", "input": {"n": 5, "connections": [[0, 1], [0, 2], [0, 3], [0, 4]], "source": 1, "destination": 4}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 3},
            {"testcase_id": "C-TC-04", "input": {"n": 6, "connections": [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]], "source": 0, "destination": 5}, "expected_output": 5, "is_hidden": True, "weight": 1.0, "order": 4},
            {"testcase_id": "C-TC-05", "input": {"n": 5, "connections": [[0, 1], [1, 2], [2, 4], [0, 3], [3, 4]], "source": 0, "destination": 4}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 5},
            {"testcase_id": "C-TC-06", "input": {"n": 7, "connections": [[0, 1], [1, 2], [2, 6], [0, 3], [3, 4], [4, 5], [5, 6]], "source": 0, "destination": 6}, "expected_output": 3, "is_hidden": True, "weight": 1.0, "order": 6},
            {"testcase_id": "C-TC-07", "input": {"n": 4, "connections": [[0, 1], [1, 2]], "source": 0, "destination": 3}, "expected_output": -1, "is_hidden": True, "weight": 1.0, "order": 7},
            {"testcase_id": "C-TC-08", "input": {"n": 6, "connections": [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5]], "source": 5, "destination": 4}, "expected_output": 4, "is_hidden": True, "weight": 1.0, "order": 8},
            {"testcase_id": "C-TC-09", "input": {"n": 5, "connections": [[0, 1], [1, 4], [0, 2], [2, 3], [3, 4]], "source": 0, "destination": 4}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 9},
            {"testcase_id": "C-TC-10", "input": {"n": 8, "connections": [[0, 1], [1, 2], [2, 7], [0, 3], [3, 4], [4, 5], [5, 6], [6, 7]], "source": 0, "destination": 7}, "expected_output": 3, "is_hidden": True, "weight": 1.0, "order": 10},
            {"testcase_id": "C-TC-11", "input": {"n": 5, "connections": [], "source": 0, "destination": 4}, "expected_output": -1, "is_hidden": True, "weight": 1.0, "order": 11},
            {"testcase_id": "C-TC-12", "input": {"n": 5, "connections": [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]], "source": 0, "destination": 3}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 12},
            {"testcase_id": "C-TC-13", "input": {"n": 6, "connections": [[0, 1], [1, 2], [2, 5], [0, 3], [3, 4], [4, 5]], "source": 2, "destination": 4}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 13},
            {"testcase_id": "C-TC-14", "input": {"n": 4, "connections": [[0, 1], [1, 2], [2, 3], [3, 0]], "source": 0, "destination": 2}, "expected_output": 2, "is_hidden": True, "weight": 1.0, "order": 14},
            {"testcase_id": "C-TC-15", "input": {"n": 7, "connections": [[0, 1], [1, 3], [3, 6], [0, 2], [2, 4], [4, 5], [5, 6]], "source": 0, "destination": 6}, "expected_output": 3, "is_hidden": True, "weight": 1.0, "order": 15}
        ]
    },

    # ============================================================
    # PROBLEM D — HARD: Minimum Network Window (Sliding Window)
    # ============================================================
    {
        "title": "Minimum Network Window",
        "slug": "minimum-network-window",
        "problem_index": "D",
        "difficulty": "HARD",
        "topic": "Sliding Window",
        "points": 200,
        "time_limit": 2.0,
        "memory_limit": 256,
        "description": "Given a string representing a stream of network events and a pattern containing required event types, return the smallest substring of the stream that contains every character of the pattern with the required frequency. If no such substring exists, return an empty string.",
        "constraints": "1 <= stream.length <= 10^5\n1 <= pattern.length <= 10^5\nstream and pattern contain uppercase and lowercase English letters.",
        "execution_mode": "FUNCTION",
        "function_name": "minimumWindow",
        "function_signature": {
            "name": "minimumWindow",
            "parameters": [
                {"name": "stream", "type": "string"},
                {"name": "pattern", "type": "string"}
            ],
            "return_type": "string"
        },
        "sample_testcases": [
            {
                "testcase_id": "D-SAMPLE-01",
                "input": {"stream": "ADOBECODEBANC", "pattern": "ABC"},
                "expected_output": "BANC",
                "explanation": "BANC is the smallest substring containing A, B and C.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 1
            },
            {
                "testcase_id": "D-SAMPLE-02",
                "input": {"stream": "a", "pattern": "a"},
                "expected_output": "a",
                "explanation": "The complete stream is the required window.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 2
            },
            {
                "testcase_id": "D-SAMPLE-03",
                "input": {"stream": "a", "pattern": "aa"},
                "expected_output": "",
                "explanation": "The stream does not contain two occurrences of a.",
                "is_hidden": False,
                "weight": 1.0,
                "order": 3
            }
        ],
        "hidden_testcases": [
            {"testcase_id": "D-TC-01", "input": {"stream": "ADOBECODEBANC", "pattern": "ABC"}, "expected_output": "BANC", "is_hidden": True, "weight": 1.0, "order": 1},
            {"testcase_id": "D-TC-02", "input": {"stream": "aab", "pattern": "ab"}, "expected_output": "ab", "is_hidden": True, "weight": 1.0, "order": 2},
            {"testcase_id": "D-TC-03", "input": {"stream": "aaabbbccc", "pattern": "abc"}, "expected_output": "abbbc", "is_hidden": True, "weight": 1.0, "order": 3},
            {"testcase_id": "D-TC-04", "input": {"stream": "xyzabc", "pattern": "abc"}, "expected_output": "abc", "is_hidden": True, "weight": 1.0, "order": 4},
            {"testcase_id": "D-TC-05", "input": {"stream": "abc", "pattern": "abc"}, "expected_output": "abc", "is_hidden": True, "weight": 1.0, "order": 5},
            {"testcase_id": "D-TC-06", "input": {"stream": "aabbcc", "pattern": "abc"}, "expected_output": "abbc", "is_hidden": True, "weight": 1.0, "order": 6},
            {"testcase_id": "D-TC-07", "input": {"stream": "ADOBECODEBANC", "pattern": "AABC"}, "expected_output": "ADOBECODEBA", "is_hidden": True, "weight": 1.0, "order": 7},
            {"testcase_id": "D-TC-08", "input": {"stream": "thisisateststring", "pattern": "tist"}, "expected_output": "tstri", "is_hidden": True, "weight": 1.0, "order": 8},
            {"testcase_id": "D-TC-09", "input": {"stream": "HELLOWORLD", "pattern": "WORLD"}, "expected_output": "WORLD", "is_hidden": True, "weight": 1.0, "order": 9},
            {"testcase_id": "D-TC-10", "input": {"stream": "BANANA", "pattern": "ANA"}, "expected_output": "ANA", "is_hidden": True, "weight": 1.0, "order": 10},
            {"testcase_id": "D-TC-11", "input": {"stream": "figehaeci", "pattern": "aei"}, "expected_output": "aeci", "is_hidden": True, "weight": 1.0, "order": 11},
            {"testcase_id": "D-TC-12", "input": {"stream": "aaabbb", "pattern": "aab"}, "expected_output": "aab", "is_hidden": True, "weight": 1.0, "order": 12},
            {"testcase_id": "D-TC-13", "input": {"stream": "abcdef", "pattern": "xyz"}, "expected_output": "", "is_hidden": True, "weight": 1.0, "order": 13},
            {"testcase_id": "D-TC-14", "input": {"stream": "CABAD", "pattern": "AAB"}, "expected_output": "ABA", "is_hidden": True, "weight": 1.0, "order": 14},
            # Note: "aabbccddeeff" with pattern "def": shortest substring with d,e,f is "deef" (indices 7 to 10)
            {"testcase_id": "D-TC-15", "input": {"stream": "aabbccddeeff", "pattern": "def"}, "expected_output": "deef", "is_hidden": True, "weight": 1.0, "order": 15}
        ]
    }
]


async def seed_problems(target_slug: str = None):
    target_display = target_slug or "CCC TEST 1 / weekly-contest-1"
    logger.info("=" * 80)
    logger.info(f"⚡ [CCC MISSION CONTROL] SEEDING 4 DSA PROBLEMS UNDER {target_display}")
    logger.info("=" * 80)

    async with AsyncSessionLocal() as db:
        # 1. Find or normalize the target contest
        c_res = await db.execute(select(OfflineContest))
        all_contests = c_res.scalars().all()
        target_contests = []

        if target_slug:
            for c in all_contests:
                if c.slug == target_slug:
                    target_contests.append(c)
        else:
            for c in all_contests:
                # Match weekly-contest-1 or ccc-test-1 or title containing '1'
                if c.slug in ("weekly-contest-1", "ccc-test-1", "testing-weekly-1") or "ccc" in c.title.lower():
                    target_contests.append(c)

            if not target_contests and all_contests:
                target_contests.append(all_contests[0])

        if not target_contests:
            effective_slug = target_slug or "weekly-contest-1"
            contest_title = f"CCC Weekly Contest {effective_slug.split('-')[-1]}" if "weekly-contest-" in effective_slug else "CCC TEST 1"
            logger.info(f"Contest '{effective_slug}' not found in database. Creating OfflineContest '{contest_title}'...")
            from datetime import datetime, timezone, timedelta
            from app.models.base import now_utc
            now = now_utc()
            c = OfflineContest(
                slug=effective_slug,
                title=contest_title,
                season="Season 2026",
                status="upcoming",
                division="open",
                cadence="weekly",
                edition=int(effective_slug.split('-')[-1]) if effective_slug.split('-')[-1].isdigit() else 1,
                starts_at=now + timedelta(hours=24),
                ends_at=now + timedelta(hours=26),
                check_in_opens_at=now + timedelta(hours=23),
                venue="Medi-Caps University Main Computing Lab (Lab 04)",
                seat_capacity=60,
                registered_count=0,
                problem_count=4,
                environment="Air-Gapped Workstation LAN · Clang 18 / GCC 14 / Python 3.12",
                chief_proctors=["Dr. Ratnesh Litoriya", "Prof. Amit Shrivastava"],
                summary=f"{contest_title} Competitive Programming & Cybersecurity Arena.",
                rules=["Strict air-gapped terminal", "Zero external communication", "Only function implementations permitted"],
            )
            db.add(c)
            await db.commit()
            await db.refresh(c)
            target_contests.append(c)
            target_contests = [c]

        # Update primary contest title to "CCC TEST 1"
        for c in target_contests:
            c.title = "CCC TEST 1"
            c.problem_count = 4
            logger.info(f"Target Contest: ID={c.id}, Slug='{c.slug}', Title='{c.title}'")

        await db.commit()

        # 2. Iterate each problem definition
        for prob_def in PROBLEMS_DATA:
            p_idx = prob_def["problem_index"]
            p_title = prob_def["title"]
            p_slug = prob_def["slug"]
            logger.info(f"\nProcessing Problem {p_idx}: '{p_title}' (slug: {p_slug})")

            # Check if master problem already exists
            from app.models.problem import Problem
            existing_p = (await db.execute(select(Problem).where(Problem.slug == p_slug))).scalars().first()

            # Parse function signature
            sig_dict = prob_def["function_signature"]
            params = [
                ParameterDefinition(name=p["name"], type=DataType(p["type"]))
                for p in sig_dict["parameters"]
            ]
            fn_sig = FunctionSignature(
                name=sig_dict["name"],
                parameters=params,
                return_type=DataType(sig_dict["return_type"])
            )

            # Sample testcases
            sample_tcs = [
                TestCaseInputSchema(
                    testcase_id=tc["testcase_id"],
                    input=tc["input"],
                    expected_output=tc["expected_output"],
                    explanation=tc.get("explanation"),
                    weight=tc.get("weight", 1.0),
                    is_hidden=False,
                    order=tc.get("order", idx)
                )
                for idx, tc in enumerate(prob_def["sample_testcases"], start=1)
            ]

            # Hidden testcases (15 complete testcases)
            hidden_tcs = [
                TestCaseInputSchema(
                    testcase_id=tc["testcase_id"],
                    input=tc["input"],
                    expected_output=tc["expected_output"],
                    weight=tc.get("weight", 1.0),
                    is_hidden=True,
                    order=tc.get("order", idx)
                )
                for idx, tc in enumerate(prob_def["hidden_testcases"], start=1)
            ]

            if not existing_p:
                create_req = ProblemCreateRequest(
                    title=p_title,
                    slug=p_slug,
                    problem_index=p_idx,
                    difficulty=prob_def["difficulty"],
                    topic=prob_def["topic"],
                    points=prob_def["points"],
                    description=prob_def["description"],
                    constraints=prob_def["constraints"],
                    execution_mode="FUNCTION",
                    function_signature=fn_sig,
                    time_limit=prob_def["time_limit"],
                    memory_limit=prob_def["memory_limit"],
                    sample_testcases=sample_tcs,
                    hidden_testcases=hidden_tcs,
                )
                created = await ProblemService.create_problem(create_req, admin_id=None, db=db)
                master_prob_id = created["id"]
                logger.info(f"   ✓ Created Master Problem ID: {master_prob_id} (slug: {p_slug})")

                # Publish problem
                pub = await ProblemService.publish_problem(master_prob_id, admin_id=None, db=db)
                logger.info(f"   ✓ Published Problem Snapshot: Version {pub.get('version', 1)}")
            else:
                master_prob_id = existing_p.id
                logger.info(f"   ✓ Updating Master Problem ID: {master_prob_id}")
                # Refresh testcases
                from app.models.problem import ProblemTestCase
                from sqlalchemy import delete
                await db.execute(delete(ProblemTestCase).where(ProblemTestCase.problem_id == master_prob_id))
                for tc in sample_tcs:
                    ptc = ProblemTestCase(
                        problem_id=master_prob_id,
                        version=1,
                        testcase_id=tc.testcase_id,
                        input_data=tc.input,
                        expected_output=tc.expected_output,
                        explanation=tc.explanation,
                        weight=tc.weight,
                        is_hidden=False,
                        order=tc.order,
                        is_active=True,
                    )
                    db.add(ptc)
                for tc in hidden_tcs:
                    ptc = ProblemTestCase(
                        problem_id=master_prob_id,
                        version=1,
                        testcase_id=tc.testcase_id,
                        input_data=tc.input,
                        expected_output=tc.expected_output,
                        weight=tc.weight,
                        is_hidden=True,
                        order=tc.order,
                        is_active=True,
                    )
                    db.add(ptc)
                await db.commit()

            # 3. Link problem to target contest(s) for both Arena and Screening Assessment
            for contest in target_contests:
                save_req = ProblemSaveRequest(
                    target="both",
                    problem_index=p_idx,
                    title=p_title,
                    slug=p_slug,
                    function_name=prob_def["function_name"],
                    topic=prob_def["topic"],
                    difficulty=prob_def["difficulty"],
                    points=prob_def["points"],
                    description=prob_def["description"],
                    constraints=prob_def["constraints"],
                    time_limit=prob_def["time_limit"],
                    memory_limit=prob_def["memory_limit"],
                    problem_id=master_prob_id,
                    problem_version=1,
                    execution_mode="FUNCTION",
                    function_signature=sig_dict,
                    sample_testcases=[
                        TestCaseCreateSchema(
                            stdin=str(tc["input"]),
                            expected_output=str(tc["expected_output"]),
                            explanation=tc.get("explanation"),
                            weight=tc.get("weight", 1.0)
                        )
                        for tc in prob_def["sample_testcases"]
                    ],
                    hidden_testcases=[
                        TestCaseCreateSchema(
                            stdin=str(tc["input"]),
                            expected_output=str(tc["expected_output"]),
                            weight=tc.get("weight", 1.0)
                        )
                        for tc in prob_def["hidden_testcases"]
                    ]
                )

                res = await DynamicContestService.add_or_update_problem(
                    contest_slug=contest.slug,
                    problem_data=save_req,
                    db=db,
                    target="both"
                )
                logger.info(f"   ✓ Linked to Contest '{contest.title}' ({contest.slug}) as Problem {p_idx} (Target: both arena & screening)")

        await db.commit()

        logger.info("\n" + "=" * 80)
        logger.info("🎉 SUCCESS: All 4 problems (A, B, C, D) seeded with 15 hidden testcases each under CCC TEST 1!")
        logger.info("=" * 80)


if __name__ == "__main__":
    import sys
    target = None
    if len(sys.argv) > 1:
        if sys.argv[1].startswith("--slug="):
            target = sys.argv[1].split("=", 1)[1]
        elif sys.argv[1] == "--slug" and len(sys.argv) > 2:
            target = sys.argv[2]
        elif not sys.argv[1].startswith("-"):
            target = sys.argv[1]
    asyncio.run(seed_problems(target))
