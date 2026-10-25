from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional
from backend.app.schemas import Event
from backend.sim.scenarios import ScenarioLibrary


@dataclass
class TwinPair:
    twin_id: str
    seed: int
    split_minute: int
    twin_a: List[List[Event]]  # Benign variant
    twin_b: List[List[Event]]  # Cascade variant
    twin_c: Optional[List[List[Event]]] = None  # Optional 3-way: Flu cluster
    twin_d: Optional[List[List[Event]]] = None  # Optional 4-way: Sensor failure


class TwinGenerator:
    """
    Generates exact identical-prefix twin episodes that diverge at minute 7.
    Used for verifying zero-divergence pre-split consistency and calibration.
    """

    @classmethod
    def generate_pair(cls, seed: int = 42, total_minutes: int = 15, split_minute: int = 7) -> TwinPair:
        twin_id = f"twin-{seed:04d}"

        # Generate Twin A (benign) and Twin B (cascade)
        twin_a_events = ScenarioLibrary.generate_episode(
            scenario_id="tuesday_evening",
            total_minutes=total_minutes,
            seed=seed,
            variant="benign",
        )

        twin_b_events = ScenarioLibrary.generate_episode(
            scenario_id="tuesday_evening",
            total_minutes=total_minutes,
            seed=seed,
            variant="cascade",
        )

        # Enforce exact bit-for-bit identity for t < split_minute
        for t in range(min(split_minute, total_minutes)):
            # Deep clone twin_a events into twin_b for t < split_minute
            twin_b_events[t] = [e.model_copy(deep=True) for e in twin_a_events[t]]

        return TwinPair(
            twin_id=twin_id,
            seed=seed,
            split_minute=split_minute,
            twin_a=twin_a_events,
            twin_b=twin_b_events,
        )

    @classmethod
    def generate_multi_way(cls, seed: int = 42, total_minutes: int = 15) -> TwinPair:
        pair = cls.generate_pair(seed=seed, total_minutes=total_minutes, split_minute=7)

        # Generate 3-way (Flu cluster) and 4-way (Sensor failure)
        flu_events = ScenarioLibrary.generate_episode("flu_cluster", total_minutes=total_minutes, seed=seed)
        sensor_events = ScenarioLibrary.generate_episode("sensor_failure", total_minutes=total_minutes, seed=seed)

        # Clone identical prefix for t < 7
        for t in range(7):
            flu_events[t] = [e.model_copy(deep=True) for e in pair.twin_a[t]]
            sensor_events[t] = [e.model_copy(deep=True) for e in pair.twin_a[t]]

        pair.twin_c = flu_events
        pair.twin_d = sensor_events
        return pair
