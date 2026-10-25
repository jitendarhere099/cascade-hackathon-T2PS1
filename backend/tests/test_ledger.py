from datetime import datetime, timedelta, timezone
from backend.app.ledger import BitemporalLedger
from backend.app.schemas import Channel, Event, EventKind, LedgerStatus


def test_ledger_exact_dedupe():
    ledger = BitemporalLedger()
    now = datetime.now(timezone.utc)
    e1 = Event(
        id="evt-100",
        source_id="gw-a-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D1",
        event_time=now,
        arrival_time=now,
        value=2.5,
    )
    e2 = Event(
        id="evt-100",
        source_id="gw-a-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D1",
        event_time=now,
        arrival_time=now + timedelta(seconds=5),
        value=2.5,
    )

    ev1, rb1 = ledger.ingest(e1)
    ev2, rb2 = ledger.ingest(e2)

    assert ev1.status == LedgerStatus.FRESH
    assert ev2.status == LedgerStatus.DUPLICATE
    assert rb2 is False

    valid = ledger.get_events_for_minute(now + timedelta(minutes=1))
    assert len(valid) == 1
    assert valid[0].id == "evt-100"


def test_ledger_fuzzy_dedupe():
    ledger = BitemporalLedger()
    # Align to second 5 so +10s is guaranteed within the same 30s floor bucket [0s, 30s)
    now = datetime(2026, 10, 25, 12, 0, 5, tzinfo=timezone.utc)
    e1 = Event(
        id="evt-a",
        source_id="gw-a-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D1",
        event_time=now,
        arrival_time=now,
        value=2.501,
    )
    e2 = Event(
        id="evt-b",  # different id
        source_id="gw-a-drain",
        channel=Channel.DRAINAGE_SENSOR,
        district="D1",
        event_time=now + timedelta(seconds=10),  # within same 30s floor (15s)
        arrival_time=now + timedelta(seconds=11),
        value=2.504,  # rounds to 2.50
    )

    ev1, _ = ledger.ingest(e1)
    ev2, _ = ledger.ingest(e2)

    assert ev1.status == LedgerStatus.FRESH
    assert ev2.status == LedgerStatus.DUPLICATE


def test_ledger_retraction():
    ledger = BitemporalLedger()
    t0 = datetime.now(timezone.utc)
    e_obs = Event(
        id="obs-1",
        source_id="gw-b-sensor",
        channel=Channel.POWER_GRID,
        district="D3",
        event_time=t0,
        arrival_time=t0,
        value=1.0,
    )
    ledger.ingest(e_obs)
    assert e_obs.status == LedgerStatus.FRESH

    # Retract it later
    e_retract = Event(
        id="ret-1",
        source_id="gw-b-sensor",
        channel=Channel.POWER_GRID,
        district="D3",
        event_time=t0 + timedelta(minutes=2),
        arrival_time=t0 + timedelta(minutes=2),
        retracts="obs-1",
        kind=EventKind.RETRACTION,
    )
    _, needs_rollback = ledger.ingest(e_retract)
    assert needs_rollback is True
    assert e_obs.status == LedgerStatus.RETRACTED

    # Ensure retracted event does not appear in valid active events
    valid = ledger.get_events_for_minute(t0 + timedelta(minutes=5))
    assert len(valid) == 0


def test_ledger_late_event_triggers_rollback():
    ledger = BitemporalLedger()
    sim_time = datetime.now(timezone.utc)
    old_event = Event(
        id="late-1",
        source_id="citizen-app",
        channel=Channel.CITIZEN_REPORT,
        district="D2",
        event_time=sim_time - timedelta(minutes=4),  # occurred 4 min ago
        arrival_time=sim_time,
    )
    ev, needs_rollback = ledger.ingest(old_event, current_sim_time=sim_time)
    assert ev.status == LedgerStatus.LATE
    assert needs_rollback is True


def test_ledger_quarantine_malformed():
    ledger = BitemporalLedger()
    bad_dict = {"invalid_field": 1234}
    ev, needs_rollback = ledger.ingest(bad_dict)
    assert ev is None
    assert needs_rollback is False
    stats = ledger.get_ledger_stats()
    assert stats[LedgerStatus.QUARANTINED.value] == 1
    assert len(ledger.get_quarantined()) == 1
