"""
Medi-Caps Competitive Programming Platform — Active Contestant User Persona
Simulates aggressive competitive programmers submitting multiple problems and watching rankings.
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path
from locust import HttpUser, task, between

from tests.load.clients.api_client import StudentApiClient
from tests.load.config.settings import settings
from tests.load.utilities.credentials import user_pool
from tests.load.workflows.auth import login_student, logout_student
from tests.load.workflows.contest import fetch_contests_list, ensure_contest_registration, check_in_contest
from tests.load.workflows.problem import fetch_arena_workspace
from tests.load.workflows.run_code import execute_sample_run
from tests.load.workflows.submission import submit_contest_solution, poll_submission_status
from tests.load.workflows.leaderboard import fetch_contest_scoreboard, fetch_university_leaderboard

logger = logging.getLogger("ccc.loadtest.contestant")

DATA_DIR = Path(__file__).parent.parent / "data"
try:
    with open(DATA_DIR / "submissions.json", "r") as f:
        SUBMISSION_TEMPLATES = json.load(f)
except Exception:
    SUBMISSION_TEMPLATES = {}


class ActiveContestantUser(HttpUser):
    """
    Competitive Cadet Persona (Weight: 25%).
    Fast iterative loops:
    Join -> Enter Arena -> Rapid Code Trial -> Multiple Submissions -> Check Standings.
    """
    weight = 25
    wait_time = between(1.5, 3.5)

    def on_start(self) -> None:
        self.account = user_pool.checkout()
        self.api = StudentApiClient(self.client, self.account)
        self.contest_slug = settings.LOAD_TEST_CONTEST_SLUG
        self.problem_ids: list[str] = []

        try:
            if self.account.access_token:
                self.api.set_token(self.account.access_token)
            else:
                login_student(self.api)

            contests = fetch_contests_list(self.api)
            if contests and isinstance(contests, list):
                slug = contests[0].get("slug", self.contest_slug)
                self.contest_slug = slug
                ensure_contest_registration(self.api, self.contest_slug)
                check_in_contest(self.api, self.contest_slug)

                arena = fetch_arena_workspace(self.api, self.contest_slug)
                raw_problems = arena.get("problems", [])
                self.problem_map: dict[str, str] = {}
                for p in raw_problems:
                    pid = p.get("id") or p.get("problem_id")
                    idx = p.get("problem_index") or "A"
                    if pid:
                        self.problem_ids.append(str(pid))
                        self.problem_map[idx] = str(pid)
        except Exception as exc:
            logger.warning("ActiveContestant %s on_start failed: %s", self.account.username, exc)

    def on_stop(self) -> None:
        try:
            logout_student(self.api)
        except Exception:
            pass
        finally:
            user_pool.checkin(self.account)

    @task(4)
    def solve_problem_cycle(self) -> None:
        """Pick a problem, run sample test cases, submit, and inspect standings."""
        slug = self.contest_slug
        if self.problem_ids:
            # Pick a problem index (A, B, C, or D)
            p_idx = random.choice(list(self.problem_map.keys())) if hasattr(self, "problem_map") and self.problem_map else "A"
            problem_id = self.problem_map.get(p_idx, random.choice(self.problem_ids))
            lang = "python"

            # 1. Run sample test
            prob_templates = SUBMISSION_TEMPLATES.get(p_idx, {})
            code_ac = prob_templates.get("correct") or "print(0)\n"
            try:
                execute_sample_run(self.api, slug, problem_id, lang, code_ac)
            except Exception as exc:
                logger.debug("ActiveContestant sample run error: %s", exc)

            # 2. Submit solution
            async_mode = random.random() < 0.2
            try:
                sub_res = submit_contest_solution(
                    self.api,
                    slug=slug,
                    problem_id=problem_id,
                    language=lang,
                    code=code_ac,
                    async_mode=async_mode,
                )

                # If async mode was requested, poll for final result
                if async_mode and sub_res.get("status") == "queued":
                    poll_submission_status(self.api, slug, problem_id, max_timeout_seconds=10.0)

                # 3. Check scoreboard ranking update
                fetch_contest_scoreboard(self.api, slug)

            except Exception as exc:
                logger.debug("ActiveContestant solve cycle error: %s", exc)
        else:
            # Fallback when no active contest in DB: inspect leaderboard and competitive profiles
            try:
                fetch_university_leaderboard(self.api)
                cadets = ["samaksh", "sanskar", "salaj", "sj95", "santush01"]
                self.api.get(
                    path=f"/api/auth/profile/{random.choice(cadets)}",
                    name="/api/auth/profile/{handle}",
                    workflow="leaderboard",
                    expected_status=[200],
                )
            except Exception as exc:
                logger.debug("ActiveContestant leaderboard cycle error: %s", exc)

