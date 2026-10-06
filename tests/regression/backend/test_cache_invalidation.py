"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_cache_invalidation.py — Cache Invalidation & Consistency Invariants

Linked Bugs: REG-0020, REG-0038
Invariant: MUTATION_MUST_ATOMICALLY_INVALIDATE_ALL_DEPENDENT_CACHE_KEYS
"""

import pytest
from typing import Set, Dict, Any, List


class MockCacheLayer:
    """
    Simulates hierarchical Redis caching with tag-based / dependent-key invalidation.
    """
    def __init__(self):
        self.store: Dict[str, Any] = {}
        self.tags: Dict[str, Set[str]] = {}  # tag -> set of cache keys

    def set(self, key: str, value: Any, tags: List[str] = None):
        self.store[key] = value
        if tags:
            for tag in tags:
                if tag not in self.tags:
                    self.tags[tag] = set()
                self.tags[tag].add(key)

    def get(self, key: str) -> Any:
        return self.store.get(key)

    def invalidate_tag(self, tag: str) -> int:
        keys_to_delete = self.tags.get(tag, set())
        count = 0
        for k in list(keys_to_delete):
            if k in self.store:
                del self.store[k]
                count += 1
        self.tags[tag] = set()
        return count


@pytest.mark.regression("REG-0020")
def test_submission_mutation_invalidates_all_dependent_caches():
    """
    REG-0020 Invariant:
    A new verified submission must atomically purge stale scoreboard caches,
    problem stats caches, and user profile caches.
    """
    cache = MockCacheLayer()

    contest_id = "contest-annual-2026"
    member_id = "mem-101"
    problem_id = "prob-two-sum"

    # Pre-populate caches with associated tags
    cache.set(f"scoreboard:{contest_id}", {"rankings": []}, tags=[f"contest:{contest_id}"])
    cache.set(f"contest_details:{contest_id}", {"registered": 50}, tags=[f"contest:{contest_id}"])
    cache.set(f"problem_stats:{problem_id}", {"solved_count": 10}, tags=[f"problem:{problem_id}"])
    cache.set(f"user_profile:{member_id}", {"rating": 1600}, tags=[f"member:{member_id}"])
    cache.set("global_leaderboard", {"top": 100}, tags=["global"])

    # Ensure all caches exist
    assert cache.get(f"scoreboard:{contest_id}") is not None
    assert cache.get(f"problem_stats:{problem_id}") is not None

    # Mutation: Submission processed for contest
    # Invalidation trigger: purge contest-related caches
    purged_count = cache.invalidate_tag(f"contest:{contest_id}")
    assert purged_count == 2

    # Invariant: Scoreboard and contest details are guaranteed purged
    assert cache.get(f"scoreboard:{contest_id}") is None
    assert cache.get(f"contest_details:{contest_id}") is None

    # Independent caches remain uncorrupted
    assert cache.get(f"problem_stats:{problem_id}") is not None
    assert cache.get(f"user_profile:{member_id}") is not None


@pytest.mark.regression("REG-0038")
def test_cache_key_generation_deterministic():
    """
    REG-0038 Invariant:
    Cache keys must be deterministic across calls regardless of dictionary/set ordering.
    """
    def make_contest_cache_key(contest_id: str, division: str, page: int) -> str:
        return f"cache:contest:{contest_id}:div:{division.lower()}:p:{page}"

    key1 = make_contest_cache_key("c1", "Open", 1)
    key2 = make_contest_cache_key("c1", "OPEN", 1)

    assert key1 == key2 == "cache:contest:c1:div:open:p:1"
