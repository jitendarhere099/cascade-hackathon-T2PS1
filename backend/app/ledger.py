from __future__ import annotations
from datetime import datetime
import hashlib
import json
import math
from typing import Any, Dict, List, Optional, Set, Tuple
from backend.app.schemas import Channel, Event, EventKind, LedgerStatus, QuarantinedEvent


class BitemporalLedger:
    """
    Bitemporal Event Ledger.
    Tracks both event_time (when an anomaly occurred) and arrival_time (when it was ingested).
    Maintains deduplication, retractions, quarantine, and generates deterministic content hashes
    for checkpoint rollbacks.
    """

    def __init__(self) -> None:
        self.events: List[Event] = []
        self.events_by_id: Dict[str, Event] = {}
        self.exact_ids: Set[str] = set()
        self.fuzzy_keys: Set[Tuple[Any, ...]] = set()
        self.quarantined: List[QuarantinedEvent] = []
        self._counts: Dict[str, int] = {
            LedgerStatus.FRESH.value: 0,
            LedgerStatus.LATE.value: 0,
            LedgerStatus.DUPLICATE.value: 0,
            LedgerStatus.RETRACTED.value: 0,
            LedgerStatus.QUARANTINED.value: 0,
            LedgerStatus.DISCOUNTED.value: 0,
        }

    def _make_fuzzy_key(self, event: Event) -> Tuple[Any, ...]:
        time_slot = math.floor(event.event_time.timestamp() / 30.0)
        val_sig = round(event.value, 2) if event.value is not None else None
        return (
            event.source_id,
            event.channel.value,
            event.district or "none",
            time_slot,
            event.payload_hash or val_sig,
        )

    def ingest(self, item: Any, current_sim_time: Optional[datetime] = None) -> Tuple[Optional[Event], bool]:
        """
        Ingests an event or raw dictionary.
        Returns:
            (event, needs_rollback): event object (if valid) and boolean indicating
            if an out-of-order/retraction requires rolling back the particle filter.
        """
        needs_rollback = False

        # 1. Validation & Schema parsing
        if isinstance(item, Event):
            event = item
        elif isinstance(item, dict):
            try:
                event = Event(**item)
            except Exception as e:
                self.quarantined.append(QuarantinedEvent(raw_data=item, reason=str(e)))
                self._counts[LedgerStatus.QUARANTINED.value] += 1
                return None, False
        else:
            self.quarantined.append(QuarantinedEvent(raw_data=str(item), reason="Input is neither Event nor dict"))
            self._counts[LedgerStatus.QUARANTINED.value] += 1
            return None, False

        # 2. Retraction Handling
        if event.kind == EventKind.RETRACTION:
            target_id = event.retracts
            if target_id and target_id in self.events_by_id:
                target = self.events_by_id[target_id]
                old_status = target.status
                target.status = LedgerStatus.RETRACTED
                self._counts[old_status.value] = max(0, self._counts[old_status.value] - 1)
                self._counts[LedgerStatus.RETRACTED.value] += 1
                event.status = LedgerStatus.FRESH
                self.events.append(event)
                self.events_by_id[event.id] = event
                # Retraction requires rollback to before the retracted event occurred
                return event, True
            else:
                event.status = LedgerStatus.FRESH
                self.events.append(event)
                self.events_by_id[event.id] = event
                return event, False

        # 3. Deduplication Check (Exact ID & Fuzzy Key)
        if event.id in self.exact_ids:
            event.status = LedgerStatus.DUPLICATE
            self._counts[LedgerStatus.DUPLICATE.value] += 1
            self.events.append(event)
            return event, False

        fuzzy_key = self._make_fuzzy_key(event)
        if fuzzy_key in self.fuzzy_keys:
            event.status = LedgerStatus.DUPLICATE
            self._counts[LedgerStatus.DUPLICATE.value] += 1
            self.events.append(event)
            self.exact_ids.add(event.id)
            return event, False

        # 4. Out-of-order / Late Check
        if current_sim_time is not None and event.event_time < current_sim_time:
            # Event occurred before current simulated time
            event.status = LedgerStatus.LATE
            self._counts[LedgerStatus.LATE.value] += 1
            needs_rollback = True
        else:
            event.status = LedgerStatus.FRESH
            self._counts[LedgerStatus.FRESH.value] += 1

        self.exact_ids.add(event.id)
        self.fuzzy_keys.add(fuzzy_key)
        self.events.append(event)
        self.events_by_id[event.id] = event

        return event, needs_rollback

    def get_events_for_minute(self, sim_minute_end: datetime) -> List[Event]:
        """
        Returns all valid events that have arrived by sim_minute_end,
        excluding duplicates and retractions, sorted by event_time.
        """
        valid = [
            e for e in self.events
            if e.arrival_time <= sim_minute_end
            and e.status not in (LedgerStatus.DUPLICATE, LedgerStatus.RETRACTED, LedgerStatus.QUARANTINED)
            and e.kind != EventKind.RETRACTION
        ]
        valid.sort(key=lambda x: x.event_time)
        return valid

    def get_ledger_stats(self) -> Dict[str, int]:
        return dict(self._counts)

    def get_quarantined(self) -> List[QuarantinedEvent]:
        return list(self.quarantined)

    def content_hash(self, up_to_arrival: Optional[datetime] = None) -> str:
        """
        Returns a SHA-256 hash of all events up to arrival time for deterministic RNG seeding.
        """
        hasher = hashlib.sha256()
        events_to_hash = self.events if up_to_arrival is None else [
            e for e in self.events if e.arrival_time <= up_to_arrival
        ]
        for e in events_to_hash:
            entry = f"{e.id}:{e.source_id}:{e.channel.value}:{e.event_time.isoformat()}:{e.status.value}"
            hasher.update(entry.encode("utf-8"))
        return hasher.hexdigest()

    def clear(self) -> None:
        self.events.clear()
        self.events_by_id.clear()
        self.exact_ids.clear()
        self.fuzzy_keys.clear()
        self.quarantined.clear()
        for k in self._counts:
            self._counts[k] = 0
