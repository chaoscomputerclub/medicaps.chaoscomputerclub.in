"""
Medi-Caps Competitive Programming Platform — Reconnecting Student User Persona
Simulates students with unstable Wi-Fi connections:
Subscribes to SSE -> Submits -> Drops Connection -> Reconnects via Last-Event-ID -> Verifies Convergence.
"""

from __future__ import annotations

import logging
import time
from locust import HttpUser, task, between

from tests.load.clients.api_client import StudentApiClient
from tests.load.config.settings import settings
from tests.load.utilities.credentials import user_pool
from tests.load.workflows.auth import login_student, logout_student
from tests.load.workflows.contest import fetch_contests_list, ensure_contest_registration
from tests.load.workflows.submission import submit_contest_solution
from tests.load.workflows.realtime import test_sse_stream_connection
from tests.load.workflows.leaderboard import fetch_contest_scoreboard, fetch_university_leaderboard

logger = logging.getLogger("ccc.loadtest.reconnecting")


class ReconnectingStudentUser(HttpUser):
    """
    Wi-Fi Intermittent Student Persona (Weight: 5%).
    Tests real-time pub/sub resilience, SSE replay buffer recovery, and state convergence.
    """
    weight = 5
    wait_time = between(3.0, 7.0)

    def on_start(self) -> None:
        self.account = user_pool.checkout()
        self.api = StudentApiClient(self.client, self.account)
        self.contest_slug = settings.LOAD_TEST_CONTEST_SLUG
        self.last_event_id: int | None = None
        self.has_contest = False

        try:
            if self.account.access_token:
                self.api.set_token(self.account.access_token)
            else:
                login_student(self.api)

            contests = fetch_contests_list(self.api)
            if contests and isinstance(contests, list):
                self.has_contest = True
                self.contest_slug = contests[0].get("slug", self.contest_slug)
                ensure_contest_registration(self.api, self.contest_slug)
                
                from tests.load.workflows.problem import fetch_arena_workspace
                arena = fetch_arena_workspace(self.api, self.contest_slug)
                raw_problems = arena.get("problems", [])
                self.problem_ids: list[str] = [
                    str(p.get("id") or p.get("problem_id")) for p in raw_problems if (p.get("id") or p.get("problem_id"))
                ]
        except Exception as exc:
            logger.warning("ReconnectingStudent %s on_start failed: %s", self.account.username, exc)

    def on_stop(self) -> None:
        try:
            logout_student(self.api)
        except Exception:
            pass
        finally:
            user_pool.checkin(self.account)

    @task
    def execute_reconnect_lifecycle(self) -> None:
        """
        1. Listen to SSE briefly
        2. Disconnect for network gap
        3. Reconnect with Last-Event-ID
        4. Verify state convergence
        """
        slug = self.contest_slug if self.has_contest else None
        base_url = self.host or settings.LOAD_TEST_BASE_URL
        token = self.account.access_token

        # Step 1: Initial SSE connect & listen
        res_initial = test_sse_stream_connection(
            base_url=base_url,
            token=token,
            slug=slug,
            listen_seconds=2.0,
            last_event_id=self.last_event_id,
        )
        if res_initial.get("highest_event_id"):
            self.last_event_id = res_initial["highest_event_id"]

        # Step 2: If contest is live, submit code
        if self.has_contest and slug and getattr(self, "problem_ids", None):
            try:
                import random
                pid = random.choice(self.problem_ids)
                submit_contest_solution(
                    self.api,
                    slug=slug,
                    problem_id=pid,
                    language="python",
                    code="print('reconnecting')\n",
                    async_mode=False,
                )
            except Exception as exc:
                logger.debug("ReconnectingStudent submit error: %s", exc)

        # Step 3: Simulate intermittent network drop
        time.sleep(settings.RECONNECT_DELAY_SECONDS)

        # Step 4: Reconnect SSE with Last-Event-ID
        res_reconnect = test_sse_stream_connection(
            base_url=base_url,
            token=token,
            slug=slug,
            listen_seconds=3.0,
            last_event_id=self.last_event_id,
        )
        if res_reconnect.get("highest_event_id"):
            self.last_event_id = res_reconnect["highest_event_id"]

        # Step 5: Authoritative state reconciliation via REST
        if self.has_contest and slug:
            fetch_contest_scoreboard(self.api, slug)
        else:
            fetch_university_leaderboard(self.api)

