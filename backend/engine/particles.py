from __future__ import annotations
import copy
from dataclasses import dataclass
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from backend.app.schemas import Channel, Event, Hypothesis


@dataclass
class ParticleCheckpoint:
    t: int
    h: np.ndarray
    onset: np.ndarray
    epicenter: np.ndarray
    rain: np.ndarray
    flu: np.ndarray
    rumor: np.ndarray
    gw_out: np.ndarray
    log_weights: np.ndarray
    rng_state: Any


class ParticleFilter:
    """
    Vectorized Particle Filter core running N=4000 latent state particles.
    Marginalizes process onset, tracks innocent nuisance explanations,
    maintains copy-on-write 20-minute rolling checkpoints, and performs
    hypothesis-stratified resampling.
    """

    def __init__(self, N: int = 4000, seed: int = 42, checkpoint_len: int = 20) -> None:
        self.N = N
        self.seed = seed
        self.checkpoint_len = checkpoint_len
        self.rng = np.random.RandomState(seed)

        # Allocate contiguous arrays
        self.h = np.zeros(N, dtype=np.int32)
        self.onset = np.zeros(N, dtype=np.float64)
        self.epicenter = np.zeros(N, dtype=np.int32)
        self.rain = np.zeros(N, dtype=np.int32)
        self.flu = np.zeros(N, dtype=np.int32)
        self.rumor = np.zeros(N, dtype=np.int32)
        self.gw_out = np.zeros((N, 4), dtype=np.int32)
        self.log_weights = np.zeros(N, dtype=np.float64)

        self.checkpoints: Dict[int, ParticleCheckpoint] = {}
        self.initialize_particles()

    def initialize_particles(self, base_rate_priors: Optional[Tuple[float, float, float, float]] = None) -> None:
        """
        Initializes particles according to base rate priors (or default uniform/ambient).
        """
        priors = base_rate_priors or (0.75, 0.10, 0.10, 0.05)
        # Normalize priors
        p_norm = np.array(priors, dtype=np.float64) / sum(priors)

        self.h = self.rng.choice([0, 1, 2, 3], size=self.N, p=p_norm)
        self.onset = np.zeros(self.N, dtype=np.float64)
        self.epicenter = self.rng.randint(0, 6, size=self.N)
        self.rain = self.rng.choice([0, 1, 2], size=self.N, p=[0.70, 0.20, 0.10])
        self.flu = self.rng.choice([0, 1], size=self.N, p=[0.95, 0.05])
        self.rumor = self.rng.choice([0, 1], size=self.N, p=[0.95, 0.05])
        self.gw_out = np.zeros((self.N, 4), dtype=np.int32)
        self.log_weights = np.zeros(self.N, dtype=np.float64)
        self.checkpoints.clear()

    def save_checkpoint(self, t: int) -> None:
        """Saves a copy-on-write state snapshot for minute t."""
        cp = ParticleCheckpoint(
            t=t,
            h=self.h.copy(),
            onset=self.onset.copy(),
            epicenter=self.epicenter.copy(),
            rain=self.rain.copy(),
            flu=self.flu.copy(),
            rumor=self.rumor.copy(),
            gw_out=self.gw_out.copy(),
            log_weights=self.log_weights.copy(),
            rng_state=self.rng.get_state(),
        )
        self.checkpoints[t] = cp
        # Prune older than checkpoint_len
        keys_to_remove = [k for k in self.checkpoints.keys() if k < (t - self.checkpoint_len)]
        for k in keys_to_remove:
            del self.checkpoints[k]

    def rollback_to(self, target_t: int, rng_seed: Optional[int] = None) -> bool:
        """
        Rolls back the particle set to the nearest checkpoint before target_t.
        Returns True if rollback checkpoint was available, False otherwise.
        """
        valid_checkpoints = [k for k in self.checkpoints.keys() if k <= target_t]
        if not valid_checkpoints:
            # Re-initialize from t=0
            if rng_seed is not None:
                self.rng = np.random.RandomState(rng_seed)
            self.initialize_particles()
            return False

        best_t = max(valid_checkpoints)
        cp = self.checkpoints[best_t]
        self.h = cp.h.copy()
        self.onset = cp.onset.copy()
        self.epicenter = cp.epicenter.copy()
        self.rain = cp.rain.copy()
        self.flu = cp.flu.copy()
        self.rumor = cp.rumor.copy()
        self.gw_out = cp.gw_out.copy()
        self.log_weights = cp.log_weights.copy()
        if rng_seed is not None:
            self.rng = np.random.RandomState(rng_seed)
        else:
            self.rng.set_state(cp.rng_state)

        # Remove checkpoints after best_t
        for k in list(self.checkpoints.keys()):
            if k > best_t:
                del self.checkpoints[k]

        return True

    def get_normalized_weights(self) -> np.ndarray:
        """Numerically stable softmax normalization of particle log-weights."""
        max_log_w = np.max(self.log_weights)
        w = np.exp(self.log_weights - max_log_w)
        s = np.sum(w)
        if s <= 0.0 or np.isnan(s):
            # Equal weighting fallback
            return np.full(self.N, 1.0 / self.N, dtype=np.float64)
        return w / s

    def compute_ess(self) -> float:
        """Effective Sample Size: 1.0 / sum(w^2)."""
        w = self.get_normalized_weights()
        sum_sq = np.sum(w ** 2)
        return float(1.0 / sum_sq) if sum_sq > 0 else 0.0

    def get_hypothesis_probabilities(self) -> np.ndarray:
        """Returns marginal probabilities for [NOISE, SENSOR_FAILURE, ISOLATED, CASCADE]."""
        w = self.get_normalized_weights()
        probs = np.zeros(4, dtype=np.float64)
        for h_val in range(4):
            probs[h_val] = np.sum(w[self.h == h_val])
        # Ensure finite & non-negative
        probs = np.nan_to_num(probs, nan=0.25, posinf=1.0, neginf=0.0)
        s = np.sum(probs)
        return probs / s if s > 0 else np.full(4, 0.25)

    def get_credible_intervals_90(self) -> Dict[str, Tuple[float, float]]:
        """
        Computes 90% credible intervals for each hypothesis via Dirichlet approximation
        parameterized by alpha_h = p_h * ESS + 1.
        """
        probs = self.get_hypothesis_probabilities()
        ess = min(self.N, max(10.0, self.compute_ess()))
        alphas = probs * ess + 1.0
        names = ["NOISE", "SENSOR_FAILURE", "ISOLATED", "CASCADE"]
        intervals: Dict[str, Tuple[float, float]] = {}

        for i, name in enumerate(names):
            # Beta(alpha_i, sum(alpha) - alpha_i) approximation
            a_i = alphas[i]
            b_i = np.sum(alphas) - a_i
            # Variance = a*b / ((a+b)^2 * (a+b+1))
            var = (a_i * b_i) / (((a_i + b_i) ** 2) * (a_i + b_i + 1.0))
            std = math.sqrt(max(1e-6, var))
            # 90% interval approx: mean +/- 1.645 * std
            mean = a_i / (a_i + b_i)
            low = max(0.005, mean - 1.645 * std)
            high = min(0.995, mean + 1.645 * std)
            intervals[name] = (round(float(low), 3), round(float(high), 3))

        return intervals

    def get_nuisance_marginals(self) -> Dict[str, Any]:
        """Computes posterior marginals for rain, flu, rumor, and gateway outages."""
        w = self.get_normalized_weights()
        p_rain_heavy = float(np.sum(w[self.rain == 2]))
        p_rain_mod = float(np.sum(w[self.rain == 1]))
        p_flu = float(np.sum(w[self.flu == 1]))
        p_rumor = float(np.sum(w[self.rumor == 1]))

        gw_probs: Dict[str, float] = {}
        for idx, gw_name in enumerate(["GW-A", "GW-B", "GW-C", "GW-D"]):
            gw_probs[gw_name] = round(float(np.sum(w[self.gw_out[:, idx] == 1])), 3)

        rain_label = "heavy" if p_rain_heavy > 0.4 else ("moderate" if p_rain_mod > 0.4 else "none")

        return {
            "rain": rain_label,
            "flu": round(p_flu, 3),
            "rumor": round(p_rumor, 3),
            "gateway_outage": gw_probs,
        }

    def resample_if_needed(self, threshold_ratio: float = 0.5) -> bool:
        """
        Performs hypothesis-stratified systematic resampling when ESS < threshold.
        Guarantees minority hypotheses retain a baseline particle budget (honest minority probabilities).
        """
        ess = self.compute_ess()
        if ess >= (self.N * threshold_ratio):
            return False

        w = self.get_normalized_weights()
        new_indices = np.zeros(self.N, dtype=np.int32)
        min_particles_per_h = max(20, int(self.N * 0.02))  # At least 2% particles per hypothesis

        current_idx = 0
        for h_val in range(4):
            mask = (self.h == h_val)
            h_count = np.sum(mask)
            h_mass = np.sum(w[mask])

            if h_count > 0 and h_mass > 0:
                h_weight = w[mask] / h_mass
                h_indices = np.where(mask)[0]
                target_alloc = max(min_particles_per_h, int(h_mass * self.N))
                target_alloc = min(target_alloc, self.N - current_idx - (3 - h_val) * min_particles_per_h)
                target_alloc = max(min_particles_per_h, target_alloc)

                # Systematic sample within stratum
                positions = (self.rng.uniform(0, 1) + np.arange(target_alloc)) / float(target_alloc)
                cumsum = np.cumsum(h_weight)
                stratum_idx = np.searchsorted(cumsum, positions)
                stratum_idx = np.clip(stratum_idx, 0, len(h_indices) - 1)
                selected = h_indices[stratum_idx]

                new_indices[current_idx:current_idx + target_alloc] = selected
                current_idx += target_alloc

        # Fill any remainder with standard multinomial
        if current_idx < self.N:
            rem = self.N - current_idx
            new_indices[current_idx:] = self.rng.choice(self.N, size=rem, p=w)

        # Apply resampled indices
        self.h = self.h[new_indices]
        self.onset = self.onset[new_indices]
        self.epicenter = self.epicenter[new_indices]
        self.rain = self.rain[new_indices]
        self.flu = self.flu[new_indices]
        self.rumor = self.rumor[new_indices]
        self.gw_out = self.gw_out[new_indices]

        # Jitter / rejuvenation move on continuous onset to prevent sample impoverishment
        jitter = self.rng.normal(loc=0.0, scale=0.25, size=self.N)
        self.onset = np.maximum(0.0, self.onset + jitter)

        # Reset weights to uniform 0.0 log-weights
        self.log_weights = np.zeros(self.N, dtype=np.float64)
        return True
