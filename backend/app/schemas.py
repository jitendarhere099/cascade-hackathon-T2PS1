from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field, field_validator


class Channel(str, Enum):
    DRAINAGE_SENSOR = "drainage_sensor"
    TRAFFIC_SENSOR = "traffic_sensor"
    EMERGENCY_CALL = "emergency_call"
    HOSPITAL_ARRIVAL = "hospital_arrival"
    POWER_GRID = "power_grid"
    CITIZEN_REPORT = "citizen_report"
    SOCIAL_POST = "social_post"
    CAMERA_FLOOD = "camera_flood"
    HEARTBEAT = "heartbeat"


class Hypothesis(str, Enum):
    NOISE = "NOISE"
    SENSOR_FAILURE = "SENSOR_FAILURE"
    ISOLATED = "ISOLATED"
    CASCADE = "CASCADE"


class Action(str, Enum):
    WATCH = "WATCH"
    PREPARE = "PREPARE"
    ALERT = "ALERT"
    ESCALATE = "ESCALATE"


class LedgerStatus(str, Enum):
    FRESH = "fresh"
    LATE = "late"
    DUPLICATE = "duplicate"
    RETRACTED = "retracted"
    QUARANTINED = "quarantined"
    DISCOUNTED = "discounted"


class EventKind(str, Enum):
    OBSERVATION = "observation"
    RETRACTION = "retraction"
    HEARTBEAT = "heartbeat"


class Event(BaseModel):
    id: str
    source_id: str
    channel: Channel
    gateway_id: Optional[str] = None
    district: Optional[str] = None
    event_time: datetime
    arrival_time: datetime
    value: Optional[float] = None
    payload_hash: Optional[str] = None
    retracts: Optional[str] = None
    kind: EventKind = EventKind.OBSERVATION
    status: LedgerStatus = LedgerStatus.FRESH
    quarantine_reason: Optional[str] = None

    @field_validator("id", "source_id")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("String identifier cannot be empty")
        return v.strip()


class QuarantinedEvent(BaseModel):
    raw_data: Any
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ForecastItem(BaseModel):
    node: str
    window_start: float
    window_end: float
    prob: float
    causal_path: str
    rationale: str


class AttributionItem(BaseModel):
    cluster: str
    event_ids: List[str]
    delta_logodds: float
    label: str


class MindChangeInfo(BaseModel):
    changed: bool
    message: str


class DevilsAdvocateInfo(BaseModel):
    hypothesis: str
    probability: float
    evidence: str


class BeliefUpdate(BaseModel):
    episode_id: str
    t: int
    wall_clock: str
    probs: Dict[str, float]
    raw_probs: Dict[str, float]
    intervals_90: Dict[str, Tuple[float, float]]
    ess: float
    nuisance: Dict[str, Any]
    action: Action
    action_expected_costs: Dict[str, float]
    value_of_waiting: float
    decision_margin: float
    fatigue: float
    flip_count: int
    dwell_remaining: int
    reason_codes: List[str]
    forecast: List[ForecastItem]
    next_best_observation: str
    data_health: Dict[str, str]
    source_trust: Dict[str, float]
    attribution: List[AttributionItem]
    mind_change: MindChangeInfo
    devils_advocate: DevilsAdvocateInfo
    why_not_escalate: str
    ledger_stats: Dict[str, int]
    officer_action: Optional[str] = None

    @field_validator("probs", "raw_probs")
    @classmethod
    def validate_finite_probs(cls, v: Dict[str, float]) -> Dict[str, float]:
        import math
        for k, val in v.items():
            if math.isnan(val) or math.isinf(val):
                raise ValueError(f"Probability for {k} must be finite: got {val}")
        return v


class OfficerDecisionRequest(BaseModel):
    action: Action
    t: int
    notes: Optional[str] = None


class EpisodeCreateRequest(BaseModel):
    scenario: str = "tuesday_evening"
    variant: Optional[str] = "cascade"
    seed: int = 42
    speed: float = 1.0


class FaultInjectionRequest(BaseModel):
    fault_type: str
    target: Optional[str] = None
    duration_min: Optional[int] = 5
    params: Dict[str, Any] = Field(default_factory=dict)
