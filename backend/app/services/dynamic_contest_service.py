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
    AssessmentUpdateRequest,
    ProblemSaveRequest,
    ProblemSyncRequest,
)
from app.core.cache import delete_cache_pattern
from app.services.assessment_service import AssessmentService

logger = logging.getLogger(__name__)


class DynamicContestService:
    """Core domain service for dynamic on-the-fly contest creation, mutation, and scheduling."""

    _CONTEST_CACHE_PATTERNS = (
        "cache:contests:*",
        "cache:contest:*",
        "cache:scoreboard:*",
        "cache:ranking:*",
    )

    @staticmethod
    async def _invalidate_contest_caches(include_rating_caches: bool = False) -> None:
        """Clear only memoized data whose value depends on contest state."""
        for pattern in DynamicContestService._CONTEST_CACHE_PATTERNS:
            await delete_cache_pattern(pattern)
        if include_rating_caches:
            for pattern in (
                "cache:leaderboard:*",
                "cache:profile:*",
                "cache:student:profile:*",
                "cache:contests:*",
                "cache:contest:*",
                "cache:scoreboard:*",
                "cache:ranking:*",
                "cache:*",
            ):
                await delete_cache_pattern(pattern)

    @staticmethod
    def _contest_event_data(contest: OfflineContest, change: str) -> Dict[str, Any]:
        """Use one stable payload shape for every contest lifecycle mutation."""
        return {
            "contest_slug": contest.slug,
            "contest_title": contest.title,
            "status": contest.status,
            "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
            "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
            "change": change,
        }

    @staticmethod
    async def _publish_contest_event(
        event_type: str,
        contest_slug: str,
        data: Dict[str, Any],
    ) -> None:
        """Publish after commit without allowing realtime infrastructure to fail a mutation."""
        try:
            from app.services.event_broadcaster import broadcast_event

            await broadcast_event(event_type=event_type, data=data, contest_slug=contest_slug)
        except Exception as exc:
            logger.warning("Contest realtime event '%s' was not published: %s", event_type, exc)

    @staticmethod
    def _slugify(text: str) -> str:
        """Convert arbitrary text into a URL-safe slug."""
        text = text.lower().strip()
        slug = re.sub(r"[^\w\s-]", "", text)
        slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
        return slug or "contest"

    @staticmethod
    def _default_starter_codes(problem_title: str) -> Dict[str, str]:
        """Generate default starter code templates with problem-specific function name."""
        words = re.findall(r"[a-zA-Z0-9]+", problem_title)
        if words:
            first = words[0].lower()
            rest = "".join(w.capitalize() for w in words[1:])
            fn_name = first + rest
            if not fn_name[0].isalpha():
                fn_name = "solve" + fn_name
        else:
            fn_name = "solve"

        py_template = (
            f"# {problem_title}\n"
            "class Solution:\n"
            f"    def {fn_name}(self) -> int:\n"
            "        # Write your solution here\n"
            "        pass\n"
        )
        cpp_template = (
            f"// {problem_title}\n"
            "#include <iostream>\n"
            "#include <vector>\n"
            "#include <string>\n"
            "#include <algorithm>\n\n"
            "using namespace std;\n\n"
            "class Solution {\n"
            "public:\n"
            f"    int {fn_name}() {{\n"
            "        // Write your solution here\n"
            "        return 0;\n"
            "    }\n"
            "};\n"
        )
        js_template = (
            f"// {problem_title}\n"
            "/**\n"
            " * @return {number}\n"
            " */\n"
            f"var {fn_name} = function() {{\n"
            "    // Write your solution here\n"
            "};\n"
        )
        java_template = (
            f"// {problem_title}\n"
            "class Solution {\n"
            f"    public int {fn_name}() {{\n"
            "        // Write your solution here\n"
            "        return 0;\n"
            "    }\n"
            "}\n"
        )
        c_template = (
            f"// {problem_title}\n"
            "#include <stdio.h>\n"
            "#include <stdlib.h>\n\n"
            f"int {fn_name}() {{\n"
            "    // Write your solution here\n"
            "    return 0;\n"
            "}\n"
        )
        ts_template = (
            f"// {problem_title}\n"
            f"function {fn_name}(): number {{\n"
            "    // Write your solution here\n"
            "    return 0;\n"
            "}\n"
        )
        return {
            "python": py_template,
            "cpp": cpp_template,
            "c": c_template,
            "java": java_template,
            "javascript": js_template,
            "typescript": ts_template,
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
                "Schedule: Every Wednesday from 3:00 PM to 4:30 PM IST in the online arena.",
                "Format: 4 algorithmic problems ranging from Easy to Hard in a 90-minute live session.",
                "Open Access: All enrolled Medi-Caps University students are eligible to participate.",
                "Submissions: Evaluated via CodeBox automated sandbox with sub-millisecond precision.",
                "Leaderboard: Official university Elo ratings are updated on the global scoreboard following contest completion."
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

        assess_ends = assess_cfg.ends_at or (starts_at - timedelta(hours=2))
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

        await DynamicContestService._invalidate_contest_caches()

        logger.info("✓ Contest '%s' (%s) successfully created.", contest.title, contest.slug)

        await DynamicContestService._publish_contest_event(
            "contest_created",
            contest.slug,
            DynamicContestService._contest_event_data(contest, "created"),
        )

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

        await DynamicContestService._invalidate_contest_caches()
        await DynamicContestService._publish_contest_event(
            "contest_updated",
            contest.slug,
            DynamicContestService._contest_event_data(contest, "metadata_updated"),
        )

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
    async def get_admin_contest_detail(contest_slug: str, db: AsyncSession) -> Dict[str, Any]:
        """Fetch complete administrative dossier: contest metadata, assessment config, and both problem suites."""
        c_res = await db.execute(
            select(OfflineContest)
            .options(
                selectinload(OfflineContest.assessment),
                selectinload(OfflineContest.problems),
            )
            .where(OfflineContest.slug == contest_slug)
        )
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        # Contest Problems sorted by index
        cp_res = await db.execute(
            select(ContestProblem)
            .where(ContestProblem.contest_id == contest.id)
            .order_by(ContestProblem.problem_index.asc())
        )
        contest_problems = cp_res.scalars().all()

        # Assessment & Assessment Problems
        assessment_dict = None
        assessment_problems_list = []
        if contest.assessment:
            a = contest.assessment
            assessment_dict = {
                "id": a.id,
                "slug": a.slug,
                "title": a.title,
                "summary": a.summary,
                "duration_minutes": a.duration_minutes,
                "starts_at": a.starts_at.isoformat() if a.starts_at else None,
                "ends_at": a.ends_at.isoformat() if a.ends_at else None,
                "is_active": a.is_active,
                "max_violations": a.max_violations,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            ap_res = await db.execute(
                select(AssessmentProblem)
                .where(AssessmentProblem.assessment_id == a.id)
                .order_by(AssessmentProblem.problem_index.asc())
            )
            assessment_problems = ap_res.scalars().all()
            for ap in assessment_problems:
                assessment_problems_list.append({
                    "id": ap.id,
                    "assessment_id": ap.assessment_id,
                    "problem_index": ap.problem_index,
                    "title": ap.title,
                    "difficulty": ap.difficulty,
                    "points": ap.points,
                    "description": ap.description,
                    "input_format": ap.input_format,
                    "output_format": ap.output_format,
                    "constraints": ap.constraints,
                    "time_limit": ap.time_limit,
                    "memory_limit": ap.memory_limit,
                    "starter_codes": ap.starter_codes or {},
                    "sample_testcases": ap.sample_testcases or [],
                    "hidden_testcases": ap.hidden_testcases or [],
                })

        cp_list = []
        for cp in contest_problems:
            cp_list.append({
                "id": cp.id,
                "contest_id": cp.contest_id,
                "problem_index": cp.problem_index,
                "title": cp.title,
                "topic": cp.topic,
                "points": cp.points,
                "difficulty": cp.difficulty or "MEDIUM",
                "description": cp.description,
                "input_format": cp.input_format,
                "output_format": cp.output_format,
                "constraints": cp.constraints,
                "time_limit": cp.time_limit,
                "memory_limit": cp.memory_limit,
                "starter_codes": cp.starter_codes or {},
                "sample_testcases": cp.sample_testcases or [],
                "hidden_testcases": cp.hidden_testcases or [],
                "solved_count": cp.solved_count,
            })

        contest_dict = {
            "id": contest.id,
            "slug": contest.slug,
            "title": contest.title,
            "season": contest.season,
            "status": contest.status,
            "division": contest.division,
            "cadence": contest.cadence,
            "edition": contest.edition,
            "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
            "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
            "check_in_opens_at": contest.check_in_opens_at.isoformat() if contest.check_in_opens_at else None,
            "venue": contest.venue,
            "seat_capacity": contest.seat_capacity,
            "registered_count": contest.registered_count,
            "problem_count": len(cp_list),
            "environment": contest.environment,
            "chief_proctors": contest.chief_proctors or [],
            "prize_pool": contest.prize_pool,
            "sponsor": contest.sponsor,
            "summary": contest.summary,
            "rules": contest.rules or [],
            "banner_url": contest.banner_url,
            "created_at": contest.created_at.isoformat() if contest.created_at else None,
        }

        return {
            "contest": contest_dict,
            "assessment": assessment_dict,
            "contest_problems": cp_list,
            "assessment_problems": assessment_problems_list,
        }

    @staticmethod
    async def update_assessment(
        contest_slug: str,
        payload: AssessmentUpdateRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Update or initialize Phase 1 screening assessment linked to a contest."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()

        now = now_utc()
        if not assessment:
            starts_at = payload.starts_at or (contest.starts_at - timedelta(hours=24))
            ends_at = payload.ends_at or contest.starts_at
            assessment = Assessment(
                contest_id=contest.id,
                slug=f"{contest.slug}-assessment",
                title=payload.title or f"{contest.title} — Online Screening Round",
                summary=payload.summary or f"Phase 1 online qualification round for {contest.title}.",
                duration_minutes=payload.duration_minutes or 90,
                starts_at=starts_at,
                ends_at=ends_at,
                max_violations=payload.max_violations if payload.max_violations is not None else 3,
                is_active=payload.is_active if payload.is_active is not None else True,
                created_at=now,
            )
            db.add(assessment)
        else:
            if payload.title is not None:
                assessment.title = payload.title
            if payload.summary is not None:
                assessment.summary = payload.summary
            if payload.duration_minutes is not None:
                assessment.duration_minutes = payload.duration_minutes
            if payload.starts_at is not None:
                assessment.starts_at = payload.starts_at
            if payload.ends_at is not None:
                assessment.ends_at = payload.ends_at
            if payload.max_violations is not None:
                assessment.max_violations = payload.max_violations
            if payload.is_active is not None:
                assessment.is_active = payload.is_active

        await db.commit()
        await DynamicContestService._invalidate_contest_caches()
        await DynamicContestService._publish_contest_event(
            "contest_updated",
            contest.slug,
            DynamicContestService._contest_event_data(contest, "assessment_updated"),
        )

        return {
            "success": True,
            "message": "Screening assessment updated successfully.",
            "assessment_id": assessment.id,
            "slug": assessment.slug,
            "title": assessment.title,
            "duration_minutes": assessment.duration_minutes,
            "is_active": assessment.is_active,
        }

    @staticmethod
    async def add_or_update_problem(
        contest_slug: str,
        problem_data: ProblemCreateSchema,
        db: AsyncSession,
        target: str = "both",
    ) -> Dict[str, Any]:
        """Add a new problem or replace an existing problem by index (A-F) in arena, assessment, or both."""
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

        norm_target = (target or "both").strip().lower()

        # 1. Update/Create ContestProblem (if target is 'both' or 'contest')
        if norm_target in ("both", "contest"):
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

        # 2. Update/Create AssessmentProblem (if target is 'both' or 'assessment')
        if norm_target in ("both", "assessment"):
            if not assessment:
                # Automatically create assessment if not yet initialized
                starts_at = contest.starts_at - timedelta(hours=24)
                ends_at = contest.starts_at
                assessment = Assessment(
                    contest_id=contest.id,
                    slug=f"{contest.slug}-assessment",
                    title=f"{contest.title} — Online Screening Round",
                    summary=f"Phase 1 online qualification round for {contest.title}.",
                    duration_minutes=90,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    max_violations=3,
                    is_active=True,
                    created_at=now_utc(),
                )
                db.add(assessment)
                await db.flush()

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

        # Recount total problems in contest arena
        count_res = await db.execute(select(ContestProblem).where(ContestProblem.contest_id == contest.id))
        contest.problem_count = len(count_res.scalars().all())

        await db.commit()

        await DynamicContestService._invalidate_contest_caches()
        await DynamicContestService._publish_contest_event(
            "contest_updated",
            contest.slug,
            DynamicContestService._contest_event_data(contest, "problems_updated"),
        )

        return {
            "success": True,
            "message": f"Problem '{idx}' ({problem_data.title}) updated successfully for {contest_slug} (target: {norm_target}).",
            "problem_index": idx,
            "target": norm_target,
            "problem_count": contest.problem_count,
        }

    @staticmethod
    async def delete_problem(
        contest_slug: str,
        problem_index: str,
        db: AsyncSession,
        target: str = "both",
    ) -> Dict[str, Any]:
        """Delete a specific problem index from arena, assessment, or both."""
        idx = problem_index.strip().upper()
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        norm_target = (target or "both").strip().lower()

        # Delete ContestProblem
        if norm_target in ("both", "contest"):
            await db.execute(
                delete(ContestProblem).where(
                    ContestProblem.contest_id == contest.id,
                    ContestProblem.problem_index == idx,
                )
            )

        # Delete AssessmentProblem
        if norm_target in ("both", "assessment"):
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

        await DynamicContestService._invalidate_contest_caches()
        await DynamicContestService._publish_contest_event(
            "contest_updated",
            contest.slug,
            DynamicContestService._contest_event_data(contest, "problems_deleted"),
        )

        return {
            "success": True,
            "message": f"Problem '{idx}' removed from '{contest_slug}' (target: {norm_target}).",
            "target": norm_target,
            "remaining_problem_count": contest.problem_count,
        }

    @staticmethod
    async def sync_problems(
        contest_slug: str,
        direction: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Sync questions between Contest Arena and Screening Assessment."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{contest_slug}' not found.")

        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()
        if not assessment:
            # Create assessment automatically if missing
            starts_at = contest.starts_at - timedelta(hours=24)
            ends_at = contest.starts_at
            assessment = Assessment(
                contest_id=contest.id,
                slug=f"{contest.slug}-assessment",
                title=f"{contest.title} — Online Screening Round",
                summary=f"Phase 1 online qualification round for {contest.title}.",
                duration_minutes=90,
                starts_at=starts_at,
                ends_at=ends_at,
                max_violations=3,
                is_active=True,
                created_at=now_utc(),
            )
            db.add(assessment)
            await db.flush()

        direction = (direction or "contest_to_assessment").strip().lower()

        if direction == "contest_to_assessment":
            cps_res = await db.execute(select(ContestProblem).where(ContestProblem.contest_id == contest.id))
            cps = cps_res.scalars().all()
            for cp in cps:
                ap_res = await db.execute(
                    select(AssessmentProblem).where(
                        AssessmentProblem.assessment_id == assessment.id,
                        AssessmentProblem.problem_index == cp.problem_index,
                    )
                )
                ap = ap_res.scalars().first()
                if ap:
                    ap.title = cp.title
                    ap.difficulty = cp.difficulty or "MEDIUM"
                    ap.points = cp.points
                    ap.description = cp.description or ""
                    ap.input_format = cp.input_format
                    ap.output_format = cp.output_format
                    ap.constraints = cp.constraints
                    ap.time_limit = cp.time_limit
                    ap.memory_limit = cp.memory_limit
                    ap.starter_codes = cp.starter_codes or {}
                    ap.sample_testcases = cp.sample_testcases or []
                    ap.hidden_testcases = cp.hidden_testcases or []
                else:
                    ap = AssessmentProblem(
                        assessment_id=assessment.id,
                        problem_index=cp.problem_index,
                        title=cp.title,
                        difficulty=cp.difficulty or "MEDIUM",
                        description=cp.description or "",
                        input_format=cp.input_format,
                        output_format=cp.output_format,
                        constraints=cp.constraints,
                        points=cp.points,
                        time_limit=cp.time_limit,
                        memory_limit=cp.memory_limit,
                        starter_codes=cp.starter_codes or {},
                        sample_testcases=cp.sample_testcases or [],
                        hidden_testcases=cp.hidden_testcases or [],
                        created_at=now_utc(),
                    )
                    db.add(ap)

        elif direction == "assessment_to_contest":
            aps_res = await db.execute(select(AssessmentProblem).where(AssessmentProblem.assessment_id == assessment.id))
            aps = aps_res.scalars().all()
            for ap in aps:
                cp_res = await db.execute(
                    select(ContestProblem).where(
                        ContestProblem.contest_id == contest.id,
                        ContestProblem.problem_index == ap.problem_index,
                    )
                )
                cp = cp_res.scalars().first()
                if cp:
                    cp.title = ap.title
                    cp.difficulty = ap.difficulty
                    cp.points = ap.points
                    cp.description = ap.description
                    cp.input_format = ap.input_format
                    cp.output_format = ap.output_format
                    cp.constraints = ap.constraints
                    cp.time_limit = ap.time_limit
                    cp.memory_limit = ap.memory_limit
                    cp.starter_codes = ap.starter_codes or {}
                    cp.sample_testcases = ap.sample_testcases or []
                    cp.hidden_testcases = ap.hidden_testcases or []
                else:
                    cp = ContestProblem(
                        contest_id=contest.id,
                        problem_index=ap.problem_index,
                        title=ap.title,
                        topic="Algorithms",
                        points=ap.points,
                        solved_count=0,
                        difficulty=ap.difficulty,
                        description=ap.description,
                        input_format=ap.input_format,
                        output_format=ap.output_format,
                        constraints=ap.constraints,
                        time_limit=ap.time_limit,
                        memory_limit=ap.memory_limit,
                        starter_codes=ap.starter_codes or {},
                        sample_testcases=ap.sample_testcases or [],
                        hidden_testcases=ap.hidden_testcases or [],
                    )
                    db.add(cp)

            await db.flush()
            count_res = await db.execute(select(ContestProblem).where(ContestProblem.contest_id == contest.id))
            contest.problem_count = len(count_res.scalars().all())
        else:
            raise HTTPException(status_code=400, detail=f"Invalid sync direction '{direction}'.")

        await db.commit()
        await DynamicContestService._invalidate_contest_caches()
        await DynamicContestService._publish_contest_event(
            "contest_updated",
            contest.slug,
            DynamicContestService._contest_event_data(contest, "problems_synced"),
        )

        return {
            "success": True,
            "message": f"Problems synchronized successfully ({direction}).",
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
        When transitioning to 'finished', computes and applies rating deltas to all participants.
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

        # When going LIVE: ensure starts_at and ends_at reflect actual live window.
        # If admin forces the contest live before the scheduled start, recalculate
        # starts_at = now, ends_at = now + original_duration (preserving contest length).
        if cleaned_status == "live":
            now_ts = now_utc()
            current_starts = contest.starts_at
            if current_starts and current_starts.tzinfo is None:
                current_starts = current_starts.replace(tzinfo=timezone.utc)

            current_ends = contest.ends_at
            if current_ends and current_ends.tzinfo is None:
                current_ends = current_ends.replace(tzinfo=timezone.utc)

            # Compute original contest duration (fallback: 90 minutes)
            if current_starts and current_ends and current_ends > current_starts:
                original_duration = current_ends - current_starts
            else:
                original_duration = timedelta(minutes=90)

            # Only reschedule if contest hasn't started yet (admin early-trigger)
            if not current_starts or current_starts > now_ts:
                contest.starts_at = now_ts
                contest.ends_at = now_ts + original_duration
                logger.info(
                    "Contest '%s' early-triggered live. Rescheduled: starts_at=%s ends_at=%s",
                    contest.slug,
                    contest.starts_at.isoformat(),
                    contest.ends_at.isoformat(),
                )

        qualify_summary = None
        if cleaned_status == "live" and auto_qualify_top_30:
            try:
                qualify_summary = await AssessmentService.evaluate_and_qualify_top_30(contest_slug, db)
            except Exception as e:
                logger.warning("Auto qualify Top 30 notice: %s", e)

        rating_summary = None
        if cleaned_status == "finished":
            try:
                rating_summary = await DynamicContestService._apply_final_ratings(contest, db)
            except Exception as e:
                logger.warning("Rating application notice: %s", e)

        await db.commit()

        await DynamicContestService._invalidate_contest_caches(
            include_rating_caches=cleaned_status == "finished"
        )
        status_event_data = DynamicContestService._contest_event_data(contest, "status_changed")
        status_event_data.update({"old_status": old_status, "new_status": cleaned_status})
        await DynamicContestService._publish_contest_event(
            "contest_status_changed", contest.slug, status_event_data
        )

        if cleaned_status == "finished":
            concluded_event_data = DynamicContestService._contest_event_data(contest, "concluded")
            concluded_event_data.update({
                "old_status": old_status,
                "new_status": "finished",
                "status": "finished",
                "rating_summary": rating_summary,
            })
            await DynamicContestService._publish_contest_event(
                "contest_concluded", contest.slug, concluded_event_data
            )
            # Also publish global stream event so all platform pages react
            try:
                from app.services.event_broadcaster import broadcast_event
                await broadcast_event(
                    event_type="contest_concluded",
                    data=concluded_event_data,
                    contest_slug=None,
                )
            except Exception:
                pass

        return {
            "success": True,
            "contest_slug": contest.slug,
            "title": contest.title,
            "previous_status": old_status,
            "current_status": cleaned_status,
            "top_30_qualification": qualify_summary,
            "rating_summary": rating_summary,
        }

    @staticmethod
    async def _apply_final_ratings(contest: OfflineContest, db: AsyncSession) -> Dict[str, Any]:
        """
        Re-rank ScoreboardEntry rows, compute ELO rating deltas, apply to
        MemberProfile.rating + peak_rating, and write RatingHistory entries.
        Called both from change_contest_status("finished") and the background auto-finish task.
        """
        from app.models.db_models import MemberProfile, RatingHistory, ScoreboardEntry
        from app.services.rating_service import calculate_rating_deltas
        from datetime import timezone

        ends_at = contest.ends_at
        if ends_at and ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        finalized_at = ends_at or now_utc()

        # Fetch & re-rank scoreboard
        sb_res = await db.execute(
            select(ScoreboardEntry)
            .where(ScoreboardEntry.contest_id == contest.id)
            .order_by(ScoreboardEntry.score.desc(), ScoreboardEntry.penalty_seconds.asc())
        )
        entries = sb_res.scalars().all()

        if not entries:
            return {"rated_count": 0, "message": "No scoreboard entries to rate."}

        for new_rank, entry in enumerate(entries, start=1):
            entry.rank = new_rank

        # Build standings for rating calculation
        standings = []
        member_map: Dict[str, Any] = {}
        for entry in entries:
            m_res = await db.execute(select(MemberProfile).where(MemberProfile.id == entry.member_id))
            member = m_res.scalars().first()
            if member:
                standings.append({
                    "rank": entry.rank,
                    "handle": entry.handle,
                    "member_id": entry.member_id,
                    "rating": member.rating if member.rating is not None else 1200,
                })
                member_map[entry.handle] = member

        # Compute deltas
        deltas = calculate_rating_deltas(standings)
        delta_map = {handle: (delta, new_rating) for handle, delta, new_rating in deltas}

        rated = 0
        for entry in entries:
            if entry.handle not in delta_map:
                continue
            delta, new_rating = delta_map[entry.handle]
            entry.rating_delta = delta
            member = member_map.get(entry.handle)
            if not member:
                continue
            old_rating = member.rating if member.rating is not None else 1200
            member.rating = new_rating
            if member.peak_rating is None or new_rating > member.peak_rating:
                member.peak_rating = new_rating
            db.add(RatingHistory(
                member_id=member.id,
                contest_id=contest.id,
                contest_title=contest.title,
                contested_at=finalized_at,
                old_rating=old_rating,
                new_rating=new_rating,
                rank=entry.rank,
            ))
            rated += 1

        return {"rated_count": rated, "message": f"Ratings applied for {rated} participant(s)."}

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
        deleted_event_data = DynamicContestService._contest_event_data(contest, "deleted")

        # Campus Passes Cascade
        await db.execute(delete(CampusPass).where(CampusPass.contest_id == contest.id))

        # Contest Arena Submissions & Scoreboards Cascade
        await db.execute(delete(ContestSubmission).where(ContestSubmission.contest_id == contest.id))
        await db.execute(delete(ScoreboardEntry).where(ScoreboardEntry.contest_id == contest.id))
        await db.execute(delete(ContestRegistration).where(ContestRegistration.contest_id == contest.id))
        await db.execute(delete(ContestProblem).where(ContestProblem.contest_id == contest.id))

        # Assessment Cascade
        a_res = await db.execute(select(Assessment).where(Assessment.contest_id == contest.id))
        assessment = a_res.scalars().first()
        if assessment:
            sess_ids = (await db.execute(select(AssessmentSession.id).where(AssessmentSession.assessment_id == assessment.id))).scalars().all()
            if sess_ids:
                await db.execute(delete(AssessmentSubmission).where(AssessmentSubmission.session_id.in_(sess_ids)))
                await db.execute(delete(AssessmentSession).where(AssessmentSession.assessment_id == assessment.id))
            await db.execute(delete(AssessmentProblem).where(AssessmentProblem.assessment_id == assessment.id))
            await db.delete(assessment)

        await db.delete(contest)
        await db.commit()

        await DynamicContestService._invalidate_contest_caches()
        await DynamicContestService._publish_contest_event(
            "contest_deleted", contest_slug, deleted_event_data
        )

        return {
            "success": True,
            "message": f"Contest '{contest_title}' ({contest_slug}) and associated records deleted permanently.",
        }

    @staticmethod
    async def launch_preset(
        preset_req: PresetContestLaunchRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        cadence = preset_req.cadence.lower().strip()
        edition = preset_req.edition

        if cadence == "weekly":
            from app.services.contest_schedule_service import get_next_wednesday_schedule
            w_start, w_end, _, _, _ = get_next_wednesday_schedule()
            starts_at = w_start
            ends_at = w_end
        else:
            now = now_utc()
            starts_at = now + timedelta(hours=preset_req.starts_in_hours)
            ends_at = starts_at + timedelta(hours=2)

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
            summary = f"Wednesday algorithmic showdown for Medi-Caps cadets. Weekly #{edition} featuring 4 algorithmic challenges testing graph theory, dynamic programming, and greedy heuristics."
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
            chief_proctors=["Chief Proctor (CCC Core)", "CCC Operations Desk"],
            prize_pool=prize,
            sponsor="Chaos Computer Club Medi-Caps Chapter",
            summary=summary,
            problems=problems,
            assessment=AssessmentConfigSchema(
                auto_unlock_now=preset_req.auto_unlock_screening,
            ),
        )

        return await DynamicContestService.create_contest(create_req, db)
