import json

import pytest

from app.services import event_broadcaster


@pytest.mark.asyncio
async def test_submission_verdict_is_only_fanned_out_to_contest_stream():
    global_queue = await event_broadcaster.subscribe("global")
    contest_queue = await event_broadcaster.subscribe("contest:weekly-01")
    try:
        await event_broadcaster._fan_out(
            json.dumps({"event": "submission_evaluated", "contest_slug": "weekly-01"}),
            "weekly-01",
        )

        assert global_queue.empty()
        assert json.loads(contest_queue.get_nowait())["event"] == "submission_evaluated"
    finally:
        await event_broadcaster.unsubscribe("global", global_queue)
        await event_broadcaster.unsubscribe("contest:weekly-01", contest_queue)


@pytest.mark.asyncio
async def test_contest_verdict_without_slug_is_not_broadcast_globally():
    global_queue = await event_broadcaster.subscribe("global")
    try:
        await event_broadcaster._fan_out(json.dumps({"event": "submission_completed"}))
        assert global_queue.empty()
    finally:
        await event_broadcaster.unsubscribe("global", global_queue)
