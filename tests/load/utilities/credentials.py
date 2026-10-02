"""
Medi-Caps Competitive Programming Platform — User Pool & Credential Manager
Thread-safe checkout and deterministic provisioning of virtual student accounts.
Ensures zero token sharing or session contamination across concurrent users.
"""

from __future__ import annotations

import queue
import threading
from typing import Optional, Dict, Any
from dataclasses import dataclass

from tests.load.config.settings import settings


@dataclass
class VirtualStudentAccount:
    index: int
    username: str
    email: str
    full_name: str
    handle: str
    default_otp: str = "123456"
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    member_id: Optional[str] = None


import json
import logging
from pathlib import Path

logger = logging.getLogger("ccc.loadtest.credentials")


class UserCredentialPool:
    """Thread-safe FIFO queue distributing dedicated student accounts to Locust virtual users."""

    def __init__(self, pool_size: int = 50):
        self._pool_size = max(pool_size, settings.LOAD_TEST_USERS)
        self._queue: queue.Queue[VirtualStudentAccount] = queue.Queue()
        self._lock = threading.Lock()
        self._initialized = False

    def initialize(self) -> None:
        """Pre-populate the pool with dedicated 50 loadtest identities."""
        with self._lock:
            if self._initialized:
                return

            identities_file = Path(__file__).resolve().parents[1] / "data" / "loadtest_identities.json"
            loaded_identities = []
            if identities_file.exists():
                try:
                    with open(identities_file, "r") as f:
                        loaded_identities = json.load(f)
                    logger.info("Loaded %d dedicated test identities from %s", len(loaded_identities), identities_file)
                except Exception as exc:
                    logger.warning("Failed to load %s: %s", identities_file, exc)

            if loaded_identities:
                for item in loaded_identities:
                    account = VirtualStudentAccount(
                        index=item.get("index", 1),
                        username=item.get("username") or item.get("handle"),
                        email=item.get("email"),
                        full_name=item.get("full_name"),
                        handle=item.get("handle"),
                        default_otp="123456",
                        access_token=item.get("access_token") or item.get("token"),
                        member_id=item.get("id"),
                    )
                    self._queue.put(account)
            else:
                # Deterministic fallback identities: loadtest-student-001 through 050
                prefix = "loadtest-student"
                domain = settings.LOAD_TEST_USER_DOMAIN or "medicaps.ac.in"

                for i in range(1, self._pool_size + 1):
                    handle = f"{prefix}-{i:03d}"
                    email = f"{handle}@{domain}"
                    account = VirtualStudentAccount(
                        index=i,
                        username=handle,
                        email=email,
                        full_name=f"Loadtest Student {i:03d}",
                        handle=handle,
                        default_otp="123456",
                        access_token=None,
                        member_id=None,
                    )
                    self._queue.put(account)

            self._initialized = True

    def checkout(self, timeout: float = 5.0) -> VirtualStudentAccount:
        """Check out an exclusive student account for a virtual user."""
        if not self._initialized:
            self.initialize()
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            # If pool is exhausted, dynamically generate an overflow account
            with self._lock:
                idx = self._queue.qsize() + 1000
                prefix = settings.LOAD_TEST_USERNAME_PREFIX
                domain = settings.LOAD_TEST_USER_DOMAIN
                return VirtualStudentAccount(
                    index=idx,
                    username=f"{prefix}_{idx:04d}",
                    email=f"{prefix}_{idx:04d}@{domain}",
                    full_name=f"Overflow Student {idx:04d}",
                    handle=f"lt_ovf_{idx:04d}",
                )

    def checkin(self, account: VirtualStudentAccount) -> None:
        """Return account back to the pool upon user teardown."""
        self._queue.put(account)


# Global singleton credential pool
user_pool = UserCredentialPool()
