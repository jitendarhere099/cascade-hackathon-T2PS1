from __future__ import annotations
from typing import Dict, Any
import numpy as np


class StateTransitions:
    """
    Vectorized state transition dynamics for the particle filter.
    Advances hypothesis state H, onset timers, and nuisance Markov chains.
    """

    def __init__(self, world_cfg: Dict[str, Any]) -> None:
        self.cfg = world_cfg.get("dynamics", {})
        self.switch_hazard = self.cfg.get("switch_hazard", 0.01)
        self.isolated_to_cascade_hazard = self.cfg.get("isolated_to_cascade_hazard", 0.03)
        self.rain_transitions = self.cfg.get("rain_transitions", {
            "none_to_mod": 0.05,
            "mod_to_heavy": 0.10,
            "heavy_to_mod": 0.08,
            "mod_to_none": 0.05,
        })
        self.flu_persistence = self.cfg.get("flu_persistence", 0.98)
        self.rumor_persistence = self.cfg.get("rumor_persistence", 0.90)
        self.gw_fail_base = self.cfg.get("gateway_failure_base", 0.005)
        self.gw_power_trip_hazard = self.cfg.get("gateway_power_trip_hazard", 0.25)

    def transition_particles(
        self,
        rng: np.random.RandomState,
        h_array: np.ndarray,          # (N,) in [0: NOISE, 1: SENSOR_FAILURE, 2: ISOLATED, 3: CASCADE]
        onset_array: np.ndarray,      # (N,)
        rain_array: np.ndarray,       # (N,) in [0, 1, 2]
        flu_array: np.ndarray,        # (N,) in [0, 1]
        rumor_array: np.ndarray,      # (N,) in [0, 1]
        gw_out_array: np.ndarray,     # (N, 4) in [0, 1]
        t: int,
    ) -> None:
        """Modifies particle state arrays in-place to advance one simulated minute."""
        N = len(h_array)

        # 1. Hypothesis Transitions (Switch hazards)
        # ISOLATED -> CASCADE progression
        isolated_mask = (h_array == 2)
        grow_roll = rng.uniform(0.0, 1.0, size=N)
        transition_to_cascade = isolated_mask & (grow_roll < self.isolated_to_cascade_hazard)
        h_array[transition_to_cascade] = 3

        # General switch hazard from NOISE
        noise_mask = (h_array == 0)
        switch_roll = rng.uniform(0.0, 1.0, size=N)
        switch_mask = noise_mask & (switch_roll < self.switch_hazard)
        if np.any(switch_mask):
            target_h = rng.choice([1, 2, 3], size=np.sum(switch_mask), p=[0.25, 0.40, 0.35])
            h_array[switch_mask] = target_h
            onset_array[switch_mask] = float(t)

        # 2. Rain Markov transitions
        r_roll = rng.uniform(0.0, 1.0, size=N)
        # 0 (none) -> 1 (mod)
        to_mod = (rain_array == 0) & (r_roll < self.rain_transitions["none_to_mod"])
        rain_array[to_mod] = 1
        # 1 (mod) -> 2 (heavy) or 0 (none)
        to_heavy = (rain_array == 1) & (r_roll < self.rain_transitions["mod_to_heavy"])
        to_none = (rain_array == 1) & (r_roll > (1.0 - self.rain_transitions["mod_to_none"]))
        rain_array[to_heavy] = 2
        rain_array[to_none] = 0
        # 2 (heavy) -> 1 (mod)
        to_mod_from_heavy = (rain_array == 2) & (r_roll < self.rain_transitions["heavy_to_mod"])
        rain_array[to_mod_from_heavy] = 1

        # 3. Flu & Rumor persistence
        flu_decay = rng.uniform(0.0, 1.0, size=N) > self.flu_persistence
        flu_array[flu_decay] = 0

        rumor_decay = rng.uniform(0.0, 1.0, size=N) > self.rumor_persistence
        rumor_array[rumor_decay] = 0

        # 4. Gateway Outage transitions
        # Raised probability if CASCADE and t - onset >= 8 min (power trip stage)
        cascade_late = (h_array == 3) & ((t - onset_array) >= 8.0)
        for g in range(4):
            fail_prob = np.where(cascade_late, self.gw_power_trip_hazard, self.gw_fail_base)
            gw_roll = rng.uniform(0.0, 1.0, size=N)
            new_fails = (gw_out_array[:, g] == 0) & (gw_roll < fail_prob)
            gw_out_array[new_fails, g] = 1
