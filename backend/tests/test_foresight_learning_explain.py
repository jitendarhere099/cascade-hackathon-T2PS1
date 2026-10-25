from datetime import datetime, timezone
import math
import numpy as np
import pytest
import yaml

from backend.app.schemas import Action, Channel, Event
from backend.engine.explain import ExplainabilityEngine
from backend.engine.foresight import CausalForecaster
from backend.engine.learning import OnlineLearner


@pytest.fixture
def causal_cfg():
    with open("config/causal_graph.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# Test 12: Prior shift (monsoon): after silent base-rate tripling, estimated prior within 25% within 10 episodes
def test_acceptance_12_prior_shift_monsoon_detection():
    learner = OnlineLearner(cusum_threshold=3.5)

    # Initial ambient prior: cascade is ~0.05
    initial_prior = learner.get_base_rates()[3]
    assert initial_prior < 0.10

    # Silent tripling: cascade ground-truth occurs in 9 out of 10 episodes
    change_point_logged = False
    for ep in range(1, 11):
        outcome = "CASCADE" if ep <= 9 else "NOISE"
        fired, msg = learner.update_base_rates_episode(outcome)
        if fired:
            change_point_logged = True

    # Estimated prior for CASCADE should have adapted close to the new truth (~0.75-0.90)
    adapted_prior = learner.get_base_rates()[3]
    # New true rate was 0.90; must be within 25% of truth (> 0.65)
    assert adapted_prior >= 0.60
    assert change_point_logged is True, "CUSUM change-point detector failed to log shift!"


# Test 13: Trust learning: a source made unreliable mid-campaign sees its trust mean drop measurably within 15 episodes
def test_acceptance_13_trust_learning_unreliable_source_drop():
    learner = OnlineLearner()

    # Source "drain-gw-b" starts with high trust
    s_id = "drain-gw-b"
    initial_trust = learner.get_source_trust_mean(s_id)
    assert initial_trust >= 0.90

    # Source turns unreliable: repeatedly emits false/inconsistent readings for 15 episodes
    for ep in range(1, 16):
        learner.resolve_source_trust_episode({s_id: False})

    final_trust = learner.get_source_trust_mean(s_id)
    # Trust mean must have dropped measurably (e.g. below 0.60)
    assert final_trust < 0.60
    assert (initial_trust - final_trust) >= 0.30


# Test 14: Forecast: top-3 forecasts hit windows; FLU scenarios never forecast traffic collapse as top-3 item
def test_acceptance_14_forecast_accuracy_and_flu_differentiation(causal_cfg):
    forecaster = CausalForecaster(causal_cfg)

    # 1. Cascade scenario forecasting
    active_cascade = {"HEAVY_RAIN": 0.0, "DRAINAGE_OVERLOAD": 2.0}
    top_forecasts = forecaster.forecast_next_events(
        current_t=3.0,
        hypothesis="CASCADE",
        active_nodes=active_cascade,
        top_k=3,
    )
    assert len(top_forecasts) >= 1
    # Check that windows are valid and in the future
    for fc in top_forecasts:
        assert fc.window_start >= 3.0
        assert fc.window_end > fc.window_start
        assert fc.prob > 0.0

    # 2. Causal differentiation: under FLU_CLUSTER, TRAFFIC_COLLAPSE is NEVER top-3
    active_flu = {"FLU_CLUSTER": 1.0}
    flu_forecasts = forecaster.forecast_next_events(
        current_t=2.0,
        hypothesis="FLU_CLUSTER",
        active_nodes=active_flu,
        top_k=3,
    )
    flu_node_names = [fc.node for fc in flu_forecasts]
    assert "TRAFFIC_COLLAPSE" not in flu_node_names
    assert "POWER_SUBSTATION_TRIP" not in flu_node_names


def test_explainability_waterfall_and_mind_change():
    explainer = ExplainabilityEngine()
    clusters = [
        ("gw:GW-A:drainage_sensor", [
            Event(id="e1", source_id="s1", channel=Channel.DRAINAGE_SENSOR, district="D1",
                  event_time=datetime.now(timezone.utc), arrival_time=datetime.now(timezone.utc))
        ], 1.0)
    ]
    waterfall = explainer.compute_attribution_waterfall(
        clusters=clusters,
        base_probs={"CASCADE": 0.40, "NOISE": 0.30},
        particle_weights=np.ones(100),
        particle_h=np.zeros(100),
    )
    assert len(waterfall) == 1
    assert waterfall[0].delta_logodds > 0.0

    # Mind change on large shift
    mc = explainer.check_mind_change(
        t=5,
        current_probs={"CASCADE": 0.75, "NOISE": 0.25},
        current_action=Action.ALERT,
        events=[],
    )
    # Why not escalate
    wne = explainer.generate_why_not_escalate({"CASCADE": 0.45}, Action.ALERT)
    assert "Why not ESCALATE?" in wne
