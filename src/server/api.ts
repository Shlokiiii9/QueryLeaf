/**
 * QueryLeaf Gateway REST API Router
 *
 * Implements strict request validation, query execution pipeline,
 * telemetry recording, energy metrics, and simulation controls.
 */

import { Router, Request, Response } from 'express';
import {
  GatewayRequest,
  GatewayTelemetry,
  SimulationConfig,
  BenchmarkConfig,
  QueryCategory
} from './models.js';
import { globalStore } from './storage.js';
import { energyEngine } from './energy.js';
import { AdaptiveRoutingEngine } from './routing.js';
import { BenchmarkRunner } from './benchmark.js';

export const apiRouter = Router();

// Current simulation settings
let currentSimConfig: SimulationConfig = {
  alpha_latency: 0.45,
  beta_energy: 0.40,
  gamma_cost: 0.15,
  active_policy: 'adaptive',
  edge_cpu_utilization_pct: 35,
  edge_base_latency_ms: 12,
  edge_power_watts: 8.5, // e.g. Raspberry Pi 5 / NVIDIA Jetson Nano under load
  edge_max_age_hours: 24,
  cloud_network_rtt_ms: 65, // WAN latency to Cloud Region
  cloud_packet_loss_pct: 1.5,
  cloud_power_watts: 45.0, // Proportion of cloud multi-core server allocation
  network_energy_per_mb_wh: 0.052, // Typical 4G/WAN transfer energy coefficient
  cache_ttl_seconds: 60,
  cache_power_watts: 2.2, // Local DRAM power
  carbon_intensity_g_per_kwh: 385 // e.g. US/Global average electricity grid mix
};

const routingEngine = new AdaptiveRoutingEngine(globalStore, energyEngine);
const benchmarkRunner = new BenchmarkRunner(globalStore, energyEngine, routingEngine);

// In-memory telemetry log buffer
const telemetryHistory: GatewayTelemetry[] = [];
const MAX_TELEMETRY_LOGS = 300;

// Seed initial telemetry so the dashboard has rich historical context on first load
function seedInitialTelemetry() {
  const categories: QueryCategory[] = ['latest_status', 'recent_history', 'edge_aggregation', 'deep_history', 'cloud_analytics'];
  const devices = Array.from(globalStore.devices.keys());

  for (let i = 0; i < 45; i++) {
    const cat = categories[i % categories.length];
    const devId = devices[i % devices.length];
    const dummyReq: GatewayRequest = {
      query_category: cat,
      device_id: devId,
      max_age_seconds: 30
    };
    const key = globalStore.cacheEngine.buildKey(dummyReq);
    const decision = routingEngine.evaluateAndSelect(dummyReq, currentSimConfig, key);
    const path = decision.selected_path;
    const dur = path === 'cache' ? 2.1 : path === 'edge' ? 18.4 : 78.2;
    const bytes = cat === 'cloud_analytics' ? 14200 : 1240;
    const energy = energyEngine.calculateEnergy(path, dur, bytes, currentSimConfig);

    telemetryHistory.unshift({
      request_id: decision.request_id,
      timestamp: new Date(Date.now() - (45 - i) * 60 * 1000).toISOString(),
      query_category: cat,
      execution_path: path,
      duration_ms: dur,
      result_count: cat === 'latest_status' ? 1 : 12,
      payload_bytes: bytes,
      cache_hit: path === 'cache',
      cache_age_seconds: path === 'cache' ? 8.2 : undefined,
      estimated_energy_wh: energy.total_energy_wh,
      estimated_carbon_g: energy.carbon_emissions_g,
      decision_reason: decision.reason,
      policy: currentSimConfig.active_policy,
      success: true
    });
  }
}
seedInitialTelemetry();

// --- 1. Health Endpoint ---
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    gateway: 'QueryLeaf — Smart Energy-Aware API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    components: {
      cache: 'online',
      edge_db: 'online',
      cloud_db: 'online',
      routing_engine: 'active'
    }
  });
});

// --- 2. Devices & Provisioning Endpoints ---
apiRouter.get('/devices', (_req: Request, res: Response) => {
  const deviceList = globalStore.getDevicesWithStats();
  res.json({
    total: deviceList.length,
    devices: deviceList
  });
});

apiRouter.post('/devices', (req: Request, res: Response) => {
  const { device_id, factory_id, sensor_type, model, location, edge_hosted, sampling_rate_hz } = req.body;

  if (!device_id || !sensor_type) {
    res.status(400).json({ error: 'device_id and sensor_type are required' });
    return;
  }

  const device = globalStore.provisionDevice({
    device_id: String(device_id).trim().toUpperCase(),
    factory_id: factory_id || 'FAC-01',
    sensor_type: sensor_type || 'vibration',
    model: model || 'Generic IoT Microcontroller',
    location: location || 'Field Node',
    edge_hosted: edge_hosted !== false,
    last_seen: new Date().toISOString(),
    sampling_rate_hz: Number(sampling_rate_hz) || 20
  });

  res.status(201).json({
    message: `IoT unit ${device.device_id} provisioned successfully`,
    device
  });
});

apiRouter.delete('/devices/:deviceId', (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const deleted = globalStore.deprovisionDevice(deviceId);
  if (!deleted) {
    res.status(404).json({ error: `Device ${deviceId} not found` });
    return;
  }
  res.json({
    message: `IoT unit ${deviceId} deprovisioned`,
    device_id: deviceId
  });
});

apiRouter.get('/devices/:deviceId/latest', (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const dev = globalStore.devices.get(deviceId);
  if (!dev) {
    res.status(404).json({ error: `Device ${deviceId} not found` });
    return;
  }

  // Execute query via gateway pipeline
  const gatewayReq: GatewayRequest = {
    query_category: 'latest_status',
    device_id: deviceId,
    max_age_seconds: 30
  };

  executeGatewayPipeline(gatewayReq, res);
});

// --- 3. Sensor Query Endpoint ---
apiRouter.get('/sensors/query', (req: Request, res: Response) => {
  const {
    device_id,
    factory_id,
    category,
    start_time,
    end_time,
    max_age_seconds,
    deadline_ms,
    policy
  } = req.query;

  const gatewayReq: GatewayRequest = {
    query_category: (category as QueryCategory) || 'recent_history',
    device_id: device_id as string | undefined,
    factory_id: factory_id as string | undefined,
    start_time: start_time as string | undefined,
    end_time: end_time as string | undefined,
    max_age_seconds: max_age_seconds ? Number(max_age_seconds) : undefined,
    deadline_ms: deadline_ms ? Number(deadline_ms) : undefined,
    force_policy: policy as any
  };

  executeGatewayPipeline(gatewayReq, res);
});

// --- 4. Analytics Summary ---
apiRouter.get('/analytics/summary', (req: Request, res: Response) => {
  const { factory_id, metric, aggregation } = req.query;

  const gatewayReq: GatewayRequest = {
    query_category: 'edge_aggregation',
    factory_id: factory_id as string | undefined,
    metric: (metric as any) || 'temperature',
    aggregation_type: (aggregation as any) || 'avg'
  };

  executeGatewayPipeline(gatewayReq, res);
});

// --- 5. Core Query Execution Endpoint ---
apiRouter.post('/query/execute', (req: Request, res: Response) => {
  const gatewayReq: GatewayRequest = req.body;

  if (!gatewayReq.query_category) {
    res.status(400).json({ error: 'Missing required field: query_category' });
    return;
  }

  executeGatewayPipeline(gatewayReq, res);
});

// Central execution pipeline function
function executeGatewayPipeline(req: GatewayRequest, res: Response) {
  const startTime = performance.now();
  const cacheKey = globalStore.cacheEngine.buildKey(req);

  // 1. Evaluate Routing Decision
  const decision = routingEngine.evaluateAndSelect(req, currentSimConfig, cacheKey);
  const path = decision.selected_path;

  let queryResult: any;
  let executionDurationMs = 0;
  let payloadBytes = 0;
  let resultCount = 0;
  let cacheHit = false;
  let cacheAgeSeconds: number | undefined;

  try {
    if (path === 'cache') {
      const cacheLookup = globalStore.cacheEngine.get(cacheKey, req.max_age_seconds);
      if (cacheLookup.found) {
        queryResult = cacheLookup.data;
        cacheHit = true;
        cacheAgeSeconds = Math.round((cacheLookup.age_seconds || 0) * 10) / 10;
        executionDurationMs = performance.now() - startTime;
        payloadBytes = Buffer.byteLength(JSON.stringify(queryResult), 'utf8');
        resultCount = Array.isArray(queryResult) ? queryResult.length : 1;
      } else {
        // Cold miss fallback
        const edgeRes = globalStore.queryEdge(req);
        queryResult = edgeRes.data;
        executionDurationMs = performance.now() - startTime;
        payloadBytes = edgeRes.payload_bytes;
        resultCount = edgeRes.record_count;
        globalStore.cacheEngine.set(cacheKey, queryResult, currentSimConfig.cache_ttl_seconds);
      }
    } else if (path === 'edge') {
      const edgeRes = globalStore.queryEdge(req);
      const cpuFactor = 1 + Math.pow(currentSimConfig.edge_cpu_utilization_pct / 50, 1.8);
      executionDurationMs = Math.max(edgeRes.execution_time_ms * cpuFactor, 4.2);
      queryResult = edgeRes.data;
      payloadBytes = edgeRes.payload_bytes;
      resultCount = edgeRes.record_count;
      // Write into cache for potential subsequent freshness hits
      globalStore.cacheEngine.set(cacheKey, queryResult, currentSimConfig.cache_ttl_seconds);
    } else {
      // Cloud Path
      const cloudRes = globalStore.queryCloud(req);
      executionDurationMs = currentSimConfig.cloud_network_rtt_ms + cloudRes.execution_time_ms;
      queryResult = cloudRes.data;
      payloadBytes = cloudRes.payload_bytes;
      resultCount = cloudRes.record_count;
    }

    // Energy & Carbon Calculation
    const energyData = energyEngine.calculateEnergy(
      path,
      executionDurationMs,
      payloadBytes,
      currentSimConfig
    );

    // Record Telemetry
    const telemetry: GatewayTelemetry = {
      request_id: decision.request_id,
      timestamp: new Date().toISOString(),
      query_category: req.query_category,
      execution_path: path,
      duration_ms: Math.round(executionDurationMs * 10) / 10,
      result_count: resultCount,
      payload_bytes: payloadBytes,
      cache_hit: cacheHit,
      cache_age_seconds: cacheAgeSeconds,
      estimated_energy_wh: energyData.total_energy_wh,
      estimated_carbon_g: energyData.carbon_emissions_g,
      decision_reason: decision.reason,
      policy: decision.policy_used,
      success: true
    };

    telemetryHistory.unshift(telemetry);
    if (telemetryHistory.length > MAX_TELEMETRY_LOGS) {
      telemetryHistory.pop();
    }

    res.json({
      request_id: decision.request_id,
      execution_path: path,
      policy_applied: decision.policy_used,
      latency_ms: telemetry.duration_ms,
      energy_wh: telemetry.estimated_energy_wh,
      carbon_g: telemetry.estimated_carbon_g,
      cache_hit: cacheHit,
      cache_age_seconds: cacheAgeSeconds,
      routing_explanation: decision.reason,
      candidate_evaluations: decision.candidates,
      result_count: resultCount,
      data: queryResult
    });
  } catch (err: any) {
    const errorDuration = performance.now() - startTime;
    telemetryHistory.unshift({
      request_id: decision.request_id,
      timestamp: new Date().toISOString(),
      query_category: req.query_category,
      execution_path: path,
      duration_ms: errorDuration,
      result_count: 0,
      payload_bytes: 0,
      cache_hit: false,
      estimated_energy_wh: 0.0001,
      estimated_carbon_g: 0.00004,
      decision_reason: decision.reason,
      policy: decision.policy_used,
      success: false,
      error: err.message
    });

    res.status(500).json({
      error: 'Query execution failed',
      details: err.message,
      decision
    });
  }
}

// --- 6. Telemetry & Metrics Endpoints ---
apiRouter.get('/metrics/overview', (_req: Request, res: Response) => {
  const total = telemetryHistory.length;
  const successful = telemetryHistory.filter(t => t.success).length;
  const cacheHits = telemetryHistory.filter(t => t.execution_path === 'cache').length;
  const edgeCount = telemetryHistory.filter(t => t.execution_path === 'edge').length;
  const cloudCount = telemetryHistory.filter(t => t.execution_path === 'cloud').length;

  const latencies = telemetryHistory.map(t => t.duration_ms).sort((a, b) => a - b);
  const medianLatency = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95Latency = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

  const totalEnergyWh = telemetryHistory.reduce((sum, t) => sum + t.estimated_energy_wh, 0);
  const totalCarbonG = telemetryHistory.reduce((sum, t) => sum + t.estimated_carbon_g, 0);

  // Calculate estimated baseline energy if ALL queries were routed to Cloud
  const baselineCloudEnergyWh = telemetryHistory.reduce((sum, t) => {
    const cloudEnergy = energyEngine.calculateEnergy('cloud', currentSimConfig.cloud_network_rtt_ms + 18, t.payload_bytes || 2048, currentSimConfig);
    return sum + cloudEnergy.total_energy_wh;
  }, 0);

  const energySavedPct = baselineCloudEnergyWh > 0
    ? Math.max(0, Math.round(((baselineCloudEnergyWh - totalEnergyWh) / baselineCloudEnergyWh) * 1000) / 10)
    : 0;

  res.json({
    total_requests: total,
    successful_requests: successful,
    error_rate_pct: total > 0 ? Math.round(((total - successful) / total) * 1000) / 10 : 0,
    route_breakdown: {
      cache: cacheHits,
      edge: edgeCount,
      cloud: cloudCount,
      cache_hit_rate_pct: total > 0 ? Math.round((cacheHits / total) * 1000) / 10 : 0
    },
    latency: {
      median_ms: Math.round(medianLatency * 10) / 10,
      p95_ms: Math.round(p95Latency * 10) / 10
    },
    energy: {
      total_wh: Math.round(totalEnergyWh * 10000) / 10000,
      total_carbon_g: Math.round(totalCarbonG * 10000) / 10000,
      energy_per_successful_req_wh: successful > 0 ? Math.round((totalEnergyWh / successful) * 100000) / 100000 : 0,
      baseline_cloud_energy_wh: Math.round(baselineCloudEnergyWh * 10000) / 10000,
      energy_saved_pct: energySavedPct
    },
    cache_stats: globalStore.cacheEngine.getStats()
  });
});

apiRouter.get('/metrics/routes', (_req: Request, res: Response) => {
  const routes = {
    cache: { count: 0, total_duration: 0, total_energy: 0 },
    edge: { count: 0, total_duration: 0, total_energy: 0 },
    cloud: { count: 0, total_duration: 0, total_energy: 0 }
  };

  for (const t of telemetryHistory) {
    const r = routes[t.execution_path];
    if (r) {
      r.count++;
      r.total_duration += t.duration_ms;
      r.total_energy += t.estimated_energy_wh;
    }
  }

  res.json({
    distribution: [
      {
        path: 'cache',
        name: 'Local RAM Cache',
        count: routes.cache.count,
        avg_latency_ms: routes.cache.count > 0 ? Math.round((routes.cache.total_duration / routes.cache.count) * 10) / 10 : 0,
        total_energy_wh: Math.round(routes.cache.total_energy * 10000) / 10000
      },
      {
        path: 'edge',
        name: 'Edge MongoDB',
        count: routes.edge.count,
        avg_latency_ms: routes.edge.count > 0 ? Math.round((routes.edge.total_duration / routes.edge.count) * 10) / 10 : 0,
        total_energy_wh: Math.round(routes.edge.total_energy * 10000) / 10000
      },
      {
        path: 'cloud',
        name: 'Cloud Data Warehouse',
        count: routes.cloud.count,
        avg_latency_ms: routes.cloud.count > 0 ? Math.round((routes.cloud.total_duration / routes.cloud.count) * 10) / 10 : 0,
        total_energy_wh: Math.round(routes.cloud.total_energy * 10000) / 10000
      }
    ],
    recent_decisions: telemetryHistory.slice(0, 15).map(t => ({
      request_id: t.request_id,
      timestamp: t.timestamp,
      query_category: t.query_category,
      execution_path: t.execution_path,
      duration_ms: t.duration_ms,
      reason: t.decision_reason
    }))
  });
});

apiRouter.get('/metrics/energy', (_req: Request, res: Response) => {
  // Aggregate by query category
  const byCategory: Record<string, { count: number; total_energy_wh: number; avg_energy_wh: number }> = {};
  for (const t of telemetryHistory) {
    if (!byCategory[t.query_category]) {
      byCategory[t.query_category] = { count: 0, total_energy_wh: 0, avg_energy_wh: 0 };
    }
    byCategory[t.query_category].count++;
    byCategory[t.query_category].total_energy_wh += t.estimated_energy_wh;
  }

  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat];
    c.avg_energy_wh = Math.round((c.total_energy_wh / c.count) * 100000) / 100000;
    c.total_energy_wh = Math.round(c.total_energy_wh * 10000) / 10000;
  }

  res.json({
    by_category: byCategory,
    carbon_intensity_factor_g_kwh: currentSimConfig.carbon_intensity_g_per_kwh,
    assumptions: {
      edge_power_watts: currentSimConfig.edge_power_watts,
      cloud_power_watts: currentSimConfig.cloud_power_watts,
      cache_power_watts: currentSimConfig.cache_power_watts,
      network_energy_per_mb_wh: currentSimConfig.network_energy_per_mb_wh,
      formula: 'Energy (Wh) = Power (W) * Duration (s) / 3600 + WAN Transfer Energy (Wh)'
    }
  });
});

apiRouter.get('/metrics/queries', (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({
    total: telemetryHistory.length,
    queries: telemetryHistory.slice(0, limit)
  });
});

// --- 7. Recommendations Endpoint ---
apiRouter.get('/recommendations', (_req: Request, res: Response) => {
  const recommendations = [];

  // Analyze cache hit rate
  const total = telemetryHistory.length;
  const cacheCount = telemetryHistory.filter(t => t.execution_path === 'cache').length;
  const cacheHitRate = total > 0 ? (cacheCount / total) * 100 : 0;

  if (cacheHitRate < 30) {
    recommendations.push({
      id: 'rec-ttl-optimize',
      category: 'Caching Optimization',
      severity: 'medium',
      title: 'Increase Cache TTL for Periodic Polling',
      description: `Current cache hit rate is ${Math.round(cacheHitRate)}%. Frequent polling requests for device status can benefit from increasing Cache TTL from ${currentSimConfig.cache_ttl_seconds}s to 120s without violating typical 2-minute SLA freshness limits.`,
      estimated_benefit: 'Hypothesized 18-25% reduction in edge database queries and ~0.04 Wh energy savings per 100 requests.',
      risk: 'Devices requiring sub-minute anomaly detection may experience up to 120s reporting latency.'
    });
  }

  if (currentSimConfig.edge_cpu_utilization_pct > 70) {
    recommendations.push({
      id: 'rec-edge-congestion',
      category: 'Edge Resource Relief',
      severity: 'high',
      title: 'Throttle Edge Analytical Aggregations Under High SoC Load',
      description: `Edge node CPU utilization is at ${currentSimConfig.edge_cpu_utilization_pct}%. Dynamic throttling should route non-critical time-range aggregations to Cloud or serve slightly aged cached summaries to prevent edge device thermal throttling.`,
      estimated_benefit: 'Prevents edge node crash or 3x latency spikes on safety-critical sensor reads.',
      risk: 'Slightly higher cloud bandwidth usage for offloaded aggregation queries.'
    });
  }

  recommendations.push({
    id: 'rec-weight-tuning',
    category: 'Routing Objective Tuning',
    severity: 'low',
    title: 'Shift Multi-Objective Weights Toward Carbon Abatement',
    description: `Current routing weights: Latency alpha=${currentSimConfig.alpha_latency}, Energy beta=${currentSimConfig.beta_energy}. Increasing beta to 0.55 during peak grid carbon intensity hours prioritizes local edge retention.`,
    estimated_benefit: 'Estimated 8-12% decrease in WAN carbon footprint without noticeable UI latency degradation.',
    risk: 'Slightly higher edge memory footprint.'
  });

  res.json({ recommendations });
});

// --- 8. Simulation Config Endpoints ---
apiRouter.get('/simulation/config', (_req: Request, res: Response) => {
  res.json(currentSimConfig);
});

apiRouter.post('/simulation/config', (req: Request, res: Response) => {
  const updates = req.body;
  currentSimConfig = {
    ...currentSimConfig,
    ...updates
  };
  res.json({
    status: 'updated',
    config: currentSimConfig
  });
});

// --- 9. Ingest Sensor Reading Endpoint (Write Path & Invalidation) ---
apiRouter.post('/sensors/ingest', (req: Request, res: Response) => {
  const { device_id, factory_id, sensor_type, temperature, humidity, vibration, pressure, machine_status } = req.body;

  if (!device_id) {
    res.status(400).json({ error: 'Missing device_id' });
    return;
  }

  const result = globalStore.ingestReading({
    device_id,
    factory_id: factory_id || 'FAC-01',
    sensor_type: sensor_type || 'environmental',
    temperature: Number(temperature) || 28.5,
    humidity: Number(humidity) || 50.0,
    vibration: Number(vibration) || 1.1,
    pressure: Number(pressure) || 1.0,
    machine_status: machine_status || 'nominal',
    location: 'Production Line'
  });

  res.json({
    message: 'Sensor reading ingested successfully into Edge and Cloud databases',
    record: result.record,
    invalidated_cache_entries: result.invalidated_cache_entries
  });
});

// --- 9b. Datasets Management Endpoints ---
apiRouter.get('/datasets', (_req: Request, res: Response) => {
  const datasets = globalStore.getDatasets();
  res.json({
    total: datasets.length,
    datasets
  });
});

apiRouter.post('/datasets/batch', (req: Request, res: Response) => {
  const { name, description, device_id, factory_id, sensor_type, storage_tier, records, preset_type, count } = req.body;

  if (!device_id) {
    res.status(400).json({ error: 'device_id is required' });
    return;
  }

  let finalRecords: Array<any> = Array.isArray(records) ? records : [];

  // If a preset is requested without manual records, generate synthetic industrial records
  if (finalRecords.length === 0 && preset_type) {
    const num = Math.min(Math.max(Number(count) || 50, 5), 500);
    const now = Date.now();
    const type = sensor_type || 'vibration';

    for (let i = 0; i < num; i++) {
      const offsetMs = (num - i) * 3000;
      const recTime = new Date(now - offsetMs).toISOString();
      let temp = 35;
      let vib = 1.0;
      let press = 2.0;
      let hum = 45;
      let status: 'nominal' | 'warning' | 'critical' = 'nominal';

      if (preset_type === 'milling_spindle' || type === 'vibration') {
        const chatter = i > num * 0.7 ? Math.random() * 4.5 : Math.random() * 0.8;
        vib = Math.round((1.5 + chatter) * 100) / 100;
        temp = Math.round((42 + (vib * 3.5)) * 10) / 10;
        if (vib > 4.0) status = 'critical';
        else if (vib > 2.8) status = 'warning';
      } else if (preset_type === 'cold_chain' || type === 'thermal') {
        const excursion = i > num * 0.5 ? (i - num * 0.5) * 0.8 : 0;
        temp = Math.round((-18 + excursion + Math.random() * 0.5) * 10) / 10;
        if (temp > -10) status = 'critical';
        else if (temp > -15) status = 'warning';
      } else if (preset_type === 'hydraulic_stamping' || type === 'hydraulic') {
        const stroke = (i % 8 === 0) ? 180 + Math.random() * 30 : 25 + Math.random() * 5;
        press = Math.round(stroke * 10) / 10;
        temp = Math.round((48 + Math.random() * 6) * 10) / 10;
        if (press > 195) status = 'warning';
      } else {
        temp = Math.round((22 + Math.sin(i / 10) * 4 + Math.random()) * 10) / 10;
        hum = Math.round((55 + Math.cos(i / 10) * 10 + Math.random() * 2) * 10) / 10;
      }

      finalRecords.push({
        timestamp: recTime,
        temperature: temp,
        humidity: hum,
        vibration: vib,
        pressure: press,
        machine_status: status
      });
    }
  }

  if (finalRecords.length === 0) {
    res.status(400).json({ error: 'No records provided and no valid preset selected' });
    return;
  }

  const result = globalStore.ingestDatasetBatch({
    name: name || `Telemetry Ingestion ${device_id}`,
    description: description || `Ingested ${finalRecords.length} records into ${storage_tier || 'both'}`,
    device_id,
    factory_id,
    sensor_type,
    storage_tier,
    records: finalRecords
  });

  res.status(201).json({
    message: `Batch of ${result.recordsIngested} records successfully ingested into ${storage_tier || 'both'} tier`,
    dataset: result.dataset,
    records_count: result.recordsIngested,
    invalidated_cache_entries: result.invalidated_cache_entries
  });
});

apiRouter.delete('/datasets/:datasetId', (req: Request, res: Response) => {
  const { datasetId } = req.params;
  const deleted = globalStore.deleteDataset(datasetId);
  if (!deleted) {
    res.status(404).json({ error: `Dataset ${datasetId} not found` });
    return;
  }
  res.json({
    message: `Dataset ${datasetId} removed`,
    dataset_id: datasetId
  });
});

// --- 9c. Raw Sensor Records Browser ---
apiRouter.get('/sensors/records', (req: Request, res: Response) => {
  const { device_id, sensor_type, tier, limit, offset } = req.query;
  const result = globalStore.getSensorRecords({
    device_id: device_id as string | undefined,
    sensor_type: sensor_type as string | undefined,
    tier: (tier as any) || 'cloud',
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0
  });

  res.json({
    total: result.total,
    count: result.records.length,
    tier: tier || 'cloud',
    records: result.records
  });
});

// --- 10. Cache Management ---
apiRouter.post('/cache/clear', (_req: Request, res: Response) => {
  const cleared = globalStore.cacheEngine.invalidate();
  res.json({
    message: 'Cache invalidated',
    cleared_entries: cleared
  });
});

// --- 11. Benchmark Endpoints ---
apiRouter.post('/benchmark/run', async (req: Request, res: Response) => {
  const body = req.body || {};
  const config: BenchmarkConfig = {
    workload_size: Math.min(Math.max(Number(body.workload_size) || 100, 20), 500),
    concurrency: Number(body.concurrency) || 1,
    policies: body.policies || ['cloud_only', 'fixed_rule', 'cache_first', 'adaptive'],
    query_distribution: body.query_distribution || {
      latest_status_pct: 40,
      recent_history_pct: 25,
      deep_history_pct: 15,
      edge_aggregation_pct: 10,
      cloud_analytics_pct: 10
    }
  };

  try {
    const run = await benchmarkRunner.executeBenchmark(config, currentSimConfig);
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: 'Benchmark execution failed', details: err.message });
  }
});

apiRouter.get('/benchmark', (_req: Request, res: Response) => {
  res.json({
    runs: benchmarkRunner.getAllRuns()
  });
});

apiRouter.get('/benchmark/:runId', (req: Request, res: Response) => {
  const { runId } = req.params;
  const run = benchmarkRunner.getRun(runId);
  if (!run) {
    res.status(404).json({ error: `Benchmark run ${runId} not found` });
    return;
  }
  res.json(run);
});
