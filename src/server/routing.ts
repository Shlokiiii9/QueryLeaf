/**
 * QueryLeaf Adaptive Routing Decision Engine
 *
 * Formulates the multi-objective optimization problem:
 * J(route) = alpha * normalized_latency + beta * normalized_energy + gamma * normalized_cost
 *
 * Pipeline:
 * 1. Hard Constraints Filtering (Freshness SLA, Deadline SLA, Data Availability, Consistency)
 * 2. Multi-Candidate Cost Estimation (Latency ms, Energy Wh, Cost Units)
 * 3. Min-Max Normalization across active candidates
 * 4. Objective Function Evaluation J(route)
 * 5. Route Selection based on Active Policy (adaptive, cache_first, cloud_only, fixed_rule)
 * 6. Audit Trail & Human-Readable Explanation Generation
 */

import {
  GatewayRequest,
  RoutingPolicy,
  ExecutionPath,
  CandidateEvaluation,
  RoutingDecision,
  SimulationConfig
} from './models.js';
import { GatewayDatabaseStore } from './storage.js';
import { EnergyEstimationEngine } from './energy.js';

export class AdaptiveRoutingEngine {
  constructor(
    private store: GatewayDatabaseStore,
    private energyEngine: EnergyEstimationEngine
  ) {}

  public evaluateAndSelect(
    req: GatewayRequest,
    config: SimulationConfig,
    cacheKey: string
  ): RoutingDecision {
    const policy = req.force_policy || config.active_policy;
    const candidates: Record<ExecutionPath, CandidateEvaluation> = {
      cache: this.initCandidate('cache'),
      edge: this.initCandidate('edge'),
      cloud: this.initCandidate('cloud')
    };

    // --- 1. Evaluate Cache Eligibility & Estimates ---
    const cacheResult = this.store.cacheEngine.get(cacheKey, req.max_age_seconds);
    if (!cacheResult.found) {
      candidates.cache.eligible = false;
      candidates.cache.ineligibility_reason = cacheResult.expired
        ? `Cache entry expired or failed max_age requirement (${req.max_age_seconds}s)`
        : 'Cache miss (no previous entry found for this deterministic query key)';
      candidates.cache.estimated_latency_ms = 1.5;
      candidates.cache.estimated_energy_wh = 0.000001;
    } else {
      candidates.cache.eligible = true;
      candidates.cache.estimated_latency_ms = 2.0; // Typical memory cache retrieval
      candidates.cache.estimated_energy_wh = this.energyEngine.predictCandidateEnergy(
        'cache',
        candidates.cache.estimated_latency_ms,
        1024,
        config
      );
    }
    candidates.cache.estimated_cost_units = 0.05; // Negligible RAM infrastructure cost

    // --- 2. Evaluate Edge Eligibility & Estimates ---
    const edgeEligibility = this.store.isEdgeEligible(req, config.edge_max_age_hours);
    if (!edgeEligibility.eligible) {
      candidates.edge.eligible = false;
      candidates.edge.ineligibility_reason = edgeEligibility.reason;
      candidates.edge.estimated_latency_ms = 999;
      candidates.edge.estimated_energy_wh = 999;
    } else {
      candidates.edge.eligible = true;
      // Edge latency scales with Edge CPU utilization
      // High CPU utilization induces queueing delay
      const cpuFactor = 1 + Math.pow(config.edge_cpu_utilization_pct / 50, 1.8);
      const complexityBase = req.query_category === 'edge_aggregation' ? 25 : 8;
      candidates.edge.estimated_latency_ms = Math.round((config.edge_base_latency_ms + complexityBase) * cpuFactor * 10) / 10;
      candidates.edge.estimated_energy_wh = this.energyEngine.predictCandidateEnergy(
        'edge',
        candidates.edge.estimated_latency_ms,
        2048,
        config
      );
    }
    candidates.edge.estimated_cost_units = 0.2; // Edge hardware amortized cost

    // --- 3. Evaluate Cloud Eligibility & Estimates ---
    // Cloud is authoritative; eligible for all valid queries unless hard deadline prevents WAN RTT
    const estimatedCloudPayloadBytes = req.query_category === 'cloud_analytics' ? 40960 : 4096;
    const cloudDbExecutionMs = req.query_category === 'cloud_analytics' ? 45 : 12;
    // Cloud latency = WAN RTT + server DB execution + packet loss retransmit penalty
    const packetLossPenalty = (config.cloud_packet_loss_pct / 100) * 80;
    const totalCloudLatency = config.cloud_network_rtt_ms + cloudDbExecutionMs + packetLossPenalty;

    candidates.cloud.eligible = true;
    candidates.cloud.estimated_latency_ms = Math.round(totalCloudLatency * 10) / 10;
    candidates.cloud.estimated_energy_wh = this.energyEngine.predictCandidateEnergy(
      'cloud',
      candidates.cloud.estimated_latency_ms,
      estimatedCloudPayloadBytes,
      config
    );
    candidates.cloud.estimated_cost_units = 1.0; // Cloud VM + WAN egress bandwidth cost

    // --- 4. Enforce SLA Deadline Constraint ---
    if (req.deadline_ms !== undefined) {
      for (const p of ['cache', 'edge', 'cloud'] as ExecutionPath[]) {
        if (candidates[p].eligible && candidates[p].estimated_latency_ms > req.deadline_ms) {
          candidates[p].eligible = false;
          candidates[p].ineligibility_reason = `Predicted latency (${candidates[p].estimated_latency_ms}ms) violates SLA deadline (${req.deadline_ms}ms)`;
        }
      }
    }

    // --- 5. Normalize and Calculate Scores J(route) ---
    const eligiblePaths = (['cache', 'edge', 'cloud'] as ExecutionPath[]).filter(p => candidates[p].eligible);

    if (eligiblePaths.length === 0) {
      // Fallback: If strict deadline disqualified all, permit cloud or edge with warning
      candidates.cloud.eligible = true;
      candidates.cloud.ineligibility_reason = 'Forced fallback: no route met strict SLA deadline';
      eligiblePaths.push('cloud');
    }

    // Normalization bounds across candidates
    const maxLatency = Math.max(...eligiblePaths.map(p => candidates[p].estimated_latency_ms), 10);
    const minLatency = Math.min(...eligiblePaths.map(p => candidates[p].estimated_latency_ms), 0);
    const maxEnergy = Math.max(...eligiblePaths.map(p => candidates[p].estimated_energy_wh), 0.0001);
    const minEnergy = Math.min(...eligiblePaths.map(p => candidates[p].estimated_energy_wh), 0);
    const maxCost = 1.0;
    const minCost = 0.05;

    for (const p of eligiblePaths) {
      const c = candidates[p];
      const normLat = (c.estimated_latency_ms - minLatency) / (maxLatency - minLatency || 1);
      const normEnergy = (c.estimated_energy_wh - minEnergy) / (maxEnergy - minEnergy || 1);
      const normCost = (c.estimated_cost_units - minCost) / (maxCost - minCost || 1);

      c.components = {
        normalized_latency: Math.round(normLat * 1000) / 1000,
        normalized_energy: Math.round(normEnergy * 1000) / 1000,
        normalized_cost: Math.round(normCost * 1000) / 1000
      };

      // Objective function: J(route) = alpha * normLat + beta * normEnergy + gamma * normCost
      c.objective_score = Math.round(
        (config.alpha_latency * normLat +
         config.beta_energy * normEnergy +
         config.gamma_cost * normCost) * 1000
      ) / 1000;
    }

    // --- 6. Apply Selected Routing Policy ---
    let selectedPath: ExecutionPath = 'cloud';
    let reason = '';

    switch (policy) {
      case 'cloud_only': {
        selectedPath = 'cloud';
        reason = 'Policy [cloud_only]: Route forced to authoritative cloud database for baseline benchmark.';
        break;
      }

      case 'cache_first': {
        if (candidates.cache.eligible) {
          selectedPath = 'cache';
          reason = 'Policy [cache_first]: Valid cache hit satisfied query freshness requirement.';
        } else if (candidates.edge.eligible) {
          selectedPath = 'edge';
          reason = `Policy [cache_first]: Cache missed; routed to edge fallback (${candidates.cache.ineligibility_reason}).`;
        } else {
          selectedPath = 'cloud';
          reason = `Policy [cache_first]: Cache missed & edge ineligible; forwarded to cloud (${candidates.edge.ineligibility_reason}).`;
        }
        break;
      }

      case 'fixed_rule': {
        // Fixed rule: latest_status & edge_agg -> edge; everything else -> cloud (no caching)
        if (req.query_category === 'latest_status' && candidates.edge.eligible) {
          selectedPath = 'edge';
          reason = 'Policy [fixed_rule]: Device status query routed to edge via deterministic category rule.';
        } else if (candidates.cloud.eligible) {
          selectedPath = 'cloud';
          reason = 'Policy [fixed_rule]: Deep query or edge-ineligible request routed to cloud.';
        } else {
          selectedPath = 'edge';
          reason = 'Policy [fixed_rule]: Edge fallback.';
        }
        break;
      }

      case 'adaptive':
      default: {
        // Find eligible path with lowest J(route)
        let bestPath = eligiblePaths[0];
        let lowestScore = candidates[bestPath].objective_score;

        for (const p of eligiblePaths) {
          if (candidates[p].objective_score < lowestScore) {
            lowestScore = candidates[p].objective_score;
            bestPath = p;
          }
        }

        selectedPath = bestPath;
        const best = candidates[selectedPath];
        const reasons: string[] = [];

        if (selectedPath === 'cache') {
          reasons.push(`Selected Cache with minimal objective score J=${best.objective_score} (0ms latency, ~0 Wh).`);
        } else if (selectedPath === 'edge') {
          reasons.push(
            `Selected Edge with J=${best.objective_score} vs Cloud J=${candidates.cloud.objective_score}. Edge CPU load (${config.edge_cpu_utilization_pct}%) maintains low latency (${best.estimated_latency_ms}ms) and avoids WAN transmission energy.`
          );
        } else {
          if (!candidates.edge.eligible) {
            reasons.push(`Selected Cloud (J=${best.objective_score}) because Edge was ineligible: ${candidates.edge.ineligibility_reason}.`);
          } else {
            reasons.push(
              `Selected Cloud (J=${best.objective_score}) due to high Edge CPU load or complex query requiring cloud analytical capacity.`
            );
          }
        }

        reason = `Policy [adaptive]: ${reasons.join(' ')}`;
        break;
      }
    }

    return {
      request_id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      selected_path: selectedPath,
      policy_used: policy,
      reason,
      candidates,
      timestamp: new Date().toISOString()
    };
  }

  private initCandidate(path: ExecutionPath): CandidateEvaluation {
    return {
      path,
      eligible: false,
      estimated_latency_ms: 0,
      estimated_energy_wh: 0,
      estimated_cost_units: 0,
      objective_score: 1.0,
      components: {
        normalized_latency: 1.0,
        normalized_energy: 1.0,
        normalized_cost: 1.0
      }
    };
  }
}
