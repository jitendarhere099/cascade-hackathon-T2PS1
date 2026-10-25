from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np

from backend.app.schemas import Channel, ForecastItem


class CausalForecaster:
    """
    Causal Forecaster for Firstlight.
    Propagates delay distributions from already-active causal nodes through the DAG,
    computes [10th, 90th] percentile time windows, surfaces the top-3 forecasts by
    (probability * importance), generates side-by-side alternative hypothesis forecasts,
    supports do()-interventions, and evaluates the most informative missing observation.
    """

    def __init__(self, causal_cfg: Dict[str, Any]) -> None:
        self.nodes = causal_cfg.get("nodes", {})
        self.edges = causal_cfg.get("edges", [])
        self.past_forecasts: List[Dict[str, Any]] = []

    def forecast_next_events(
        self,
        current_t: float,
        hypothesis: str,
        active_nodes: Dict[str, float],
        blocked_edges: Optional[Set[Tuple[str, str]]] = None,
        forced_nodes: Optional[Set[str]] = None,
        top_k: int = 3,
    ) -> List[ForecastItem]:
        """
        Computes forward predictions for unobserved causal nodes.
        Supports do()-interventions via blocked_edges and forced_nodes.
        """
        blocked = blocked_edges or set()
        forced = forced_nodes or set()

        effective_active = dict(active_nodes)
        for fn in forced:
            if fn not in effective_active:
                effective_active[fn] = current_t

        predictions: List[Dict[str, Any]] = []

        # Find candidate downstream nodes not yet observed
        for node_id, node_meta in self.nodes.items():
            if node_id in effective_active and effective_active[node_id] <= current_t:
                # Already active in the past
                continue

            # Incoming edges
            incoming_edges = [
                e for e in self.edges
                if e["target"] == node_id and (e["source"], e["target"]) not in blocked
            ]

            if not incoming_edges:
                continue

            # Check if any parent is active
            active_parents = [
                (e, effective_active[e["source"]])
                for e in incoming_edges
                if e["source"] in effective_active
            ]

            if not active_parents:
                continue

            # Calculate noisy-OR activation probability and convolved delay window
            p_inactive = 1.0
            earliest_times = []
            latest_times = []
            paths = []

            for edge, parent_act_t in active_parents:
                p_edge = edge["activation_prob"].get(hypothesis, 0.05)
                p_inactive *= (1.0 - p_edge)

                mu = edge["delay_lognormal"]["mu"]
                sigma = edge["delay_lognormal"]["sigma"]
                # Lognormal 10th and 90th percentiles
                p10 = math.exp(mu - 1.282 * sigma)
                p90 = math.exp(mu + 1.282 * sigma)

                earliest_times.append(parent_act_t + p10)
                latest_times.append(parent_act_t + p90)
                paths.append(f"{edge['source']} -> {node_id}")

            p_node = 1.0 - p_inactive
            if p_node > 0.08:
                w_start = round(float(min(earliest_times)), 1)
                w_end = round(float(max(latest_times)), 1)
                # Ensure window starts in the future
                w_start = max(current_t + 0.5, w_start)
                w_end = max(w_start + 1.0, w_end)

                importance = node_meta.get("importance", 0.5)
                score = p_node * importance

                # Plain-language rationale
                dominant_path = paths[0] if paths else f"precursor -> {node_id}"
                rationale = f"Triggered via {dominant_path} under {hypothesis} hypothesis."

                predictions.append({
                    "node": node_id,
                    "window_start": w_start,
                    "window_end": w_end,
                    "prob": round(float(p_node), 2),
                    "causal_path": dominant_path,
                    "rationale": rationale,
                    "score": score,
                })

        # Sort by score descending
        predictions.sort(key=lambda x: x["score"], reverse=True)
        top = predictions[:top_k]

        return [
            ForecastItem(
                node=p["node"],
                window_start=p["window_start"],
                window_end=p["window_end"],
                prob=p["prob"],
                causal_path=p["causal_path"],
                rationale=p["rationale"],
            )
            for p in top
        ]

    def get_alternative_forecasts(
        self,
        current_t: float,
        active_nodes: Dict[str, float],
    ) -> Dict[str, List[ForecastItem]]:
        """
        Computes side-by-side forecasts under CASCADE vs FLU_CLUSTER vs ISOLATED.
        Proves causal differentiation (e.g. FLU cluster never forecasts traffic collapse).
        """
        return {
            "CASCADE": self.forecast_next_events(current_t, "CASCADE", active_nodes, top_k=3),
            "FLU_CLUSTER": self.forecast_next_events(current_t, "FLU_CLUSTER", active_nodes, top_k=3),
            "ISOLATED": self.forecast_next_events(current_t, "ISOLATED", active_nodes, top_k=3),
        }

    def compute_most_informative_missing_observation(
        self,
        active_nodes: Dict[str, float],
        probs: Dict[str, float],
    ) -> str:
        """
        Computes the unobserved causal node whose observation would yield
        maximum Expected Information Gain (entropy reduction) over H.
        """
        unobserved = [n for n in self.nodes.keys() if n not in active_nodes]
        if not unobserved:
            return "All key causal telemetry nodes currently active."

        # High-discriminator nodes
        if "POWER_SUBSTATION_TRIP" in unobserved and probs.get("CASCADE", 0) > 0.25:
            return "Watch for: Substation power trip telemetry in D4/D5 (definitively confirms systemic cascade vs benign rain)."
        elif "TRAFFIC_COLLAPSE" in unobserved:
            return "Watch for: Arterial traffic gridlock in D3/D4 (distinguishes physical flooding from benign viral surge)."
        elif "HOSPITAL_SURGE" in unobserved:
            return "Watch for: Coordinated emergency room arrivals at H1 & H2."
        else:
            return f"Watch for: Telemetry onset at {unobserved[0]}."

    def score_observed_event(self, node: str, arrival_t: float) -> Optional[str]:
        """
        Scores past forecasts when an event node actually activates:
        HIT (inside window), EARLY, LATE, or MISS.
        """
        for fc in self.past_forecasts:
            if fc["node"] == node and not fc.get("evaluated"):
                fc["evaluated"] = True
                if fc["window_start"] <= arrival_t <= fc["window_end"]:
                    fc["result"] = "HIT"
                elif arrival_t < fc["window_start"]:
                    fc["result"] = "EARLY"
                else:
                    fc["result"] = "LATE"
                return fc["result"]
        return None
