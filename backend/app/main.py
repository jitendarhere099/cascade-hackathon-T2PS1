from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

# Ensure project root and backend dir are in sys.path for robust imports
_backend_dir = Path(__file__).resolve().parent.parent
_repo_dir = _backend_dir.parent
for _p in [str(_repo_dir), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import yaml

try:
    from backend.app.ledger import BitemporalLedger
    from backend.app.schemas import (
        Action,
        BeliefUpdate,
        EpisodeCreateRequest,
        Event,
        FaultInjectionRequest,
        OfficerDecisionRequest,
    )
    from backend.engine.calibration import OnlineCalibrator, PrefixBank
    from backend.engine.decision import DecisionEngine
    from backend.engine.explain import ExplainabilityEngine
    from backend.engine.filter import InferenceEngine
    from backend.engine.foresight import CausalForecaster
    from backend.engine.learning import OnlineLearner
    from backend.sim.faults import FaultInjector
    from backend.sim.scenarios import ScenarioLibrary
    from backend.sim.twins import TwinGenerator
    from backend.store import SQLiteStore
except ImportError:
    from app.ledger import BitemporalLedger
    from app.schemas import (
        Action,
        BeliefUpdate,
        EpisodeCreateRequest,
        Event,
        FaultInjectionRequest,
        OfficerDecisionRequest,
    )
    from engine.calibration import OnlineCalibrator, PrefixBank
    from engine.decision import DecisionEngine
    from engine.explain import ExplainabilityEngine
    from engine.filter import InferenceEngine
    from engine.foresight import CausalForecaster
    from engine.learning import OnlineLearner
    from sim.faults import FaultInjector
    from sim.scenarios import ScenarioLibrary
    from sim.twins import TwinGenerator
    from store import SQLiteStore


# Active episode state container
class EpisodeSession:
    def __init__(self, episode_id: str, scenario: str, variant: str, seed: int, world_cfg: dict, costs_cfg: dict, causal_cfg: dict) -> None:
        self.episode_id = episode_id
        self.scenario = scenario
        self.variant = variant
        self.seed = seed
        self.world_cfg = world_cfg
        self.costs_cfg = costs_cfg
        self.causal_cfg = causal_cfg

        self.ledger = BitemporalLedger()
        self.engine = InferenceEngine(world_cfg, N=world_cfg.get("engine", {}).get("particles", 4000), seed=seed)
        self.decision_engine = DecisionEngine(costs_cfg)
        self.forecaster = CausalForecaster(causal_cfg)
        self.explainer = ExplainabilityEngine()
        self.fault_injector = FaultInjector(seed=seed)

        # Pre-generate simulated event schedule for the scenario
        self.total_minutes = 15
        self.simulated_schedule = ScenarioLibrary.generate_episode(
            scenario_id=scenario,
            total_minutes=self.total_minutes,
            seed=seed,
            variant=variant,
            world_cfg_path="config/world.yaml",
            causal_cfg_path="config/causal_graph.yaml",
        )

        self.current_t = 0
        self.is_playing = False
        self.speed = 1.0  # Simulated seconds per minute tick
        self.belief_history: Dict[int, BeliefUpdate] = {}
        self.active_causal_nodes: Dict[str, float] = {}

    def step(self) -> BeliefUpdate:
        t = self.current_t
        # Events scheduled for this minute
        scheduled = self.simulated_schedule[t] if t < len(self.simulated_schedule) else []

        # Apply any active live faults
        sim_time = datetime(2026, 10, 25, 0, t, 0, tzinfo=timezone.utc)
        scheduled = self.fault_injector.apply_faults(scheduled, sim_time)

        # Ingest into ledger
        needs_rollback = False
        for e in scheduled:
            _, rb = self.ledger.ingest(e, current_sim_time=sim_time)
            if rb:
                needs_rollback = True

        if needs_rollback:
            # Re-filter from 0
            all_by_min = {m: self.ledger.get_events_for_minute(datetime(2026, 10, 25, 0, m + 1, 0, tzinfo=timezone.utc)) for m in range(t + 1)}
            self.engine.rollback_and_refilter(0, all_by_min, self.ledger.content_hash())

        # Step engine
        minute_events = self.ledger.get_events_for_minute(datetime(2026, 10, 25, 0, t + 1, 0, tzinfo=timezone.utc))
        engine_state = self.engine.step_minute(t, minute_events)

        # Update active causal nodes tracking
        if t >= 0:
            self.active_causal_nodes["HEAVY_RAIN"] = 0.0
        if t >= 3:
            self.active_causal_nodes["DRAINAGE_OVERLOAD"] = 3.0
        if t >= 5:
            self.active_causal_nodes["TRAFFIC_COLLAPSE"] = 5.0
        if t >= 7:
            self.active_causal_nodes["EMERGENCY_CALL_SURGE"] = 7.0
        if t >= 9 and self.variant == "cascade":
            self.active_causal_nodes["HOSPITAL_SURGE"] = 9.0
            self.active_causal_nodes["POWER_SUBSTATION_TRIP"] = 11.0

        # Step Decision Engine
        action, exp_costs, val_wait, dec_margin, reasons = self.decision_engine.decide(
            t=t,
            probs=engine_state["probs"],
            delay_minutes=float(t),
        )

        # Step Foresight
        top_hyp = max(engine_state["probs"].items(), key=lambda kv: kv[1])[0]
        forecasts = self.forecaster.forecast_next_events(
            current_t=float(t),
            hypothesis=top_hyp,
            active_nodes=self.active_causal_nodes,
            top_k=3,
        )
        next_best = self.forecaster.compute_most_informative_missing_observation(
            self.active_causal_nodes,
            engine_state["probs"],
        )

        # Step Explainability
        clusters = self.engine.robustness.cluster_events(minute_events)
        attribution = self.explainer.compute_attribution_waterfall(
            clusters=clusters,
            base_probs=engine_state["probs"],
            particle_weights=self.engine.particles.get_normalized_weights(),
            particle_h=self.engine.particles.h,
        )
        mind_change = self.explainer.check_mind_change(
            t=t,
            current_probs=engine_state["probs"],
            current_action=action,
            events=minute_events,
        )
        devils_advocate = self.explainer.generate_devils_advocate(engine_state["probs"])
        why_not_esc = self.explainer.generate_why_not_escalate(engine_state["probs"], action)

        wall_str = sim_time.strftime("T+%M:%S")

        update = BeliefUpdate(
            episode_id=self.episode_id,
            t=t,
            wall_clock=wall_str,
            probs=engine_state["probs"],
            raw_probs=engine_state["raw_probs"],
            intervals_90=engine_state["intervals_90"],
            ess=engine_state["ess"],
            nuisance=engine_state["nuisance"],
            action=action,
            action_expected_costs=exp_costs,
            value_of_waiting=val_wait,
            decision_margin=dec_margin,
            fatigue=round(self.decision_engine.fatigue, 3),
            flip_count=self.decision_engine.flip_count,
            dwell_remaining=self.decision_engine.dwell_remaining,
            reason_codes=reasons,
            forecast=forecasts,
            next_best_observation=next_best,
            data_health=engine_state["data_health"],
            source_trust=self.engine.source_trust,
            attribution=attribution,
            mind_change=mind_change,
            devils_advocate=devils_advocate,
            why_not_escalate=why_not_esc,
            ledger_stats=self.ledger.get_ledger_stats(),
        )

        self.belief_history[t] = update
        self.current_t += 1
        return update


# Global context
store = SQLiteStore("firstlight.db")
learner = OnlineLearner()
calibrator = OnlineCalibrator()
prefix_bank = PrefixBank()
sessions: Dict[str, EpisodeSession] = {}


def load_yaml(rel_path: str) -> dict:
    base = Path(__file__).parent.parent
    path = base / rel_path
    if not path.exists():
        path = Path(rel_path)
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


world_config = load_yaml("config/world.yaml")
costs_config = load_yaml("config/costs.yaml")
causal_config = load_yaml("config/causal_graph.yaml")


app = FastAPI(
    title="Firstlight API",
    version="1.0.0",
    description="Calibrated Crisis-Prediction and Decision System API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"system": "Firstlight", "status": "operational", "city": "Meridian"}


@app.post("/episodes")
def create_episode(req: EpisodeCreateRequest):
    ep_id = f"ep-{datetime.now().strftime('%Y%m%d%H%M%S')}-{req.seed}"
    session = EpisodeSession(
        episode_id=ep_id,
        scenario=req.scenario,
        variant=req.variant or "default",
        seed=req.seed,
        world_cfg=world_config,
        costs_cfg=costs_config,
        causal_cfg=causal_config,
    )
    # Inject learned trust into engine
    session.engine.set_source_trust_map(learner.get_all_trust_means())
    sessions[ep_id] = session
    return {"episode_id": ep_id, "scenario": req.scenario, "variant": req.variant, "seed": req.seed}


@app.get("/episodes/{episode_id}")
def get_episode(episode_id: str):
    if episode_id not in sessions:
        raise HTTPException(status_code=404, detail="Episode not found")
    s = sessions[episode_id]
    return {
        "episode_id": s.episode_id,
        "scenario": s.scenario,
        "variant": s.variant,
        "current_t": s.current_t,
        "total_minutes": s.total_minutes,
        "is_playing": s.is_playing,
        "speed": s.speed,
    }


@app.get("/episodes/{episode_id}/belief")
def get_belief(episode_id: str, t: Optional[int] = Query(None)):
    if episode_id not in sessions:
        raise HTTPException(status_code=404, detail="Episode not found")
    s = sessions[episode_id]
    query_t = s.current_t - 1 if t is None else t
    if query_t not in s.belief_history:
        # Step until requested minute if not yet stepped
        while s.current_t <= query_t and s.current_t < s.total_minutes:
            s.step()
    if query_t not in s.belief_history:
        raise HTTPException(status_code=404, detail=f"Belief state at minute {query_t} not available")
    return s.belief_history[query_t]


@app.post("/episodes/{episode_id}/officer-decision")
def log_officer_decision(episode_id: str, req: OfficerDecisionRequest):
    if episode_id not in sessions:
        raise HTTPException(status_code=404, detail="Episode not found")
    s = sessions[episode_id]
    sys_action = s.decision_engine.current_action.value
    store.record_officer_decision(episode_id, req.t, req.action.value, sys_action, req.notes)
    return {"status": "recorded", "officer_action": req.action.value, "system_action": sys_action}


@app.post("/events")
def ingest_event(event_dict: dict, episode_id: Optional[str] = None):
    # Route to active episode or fallback
    target_session = sessions.get(episode_id) if episode_id else (list(sessions.values())[-1] if sessions else None)
    if not target_session:
        raise HTTPException(status_code=400, detail="No active episode to receive event")
    ev, rb = target_session.ledger.ingest(event_dict)
    if ev is None:
        return {"status": "quarantined"}
    return {"status": ev.status.value, "event_id": ev.id, "rollback_triggered": rb}


@app.post("/faults")
def inject_fault(req: FaultInjectionRequest, episode_id: Optional[str] = None):
    target_session = sessions.get(episode_id) if episode_id else (list(sessions.values())[-1] if sessions else None)
    if not target_session:
        raise HTTPException(status_code=400, detail="No active episode")
    if req.fault_type == "gateway_blackout" and req.target:
        target_session.fault_injector.inject_gateway_blackout(req.target)
    elif req.fault_type == "channel_cutout" and req.target:
        target_session.fault_injector.inject_channel_cutout(Channel(req.target))
    elif req.fault_type == "sensor_stuck_high" and req.target:
        target_session.fault_injector.inject_sensor_stuck_high(req.target, float(req.params.get("val", 9.9)))
    return {"status": "injected", "fault": req.fault_type, "target": req.target}


@app.get("/costs")
def get_costs():
    return costs_config


@app.put("/costs")
def update_costs(new_costs: dict):
    global costs_config
    costs_config.update(new_costs)
    for s in sessions.values():
        s.decision_engine = DecisionEngine(costs_config)
    return {"status": "updated", "costs": costs_config}


@app.get("/trust")
def get_trust():
    return {
        "raw_betas": store.get_source_trust(),
        "means": learner.get_all_trust_means(),
    }


@app.get("/priors")
def get_priors():
    return {
        "base_rates": list(learner.get_base_rates()),
        "dirichlet_alphas": list(learner.dirichlet_alphas),
        "history": store.get_base_rate_history(),
        "change_point_detected": learner.change_point_detected,
    }


@app.post("/episodes/{episode_id}/resolve")
def resolve_episode(episode_id: str, ground_truth: str = "CASCADE"):
    if episode_id not in sessions:
        raise HTTPException(status_code=404, detail="Episode not found")
    s = sessions[episode_id]

    # Update base rates
    fired, msg = learner.update_base_rates_episode(ground_truth)
    store.record_base_rates(learner.episodes_resolved, tuple(learner.dirichlet_alphas), change_point=fired)

    # Record episode resolution
    last_b = s.belief_history.get(s.current_t - 1)
    final_act = last_b.action.value if last_b else "WATCH"
    tot_cost = last_b.action_expected_costs.get(final_act, 0.0) if last_b else 0.0
    flips = s.decision_engine.flip_count

    store.record_episode_resolution(
        episode_id=episode_id,
        scenario=s.scenario,
        variant=s.variant,
        seed=s.seed,
        ground_truth=ground_truth,
        total_minutes=s.current_t,
        final_action=final_act,
        total_cost=tot_cost,
        flip_count=flips,
    )

    # Prefix bank capture at minutes 3, 5, 7, 10
    for m in (3, 5, 7, 10):
        if m in s.belief_history:
            b = s.belief_history[m]
            sig = [b.probs["NOISE"], b.probs["SENSOR_FAILURE"], b.probs["ISOLATED"], b.probs["CASCADE"]]
            prefix_bank.add_entry(episode_id, m, sig, ground_truth)
            store.add_prefix_entry(episode_id, m, sig, ground_truth)

    return {"status": "resolved", "ground_truth": ground_truth, "change_point_fired": fired, "msg": msg}


@app.post("/reset-learning")
def reset_learning():
    store.reset_learning()
    learner.dirichlet_alphas = np.array([15.0, 2.0, 2.0, 1.0], dtype=np.float64)
    learner.source_trust.clear()
    learner.change_point_detected = False
    return {"status": "learning_reset_complete"}


@app.post("/twins")
def generate_twins(seed: int = 42):
    pair = TwinGenerator.generate_pair(seed=seed)
    return {
        "twin_id": pair.twin_id,
        "seed": pair.seed,
        "split_minute": pair.split_minute,
        "minutes": len(pair.twin_a),
    }


# WebSocket stream for real-time per-minute updates with client playback control
@app.websocket("/episodes/{episode_id}/stream")
async def episode_stream(websocket: WebSocket, episode_id: str):
    await websocket.accept()
    if episode_id not in sessions:
        # Auto-create if not existing
        sessions[episode_id] = EpisodeSession(
            episode_id=episode_id,
            scenario="tuesday_evening",
            variant="cascade",
            seed=42,
            world_cfg=world_config,
            costs_cfg=costs_config,
            causal_cfg=causal_config,
        )

    session = sessions[episode_id]

    try:
        # Send initial belief
        init_belief = session.step() if session.current_t == 0 else session.belief_history[session.current_t - 1]
        await websocket.send_text(init_belief.model_dump_json())

        while True:
            # Check for incoming client control commands
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                data = json.loads(msg)
                cmd = data.get("cmd")

                if cmd == "play":
                    session.is_playing = True
                elif cmd == "pause":
                    session.is_playing = False
                elif cmd == "step":
                    session.is_playing = False
                    if session.current_t < session.total_minutes:
                        update = session.step()
                        await websocket.send_text(update.model_dump_json())
                elif cmd == "speed":
                    session.speed = float(data.get("speed", 1.0))
                elif cmd == "seek":
                    target_t = int(data.get("t", 0))
                    if target_t in session.belief_history:
                        await websocket.send_text(session.belief_history[target_t].model_dump_json())
            except asyncio.TimeoutError:
                pass

            if session.is_playing and session.current_t < session.total_minutes:
                update = session.step()
                await websocket.send_text(update.model_dump_json())
                # Delay based on playback speed (1x = 1.0s, 5x = 0.2s, 20x = 0.05s)
                delay_sec = max(0.02, 1.0 / session.speed)
                await asyncio.sleep(delay_sec)
            else:
                await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        # Gracefully handle disconnect
        pass
