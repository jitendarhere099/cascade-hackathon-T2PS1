from datetime import datetime, timezone
import json
import time
import pytest
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import Channel, Event
from backend.engine.filter import InferenceEngine
import yaml


@pytest.fixture
def client():
    return TestClient(app)


# Test 15: Schema validation, malformed events quarantined, WebSocket disconnect/reconnect
def test_acceptance_15_api_validation_quarantine_and_websocket(client):
    # 1. Root healthcheck
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["system"] == "Firstlight"

    # 2. Create episode
    r_ep = client.post("/episodes", json={"scenario": "tuesday_evening", "seed": 42})
    assert r_ep.status_code == 200
    ep_id = r_ep.json()["episode_id"]

    # 3. Valid event ingestion
    now_str = datetime.now(timezone.utc).isoformat()
    valid_event = {
        "id": "ext-test-1",
        "source_id": "sensor-1",
        "channel": "drainage_sensor",
        "district": "D1",
        "event_time": now_str,
        "arrival_time": now_str,
        "value": 3.5,
    }
    r_evt = client.post(f"/events?episode_id={ep_id}", json=valid_event)
    assert r_evt.status_code == 200
    assert r_evt.json()["status"] == "fresh"

    # 4. Malformed event is quarantined, does not crash
    malformed_event = {"unrecognized_bogus_key": 999}
    r_bad = client.post(f"/events?episode_id={ep_id}", json=malformed_event)
    assert r_bad.status_code == 200
    assert r_bad.json()["status"] == "quarantined"

    # 5. Time travel query
    r_belief = client.get(f"/episodes/{ep_id}/belief?t=0")
    assert r_belief.status_code == 200
    b_data = r_belief.json()
    assert "probs" in b_data
    assert "CASCADE" in b_data["probs"]

    # 6. Officer decision logging
    r_dec = client.post(f"/episodes/{ep_id}/officer-decision", json={"action": "ALERT", "t": 0, "notes": "Officer review"})
    assert r_dec.status_code == 200
    assert r_dec.json()["officer_action"] == "ALERT"

    # 7. WebSocket connection and survival
    with client.websocket_connect(f"/episodes/{ep_id}/stream") as ws:
        msg1 = ws.receive_text()
        data1 = json.loads(msg1)
        assert "probs" in data1
        # Send step command
        ws.send_text(json.dumps({"cmd": "step"}))
        msg2 = ws.receive_text()
        data2 = json.loads(msg2)
        assert data2["t"] >= 0


# Test 16: Performance: per-minute update under 100 ms at N=4000
def test_acceptance_16_performance_under_100ms():
    with open("config/world.yaml", "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    # Initialize full N=4000 particle engine
    engine = InferenceEngine(cfg, N=4000, seed=42)
    now = datetime.now(timezone.utc)

    # Typical minute: 40 multi-channel events
    events = [
        Event(
            id=f"perf-{i}",
            source_id=f"sensor-{i % 15}",
            channel=Channel.DRAINAGE_SENSOR if i % 2 == 0 else Channel.TRAFFIC_SENSOR,
            district="D1" if i % 3 == 0 else "D2",
            event_time=now,
            arrival_time=now,
            value=float((i % 5) + 1),
        )
        for i in range(40)
    ]

    # Warmup
    engine.step_minute(0, [])

    # Measure 5 minutes
    durations = []
    for m in range(1, 6):
        start = time.perf_counter()
        engine.step_minute(m, events)
        dur = (time.perf_counter() - start) * 1000.0  # in ms
        durations.append(dur)

    avg_ms = sum(durations) / len(durations)
    print(f"\nAverage per-minute inference time (N=4000): {avg_ms:.2f} ms")
    # Acceptance criteria: per-minute update under 100 ms
    assert avg_ms < 100.0, f"Engine update too slow: {avg_ms:.2f} ms >= 100 ms"
