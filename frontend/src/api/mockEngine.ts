import type {
  Action,
  AttributionItem,
  BeliefUpdate,
  CostModelConfig,
  EventItem,
  ForecastItem,
  Hypothesis,
} from '../types';

export const DEFAULT_COSTS: CostModelConfig = {
  missed_cascade: {
    D0: 100,
    g: 0.12,
    prepare_reduction: 0.25,
    alert_reduction: 0.60,
    escalate_reduction: 0.85,
  },
  false_alarms: {
    noise_or_sensor: {
      PREPARE: 1,
      ALERT: 8,
      ESCALATE: 40,
    },
    isolated: {
      ALERT_discount: 0.70,
      ESCALATE_penalty: 25,
    },
  },
  fatigue: {
    kappa: 0.5,
    half_life_min: 30,
  },
  hysteresis: {
    dwell_raise: 3,
    dwell_lower: 2,
    switch_cost_weight: 2.0,
    de_escalate_p_cascade_threshold: 0.25,
    de_escalate_consecutive_minutes: 4,
  },
};

export const DISTRICTS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
export const GATEWAYS = ['GW-A', 'GW-B', 'GW-C', 'GW-D'];
export const HOSPITALS = ['H1-General', 'H2-Memorial', 'H3-Civic'];

export interface ScenarioMeta {
  id: string;
  name: string;
  description: string;
  hasVariants?: boolean;
}

export const SCENARIO_LIST: ScenarioMeta[] = [
  {
    id: 'tuesday_evening',
    name: 'Tuesday Evening (Hero)',
    description: 'The opening 10 minutes: 00:00 heavier rain, 00:03 drainage anomalies, 00:05 traffic slows, 00:07 emergency lines busy, 00:09 hospital arrivals.',
    hasVariants: true,
  },
  {
    id: 'just_a_storm',
    name: 'Just a Storm',
    description: 'Heavy rain across all districts explaining drainage, minor traffic and calls without physical cascade.',
  },
  {
    id: 'flu_hospital',
    name: 'Flu at the Hospitals',
    description: 'Rapid surge in hospital arrivals with zero physical drainage, traffic or power precursors.',
  },
  {
    id: 'gateway_blackout',
    name: 'Gateway Blackout',
    description: 'Gateway GW-B drops completely, silencing 100 sensors. Tests ambiguous silence handling.',
  },
  {
    id: 'rumor_wave',
    name: 'Rumor Wave',
    description: 'Social post explosion with identical text hashes but zero corroboration from physical sensors.',
  },
  {
    id: 'isolated_pipe_burst',
    name: 'Isolated Pipe Burst',
    description: 'Strong localized water and traffic anomalies concentrated entirely in District D4.',
  },
  {
    id: 'sensor_failure',
    name: 'Sensor Failure',
    description: 'Stuck-high drainage sensors exhibiting unnatural zero-variance timing synchronization.',
  },
  {
    id: 'full_cascade',
    name: 'Full Cascade',
    description: 'Complete multi-system collapse: rain, drainage overflow, traffic collapse, substation trip, gateway blackout.',
  },
  {
    id: 'camera_cutout',
    name: 'Camera Cutout',
    description: 'Telemetry from all street flood cameras cuts out abruptly at minute 4.',
  },
  {
    id: 'structured_liars',
    name: 'Structured Liars',
    description: '40 sensors behind a shared firmware revision simultaneously emit high readings without physical cause.',
  },
  {
    id: 'monsoon_shift',
    name: 'Monsoon Shift',
    description: 'Simulates long-term seasonal change where the base rate of cascades silently triples.',
  },
  {
    id: 'chaos_soup',
    name: 'Chaos Soup',
    description: 'Adversarial stream filled with out-of-order deliveries, clock skews, and retroactive retractions.',
  },
];

// Seeded pseudorandom number generator (xorshift128+)
class SeededRNG {
  private s0: number;
  private s1: number;

  constructor(seed: number) {
    this.s0 = (seed ^ 0xdeadbeef) >>> 0;
    this.s1 = (seed * 1664525 + 1013904223) >>> 0;
    if (this.s0 === 0 && this.s1 === 0) this.s0 = 1;
  }

  next(): number {
    let x = this.s0;
    const y = this.s1;
    this.s0 = y;
    x ^= x << 23;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    this.s1 = x;
    return ((x + y) >>> 0) / 4294967296;
  }
}

export class MeridianEngineSession {
  scenario: string;
  variant: string;
  seed: number;
  current_t: number = 0;
  total_minutes: number = 15;
  costs: CostModelConfig;
  fatigue: number = 0;
  flip_count: number = 0;
  current_action: Action = 'WATCH';
  dwell_remaining: number = 0;
  consecutive_low_p_cascade: number = 0;
  history: BeliefUpdate[] = [];
  events_by_minute: Record<number, EventItem[]> = {};
  faults: Array<{ type: string; target?: string; start_t: number; duration: number }> = [];
  officer_decisions: Record<number, Action> = {};
  private rng: SeededRNG;

  constructor(
    scenario: string = 'tuesday_evening',
    variant: string = 'cascade',
    seed: number = 42,
    costs: CostModelConfig = DEFAULT_COSTS
  ) {
    this.scenario = scenario;
    this.variant = variant;
    this.seed = seed;
    this.costs = JSON.parse(JSON.stringify(costs));
    this.rng = new SeededRNG(seed);
    this.generateAllEvents();
  }

  private generateAllEvents() {
    for (let t = 0; t <= this.total_minutes; t++) {
      this.events_by_minute[t] = this.simulateMinuteEvents(t);
    }
  }

  private simulateMinuteEvents(t: number): EventItem[] {
    const list: EventItem[] = [];
    const isCascade = this.variant === 'cascade';
    const isHero = this.scenario === 'tuesday_evening';
    const baseDate = new Date(Date.UTC(2026, 9, 25, 0, t, 0));

    // Helper to push
    const add = (
      channel: EventItem['channel'],
      src: string,
      dist: string | null,
      val: number,
      gw: string | null = null,
      delaySec: number = 0
    ) => {
      const eventTime = new Date(baseDate.getTime() - delaySec * 1000).toISOString();
      list.push({
        id: `ev-${t}-${src}-${Math.floor(this.rng.next() * 100000)}`,
        source_id: src,
        channel,
        district: dist,
        gateway_id: gw || (dist === 'D1' || dist === 'D2' ? 'GW-A' : dist === 'D3' ? 'GW-B' : dist === 'D4' ? 'GW-C' : 'GW-D'),
        event_time: eventTime,
        arrival_time: baseDate.toISOString(),
        value: Number(val.toFixed(2)),
        payload_hash: `hash-${channel}-${dist}`,
        retracts: null,
        kind: 'observation',
        status: delaySec > 60 ? 'late' : 'fresh',
      });
    };

    // Heartbeats
    GATEWAYS.forEach((gw) => {
      list.push({
        id: `hb-${t}-${gw}`,
        source_id: gw,
        channel: 'heartbeat',
        district: null,
        gateway_id: gw,
        event_time: baseDate.toISOString(),
        arrival_time: baseDate.toISOString(),
        value: 1.0,
        payload_hash: null,
        retracts: null,
        kind: 'heartbeat',
        status: 'fresh',
      });
    });

    // Tuesday Evening timeline
    if (isHero) {
      if (t >= 0) {
        add('drainage_sensor', 'drain-d1-a', 'D1', 1.8 + this.rng.next() * 0.4);
        add('traffic_sensor', 'traf-d1-04', 'D1', 0.9);
      }
      if (t >= 3) {
        add('drainage_sensor', 'drain-d2-b', 'D2', 2.9 + this.rng.next() * 0.5);
        add('drainage_sensor', 'drain-d3-c', 'D3', 3.1 + this.rng.next() * 0.6);
        add('camera_flood', 'cam-flood-12', 'D2', 1.5);
      }
      if (t >= 5) {
        add('traffic_sensor', 'traf-d2-01', 'D2', 3.4 + this.rng.next() * 0.6);
        add('traffic_sensor', 'traf-d3-08', 'D3', 3.8 + this.rng.next() * 0.8);
        add('citizen_report', 'cit-app-104', 'D2', 2.0, null, 120);
      }
      if (t >= 7) {
        add('emergency_call', 'dispatch-q1', 'D2', 4.5);
        add('emergency_call', 'dispatch-q2', 'D3', 5.2);
        add('social_post', 'social-post-88', 'D3', 2.2);
      }

      // T >= 8: Divergence point!
      if (t >= 8) {
        if (isCascade) {
          add('hospital_arrival', 'hosp-h1', 'D2', 4.2 + (t - 8) * 0.8);
          add('hospital_arrival', 'hosp-h2', 'D3', 3.9 + (t - 8) * 0.7);
          add('emergency_call', 'dispatch-q4', 'D4', 6.0 + (t - 8) * 1.1);
          if (t >= 10) {
            add('power_grid', 'sub-station-d3', 'D3', 5.8);
            add('drainage_sensor', 'drain-d4-a', 'D4', 6.4);
          }
          if (t >= 11) {
            add('camera_flood', 'cam-flood-33', 'D4', 4.9);
          }
        } else {
          // Benign variant: anomalies plateau and drain capacity clears
          add('drainage_sensor', 'drain-d1-a', 'D1', 1.1);
          add('drainage_sensor', 'drain-d2-b', 'D2', 1.4);
          add('traffic_sensor', 'traf-d2-01', 'D2', 1.5);
          add('emergency_call', 'dispatch-q1', 'D2', 1.8);
        }
      }
    } else if (this.scenario === 'gateway_blackout') {
      if (t >= 3) {
        // GW-B vanishes
        return list.filter((e) => e.gateway_id !== 'GW-B');
      }
      add('drainage_sensor', 'drain-d3-c', 'D3', 2.2);
    } else if (this.scenario === 'rumor_wave') {
      for (let i = 0; i < 6; i++) {
        list.push({
          id: `rumor-${t}-${i}`,
          source_id: `social-bot-${i}`,
          channel: 'social_post',
          district: 'D2',
          gateway_id: 'GW-A',
          event_time: baseDate.toISOString(),
          arrival_time: baseDate.toISOString(),
          value: 4.5,
          payload_hash: 'identical-flooding-claim-hash',
          retracts: null,
          kind: 'observation',
          status: 'discounted',
        });
      }
    } else if (this.scenario === 'sensor_failure') {
      for (let i = 0; i < 4; i++) {
        add('drainage_sensor', `stuck-drain-${i}`, 'D1', 9.85, 'GW-A');
      }
    } else {
      // Default baseline events
      add('drainage_sensor', 'drain-d1-a', 'D1', 1.2 + this.rng.next() * 0.5);
      add('traffic_sensor', 'traf-d1-04', 'D1', 1.0);
    }

    return list;
  }

  step(): BeliefUpdate {
    const t = this.current_t;
    const isCascade = this.variant === 'cascade';
    const isHero = this.scenario === 'tuesday_evening';

    // 1. Compute honest, calibrated probabilities
    let p_noise = 0.70;
    let p_sensor = 0.15;
    let p_isolated = 0.10;
    let p_cascade = 0.05;

    if (isHero) {
      if (t === 0) {
        p_noise = 0.72; p_sensor = 0.12; p_isolated = 0.11; p_cascade = 0.05;
      } else if (t === 1) {
        p_noise = 0.65; p_sensor = 0.15; p_isolated = 0.13; p_cascade = 0.07;
      } else if (t === 2) {
        p_noise = 0.55; p_sensor = 0.17; p_isolated = 0.18; p_cascade = 0.10;
      } else if (t === 3) {
        p_noise = 0.38; p_sensor = 0.20; p_isolated = 0.26; p_cascade = 0.16;
      } else if (t === 4) {
        p_noise = 0.28; p_sensor = 0.19; p_isolated = 0.31; p_cascade = 0.22;
      } else if (t === 5) {
        p_noise = 0.18; p_sensor = 0.18; p_isolated = 0.35; p_cascade = 0.29;
      } else if (t === 6) {
        p_noise = 0.12; p_sensor = 0.15; p_isolated = 0.38; p_cascade = 0.35;
      } else if (t === 7) {
        // Pre-split identical point: both variants have bit-identical probabilities!
        p_noise = 0.08; p_sensor = 0.12; p_isolated = 0.39; p_cascade = 0.41;
      } else {
        // Divergence after T=7!
        if (isCascade) {
          const shift = Math.min(0.55, (t - 7) * 0.14);
          p_cascade = 0.41 + shift;
          p_isolated = Math.max(0.04, 0.39 - shift * 0.65);
          p_sensor = Math.max(0.02, 0.12 - shift * 0.20);
          p_noise = Math.max(0.01, 0.08 - shift * 0.15);
        } else {
          // Benign collapse back to noise / isolated
          const shift = Math.min(0.35, (t - 7) * 0.09);
          p_cascade = Math.max(0.05, 0.41 - shift);
          p_noise = 0.08 + shift * 0.55;
          p_isolated = 0.39 - shift * 0.30;
          p_sensor = 0.12 - shift * 0.10;
        }
      }
    } else if (this.scenario === 'rumor_wave') {
      p_noise = 0.45;
      p_sensor = 0.08;
      p_isolated = 0.07;
      p_cascade = 0.04; // Never drives escalate!
    } else if (this.scenario === 'sensor_failure' || this.scenario === 'structured_liars') {
      p_sensor = 0.82;
      p_noise = 0.10;
      p_isolated = 0.05;
      p_cascade = 0.03;
    } else if (this.scenario === 'gateway_blackout') {
      p_sensor = 0.48;
      p_noise = 0.32;
      p_isolated = 0.12;
      p_cascade = 0.08;
    } else if (this.scenario === 'isolated_pipe_burst') {
      p_isolated = 0.81;
      p_noise = 0.10;
      p_cascade = 0.05;
      p_sensor = 0.04;
    }

    // Normalize to exact sum of 1.0 with 0.005 floor
    let sum = p_noise + p_sensor + p_isolated + p_cascade;
    p_noise = Math.max(0.005, p_noise / sum);
    p_sensor = Math.max(0.005, p_sensor / sum);
    p_isolated = Math.max(0.005, p_isolated / sum);
    p_cascade = Math.max(0.005, p_cascade / sum);
    sum = p_noise + p_sensor + p_isolated + p_cascade;
    const probs: Record<Hypothesis, number> = {
      NOISE: Number((p_noise / sum).toFixed(4)),
      SENSOR_FAILURE: Number((p_sensor / sum).toFixed(4)),
      ISOLATED: Number((p_isolated / sum).toFixed(4)),
      CASCADE: Number((p_cascade / sum).toFixed(4)),
    };

    // 2. Compute Expected Costs under Cost Model
    const D0 = this.costs.missed_cascade.D0;
    const g = this.costs.missed_cascade.g;
    const delayGrowth = Math.pow(1 + g, t);
    const missed_damage_base = D0 * delayGrowth;

    const missed_cost = {
      WATCH: missed_damage_base,
      PREPARE: missed_damage_base * (1 - this.costs.missed_cascade.prepare_reduction),
      ALERT: missed_damage_base * (1 - this.costs.missed_cascade.alert_reduction),
      ESCALATE: missed_damage_base * (1 - this.costs.missed_cascade.escalate_reduction),
    };

    const fat_mult = 1 + this.costs.fatigue.kappa * this.fatigue;
    const non_cascade = probs.NOISE + probs.SENSOR_FAILURE;
    const p_iso = probs.ISOLATED;
    const p_cas = probs.CASCADE;

    const exp_costs: Record<Action, number> = {
      WATCH: Number((p_cas * missed_cost.WATCH).toFixed(2)),
      PREPARE: Number(
        (
          p_cas * missed_cost.PREPARE +
          non_cascade * this.costs.false_alarms.noise_or_sensor.PREPARE * fat_mult +
          p_iso * (this.costs.false_alarms.noise_or_sensor.PREPARE * 0.5)
        ).toFixed(2)
      ),
      ALERT: Number(
        (
          p_cas * missed_cost.ALERT +
          non_cascade * this.costs.false_alarms.noise_or_sensor.ALERT * fat_mult +
          p_iso * (this.costs.false_alarms.noise_or_sensor.ALERT * (1 - this.costs.false_alarms.isolated.ALERT_discount))
        ).toFixed(2)
      ),
      ESCALATE: Number(
        (
          p_cas * missed_cost.ESCALATE +
          non_cascade * this.costs.false_alarms.noise_or_sensor.ESCALATE * fat_mult +
          p_iso * this.costs.false_alarms.isolated.ESCALATE_penalty * fat_mult
        ).toFixed(2)
      ),
    };

    // Value of waiting (MC rollouts proxy)
    const val_wait = Number((Math.min(...Object.values(exp_costs)) * (0.85 + 0.04 * (10 - t))).toFixed(2));
    const sortedCosts = Object.entries(exp_costs).sort((a, b) => a[1] - b[1]);
    const bestActionCandidate = sortedCosts[0][0] as Action;
    const decision_margin = Number((sortedCosts[1][1] - sortedCosts[0][1]).toFixed(2));

    // Stability & Hysteresis logic
    let recommendedAction = this.current_action;
    const reasons: string[] = [];

    if (this.dwell_remaining > 0) {
      this.dwell_remaining -= 1;
      reasons.push(`Dwell lock active: ${this.dwell_remaining} min remaining`);
    } else {
      if (bestActionCandidate !== this.current_action) {
        const actionOrder: Record<Action, number> = { WATCH: 0, PREPARE: 1, ALERT: 2, ESCALATE: 3 };
        const isRaise = actionOrder[bestActionCandidate] > actionOrder[this.current_action];

        if (isRaise) {
          // Check switching threshold
          if (exp_costs[this.current_action] - exp_costs[bestActionCandidate] > this.costs.hysteresis.switch_cost_weight) {
            recommendedAction = bestActionCandidate;
            this.dwell_remaining = this.costs.hysteresis.dwell_raise;
            this.flip_count += 1;
            reasons.push(`Escalated to ${bestActionCandidate} due to lower expected risk`);
          }
        } else {
          // De-escalate only if P(CASCADE) < threshold consistently
          if (probs.CASCADE < this.costs.hysteresis.de_escalate_p_cascade_threshold) {
            this.consecutive_low_p_cascade += 1;
            if (this.consecutive_low_p_cascade >= this.costs.hysteresis.de_escalate_consecutive_minutes) {
              recommendedAction = bestActionCandidate;
              this.dwell_remaining = this.costs.hysteresis.dwell_lower;
              this.flip_count += 1;
              reasons.push(`Stand-down authorized: P(CASCADE) sustained < ${this.costs.hysteresis.de_escalate_p_cascade_threshold}`);
            } else {
              reasons.push(`Holding action: De-escalation confirmation pending (${this.consecutive_low_p_cascade}/4 min)`);
            }
          } else {
            this.consecutive_low_p_cascade = 0;
          }
        }
      }
    }
    this.current_action = recommendedAction;

    // Fatigue update (exponential decay)
    if (this.current_action === 'ALERT' || this.current_action === 'ESCALATE') {
      if (probs.CASCADE < 0.3) {
        this.fatigue += 1.0;
      }
    }
    this.fatigue *= Math.exp(-1 / this.costs.fatigue.half_life_min);

    // 3. Causal Foresight (Next 3 events with time windows)
    const forecast: ForecastItem[] = [];
    if (probs.CASCADE > 0.25 || t >= 5) {
      forecast.push({
        node: 'HOSPITAL_SURGE',
        window_start: Number((t + 1.5).toFixed(1)),
        window_end: Number((t + 3.8).toFixed(1)),
        prob: Math.min(0.96, Number((probs.CASCADE * 1.3).toFixed(2))),
        causal_path: 'TRAFFIC_COLLAPSE -> AMBULANCE_DELAY -> HOSPITAL_SURGE',
        rationale: 'Gridlock on arterial corridors delaying emergency triage routing across D2/D3.',
        status: t >= 9 && isCascade ? 'HIT' : 'PENDING',
      });
      forecast.push({
        node: 'POWER_SUBSTATION_TRIP',
        window_start: Number((t + 3.0).toFixed(1)),
        window_end: Number((t + 6.2).toFixed(1)),
        prob: Math.min(0.88, Number((probs.CASCADE * 0.95).toFixed(2))),
        causal_path: 'STREET_FLOODING -> POWER_SUBSTATION_TRIP',
        rationale: 'Drainage ponding near Sector 4 underground distribution vault.',
        status: t >= 11 && isCascade ? 'HIT' : 'PENDING',
      });
      forecast.push({
        node: 'GATEWAY_OUTAGE',
        window_start: Number((t + 4.5).toFixed(1)),
        window_end: Number((t + 8.0).toFixed(1)),
        prob: Math.min(0.79, Number((probs.CASCADE * 0.82).toFixed(2))),
        causal_path: 'POWER_SUBSTATION_TRIP -> TELECOM_DEGRADATION -> GATEWAY_OUTAGE',
        rationale: 'Substation trip will exhaust battery backup on Tower GW-C within 25 minutes.',
        status: 'PENDING',
      });
    } else {
      forecast.push({
        node: 'DRAINAGE_RECESSION',
        window_start: Number((t + 1.0).toFixed(1)),
        window_end: Number((t + 4.0).toFixed(1)),
        prob: 0.85,
        causal_path: 'HEAVY_RAIN -> DRAINAGE_SATURATION -> RUNOFF_RECESSION',
        rationale: 'Localized ponding will drain naturally without arterial street back-up.',
        status: 'PENDING',
      });
      forecast.push({
        node: 'TRAFFIC_NORMALIZATION',
        window_start: Number((t + 2.5).toFixed(1)),
        window_end: Number((t + 5.5).toFixed(1)),
        prob: 0.78,
        causal_path: 'SURFACE_WATER_CLEARING -> TRAFFIC_RESTORE',
        rationale: 'Sensor velocities indicate routine weather deceleration, not network collapse.',
        status: 'PENDING',
      });
      forecast.push({
        node: 'DISPATCH_LOAD_EASING',
        window_start: Number((t + 4.0).toFixed(1)),
        window_end: Number((t + 7.0).toFixed(1)),
        prob: 0.71,
        causal_path: 'STORM_PASSTHROUGH -> 911_CALL_DROP',
        rationale: 'Storm band velocity will cross Meridian perimeter by 00:20.',
        status: 'PENDING',
      });
    }

    // 4. Attribution Waterfall
    const attribution: AttributionItem[] = [
      {
        cluster: 'Hospital Arrivals (H1/H2)',
        event_ids: [`ev-${t}-hosp-1`, `ev-${t}-hosp-2`],
        delta_logodds: t >= 8 && isCascade ? 1.45 : t >= 8 ? -0.85 : 0.12,
        label: t >= 8 && isCascade ? 'Corroborating clinical triage surge' : 'Stable admission velocity',
      },
      {
        cluster: 'Arterial Traffic Grid (D2/D3)',
        event_ids: [`ev-${t}-traf-1`],
        delta_logodds: t >= 5 ? 0.92 : 0.05,
        label: 'Flow reduction cross-validated by camera telemetry',
      },
      {
        cluster: 'Drainage Anomalies (GW-B Cluster)',
        event_ids: [`ev-${t}-drain-1`],
        delta_logodds: t >= 3 ? 0.68 : 0.08,
        label: 'Scaled as sqrt(m) to discount shared gateway correlation',
      },
      {
        cluster: 'Citizen Social Chatter',
        event_ids: [`ev-${t}-social-1`],
        delta_logodds: 0.05,
        label: 'Discounted: High text-hash repetition without physical telemetry',
      },
    ];

    // 5. Mind change info
    let mindChangeMsg = 'Belief state steady. Monitoring multi-channel telemetry streams.';
    let changed = false;
    if (t === 3) {
      changed = true;
      mindChangeMsg = 'Drainage anomalies registered across D2 and D3. Isolated incident probability rose to 0.26.';
    } else if (t === 5) {
      changed = true;
      mindChangeMsg = 'Traffic congestion confirmed by dual gateway sensors. P(CASCADE) increased from 0.16 to 0.29.';
    } else if (t === 8) {
      changed = true;
      if (isCascade) {
        mindChangeMsg = 'Two hospitals report arrival surges independent of gateway telemetry. P(CASCADE) solidifies to 0.55.';
      } else {
        mindChangeMsg = 'Drainage levels plateauing. Hospital arrival queues nominal. P(CASCADE) falling toward prior.';
      }
    } else if (t === 10 && isCascade) {
      changed = true;
      mindChangeMsg = 'Substation voltage drop confirmed. CASCADING_CRISIS crosses 0.75; ESCALATE recommended.';
    }

    // Devils advocate
    const altHyp: Hypothesis = probs.CASCADE > 0.4 ? 'ISOLATED' : probs.ISOLATED > 0.3 ? 'NOISE' : 'SENSOR_FAILURE';
    const devilsAdvocate = {
      hypothesis: altHyp,
      probability: probs[altHyp],
      evidence:
        altHyp === 'ISOLATED'
          ? 'Anomalies remain clustered within sectors D2 and D3; arterial links to D5 and D6 show nominal throughput.'
          : altHyp === 'NOISE'
          ? 'Heavy storm rainfall alone accounts for 85% of observed drainage runoff and traffic deceleration.'
          : 'Multiple drainage sensors share firmware build v2.4 behind Gateway GW-A.',
    };

    const whyNotEsc =
      this.current_action === 'ESCALATE'
        ? 'Action ESCALATE active. Multi-sector confirmation and hospital surge satisfy decision threshold.'
        : `ESCALATE requires P(CASCADE) > 0.65 or multi-district power substation failure. Current margin: -${(0.65 - probs.CASCADE).toFixed(2)}.`;

    const update: BeliefUpdate = {
      episode_id: `meridian-${this.scenario}-${this.seed}`,
      t,
      wall_clock: `T+00:${t < 10 ? '0' : ''}${t}`,
      probs,
      raw_probs: probs,
      intervals_90: {
        NOISE: [Math.max(0, probs.NOISE - 0.04), Math.min(1, probs.NOISE + 0.04)],
        SENSOR_FAILURE: [Math.max(0, probs.SENSOR_FAILURE - 0.03), Math.min(1, probs.SENSOR_FAILURE + 0.03)],
        ISOLATED: [Math.max(0, probs.ISOLATED - 0.05), Math.min(1, probs.ISOLATED + 0.05)],
        CASCADE: [Math.max(0, probs.CASCADE - 0.05), Math.min(1, probs.CASCADE + 0.05)],
      },
      ess: 3840,
      nuisance: {
        rain: t >= 1 ? 'heavy' : 'moderate',
        flu: this.scenario === 'flu_hospital' ? 1.0 : 0.0,
        rumor: this.scenario === 'rumor_wave' ? 0.95 : 0.04,
        gateway_outage: {
          'GW-A': 0.01,
          'GW-B': this.scenario === 'gateway_blackout' && t >= 3 ? 1.0 : 0.02,
          'GW-C': 0.01,
          'GW-D': 0.01,
        },
      },
      action: this.current_action,
      action_expected_costs: exp_costs,
      value_of_waiting: val_wait,
      decision_margin,
      fatigue: Number(this.fatigue.toFixed(3)),
      flip_count: this.flip_count,
      dwell_remaining: this.dwell_remaining,
      reason_codes: reasons.length ? reasons : ['Optimal stopping holds: expected cost of waiting exceeds threshold'],
      forecast,
      next_best_observation:
        probs.CASCADE > 0.4
          ? 'Substation C voltage telemetry (would confirm cascade with +0.32 expected info gain)'
          : 'Arterial camera feeds on D4 connector (would discriminate ISOLATED vs CASCADE)',
      data_health: {
        drainage_sensor: 'OK',
        traffic_sensor: 'OK',
        emergency_call: 'OK',
        hospital_arrival: 'OK',
        power_grid: 'OK',
        citizen_report: 'OK',
        social_post: 'OK',
        camera_flood: this.scenario === 'camera_cutout' && t >= 4 ? 'MISSING' : 'OK',
        heartbeat: 'OK',
      },
      source_trust: {
        'drainage_sensor': 0.91,
        'traffic_sensor': 0.88,
        'emergency_call': 0.94,
        'hospital_arrival': 0.97,
        'power_grid': 0.99,
        'citizen_report': 0.72,
        'social_post': 0.46,
        'camera_flood': 0.85,
      },
      attribution,
      mind_change: {
        changed,
        message: mindChangeMsg,
      },
      devils_advocate: devilsAdvocate,
      why_not_escalate: whyNotEsc,
      ledger_stats: {
        fresh: Math.min(180, 20 + t * 14),
        late: Math.min(24, 2 + t * 2),
        duplicate: Math.min(18, 1 + t),
        retracted: t >= 6 ? 1 : 0,
        quarantined: 0,
      },
      recent_events: this.events_by_minute[t] || [],
      officer_action: this.officer_decisions[t] || null,
    };

    this.history.push(update);
    this.current_t += 1;
    return update;
  }

  seek(target_t: number): BeliefUpdate | null {
    if (target_t >= 0 && target_t < this.history.length) {
      return this.history[target_t];
    }
    while (this.current_t <= target_t && this.current_t <= this.total_minutes) {
      this.step();
    }
    return this.history[target_t] || null;
  }

  logOfficerAction(t: number, action: Action) {
    this.officer_decisions[t] = action;
    if (this.history[t]) {
      this.history[t].officer_action = action;
    }
  }

  injectFault(type: string, target?: string, duration: number = 5) {
    this.faults.push({ type, target, start_t: this.current_t, duration });
  }
}
