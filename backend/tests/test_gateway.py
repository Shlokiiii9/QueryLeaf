"""
Integration Tests for FastAPI Gateway REST Endpoints
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

def test_list_devices():
    res = client.get("/api/v1/devices")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 10
    assert any(d["device_id"] == "DEV-CNC-001" for d in data["devices"])

def test_execute_latest_status_query():
    res = client.post("/api/v1/query/execute", json={
        "query_category": "latest_status",
        "device_id": "DEV-CNC-001",
        "max_age_seconds": 30
    })
    assert res.status_code == 200
    data = res.json()
    assert "execution_path" in data
    assert "latency_ms" in data
    assert "energy_wh" in data
    assert data["execution_path"] in ["cache", "edge", "cloud"]

def test_metrics_overview():
    res = client.get("/api/v1/metrics/overview")
    assert res.status_code == 200
    data = res.json()
    assert "total_requests" in data
    assert "route_breakdown" in data

def test_update_simulation_config():
    res = client.post("/api/v1/simulation/config", json={
        "edge_cpu_utilization_pct": 80.0,
        "cloud_network_rtt_ms": 110.0
    })
    assert res.status_code == 200
    data = res.json()
    assert data["config"]["edge_cpu_utilization_pct"] == 80.0
    assert data["config"]["cloud_network_rtt_ms"] == 110.0
