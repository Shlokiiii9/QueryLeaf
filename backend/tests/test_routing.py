"""
Automated Pytest Suite for Routing Logic and Energy Formulas
"""
import pytest
from backend.app.models import GatewayRequest, SimulationConfig
from backend.app.database import DatabaseStore
from backend.app.cache import GatewayCache
from backend.app.routing_engine import RoutingEngine
from backend.app.energy_model import EnergyModel

def test_cache_miss_then_hit():
    cache = GatewayCache()
    req = GatewayRequest(query_category="latest_status", device_id="DEV-CNC-001")
    key = cache.build_key(req)

    # First access: miss
    found, data, _ = cache.get(key)
    assert not found

    # Set cache
    cache.set(key, {"temp": 42.0}, ttl_seconds=60)

    # Second access: hit
    found, data, _ = cache.get(key)
    assert found
    assert data["temp"] == 42.0

def test_cache_freshness_sla():
    cache = GatewayCache()
    req = GatewayRequest(query_category="latest_status", device_id="DEV-CNC-001")
    key = cache.build_key(req)
    cache.set(key, {"temp": 42.0}, ttl_seconds=60)

    # max_age of 0 seconds forces stale rejection
    found, data, _ = cache.get(key, max_age_seconds=0)
    assert not found

def test_edge_eligibility_deep_history():
    db = DatabaseStore()
    req = GatewayRequest(query_category="deep_history", device_id="DEV-CNC-001")
    ok, reason = db.is_edge_eligible(req, edge_max_age_hours=24)
    assert not ok
    assert "historical" in reason.lower()

def test_energy_formula_calculation():
    cfg = SimulationConfig()
    res = EnergyModel.calculate_energy("edge", duration_ms=100.0, payload_bytes=1024, config=cfg)
    assert res["execution_path"] == "edge"
    assert res["total_energy_wh"] > 0
    assert res["carbon_emissions_g"] > 0

def test_adaptive_routing_cloud_vs_edge():
    db = DatabaseStore()
    cache = GatewayCache()
    engine = RoutingEngine(db, cache)
    cfg = SimulationConfig()

    # Query for recent status without cache
    req = GatewayRequest(query_category="latest_status", device_id="DEV-CNC-001")
    key = cache.build_key(req)
    decision = engine.evaluate_and_select(req, cfg, key)

    assert decision.selected_path in ["edge", "cache"]
    assert decision.candidates["edge"].eligible
