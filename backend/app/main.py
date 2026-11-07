"""
GreenRoute FastAPI Gateway Main Application
"""
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from .models import (
    GatewayRequest,
    SimulationConfig,
    GatewayTelemetry,
    DeviceInfo
)
from .database import DatabaseStore
from .cache import GatewayCache
from .energy_model import EnergyModel
from .routing_engine import RoutingEngine

app = FastAPI(
    title="GreenRoute — Smart Energy-Aware API Gateway for IoT",
    description="Adaptive API Gateway optimizing execution across Cache, Edge MongoDB, and Cloud data warehouse.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseStore()
cache = GatewayCache()
routing_engine = RoutingEngine(db, cache)
sim_config = SimulationConfig()
telemetry_history: List[GatewayTelemetry] = []

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "GreenRoute Gateway (Python / FastAPI)",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/v1/devices", response_model=Dict[str, Any])
def list_devices():
    devs = list(db.devices.values())
    return {"total": len(devs), "devices": devs}

@app.get("/api/v1/devices/{device_id}/latest")
def get_device_latest(device_id: str):
    if device_id not in db.devices:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    req = GatewayRequest(query_category="latest_status", device_id=device_id, max_age_seconds=30)
    return execute_pipeline(req)

@app.post("/api/v1/query/execute")
def execute_query(req: GatewayRequest):
    return execute_pipeline(req)

def execute_pipeline(req: GatewayRequest) -> Dict[str, Any]:
    t0 = time.perf_counter()
    cache_key = cache.build_key(req)
    decision = routing_engine.evaluate_and_select(req, sim_config, cache_key)
    path = decision.selected_path

    cache_hit = False
    result_data = None
    payload_bytes = 0

    if path == "cache":
        found, data, age = cache.get(cache_key, req.max_age_seconds)
        if found:
            cache_hit = True
            result_data = data
            payload_bytes = len(str(data).encode("utf-8"))
        else:
            result_data, _, payload_bytes = db.query_edge(req)
            cache.set(cache_key, result_data, sim_config.cache_ttl_seconds)
    elif path == "edge":
        result_data, _, payload_bytes = db.query_edge(req)
        cache.set(cache_key, result_data, sim_config.cache_ttl_seconds)
    else:
        result_data, _, payload_bytes = db.query_cloud(req)

    duration_ms = max(1.5, (time.perf_counter() - t0) * 1000.0)
    if path == "cloud":
        duration_ms += sim_config.cloud_network_rtt_ms

    energy_data = EnergyModel.calculate_energy(path, duration_ms, payload_bytes, sim_config)

    telemetry = GatewayTelemetry(
        request_id=decision.request_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        query_category=req.query_category,
        execution_path=path,
        duration_ms=round(duration_ms, 2),
        result_count=len(result_data) if isinstance(result_data, list) else (1 if result_data else 0),
        payload_bytes=payload_bytes,
        cache_hit=cache_hit,
        estimated_energy_wh=energy_data["total_energy_wh"],
        estimated_carbon_g=energy_data["carbon_emissions_g"],
        decision_reason=decision.reason,
        policy=decision.policy_used,
        success=True
    )
    telemetry_history.insert(0, telemetry)
    if len(telemetry_history) > 300:
        telemetry_history.pop()

    return {
        "request_id": decision.request_id,
        "execution_path": path,
        "policy_applied": decision.policy_used,
        "latency_ms": telemetry.duration_ms,
        "energy_wh": telemetry.estimated_energy_wh,
        "carbon_g": telemetry.estimated_carbon_g,
        "cache_hit": cache_hit,
        "routing_explanation": decision.reason,
        "candidate_evaluations": decision.candidates,
        "data": result_data
    }

@app.get("/api/v1/metrics/overview")
def metrics_overview():
    total = len(telemetry_history)
    cache_hits = len([t for t in telemetry_history if t.execution_path == "cache"])
    edge_cnt = len([t for t in telemetry_history if t.execution_path == "edge"])
    cloud_cnt = len([t for t in telemetry_history if t.execution_path == "cloud"])
    total_energy = sum(t.estimated_energy_wh for t in telemetry_history)
    total_carbon = sum(t.estimated_carbon_g for t in telemetry_history)
    lats = sorted([t.duration_ms for t in telemetry_history])
    med_lat = lats[len(lats)//2] if lats else 0.0

    return {
        "total_requests": total,
        "route_breakdown": {"cache": cache_hits, "edge": edge_cnt, "cloud": cloud_cnt},
        "cache_hit_rate_pct": round((cache_hits / total) * 100, 1) if total > 0 else 0.0,
        "median_latency_ms": round(med_lat, 1),
        "total_energy_wh": round(total_energy, 5),
        "total_carbon_g": round(total_carbon, 5)
    }

@app.get("/api/v1/simulation/config")
def get_sim_config():
    return sim_config

@app.post("/api/v1/simulation/config")
def update_sim_config(cfg: SimulationConfig):
    global sim_config
    sim_config = cfg
    return {"status": "updated", "config": sim_config}
