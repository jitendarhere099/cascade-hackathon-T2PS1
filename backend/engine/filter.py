from __future__ import annotations
import hashlib
import math
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np

from backend.app.schemas import Channel, Event, EventKind, Hypothesis
from backend.engine.emissions import EmissionModel, log_negbin_pdf
from backend.engine.particles import ParticleFilter
from backend.engine.robustness import RobustnessManager
from backend.engine.transitions import StateTransitions


class InferenceEngine:
    """
    Core Particle Filter Inference Engine.
    Executes per-minute Bayesian belief updates across NOISE, SENSOR_FAILURE,
    ISOLATED, and CASCADE, applying robust correlation discounting, tempering,
    cutout handling, and checkpoint rollbacks.
    """

    ALL_CHANNELS = {
        Channel.DRAINAGE_SENSOR,
        Channel.TRAFFIC_SENSOR,
        Channel.EMERGENCY_CALL,
        Channel.HOSPITAL_ARRIVAL,
        Channel.POWER_GRID,
        Channel.CITIZEN_REPORT,
        Channel.SOCIAL_POST,
        Channel.CAMERA_FLOOD,
    }

    def __init__(
        self,
        world_cfg: Dict[str, Any],
        N: int = 4000,
        seed: int = 42,
    ) -> None:
        self.world_cfg = world_cfg
        self.particles = ParticleFilter(N=N, seed=seed)
        self.emissions = EmissionModel(world_cfg)
        self.transitions = StateTransitions(world_cfg)
        self.robustness = RobustnessManager(epsilon_floor=world_cfg.get("engine", {}).get("epsilon_floor", 0.005))

        self.t: int = 0
        self.source_trust: Dict[str, float] = {}  # source_id -> posterior mean trust [0, 1]
        self.data_health: Dict[str, str] = {ch.value: "OK" for ch in self.ALL_CHANNELS}
        self.last_probs = np.full(4, 0.25)
        self.raw_probs = np.full(4, 0.25)

    def set_source_trust_map(self, trust_map: Dict[str, float]) -> None:
        self.source_trust = trust_map

    def step_minute(self, t: int, events: List[Event]) -> Dict[str, Any]:
        """
        Processes all events arriving for minute t, updates particle weights,
        resamples if needed, and computes calibrated marginals.
        """
        self.t = t

        # 1. State Transitions (Dynamics)
        self.transitions.transition_particles(
            rng=self.particles.rng,
            h_array=self.particles.h,
            onset_array=self.particles.onset,
            rain_array=self.particles.rain,
            flu_array=self.particles.flu,
            rumor_array=self.particles.rumor,
            gw_out_array=self.particles.gw_out,
            t=t,
        )

        # 2. Audit Data Health & Missing Channels
        self.data_health = self.robustness.compute_data_health(events, self.ALL_CHANNELS)

        # 3. Correlation Clustering & Discounting
        clusters = self.robustness.cluster_events(events)

        # 4. Check Common-Cause and Rumor Attacks
        is_common_cause, cc_conf, cc_key = self.robustness.detect_common_cause_failure(events)
        is_rumor, rumor_conf = self.robustness.detect_rumor_wave(events)

        if is_common_cause:
            # Shift mass strongly toward SENSOR_FAILURE and discount physical cascade interpretation
            self.particles.log_weights[self.particles.h == 1] += 25.0
            self.particles.log_weights[self.particles.h == 3] -= 25.0

        if is_rumor:
            # Shift mass toward rumor nuisance, penalize CASCADE without physical backing
            self.particles.log_weights[self.particles.rumor == 1] += 10.0
            self.particles.log_weights[self.particles.h == 3] -= 10.0

        # 5. Compute Tempering Exponent Tau
        unique_sources = len(set(e.source_id for e in events if e.kind == EventKind.OBSERVATION))
        ess_ratio = self.particles.compute_ess() / float(self.particles.N)
        tau = self.robustness.compute_tempering_exponent(unique_sources, ess_ratio)

        # 6. Aggregate Emissions Likelihood
        # Compute counts per channel & district
        counts_by_ch_dist: Dict[Tuple[Channel, Optional[str]], int] = {}
        for cluster_name, ev_list, eff_weight in clusters:
            # If cluster is identified as common-cause liar failure, discount physical evidence weight to zero
            if is_common_cause and cc_key and cc_key in cluster_name:
                continue

            for e in ev_list:
                key = (e.channel, e.district)
                counts_by_ch_dist[key] = counts_by_ch_dist.get(key, 0) + 1

        # Accumulate log-likelihood updates with safe try/except fallback per channel
        for (channel, district), count in counts_by_ch_dist.items():
            if self.data_health.get(channel.value) == "MISSING":
                # Drop term, relax uncertainty
                continue

            try:
                trust_val = self.source_trust.get(channel.value, 0.95)
                mu_particles = self.emissions.compute_expected_rates(
                    channel=channel,
                    district=district,
                    t=t,
                    h_array=self.particles.h,
                    onset_array=self.particles.onset,
                    epicenter_array=self.particles.epicenter,
                    rain_array=self.particles.rain,
                    flu_array=self.particles.flu,
                    rumor_array=self.particles.rumor,
                    trust_c=trust_val,
                )

                k_disp = self.world_cfg.get("rates", {}).get(channel.value, {}).get("dispersion_k", 2.0)
                log_likes = log_negbin_pdf(k=k_disp, mu=mu_particles, n=count)

                # Scale by tempering exponent tau
                scaled_log_likes = tau * log_likes
                # Check numerical safety
                scaled_log_likes = np.nan_to_num(scaled_log_likes, nan=0.0, posinf=0.0, neginf=-50.0)

                self.particles.log_weights += scaled_log_likes

            except Exception:
                # Safe fallback: drop this channel term on error, do not crash
                pass

        # 7. Resample If Degenerate
        self.particles.resample_if_needed(threshold_ratio=self.world_cfg.get("engine", {}).get("ess_resample_ratio", 0.5))

        # 8. Save Checkpoint for Rolling Rollback
        self.particles.save_checkpoint(t)

        # 9. Extract Calibrated Marginal Probabilities
        raw_p = self.particles.get_hypothesis_probabilities()
        self.raw_probs = raw_p.copy()
        calibrated_p = self.robustness.apply_probability_floor(raw_p)
        self.last_probs = calibrated_p.copy()

        # 10. Compile Belief State
        names = ["NOISE", "SENSOR_FAILURE", "ISOLATED", "CASCADE"]
        probs_dict = {names[i]: round(float(calibrated_p[i]), 4) for i in range(4)}
        raw_probs_dict = {names[i]: round(float(raw_p[i]), 4) for i in range(4)}

        return {
            "t": t,
            "probs": probs_dict,
            "raw_probs": raw_probs_dict,
            "intervals_90": self.particles.get_credible_intervals_90(),
            "ess": round(self.particles.compute_ess(), 1),
            "nuisance": self.particles.get_nuisance_marginals(),
            "data_health": self.data_health,
        }

    def rollback_and_refilter(
        self,
        rollback_t: int,
        all_events_by_minute: Dict[int, List[Event]],
        ledger_hash: Optional[str] = None,
    ) -> None:
        """
        Restores engine state to checkpoint at rollback_t, then re-filters
        all minutes forward to current minute using checkpoint's preserved RNG state.
        """
        self.particles.rollback_to(rollback_t, rng_seed=None)
        self.t = rollback_t

        current_t = max(rollback_t, max(all_events_by_minute.keys()) if all_events_by_minute else rollback_t)
        for min_idx in range(rollback_t + 1, current_t + 1):
            evts = all_events_by_minute.get(min_idx, [])
            self.step_minute(min_idx, evts)
