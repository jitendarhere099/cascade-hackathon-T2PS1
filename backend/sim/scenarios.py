from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional
import numpy as np

from backend.app.schemas import Channel, Event, EventKind
from backend.sim.faults import FaultInjector
from backend.sim.generator import EventGenerator


@dataclass
class ScenarioMetadata:
    id: str
    title: str
    narrative: str
    default_variant: str = "default"
    supports_variants: List[str] = None

    def __post_init__(self):
        if self.supports_variants is None:
            self.supports_variants = ["default"]


class ScenarioLibrary:
    """
    Catalog of all 12 Firstlight scenarios, each with its operational narrative and
    event generation protocol.
    """

    SCENARIOS: Dict[str, ScenarioMetadata] = {
        "tuesday_evening": ScenarioMetadata(
            id="tuesday_evening",
            title="Tuesday Evening (Hero)",
            narrative="00:00 heavier rain, 00:03 drainage anomalies, 00:05 traffic slows, 00:07 emergency lines busy, 00:09 two hospitals report unusual arrivals. Ambiguous 7-minute prefix that either resolves benignly or evolves into a catastrophic citywide cascade.",
            default_variant="cascade",
            supports_variants=["cascade", "benign"],
        ),
        "just_a_storm": ScenarioMetadata(
            id="just_a_storm",
            title="Just a Storm",
            narrative="Heavier precipitation across all districts increases drainage flow, slows traffic speeds, and triggers routine municipal dispatch calls. All physical precursors are fully explained by weather with no systemic infrastructure failure.",
            default_variant="default",
        ),
        "flu_cluster": ScenarioMetadata(
            id="flu_cluster",
            title="Flu at the Hospitals",
            narrative="A sharp uptick in emergency department arrivals at H1 and H2 occurs over a 15-minute window. Physical sensors (drainage, traffic arterial speeds, power telemetry) remain completely quiet and uncorroborated.",
            default_variant="default",
        ),
        "gateway_blackout": ScenarioMetadata(
            id="gateway_blackout",
            title="Gateway Blackout",
            narrative="Gateway GW-B drops offline at T+04, causing 100 sensors across the West Valley Basin and River Flats to go abruptly silent. Superficial metrics suggest incidents are calming down, but the silence masks critical unobserved events.",
            default_variant="default",
        ),
        "rumor_wave": ScenarioMetadata(
            id="rumor_wave",
            title="Rumor Wave",
            narrative="A sudden spike in citizen reports and social panic posts floods emergency communication channels with copy-pasted claims of levee collapses. Physical telemetry confirms water levels and transit flows are operating within normal tolerances.",
            default_variant="default",
        ),
        "isolated_pipe_burst": ScenarioMetadata(
            id="isolated_pipe_burst",
            title="Isolated Pipe Burst",
            narrative="A major subterranean water main ruptures in District D4. High local drainage volume and localized emergency calls rise sharply, but adjacent districts remain unaffected and transit routes outside D4 operate normally.",
            default_variant="default",
        ),
        "sensor_failure": ScenarioMetadata(
            id="sensor_failure",
            title="Sensor Failure",
            narrative="A cluster of municipal drainage telemetry sensors report maximum flood values at identical timestamps with zero variance. Neighboring flow sensors, street cameras, and emergency calls show normal baseline conditions.",
            default_variant="default",
        ),
        "full_cascade": ScenarioMetadata(
            id="full_cascade",
            title="Full Cascade",
            narrative="Severe precipitation overwhelms municipal storm conduits, flooding critical road underpasses and arterial highways. Trapped ambulances cause emergency queues to back up, leading to a protective substation power trip and regional gateway blackout.",
            default_variant="default",
        ),
        "camera_cutout": ScenarioMetadata(
            id="camera_cutout",
            title="Camera Cutout",
            narrative="At T+05, the central optical feed disconnects, causing all flood monitoring camera streams to drop simultaneously. The engine must recognise a missing channel and broaden uncertainty without generating spurious alarms.",
            default_variant="default",
        ),
        "structured_liars": ScenarioMetadata(
            id="structured_liars",
            title="Structured Liars",
            narrative="A faulty firmware update causes 40 disparate sensors across two districts to report high anomaly readings in lockstep. The system's common-cause detector must discount their collective weight to prevent a false escalation.",
            default_variant="default",
        ),
        "monsoon_shift": ScenarioMetadata(
            id="monsoon_shift",
            title="Monsoon Shift",
            narrative="A multi-episode campaign representing seasonal weather change where the baseline rate of severe cascading events triples without advance warning at episode 30. The online Dirichlet adapter and CUSUM change-point detector must track the shift.",
            default_variant="default",
        ),
        "chaos_soup": ScenarioMetadata(
            id="chaos_soup",
            title="Chaos Soup",
            narrative="An adversarial operational test combining randomized event duplicates, network latency causing out-of-order arrivals up to 8 minutes late, erroneous reports that are later retracted, and intermittent sensor drops.",
            default_variant="default",
        ),
    }

    @classmethod
    def get_narrative(cls, scenario_id: str) -> str:
        scen = cls.SCENARIOS.get(scenario_id)
        return scen.narrative if scen else "Operational crisis scenario in Meridian."

    @classmethod
    def generate_episode(
        cls,
        scenario_id: str,
        total_minutes: int = 15,
        seed: int = 42,
        variant: str = "default",
        world_cfg_path: str = "config/world.yaml",
        causal_cfg_path: str = "config/causal_graph.yaml",
    ) -> List[List[Event]]:
        """
        Generates simulated events bucketed by minute [0 ... total_minutes - 1].
        """
        gen = EventGenerator(world_cfg_path, causal_cfg_path, seed=seed)
        fault_injector = FaultInjector(seed=seed)
        start_time = datetime(2026, 10, 25, 0, 0, 0, tzinfo=timezone.utc)

        # 1. Tuesday Evening Hero
        if scenario_id == "tuesday_evening":
            is_cascade = (variant == "cascade")
            active_nodes = {
                "HEAVY_RAIN": 0.0,
                "DRAINAGE_OVERLOAD": 3.0,
                "TRAFFIC_COLLAPSE": 5.0,
                "EMERGENCY_CALL_SURGE": 6.5,
            }
            if is_cascade:
                active_nodes["STREET_FLOODING"] = 7.0
                active_nodes["HOSPITAL_SURGE"] = 8.0
                active_nodes["POWER_SUBSTATION_TRIP"] = 9.0
                active_nodes["GATEWAY_OUTAGE"] = 10.0
                hypothesis = "CASCADE"
            else:
                hypothesis = "NOISE"

            # Pre-split minutes (0 to 6) are generated with fixed seed for identical twin prefixes
            pre_split_gen = EventGenerator(world_cfg_path, causal_cfg_path, seed=seed * 1000 + 7)
            pre_split_nodes = {
                "HEAVY_RAIN": 0.0,
                "DRAINAGE_OVERLOAD": 3.0,
                "TRAFFIC_COLLAPSE": 5.0,
                "EMERGENCY_CALL_SURGE": 6.5,
            }

            episode_events: List[List[Event]] = []
            for t in range(total_minutes):
                if t < 7:
                    # Identical events for both variants
                    evts = pre_split_gen.generate_events_for_minute(
                        t, start_time, hypothesis="CASCADE", active_nodes=pre_split_nodes, scenario_name="tuesday_hero"
                    )
                else:
                    # Diverging futures at t >= 7
                    evts = gen.generate_events_for_minute(
                        t, start_time, hypothesis=hypothesis, active_nodes=active_nodes, scenario_name="tuesday_hero"
                    )
                episode_events.append(evts)
            return episode_events

        # 2. Just a storm
        elif scenario_id == "just_a_storm":
            nodes = {"HEAVY_RAIN": 0.0, "DRAINAGE_OVERLOAD": 2.0, "TRAFFIC_COLLAPSE": 4.0}
            return [
                gen.generate_events_for_minute(t, start_time, "NOISE", nodes)
                for t in range(total_minutes)
            ]

        # 3. Flu cluster
        elif scenario_id == "flu_cluster":
            nodes = {"FLU_CLUSTER": 1.0, "HOSPITAL_SURGE": 3.0}
            return [
                gen.generate_events_for_minute(t, start_time, "NOISE", nodes)
                for t in range(total_minutes)
            ]

        # 4. Gateway blackout
        elif scenario_id == "gateway_blackout":
            nodes = {"HEAVY_RAIN": 0.0, "DRAINAGE_OVERLOAD": 2.0}
            episode_events = []
            for t in range(total_minutes):
                evts = gen.generate_events_for_minute(t, start_time, "NOISE", nodes)
                if t >= 4:
                    fault_injector.inject_gateway_blackout("GW-B")
                evts = fault_injector.apply_faults(evts, start_time + timedelta(minutes=t))
                episode_events.append(evts)
            return episode_events

        # 5. Rumor wave
        elif scenario_id == "rumor_wave":
            nodes = {"RUMOR_WAVE": 2.0, "EMERGENCY_CALL_SURGE": 4.0}
            return [
                gen.generate_events_for_minute(t, start_time, "NOISE", nodes)
                for t in range(total_minutes)
            ]

        # 6. Isolated pipe burst
        elif scenario_id == "isolated_pipe_burst":
            nodes = {"DRAINAGE_OVERLOAD": 1.0, "STREET_FLOODING": 3.0}
            return [
                gen.generate_events_for_minute(t, start_time, "ISOLATED", nodes, epicenter="D4")
                for t in range(total_minutes)
            ]

        # 7. Sensor failure
        elif scenario_id == "sensor_failure":
            episode_events = []
            for t in range(total_minutes):
                evts = gen.generate_events_for_minute(t, start_time, "SENSOR_FAILURE", {})
                if t >= 3:
                    # Inject stuck-high sensors
                    for i in range(1, 15):
                        fault_injector.inject_sensor_stuck_high(f"gw-a-drai-{i:03d}", fixed_val=9.9)
                evts = fault_injector.apply_faults(evts, start_time + timedelta(minutes=t))
                episode_events.append(evts)
            return episode_events

        # 8. Full cascade
        elif scenario_id == "full_cascade":
            nodes = gen.sample_causal_activations("CASCADE", max_minutes=total_minutes)
            return [
                gen.generate_events_for_minute(t, start_time, "CASCADE", nodes)
                for t in range(total_minutes)
            ]

        # 9. Camera cutout
        elif scenario_id == "camera_cutout":
            nodes = {"HEAVY_RAIN": 0.0, "DRAINAGE_OVERLOAD": 2.0}
            episode_events = []
            for t in range(total_minutes):
                evts = gen.generate_events_for_minute(t, start_time, "CASCADE", nodes)
                if t >= 5:
                    fault_injector.inject_channel_cutout(Channel.CAMERA_FLOOD)
                evts = fault_injector.apply_faults(evts, start_time + timedelta(minutes=t))
                episode_events.append(evts)
            return episode_events

        # 10. Structured liars
        elif scenario_id == "structured_liars":
            episode_events = []
            for t in range(total_minutes):
                evts = gen.generate_events_for_minute(t, start_time, "SENSOR_FAILURE", {})
                if t >= 3:
                    # 40 correlated sensors agree falsely
                    for i in range(1, 41):
                        fault_injector.inject_sensor_stuck_high(f"gw-b-traff-{i:03d}", fixed_val=8.8)
                evts = fault_injector.apply_faults(evts, start_time + timedelta(minutes=t))
                episode_events.append(evts)
            return episode_events

        # 11. Monsoon shift
        elif scenario_id == "monsoon_shift":
            is_post_shift = (variant == "post_shift" or seed >= 30)
            hyp = "CASCADE" if is_post_shift else "NOISE"
            nodes = gen.sample_causal_activations(hyp, max_minutes=total_minutes)
            return [
                gen.generate_events_for_minute(t, start_time, hyp, nodes)
                for t in range(total_minutes)
            ]

        # 12. Chaos soup
        else:
            nodes = {"HEAVY_RAIN": 0.0, "DRAINAGE_OVERLOAD": 2.0}
            episode_events = []
            for t in range(total_minutes):
                evts = gen.generate_events_for_minute(t, start_time, "NOISE", nodes)
                fault_injector.generate_out_of_order(evts, late_fraction=0.20, max_delay_min=6)
                dups = fault_injector.generate_duplicates(evts, dup_fraction=0.25)
                rets = fault_injector.generate_retractions(evts, retract_fraction=0.08)
                combined = evts + dups + rets
                episode_events.append(combined)
            return episode_events
