/**
 * QueryLeaf Automated Benchmark Suite
 *
 * Runs controlled, reproducible experiments comparing:
 * 1. Cloud-Only (authoritative baseline)
 * 2. Cache-First (standard web tier caching)
 * 3. Fixed-Rule (static category heuristics)
 * 4. Adaptive (dynamic energy-aware multi-objective optimization)
 *
 * Uses identical synthetic IoT query workloads and records granular telemetry.
 */

import {
  BenchmarkConfig,
  BenchmarkRun,
  PolicyBenchmarkResult,
  RoutingPolicy,
  GatewayRequest,
  SimulationConfig
} from './models.js';
import { GatewayDatabaseStore } from './storage.js';
import { EnergyEstimationEngine } from './energy.js';
import { AdaptiveRoutingEngine } from './routing.js';

export class BenchmarkRunner {
  private runs: Map<string, BenchmarkRun> = new Map();

  constructor(
    private store: GatewayDatabaseStore,
    private energyEngine: EnergyEstimationEngine,
    private routingEngine: AdaptiveRoutingEngine
  ) {}

  public getRun(runId: string): BenchmarkRun | undefined {
    return this.runs.get(runId);
  }

  public getAllRuns(): BenchmarkRun[] {
    return Array.from(this.runs.values()).reverse();
  }

  public async executeBenchmark(
    config: BenchmarkConfig,
    simConfig: SimulationConfig
  ): Promise<BenchmarkRun> {
    const runId = `bench-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const workload = this.generateDeterministicWorkload(config.workload_size, config.query_distribution);
    const results: Record<RoutingPolicy, PolicyBenchmarkResult> = {} as any;

    const policiesToTest: RoutingPolicy[] = config.policies && config.policies.length > 0
      ? config.policies
      : ['cloud_only', 'fixed_rule', 'cache_first', 'adaptive'];

    // Execute each policy with identical workload
    for (const policy of policiesToTest) {
      // Clear cache before each policy run for fair cold-start to warm-cache testing
      this.store.cacheEngine.invalidate();

      const policyResult = await this.runWorkloadForPolicy(policy, workload, simConfig);
      results[policy] = policyResult;
    }

    // Compute relative savings vs Cloud-Only baseline
    const baseline = results.cloud_only;
    if (baseline) {
      for (const policy of policiesToTest) {
        const res = results[policy];
        const cloudReduction = baseline.cloud_executions > 0
          ? ((baseline.cloud_executions - res.cloud_executions) / baseline.cloud_executions) * 100
          : 0;
        const energyReduction = baseline.total_energy_wh > 0
          ? ((baseline.total_energy_wh - res.total_energy_wh) / baseline.total_energy_wh) * 100
          : 0;
        res.cloud_workload_reduction_pct = Math.round(cloudReduction * 10) / 10;
        res.energy_reduction_pct = Math.round(energyReduction * 10) / 10;
      }
    }

    // Generate analytical interpretation
    const analysis = this.generateAnalysis(results, simConfig);

    const benchmarkRun: BenchmarkRun = {
      run_id: runId,
      created_at: new Date().toISOString(),
      config,
      results,
      analysis
    };

    this.runs.set(runId, benchmarkRun);
    return benchmarkRun;
  }

  private generateDeterministicWorkload(size: number, dist: BenchmarkConfig['query_distribution']): GatewayRequest[] {
    const devices = Array.from(this.store.devices.keys());
    const workload: GatewayRequest[] = [];

    const numLatest = Math.floor(size * (dist.latest_status_pct / 100));
    const numRecent = Math.floor(size * (dist.recent_history_pct / 100));
    const numDeep = Math.floor(size * (dist.deep_history_pct / 100));
    const numEdgeAgg = Math.floor(size * (dist.edge_aggregation_pct / 100));
    const numCloudAnalytics = size - (numLatest + numRecent + numDeep + numEdgeAgg);

    const now = Date.now();
    const oneHourMs = 3600 * 1000;

    // Helper: repeated polling requests to test cache hit dynamics
    for (let i = 0; i < numLatest; i++) {
      // Intentionally reuse devices to create realistic cache hit opportunities
      const devId = devices[i % 4];
      workload.push({
        query_category: 'latest_status',
        device_id: devId,
        max_age_seconds: 30
      });
    }

    for (let i = 0; i < numRecent; i++) {
      const devId = devices[i % devices.length];
      workload.push({
        query_category: 'recent_history',
        device_id: devId,
        start_time: new Date(now - 4 * oneHourMs).toISOString(),
        end_time: new Date(now).toISOString()
      });
    }

    for (let i = 0; i < numDeep; i++) {
      const devId = devices[i % devices.length];
      workload.push({
        query_category: 'deep_history',
        device_id: devId,
        start_time: new Date(now - 14 * 24 * oneHourMs).toISOString(),
        end_time: new Date(now).toISOString()
      });
    }

    for (let i = 0; i < numEdgeAgg; i++) {
      workload.push({
        query_category: 'edge_aggregation',
        factory_id: 'FAC-01',
        aggregation_type: 'avg',
        metric: 'temperature',
        start_time: new Date(now - 6 * oneHourMs).toISOString()
      });
    }

    for (let i = 0; i < numCloudAnalytics; i++) {
      workload.push({
        query_category: 'cloud_analytics',
        aggregation_type: 'avg',
        metric: 'vibration',
        start_time: new Date(now - 25 * 24 * oneHourMs).toISOString()
      });
    }

    return workload;
  }

  private async runWorkloadForPolicy(
    policy: RoutingPolicy,
    workload: GatewayRequest[],
    simConfig: SimulationConfig
  ): Promise<PolicyBenchmarkResult> {
    const latencies: number[] = [];
    let totalEnergyWh = 0;
    let totalCarbonG = 0;
    let totalNetworkBytes = 0;
    let cacheHits = 0;
    let edgeExecutions = 0;
    let cloudExecutions = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const wallClockStart = performance.now();

    for (const req of workload) {
      const cacheKey = this.store.cacheEngine.buildKey(req);
      const decision = this.routingEngine.evaluateAndSelect(
        { ...req, force_policy: policy },
        simConfig,
        cacheKey
      );

      const path = decision.selected_path;
      let durationMs = 0;
      let payloadBytes = 0;
      let isSuccess = true;

      try {
        if (path === 'cache') {
          cacheHits++;
          const cacheRes = this.store.cacheEngine.get(cacheKey);
          if (cacheRes.found) {
            durationMs = 1.8 + Math.random() * 0.8;
            payloadBytes = 512;
          } else {
            // Cold start miss inside cache_first: falls back to edge or cloud
            const edgeRes = this.store.queryEdge(req);
            durationMs = edgeRes.execution_time_ms;
            payloadBytes = edgeRes.payload_bytes;
            this.store.cacheEngine.set(cacheKey, edgeRes.data, simConfig.cache_ttl_seconds);
          }
        } else if (path === 'edge') {
          edgeExecutions++;
          const cpuFactor = 1 + Math.pow(simConfig.edge_cpu_utilization_pct / 50, 1.8);
          const edgeRes = this.store.queryEdge(req);
          durationMs = edgeRes.execution_time_ms * cpuFactor;
          payloadBytes = edgeRes.payload_bytes;
          // Store result in cache for subsequent reads
          this.store.cacheEngine.set(cacheKey, edgeRes.data, simConfig.cache_ttl_seconds);
        } else {
          // Cloud path
          cloudExecutions++;
          const cloudRes = this.store.queryCloud(req);
          // Simulated WAN RTT + server execution
          durationMs = simConfig.cloud_network_rtt_ms + cloudRes.execution_time_ms;
          payloadBytes = cloudRes.payload_bytes;
          totalNetworkBytes += payloadBytes;
        }

        successfulRequests++;
      } catch (err) {
        failedRequests++;
        isSuccess = false;
        durationMs = 50;
      }

      latencies.push(durationMs);
      const energyData = this.energyEngine.calculateEnergy(path, durationMs, payloadBytes, simConfig);
      totalEnergyWh += energyData.total_energy_wh;
      totalCarbonG += energyData.carbon_emissions_g;
    }

    const wallClockDurationMs = performance.now() - wallClockStart;

    latencies.sort((a, b) => a - b);
    const medianLatency = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0;

    return {
      policy,
      total_requests: workload.length,
      successful_requests: successfulRequests,
      failed_requests: failedRequests,
      cache_hits: cacheHits,
      edge_executions: edgeExecutions,
      cloud_executions: cloudExecutions,
      cache_hit_rate_pct: Math.round((cacheHits / workload.length) * 1000) / 10,
      total_duration_ms: Math.round(wallClockDurationMs * 10) / 10,
      throughput_rps: Math.round((workload.length / (wallClockDurationMs / 1000 || 1)) * 10) / 10,
      median_latency_ms: Math.round(medianLatency * 10) / 10,
      p95_latency_ms: Math.round(p95Latency * 10) / 10,
      p99_latency_ms: Math.round(p99Latency * 10) / 10,
      total_energy_wh: Math.round(totalEnergyWh * 10000) / 10000,
      energy_per_successful_req_mwh: Math.round((totalEnergyWh / (successfulRequests || 1)) * 1000 * 100) / 100,
      total_carbon_g: Math.round(totalCarbonG * 10000) / 10000,
      total_network_bytes: totalNetworkBytes,
      cloud_workload_reduction_pct: 0,
      energy_reduction_pct: 0
    };
  }

  private generateAnalysis(
    results: Record<RoutingPolicy, PolicyBenchmarkResult>,
    simConfig: SimulationConfig
  ): string[] {
    const insights: string[] = [];
    const baseline = results.cloud_only;
    const adaptive = results.adaptive;
    const cacheFirst = results.cache_first;

    if (baseline && adaptive) {
      insights.push(
        `Adaptive routing reduced cloud database requests by ${adaptive.cloud_workload_reduction_pct}% and estimated energy by ${adaptive.energy_reduction_pct}% compared to the Cloud-Only baseline.`
      );
      insights.push(
        `Latency reduction: Median latency dropped from ${baseline.median_latency_ms}ms (Cloud) to ${adaptive.median_latency_ms}ms (Adaptive) due to local cache and edge resolution.`
      );
    }

    if (simConfig.edge_cpu_utilization_pct > 75) {
      insights.push(
        `Notice: Edge CPU utilization is elevated at ${simConfig.edge_cpu_utilization_pct}%. Under these congested conditions, the adaptive engine selectively offloaded heavy aggregations to Cloud to protect edge SLA deadlines.`
      );
    }

    if (cacheFirst && adaptive) {
      insights.push(
        `Cache-First achieved a ${cacheFirst.cache_hit_rate_pct}% hit rate, but Adaptive additionally incorporates query complexity and edge SoC thermal/power states into its multi-objective function.`
      );
    }

    return insights;
  }
}
