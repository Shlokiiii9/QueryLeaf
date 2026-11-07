/**
 * Data models and type definitions for QueryLeaf Gateway
 */

export type RoutingPolicy = 'adaptive' | 'cache_first' | 'cloud_only' | 'fixed_rule';

export type ExecutionPath = 'cache' | 'edge' | 'cloud';

export type QueryCategory = 
  | 'latest_status'
  | 'recent_history'
  | 'deep_history'
  | 'edge_aggregation'
  | 'cloud_analytics';

export type MachineStatus = 'nominal' | 'warning' | 'critical' | 'idle';

export interface SensorRecord {
  id: string;
  device_id: string;
  factory_id: string;
  sensor_type: 'environmental' | 'vibration' | 'thermal' | 'hydraulic';
  timestamp: string; // ISO 8601
  temperature: number; // Celsius
  humidity: number; // %
  vibration: number; // mm/s RMS
  pressure: number; // bar
  machine_status: MachineStatus;
  location: string;
}

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

export interface RoutingDecision {
  request_id: string;
  selected_path: ExecutionPath;
  policy_used: RoutingPolicy;
  reason: string;
  candidates: Record<ExecutionPath, CandidateEvaluation>;
  timestamp: string;
}

export interface GatewayRequest {
  query_category: QueryCategory;
  device_id?: string;
  factory_id?: string;
  start_time?: string;
  end_time?: string;
  max_age_seconds?: number; // Freshness requirement
  deadline_ms?: number; // SLA requirement
  force_policy?: RoutingPolicy;
  aggregation_type?: 'avg' | 'max' | 'min' | 'count';
  metric?: 'temperature' | 'vibration' | 'pressure' | 'humidity';
}

export interface GatewayTelemetry {
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

export interface SimulationConfig {
  // Routing Objective Weights (sum = 1.0)
  alpha_latency: number;
  beta_energy: number;
  gamma_cost: number;
  
  // Active Policy
  active_policy: RoutingPolicy;

  // Edge Simulation Parameters
  edge_cpu_utilization_pct: number; // 0 - 100%
  edge_base_latency_ms: number;
  edge_power_watts: number; // base edge device power
  edge_max_age_hours: number; // Edge retention limit (e.g. 24h)
  
  // Cloud Simulation Parameters
  cloud_network_rtt_ms: number; // Simulated WAN RTT
  cloud_packet_loss_pct: number;
  cloud_power_watts: number; // Server-side query power
  network_energy_per_mb_wh: number; // Energy consumed per MB across WAN

  // Cache Parameters
  cache_ttl_seconds: number;
  cache_power_watts: number;

  // Sustainability
  carbon_intensity_g_per_kwh: number; // Grid carbon factor
}

export interface BenchmarkConfig {
  workload_size: number; // e.g. 100 requests
  concurrency: number;
  policies: RoutingPolicy[];
  query_distribution: {
    latest_status_pct: number;
    recent_history_pct: number;
    deep_history_pct: number;
    edge_aggregation_pct: number;
    cloud_analytics_pct: number;
  };
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
  cloud_workload_reduction_pct: number; // vs Cloud-Only baseline
  energy_reduction_pct: number; // vs Cloud-Only baseline
}

export interface BenchmarkRun {
  run_id: string;
  created_at: string;
  config: BenchmarkConfig;
  results: Record<RoutingPolicy, PolicyBenchmarkResult>;
  analysis: string[];
}
