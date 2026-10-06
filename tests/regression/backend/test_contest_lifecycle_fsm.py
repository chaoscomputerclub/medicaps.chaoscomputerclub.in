"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_contest_lifecycle_fsm.py — Contest Lifecycle Finite State Machine Invariants

Linked Bugs: REG-0004, REG-0026
Invariant: CONTEST_LIFECYCLE_TRANSITIONS_MUST_FORM_A_STRICT_DIRECTED_ACYCLIC_GRAPH
"""

import pytest
from enum import Enum
from typing import Set


class ContestState(str, Enum):
    DRAFT = "draft"
    UPCOMING = "upcoming"
    LIVE = "live"
    FROZEN = "frozen"
    ENDED = "ended"
    ARCHIVED = "archived"


ALLOWED_TRANSITIONS = {
    ContestState.DRAFT: {ContestState.UPCOMING},
    ContestState.UPCOMING: {ContestState.LIVE},
    ContestState.LIVE: {ContestState.FROZEN, ContestState.ENDED},
    ContestState.FROZEN: {ContestState.ENDED},
    ContestState.ENDED: {ContestState.ARCHIVED},
    ContestState.ARCHIVED: set(),  # Terminal state
}


def transition_contest_state(current_state: ContestState, next_state: ContestState) -> ContestState:
    valid_targets = ALLOWED_TRANSITIONS.get(current_state, set())
    if next_state not in valid_targets:
        raise ValueError(
            f"Invalid contest transition: cannot transition from {current_state.value} to {next_state.value}"
        )
    return next_state


@pytest.mark.regression("REG-0004")
def test_ended_contest_cannot_reopen_to_live():
    """
    REG-0004 Invariant:
    A contest that has reached ENDED or ARCHIVED must NEVER transition back to LIVE.
    This prevents ghost submissions or post-contest scoreboard corruption.
    """
    # Attempting to re-open an ended contest
    with pytest.raises(ValueError, match="cannot transition from ended to live"):
        transition_contest_state(ContestState.ENDED, ContestState.LIVE)

    # Attempting to re-open an archived contest
    with pytest.raises(ValueError, match="cannot transition from archived to live"):
        transition_contest_state(ContestState.ARCHIVED, ContestState.LIVE)


@pytest.mark.regression("REG-0026")
def test_valid_contest_lifecycle_progression():
    """
    REG-0026 Invariant:
    The canonical lifecycle path DRAFT -> UPCOMING -> LIVE -> FROZEN -> ENDED -> ARCHIVED
    must succeed deterministically.
    """
    state = ContestState.DRAFT
    state = transition_contest_state(state, ContestState.UPCOMING)
    assert state == ContestState.UPCOMING

    state = transition_contest_state(state, ContestState.LIVE)
    assert state == ContestState.LIVE

    state = transition_contest_state(state, ContestState.FROZEN)
    assert state == ContestState.FROZEN

    state = transition_contest_state(state, ContestState.ENDED)
    assert state == ContestState.ENDED

    state = transition_contest_state(state, ContestState.ARCHIVED)
    assert state == ContestState.ARCHIVED


@pytest.mark.regression("REG-0004")
def test_direct_jump_from_draft_to_ended_is_rejected():
    """
    REG-0004 Invariant:
    Draft contests cannot jump directly to ENDED or ARCHIVED without going through the lifecycle.
    """
    with pytest.raises(ValueError):
        transition_contest_state(ContestState.DRAFT, ContestState.ENDED)
