"""
Test Webhooks & Real-Time SSE Infrastructure
Validates end-to-end webhook receipt, event broadcaster queuing, and stream responses.
"""

import asyncio
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from main import app
from app.services.event_broadcaster import subscribe, unsubscribe, broadcast_event


async def test_sse_subscription_and_broadcasting():
    print("🧪 1. Testing Event Broadcaster In-Memory Pub/Sub...")
    queue = await subscribe("contest:test-contest")
    
    # Broadcast an event
    await broadcast_event(
        event_type="test_ping",
        data={"message": "hello realtime"},
        contest_slug="test-contest",
    )
    
    # Wait for message in queue
    msg = await asyncio.wait_for(queue.get(), timeout=2.0)
    assert "test_ping" in msg, f"Expected test_ping in message, got: {msg}"
    assert "hello realtime" in msg
    print("  ✓ SSE Pub/Sub broadcast & subscription successfully received event.")
    
    await unsubscribe("contest:test-contest", queue)


async def test_webhook_endpoints():
    print("🧪 2. Testing Webhook Endpoints with FastAPI test client...")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Test register outbound webhook
        reg_resp = await ac.post(
            "/api/webhooks/register-outbound",
            json={"webhook_url": "https://example.com/webhook-sink"},
        )
        assert reg_resp.status_code == 200, f"Outbound webhook reg failed: {reg_resp.text}"
        print("  ✓ /api/webhooks/register-outbound OK")

        # Test gate scan webhook with non-existent pass (graceful rejection)
        gate_resp = await ac.post(
            "/api/webhooks/gate-scan",
            json={
                "pass_code_or_qr": "CCC-INVALID-PASS-99",
                "proctor_name": "Turnstile Gate North",
                "contest_slug": "weekly-contest-1",
            },
        )
        assert gate_resp.status_code == 200, f"Gate scan webhook failed: {gate_resp.text}"
        data = gate_resp.json()
        assert data["valid"] is False
async def test_openapi_webhooks_schema():
    print("🧪 3. Testing OpenAPI 3.1.0 Webhooks Schema in FastAPI...")
    openapi_schema = app.openapi()
    assert "webhooks" in openapi_schema, "OpenAPI schema missing 'webhooks' key!"
    webhooks_dict = openapi_schema["webhooks"]
    expected_webhooks = ["pass-checked-in", "contest-status-changed", "top30-qualified", "submission-evaluated"]
    for wh in expected_webhooks:
        assert wh in webhooks_dict, f"Webhook '{wh}' not found in OpenAPI schema: {list(webhooks_dict.keys())}"
    print(f"  ✓ OpenAPI webhooks verified: {list(webhooks_dict.keys())}")


async def main():
    print("🚀 Starting Webhook & SSE Validation Suite...")
    await test_sse_subscription_and_broadcasting()
    await test_webhook_endpoints()
    await test_openapi_webhooks_schema()
    print("✨ ALL WEBHOOK & REALTIME CHECKS PASSED!")


if __name__ == "__main__":
    asyncio.run(main())
