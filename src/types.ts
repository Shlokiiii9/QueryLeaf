export type RoutingPolicy = 'adaptive' | 'cache_first' | 'cloud_only' | 'fixed_rule';
export type ExecutionPath = 'cache' | 'edge' | 'cloud';

export type QueryCategory = 
  | 'latest_status'
  | 'recent_history'
  | 'deep_history'
  | 'edge_aggregation'
  | 'cloud_analytics';

export interface DeviceInfo {
  device_id: string;
  factory_id: string;
  sensor_type: string;
  model: string;
  location: string;
  edge_hosted: boolean;
  last_seen: string;
  sampling_rate_hz: number;
  total_records?: number;
  status?: 'active' | 'warning' | 'idle' | 'offline';
}

export interface DatasetBatch {
  id: string;
  name: string;
  description: string;
  device_id: string;
  factory_id: string;
  sensor_type: string;
  record_count: number;
  time_range: {
    start: string;
    end: string;
  };
  storage_tier: 'edge' | 'cloud' | 'both';
  created_at: string;
}

export interface CandidateEvaluation {
  path: ExecutionPath;
  eligible: boolean;
  ineligibility_reason?: string;
  estimated_latency_ms: number;
  estimated_energy_wh: number;
  estimated_cost_units: number;
  objective_score: number;
  components: {
    normalized_latency: number;
    normalized_energy: number;
    normalized_cost: number;
  };
}

export interface GatewayExecutionResponse {
  request_id: string;
  execution_path: ExecutionPath;
  policy_applied: RoutingPolicy;
  latency_ms: number;
  energy_wh: number;
  carbon_g: number;
  cache_hit: boolean;
  cache_age_seconds?: number;
  routing_explanation: string;
  candidate_evaluations: Record<ExecutionPath, CandidateEvaluation>;
  result_count: number;
  data: any;
}

export interface OverviewMetrics {
  total_requests: number;
  successful_requests: number;
  error_rate_pct: number;
  route_breakdown: {
    cache: number;
    edge: number;
    cloud: number;
    cache_hit_rate_pct: number;
  };
  latency: {
    median_ms: number;
    p95_ms: number;
  };
  energy: {
    total_wh: number;
    total_carbon_g: number;
    energy_per_successful_req_wh: number;
    baseline_cloud_energy_wh: number;
    energy_saved_pct: number;
  };
  cache_stats: {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    hit_rate_pct: number;
  };
}

export interface RouteMetricItem {
  path: ExecutionPath;
  name: string;
  count: number;
  avg_latency_ms: number;
  total_energy_wh: number;
}

export interface RouteMetricsResponse {
  distribution: RouteMetricItem[];
  recent_decisions: Array<{
    request_id: string;
    timestamp: string;
    query_category: QueryCategory;
    execution_path: ExecutionPath;
    duration_ms: number;
    reason: string;
  }>;
}

export interface EnergyMetricsResponse {
  by_category: Record<string, { count: number; total_energy_wh: number; avg_energy_wh: number }>;
  carbon_intensity_factor_g_kwh: number;
  assumptions: {
    edge_power_watts: number;
    cloud_power_watts: number;
    cache_power_watts: number;
    network_energy_per_mb_wh: number;
    formula: string;
  };
}

export interface TelemetryItem {
  request_id: string;
  timestamp: string;
  query_category: QueryCategory;
  execution_path: ExecutionPath;
  duration_ms: number;
  result_count: number;
  payload_bytes: number;
  cache_hit: boolean;
  cache_age_seconds?: number;
  estimated_energy_wh: number;
  estimated_carbon_g: number;
  decision_reason: string;
  policy: RoutingPolicy;
  success: boolean;
  error?: string;
}

export interface Recommendation {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimated_benefit: string;
  risk: string;
}

export interface SimulationConfig {
  alpha_latency: number;
  beta_energy: number;
  gamma_cost: number;
  active_policy: RoutingPolicy;
  edge_cpu_utilization_pct: number;
  edge_base_latency_ms: number;
  edge_power_watts: number;
  edge_max_age_hours: number;
  cloud_network_rtt_ms: number;
  cloud_packet_loss_pct: number;
  cloud_power_watts: number;
  network_energy_per_mb_wh: number;
  cache_ttl_seconds: number;
  cache_power_watts: number;
  carbon_intensity_g_per_kwh: number;
}

export interface PolicyBenchmarkResult {
  policy: RoutingPolicy;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  cache_hits: number;
  edge_executions: number;
  cloud_executions: number;
  cache_hit_rate_pct: number;
  total_duration_ms: number;
  throughput_rps: number;
  median_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_energy_wh: number;
  energy_per_successful_req_mwh: number;
  total_carbon_g: number;
  total_network_bytes: number;
  cloud_workload_reduction_pct: number;
  energy_reduction_pct: number;
}

export interface BenchmarkRun {
  run_id: string;
  created_at: string;
  config: {
    workload_size: number;
    concurrency: number;
    policies: RoutingPolicy[];
    query_distribution: any;
  };
  results: Record<RoutingPolicy, PolicyBenchmarkResult>;
  analysis: string[];
}
