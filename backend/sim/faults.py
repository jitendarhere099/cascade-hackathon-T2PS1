from __future__ import annotations
from datetime import datetime, timedelta
import random
from typing import Any, Dict, List, Optional, Set
from backend.app.schemas import Channel, Event, EventKind, LedgerStatus


class FaultInjector:
    """
    Applies real-time synthetic corruptions and adversarial stresses to the event stream.
    Used by scenario presets, stress lab, and chaos testing.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        self.rng = random.Random(seed)
        self.active_faults: Dict[str, Dict[str, Any]] = {}
        self.masked_gateways: Set[str] = set()
        self.cutout_channels: Set[Channel] = set()
        self.stuck_sensors: Dict[str, float] = {}
        self.skewed_sources: Dict[str, float] = {}

    def inject_gateway_blackout(self, gateway_id: str) -> None:
        self.masked_gateways.add(gateway_id)

    def inject_channel_cutout(self, channel: Channel) -> None:
        self.cutout_channels.add(channel)

    def inject_sensor_stuck_high(self, sensor_id: str, fixed_val: float = 9.9) -> None:
        self.stuck_sensors[sensor_id] = fixed_val

    def inject_clock_skew(self, source_id: str, skew_seconds: float = 180.0) -> None:
        self.skewed_sources[source_id] = skew_seconds

    def apply_faults(self, events: List[Event], current_time: datetime) -> List[Event]:
        """
        Transforms a batch of generated events according to active fault rules.
        """
        output: List[Event] = []
        retractions_to_add: List[Event] = []

        for e in events:
            # 1. Gateway masking (sensors behind blacked out gateway drop)
            if e.gateway_id and e.gateway_id in self.masked_gateways:
                # Gateway is dead, sensor events are masked
                continue

            # 2. Channel cutout
            if e.channel in self.cutout_channels:
                continue

            # 3. Sensor stuck-high
            if e.source_id in self.stuck_sensors:
                e.value = self.stuck_sensors[e.source_id]

            # 4. Clock skew
            if e.source_id in self.skewed_sources:
                e.event_time = e.event_time + timedelta(seconds=self.skewed_sources[e.source_id])

            output.append(e)

        return output

    def generate_duplicates(self, events: List[Event], dup_fraction: float = 0.2) -> List[Event]:
        """Injects duplicate copies of events arriving slightly later."""
        dups: List[Event] = []
        for e in events:
            if self.rng.random() < dup_fraction:
                dup_e = Event(
                    id=f"{e.id}-dup{self.rng.randint(1, 999)}",
                    source_id=e.source_id,
                    channel=e.channel,
                    gateway_id=e.gateway_id,
                    district=e.district,
                    event_time=e.event_time,
                    arrival_time=e.arrival_time + timedelta(seconds=self.rng.randint(5, 45)),
                    value=e.value,
                    payload_hash=e.payload_hash,
                    kind=e.kind,
                )
                dups.append(dup_e)
        return dups

    def generate_out_of_order(self, events: List[Event], late_fraction: float = 0.15, max_delay_min: int = 8) -> None:
        """Delays the arrival_time of some events so they arrive minutes after their event_time."""
        for e in events:
            if self.rng.random() < late_fraction:
                delay_sec = self.rng.randint(60, max_delay_min * 60)
                e.arrival_time = e.event_time + timedelta(seconds=delay_sec)

    def generate_retractions(self, events: List[Event], retract_fraction: float = 0.05) -> List[Event]:
        """Creates retraction events that withdraw previously emitted events."""
        retractions: List[Event] = []
        for e in events:
            if e.kind == EventKind.OBSERVATION and self.rng.random() < retract_fraction:
                retractions.append(Event(
                    id=f"ret-{e.id}",
                    source_id=e.source_id,
                    channel=e.channel,
                    gateway_id=e.gateway_id,
                    district=e.district,
                    event_time=e.event_time + timedelta(minutes=1),
                    arrival_time=e.arrival_time + timedelta(minutes=2),
                    retracts=e.id,
                    kind=EventKind.RETRACTION,
                ))
        return retractions
