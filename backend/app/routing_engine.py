"""
Adaptive Energy-Aware Routing Engine for Python Backend
Formulates: J(route) = alpha * norm_latency + beta * norm_energy + gamma * norm_cost
"""
import uuid
from datetime import datetime, timezone
from typing import Dict
from .models import (
    GatewayRequest,
    SimulationConfig,
    CandidateEvaluation,
    RoutingDecision,
    ExecutionPath,
    RoutingPolicy
)
from .database import DatabaseStore
from .cache import GatewayCache
from .energy_model import EnergyModel

class RoutingEngine:
    def __init__(self, db: DatabaseStore, cache: GatewayCache):
        self.db = db
        self.cache = cache

    def evaluate_and_select(self, req: GatewayRequest, config: SimulationConfig, cache_key: str) -> RoutingDecision:
        policy: RoutingPolicy = req.force_policy or config.active_policy
        candidates: Dict[str, CandidateEvaluation] = {
            "cache": self._init_candidate("cache"),
            "edge": self._init_candidate("edge"),
            "cloud": self._init_candidate("cloud")
        }

        # 1. Cache Check
        found, _, age = self.cache.get(cache_key, req.max_age_seconds)
        if not found:
            candidates["cache"].eligible = False
            candidates["cache"].ineligibility_reason = "Cache miss or failed max_age freshness requirement"
            candidates["cache"].estimated_latency_ms = 1.5
            candidates["cache"].estimated_energy_wh = 0.000001
        else:
            candidates["cache"].eligible = True
            candidates["cache"].estimated_latency_ms = 2.0
            candidates["cache"].estimated_energy_wh = EnergyModel.calculate_energy(
                "cache", 2.0, 1024, config
            )["total_energy_wh"]
        candidates["cache"].estimated_cost_units = 0.05

        # 2. Edge Check
        edge_ok, reason = self.db.is_edge_eligible(req, config.edge_max_age_hours)
        if not edge_ok:
            candidates["edge"].eligible = False
            candidates["edge"].ineligibility_reason = reason
            candidates["edge"].estimated_latency_ms = 999.0
            candidates["edge"].estimated_energy_wh = 999.0
        else:
            candidates["edge"].eligible = True
            cpu_factor = 1.0 + ((config.edge_cpu_utilization_pct / 50.0) ** 1.8)
            est_dur = (config.edge_base_latency_ms + (20.0 if req.query_category == "edge_aggregation" else 8.0)) * cpu_factor
            candidates["edge"].estimated_latency_ms = round(est_dur, 1)
            candidates["edge"].estimated_energy_wh = EnergyModel.calculate_energy(
                "edge", est_dur, 2048, config
            )["total_energy_wh"]
        candidates["edge"].estimated_cost_units = 0.20

        # 3. Cloud Check
        cloud_payload = 40960 if req.query_category == "cloud_analytics" else 4096
        cloud_lat = config.cloud_network_rtt_ms + (45.0 if req.query_category == "cloud_analytics" else 15.0)
        candidates["cloud"].eligible = True
        candidates["cloud"].estimated_latency_ms = round(cloud_lat, 1)
        candidates["cloud"].estimated_energy_wh = EnergyModel.calculate_energy(
            "cloud", cloud_lat, cloud_payload, config
        )["total_energy_wh"]
        candidates["cloud"].estimated_cost_units = 1.00

        # 4. Deadline Constraints
        if req.deadline_ms is not None:
            for p in ["cache", "edge", "cloud"]:
                if candidates[p].eligible and candidates[p].estimated_latency_ms > req.deadline_ms:
                    candidates[p].eligible = False
                    candidates[p].ineligibility_reason = f"Violates deadline {req.deadline_ms}ms"

        # 5. Objective Scoring J(route)
        eligible = [p for p in ["cache", "edge", "cloud"] if candidates[p].eligible]
        if not eligible:
            candidates["cloud"].eligible = True
            eligible = ["cloud"]

        max_lat = max([candidates[p].estimated_latency_ms for p in eligible] + [10.0])
        min_lat = min([candidates[p].estimated_latency_ms for p in eligible] + [0.0])
        max_eng = max([candidates[p].estimated_energy_wh for p in eligible] + [0.0001])
        min_eng = min([candidates[p].estimated_energy_wh for p in eligible] + [0.0])

        for p in eligible:
            c = candidates[p]
            n_lat = (c.estimated_latency_ms - min_lat) / (max_lat - min_lat if max_lat != min_lat else 1.0)
            n_eng = (c.estimated_energy_wh - min_eng) / (max_eng - min_eng if max_eng != min_eng else 1.0)
            n_cost = (c.estimated_cost_units - 0.05) / 0.95

            c.components = {
                "normalized_latency": round(n_lat, 3),
                "normalized_energy": round(n_eng, 3),
                "normalized_cost": round(n_cost, 3)
            }
            c.objective_score = round(
                config.alpha_latency * n_lat +
                config.beta_energy * n_eng +
                config.gamma_cost * n_cost,
                3
            )

        # 6. Policy Decision
        selected_path: ExecutionPath = "cloud"
        decision_reason = ""

        if policy == "cloud_only":
            selected_path = "cloud"
            decision_reason = "Policy [cloud_only]: Forced routing to authoritative Cloud database."
        elif policy == "cache_first":
            if candidates["cache"].eligible:
                selected_path = "cache"
                decision_reason = "Policy [cache_first]: Valid cache hit satisfied freshness SLA."
            elif candidates["edge"].eligible:
                selected_path = "edge"
                decision_reason = f"Policy [cache_first]: Cache missed; routed to Edge fallback."
            else:
                selected_path = "cloud"
                decision_reason = "Policy [cache_first]: Cache missed and Edge ineligible; routed to Cloud."
        elif policy == "fixed_rule":
            if req.query_category == "latest_status" and candidates["edge"].eligible:
                selected_path = "edge"
                decision_reason = "Policy [fixed_rule]: Device status directed to Edge via category heuristic."
            else:
                selected_path = "cloud"
                decision_reason = "Policy [fixed_rule]: Complex or historical query directed to Cloud."
        else: # adaptive
            best_p = eligible[0]
            best_score = candidates[best_p].objective_score
            for p in eligible:
                if candidates[p].objective_score < best_score:
                    best_score = candidates[p].objective_score
                    best_p = p
            selected_path = best_p
            decision_reason = f"Policy [adaptive]: Selected {selected_path.upper()} with lowest objective score J={candidates[selected_path].objective_score}."

        return RoutingDecision(
            request_id=f"req-{uuid.uuid4().hex[:8]}",
            selected_path=selected_path,
            policy_used=policy,
            reason=decision_reason,
            candidates=candidates,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def _init_candidate(self, path: ExecutionPath) -> CandidateEvaluation:
        return CandidateEvaluation(
            path=path,
            eligible=False,
            estimated_latency_ms=0.0,
            estimated_energy_wh=0.0,
            estimated_cost_units=0.0,
            objective_score=1.0,
            components={"normalized_latency": 1.0, "normalized_energy": 1.0, "normalized_cost": 1.0}
        )
