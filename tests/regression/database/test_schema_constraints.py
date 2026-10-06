"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/database/test_schema_constraints.py — Database Schema Unique & FK Invariants

Linked Bugs: REG-0004, REG-0025
Invariant: DATABASE_SCHEMAS_MUST_ENFORCE_INTEGRITY_VIA_PRIMARY_UNIQUE_AND_FOREIGN_KEYS
"""

import pytest
from app.models.contest import ContestRegistration, ScoreboardEntry
from app.models.member import RatingHistory, StudentFollow


@pytest.mark.regression("REG-0004")
def test_contest_registration_unique_constraint_defined():
    """
    REG-0004 Invariant:
    ContestRegistration table MUST define a composite UniqueConstraint on
    (contest_id, member_id) named 'uq_contest_member_reg' to reject duplicate writes at DB level.
    """
    table = ContestRegistration.__table__
    constraint_names = {c.name for c in table.constraints}
    assert "uq_contest_member_reg" in constraint_names

    # Check composite columns
    uq = next(c for c in table.constraints if c.name == "uq_contest_member_reg")
    col_names = {col.name for col in uq.columns}
    assert col_names == {"contest_id", "member_id"}


@pytest.mark.regression("REG-0004")
def test_rating_history_unique_constraint_defined():
    """
    REG-0004 Invariant:
    RatingHistory table MUST define a composite UniqueConstraint on
    (contest_id, member_id) named 'uq_rating_history_contest_member'.
    """
    table = RatingHistory.__table__
    constraint_names = {c.name for c in table.constraints}
    assert "uq_rating_history_contest_member" in constraint_names

    uq = next(c for c in table.constraints if c.name == "uq_rating_history_contest_member")
    col_names = {col.name for col in uq.columns}
    assert col_names == {"contest_id", "member_id"}


@pytest.mark.regression("REG-0025")
def test_scoreboard_unique_constraint_defined():
    """
    REG-0025 Invariant:
    ScoreboardEntry table MUST define a composite UniqueConstraint on
    (contest_id, member_id) named 'uq_scoreboard_contest_member'.
    """
    table = ScoreboardEntry.__table__
    constraint_names = {c.name for c in table.constraints}
    assert "uq_scoreboard_contest_member" in constraint_names

    uq = next(c for c in table.constraints if c.name == "uq_scoreboard_contest_member")
    col_names = {col.name for col in uq.columns}
    assert col_names == {"contest_id", "member_id"}
