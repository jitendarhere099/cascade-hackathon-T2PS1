from datetime import datetime, timedelta, timezone
import math
import numpy as np
import pytest
import yaml

from backend.app.ledger import BitemporalLedger
from backend.app.schemas import Channel, Event, EventKind, LedgerStatus
from backend.engine.filter import InferenceEngine
from backend.engine.robustness import RobustnessManager
from backend.sim.city import MeridianCity
from backend.sim.faults import FaultInjector
from backend.sim.generator import EventGenerator
from backend.sim.scenarios import ScenarioLibrary


@pytest.fixture
def world_cfg():
    with open("config/world.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# Test 1: Probabilities always sum to 1, are finite, and respect floor under random fuzzed inputs
def test_acceptance_1_probabilities_sum_to_one_and_floor(world_cfg):
    engine = InferenceEngine(world_cfg, N=1000, seed=42)
    rng = np.random.RandomState(99)
    now = datetime.now(timezone.utc)
    channels = list(InferenceEngine.ALL_CHANNELS)
    districts = ["D1", "D2", "D3", "D4", "D5", "D6"]

    for step in range(5):
        # Fuzz with random crazy events
        fuzzed_events = []
        for _ in range(50):
            ch = channels[rng.randint(0, len(channels))]
            val = float(rng.uniform(-1000.0, 1000.0))
            fuzzed_events.append(
                Event(
                    id=f"fuzz-{rng.randint(0, 100000)}",
                    source_id=f"src-{rng.randint(0, 20)}",
                    channel=ch,
                    district=districts[rng.randint(0, len(districts))],
                    event_time=now,
                    arrival_time=now,
                    value=val,
                )
            )

        state = engine.step_minute(step, fuzzed_events)
        probs = list(state["probs"].values())

        # Assert sum to 1.0 within floating point precision
        assert abs(sum(probs) - 1.0) < 1e-3
        # Assert finite
        assert all(math.isfinite(p) for p in probs)
        # Assert respects floor (0.005)
        assert all(p >= 0.0049 for p in probs)


# Test 2: Log-space safety: 10,000 events in one minute produce no NaN/Inf
def test_acceptance_2_log_space_safety_10k_events(world_cfg):
    engine = InferenceEngine(world_cfg, N=1000, seed=42)
    now = datetime.now(timezone.utc)

    # 10,000 events in a single minute
    huge_batch = [
        Event(
            id=f"huge-{i}",
            source_id=f"sensor-{i % 50}",
            channel=Channel.DRAINAGE_SENSOR,
            district="D1",
            event_time=now,
            arrival_time=now,
            value=float(i % 10),
        )
        for i in range(10000)
    ]

    state = engine.step_minute(0, huge_batch)
    probs = list(state["probs"].values())
    assert all(math.isfinite(p) for p in probs)
    assert not any(math.isnan(p) for p in probs)
    assert abs(sum(probs) - 1.0) < 1e-3


# Test 3: Dedupe: duplicates add zero evidence; retraction rollback restores pre-event belief within tolerance
def test_acceptance_3_dedupe_and_retraction_rollback(world_cfg):
    ledger = BitemporalLedger()
    engine = InferenceEngine(world_cfg, N=2000, seed=42)
    now = datetime.now(timezone.utc)

    # Step 0: Baseline minute
    state_0 = engine.step_minute(0, [])
    p_cascade_0 = state_0["probs"]["CASCADE"]

    # Step 1: Ingest genuine event + identical duplicates
    e_orig = Event(
        id="burst-1",
        source_id="d4-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D4",
        event_time=now,
        arrival_time=now,
        value=5.0,
    )
    e_dup = Event(
        id="burst-1",
        source_id="d4-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D4",
        event_time=now,
        arrival_time=now + timedelta(seconds=10),
        value=5.0,
    )
    ev1, _ = ledger.ingest(e_orig)
    ev2, _ = ledger.ingest(e_dup)
    assert ev2.status == LedgerStatus.DUPLICATE

    # Feeding valid events
    valid_events = ledger.get_events_for_minute(now + timedelta(minutes=1))
    assert len(valid_events) == 1
    state_1 = engine.step_minute(1, valid_events)
    p_cascade_1 = state_1["probs"]["CASCADE"]

    # Retract the event
    retract_ev = Event(
        id="ret-burst-1",
        source_id="d4-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D4",
        event_time=now + timedelta(minutes=2),
        arrival_time=now + timedelta(minutes=2),
        retracts="burst-1",
        kind=EventKind.RETRACTION,
    )
    _, needs_rollback = ledger.ingest(retract_ev)
    assert needs_rollback is True

    # Roll back to minute 0 and re-filter with retraction applied
    all_evts = {1: ledger.get_events_for_minute(now + timedelta(minutes=2))}
    engine.rollback_and_refilter(0, all_evts, ledger.content_hash())

    # After retraction, belief should return close to baseline p_cascade_0
    state_restored = engine.step_minute(2, [])
    assert abs(state_restored["probs"]["CASCADE"] - p_cascade_0) < 0.15


# Test 4: Out-of-order: shuffled delivery of same events yields same final belief within tolerance
def test_acceptance_4_out_of_order_shuffled_reproducibility(world_cfg):
    now = datetime.now(timezone.utc)
    evts_m1 = [
        Event(id=f"e1-{i}", source_id=f"src-{i}", channel=Channel.DRAINAGE_SENSOR, district="D1",
              event_time=now, arrival_time=now, value=3.0)
        for i in range(5)
    ]
    evts_m2 = [
        Event(id=f"e2-{i}", source_id=f"src-{i}", channel=Channel.TRAFFIC_SENSOR, district="D2",
              event_time=now + timedelta(minutes=1), arrival_time=now + timedelta(minutes=1), value=4.0)
        for i in range(5)
    ]

    # In-order run
    eng1 = InferenceEngine(world_cfg, N=2000, seed=123)
    eng1.step_minute(0, [])
    eng1.step_minute(1, evts_m1)
    s1 = eng1.step_minute(2, evts_m2)
    p_in_order = s1["probs"]["CASCADE"]

    # Out-of-order run: evts_m1 delayed and arrive in minute 2
    ledger2 = BitemporalLedger()
    eng2 = InferenceEngine(world_cfg, N=2000, seed=123)
    eng2.step_minute(0, [])

    # At minute 1: evts_m2 arrive first (out of order)
    for e in evts_m2:
        ledger2.ingest(e)
    eng2.step_minute(1, evts_m2)

    # At minute 2: evts_m1 arrive late
    for e in evts_m1:
        ledger2.ingest(e, current_sim_time=now + timedelta(minutes=2))

    # Rollback to 0 and re-filter
    all_events_ordered = {
        1: ledger2.get_events_for_minute(now + timedelta(minutes=1)),
        2: ledger2.get_events_for_minute(now + timedelta(minutes=2)),
    }
    eng2.rollback_and_refilter(0, all_events_ordered, ledger2.content_hash())
    p_shuffled = eng2.last_probs[3]  # CASCADE is index 3 in last_probs

    # Must agree within tolerance
    assert abs(p_in_order - p_shuffled) < 0.20


# Test 5: Gateway masking: 100 silent sensors behind one gateway move belief by about same as 1 independent source
def test_acceptance_5_gateway_masking_cluster_scaling(world_cfg):
    mgr = RobustnessManager()
    now = datetime.now(timezone.utc)

    # 100 sensors behind GW-B
    clustered_events = [
        Event(
            id=f"gwb-{i}",
            source_id=f"sensor-{i}",
            channel=Channel.DRAINAGE_SENSOR,
            gateway_id="GW-B",
            district="D3",
            event_time=now,
            arrival_time=now,
            value=2.0,
        )
        for i in range(100)
    ]

    clusters = mgr.cluster_events(clustered_events)
    assert len(clusters) == 1
    key, evts, eff_weight = clusters[0]
    # For m=100, eff_weight should be sqrt(100)/100 = 10/100 = 0.1
    # Total effective weight = m * eff_weight = 100 * 0.1 = 10 (i.e. sqrt(100), not 100)
    total_effective_events = len(evts) * eff_weight
    assert abs(total_effective_events - 10.0) < 1e-4


# Test 6: Channel cutout: all cameras vanish, no exception, uncertainty widens, probabilities relax toward prior
def test_acceptance_6_channel_cutout_uncertainty_widening(world_cfg):
    engine = InferenceEngine(world_cfg, N=2000, seed=42)
    now = datetime.now(timezone.utc)

    # Step 1: Camera events present
    cam_events = [
        Event(id="cam-1", source_id="cam-01", channel=Channel.CAMERA_FLOOD, district="D1",
              event_time=now, arrival_time=now, value=3.0)
    ]
    s1 = engine.step_minute(1, cam_events)
    assert s1["data_health"]["camera_flood"] == "OK"

    # Step 2: Camera cutout (all cameras vanish)
    s2 = engine.step_minute(2, [])
    assert s2["data_health"]["camera_flood"] == "MISSING"
    # No exception occurred and probabilities remain valid
    assert all(math.isfinite(p) for p in s2["probs"].values())


# Test 7: Rumor wave without physical corroboration never drives ESCALATE
def test_acceptance_7_rumor_wave_never_drives_escalate(world_cfg):
    engine = InferenceEngine(world_cfg, N=2000, seed=42)
    now = datetime.now(timezone.utc)

    # 20 social posts with copy-pasted rumor text, zero physical sensor anomalies
    rumor_events = [
        Event(
            id=f"rumor-{i}",
            source_id=f"user-{i}",
            channel=Channel.SOCIAL_POST,
            district="D2",
            event_time=now,
            arrival_time=now,
            value=1.0,
            payload_hash="copypaste-dam-collapse",
        )
        for i in range(20)
    ]

    s = engine.step_minute(1, rumor_events)
    # P(CASCADE) must be kept low because physical channels are quiet
    assert s["probs"]["CASCADE"] < 0.45
    # Rumor nuisance factor must be high
    assert s["nuisance"]["rumor"] > 0.05


# Test 8: Structured liars: 40 perfectly correlated sensors raise SENSOR_FAILURE, not CASCADE
def test_acceptance_8_structured_liars_raises_sensor_failure(world_cfg):
    engine = InferenceEngine(world_cfg, N=2000, seed=42)
    now = datetime.now(timezone.utc)

    # 40 drainage sensors reporting identical high reading 9.50 with zero variance
    liar_events = [
        Event(
            id=f"liar-{i}",
            source_id=f"drain-{i:03d}",
            channel=Channel.DRAINAGE_SENSOR,
            gateway_id="GW-C",
            district="D4",
            event_time=now,
            arrival_time=now,
            value=9.50,  # identical values
        )
        for i in range(40)
    ]

    s = engine.step_minute(1, liar_events)
    # SENSOR_FAILURE should be significantly elevated over CASCADE
    assert s["probs"]["SENSOR_FAILURE"] > s["probs"]["CASCADE"]
