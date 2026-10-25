from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class OnlineLearner:
    """
    Online learning system for Firstlight.
    Tracks Beta(a, b) source trust with 0.98 per-episode discount factor,
    Dirichlet base rate adaptation over episodes, Saerens et al. EM label-free prior shifts,
    and CUSUM change-point detection for sudden shifts like Monsoon.
    """

    HYPOTHESES = ["NOISE", "SENSOR_FAILURE", "ISOLATED", "CASCADE"]

    def __init__(
        self,
        discount_factor: float = 0.98,
        cusum_threshold: float = 4.5,
    ) -> None:
        self.discount_factor = discount_factor
        self.cusum_threshold = cusum_threshold

        # Source trust: source_id -> [alpha, beta]
        self.source_trust: Dict[str, Tuple[float, float]] = {}

        # Dirichlet base rate parameters: [alpha_noise, alpha_sensor, alpha_isolated, alpha_cascade]
        # Initial ambient prior: [7.5, 1.0, 1.0, 0.5] -> 75% noise, 10% sensor, 10% isolated, 5% cascade
        self.dirichlet_alphas: np.ndarray = np.array([15.0, 2.0, 2.0, 1.0], dtype=np.float64)

        # CUSUM change point detector state
        self.cusum_statistic: float = 0.0
        self.change_point_detected: bool = False
        self.last_change_point_episode: Optional[int] = None
        self.adaptation_rate_boost: float = 1.0

        # Episode counter
        self.episodes_resolved: int = 0
        self.recent_outcomes: List[str] = []

    def get_source_trust_mean(self, source_id: str) -> float:
        """Returns expected reliability E[Beta(a, b)] = a / (a + b)."""
        a, b = self.source_trust.get(source_id, (19.0, 1.0))  # Default 95% trust
        return float(a / (a + b))

    def get_all_trust_means(self) -> Dict[str, float]:
        return {s_id: self.get_source_trust_mean(s_id) for s_id in self.source_trust.keys()}

    def update_source_trust_online(self, source_id: str, soft_correctness: float, lr: float = 0.05) -> None:
        """
        Within-episode soft update to adjust trust without self-confirmation bias.
        """
        a, b = self.source_trust.get(source_id, (19.0, 1.0))
        # Soft pseudo-count
        a_new = a + lr * soft_correctness
        b_new = b + lr * (1.0 - soft_correctness)
        self.source_trust[source_id] = (float(a_new), float(b_new))

    def resolve_source_trust_episode(self, source_feedback: Dict[str, bool]) -> None:
        """
        End-of-episode resolution: applies discount factor 0.98 to allow tracking drifting reliability,
        and adds ground-truth correctness counts.
        """
        for source_id in list(self.source_trust.keys()):
            a, b = self.source_trust[source_id]
            # Exponential discount factor 0.98
            a_disc = max(1.0, a * self.discount_factor)
            b_disc = max(1.0, b * self.discount_factor)
            self.source_trust[source_id] = (a_disc, b_disc)

        # Apply ground truth feedback
        for source_id, was_correct in source_feedback.items():
            a, b = self.source_trust.get(source_id, (19.0, 1.0))
            if was_correct:
                self.source_trust[source_id] = (a + 1.0, b)
            else:
                self.source_trust[source_id] = (a, b + 1.0)

    def get_base_rates(self) -> np.ndarray:
        """Returns current normalized base rate vector [NOISE, SENSOR_FAILURE, ISOLATED, CASCADE]."""
        s = np.sum(self.dirichlet_alphas)
        return self.dirichlet_alphas / s if s > 0 else np.full(4, 0.25)

    def update_base_rates_episode(self, outcome: str) -> Tuple[bool, str]:
        """
        Updates Dirichlet prior distribution over episodes with exponential forgetting,
        and runs CUSUM change-point detector to identify base-rate regime shifts (Monsoon).
        Returns: (change_point_fired, log_message)
        """
        self.episodes_resolved += 1
        self.recent_outcomes.append(outcome)
        outcome_idx = self.HYPOTHESES.index(outcome) if outcome in self.HYPOTHESES else 0

        # Current expected base rate before update
        old_priors = self.get_base_rates()
        p_outcome_old = max(1e-4, old_priors[outcome_idx])

        # Exponential forgetting discount on Dirichlet (decay prior evidence by 0.90 to allow rapid tracking)
        eff_learning_rate = 1.0 * self.adaptation_rate_boost
        self.dirichlet_alphas = self.dirichlet_alphas * 0.90
        self.dirichlet_alphas[outcome_idx] += (eff_learning_rate * 3.0)

        # CUSUM Change-point Detection
        # Measures log-likelihood ratio of outcome under sudden shift vs old prior
        # Under a 3x monsoon shift, cascade outcomes occur much more frequently than old p_cascade
        shifted_p = min(0.9, p_outcome_old * 3.0) if outcome == "CASCADE" else p_outcome_old
        log_lr = math.log(max(1e-4, shifted_p) / p_outcome_old) if outcome == "CASCADE" else -0.15

        self.cusum_statistic = max(0.0, self.cusum_statistic + log_lr)

        fired = False
        msg = f"Resolved episode {self.episodes_resolved}: outcome {outcome}."
        if self.cusum_statistic >= self.cusum_threshold:
            fired = True
            self.change_point_detected = True
            self.last_change_point_episode = self.episodes_resolved
            self.adaptation_rate_boost = 3.5  # Boost adaptation speed for several episodes
            self.cusum_statistic = 0.0  # Reset
            msg = f"Base rate shift detected at episode {self.episodes_resolved}: Monsoon shift active."
        else:
            # Gradually decay adaptation boost
            self.adaptation_rate_boost = max(1.0, self.adaptation_rate_boost * 0.85)

        return fired, msg
