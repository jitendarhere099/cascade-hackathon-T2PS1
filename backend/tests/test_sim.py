from datetime import datetime, timezone
import pytest
from backend.app.schemas import Channel
from backend.sim.city import MeridianCity
from backend.sim.faults import FaultInjector
from backend.sim.generator import EventGenerator
from backend.sim.scenarios import ScenarioLibrary
from backend.sim.twins import TwinGenerator


def test_city_topology():
    city = MeridianCity()
    assert len(city.DISTRICTS) == 6
    assert len(city.GATEWAYS) == 4
    assert len(city.HOSPITALS) == 3
    # Check gateway sensor allocations
    for gw_id in ["GW-A", "GW-B", "GW-C", "GW-D"]:
        sensors = city.get_sensors_by_gateway(gw_id)
        assert len(sensors) >= 75


def test_event_generator_single_minute():
    gen = EventGenerator("config/world.yaml", "config/causal_graph.yaml", seed=101)
    start_time = datetime(2026, 10, 25, 0, 0, 0, tzinfo=timezone.utc)
    events = gen.generate_events_for_minute(
        t=0,
        sim_start_time=start_time,
        hypothesis="NOISE",
        active_nodes={},
    )
    assert len(events) > 0
    # Must contain gateway heartbeats
    hb_events = [e for e in events if e.channel == Channel.HEARTBEAT]
    assert len(hb_events) == 4


def test_tuesday_evening_twin_prefix_identity():
    twin_pair = TwinGenerator.generate_pair(seed=42, total_minutes=12, split_minute=7)
    assert twin_pair.split_minute == 7

    # Check that for all minutes t < 7, events are bit-for-bit identical
    for t in range(7):
        evts_a = twin_pair.twin_a[t]
        evts_b = twin_pair.twin_b[t]
        assert len(evts_a) == len(evts_b), f"Minute {t} event counts differ: {len(evts_a)} vs {len(evts_b)}"
        for ea, eb in zip(evts_a, evts_b):
            assert ea.id == eb.id
            assert ea.source_id == eb.source_id
            assert ea.channel == eb.channel
            assert ea.district == eb.district
            assert ea.value == eb.value
            assert ea.event_time == eb.event_time

    # At minute >= 7, futures should diverge
    diverged = False
    for t in range(7, 12):
        evts_a = twin_pair.twin_a[t]
        evts_b = twin_pair.twin_b[t]
        if len(evts_a) != len(evts_b) or [e.id for e in evts_a] != [e.id for e in evts_b]:
            diverged = True
            break
    assert diverged is True, "Twin pair failed to diverge after split minute!"


def test_fault_injector_gateway_blackout():
    city = MeridianCity()
    gen = EventGenerator("config/world.yaml", "config/causal_graph.yaml", seed=42)
    start_time = datetime(2026, 10, 25, 0, 0, 0, tzinfo=timezone.utc)
    events = gen.generate_events_for_minute(t=1, sim_start_time=start_time, hypothesis="NOISE", active_nodes={})

    injector = FaultInjector(seed=42)
    injector.inject_gateway_blackout("GW-B")
    filtered = injector.apply_faults(events, start_time)

    # Confirm no events behind GW-B remain
    gwb_events = [e for e in filtered if e.gateway_id == "GW-B"]
    assert len(gwb_events) == 0


def test_all_12_scenarios_generate_cleanly():
    for scen_id in ScenarioLibrary.SCENARIOS.keys():
        episode = ScenarioLibrary.generate_episode(
            scenario_id=scen_id,
            total_minutes=5,
            seed=123,
            world_cfg_path="config/world.yaml",
            causal_cfg_path="config/causal_graph.yaml",
        )
        assert len(episode) == 5
        assert all(len(min_events) > 0 for min_events in episode)
