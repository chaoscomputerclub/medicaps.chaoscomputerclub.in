"""
Medi-Caps Competitive Programming Platform — Server-Sent Events (SSE) Real-Time Workflow
Simulates student browser holding live SSE event streams, receiving push updates,
disconnecting, and resuming via Last-Event-ID.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Dict, Any, List, Optional
import requests

from tests.load.clients.api_client import StudentApiClient
from tests.load.config.settings import settings
from tests.load.utilities.correlation import build_correlation_headers

logger = logging.getLogger("ccc.loadtest.realtime")


def test_sse_stream_connection(
    base_url: str,
    token: Optional[str],
    slug: Optional[str] = None,
    listen_seconds: float = 3.0,
    last_event_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Connect to real-time SSE stream, consume initial chunks/events, and safely disconnect.
    """
    path = f"/api/events/contest/{slug}/stream" if slug else "/api/events/stream"
    url = f"{base_url.rstrip('/')}{path}"

    headers = {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if last_event_id is not None:
        headers["Last-Event-ID"] = str(last_event_id)

    events_received: List[Dict[str, Any]] = []
    connected = False
    highest_id: Optional[int] = None

    start_time = time.time()
    try:
        with requests.get(url, headers=headers, stream=True, timeout=10.0) as resp:
            if resp.status_code == 200:
                connected = True
                current_id = None
                current_event = "message"
                current_data = []

                for line in resp.iter_lines(decode_unicode=True):
                    if time.time() - start_time > listen_seconds:
                        break
                    if not line:
                        # Dispatch complete event block
                        if current_data:
                            raw_data = "\n".join(current_data)
                            try:
                                parsed = json.loads(raw_data)
                            except Exception:
                                parsed = {"raw": raw_data}
                            events_received.append({
                                "id": current_id,
                                "event": current_event,
                                "data": parsed,
                            })
                            current_data = []
                        continue

                    if line.startswith(":"):
                        # Comment / ping
                        continue
                    elif line.startswith("id:"):
                        current_id = line[3:].strip()
                        try:
                            highest_id = int(current_id)
                        except ValueError:
                            pass
                    elif line.startswith("event:"):
                        current_event = line[6:].strip()
                    elif line.startswith("data:"):
                        current_data.append(line[5:].strip())
    except Exception as exc:
        logger.debug("SSE stream connection closed after %.1fs: %s", listen_seconds, exc)

    return {
        "connected": connected,
        "events_count": len(events_received),
        "events": events_received,
        "highest_event_id": highest_id,
        "duration_seconds": time.time() - start_time,
    }
