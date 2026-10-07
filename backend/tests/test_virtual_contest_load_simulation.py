"""
Tests the 50-user virtual contest high-concurrency simulation, CAS lease fencing,
idempotent registration, and mathematical scoreboard ranking.
"""

import pytest
from scripts.simulate_50_user_contest import VirtualContestSimulator


@pytest.mark.asyncio
async def test_50_user_virtual_contest_simulation():
    sim = VirtualContestSimulator(user_count=50, concurrency=25)
    results = await sim.run_full_simulation()

    # Registrations check
    assert results["registrations"]["total_registered"] == 50

    # Submissions check
    assert results["submissions"]["total_queued"] == 150
    assert results["judging"]["processed"] == 150
    assert results["judging"]["successful_leases"] == 150
    assert results["judging"]["cas_conflicts"] == 0

    # Audit & Ranking check
    assert results["audit"]["total_participants"] == 50
    assert len(results["audit"]["top_5"]) == 5

    # Check that rank #1 solved at least as many as rank #2
    top_1 = results["audit"]["top_5"][0]
    top_2 = results["audit"]["top_5"][1]
    assert top_1["solved"] >= top_2["solved"]
    if top_1["solved"] == top_2["solved"]:
        assert top_1["penalty_min"] <= top_2["penalty_min"]
