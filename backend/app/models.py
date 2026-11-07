"""
Pydantic Data Models and Schemas for GreenRoute Gateway
"""
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

RoutingPolicy = Literal["adaptive", "cache_first", "cloud_only", "fixed_rule"]
ExecutionPath = Literal["cache", "edge", "cloud"]
QueryCategory = Literal[
    "latest_status",
    "recent_history",
    "deep_history",
    "edge_aggregation",
    "cloud_analytics"
]
MachineStatus = Literal["nominal", "warning", "critical", "idle"]

class SensorRecord(BaseModel):
    id: str
    device_id: str
    factory_id: str
    sensor_type: str
    timestamp: str
    temperature: float
    humidity: float
    vibration: float
    pressure: float
    machine_status: MachineStatus
    location: str

class DeviceInfo(BaseModel):
    device_id: str
    factory_id: str
    sensor_type: str
    model: str
    location: str
    edge_hosted: bool = True
    last_seen: str
    sampling_rate_hz: int = 50

class CandidateEvaluation(BaseModel):
    path: ExecutionPath
    eligible: bool
    ineligibility_reason: Optional[str] = None
    estimated_latency_ms: float
    estimated_energy_wh: float
    estimated_cost_units: float
    objective_score: float
    components: Dict[str, float]

class RoutingDecision(BaseModel):
    request_id: str
    selected_path: ExecutionPath
    policy_used: RoutingPolicy
    reason: str
    candidates: Dict[str, CandidateEvaluation]
    timestamp: str

class GatewayRequest(BaseModel):
    query_category: QueryCategory
    device_id: Optional[str] = None
    factory_id: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    max_age_seconds: Optional[int] = None
    deadline_ms: Optional[float] = None
    force_policy: Optional[RoutingPolicy] = None
    aggregation_type: Optional[Literal["avg", "max", "min", "count"]] = "avg"
    metric: Optional[Literal["temperature", "vibration", "pressure", "humidity"]] = "temperature"

class GatewayTelemetry(BaseModel):
    request_id: str
    timestamp: str
    query_category: QueryCategory
    execution_path: ExecutionPath
    duration_ms: float
    result_count: int
    payload_bytes: int
    cache_hit: bool
    cache_age_seconds: Optional[float] = None
    estimated_energy_wh: float
    estimated_carbon_g: float
    decision_reason: str
    policy: RoutingPolicy
    success: bool
    error: Optional[str] = None

class SimulationConfig(BaseModel):
    alpha_latency: float = Field(0.45, description="Weight for normalized latency")
    beta_energy: float = Field(0.40, description="Weight for normalized energy")
    gamma_cost: float = Field(0.15, description="Weight for operational cost")
    active_policy: RoutingPolicy = "adaptive"
    edge_cpu_utilization_pct: float = Field(35.0, ge=0.0, le=100.0)
    edge_base_latency_ms: float = 12.0
    edge_power_watts: float = 8.5
    edge_max_age_hours: int = 24
    cloud_network_rtt_ms: float = 65.0
    cloud_packet_loss_pct: float = 1.5
    cloud_power_watts: float = 45.0
    network_energy_per_mb_wh: float = 0.052
    cache_ttl_seconds: int = 60
    cache_power_watts: float = 2.2
    carbon_intensity_g_per_kwh: float = 385.0
