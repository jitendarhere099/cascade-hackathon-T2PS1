from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class SQLiteStore:
    """
    SQLite persistence layer for Firstlight.
    Persists source trust Beta parameters, base rate priors, calibrator weights,
    prefix bank entries, fatigue, and resolved episode history across restarts.
    """

    def __init__(self, db_path: str = "firstlight.db") -> None:
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
                CREATE TABLE IF NOT EXISTS source_trust (
                    source_id TEXT PRIMARY KEY,
                    alpha REAL NOT NULL,
                    beta REAL NOT NULL,
                    last_updated_episode INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS gateway_reliability (
                    gateway_id TEXT PRIMARY KEY,
                    p_outage REAL NOT NULL,
                    episodes_seen INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS base_rate_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    episode_idx INTEGER NOT NULL,
                    alpha_noise REAL NOT NULL,
                    alpha_sensor REAL NOT NULL,
                    alpha_isolated REAL NOT NULL,
                    alpha_cascade REAL NOT NULL,
                    change_point_detected INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS calibrator_state (
                    id INTEGER PRIMARY KEY,
                    state_json TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS prefix_bank (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    episode_id TEXT NOT NULL,
                    minute INTEGER NOT NULL,
                    features_json TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS fatigue_state (
                    id INTEGER PRIMARY KEY,
                    fatigue REAL NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS episodes (
                    episode_id TEXT PRIMARY KEY,
                    scenario TEXT NOT NULL,
                    variant TEXT,
                    seed INTEGER NOT NULL,
                    ground_truth TEXT NOT NULL,
                    total_minutes INTEGER NOT NULL,
                    final_action TEXT NOT NULL,
                    total_cost REAL NOT NULL,
                    flip_count INTEGER NOT NULL,
                    resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS officer_decisions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    episode_id TEXT NOT NULL,
                    t INTEGER NOT NULL,
                    officer_action TEXT NOT NULL,
                    system_action TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()

    def get_source_trust(self) -> Dict[str, Tuple[float, float]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT source_id, alpha, beta FROM source_trust")
            rows = cursor.fetchall()
            return {r["source_id"]: (float(r["alpha"]), float(r["beta"])) for r in rows}

    def set_source_trust(self, source_id: str, alpha: float, beta: float, episode: int = 0) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO source_trust (source_id, alpha, beta, last_updated_episode)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(source_id) DO UPDATE SET
                    alpha = excluded.alpha,
                    beta = excluded.beta,
                    last_updated_episode = excluded.last_updated_episode
            """, (source_id, alpha, beta, episode))
            conn.commit()

    def record_base_rates(self, episode_idx: int, alphas: Tuple[float, float, float, float], change_point: bool = False) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO base_rate_history (episode_idx, alpha_noise, alpha_sensor, alpha_isolated, alpha_cascade, change_point_detected)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (episode_idx, alphas[0], alphas[1], alphas[2], alphas[3], 1 if change_point else 0))
            conn.commit()

    def get_base_rate_history(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM base_rate_history ORDER BY episode_idx ASC")
            return [dict(r) for r in cursor.fetchall()]

    def save_calibrator_state(self, state: Dict[str, Any]) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO calibrator_state (id, state_json) VALUES (1, ?)
                ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP
            """, (json.dumps(state),))
            conn.commit()

    def load_calibrator_state(self) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT state_json FROM calibrator_state WHERE id = 1")
            row = cursor.fetchone()
            return json.loads(row["state_json"]) if row else None

    def add_prefix_entry(self, episode_id: str, minute: int, features: List[float], outcome: str) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO prefix_bank (episode_id, minute, features_json, outcome)
                VALUES (?, ?, ?, ?)
            """, (episode_id, minute, json.dumps(features), outcome))
            conn.commit()

    def get_prefix_bank(self, minute: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if minute is not None:
                cursor.execute("SELECT * FROM prefix_bank WHERE minute = ?", (minute,))
            else:
                cursor.execute("SELECT * FROM prefix_bank")
            rows = cursor.fetchall()
            return [
                {
                    "episode_id": r["episode_id"],
                    "minute": r["minute"],
                    "features": json.loads(r["features_json"]),
                    "outcome": r["outcome"],
                }
                for r in rows
            ]

    def record_fatigue(self, fatigue: float) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO fatigue_state (id, fatigue) VALUES (1, ?)
                ON CONFLICT(id) DO UPDATE SET fatigue = excluded.fatigue, updated_at = CURRENT_TIMESTAMP
            """, (fatigue,))
            conn.commit()

    def get_fatigue(self) -> float:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT fatigue FROM fatigue_state WHERE id = 1")
            row = cursor.fetchone()
            return float(row["fatigue"]) if row else 0.0

    def record_officer_decision(self, episode_id: str, t: int, officer_action: str, system_action: str, notes: Optional[str] = None) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO officer_decisions (episode_id, t, officer_action, system_action, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (episode_id, t, officer_action, system_action, notes))
            conn.commit()

    def get_officer_decisions(self, episode_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM officer_decisions WHERE episode_id = ? ORDER BY t ASC", (episode_id,))
            return [dict(r) for r in cursor.fetchall()]

    def record_episode_resolution(
        self, episode_id: str, scenario: str, variant: Optional[str], seed: int,
        ground_truth: str, total_minutes: int, final_action: str, total_cost: float, flip_count: int
    ) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO episodes (episode_id, scenario, variant, seed, ground_truth, total_minutes, final_action, total_cost, flip_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(episode_id) DO UPDATE SET
                    ground_truth = excluded.ground_truth,
                    total_minutes = excluded.total_minutes,
                    final_action = excluded.final_action,
                    total_cost = excluded.total_cost,
                    flip_count = excluded.flip_count,
                    resolved_at = CURRENT_TIMESTAMP
            """, (episode_id, scenario, variant, seed, ground_truth, total_minutes, final_action, total_cost, flip_count))
            conn.commit()

    def reset_learning(self) -> None:
        """Wipes learned state (trust, priors, calibrator, prefix bank, fatigue) for a clean demo."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
                DELETE FROM source_trust;
                DELETE FROM gateway_reliability;
                DELETE FROM base_rate_history;
                DELETE FROM calibrator_state;
                DELETE FROM prefix_bank;
                DELETE FROM fatigue_state;
            """)
            conn.commit()
