from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from scipy.special import gammaln
from scipy.stats import lognorm

from backend.app.schemas import Channel


def log_negbin_pdf(k: float, mu: np.ndarray, n: int) -> np.ndarray:
    """
    Numerically safe vectorized Negative Binomial log-likelihood.
    P(n | mu, k) = Gamma(n + k)/(n! Gamma(k)) * (k/(k+mu))^k * (mu/(k+mu))^n
    All inputs and calculations strictly in log-space.
    """
    k_clamped = max(1e-3, float(k))
    mu_clamped = np.clip(mu, 1e-4, 1e5)

    # ln Gamma(n + k) - ln(n!) - ln Gamma(k)
    term1 = gammaln(n + k_clamped) - gammaln(n + 1) - gammaln(k_clamped)
    # k * ln(k / (k + mu))
    term2 = k_clamped * (np.log(k_clamped) - np.log(k_clamped + mu_clamped))
    # n * ln(mu / (k + mu))
    term3 = n * (np.log(mu_clamped) - np.log(k_clamped + mu_clamped))

    log_p = term1 + term2 + term3
    # Check for NaN / Inf safety
    log_p = np.nan_to_num(log_p, nan=-50.0, posinf=0.0, neginf=-50.0)
    return np.clip(log_p, -50.0, 0.0)


class EmissionModel:
    """
    Vectorized emission model mapping particle states to observation likelihoods
    using Negative Binomial overdispersion, lag CDFs, and spatial concentration.
    """

    def __init__(self, world_cfg: Dict[str, Any]) -> None:
        self.world_cfg = world_cfg
        self.rates = world_cfg["rates"]

    def compute_expected_rates(
        self,
        channel: Channel,
        district: Optional[str],
        t: int,
        h_array: np.ndarray,          # Shape (N,) in [0: NOISE, 1: SENSOR_FAILURE, 2: ISOLATED, 3: CASCADE]
        onset_array: np.ndarray,      # Shape (N,)
        epicenter_array: np.ndarray,  # Shape (N,) district index
        rain_array: np.ndarray,       # Shape (N,) 0: none, 1: mod, 2: heavy
        flu_array: np.ndarray,        # Shape (N,)
        rumor_array: np.ndarray,      # Shape (N,)
        trust_c: float = 0.95,
    ) -> np.ndarray:
        """
        Computes expected rate mu for channel c across all N particles.
        """
        r_cfg = self.rates.get(channel.value, {})
        # Rate table is city-wide across 6 districts; scale to per-district expected rate
        base = r_cfg.get("base", 1.0) / 6.0
        beta = r_cfg.get("beta_junk", 0.2) / 6.0

        N = len(h_array)
        lambda_c = np.full(N, base, dtype=np.float64)

        # Weather / Rain effects
        rain_mult = r_cfg.get("heavy_rain_mult", 1.0)
        heavy_mask = (rain_array == 2)
        mod_mask = (rain_array == 1)
        lambda_c[heavy_mask] *= rain_mult
        lambda_c[mod_mask] *= (1.0 + (rain_mult - 1.0) * 0.5)

        # Flu effect
        flu_mult = r_cfg.get("flu_cluster_mult", 1.0)
        lambda_c[flu_array == 1] *= flu_mult

        # Rumor effect
        rumor_mult = r_cfg.get("rumor_wave_mult", 1.0)
        lambda_c[rumor_array == 1] *= rumor_mult

        # Isolated incident spatial concentration
        isolated_mask = (h_array == 2)
        if np.any(isolated_mask):
            isolated_add = r_cfg.get("isolated_add", 1.5)
            # If district matches epicenter, add concentrated anomaly; else small spillover
            dist_idx = ["D1", "D2", "D3", "D4", "D5", "D6"].index(district) if district in ["D1", "D2", "D3", "D4", "D5", "D6"] else -1
            match_mask = isolated_mask & (epicenter_array == dist_idx)
            lambda_c[match_mask] += (isolated_add * 0.75)
            non_match = isolated_mask & ~match_mask
            lambda_c[non_match] += (isolated_add * 0.05)

        # Cascade dynamics with lag CDF (spread across ~4 active districts)
        cascade_mask = (h_array == 3)
        if np.any(cascade_mask):
            cascade_add = r_cfg.get("cascade_add", 4.0) / 4.0
            lag_min = r_cfg.get("cascade_lag_min", 2)
            # Time since onset: delta_t = t - onset_minute
            delta_t = np.maximum(0.0, t - onset_array)
            # Sigmoidal lag activation ramp
            ramp = 1.0 / (1.0 + np.exp(-1.2 * (delta_t - lag_min)))
            lambda_c[cascade_mask] += cascade_add * ramp[cascade_mask]

        # Reliability-weighted combination with junk rate
        mu_c = lambda_c * trust_c + beta * (1.0 - trust_c)
        return np.maximum(1e-4, mu_c)
