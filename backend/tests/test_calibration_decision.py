from datetime import datetime, timezone
import math
import numpy as np
import pytest
import yaml

from backend.app.schemas import Action, Channel, Event
from backend.engine.calibration import OnlineCalibrator, PrefixBank
from backend.engine.decision import DecisionEngine
from backend.engine.filter import InferenceEngine
from backend.sim.scenarios import ScenarioLibrary
from backend.sim.twins import TwinGenerator


@pytest.fixture
def world_cfg():
    with open("config/world.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


@pytest.fixture
def costs_cfg():
    with open("config/costs.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# Test 9: Twin test pre-split beliefs bit-identical and commit after split
def test_acceptance_9_twin_test_bit_identical_and_divergence(world_cfg):
    twin_pair = TwinGenerator.generate_pair(seed=42, total_minutes=12, split_minute=7)

    # Initialize two separate engines with identical seeds and frozen snapshot
    eng_a = InferenceEngine(world_cfg, N=2000, seed=777)
    eng_b = InferenceEngine(world_cfg, N=2000, seed=777)

    # Minutes 0 to 6 (pre-split): beliefs must be bit-identical!
    for t in range(7):
        state_a = eng_a.step_minute(t, twin_pair.twin_a[t])
        state_b = eng_b.step_minute(t, twin_pair.twin_b[t])

        # Bit-identical check: |pA - pB| == 0
        for hyp in ["NOISE", "SENSOR_FAILURE", "ISOLATED", "CASCADE"]:
            pa = state_a["probs"][hyp]
            pb = state_b["probs"][hyp]
            assert pa == pb, f"Twin divergence at minute {t} for {hyp}: {pa} vs {pb}"

    # Minutes 7 to 11 (post-split): cascade twin must commit to CASCADE
    cascade_committed = False
    for t in range(7, 12):
        state_a = eng_a.step_minute(t, twin_pair.twin_a[t])
        state_b = eng_b.step_minute(t, twin_pair.twin_b[t])
        if state_b["probs"]["CASCADE"] >= 0.70:
            cascade_committed = True

    assert cascade_committed is True, "Cascade twin failed to commit after split!"


# Test 10: Calibration layer produces valid calibrated outputs and fits online via SGD
def test_acceptance_10_online_calibrator_sgd_convergence():
    calibrator = OnlineCalibrator(lr=0.05)

    # Raw overconfident probabilities on noisy ambiguous events
    raw_probs = np.array([0.45, 0.05, 0.10, 0.40])

    # Simulate resolved episodes where ground truth is NOISE (class 0)
    initial_loss = calibrator.update_sgd(raw_probs, t=2, true_class_idx=0)
    for _ in range(50):
        final_loss = calibrator.update_sgd(raw_probs, t=2, true_class_idx=0)

    # Log-loss should decrease
    assert final_loss < initial_loss
    # Calibrated probability for true class (0) should have increased
    calibrated = calibrator.calibrate(raw_probs, t=2)
    assert calibrated[0] > raw_probs[0]


# Test 11: Stability: flip_count under threshold on noisy benign streams; ESCALATE never followed by WATCH
def test_acceptance_11_stability_anti_flip_flop(costs_cfg):
    decision_engine = DecisionEngine(costs_cfg)

    # Simulate fluctuating probabilities around threshold
    # e.g., noisy oscillation between 0.35 and 0.55
    probs_sequence = [
        {"CASCADE": 0.20, "NOISE": 0.80},
        {"CASCADE": 0.45, "NOISE": 0.55},
        {"CASCADE": 0.35, "NOISE": 0.65},
        {"CASCADE": 0.52, "NOISE": 0.48},
        {"CASCADE": 0.38, "NOISE": 0.62},
        {"CASCADE": 0.50, "NOISE": 0.50},
        {"CASCADE": 0.40, "NOISE": 0.60},
    ]

    for t, probs in enumerate(probs_sequence):
        act, _, _, _, _ = decision_engine.decide(t=t, probs=probs, delay_minutes=float(t))

    # Flip count must be tightly bounded by dwell time and hysteresis
    assert decision_engine.flip_count <= 2

    # Verify ESCALATE is never directly followed by WATCH
    decision_engine.reset_episode()
    # Force high cascade probability -> ESCALATE
    act1, _, _, _, _ = decision_engine.decide(t=0, probs={"CASCADE": 0.95, "NOISE": 0.05}, delay_minutes=5.0)
    assert act1 == Action.ESCALATE

    # Drop probability to zero next minute
    act2, _, _, _, _ = decision_engine.decide(t=1, probs={"CASCADE": 0.02, "NOISE": 0.98}, delay_minutes=6.0)
    # Must hold dwell time or step down to ALERT, never jump directly to WATCH
    assert act2 != Action.WATCH
