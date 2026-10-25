export type Hypothesis = 'NOISE' | 'SENSOR_FAILURE' | 'ISOLATED' | 'CASCADE';

export type Action = 'WATCH' | 'PREPARE' | 'ALERT' | 'ESCALATE';

export type Channel =
  | 'drainage_sensor'
  | 'traffic_sensor'
  | 'emergency_call'
  | 'hospital_arrival'
  | 'power_grid'
  | 'citizen_report'
  | 'social_post'
  | 'camera_flood'
  | 'heartbeat';

export type LedgerStatus =
  | 'fresh'
  | 'late'
  | 'duplicate'
  | 'retracted'
  | 'quarantined'
  | 'discounted';

export interface EventItem {
  id: string;
  source_id: string;
  channel: Channel;
  gateway_id: string | null;
  district: string | null;
  event_time: string;
  arrival_time: string;
  value: number | null;
  payload_hash: string | null;
  retracts: string | null;
  kind: 'observation' | 'retraction' | 'heartbeat';
  status: LedgerStatus;
  quarantine_reason?: string | null;
}

export interface ForecastItem {
  node: string;
  window_start: number;
  window_end: number;
  prob: number;
  causal_path: string;
  rationale: string;
  status?: 'PENDING' | 'HIT' | 'EARLY' | 'LATE' | 'MISS';
}

export interface AttributionItem {
  cluster: string;
  event_ids: string[];
  delta_logodds: number;
  label: string;
}

export interface MindChangeInfo {
  changed: boolean;
  message: string;
}

export interface DevilsAdvocateInfo {
  hypothesis: Hypothesis;
  probability: number;
  evidence: string;
}

export interface BeliefUpdate {
  episode_id: string;
  t: number;
  wall_clock: string;
  probs: Record<Hypothesis, number>;
  raw_probs: Record<Hypothesis, number>;
  intervals_90: Record<Hypothesis, [number, number]>;
  ess: number;
  nuisance: {
    rain: string;
    flu: number;
    rumor: number;
    gateway_outage: Record<string, number>;
  };
  action: Action;
  action_expected_costs: Record<Action, number>;
  value_of_waiting: number;
  decision_margin: number;
  fatigue: number;
  flip_count: number;
  dwell_remaining: number;
  reason_codes: string[];
  forecast: ForecastItem[];
  next_best_observation: string;
  data_health: Record<string, 'OK' | 'DEGRADED' | 'MISSING'>;
  source_trust: Record<string, number>;
  attribution: AttributionItem[];
  mind_change: MindChangeInfo;
  devils_advocate: DevilsAdvocateInfo;
  why_not_escalate: string;
  ledger_stats: {
    fresh: number;
    late: number;
    duplicate: number;
    retracted: number;
    quarantined: number;
  };
  recent_events?: EventItem[];
  officer_action?: Action | null;
}

export interface CostModelConfig {
  missed_cascade: {
    D0: number;
    g: number;
    prepare_reduction: number;
    alert_reduction: number;
    escalate_reduction: number;
  };
  false_alarms: {
    noise_or_sensor: {
      PREPARE: number;
      ALERT: number;
      ESCALATE: number;
    };
    isolated: {
      ALERT_discount: number;
      ESCALATE_penalty: number;
    };
  };
  fatigue: {
    kappa: number;
    half_life_min: number;
  };
  hysteresis: {
    dwell_raise: number;
    dwell_lower: number;
    switch_cost_weight: number;
    de_escalate_p_cascade_threshold: number;
    de_escalate_consecutive_minutes: number;
  };
}

export interface OfficerDecision {
  t: number;
  action: Action;
  system_action: Action;
  timestamp: string;
  notes?: string;
}

export interface BaselineScore {
  name: string;
  total_cost: number;
  lead_time_min: number;
  false_alarms: number;
  missed_cascades: number;
  flip_flops: number;
  brier_score: number;
}
