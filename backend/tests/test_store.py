import os
import pytest
from backend.store import SQLiteStore


def test_sqlite_store_roundtrip(tmp_path):
    db_file = str(tmp_path / "test_fl.db")
    store = SQLiteStore(db_file)

    # Trust
    store.set_source_trust("gw-a", 15.0, 2.0, episode=1)
    trust = store.get_source_trust()
    assert "gw-a" in trust
    assert trust["gw-a"] == (15.0, 2.0)

    # Base rates
    store.record_base_rates(1, (10.0, 2.0, 5.0, 1.0), change_point=False)
    history = store.get_base_rate_history()
    assert len(history) == 1
    assert history[0]["alpha_noise"] == 10.0

    # Prefix bank
    store.add_prefix_entry("ep-001", 3, [0.5, 1.2, 0.0], "CASCADE")
    bank = store.get_prefix_bank(minute=3)
    assert len(bank) == 1
    assert bank[0]["outcome"] == "CASCADE"

    # Reset learning
    store.reset_learning()
    assert len(store.get_source_trust()) == 0
    assert len(store.get_base_rate_history()) == 0
    assert len(store.get_prefix_bank()) == 0
