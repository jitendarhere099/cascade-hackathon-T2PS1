from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.app.schemas import Action, Hypothesis


class DecisionEngine:
    """
    Decision Engine implementing the Firstlight strict cost model,
    optimal stopping via Monte-Carlo value-of-waiting rollouts,
    cry-wolf fatigue, and anti-flip-flop hysteresis.
    """

    ACTIONS = [Action.WATCH, Action.PREPARE, Action.ALERT, Action.ESCALATE]
    ACTION_LEVELS = {Action.WATCH: 0, Action.PREPARE: 1, Action.ALERT: 2, Action.ESCALATE: 3}
    LEVEL_TO_ACTION = {0: Action.WATCH, 1: Action.PREPARE, 2: Action.ALERT, 3: Action.ESCALATE}

    def __init__(self, costs_cfg: Dict[str, Any]) -> None:
        self.cfg = costs_cfg
        self.D0: float = costs_cfg.get("missed_cascade", {}).get("D0", 100.0)
        self.g: float = costs_cfg.get("missed_cascade", {}).get("g", 0.12)
        self.reductions = costs_cfg.get("missed_cascade", {}).get("reductions", {
            "WATCH": 0.0, "PREPARE": 0.25, "ALERT": 0.60, "ESCALATE": 0.85
        })
        self.false_alarms = costs_cfg.get("false_alarms", {
            "NOISE": {"WATCH": 0.0, "PREPARE": 1.0, "ALERT": 8.0, "ESCALATE": 40.0},
            "SENSOR_FAILURE": {"WATCH": 0.0, "PREPARE": 1.0, "ALERT": 8.0, "ESCALATE": 40.0},
            "ISOLATED": {"WATCH": 0.0, "PREPARE": 1.0, "ALERT": 2.4, "ESCALATE": 40.0},
        })
        self.kappa: float = costs_cfg.get("fatigue", {}).get("kappa", 0.5)
        self.half_life_min: float = costs_cfg.get("fatigue", {}).get("half_life_min", 30.0)
        self.decay_factor: float = math.exp(-math.log(2.0) / self.half_life_min)

        self.dwell_time_up: int = costs_cfg.get("hysteresis", {}).get("dwell_time_up", 3)
        self.dwell_time_down: int = costs_cfg.get("hysteresis", {}).get("dwell_time_down", 2)
        self.switching_penalty: float = costs_cfg.get("hysteresis", {}).get("switching_penalty", 2.0)
        self.deescalate_thresh: float = costs_cfg.get("hysteresis", {}).get("deescalate_cascade_prob_threshold", 0.15)
        self.deescalate_min_m: int = costs_cfg.get("hysteresis", {}).get("deescalate_consecutive_minutes", 4)

        # State tracking per episode
        self.fatigue: float = 0.0
        self.current_action: Action = Action.WATCH
        self.dwell_remaining: int = 0
        self.flip_count: int = 0
        self.last_transition_direction: Optional[str] = None  # "up" or "down"
        self.low_cascade_consecutive_mins: int = 0
        self.action_history: List[Action] = []

    def reset_episode(self) -> None:
        self.current_action = Action.WATCH
        self.dwell_remaining = 0
        self.flip_count = 0
        self.last_transition_direction = None
        self.low_cascade_consecutive_mins = 0
        self.action_history.clear()

    def update_fatigue_decay(self) -> None:
        self.fatigue *= self.decay_factor

    def compute_loss(self, action: Action, hypothesis: str, delay_minutes: float) -> float:
        """
        Loss L(action, hypothesis, delay, fatigue).
        """
        fatigue_mult = 1.0 + self.kappa * self.fatigue

        if hypothesis == "CASCADE":
            # Damage grows with delay: D0 * (1 + g)^delay
            damage = self.D0 * math.pow(1.0 + self.g, max(0.0, delay_minutes))
            # Action mitigates a fraction of damage
            mitigation = self.reductions.get(action.value, 0.0)
            residual = damage * (1.0 - mitigation)
            return float(residual)
        else:
            # False alarm costs
            h_table = self.false_alarms.get(hypothesis, self.false_alarms.get("NOISE", {}))
            base_cost = h_table.get(action.value, 0.0)
            if action in (Action.ALERT, Action.ESCALATE):
                return float(base_cost * fatigue_mult)
            return float(base_cost)

    def expected_cost_of_action(self, action: Action, probs: Dict[str, float], delay_minutes: float) -> float:
        """
        EC(a) = sum_h p(h) * L(a, h, delay, F).
        """
        ec = 0.0
        for h_name, p in probs.items():
            loss = self.compute_loss(action, h_name, delay_minutes)
            ec += p * loss
        return ec

    def compute_all_expected_costs(self, probs: Dict[str, float], delay_minutes: float) -> Dict[str, float]:
        return {
            act.value: round(self.expected_cost_of_action(act, probs, delay_minutes), 2)
            for act in self.ACTIONS
        }

    def compute_value_of_waiting(
        self,
        current_probs: Dict[str, float],
        delay_minutes: float,
        k_values: Tuple[int, ...] = (1, 2, 3, 5),
        n_rollouts: int = 64,
    ) -> Tuple[float, float]:
        """
        Monte-Carlo rollouts estimating future expected cost of waiting k minutes.
        Returns: (min_EC_wait, decision_margin)
        """
        p_cascade = current_probs.get("CASCADE", 0.05)
        p_isolated = current_probs.get("ISOLATED", 0.10)
        p_noise = current_probs.get("NOISE", 0.80)

        # Baseline expected cost of acting now
        costs_now = [self.expected_cost_of_action(a, current_probs, delay_minutes) for a in self.ACTIONS]
        min_ec_now = min(costs_now)

        wait_costs: List[float] = []
        for k in k_values:
            future_delay = delay_minutes + k
            # Rollouts simulate future belief sharpening
            rollout_opt_costs = []
            for _ in range(n_rollouts):
                # Sample hypothetical ground truth from current posterior
                total_p = p_noise + p_isolated + p_cascade
                if total_p <= 0.0:
                    p_roll = [0.8, 0.1, 0.1]
                else:
                    p_roll = [p_noise / total_p, p_isolated / total_p, p_cascade / total_p]
                h_roll = np.random.choice(["NOISE", "ISOLATED", "CASCADE"], p=p_roll)
                if h_roll == "CASCADE":
                    # Information clarifies cascade
                    sim_p = {"CASCADE": min(0.98, p_cascade + 0.10 * k), "ISOLATED": 0.01, "NOISE": 0.01, "SENSOR_FAILURE": 0.0}
                elif h_roll == "ISOLATED":
                    sim_p = {"CASCADE": 0.02, "ISOLATED": 0.90, "NOISE": 0.05, "SENSOR_FAILURE": 0.03}
                else:
                    sim_p = {"CASCADE": 0.01, "ISOLATED": 0.02, "NOISE": 0.95, "SENSOR_FAILURE": 0.02}

                opt_c = min(self.expected_cost_of_action(a, sim_p, future_delay) for a in self.ACTIONS)
                rollout_opt_costs.append(opt_c)

            avg_wait_cost = float(np.mean(rollout_opt_costs))
            wait_costs.append(avg_wait_cost)

        min_ec_wait = min(wait_costs) if wait_costs else min_ec_now
        decision_margin = min_ec_wait - min_ec_now
        return min_ec_wait, decision_margin

    def decide(
        self,
        t: int,
        probs: Dict[str, float],
        delay_minutes: float,
    ) -> Tuple[Action, Dict[str, float], float, float, List[str]]:
        """
        Applies cost model, optimal stopping, hysteresis thresholds, dwell time,
        and de-escalation rules to select the stabilized recommended action.
        """
        self.update_fatigue_decay()
        expected_costs = self.compute_all_expected_costs(probs, delay_minutes)
        min_ec_wait, decision_margin = self.compute_value_of_waiting(probs, delay_minutes)

        reason_codes: List[str] = []
        p_cascade = probs.get("CASCADE", 0.0)

        # Track low cascade consecutive minutes for de-escalation
        if p_cascade < self.deescalate_thresh:
            self.low_cascade_consecutive_mins += 1
        else:
            self.low_cascade_consecutive_mins = 0

        # Unconstrained candidate action minimizing EC(a)
        candidate_action = min(self.ACTIONS, key=lambda a: expected_costs[a.value])
        candidate_level = self.ACTION_LEVELS[candidate_action]
        current_level = self.ACTION_LEVELS[self.current_action]

        # Check Optimal Stopping (Value of Waiting)
        if decision_margin < -5.0 and candidate_level > 0 and p_cascade < 0.70:
            # Value of waiting exceeds cost of acting now -> prefer waiting or lower readiness
            candidate_action = Action.WATCH if candidate_level == 1 else self.LEVEL_TO_ACTION[candidate_level - 1]
            candidate_level = self.ACTION_LEVELS[candidate_action]
            reason_codes.append("WAIT_BENEFIT_EXCEEDS_IMMEDIATE_ACTION")

        # Stability & Inertia Filter
        next_action = self.current_action

        if self.dwell_remaining > 0:
            # In dwell period: cannot change action unless life-safety critical override
            if candidate_level > current_level and p_cascade > 0.70:
                # Emergency override: allow immediate escalation
                next_action = candidate_action
                self.dwell_remaining = self.dwell_time_up
                self.last_transition_direction = "up"
                reason_codes.append("EMERGENCY_DWELL_OVERRIDE")
            else:
                self.dwell_remaining -= 1
                reason_codes.append(f"DWELL_LOCKED_{self.dwell_remaining}_MIN_REMAINING")
                next_action = self.current_action
        else:
            # Free to transition if switching cost threshold met
            if candidate_level > current_level:
                # Raising action level
                cost_diff = expected_costs[self.current_action.value] - expected_costs[candidate_action.value]
                if cost_diff >= (self.switching_penalty * (candidate_level - current_level)):
                    next_action = candidate_action
                    self.dwell_remaining = self.dwell_time_up
                    self.last_transition_direction = "up"
                    reason_codes.append("ESCALATION_THRESHOLD_MET")
                else:
                    reason_codes.append("ESCALATION_BLOCKED_BY_SWITCHING_COST")
            elif candidate_level < current_level:
                # Lowering action level (de-escalation)
                if current_level == 3:  # ESCALATE
                    # De-escalation from ESCALATE requires M consecutive minutes of low cascade
                    if self.low_cascade_consecutive_mins >= self.deescalate_min_m:
                        next_action = Action.ALERT  # Step down one level only
                        self.dwell_remaining = self.dwell_time_down
                        self.last_transition_direction = "down"
                        reason_codes.append("DEESCALATE_STEP_DOWN_ALERT")
                    else:
                        reason_codes.append("DEESCALATE_AWAITING_CONSECUTIVE_LOW_CASCADE")
                        next_action = Action.ESCALATE
                else:
                    # De-escalating from PREPARE or ALERT
                    next_action = self.LEVEL_TO_ACTION[current_level - 1]
                    self.dwell_remaining = self.dwell_time_down
                    self.last_transition_direction = "down"
                    reason_codes.append("DEESCALATION_STEP_DOWN")

        # Flip count tracking
        if len(self.action_history) >= 1 and next_action != self.action_history[-1]:
            # If changing direction compared to previous transition
            self.flip_count += 1

        self.current_action = next_action
        self.action_history.append(next_action)

        return next_action, expected_costs, min_ec_wait, decision_margin, reason_codes

    def log_false_alarm(self) -> None:
        """Called when an episode resolves with an unjustified ALERT or ESCALATE."""
        self.fatigue += 1.0
