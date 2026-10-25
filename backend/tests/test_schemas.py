from datetime import datetime, timezone
import pytest
from pydantic import ValidationError
from backend.app.schemas import (
    Action,
    BeliefUpdate,
    Channel,
    Event,
    EventKind,
    Hypothesis,
    LedgerStatus,
)


def test_event_valid_instantiation():
    now = datetime.now(timezone.utc)
    e = Event(
        id="evt-1",
        source_id="sensor-d1",
        channel=Channel.DRAINAGE_SENSOR,
        district="D1",
        event_time=now,
        arrival_time=now,
        value=3.4,
    )
    assert e.id == "evt-1"
    assert e.channel == Channel.DRAINAGE_SENSOR
    assert e.status == LedgerStatus.FRESH


def test_event_empty_id_rejected():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        Event(
            id="",
            source_id="sensor-d1",
            channel=Channel.DRAINAGE_SENSOR,
            event_time=now,
            arrival_time=now,
        )


def test_belief_update_rejects_nan():
    now_str = datetime.now(timezone.utc).isoformat()
    with pytest.raises(ValidationError):
        BeliefUpdate(
            episode_id="ep-1",
            t=0,
            wall_clock=now_str,
            probs={"NOISE": float("nan"), "SENSOR_FAILURE": 0.1, "ISOLATED": 0.1, "CASCADE": 0.1},
            raw_probs={"NOISE": 0.7, "SENSOR_FAILURE": 0.1, "ISOLATED": 0.1, "CASCADE": 0.1},
            intervals_90={"NOISE": (0.6, 0.8)},
            ess=4000.0,
            nuisance={"rain": "none"},
            action=Action.WATCH,
            action_expected_costs={"WATCH": 0.0},
            value_of_waiting=0.0,
            decision_margin=10.0,
            fatigue=0.0,
            flip_count=0,
            dwell_remaining=0,
            reason_codes=[],
            forecast=[],
            next_best_observation="Watch for D1 drainage",
            data_health={"drainage_sensor": "OK"},
            source_trust={"sensor-d1": 0.95},
            attribution=[],
            mind_change={"changed": False, "message": "Stable"},
            devils_advocate={"hypothesis": "NOISE", "probability": 0.7, "evidence": "Normal baseline"},
            why_not_escalate="No cascading evidence",
            ledger_stats={"fresh": 10},
        )
