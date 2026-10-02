"""
Medi-Caps Competitive Programming Platform — Normal Student & Run-Code Heavy User Personas
Simulates realistic student browsing, thinking pauses, code trials, submissions, and scoreboard checks.
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path
from locust import HttpUser, task, between, events

from tests.load.clients.api_client import StudentApiClient
from tests.load.config.settings import settings
from tests.load.utilities.credentials import user_pool, VirtualStudentAccount
from tests.load.workflows.auth import login_student, logout_student, get_current_user_profile
from tests.load.workflows.dashboard import load_student_dashboard
from tests.load.workflows.contest import fetch_contests_list, fetch_contest_details, ensure_contest_registration
from tests.load.workflows.problem import fetch_arena_workspace
from tests.load.workflows.run_code import execute_sample_run
from tests.load.workflows.submission import submit_contest_solution, poll_submission_status
from tests.load.workflows.leaderboard import fetch_contest_scoreboard, fetch_university_leaderboard

logger = logging.getLogger("ccc.loadtest.student")

# Load template submission fixtures
DATA_DIR = Path(__file__).parent.parent / "data"
try:
    with open(DATA_DIR / "submissions.json", "r") as f:
        SUBMISSION_TEMPLATES = json.load(f)
except Exception:
    SUBMISSION_TEMPLATES = {
        "python": {
            "correct": "import sys\nlines = sys.stdin.read().split()\nprint(sum(int(x) for x in lines) if lines else 0)\n",
            "wrong_answer": "print(42)\n",
        }
    }


class NormalStudentUser(HttpUser):
    """
    Standard student cadet persona (Weight: 60%).
    Realistic pacing:
    Login -> Dashboard -> Select Contest -> Arena -> Think -> Run Code -> Submit -> Scoreboard.
    """
    weight = 60
    wait_time = between(2.0, 5.0)

    def on_start(self) -> None:
        self.account = user_pool.checkout()
        self.api = StudentApiClient(self.client, self.account)
        self.contest_slug = settings.LOAD_TEST_CONTEST_SLUG
        self.arena_problems: list = []

        try:
            if self.account.access_token:
                self.api.set_token(self.account.access_token)
            else:
                login_student(self.api)
            load_student_dashboard(self.api)
        except Exception as exc:
            logger.warning("Student %s login failed: %s", self.account.username, exc)

    def on_stop(self) -> None:
        try:
            logout_student(self.api)
        except Exception:
            pass
        finally:
            user_pool.checkin(self.account)

    @task(3)
    def view_dashboard_and_contests(self) -> None:
        """Browse contest listings, leaderboard standings, and cadet profiles."""
        try:
            contests = fetch_contests_list(self.api)
            if contests and isinstance(contests, list) and not self.contest_slug:
                self.contest_slug = contests[0].get("slug", "weekly-contest-01")

            fetch_university_leaderboard(self.api)
            cadets = ["samaksh", "sanskar", "salaj", "sj95", "santush01"]
            self.api.get(
                path=f"/api/auth/profile/{random.choice(cadets)}",
                name="/api/auth/profile/{handle}",
                workflow="dashboard",
                expected_status=[200],
            )
        except Exception as exc:
            logger.debug("view_dashboard error: %s", exc)

    @task(5)
    def participate_in_contest(self) -> None:
        """Enter arena workspace, inspect problem, think, and execute."""
        slug = self.contest_slug
        if not slug:
            return

        try:
            contests = fetch_contests_list(self.api)
            has_contest = any(c.get("slug") == slug for c in contests) if isinstance(contests, list) else False
            if not has_contest:
                # Fallback to inspecting personal profile and ladder standings
                self.api.get("/api/auth/me", name="/api/auth/me", workflow="dashboard", expected_status=[200])
                fetch_university_leaderboard(self.api)
                return

            ensure_contest_registration(self.api, slug)
            arena = fetch_arena_workspace(self.api, slug)
            problems = arena.get("problems", [])
            if not problems:
                return

            self.arena_problems = problems
            problem = random.choice(problems)
            problem_id = str(problem.get("id") or problem.get("problem_id"))
            p_idx = str(problem.get("problem_index") or "A")

            # 30% chance of executing Run Code before formal submit
            if random.random() < 0.3:
                lang = "python"
                code = SUBMISSION_TEMPLATES.get(p_idx, {}).get("correct", "print(0)\n")
                execute_sample_run(self.api, slug, problem_id, lang, code)

            # Submit solution (90% correct solution, 10% wrong answer)
            lang = "python"
            is_correct = random.random() < 0.9
            sub_type = "correct" if is_correct else "wrong_answer"
            code = SUBMISSION_TEMPLATES.get(p_idx, {}).get(sub_type, "print(0)\n")

            # Check for idempotency test (2% of requests)
            is_idempotency_retry = random.random() < settings.IDEMPOTENCY_TEST_RATE
            res = submit_contest_solution(
                self.api, slug, problem_id, lang, code,
                async_mode=False, is_idempotency_retry=is_idempotency_retry,
            )

            # If duplicate retry simulation, trigger identical submit immediately
            if is_idempotency_retry:
                submit_contest_solution(
                    self.api, slug, problem_id, lang, code,
                    async_mode=False, is_idempotency_retry=True,
                )

            # Inspect scoreboard after submit
            fetch_contest_scoreboard(self.api, slug)

        except Exception as exc:
            logger.debug("Contest participation task error: %s", exc)


class RunCodeHeavyUser(HttpUser):
    """
    Run-Code Heavy Student persona (Weight: 10%).
    Repeatedly compiles and executes code against sample testcases in live arena.
    Specifically tests Codebox admission control and isolation from judge queues.
    """
    weight = 10
    wait_time = between(1.0, 3.0)

    def on_start(self) -> None:
        self.account = user_pool.checkout()
        self.api = StudentApiClient(self.client, self.account)
        self.contest_slug = settings.LOAD_TEST_CONTEST_SLUG
        self.problem_ids: list[str] = []
        self.problem_map: dict[str, str] = {}

        try:
            if self.account.access_token:
                self.api.set_token(self.account.access_token)
            else:
                login_student(self.api)
            if self.contest_slug:
                contests = fetch_contests_list(self.api)
                if any(c.get("slug") == self.contest_slug for c in contests) if isinstance(contests, list) else False:
                    ensure_contest_registration(self.api, self.contest_slug)
                    arena = fetch_arena_workspace(self.api, self.contest_slug)
                    for p in arena.get("problems", []):
                        pid = str(p.get("id") or p.get("problem_id"))
                        idx = str(p.get("problem_index") or "A")
                        self.problem_ids.append(pid)
                        self.problem_map[idx] = pid
        except Exception as exc:
            logger.warning("RunCodeHeavyUser %s login failed: %s", self.account.username, exc)

    def on_stop(self) -> None:
        try:
            logout_student(self.api)
        except Exception:
            pass
        finally:
            user_pool.checkin(self.account)

    @task
    def execute_frequent_runs(self) -> None:
        """Hammer Run Code with varied languages and custom stdin, or probe telemetry."""
        slug = self.contest_slug
        if self.problem_ids:
            p_idx = random.choice(list(self.problem_map.keys())) if self.problem_map else "A"
            problem_id = self.problem_map.get(p_idx, self.problem_ids[0])
            lang = "python"
            sub_type = random.choice(["correct", "wrong_answer", "compile_error"])
            code = SUBMISSION_TEMPLATES.get(p_idx, {}).get(sub_type, "print(1)")

            try:
                execute_sample_run(
                    self.api,
                    slug=slug,
                    problem_id=problem_id,
                    language=lang,
                    code=code,
                    custom_stdin="10 20 30",
                )
            except Exception as exc:
                logger.debug("Frequent run execution error: %s", exc)
        else:
            try:
                self.api.get("/api/health", name="/api/health", workflow="run_code", expected_status=[200])
                self.api.get("/api/v1/meta", name="/api/v1/meta", workflow="run_code", expected_status=[200])
            except Exception as exc:
                logger.debug("RunCodeHeavyUser telemetry error: %s", exc)

