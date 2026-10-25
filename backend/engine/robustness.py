from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np

from backend.app.schemas import Channel, Event, EventKind


class RobustnessManager:
    """
    Guards against correlated sensor failures, rumor waves, structured lies,
    channel cutouts, and numerical instability.
    """

    def __init__(self, epsilon_floor: float = 0.005) -> None:
        self.epsilon_floor = epsilon_floor

    def cluster_events(self, events: List[Event]) -> List[Tuple[str, List[Event], float]]:
        """
        Groups events into correlation clusters (e.g., shared gateway or identical text hash).
        Returns list of (cluster_name, event_list, effective_weight).
        Each cluster of size m receives effective evidence scaled by sqrt(m) / m.
        """
        clusters: Dict[str, List[Event]] = {}
        for e in events:
            if e.kind == EventKind.HEARTBEAT:
                continue

            # Key on gateway if sensor, or text payload hash if social/citizen
            if e.payload_hash and e.channel in (Channel.SOCIAL_POST, Channel.CITIZEN_REPORT):
                key = f"text-hash:{e.payload_hash}"
            elif e.gateway_id:
                key = f"gw:{e.gateway_id}:{e.channel.value}"
            else:
                key = f"src:{e.source_id}"

            if key not in clusters:
                clusters[key] = []
            clusters[key].append(e)

        result: List[Tuple[str, List[Event], float]] = []
        for key, ev_list in clusters.items():
            m = len(ev_list)
            # Effective sample size sqrt(m), so per-event weight is sqrt(m) / m = 1 / sqrt(m)
            eff_weight = math.sqrt(m) / float(m) if m > 0 else 1.0
            result.append((key, ev_list, eff_weight))

        return result

    def detect_common_cause_failure(self, events: List[Event]) -> Tuple[bool, float, Optional[str]]:
        """
        Detects if a cluster of sensors agrees suspiciously perfectly (variance ~ 0)
        indicating a shared firmware or gateway glitch rather than real physical disaster.
        Returns: (is_common_cause, confidence, cluster_key)
        """
        gw_groups: Dict[str, List[float]] = {}
        for e in events:
            if e.gateway_id and e.value is not None and e.channel in (Channel.DRAINAGE_SENSOR, Channel.TRAFFIC_SENSOR):
                if e.gateway_id not in gw_groups:
                    gw_groups[e.gateway_id] = []
                gw_groups[e.gateway_id].append(e.value)

        for gw_id, vals in gw_groups.items():
            if len(vals) >= 12:  # High number of reporting sensors
                var = float(np.var(vals))
                mean = float(np.mean(vals))
                # If values are high but variance is near zero (< 0.05)
                if mean > 3.0 and var < 0.05:
                    return True, 0.95, gw_id

        return False, 0.0, None

    def detect_rumor_wave(self, events: List[Event]) -> Tuple[bool, float]:
        """
        Detects if social/citizen reports explode with high text duplication while
        physical telemetry (drainage, traffic, camera, power) is quiet.
        """
        social_count = sum(1 for e in events if e.channel in (Channel.SOCIAL_POST, Channel.CITIZEN_REPORT))
        physical_count = sum(1 for e in events if e.channel in (Channel.DRAINAGE_SENSOR, Channel.TRAFFIC_SENSOR, Channel.POWER_GRID, Channel.CAMERA_FLOOD))

        hashes: Dict[str, int] = {}
        for e in events:
            if e.payload_hash:
                hashes[e.payload_hash] = hashes.get(e.payload_hash, 0) + 1

        dup_hash_count = sum(cnt for cnt in hashes.values() if cnt >= 3)

        if social_count >= 8 and physical_count <= 2 and dup_hash_count >= 5:
            return True, 0.90
        return False, 0.0

    def compute_data_health(self, events: List[Event], total_expected_channels: Set[Channel]) -> Dict[str, str]:
        """
        Audits channel health for the current minute:
        OK | DEGRADED | MISSING
        """
        counts: Dict[Channel, int] = {ch: 0 for ch in total_expected_channels}
        for e in events:
            if e.channel in counts:
                counts[e.channel] += 1

        health: Dict[str, str] = {}
        for ch in total_expected_channels:
            if ch == Channel.HEARTBEAT:
                continue
            cnt = counts[ch]
            if cnt == 0:
                health[ch.value] = "MISSING"
            elif cnt < 2 and ch in (Channel.DRAINAGE_SENSOR, Channel.TRAFFIC_SENSOR):
                health[ch.value] = "DEGRADED"
            else:
                health[ch.value] = "OK"

        return health

    def compute_tempering_exponent(self, unique_sources_count: int, ess_ratio: float) -> float:
        """
        Computes tau in (0, 1] shrinking when source diversity is low or ESS is degraded.
        """
        diversity_factor = min(1.0, math.sqrt(max(1, unique_sources_count) / 10.0))
        ess_factor = min(1.0, math.sqrt(max(0.1, ess_ratio)))
        tau = diversity_factor * ess_factor
        return float(np.clip(tau, 0.15, 1.0))

    def apply_probability_floor(self, probs: np.ndarray) -> np.ndarray:
        """
        Enforces epsilon-contamination floor so no hypothesis can drop below floor.
        Ensures strict sum to 1.0.
        """
        K = len(probs)
        eps = self.epsilon_floor
        # (1 - K * eps) * p + eps
        smoothed = (1.0 - K * eps) * probs + eps
        smoothed = np.clip(smoothed, eps, 1.0)
        return smoothed / np.sum(smoothed)
