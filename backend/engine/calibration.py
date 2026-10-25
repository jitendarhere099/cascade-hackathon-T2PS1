from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class OnlineCalibrator:
    """
    Online calibrator implementing temperature scaling and per-class bias
    conditioned on minute buckets:
    z_h = (ln(p_raw[h]) + b_h) / T_bucket
    p_cal = softmax(z)
    Updated online via SGD on log-loss as episodes resolve.
    """

    BUCKETS = [(0, 3), (3, 7), (7, 10), (10, 1000)]

    def __init__(self, lr: float = 0.01) -> None:
        self.lr = lr
        # Per-bucket temperatures (default 1.0)
        self.temperatures: List[float] = [1.2, 1.4, 1.1, 1.0]
        # Per-class bias vector [NOISE, SENSOR_FAILURE, ISOLATED, CASCADE]
        self.biases: np.ndarray = np.zeros(4, dtype=np.float64)

    def _get_bucket_idx(self, t: int) -> int:
        for idx, (b_start, b_end) in enumerate(self.BUCKETS):
            if b_start <= t < b_end:
                return idx
        return len(self.BUCKETS) - 1

    def calibrate(self, raw_probs: np.ndarray, t: int) -> np.ndarray:
        """
        Calibrates raw probabilities with temperature scaling and class bias.
        """
        bucket_idx = self._get_bucket_idx(t)
        temp = max(0.2, self.temperatures[bucket_idx])

        # Clamped log probabilities
        log_p = np.log(np.clip(raw_probs, 1e-6, 1.0))
        logits = (log_p + self.biases) / temp

        # Stable softmax
        logits_max = np.max(logits)
        exp_logits = np.exp(logits - logits_max)
        calibrated = exp_logits / np.sum(exp_logits)

        # Floor at 0.5% (0.005)
        eps = 0.005
        smoothed = (1.0 - 4.0 * eps) * calibrated + eps
        return smoothed / np.sum(smoothed)

    def update_sgd(self, raw_probs: np.ndarray, t: int, true_class_idx: int) -> float:
        """
        One SGD step on cross-entropy log-loss.
        Returns loss value.
        """
        bucket_idx = self._get_bucket_idx(t)
        temp = self.temperatures[bucket_idx]

        calibrated = self.calibrate(raw_probs, t)
        loss = -math.log(max(1e-6, calibrated[true_class_idx]))

        # Gradient w.r.t logits: p - y
        grad_logits = calibrated.copy()
        grad_logits[true_class_idx] -= 1.0

        # Gradient w.r.t bias: grad_logits / temp
        self.biases -= self.lr * (grad_logits / temp)

        # Gradient w.r.t temperature: grad_logits * (-(log_p + b) / temp^2)
        log_p = np.log(np.clip(raw_probs, 1e-6, 1.0))
        grad_temp = np.sum(grad_logits * (-(log_p + self.biases) / (temp ** 2)))
        self.temperatures[bucket_idx] = float(np.clip(temp - self.lr * grad_temp, 0.4, 3.0))

        return loss

    def to_dict(self) -> Dict[str, Any]:
        return {
            "temperatures": list(self.temperatures),
            "biases": list(self.biases),
        }

    def from_dict(self, data: Dict[str, Any]) -> None:
        self.temperatures = list(data.get("temperatures", [1.2, 1.4, 1.1, 1.0]))
        self.biases = np.array(data.get("biases", [0.0, 0.0, 0.0, 0.0]), dtype=np.float64)


class PrefixBank:
    """
    Nonparametric twin calibrator.
    Stores quantized signatures of resolved episodes at t in {3, 5, 7, 10} with outcome.
    Computes kernel-weighted empirical outcome distribution among nearest prefixes
    and blends with parametric posterior.
    """

    SNAPSHOT_MINUTES = {3, 5, 7, 10}

    def __init__(self, bandwidth: float = 1.0) -> None:
        self.bandwidth = bandwidth
        self.entries: List[Dict[str, Any]] = []

    def add_entry(self, episode_id: str, minute: int, signature: List[float], outcome: str) -> None:
        self.entries.append({
            "episode_id": episode_id,
            "minute": minute,
            "signature": np.array(signature, dtype=np.float64),
            "outcome": outcome,
        })

    def query(self, minute: int, signature: List[float]) -> Optional[np.ndarray]:
        """
        Finds matching historical prefix signatures at the same minute.
        Returns kernel-weighted empirical probability vector [NOISE, SENSOR_FAILURE, ISOLATED, CASCADE].
        """
        matching = [e for e in self.entries if e["minute"] == minute]
        if not matching:
            return None

        sig_vec = np.array(signature, dtype=np.float64)
        names = ["NOISE", "SENSOR_FAILURE", "ISOLATED", "CASCADE"]
        weights = np.zeros(len(matching), dtype=np.float64)

        for i, entry in enumerate(matching):
            dist_sq = float(np.sum((sig_vec - entry["signature"]) ** 2))
            # Gaussian RBF kernel
            weights[i] = math.exp(-dist_sq / (2.0 * (self.bandwidth ** 2)))

        total_w = np.sum(weights)
        if total_w <= 1e-6:
            return None

        norm_weights = weights / total_w
        empirical_p = np.zeros(4, dtype=np.float64)
        for i, entry in enumerate(matching):
            outcome_idx = names.index(entry["outcome"]) if entry["outcome"] in names else 0
            empirical_p[outcome_idx] += norm_weights[i]

        return empirical_p

    def blend(self, parametric_p: np.ndarray, minute: int, signature: List[float]) -> np.ndarray:
        """
        Blends parametric posterior with prefix bank empirical outcome.
        Blend weight grows with bank size up to 0.40.
        """
        emp_p = self.query(minute, signature)
        if emp_p is None:
            return parametric_p

        bank_size = len([e for e in self.entries if e["minute"] == minute])
        w_bank = min(0.40, bank_size / 30.0)
        blended = (1.0 - w_bank) * parametric_p + w_bank * emp_p
        return blended / np.sum(blended)
