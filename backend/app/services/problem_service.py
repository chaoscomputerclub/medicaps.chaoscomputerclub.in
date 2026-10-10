"""
Chaos Computer Club — Master Problem Domain Service
Handles creation, updating, version snapshotting, testcase vault operations,
and pre-publish validation for competitive programming challenges.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.contracts import FunctionSignature, DataType, ProblemStatus
from app.engine.adapters import get_adapter
from app.models.db_models import Problem, ProblemVersion, ProblemTestCase, now_utc
from app.schemas.problem import (
    ProblemCreateRequest,
    ProblemUpdateRequest,
    TestCaseInputSchema,
    TestCaseUpdateSchema,
    ProblemDetailResponse,
    ProblemSummaryResponse,
    ProblemVersionResponse,
)
from app.services.problem_validator import ProblemValidator, ValidationReport

logger = logging.getLogger("ccc.service.problem")


class ProblemService:
    """Core domain service for Problem Authoring and Lifecycle Management."""

    @staticmethod
    def _compute_testcase_hash(input_data: Any, expected_output: Any) -> str:
        canonical_str = json.dumps({"in": input_data, "out": expected_output}, sort_keys=True)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    @staticmethod
    def _generate_slug(title: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9\s-]", "", title).strip().lower()
        return re.sub(r"[\s-]+", "-", cleaned)[:80]

    @classmethod
    async def create_problem(
        cls,
        payload: ProblemCreateRequest,
        admin_id: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        slug = (payload.slug or "").strip() or cls._generate_slug(payload.title)

        # Check slug uniqueness
        existing = await db.scalar(select(Problem).where(Problem.slug == slug))
        if existing:
            # Append suffix if collision
            slug = f"{slug}-{int(now_utc().timestamp()) % 10000}"

        # Setup function signature & auto-generate missing starter codes
        fn_sig_dict = payload.function_signature.model_dump() if payload.function_signature else {}
        starter_dict = dict(payload.starter_code or {})

        if payload.function_signature:
            for lang in ["python", "cpp", "c", "java", "javascript", "typescript"]:
                if not starter_dict.get(lang):
                    adapter = get_adapter(lang)
                    starter_dict[lang] = adapter.generate_starter_code(payload.function_signature)

        eval_cfg_dict = payload.evaluation_config.model_dump() if payload.evaluation_config else {
            "match_type": "EXACT_MATCH",
            "float_tolerance": 1e-6,
            "ignore_whitespace": True,
            "ignore_case": False,
        }
        sandbox_cfg_dict = payload.sandbox_config.model_dump() if payload.sandbox_config else {
            "time_limit_sec": payload.time_limit,
            "memory_limit_mb": payload.memory_limit,
            "network_enabled": False,
            "process_limit": 16,
            "output_limit_kb": 1024,
        }

        problem = Problem(
            problem_index=payload.problem_index,
            title=payload.title,
            slug=slug,
            difficulty=payload.difficulty,
            topic=payload.topic,
            points=payload.points,
            description=payload.description,
            constraints=payload.constraints,
            input_format=payload.input_format,
            output_format=payload.output_format,
            execution_mode=payload.execution_mode,
            function_signature=fn_sig_dict,
            starter_code=starter_dict,
            time_limit=payload.time_limit,
            memory_limit=payload.memory_limit,
            evaluation_config=eval_cfg_dict,
            sandbox_config=sandbox_cfg_dict,
            reference_solution=payload.reference_solution or {},
            status="DRAFT",
            version=1,
            created_by=admin_id,
            updated_by=admin_id,
            created_at=now_utc(),
            updated_at=now_utc(),
        )
        db.add(problem)
        await db.flush()

        # Add sample testcases
        order_idx = 0
        if payload.sample_testcases:
            for st in payload.sample_testcases:
                tc = ProblemTestCase(
                    problem_id=problem.id,
                    version=1,
                    testcase_id=st.testcase_id,
                    input_data=st.input,
                    expected_output=st.expected_output,
                    explanation=st.explanation,
                    weight=st.weight,
                    is_hidden=False,
                    order=order_idx,
                    is_active=True,
                    content_hash=cls._compute_testcase_hash(st.input, st.expected_output),
                )
                db.add(tc)
                order_idx += 1

        # Add hidden testcases
        if payload.hidden_testcases:
            for ht in payload.hidden_testcases:
                tc = ProblemTestCase(
                    problem_id=problem.id,
                    version=1,
                    testcase_id=ht.testcase_id,
                    input_data=ht.input,
                    expected_output=ht.expected_output,
                    explanation=ht.explanation,
                    weight=ht.weight,
                    is_hidden=True,
                    order=order_idx,
                    is_active=True,
                    content_hash=cls._compute_testcase_hash(ht.input, ht.expected_output),
                )
                db.add(tc)
                order_idx += 1

        await db.commit()
        await db.refresh(problem)

        logger.info(
            "✓ [ProblemService] Created algorithmic challenge '%s' (id=%s, slug=%s, v=%s)",
            problem.title, problem.id, problem.slug, problem.version
        )
        return await cls.get_problem_detail(problem.id, include_hidden=True, db=db)

    @classmethod
    async def list_problems(
        cls,
        status: Optional[str] = None,
        topic: Optional[str] = None,
        difficulty: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        db: AsyncSession = None,
    ) -> List[Dict[str, Any]]:
        stmt = select(Problem)
        filters = []
        if status:
            filters.append(Problem.status == status.upper())
        if topic:
            filters.append(Problem.topic == topic)
        if difficulty:
            filters.append(Problem.difficulty == difficulty.upper())
        if query:
            q_like = f"%{query}%"
            filters.append(or_(Problem.title.ilike(q_like), Problem.slug.ilike(q_like), Problem.topic.ilike(q_like)))

        if filters:
            stmt = stmt.where(and_(*filters))

        stmt = stmt.order_by(Problem.created_at.desc()).offset(offset).limit(min(limit, 200))
        res = await db.scalars(stmt)
        problems = res.all()

        return [
            {
                "id": p.id,
                "slug": p.slug,
                "problem_index": p.problem_index,
                "title": p.title,
                "difficulty": p.difficulty,
                "topic": p.topic,
                "points": p.points,
                "status": p.status,
                "version": p.version,
                "execution_mode": p.execution_mode,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in problems
        ]

    @classmethod
    async def get_problem_detail(
        cls,
        id_or_slug: str,
        include_hidden: bool,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        stmt = select(Problem).where(or_(Problem.id == id_or_slug, Problem.slug == id_or_slug))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{id_or_slug}' not found.")

        # Fetch visible testcases
        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            ProblemTestCase.is_active == True,
        ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
        all_cases = (await db.scalars(tc_stmt)).all()

        visible_cases = [
            {
                "testcase_id": tc.testcase_id,
                "input": tc.input_data,
                "expected_output": tc.expected_output,
                "explanation": tc.explanation,
                "weight": tc.weight,
                "order": tc.order,
            }
            for tc in all_cases
            if not tc.is_hidden
        ]

        data = {
            "id": problem.id,
            "slug": problem.slug,
            "problem_index": problem.problem_index,
            "title": problem.title,
            "difficulty": problem.difficulty,
            "topic": problem.topic,
            "points": problem.points,
            "description": problem.description,
            "constraints": problem.constraints,
            "input_format": problem.input_format,
            "output_format": problem.output_format,
            "execution_mode": problem.execution_mode,
            "function_signature": problem.function_signature or {},
            "starter_code": problem.starter_code or {},
            "time_limit": problem.time_limit,
            "memory_limit": problem.memory_limit,
            "evaluation_config": problem.evaluation_config or {},
            "sandbox_config": problem.sandbox_config or {},
            "status": problem.status,
            "version": problem.version,
            "created_at": problem.created_at.isoformat() if problem.created_at else None,
            "updated_at": problem.updated_at.isoformat() if problem.updated_at else None,
            "visible_testcases": visible_cases,
        }

        # RBAC Privacy Guard: Only authorized admin view receives hidden testcases & reference solutions
        if include_hidden:
            hidden_cases = [
                {
                    "id": tc.id,
                    "testcase_id": tc.testcase_id,
                    "input": tc.input_data,
                    "expected_output": tc.expected_output,
                    "weight": tc.weight,
                    "order": tc.order,
                    "is_active": tc.is_active,
                    "hash": tc.content_hash,
                }
                for tc in all_cases
                if tc.is_hidden
            ]
            data["hidden_testcases"] = hidden_cases
            data["reference_solution"] = problem.reference_solution or {}
        else:
            data["hidden_testcases"] = None
            data["reference_solution"] = None

        return data

    @classmethod
    async def update_problem(
        cls,
        problem_id: str,
        payload: ProblemUpdateRequest,
        admin_id: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")

        if problem.status == "LOCKED":
            raise HTTPException(
                status_code=400,
                detail="Cannot modify a LOCKED problem currently active in a contest. Create a new version instead.",
            )

        if payload.title is not None:
            problem.title = payload.title
        if payload.slug is not None:
            problem.slug = payload.slug
        if payload.problem_index is not None:
            problem.problem_index = payload.problem_index
        if payload.difficulty is not None:
            problem.difficulty = payload.difficulty
        if payload.topic is not None:
            problem.topic = payload.topic
        if payload.points is not None:
            problem.points = payload.points
        if payload.description is not None:
            problem.description = payload.description
        if payload.constraints is not None:
            problem.constraints = payload.constraints
        if payload.input_format is not None:
            problem.input_format = payload.input_format
        if payload.output_format is not None:
            problem.output_format = payload.output_format
        if payload.execution_mode is not None:
            problem.execution_mode = payload.execution_mode
        if payload.time_limit is not None:
            problem.time_limit = payload.time_limit
        if payload.memory_limit is not None:
            problem.memory_limit = payload.memory_limit

        if payload.function_signature is not None:
            problem.function_signature = payload.function_signature.model_dump()
            # If starter code is missing or user changed function signature, refresh starter code templates
            starter_dict = dict(problem.starter_code or {})
            for lang in ["python", "cpp", "java", "javascript"]:
                adapter = get_adapter(lang)
                starter_dict[lang] = adapter.generate_starter_code(payload.function_signature)
            problem.starter_code = starter_dict

        if payload.starter_code is not None:
            starter_dict = dict(problem.starter_code or {})
            starter_dict.update(payload.starter_code)
            problem.starter_code = starter_dict

        if payload.evaluation_config is not None:
            problem.evaluation_config = payload.evaluation_config.model_dump()
        if payload.sandbox_config is not None:
            problem.sandbox_config = payload.sandbox_config.model_dump()
        if payload.reference_solution is not None:
            problem.reference_solution = payload.reference_solution

        problem.updated_by = admin_id
        problem.updated_at = now_utc()
        # Any edit resets status to DRAFT so it must be re-validated before publish
        if problem.status in ("VALIDATED", "PUBLISHED"):
            problem.status = "DRAFT"

        await db.commit()
        await db.refresh(problem)
        return await cls.get_problem_detail(problem.id, include_hidden=True, db=db)

    @classmethod
    async def validate_problem(
        cls,
        problem_id: str,
        run_reference_solution: bool,
        db: AsyncSession,
    ) -> ValidationReport:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")

        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            ProblemTestCase.is_active == True,
        )
        cases = (await db.scalars(tc_stmt)).all()
        visible = [{"testcase_id": c.testcase_id, "input_data": c.input_data, "expected_output": c.expected_output} for c in cases if not c.is_hidden]
        hidden = [{"testcase_id": c.testcase_id, "input_data": c.input_data, "expected_output": c.expected_output} for c in cases if c.is_hidden]

        prob_data = {
            "title": problem.title,
            "slug": problem.slug,
            "description": problem.description,
            "constraints": problem.constraints,
            "execution_mode": problem.execution_mode,
            "function_signature": problem.function_signature,
            "starter_code": problem.starter_code,
            "time_limit": problem.time_limit,
            "memory_limit": problem.memory_limit,
            "reference_solution": problem.reference_solution,
        }

        report = await ProblemValidator.validate_problem(
            prob_data,
            visible,
            hidden,
            run_reference_solution=run_reference_solution,
        )

        if report.is_valid and problem.status == "DRAFT":
            problem.status = "VALIDATED"
            await db.commit()

        return report

    @classmethod
    async def publish_problem(
        cls,
        problem_id: str,
        admin_id: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        report = await cls.validate_problem(problem_id, run_reference_solution=False, db=db)
        if not report.is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Problem validation failed. Cannot publish with errors.",
                    "errors": report.errors,
                    "warnings": report.warnings,
                },
            )

        problem = await db.get(Problem, problem_id)

        # Create or update ProblemVersion immutable snapshot
        ver_stmt = select(ProblemVersion).where(
            ProblemVersion.problem_id == problem.id,
            ProblemVersion.version == problem.version,
        )
        existing_ver = await db.scalar(ver_stmt)
        if not existing_ver:
            version_snapshot = ProblemVersion(
                problem_id=problem.id,
                version=problem.version,
                title=problem.title,
                slug=problem.slug,
                difficulty=problem.difficulty,
                topic=problem.topic,
                points=problem.points,
                description=problem.description,
                constraints=problem.constraints,
                input_format=problem.input_format,
                output_format=problem.output_format,
                execution_mode=problem.execution_mode,
                function_signature=problem.function_signature,
                starter_code=problem.starter_code,
                time_limit=problem.time_limit,
                memory_limit=problem.memory_limit,
                evaluation_config=problem.evaluation_config,
                sandbox_config=problem.sandbox_config,
                reference_solution=problem.reference_solution,
                created_by=admin_id,
                created_at=now_utc(),
            )
            db.add(version_snapshot)

        problem.status = "PUBLISHED"
        problem.updated_by = admin_id
        problem.updated_at = now_utc()
        await db.commit()
        await db.refresh(problem)

        logger.info("⚡ [ProblemService] Published problem '%s' version v%s", problem.slug, problem.version)
        return await cls.get_problem_detail(problem.id, include_hidden=True, db=db)

    @classmethod
    async def archive_problem(cls, problem_id: str, admin_id: Optional[str], db: AsyncSession) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")
        problem.status = "ARCHIVED"
        problem.updated_by = admin_id
        problem.updated_at = now_utc()
        await db.commit()
        return {"success": True, "message": f"Problem '{problem.slug}' archived."}

    @classmethod
    async def unpublish_problem(cls, problem_id: str, admin_id: Optional[str], db: AsyncSession) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")
        problem.status = "DRAFT"
        problem.updated_by = admin_id
        problem.updated_at = now_utc()
        await db.commit()
        return {"success": True, "message": f"Problem '{problem.slug}' reverted to DRAFT status."}

    @classmethod
    async def seed_institutional_suite(cls, admin_id: Optional[str], db: AsyncSession) -> Dict[str, Any]:
        """
        Seeds canonical Medi-Caps algorithmic problem suite for the Practice Arena.
        Ensures idempotency by checking existing slugs.
        """
        CANONICAL_SUITE = [
            {
                "index": "A",
                "title": "Two Sum",
                "slug": "two-sum",
                "difficulty": "EASY",
                "topic": "Arrays & Hashing",
                "points": 100,
                "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
                "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
                "input_format": "`nums`: Array of integers, `target`: Target sum integer",
                "output_format": "Array of 2 indices `[index1, index2]`",
                "fn_name": "twoSum",
                "params": [{"name": "nums", "type": "integer[]"}, {"name": "target", "type": "integer"}],
                "ret_type": "integer[]",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"nums": [2, 7, 11, 15], "target": 9}, "out": [0, 1], "exp": "nums[0] + nums[1] = 2 + 7 = 9"},
                    {"id": "SAMPLE-02", "in": {"nums": [3, 2, 4], "target": 6}, "out": [1, 2], "exp": "nums[1] + nums[2] = 2 + 4 = 6"},
                    {"id": "SAMPLE-03", "in": {"nums": [3, 3], "target": 6}, "out": [0, 1], "exp": "nums[0] + nums[1] = 3 + 3 = 6"},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"nums": [-1, -2, -3, -4, -5], "target": -8}, "out": [2, 4]},
                    {"id": "TC-02", "in": {"nums": [1000000000, 500, 1000000000], "target": 2000000000}, "out": [0, 2]},
                    {"id": "TC-03", "in": {"nums": [0, 4, 3, 0], "target": 0}, "out": [0, 3]},
                ],
            },
            {
                "index": "B",
                "title": "Valid Parentheses",
                "slug": "valid-parentheses",
                "difficulty": "EASY",
                "topic": "Stacks",
                "points": 100,
                "description": "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
                "constraints": "1 <= s.length <= 10^4\n`s` consists of parentheses only `'()[]{}'`.",
                "input_format": "`s`: String of brackets",
                "output_format": "Boolean `true` if valid, `false` otherwise",
                "fn_name": "isValid",
                "params": [{"name": "s", "type": "string"}],
                "ret_type": "boolean",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"s": "()"}, "out": True, "exp": "Matching parentheses pair"},
                    {"id": "SAMPLE-02", "in": {"s": "()[]{}"}, "out": True, "exp": "Consecutive matching bracket pairs"},
                    {"id": "SAMPLE-03", "in": {"s": "(]"}, "out": False, "exp": "Mismatched bracket pair"},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"s": "{[]}"}, "out": True},
                    {"id": "TC-02", "in": {"s": "([)]"}, "out": False},
                    {"id": "TC-03", "in": {"s": "["}, "out": False},
                    {"id": "TC-04", "in": {"s": "]"}, "out": False},
                ],
            },
            {
                "index": "C",
                "title": "Binary Search",
                "slug": "binary-search",
                "difficulty": "EASY",
                "topic": "Binary Search",
                "points": 100,
                "description": "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return `-1`.\n\nYou must write an algorithm with `O(log n)` runtime complexity.",
                "constraints": "1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll integers in `nums` are unique and sorted in ascending order.",
                "input_format": "`nums`: Sorted integer array, `target`: Search target",
                "output_format": "Index of target or `-1` if not found",
                "fn_name": "search",
                "params": [{"name": "nums", "type": "integer[]"}, {"name": "target", "type": "integer"}],
                "ret_type": "integer",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"nums": [-1, 0, 3, 5, 9, 12], "target": 9}, "out": 4, "exp": "9 exists in nums and its index is 4"},
                    {"id": "SAMPLE-02", "in": {"nums": [-1, 0, 3, 5, 9, 12], "target": 2}, "out": -1, "exp": "2 does not exist in nums so return -1"},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"nums": [5], "target": 5}, "out": 0},
                    {"id": "TC-02", "in": {"nums": [5], "target": -5}, "out": -1},
                    {"id": "TC-03", "in": {"nums": [1, 3, 5, 7, 9, 11, 13, 15], "target": 15}, "out": 7},
                ],
            },
            {
                "index": "D",
                "title": "Best Time to Buy and Sell Stock",
                "slug": "best-time-to-buy-and-sell-stock",
                "difficulty": "EASY",
                "topic": "Greedy",
                "points": 100,
                "description": "You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`th day.\n\nYou want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.\n\nReturn the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return `0`.",
                "constraints": "1 <= prices.length <= 10^5\n0 <= prices[i] <= 10^4",
                "input_format": "`prices`: Daily stock price array",
                "output_format": "Maximum achievable profit integer",
                "fn_name": "maxProfit",
                "params": [{"name": "prices", "type": "integer[]"}],
                "ret_type": "integer",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"prices": [7, 1, 5, 3, 6, 4]}, "out": 5, "exp": "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5."},
                    {"id": "SAMPLE-02", "in": {"prices": [7, 6, 4, 3, 1]}, "out": 0, "exp": "In this case, no transactions are done and the max profit = 0."},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"prices": [2, 4, 1]}, "out": 2},
                    {"id": "TC-02", "in": {"prices": [1, 2, 3, 4, 5]}, "out": 4},
                    {"id": "TC-03", "in": {"prices": [3, 3, 3, 3]}, "out": 0},
                ],
            },
            {
                "index": "E",
                "title": "Maximum Subarray",
                "slug": "maximum-subarray",
                "difficulty": "MEDIUM",
                "topic": "Dynamic Programming",
                "points": 200,
                "description": "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.",
                "constraints": "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
                "input_format": "`nums`: Integer array",
                "output_format": "Maximum subarray sum integer",
                "fn_name": "maxSubArray",
                "params": [{"name": "nums", "type": "integer[]"}],
                "ret_type": "integer",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"nums": [-2, 1, -3, 4, -1, 2, 1, -5, 4]}, "out": 6, "exp": "The subarray [4,-1,2,1] has the largest sum 6."},
                    {"id": "SAMPLE-02", "in": {"nums": [1]}, "out": 1, "exp": "The subarray [1] has the largest sum 1."},
                    {"id": "SAMPLE-03", "in": {"nums": [5, 4, -1, 7, 8]}, "out": 23, "exp": "The subarray [5,4,-1,7,8] has the largest sum 23."},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"nums": [-5, -2, -8, -1]}, "out": -1},
                    {"id": "TC-02", "in": {"nums": [-1, 0, -2]}, "out": 0},
                ],
            },
            {
                "index": "F",
                "title": "Reverse Array",
                "slug": "reverse-array",
                "difficulty": "EASY",
                "topic": "Arrays",
                "points": 100,
                "description": "Given an array of integers `arr`, return a new array containing the elements in reverse order.",
                "constraints": "0 <= arr.length <= 10^4\n-10^9 <= arr[i] <= 10^9",
                "input_format": "`arr`: Integer array",
                "output_format": "Reversed integer array",
                "fn_name": "reverseArray",
                "params": [{"name": "arr", "type": "integer[]"}],
                "ret_type": "integer[]",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"arr": [1, 2, 3, 4, 5]}, "out": [5, 4, 3, 2, 1], "exp": "Array reversed"},
                    {"id": "SAMPLE-02", "in": {"arr": [1, 2]}, "out": [2, 1], "exp": "Two elements reversed"},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"arr": []}, "out": []},
                    {"id": "TC-02", "in": {"arr": [42]}, "out": [42]},
                ],
            },
            {
                "index": "G",
                "title": "Longest Substring Without Repeating Characters",
                "slug": "longest-substring-without-repeating-characters",
                "difficulty": "MEDIUM",
                "topic": "Sliding Window",
                "points": 200,
                "description": "Given a string `s`, find the length of the longest substring without duplicate characters.",
                "constraints": "0 <= s.length <= 5 * 10^4\n`s` consists of English letters, digits, symbols and spaces.",
                "input_format": "`s`: String",
                "output_format": "Length of longest non-repeating substring",
                "fn_name": "lengthOfLongestSubstring",
                "params": [{"name": "s", "type": "string"}],
                "ret_type": "integer",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"s": "abcabcbb"}, "out": 3, "exp": "The answer is 'abc', with the length of 3."},
                    {"id": "SAMPLE-02", "in": {"s": "bbbbb"}, "out": 1, "exp": "The answer is 'b', with the length of 1."},
                    {"id": "SAMPLE-03", "in": {"s": "pwwkew"}, "out": 3, "exp": "The answer is 'wke', with the length of 3."},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"s": ""}, "out": 0},
                    {"id": "TC-02", "in": {"s": " "}, "out": 1},
                    {"id": "TC-03", "in": {"s": "dvdf"}, "out": 3},
                ],
            },
            {
                "index": "H",
                "title": "Trapping Rain Water",
                "slug": "trapping-rain-water",
                "difficulty": "HARD",
                "topic": "Two Pointers",
                "points": 300,
                "description": "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
                "constraints": "n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5",
                "input_format": "`height`: Elevation array",
                "output_format": "Total trapped water integer",
                "fn_name": "trap",
                "params": [{"name": "height", "type": "integer[]"}],
                "ret_type": "integer",
                "samples": [
                    {"id": "SAMPLE-01", "in": {"height": [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]}, "out": 6, "exp": "The above elevation map can trap 6 units of rain water."},
                    {"id": "SAMPLE-02", "in": {"height": [4, 2, 0, 3, 2, 5]}, "out": 9, "exp": "Traps 9 units of rain water."},
                ],
                "hidden": [
                    {"id": "TC-01", "in": {"height": [3, 0, 2, 0, 4]}, "out": 7},
                    {"id": "TC-02", "in": {"height": [5, 4, 1, 2]}, "out": 1},
                    {"id": "TC-03", "in": {"height": [1, 2, 3]}, "out": 0},
                ],
            },
        ]

        seeded_count = 0
        published_count = 0

        for item in CANONICAL_SUITE:
            existing = await db.scalar(select(Problem).where(Problem.slug == item["slug"]))
            if existing:
                # If existing is in draft, publish it
                if existing.status != "PUBLISHED":
                    existing.status = "PUBLISHED"
                    published_count += 1
                continue

            # Generate function signature and starter codes
            fn_sig = FunctionSignature(
                name=item["fn_name"],
                parameters=item["params"],
                return_type=item["ret_type"],
            )
            starter_dict = {}
            for lang in ["python", "cpp", "c", "java", "javascript", "typescript"]:
                try:
                    adapter = get_adapter(lang)
                    starter_dict[lang] = adapter.generate_starter_code(fn_sig)
                except Exception:
                    pass

            problem = Problem(
                problem_index=item["index"],
                title=item["title"],
                slug=item["slug"],
                difficulty=item["difficulty"],
                topic=item["topic"],
                points=item["points"],
                description=item["description"],
                constraints=item["constraints"],
                input_format=item["input_format"],
                output_format=item["output_format"],
                execution_mode="FUNCTION",
                function_signature=fn_sig.model_dump(),
                starter_code=starter_dict,
                time_limit=2.0,
                memory_limit=256,
                evaluation_config={
                    "match_type": "EXACT_MATCH",
                    "float_tolerance": 1e-6,
                    "ignore_whitespace": True,
                    "ignore_case": False,
                },
                sandbox_config={
                    "time_limit_sec": 2.0,
                    "memory_limit_mb": 256,
                    "network_enabled": False,
                    "process_limit": 16,
                    "output_limit_kb": 1024,
                },
                status="PUBLISHED",
                version=1,
                created_by=admin_id,
            )
            db.add(problem)
            await db.flush()

            # Add testcases
            order_idx = 0
            for sample in item["samples"]:
                tc = ProblemTestCase(
                    problem_id=problem.id,
                    version=1,
                    testcase_id=sample["id"],
                    input_data=sample["in"],
                    expected_output=sample["out"],
                    explanation=sample.get("exp"),
                    weight=1.0,
                    is_hidden=False,
                    order=order_idx,
                    is_active=True,
                    content_hash=cls._compute_testcase_hash(sample["in"], sample["out"]),
                )
                db.add(tc)
                order_idx += 1

            for h in item["hidden"]:
                tc = ProblemTestCase(
                    problem_id=problem.id,
                    version=1,
                    testcase_id=h["id"],
                    input_data=h["in"],
                    expected_output=h["out"],
                    weight=1.0,
                    is_hidden=True,
                    order=order_idx,
                    is_active=True,
                    content_hash=cls._compute_testcase_hash(h["in"], h["out"]),
                )
                db.add(tc)
                order_idx += 1

            # Snapshot version 1
            ver = ProblemVersion(
                problem_id=problem.id,
                version=1,
                title=problem.title,
                slug=problem.slug,
                difficulty=problem.difficulty,
                topic=problem.topic,
                points=problem.points,
                description=problem.description,
                constraints=problem.constraints,
                input_format=problem.input_format,
                output_format=problem.output_format,
                execution_mode=problem.execution_mode,
                function_signature=problem.function_signature,
                starter_code=problem.starter_code,
                time_limit=problem.time_limit,
                memory_limit=problem.memory_limit,
                evaluation_config=problem.evaluation_config,
                sandbox_config=problem.sandbox_config,
                created_by=admin_id,
                created_at=now_utc(),
            )
            db.add(ver)

            seeded_count += 1
            published_count += 1

        await db.commit()
        return {
            "success": True,
            "seeded_count": seeded_count,
            "published_count": published_count,
            "message": f"Successfully seeded {seeded_count} institutional practice problems.",
        }

    @classmethod
    async def create_new_version(cls, problem_id: str, admin_id: Optional[str], db: AsyncSession) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")

        old_version = problem.version
        new_version = old_version + 1

        # Advance version and copy existing testcases to new version index
        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == old_version,
        )
        old_testcases = (await db.scalars(tc_stmt)).all()

        for tc in old_testcases:
            new_tc = ProblemTestCase(
                problem_id=problem.id,
                version=new_version,
                testcase_id=tc.testcase_id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                explanation=tc.explanation,
                weight=tc.weight,
                is_hidden=tc.is_hidden,
                order=tc.order,
                is_active=tc.is_active,
                content_hash=tc.content_hash,
            )
            db.add(new_tc)

        problem.version = new_version
        problem.status = "DRAFT"
        problem.updated_by = admin_id
        problem.updated_at = now_utc()

        await db.commit()
        await db.refresh(problem)
        return await cls.get_problem_detail(problem.id, include_hidden=True, db=db)

    @classmethod
    async def list_versions(cls, problem_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        stmt = select(ProblemVersion).where(ProblemVersion.problem_id == problem_id).order_by(ProblemVersion.version.desc())
        versions = (await db.scalars(stmt)).all()
        return [
            {
                "id": v.id,
                "problem_id": v.problem_id,
                "version": v.version,
                "title": v.title,
                "slug": v.slug,
                "difficulty": v.difficulty,
                "points": v.points,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ]

    @classmethod
    async def add_testcase(cls, problem_id: str, tc_payload: TestCaseInputSchema, db: AsyncSession) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")
        if problem.status == "LOCKED":
            raise HTTPException(status_code=400, detail="Cannot alter testcases on a LOCKED problem.")

        # Check unique testcase_id for this version
        existing = await db.scalar(
            select(ProblemTestCase).where(
                ProblemTestCase.problem_id == problem.id,
                ProblemTestCase.version == problem.version,
                ProblemTestCase.testcase_id == tc_payload.testcase_id,
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail=f"Testcase '{tc_payload.testcase_id}' already exists.")

        tc = ProblemTestCase(
            problem_id=problem.id,
            version=problem.version,
            testcase_id=tc_payload.testcase_id,
            input_data=tc_payload.input,
            expected_output=tc_payload.expected_output,
            explanation=tc_payload.explanation,
            weight=tc_payload.weight,
            is_hidden=tc_payload.is_hidden,
            order=tc_payload.order,
            is_active=True,
            content_hash=cls._compute_testcase_hash(tc_payload.input, tc_payload.expected_output),
        )
        db.add(tc)
        await db.commit()
        await db.refresh(tc)
        return {
            "id": tc.id,
            "testcase_id": tc.testcase_id,
            "is_hidden": tc.is_hidden,
            "weight": tc.weight,
            "order": tc.order,
            "hash": tc.content_hash,
        }

    @classmethod
    async def delete_testcase(cls, problem_id: str, testcase_id: str, db: AsyncSession) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")
        if problem.status == "LOCKED":
            raise HTTPException(status_code=400, detail="Cannot alter testcases on a LOCKED problem.")

        stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            or_(ProblemTestCase.id == testcase_id, ProblemTestCase.testcase_id == testcase_id),
        )
        tc = await db.scalar(stmt)
        if not tc:
            raise HTTPException(status_code=404, detail=f"Testcase '{testcase_id}' not found.")

        await db.delete(tc)
        await db.commit()
        return {"success": True, "message": f"Testcase '{testcase_id}' deleted."}

    @classmethod
    async def update_testcase(
        cls,
        problem_id: str,
        testcase_id: str,
        tc_payload: TestCaseUpdateSchema | TestCaseInputSchema,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")
        if problem.status == "LOCKED":
            raise HTTPException(status_code=400, detail="Cannot alter testcases on a LOCKED problem.")

        stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            or_(ProblemTestCase.id == testcase_id, ProblemTestCase.testcase_id == testcase_id),
        )
        tc = await db.scalar(stmt)
        if not tc:
            raise HTTPException(status_code=404, detail=f"Testcase '{testcase_id}' not found.")

        if tc_payload.input is not None:
            tc.input_data = tc_payload.input
        if tc_payload.expected_output is not None:
            tc.expected_output = tc_payload.expected_output
        if tc_payload.explanation is not None:
            tc.explanation = tc_payload.explanation
        if tc_payload.weight is not None:
            tc.weight = tc_payload.weight
        if tc_payload.is_hidden is not None:
            tc.is_hidden = tc_payload.is_hidden
        if tc_payload.order is not None:
            tc.order = tc_payload.order

        tc.content_hash = cls._compute_testcase_hash(tc.input_data, tc.expected_output)

        if problem.status in ("VALIDATED", "PUBLISHED"):
            problem.status = "DRAFT"

        await db.commit()
        await db.refresh(tc)
        return {
            "id": tc.id,
            "testcase_id": tc.testcase_id,
            "is_hidden": tc.is_hidden,
            "weight": tc.weight,
            "order": tc.order,
            "hash": tc.content_hash,
        }

    @classmethod
    async def delete_problem(
        cls,
        problem_id: str,
        admin_id: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        problem = await db.get(Problem, problem_id)
        if not problem:
            problem = await db.scalar(select(Problem).where(Problem.slug == problem_id))
            if not problem:
                raise HTTPException(status_code=404, detail="Problem not found.")

        if problem.status == "LOCKED":
            raise HTTPException(
                status_code=400,
                detail="Cannot delete a LOCKED problem tied to an active or concluded contest.",
            )

        from app.models.contest import ContestProblem
        active_contest_link = await db.scalar(
            select(ContestProblem).where(ContestProblem.problem_id == problem.id)
        )
        if active_contest_link:
            raise HTTPException(
                status_code=400,
                detail="Problem is linked to one or more contest arenas. Remove contest links or archive first.",
            )

        await db.delete(problem)
        await db.commit()
        return {"success": True, "message": f"Problem '{problem.slug}' deleted."}

