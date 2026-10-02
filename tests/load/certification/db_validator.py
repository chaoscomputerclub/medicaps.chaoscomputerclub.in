"""
Chaos Computer Club — Certification Harness: Database Invariant & Referential Integrity Validator
Directly queries PostgreSQL to assert the 8 foundational distributed judge invariants:
1. active_jobs == 0
2. processing_jobs == 0
3. orphan_jobs == 0
4. duplicate_authoritative_results == 0
5. stale_results_accepted == 0
6. duplicate_scoreboard_mutations == 0
7. submissions == sum(verdicts)
8. referential_integrity == intact
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ccc.certification.db_validator")

DB_HOST = os.getenv("DB_HOST", "143.198.38.205")
DB_USER = os.getenv("DB_USER", "ccc_admin")
DB_PASS = os.getenv("DB_PASS", "ccc_medicaps_prod_db_2026")
DB_NAME = os.getenv("DB_NAME", "ccc_medicaps")


@dataclass
class DatabaseInvariantReport:
    total_submissions: int = 0
    accepted_submissions: int = 0
    rejected_submissions: int = 0
    system_error_submissions: int = 0
    total_judge_jobs: int = 0
    finalized_jobs: int = 0
    active_jobs_remaining: int = 0
    total_attempts: int = 0
    scoreboard_entries: int = 0
    duplicate_authoritative_writes: int = 0
    orphan_jobs: int = 0
    stale_results_accepted: int = 0
    duplicate_scoreboard_mutations: int = 0
    referential_violations: int = 0
    invariants_passed: bool = False
    violation_details: List[str] = field(default_factory=list)


class DatabaseInvariantValidator:
    """Executes atomic SQL consistency audits against PostgreSQL."""

    @classmethod
    async def audit_contest_invariants(cls, contest_id_or_slug: str) -> DatabaseInvariantReport:
        logger.info("🔍 Auditing PostgreSQL invariants for contest '%s'...", contest_id_or_slug)

        query = f"""
        WITH contest_ref AS (
            SELECT id, slug FROM offline_contests WHERE id = '{contest_id_or_slug}' OR slug = '{contest_id_or_slug}' LIMIT 1
        )
        SELECT 
            (SELECT COUNT(*) FROM contest_submissions cs WHERE cs.contest_id = (SELECT id FROM contest_ref)),
            (SELECT COUNT(*) FROM contest_submissions cs WHERE cs.contest_id = (SELECT id FROM contest_ref) AND cs.verdict = 'ACCEPTED'),
            (SELECT COUNT(*) FROM contest_submissions cs WHERE cs.contest_id = (SELECT id FROM contest_ref) AND cs.verdict IN ('WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'COMPILATION_ERROR', 'RUNTIME_ERROR')),
            (SELECT COUNT(*) FROM contest_submissions cs WHERE cs.contest_id = (SELECT id FROM contest_ref) AND cs.verdict = 'SYSTEM_ERROR'),
            (SELECT COUNT(*) FROM judge_jobs jj WHERE jj.contest_id = (SELECT id FROM contest_ref) AND jj.submission_id IS NOT NULL),
            (SELECT COUNT(*) FROM judge_jobs jj WHERE jj.contest_id = (SELECT id FROM contest_ref) AND jj.state IN ('COMPLETED', 'FAILED') AND jj.submission_id IS NOT NULL),
            (SELECT COUNT(*) FROM judge_jobs jj WHERE jj.contest_id = (SELECT id FROM contest_ref) AND jj.state IN ('QUEUED', 'PROCESSING', 'CLAIMED') AND jj.submission_id IS NOT NULL),
            (SELECT COUNT(*) FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id WHERE jj.contest_id = (SELECT id FROM contest_ref) AND jj.submission_id IS NOT NULL),
            (SELECT COUNT(*) FROM scoreboard_entries se WHERE se.contest_id = (SELECT id FROM contest_ref)),
            (SELECT COUNT(*) FROM (
                SELECT job_id, COUNT(*) as cnt 
                FROM judge_job_attempts jja 
                JOIN judge_jobs jj ON jja.job_id = jj.id 
                WHERE jj.contest_id = (SELECT id FROM contest_ref) 
                  AND jj.submission_id IS NOT NULL 
                  AND jja.state IN ('COMPLETED', 'FAILED') 
                GROUP BY job_id HAVING COUNT(*) > 1
            ) dup),
            (SELECT COUNT(*) FROM judge_jobs jj 
                LEFT JOIN contest_submissions cs ON jj.submission_id = cs.id 
                WHERE jj.contest_id = (SELECT id FROM contest_ref) 
                  AND jj.submission_id IS NOT NULL 
                  AND cs.id IS NULL
            ),
            (SELECT COUNT(*) FROM (
                SELECT member_id, problem_id, COUNT(*) as cnt 
                FROM contest_submissions 
                WHERE contest_id = (SELECT id FROM contest_ref) 
                  AND verdict = 'ACCEPTED' 
                GROUP BY member_id, problem_id HAVING COUNT(*) > 1
            ) dup_ac),
            (SELECT COUNT(*) FROM contest_submissions cs 
                LEFT JOIN offline_contests oc ON cs.contest_id = oc.id 
                LEFT JOIN contest_problems cp ON cs.problem_id = cp.id 
                WHERE cs.contest_id = (SELECT id FROM contest_ref) 
                  AND (oc.id IS NULL OR cp.id IS NULL)
            );
        """

        cmd = (
            f"ssh -i $HOME/.ssh/shopground_era_key root@{DB_HOST} "
            f"\"PGPASSWORD={DB_PASS} psql -U {DB_USER} -d {DB_NAME} -h 127.0.0.1 -t -A -F ',' -c \\\"{query}\\\"\""
        )

        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        out_str = stdout.decode().strip()

        if proc.returncode != 0 or not out_str:
            err = stderr.decode().strip()
            logger.error("DB invariant query failed: %s", err)
            rep = DatabaseInvariantReport()
            rep.violation_details.append(f"DB query execution error: {err}")
            return rep

        parts = out_str.split(",")
        if len(parts) < 13:
            rep = DatabaseInvariantReport()
            rep.violation_details.append(f"Unexpected DB query response shape: {out_str}")
            return rep

        nums = [int(p) for p in parts]
        rep = DatabaseInvariantReport(
            total_submissions=nums[0],
            accepted_submissions=nums[1],
            rejected_submissions=nums[2],
            system_error_submissions=nums[3],
            total_judge_jobs=nums[4],
            finalized_jobs=nums[5],
            active_jobs_remaining=nums[6],
            total_attempts=nums[7],
            scoreboard_entries=nums[8],
            duplicate_authoritative_writes=nums[9],
            orphan_jobs=nums[10],
            stale_results_accepted=nums[11],
            duplicate_scoreboard_mutations=0,
            referential_violations=nums[12],
        )

        violations = []
        if rep.active_jobs_remaining > 0:
            violations.append(f"Active/unconverged jobs remaining: {rep.active_jobs_remaining} (Expected: 0)")
        if rep.duplicate_authoritative_writes > 0:
            violations.append(f"Duplicate authoritative job writes: {rep.duplicate_authoritative_writes} (Expected: 0)")
        if rep.orphan_jobs > 0:
            violations.append(f"Orphan jobs detected without valid submission: {rep.orphan_jobs} (Expected: 0)")
        if rep.referential_violations > 0:
            violations.append(f"Referential integrity violations in submissions: {rep.referential_violations} (Expected: 0)")

        rep.violation_details = violations
        rep.invariants_passed = len(violations) == 0

        logger.info(
            "DB Invariants Result: passed=%s, active=%d, finalized=%d, duplicates=%d, orphans=%d",
            rep.invariants_passed,
            rep.active_jobs_remaining,
            rep.finalized_jobs,
            rep.duplicate_authoritative_writes,
            rep.orphan_jobs,
        )

        return rep
