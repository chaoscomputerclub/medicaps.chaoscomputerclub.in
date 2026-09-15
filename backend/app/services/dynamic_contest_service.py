"""
Chaos Computer Club — Dynamic Contest Creation & Lifecycle Domain Service
Production-grade engine for creating, updating, cloning, configuring, and publishing
campus contests, screening assessments, and problem statements with zero static data dependency.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, delete, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.base import now_utc
from app.models.contest import (
    OfflineContest,
    ContestProblem,
    ContestRegistration,
    ContestSubmission,
    ScoreboardEntry,
)
from app.models.assessment import (
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
)
from app.models.campus_pass import CampusPass
from app.models.member import MemberProfile
from app.schemas.dynamic_contest import (
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    ProblemCreateSchema,
    AssessmentConfigSchema,
    ContestCloneRequest,
    PresetContestLaunchRequest,
    ContestStatusChangeRequest,
)
from app.core.cache import delete_cache_pattern
from app.services.assessment_service import AssessmentService

logger = logging.getLogger(__name__)


class DynamicContestService:
    """Core domain service for dynamic on-the-fly contest creation, mutation, and scheduling."""

    @staticmethod
    def _slugify(text: str) -> str:
        """Convert arbitrary text into a URL-safe slug."""
        text = text.lower().strip()
        slug = re.sub(r"[^\w\s-]", "", text)
        slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
        return slug or "contest"

    @staticmethod
    def _default_starter_codes(problem_title: str) -> Dict[str, str]:
        """Generate default starter code templates for common languages."""
        py_template = (
            f"# {problem_title}\n"
            "import sys\n\n"
            "def main():\n"
            "    input_data = sys.stdin.read().split()\n"
            "    if not input_data:\n"
            "        return\n"
            "    # Write your solution here\n"
            "    pass\n\n"
            "if __name__ == '__main__':\n"
            "    main()\n"
        )
        cpp_template = (
            f"// {problem_title}\n"
            "#include <iostream>\n"
            "#include <vector>\n"
            "#include <string>\n"
            "#include <algorithm>\n\n"
            "using namespace std;\n\n"
            "int main() {\n"
            "    ios_base::sync_with_stdio(false);\n"
            "    cin.tie(NULL);\n"
            "    // Write your solution here\n"
            "    return 0;\n"
            "}\n"
        )
        js_template = (
            f"// {problem_title}\n"
            "const fs = require('fs');\n\n"
            "function main() {\n"
            "    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n"
            "    // Write your solution here\n"
            "}\n\n"
            "main();\n"
        )
        java_template = (
            f"// {problem_title}\n"
            "import java.util.*;\n\n"
            "public class Main {\n"
            "    public static void main(String[] args) {\n"
            "        Scanner sc = new Scanner(System.in);\n"
            "        // Write your solution here\n"
            "    }\n"
            "}\n"
        )
        return {
            "python": py_template,
            "cpp": cpp_template,
            "javascript": js_template,
            "java": java_template,
        }


    @staticmethod
    async def create_contest(
        payload: DynamicContestCreateRequest,
        db: AsyncSession,
        creator: Optional[MemberProfile] = None,
    ) -> Dict[str, Any]:
        """
        Atomically create an offline campus contest, its Phase 1 screening assessment,
        and its full problem challenge suite.
        """
        target_slug = payload.slug or DynamicContestService._slugify(payload.title)

        # Check for slug collision
        existing_c = (await db.execute(select(OfflineContest).where(OfflineContest.slug == target_slug))).scalars().first()
        if existing_c:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A contest with slug '{target_slug}' already exists.",
            )

        # Compute timestamps
        starts_at = payload.starts_at
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)

        ends_at = payload.ends_at or (starts_at + timedelta(hours=2))
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)

        check_in_opens_at = payload.check_in_opens_at or (starts_at - timedelta(hours=1))
        if check_in_opens_at.tzinfo is None:
            check_in_opens_at = check_in_opens_at.replace(tzinfo=timezone.utc)

        now = now_utc()

        # 1. Create OfflineContest entity
        contest = OfflineContest(
            slug=target_slug,
            title=payload.title,
            season=payload.season,
            status="upcoming",
            division=payload.division,
            cadence=payload.cadence,
            edition=payload.edition,
            starts_at=starts_at,
            ends_at=ends_at,
            check_in_opens_at=check_in_opens_at,
            venue=payload.venue,
            seat_capacity=payload.seat_capacity,
            registered_count=0,
            problem_count=len(payload.problems),
            environment=payload.environment,
            chief_proctors=payload.chief_proctors,
            prize_pool=payload.prize_pool,
            sponsor=payload.sponsor,
            summary=payload.summary,
            rules=payload.rules if payload.rules else [
                "Phase 1 Online Screening: 120-minute timed round in anti-cheat browser arena.",
                "Top 30 verified scorers qualify for the Phase 2 on-premise air-gapped lab final.",
                "Submissions evaluated via CodeBox with sub-millisecond precision.",
                "Standard penalty: 20 minutes per non-accepted submission on tie-breaks."
            ],
            banner_url=payload.banner_url,
            created_at=now,
        )
        db.add(contest)
        await db.flush()

        # 2. Create Phase 1 Assessment entity
        assess_cfg = payload.assessment or AssessmentConfigSchema()
        assess_starts = assess_cfg.starts_at or (now - timedelta(minutes=5) if assess_cfg.auto_unlock_now else (starts_at - timedelta(hours=24)))
        if assess_starts.tzinfo is None:
            assess_starts = assess_starts.replace(tzinfo=timezone.utc)

        assess_ends = assess_cfg.ends_at or starts_at
        if assess_ends.tzinfo is None:
            assess_ends = assess_ends.replace(tzinfo=timezone.utc)

        assessment = Assessment(
            contest_id=contest.id,
            slug=target_slug,
            title=assess_cfg.title or f"{payload.title} — Online Screening Round",
            summary=assess_cfg.summary or f"Phase 1 online qualification round for {payload.title}. Solve the challenge suite within {assess_cfg.duration_minutes} minutes.",
            duration_minutes=assess_cfg.duration_minutes,
            starts_at=assess_starts,
            ends_at=assess_ends,
            is_active=True,
            max_violations=assess_cfg.max_violations,
            created_at=now,
        )
        db.add(assessment)
        await db.flush()

        # 3. Create Problem Challenges (Mirrored for Contest Arena & Assessment)
        created_problems = []
        for p in payload.problems:
            starter_codes = p.starter_codes if p.starter_codes else DynamicContestService._default_starter_codes(p.title)
            sample_tcs = [tc.model_dump() for tc in p.sample_testcases]
            hidden_tcs = [tc.model_dump() for tc in p.hidden_testcases]

            # Assessment Problem
            ap = AssessmentProblem(
                assessment_id=assessment.id,
                problem_index=p.problem_index,
                title=p.title,
                difficulty=p.difficulty,
                points=p.points,
                description=p.description,
                input_format=p.input_format,
                output_format=p.output_format,
                constraints=p.constraints,
                time_limit=p.time_limit,
                memory_limit=p.memory_limit,
                starter_codes=starter_codes,
                sample_testcases=sample_tcs,
                hidden_testcases=hidden_tcs,
                created_at=now,
            )
            db.add(ap)

            # Contest Arena Problem
            cp = ContestProblem(
                contest_id=contest.id,
                problem_index=p.problem_index,
                title=p.title,
                topic=p.topic or "Algorithms",
                points=p.points,
                solved_count=0,
                difficulty=p.difficulty,
                description=p.description,
                input_format=p.input_format,
                output_format=p.output_format,
                constraints=p.constraints,
                time_limit=p.time_limit,
                memory_limit=p.memory_limit,
                starter_codes=starter_codes,
                sample_testcases=sample_tcs,
                hidden_testcases=hidden_tcs,
            )
            db.add(cp)
            created_problems.append({
                "problem_index": p.problem_index,
                "title": p.title,
                "difficulty": p.difficulty,
                "points": p.points,
            })

        await db.commit()

        # Invalidate contest caches across Redis
        try:
            await delete_cache_pattern("cache:*")
        except Exception as exc:
            logger.warning("Cache invalidate warning: %s", exc)

        logger.info("✓ Contest '%s' (%s) successfully created.", contest.title, contest.slug)

        return {
            "success": True,
            "message": f"Contest '{contest.title}' created and published successfully.",
            "contest_id": contest.id,
            "slug": contest.slug,
            "title": contest.title,
            "cadence": contest.cadence,
            "edition": contest.edition,
            "status": contest.status,
            "starts_at": contest.starts_at.isoformat(),
            "ends_at": contest.ends_at.isoformat(),
            "screening_round": {
                "assessment_id": assessment.id,
                "slug": assessment.slug,
                "starts_at": assessment.starts_at.isoformat(),
                "ends_at": assessment.ends_at.isoformat(),
                "duration_minutes": assessment.duration_minutes,
                "is_active": assessment.is_active,
            },
            "problems": created_problems,
        }

    @staticmethod
    async def update_contest(
        contest_slug: str,
        payload: DynamicContestUpdateRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Dynamically update contest specifications and sync linked assessment."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        update_dict = payload.model_dump(exclude_unset=True)

        for key, val in update_dict.items():
            if hasattr(contest, key) and val is not None:
                if isinstance(val, datetime) and val.tzinfo is None:
                    val = val.replace(tzinfo=timezone.utc)
                setattr(contest, key, val)

        # Sync Assessment if times or title changed
        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()
        if assessment:
            if "title" in update_dict and update_dict["title"]:
                assessment.title = f"{contest.title} — Online Screening Round"
            if "starts_at" in update_dict and update_dict["starts_at"]:
                assessment.ends_at = contest.starts_at

        await db.commit()

        try:
            await delete_cache_pattern("cache:*")
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Contest '{contest.slug}' updated successfully.",
            "contest": {
                "id": contest.id,
                "slug": contest.slug,
                "title": contest.title,
                "status": contest.status,
                "starts_at": contest.starts_at.isoformat(),
                "venue": contest.venue,
            }
        }

    @staticmethod
    async def add_or_update_problem(
        contest_slug: str,
        problem_data: ProblemCreateSchema,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Add a new problem or replace an existing problem by index (A, B, C, D) in both arena & assessment."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()

        idx = problem_data.problem_index
        sample_tcs = [tc.model_dump() for tc in problem_data.sample_testcases]
        hidden_tcs = [tc.model_dump() for tc in problem_data.hidden_testcases]
        starter_codes = problem_data.starter_codes if problem_data.starter_codes else DynamicContestService._default_starter_codes(problem_data.title)

        # 1. Update/Create ContestProblem
        cp_res = await db.execute(
            select(ContestProblem).where(
                ContestProblem.contest_id == contest.id,
                ContestProblem.problem_index == idx,
            )
        )
        cp = cp_res.scalars().first()
        if cp:
            cp.title = problem_data.title
            cp.topic = problem_data.topic or "Algorithms"
            cp.points = problem_data.points
            cp.difficulty = problem_data.difficulty
            cp.description = problem_data.description
            cp.input_format = problem_data.input_format
            cp.output_format = problem_data.output_format
            cp.constraints = problem_data.constraints
            cp.time_limit = problem_data.time_limit
            cp.memory_limit = problem_data.memory_limit
            cp.starter_codes = starter_codes
            cp.sample_testcases = sample_tcs
            cp.hidden_testcases = hidden_tcs
        else:
            cp = ContestProblem(
                contest_id=contest.id,
                problem_index=idx,
                title=problem_data.title,
                topic=problem_data.topic or "Algorithms",
                points=problem_data.points,
                solved_count=0,
                difficulty=problem_data.difficulty,
                description=problem_data.description,
                input_format=problem_data.input_format,
                output_format=problem_data.output_format,
                constraints=problem_data.constraints,
                time_limit=problem_data.time_limit,
                memory_limit=problem_data.memory_limit,
                starter_codes=starter_codes,
                sample_testcases=sample_tcs,
                hidden_testcases=hidden_tcs,
            )
            db.add(cp)

        # 2. Update/Create AssessmentProblem
        if assessment:
            ap_res = await db.execute(
                select(AssessmentProblem).where(
                    AssessmentProblem.assessment_id == assessment.id,
                    AssessmentProblem.problem_index == idx,
                )
            )
            ap = ap_res.scalars().first()
            if ap:
                ap.title = problem_data.title
                ap.difficulty = problem_data.difficulty
                ap.points = problem_data.points
                ap.description = problem_data.description
                ap.input_format = problem_data.input_format
                ap.output_format = problem_data.output_format
                ap.constraints = problem_data.constraints
                ap.time_limit = problem_data.time_limit
                ap.memory_limit = problem_data.memory_limit
                ap.starter_codes = starter_codes
                ap.sample_testcases = sample_tcs
                ap.hidden_testcases = hidden_tcs
            else:
                ap = AssessmentProblem(
                    assessment_id=assessment.id,
                    problem_index=idx,
                    title=problem_data.title,
                    difficulty=problem_data.difficulty,
                    points=problem_data.points,
                    description=problem_data.description,
                    input_format=problem_data.input_format,
                    output_format=problem_data.output_format,
                    constraints=problem_data.constraints,
                    time_limit=problem_data.time_limit,
                    memory_limit=problem_data.memory_limit,
                    starter_codes=starter_codes,
                    sample_testcases=sample_tcs,
                    hidden_testcases=hidden_tcs,
                    created_at=now_utc(),
                )
                db.add(ap)

        await db.flush()

        # Recount total problems
        count_res = await db.execute(select(ContestProblem).where(ContestProblem.contest_id == contest.id))
        contest.problem_count = len(count_res.scalars().all())

        await db.commit()

        try:
            await delete_cache_pattern("cache:*")
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Problem '{idx}' ({problem_data.title}) updated successfully for {contest_slug}.",
            "problem_index": idx,
            "problem_count": contest.problem_count,
        }

    @staticmethod
    async def delete_problem(
        contest_slug: str,
        problem_index: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Delete a specific problem index from both arena and assessment."""
        idx = problem_index.strip().upper()
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        # Delete ContestProblem
        await db.execute(
            delete(ContestProblem).where(
                ContestProblem.contest_id == contest.id,
                ContestProblem.problem_index == idx,
            )
        )

        # Delete AssessmentProblem
        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()
        if assessment:
            await db.execute(
                delete(AssessmentProblem).where(
                    AssessmentProblem.assessment_id == assessment.id,
                    AssessmentProblem.problem_index == idx,
                )
            )

        await db.flush()

        # Recount problems
        count_res = await db.execute(select(ContestProblem).where(ContestProblem.contest_id == contest.id))
        contest.problem_count = len(count_res.scalars().all())

        await db.commit()

        try:
            await delete_cache_pattern("cache:*")
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Problem '{idx}' removed from '{contest_slug}'.",
            "remaining_problem_count": contest.problem_count,
        }

    @staticmethod
    async def clone_contest(
        source_slug: str,
        payload: ContestCloneRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Clone an existing contest blueprint (including problem statements, testcases,
        and starter codes) into a newly scheduled edition.
        """
        c_res = await db.execute(
            select(OfflineContest)
            .options(selectinload(OfflineContest.problems))
            .where(OfflineContest.slug == source_slug)
        )
        source = c_res.scalars().first()
        if not source:
            raise HTTPException(status_code=404, detail=f"Source contest '{source_slug}' not found.")

        new_slug = payload.new_slug or DynamicContestService._slugify(payload.new_title)

        existing = (await db.execute(select(OfflineContest).where(OfflineContest.slug == new_slug))).scalars().first()
        if existing:
            raise HTTPException(status_code=409, detail=f"A contest with slug '{new_slug}' already exists.")

        starts_at = payload.starts_at
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)

        ends_at = payload.ends_at or (starts_at + timedelta(hours=2))
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)

        now = now_utc()

        # Build problems list from source
        clone_problems = [
            ProblemCreateSchema(
                problem_index=p.problem_index,
                title=p.title,
                topic=p.topic,
                difficulty=p.difficulty or "MEDIUM",
                points=p.points,
                description=p.description or f"Problem {p.problem_index}: {p.title}",
                input_format=p.input_format,
                output_format=p.output_format,
                constraints=p.constraints,
                time_limit=p.time_limit or 2.0,
                memory_limit=p.memory_limit or 256,
                starter_codes=p.starter_codes or {},
                sample_testcases=p.sample_testcases or [],
                hidden_testcases=p.hidden_testcases or [],
            )
            for p in source.problems
        ]

        create_req = DynamicContestCreateRequest(
            title=payload.new_title,
            slug=new_slug,
            season=source.season,
            cadence=source.cadence,
            edition=payload.new_edition or (source.edition + 1 if source.edition else None),
            division=source.division,
            starts_at=starts_at,
            ends_at=ends_at,
            venue=source.venue,
            seat_capacity=source.seat_capacity,
            environment=source.environment,
            chief_proctors=source.chief_proctors,
            prize_pool=source.prize_pool,
            sponsor=source.sponsor,
            summary=source.summary,
            rules=source.rules,
            banner_url=source.banner_url,
            problems=clone_problems,
            assessment=AssessmentConfigSchema(
                auto_unlock_now=payload.auto_unlock_assessment_now,
            ),
        )

        return await DynamicContestService.create_contest(create_req, db)

    @staticmethod
    async def change_contest_status(
        contest_slug: str,
        target_status: str,
        db: AsyncSession,
        auto_qualify_top_30: bool = True,
    ) -> Dict[str, Any]:
        """
        Transition contest lifecycle status: 'upcoming' -> 'live' -> 'finished'.
        When transitioning to 'live', optionally triggers auto-qualification of Top 30 finalists.
        """
        valid_statuses = {"upcoming", "live", "finished"}
        cleaned_status = target_status.strip().lower()
        if cleaned_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status '{target_status}'. Must be one of: {valid_statuses}")

        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        old_status = contest.status
        contest.status = cleaned_status

        qualify_summary = None
        if cleaned_status == "live" and auto_qualify_top_30:
            try:
                qualify_summary = await AssessmentService.evaluate_and_qualify_top_30(contest_slug, db)
            except Exception as e:
                logger.warning("Auto qualify Top 30 notice: %s", e)

        await db.commit()

        try:
            await delete_cache_pattern("cache:*")
        except Exception:
            pass

        return {
            "success": True,
            "contest_slug": contest.slug,
            "title": contest.title,
            "previous_status": old_status,
            "current_status": cleaned_status,
            "top_30_qualification": qualify_summary,
        }

    @staticmethod
    async def delete_contest(
        contest_slug: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Strict cascade deletion of a contest, its problems, screening assessments, and passes."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        contest_title = contest.title

        # Assessment Cascade
        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()
        if assessment:
            await db.delete(assessment)

        await db.delete(contest)
        await db.commit()

        try:
            await delete_cache_pattern("cache:*")
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Contest '{contest_title}' ({contest_slug}) and associated records deleted permanently.",
        }

    @staticmethod
    async def launch_preset(
        preset_req: PresetContestLaunchRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """One-click API to deploy standard Weekly or Biweekly campus contest editions with algorithmic challenges."""
        now = now_utc()
        starts_at = now + timedelta(hours=preset_req.starts_in_hours)
        ends_at = starts_at + timedelta(hours=2)

        cadence = preset_req.cadence.lower().strip()
        edition = preset_req.edition

        if cadence == "biweekly":
            title = f"CCC Biweekly Contest {edition}"
            slug = f"biweekly-contest-{edition}"
            venue = preset_req.venue or "Medi-Caps University High Performance Compute Lab (Lab 02)"
            prize = preset_req.prize_pool or f"₹25,000 Cash Prize + Edition #{edition} Badges"
            summary = f"Saturday night algorithmic clash. Biweekly #{edition} featuring 4 competitive challenges designed by the CCC competitive wing for Medi-Caps university cadets."
            problems = [
                ProblemCreateSchema(
                    problem_index="A",
                    title="Cadet Workstation Matrix Shift",
                    topic="Matrix & Array Manipulation",
                    difficulty="EASY",
                    points=100,
                    description="Given an N x M matrix representing cadet IP assignments and an integer K, shift the matrix elements cyclically right by K positions in row-major order.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "2 3 1\n1 2 3\n4 5 6", "expected_output": "6 1 2\n3 4 5"}],
                    hidden_testcases=[{"stdin": "1 3 3\n10 20 30", "expected_output": "10 20 30"}],
                ),
                ProblemCreateSchema(
                    problem_index="B",
                    title="Medi-Caps Secure Subnet Partitions",
                    topic="Prefix Sums & Modulo Hashing",
                    difficulty="MEDIUM",
                    points=200,
                    description="Find the number of non-empty contiguous subarrays whose sum of traffic volumes is strictly divisible by divisor K.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "6 5\n4 5 0 -2 -3 1", "expected_output": "7"}],
                    hidden_testcases=[{"stdin": "4 2\n1 2 3 4", "expected_output": "4"}],
                ),
                ProblemCreateSchema(
                    problem_index="C",
                    title="Server Rack Heat Dissipation Tree",
                    topic="Tree Dynamic Programming",
                    difficulty="MEDIUM",
                    points=300,
                    description="Maximize heat reduction across a tree-structured server rack by placing at most C independent ventilation units.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "3 1 10\n15 15 15\n1 2\n1 3", "expected_output": "30"}],
                    hidden_testcases=[{"stdin": "2 1 5\n10 10\n1 2", "expected_output": "10"}],
                ),
                ProblemCreateSchema(
                    problem_index="D",
                    title="Air-Gapped Cryptographic Signature DAG",
                    topic="DAG Dynamic Programming",
                    difficulty="HARD",
                    points=400,
                    description="Find the maximum path reliability in a Directed Acyclic Graph (DAG) visiting at least K intermediate validation nodes.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "4 4 3\n1 2 10\n2 4 20\n1 4 50\n1 3 5", "expected_output": "30"}],
                    hidden_testcases=[{"stdin": "3 2 3\n1 2 10\n2 3 20", "expected_output": "30"}],
                ),
            ]
        else:
            # Default Weekly
            title = f"CCC Weekly Contest {edition}"
            slug = f"weekly-contest-{edition}"
            venue = preset_req.venue or "Medi-Caps University Main Computing Lab (Lab 04)"
            prize = preset_req.prize_pool or f"₹15,000 Cash Prize + Edition #{edition} Certificates"
            summary = f"Sunday algorithmic showdown. Weekly #{edition} featuring 4 algorithmic challenges testing graph theory, dynamic programming, and greedy heuristics."
            problems = [
                ProblemCreateSchema(
                    problem_index="A",
                    title="Campus Pass String Validator",
                    topic="String Hashing & Reversals",
                    difficulty="EASY",
                    points=100,
                    description="Determine the total count of valid mirror pass pairs (i < j where pass[i] is reverse of pass[j]) among N strings.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "4\nAB\nBA\nCD\nDC", "expected_output": "2"}],
                    hidden_testcases=[{"stdin": "6\nAA\nAA\nAA\nBB\nBB\nCC", "expected_output": "4"}],
                ),
                ProblemCreateSchema(
                    problem_index="B",
                    title="Medi-Caps Lab Router Bandwidth Allocation",
                    topic="Greedy & Priority Queue",
                    difficulty="MEDIUM",
                    points=200,
                    description="Allocate M megabits of lab bandwidth among K competing processes to maximize total priority utility.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "3 10\n2 5 3\n1 4 5\n3 3 2", "expected_output": "44"}],
                    hidden_testcases=[{"stdin": "3 20\n5 10 4\n5 10 8\n5 10 2", "expected_output": "130"}],
                ),
                ProblemCreateSchema(
                    problem_index="C",
                    title="Air-Gapped Quantum Key Distribution",
                    topic="Shortest Path Dijkstra with Repeaters",
                    difficulty="MEDIUM",
                    points=300,
                    description="Find the minimum transmission latency from workstation 1 to N when deploying up to K quantum booster repeaters.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "4 4 1\n1 2 10\n2 4 10\n1 3 20\n3 4 5", "expected_output": "15"}],
                    hidden_testcases=[{"stdin": "3 2 1\n1 2 100\n2 3 200", "expected_output": "200"}],
                ),
                ProblemCreateSchema(
                    problem_index="D",
                    title="Subnet Packet Collision Minimizer",
                    topic="Weighted Interval Scheduling & DP",
                    difficulty="HARD",
                    points=400,
                    description="Schedule non-overlapping network packet transmissions to maximize total priority score.",
                    time_limit=2.0,
                    memory_limit=256,
                    sample_testcases=[{"stdin": "3\n1 3 50\n2 4 10\n3 5 40", "expected_output": "90"}],
                    hidden_testcases=[{"stdin": "4\n1 2 5\n2 3 5\n3 4 5\n1 4 20", "expected_output": "20"}],
                ),
            ]

        create_req = DynamicContestCreateRequest(
            title=title,
            slug=slug,
            season="Season 2026",
            cadence=cadence,
            edition=edition,
            division="open",
            starts_at=starts_at,
            ends_at=ends_at,
            venue=venue,
            seat_capacity=60,
            environment="Air-Gapped Workstation LAN · Clang 18 / GCC 14 / Python 3.12",
            chief_proctors=["Dr. Ratnesh Litoriya (Chief Proctor)", "Prof. Amit Shrivastava"],
            prize_pool=prize,
            sponsor="Chaos Computer Club Medi-Caps Chapter",
            summary=summary,
            problems=problems,
            assessment=AssessmentConfigSchema(
                auto_unlock_now=preset_req.auto_unlock_screening,
            ),
        )

        return await DynamicContestService.create_contest(create_req, db)
