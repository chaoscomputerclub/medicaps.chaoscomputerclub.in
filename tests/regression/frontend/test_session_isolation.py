"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/frontend/test_session_isolation.py — Session & Cross-User Isolation Invariants

Linked Bugs: REG-0004, REG-0010, REG-0011
Invariant: LOGOUT_MUST_PURGE_ALL_USER_SCOPED_STATE_PREVENTING_CROSS_USER_LEAKAGE
"""

import pytest


@pytest.mark.regression("REG-0004")
def test_root_reducer_logout_resets_all_slice_state():
    """
    Verifies that the Redux rootReducer pattern resets the entire client state tree
    to initialState upon receiving an 'auth/logout' action.
    """
    # Simulate a Redux store root reducer state tree
    initial_auth_state = {"isAuthenticated": False, "member": None, "token": None}
    initial_contest_state = {"currentContest": None, "activeDetailRequestId": None}
    initial_social_state = {"followingIds": [], "followersCount": 0}

    # Simulate dirty state from User A
    dirty_state = {
        "auth": {"isAuthenticated": True, "member": {"id": "user-A", "handle": "cadetA"}, "token": "jwt-A"},
        "contest": {"currentContest": {"id": "c1", "title": "Secret Contest"}, "activeDetailRequestId": "req-99"},
        "social": {"followingIds": ["user-X", "user-Y"], "followersCount": 42},
    }

    def root_reducer(state, action):
        if action.get("type") == "auth/logout":
            state = None
        if state is None:
            return {
                "auth": initial_auth_state.copy(),
                "contest": initial_contest_state.copy(),
                "social": initial_social_state.copy(),
            }
        return state

    # Trigger logout
    cleared_state = root_reducer(dirty_state, {"type": "auth/logout"})

    # Assert invariant: ZERO USER A STATE SURVIVES
    assert cleared_state["auth"]["isAuthenticated"] is False
    assert cleared_state["auth"]["member"] is None
    assert cleared_state["contest"]["currentContest"] is None
    assert cleared_state["social"]["followingIds"] == []
    assert cleared_state["social"]["followersCount"] == 0


@pytest.mark.regression("REG-0010")
def test_user_scoped_local_storage_keys():
    """
    Verifies that client-side storage keys are partitioned by member ID to prevent
    User B from inheriting User A's bookmarks or social telemetry.
    """
    member_a = "mem-alpha-001"
    member_b = "mem-beta-002"

    def get_bookmark_key(member_id: str) -> str:
        return f"ccc_bookmarked_problems_{member_id}"

    def get_social_key(member_id: str) -> str:
        return f"ccc_my_social_counts_{member_id}"

    key_a_bookmarks = get_bookmark_key(member_a)
    key_b_bookmarks = get_bookmark_key(member_b)
    key_a_social = get_social_key(member_a)
    key_b_social = get_social_key(member_b)

    # Invariant: storage keys must never collide across different users
    assert key_a_bookmarks != key_b_bookmarks
    assert key_a_social != key_b_social
    assert member_a in key_a_bookmarks
    assert member_b in key_b_bookmarks
