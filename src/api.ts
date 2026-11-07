import {
  OverviewMetrics,
  RouteMetricsResponse,
  EnergyMetricsResponse,
  TelemetryItem,
  Recommendation,
  SimulationConfig,
  BenchmarkRun,
  DeviceInfo,
  GatewayExecutionResponse,
  DatasetBatch
} from './types';

const BASE_URL = '/api/v1';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
  const res = await fetch(`${BASE_URL}/metrics/overview`);
  if (!res.ok) throw new Error('Failed to fetch overview metrics');
  return res.json();
}

export async function fetchRouteMetrics(): Promise<RouteMetricsResponse> {
  const res = await fetch(`${BASE_URL}/metrics/routes`);
  if (!res.ok) throw new Error('Failed to fetch route metrics');
  return res.json();
}

export async function fetchEnergyMetrics(): Promise<EnergyMetricsResponse> {
  const res = await fetch(`${BASE_URL}/metrics/energy`);
  if (!res.ok) throw new Error('Failed to fetch energy metrics');
  return res.json();
}

export async function fetchTelemetryQueries(limit = 50): Promise<{ total: number; queries: TelemetryItem[] }> {
  const res = await fetch(`${BASE_URL}/metrics/queries?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch telemetry queries');
  return res.json();
}

export async function fetchRecommendations(): Promise<{ recommendations: Recommendation[] }> {
  const res = await fetch(`${BASE_URL}/recommendations`);
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json();
}

export async function fetchSimulationConfig(): Promise<SimulationConfig> {
  const res = await fetch(`${BASE_URL}/simulation/config`);
  if (!res.ok) throw new Error('Failed to fetch simulation config');
  return res.json();
}

export async function updateSimulationConfig(updates: Partial<SimulationConfig>): Promise<{ status: string; config: SimulationConfig }> {
  const res = await fetch(`${BASE_URL}/simulation/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update simulation config');
  return res.json();
}

export async function fetchDevices(): Promise<{ total: number; devices: DeviceInfo[] }> {
  const res = await fetch(`${BASE_URL}/devices`);
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}

export async function executeQuery(body: any): Promise<GatewayExecutionResponse> {
  const res = await fetch(`${BASE_URL}/query/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Query execution failed' }));
    throw new Error(err.details || err.error || 'Execution error');
  }
  return res.json();
}

export async function runBenchmark(config: any): Promise<BenchmarkRun> {
  const res = await fetch(`${BASE_URL}/benchmark/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to run benchmark');
  return res.json();
}

export async function fetchBenchmarkRuns(): Promise<{ runs: BenchmarkRun[] }> {
  const res = await fetch(`${BASE_URL}/benchmark`);
  if (!res.ok) throw new Error('Failed to fetch benchmark runs');
  return res.json();
}

export async function clearCache(): Promise<{ message: string; cleared_entries: number }> {
  const res = await fetch(`${BASE_URL}/cache/clear`, { method: 'POST' });
  return res.json();
}

export async function ingestSensorReading(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/sensors/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function fetchDatasets(): Promise<{ total: number; datasets: DatasetBatch[] }> {
  const res = await fetch(`${BASE_URL}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function ingestDatasetBatch(batchData: {
  name: string;
  description?: string;
  device_id: string;
  factory_id?: string;
  sensor_type?: string;
  storage_tier?: 'edge' | 'cloud' | 'both';
  records?: any[];
  preset_type?: string;
  count?: number;
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Batch ingestion failed' }));
    throw new Error(err.details || err.error || 'Failed to ingest batch');
  }
  return res.json();
}

export async function deleteDataset(datasetId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete dataset');
  return res.json();
}

export async function provisionDevice(deviceData: {
  device_id: string;
  factory_id?: string;
  sensor_type: string;
  model?: string;
  location?: string;
  edge_hosted?: boolean;
  sampling_rate_hz?: number;
}): Promise<{ message: string; device: DeviceInfo }> {
  const res = await fetch(`${BASE_URL}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Provisioning failed' }));
    throw new Error(err.details || err.error || 'Failed to provision device');
  }
  return res.json();
}

export async function deprovisionDevice(deviceId: string): Promise<{ message: string; device_id: string }> {
  const res = await fetch(`${BASE_URL}/devices/${deviceId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to deprovision device');
  return res.json();
}

export async function fetchSensorRecords(params?: {
  device_id?: string;
  sensor_type?: string;
  tier?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; count: number; tier: string; records: any[] }> {
  const q = new URLSearchParams();
  if (params?.device_id) q.append('device_id', params.device_id);
  if (params?.sensor_type) q.append('sensor_type', params.sensor_type);
  if (params?.tier) q.append('tier', params.tier);
  if (params?.limit) q.append('limit', String(params.limit));
  if (params?.offset) q.append('offset', String(params.offset));

  const res = await fetch(`${BASE_URL}/sensors/records?${q.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch sensor records');
  return res.json();
}
