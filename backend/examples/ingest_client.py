"""
Firstlight Live Ingest Sample Client
Demonstrates bringing your own external event stream to Firstlight via HTTP and WebSocket.
"""
import asyncio
from datetime import datetime, timezone
import json
import time
import httpx


API_BASE = "http://127.0.0.1:8000"


def send_single_event():
    now = datetime.now(timezone.utc).isoformat()
    event_payload = {
        "id": f"external-feed-{int(time.time())}",
        "source_id": "custom-drainage-sensor-99",
        "channel": "drainage_sensor",
        "gateway_id": "GW-A",
        "district": "D1",
        "event_time": now,
        "arrival_time": now,
        "value": 4.85,
        "kind": "observation",
    }

    print(f"Submitting event: {event_payload['id']}...")
    resp = httpx.post(f"{API_BASE}/events", json=event_payload)
    print("Response:", resp.status_code, resp.json())


def create_and_stream_episode():
    # 1. Create episode
    resp = httpx.post(f"{API_BASE}/episodes", json={"scenario": "tuesday_evening", "variant": "cascade", "seed": 42})
    ep = resp.json()
    ep_id = ep["episode_id"]
    print(f"Created episode: {ep_id}")

    # 2. Query initial belief
    b_resp = httpx.get(f"{API_BASE}/episodes/{ep_id}/belief?t=0")
    print(f"T=0 belief: {b_resp.json()['probs']}")


if __name__ == "__main__":
    create_and_stream_episode()
    send_single_event()
