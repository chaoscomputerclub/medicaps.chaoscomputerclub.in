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

