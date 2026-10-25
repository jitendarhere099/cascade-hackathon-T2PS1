from __future__ import annotations
from datetime import datetime, timedelta, timezone
import hashlib
import math
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np
import yaml

from backend.app.schemas import Channel, Event, EventKind
from backend.sim.city import MeridianCity


class EventGenerator:
    """
    Generative world model simulator for Meridian.
    Propagates causal graph activations through delay distributions,
    generates multi-channel anomaly events, and emits liveness heartbeats.
    """

    def __init__(self, world_config_path: str = "config/world.yaml", causal_graph_path: str = "config/causal_graph.yaml", seed: int = 42) -> None:
        self.city = MeridianCity()
        self.seed = seed
        self.rng = np.random.RandomState(seed)

        with open(world_config_path, "r", encoding="utf-8") as f:
            self.world_cfg = yaml.safe_load(f)

        with open(causal_graph_path, "r", encoding="utf-8") as f:
            self.causal_cfg = yaml.safe_load(f)

        self.rates = self.world_cfg["rates"]
        self.nodes = self.causal_cfg["nodes"]
        self.edges = self.causal_cfg["edges"]

    def sample_causal_activations(self, hypothesis: str, max_minutes: int = 30) -> Dict[str, float]:
        """
        Samples activation times (in minutes) for causal graph nodes given the hypothesis.
        Returns mapping: node_name -> activation_minute (float).
        """
        activations: Dict[str, float] = {}

        if hypothesis in ("CASCADE", "HEAVY_RAIN"):
            activations["HEAVY_RAIN"] = 0.0
        elif hypothesis == "ISOLATED":
            activations["DRAINAGE_OVERLOAD"] = 1.5
            activations["STREET_FLOODING"] = 3.0
        elif hypothesis == "FLU_CLUSTER":
            activations["FLU_CLUSTER"] = 0.0
        elif hypothesis == "RUMOR_WAVE":
            activations["RUMOR_WAVE"] = 0.0
        elif hypothesis == "GATEWAY_OUTAGE":
            activations["GATEWAY_OUTAGE"] = 0.0
            activations["SENSOR_SILENCE"] = 0.05

        # Forward propagation through edges
        changed = True
        while changed:
            changed = False
            for edge in self.edges:
                src = edge["source"]
                tgt = edge["target"]
                if src in activations and tgt not in activations:
                    p_act = edge["activation_prob"].get(hypothesis, 0.0)
                    if self.rng.uniform(0.0, 1.0) < p_act:
                        mu = edge["delay_lognormal"]["mu"]
                        sigma = edge["delay_lognormal"]["sigma"]
                        delay = self.rng.lognormal(mean=mu, sigma=sigma)
                        act_time = activations[src] + delay
                        if act_time <= max_minutes:
                            activations[tgt] = float(act_time)
                            changed = True

        return activations

    def generate_events_for_minute(
        self,
        t: int,
        sim_start_time: datetime,
        hypothesis: str,
        active_nodes: Dict[str, float],
        scenario_name: str = "default",
        epicenter: Optional[str] = None,
    ) -> List[Event]:
        """
        Generates all channel events occurring during minute t (interval [t, t+1)).
        """
        minute_start = sim_start_time + timedelta(minutes=t)
        minute_end = sim_start_time + timedelta(minutes=t + 1)
        events: List[Event] = []
        evt_counter = 0

        # Determine nuisance multipliers
        rain_active = "HEAVY_RAIN" in active_nodes and active_nodes["HEAVY_RAIN"] <= t
        flooding_active = "STREET_FLOODING" in active_nodes and active_nodes["STREET_FLOODING"] <= t
        traffic_active = "TRAFFIC_COLLAPSE" in active_nodes and active_nodes["TRAFFIC_COLLAPSE"] <= t
        calls_active = "EMERGENCY_CALL_SURGE" in active_nodes and active_nodes["EMERGENCY_CALL_SURGE"] <= t
        hospital_active = "HOSPITAL_SURGE" in active_nodes and active_nodes["HOSPITAL_SURGE"] <= t
        power_active = "POWER_SUBSTATION_TRIP" in active_nodes and active_nodes["POWER_SUBSTATION_TRIP"] <= t
        flu_active = "FLU_CLUSTER" in active_nodes and active_nodes["FLU_CLUSTER"] <= t
        rumor_active = "RUMOR_WAVE" in active_nodes and active_nodes["RUMOR_WAVE"] <= t

        for ch_key, r_cfg in self.rates.items():
            if ch_key == "heartbeat":
                continue

            channel = Channel(ch_key)
            base_rate = r_cfg["base"]
            rate = base_rate

            # Scenario and causal rate modulations
            if rain_active:
                rate *= r_cfg.get("heavy_rain_mult", 1.0)
            if flu_active:
                rate *= r_cfg.get("flu_cluster_mult", 1.0)
            if rumor_active:
                rate *= r_cfg.get("rumor_wave_mult", 1.0)

            # Specific channel activations
            if channel == Channel.DRAINAGE_SENSOR and (flooding_active or rain_active):
                rate += r_cfg.get("cascade_add", 4.0)
            elif channel == Channel.TRAFFIC_SENSOR and traffic_active:
                rate += r_cfg.get("cascade_add", 5.0)
            elif channel == Channel.EMERGENCY_CALL and calls_active:
                rate += r_cfg.get("cascade_add", 10.0)
            elif channel == Channel.HOSPITAL_ARRIVAL and hospital_active:
                rate += r_cfg.get("cascade_add", 6.0)
            elif channel == Channel.POWER_GRID and power_active:
                rate += r_cfg.get("cascade_add", 3.0)

            if hypothesis == "ISOLATED" and epicenter:
                rate += r_cfg.get("isolated_add", 1.0)

            # Sample count using Negative Binomial (via Gamma-Poisson mixture)
            k = r_cfg.get("dispersion_k", 2.0)
            gamma_shape = k
            gamma_scale = rate / k
            lambda_sample = self.rng.gamma(shape=gamma_shape, scale=max(1e-4, gamma_scale))
            count = self.rng.poisson(lam=lambda_sample)

            # Distribute counts across districts
            for _ in range(count):
                evt_counter += 1
                if hypothesis == "ISOLATED" and epicenter and self.rng.uniform(0, 1) < 0.75:
                    dist = epicenter
                else:
                    dist = self.city.DISTRICTS[list(self.city.DISTRICTS.keys())[self.rng.randint(0, 6)]].id

                # Pick sensor or source
                matching_sensors = [s for s in self.city.sensors.values() if s.channel == channel and s.district == dist]
                if matching_sensors:
                    sensor = matching_sensors[self.rng.randint(0, len(matching_sensors))]
                    source_id = sensor.id
                    gw_id = sensor.gateway_id
                else:
                    source_id = f"src-{dist.lower()}-{channel.value[:4]}"
                    gw_id = None

                # Generate event time within the minute
                sec_offset = self.rng.uniform(0.0, 59.9)
                evt_time = minute_start + timedelta(seconds=sec_offset)

                # Anomaly magnitude value
                val = float(self.rng.normal(loc=3.2 if (rain_active or flooding_active) else 1.2, scale=0.8))

                # Text payload hash for social and citizen channels
                payload_hash = None
                if channel in (Channel.SOCIAL_POST, Channel.CITIZEN_REPORT):
                    if rumor_active and self.rng.uniform(0, 1) < 0.7:
                        # Copy-paste rumor wave has repeated text hashes
                        payload_hash = "rumor-copypaste-hash-99a"
                    else:
                        payload_hash = hashlib.md5(f"text-{source_id}-{evt_time.isoformat()}".encode()).hexdigest()[:8]

                event = Event(
                    id=f"evt-{t:02d}-{channel.value[:3]}-{evt_counter:04d}",
                    source_id=source_id,
                    channel=channel,
                    gateway_id=gw_id,
                    district=dist,
                    event_time=evt_time,
                    arrival_time=evt_time,  # Ingest pipeline may delay
                    value=round(val, 2),
                    payload_hash=payload_hash,
                    kind=EventKind.OBSERVATION,
                )
                events.append(event)

        # Heartbeat generation: 1 per gateway and 1 per sensor group every minute
        for gw_id in self.city.GATEWAYS.keys():
            hb_event = Event(
                id=f"hb-gw-{gw_id}-{t:02d}",
                source_id=gw_id,
                channel=Channel.HEARTBEAT,
                gateway_id=gw_id,
                district=None,
                event_time=minute_start + timedelta(seconds=5.0),
                arrival_time=minute_start + timedelta(seconds=5.0),
                value=1.0,
                kind=EventKind.HEARTBEAT,
            )
            events.append(hb_event)

        return events
