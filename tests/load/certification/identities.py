"""
Chaos Computer Club — Certification Harness: Dedicated Test Identities Manager
Manages dedicated load-test student cohort (VU-001 through VU-050).
Strictly adheres to Requirement 4:
- Never uses production JWT private signing keys
- Uses pre-authenticated student identities/tokens issued through standard auth channels
- Full isolation between virtual users
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass(frozen=True)
class VirtualUserIdentity:
    virtual_user_id: str  # e.g. "VU-001"
    user_id: str
    handle: str
    username: str
    email: str
    token: str
    contest_slug: str

    @property
    def auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "User-Agent": f"CCC-VirtualUser/{self.virtual_user_id}",
        }


class IdentityPoolManager:
    """Loads and manages the dedicated 50-student identity pool."""

    def __init__(self, data_path: Optional[str] = None):
        if data_path:
            self.file_path = Path(data_path)
        else:
            self.file_path = Path(__file__).resolve().parent.parent / "data" / "loadtest_identities.json"
        self._identities: List[VirtualUserIdentity] = []
        self._load()

    def _load(self) -> None:
        if not self.file_path.exists():
            raise FileNotFoundError(f"Identities catalog not found at {self.file_path}")

        with open(self.file_path, "r", encoding="utf-8") as f:
            raw_list = json.load(f)

        self._identities.clear()
        for idx, item in enumerate(raw_list):
            vu_id = f"VU-{idx + 1:03d}"
            ident = VirtualUserIdentity(
                virtual_user_id=vu_id,
                user_id=item.get("id", ""),
                handle=item.get("handle", item.get("username", "")),
                username=item.get("username", ""),
                email=item.get("email", ""),
                token=item.get("token") or item.get("access_token", ""),
                contest_slug=item.get("contest_slug", "loadtest-arena-50"),
            )
            self._identities.append(ident)

    @property
    def total_count(self) -> int:
        return len(self._identities)

    def get_cohort(self, size: int = 50) -> List[VirtualUserIdentity]:
        if size > len(self._identities):
            raise ValueError(
                f"Requested cohort size {size} exceeds available identities {len(self._identities)}"
            )
        return self._identities[:size]

    def get_by_index(self, index: int) -> VirtualUserIdentity:
        return self._identities[index % len(self._identities)]
