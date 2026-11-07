/**
 * Storage engines for QueryLeaf Gateway:
 * 1. Redis Cache simulator with deterministic keys, TTL, and invalidation
 * 2. Edge MongoDB simulator (retains recent sensor readings <= 24 hours, local devices)
 * 3. Cloud MongoDB simulator (authoritative full 30-day historical warehouse)
 */

import { SensorRecord, DeviceInfo, GatewayRequest, DatasetBatch } from './models.js';

interface CacheEntry {
  key: string;
  data: any;
  created_at_ms: number;
  expires_at_ms: number;
  payload_bytes: number;
  access_count: number;
}

export class GatewayCacheEngine {
  private cache = new Map<string, CacheEntry>();
  public hits = 0;
  public misses = 0;
  public evictions = 0;

  public buildKey(req: GatewayRequest): string {
    const parts = [
      req.query_category,
      req.device_id || 'all',
      req.factory_id || 'all',
      req.start_time || 'none',
      req.end_time || 'none',
      req.aggregation_type || 'none',
      req.metric || 'none'
    ];
    return `gw:query:${parts.join(':')}`;
  }

  public get(key: string, maxAgeSeconds?: number): { found: boolean; data?: any; age_seconds?: number; expired?: boolean } {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return { found: false };
    }

    const now = Date.now();
    const ageSeconds = (now - entry.created_at_ms) / 1000;

    // Check absolute TTL
    if (now > entry.expires_at_ms) {
      this.cache.delete(key);
      this.evictions++;
      this.misses++;
      return { found: false, expired: true };
    }

    // Check request-level freshness constraint (e.g. client requires data no older than 10s)
    if (maxAgeSeconds !== undefined && ageSeconds > maxAgeSeconds) {
      return { found: false, data: entry.data, age_seconds: ageSeconds, expired: true };
    }

    entry.access_count++;
    this.hits++;
    return { found: true, data: entry.data, age_seconds: ageSeconds };
  }

  public set(key: string, data: any, ttlSeconds: number): void {
    const now = Date.now();
    const payloadStr = JSON.stringify(data);
    this.cache.set(key, {
      key,
      data,
      created_at_ms: now,
      expires_at_ms: now + ttlSeconds * 1000,
      payload_bytes: Buffer.byteLength(payloadStr, 'utf8'),
      access_count: 0
    });
  }

  public invalidate(prefix?: string): number {
    if (!prefix) {
      const count = this.cache.size;
      this.cache.clear();
      return count;
    }
    let removed = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  public getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hit_rate_pct: (this.hits + this.misses) > 0 ? (this.hits / (this.hits + this.misses)) * 100 : 0
    };
  }
}

export class GatewayDatabaseStore {
  public devices: Map<string, DeviceInfo> = new Map();
  public datasets: Map<string, DatasetBatch> = new Map();
  public edgeRecords: SensorRecord[] = [];
  public cloudRecords: SensorRecord[] = [];
  public cacheEngine = new GatewayCacheEngine();

  constructor() {
    this.seedDevicesAndData();
  }

  private seedDevicesAndData() {
    // 10 Industrial Devices across 3 Factory Zones
    const seedDevices: DeviceInfo[] = [
      { device_id: 'DEV-CNC-001', factory_id: 'FAC-01', sensor_type: 'vibration', model: 'Siemens Sinumerik Pro', location: 'Hall A - Milling Cell', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 50 },
      { device_id: 'DEV-CNC-002', factory_id: 'FAC-01', sensor_type: 'vibration', model: 'Mazak Multi-Axis', location: 'Hall A - Finishing Cell', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 50 },
      { device_id: 'DEV-ROBOT-001', factory_id: 'FAC-01', sensor_type: 'thermal', model: 'KUKA KR Quantec', location: 'Hall B - Weld Line', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 20 },
      { device_id: 'DEV-ROBOT-002', factory_id: 'FAC-01', sensor_type: 'thermal', model: 'ABB IRB 6700', location: 'Hall B - Paint Cell', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 20 },
      { device_id: 'DEV-FURNACE-001', factory_id: 'FAC-02', sensor_type: 'thermal', model: 'Ipsen Vacuum Kiln', location: 'Plant 2 - Heat Treatment', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 5 },
      { device_id: 'DEV-PRESS-001', factory_id: 'FAC-02', sensor_type: 'hydraulic', model: 'Schuler 2000T Stamping', location: 'Plant 2 - Press Line A', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 100 },
      { device_id: 'DEV-PRESS-002', factory_id: 'FAC-02', sensor_type: 'hydraulic', model: 'Komatsu Heavy Hydraulic', location: 'Plant 2 - Press Line B', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 100 },
      { device_id: 'DEV-PACK-001', factory_id: 'FAC-03', sensor_type: 'environmental', model: 'Tetra Pak High-Speed Case', location: 'Facility 3 - Packaging Line 1', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 10 },
      { device_id: 'DEV-CONV-001', factory_id: 'FAC-03', sensor_type: 'vibration', model: 'Interroll Roller Sorter', location: 'Facility 3 - Sorting Hub', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 25 },
      { device_id: 'DEV-PUMP-001', factory_id: 'FAC-03', sensor_type: 'hydraulic', model: 'Grundfos Cryogenic Feed', location: 'Facility 3 - Cooling Station', edge_hosted: true, last_seen: new Date().toISOString(), sampling_rate_hz: 10 }
    ];

    for (const dev of seedDevices) {
      this.devices.set(dev.device_id, dev);
    }

    const now = Date.now();
    const oneHourMs = 3600 * 1000;
    const oneDayMs = 24 * oneHourMs;
    const edgeCutoff = now - (24 * oneHourMs); // Edge only retains last 24h

    // Generate historical readings across 30 days
    // Cloud contains all 30 days (~2000 sample records)
    // Edge contains only records where timestamp >= edgeCutoff (~400 records)
    const points = 300;
    const statuses: Array<'nominal' | 'warning' | 'critical' | 'idle'> = ['nominal', 'nominal', 'nominal', 'nominal', 'warning', 'idle'];

    for (const dev of seedDevices) {
      for (let i = 0; i < points; i++) {
        // Distribute timestamps back up to 30 days
        const tDiff = (i / points) * (30 * oneDayMs);
        const recordTime = new Date(now - tDiff).toISOString();
        const recordTimeMs = now - tDiff;

        // Base realistic physical dynamics
        const tempBase = dev.sensor_type === 'thermal' ? 75 : 32;
        const tempNoise = Math.sin(i / 8) * 8 + (Math.random() * 4 - 2);
        const vibBase = dev.sensor_type === 'vibration' ? 2.8 : 0.8;
        const vibNoise = Math.cos(i / 5) * 1.2 + (Math.random() * 0.5);
        const pressBase = dev.sensor_type === 'hydraulic' ? 140 : 1.01;
        const pressNoise = (Math.random() * 10 - 5);

        const record: SensorRecord = {
          id: `rec-${dev.device_id}-${i}`,
          device_id: dev.device_id,
          factory_id: dev.factory_id,
          sensor_type: dev.sensor_type as any,
          timestamp: recordTime,
          temperature: Math.round((tempBase + tempNoise) * 10) / 10,
          humidity: Math.round((45 + Math.sin(i / 10) * 15 + Math.random() * 4) * 10) / 10,
          vibration: Math.max(0.1, Math.round((vibBase + vibNoise) * 100) / 100),
          pressure: Math.max(0.5, Math.round((pressBase + pressNoise) * 10) / 10),
          machine_status: statuses[Math.floor(Math.random() * statuses.length)],
          location: dev.location
        };

        // All records exist in cloud
        this.cloudRecords.push(record);

        // Only records within the last 24h exist on edge
        if (recordTimeMs >= edgeCutoff) {
          this.edgeRecords.push(record);
        }
      }
    }

    // Sort records descending by timestamp
    this.cloudRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.edgeRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Seed Initial Datasets Registry
    this.datasets.set('DATASET-VIB-01', {
      id: 'DATASET-VIB-01',
      name: 'High-Precision CNC Milling Spindle Dynamics',
      description: 'Continuous 50Hz tri-axial accelerometer series capturing spindle chatter and bearing harmonics.',
      device_id: 'DEV-CNC-001',
      factory_id: 'FAC-01',
      sensor_type: 'vibration',
      record_count: 300,
      time_range: {
        start: new Date(now - 30 * oneDayMs).toISOString(),
        end: new Date(now).toISOString()
      },
      storage_tier: 'both',
      created_at: new Date(now - 3600000).toISOString()
    });

    this.datasets.set('DATASET-THERM-01', {
      id: 'DATASET-THERM-01',
      name: 'Robotic Weld Line Thermal Excursion',
      description: 'High-temperature thermocouple measurements across heavy duty weld joints with thermal spikes.',
      device_id: 'DEV-ROBOT-001',
      factory_id: 'FAC-01',
      sensor_type: 'thermal',
      record_count: 300,
      time_range: {
        start: new Date(now - 30 * oneDayMs).toISOString(),
        end: new Date(now).toISOString()
      },
      storage_tier: 'both',
      created_at: new Date(now - 7200000).toISOString()
    });

    this.datasets.set('DATASET-HYD-01', {
      id: 'DATASET-HYD-01',
      name: 'Heavy 2000T Stamping Pressure Cycles',
      description: 'Hydraulic manifold pressure spikes during metal stamping punch strokes with valve relief telemetry.',
      device_id: 'DEV-PRESS-001',
      factory_id: 'FAC-02',
      sensor_type: 'hydraulic',
      record_count: 300,
      time_range: {
        start: new Date(now - 30 * oneDayMs).toISOString(),
        end: new Date(now).toISOString()
      },
      storage_tier: 'both',
      created_at: new Date(now - 14400000).toISOString()
    });

    this.datasets.set('DATASET-ENV-01', {
      id: 'DATASET-ENV-01',
      name: 'Packaging Facility Cleanroom Ambient Monitoring',
      description: 'Ambient temperature, humidity, and barometric pressure curves across high-speed packaging lines.',
      device_id: 'DEV-PACK-001',
      factory_id: 'FAC-03',
      sensor_type: 'environmental',
      record_count: 300,
      time_range: {
        start: new Date(now - 30 * oneDayMs).toISOString(),
        end: new Date(now).toISOString()
      },
      storage_tier: 'both',
      created_at: new Date(now - 28800000).toISOString()
    });
  }

  // --- Edge MongoDB Query Simulator ---
  public queryEdge(req: GatewayRequest): { data: any; execution_time_ms: number; record_count: number; payload_bytes: number } {
    const startTime = performance.now();
    let filtered = this.edgeRecords;

    if (req.device_id) {
      filtered = filtered.filter(r => r.device_id === req.device_id);
    }
    if (req.factory_id) {
      filtered = filtered.filter(r => r.factory_id === req.factory_id);
    }
    if (req.start_time) {
      const st = new Date(req.start_time).getTime();
      filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= st);
    }
    if (req.end_time) {
      const et = new Date(req.end_time).getTime();
      filtered = filtered.filter(r => new Date(r.timestamp).getTime() <= et);
    }

    let resultData: any;
    if (req.query_category === 'latest_status') {
      resultData = filtered[0] || null;
    } else if (req.query_category === 'edge_aggregation' || req.aggregation_type) {
      const metric = req.metric || 'temperature';
      const vals = filtered.map(r => (r as any)[metric] as number).filter(v => typeof v === 'number');
      const count = vals.length;
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      const max = count > 0 ? Math.max(...vals) : 0;
      const min = count > 0 ? Math.min(...vals) : 0;
      resultData = { metric, count, avg, max, min, aggregation: req.aggregation_type || 'avg' };
    } else {
      resultData = filtered.slice(0, 50); // limit to reasonable batch
    }

    const duration = performance.now() - startTime;
    const payloadStr = JSON.stringify(resultData);
    const payloadBytes = Buffer.byteLength(payloadStr, 'utf8');

    return {
      data: resultData,
      execution_time_ms: Math.max(1.2, duration),
      record_count: Array.isArray(resultData) ? resultData.length : (resultData ? 1 : 0),
      payload_bytes: payloadBytes
    };
  }

  // --- Cloud MongoDB Query Simulator ---
  public queryCloud(req: GatewayRequest): { data: any; execution_time_ms: number; record_count: number; payload_bytes: number } {
    const startTime = performance.now();
    let filtered = this.cloudRecords;

    if (req.device_id) {
      filtered = filtered.filter(r => r.device_id === req.device_id);
    }
    if (req.factory_id) {
      filtered = filtered.filter(r => r.factory_id === req.factory_id);
    }
    if (req.start_time) {
      const st = new Date(req.start_time).getTime();
      filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= st);
    }
    if (req.end_time) {
      const et = new Date(req.end_time).getTime();
      filtered = filtered.filter(r => new Date(r.timestamp).getTime() <= et);
    }

    let resultData: any;
    if (req.query_category === 'latest_status') {
      resultData = filtered[0] || null;
    } else if (req.query_category === 'cloud_analytics' || req.query_category === 'edge_aggregation' || req.aggregation_type) {
      const metric = req.metric || 'temperature';
      const vals = filtered.map(r => (r as any)[metric] as number).filter(v => typeof v === 'number');
      const count = vals.length;
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      const max = count > 0 ? Math.max(...vals) : 0;
      const min = count > 0 ? Math.min(...vals) : 0;
      resultData = {
        dataset: 'cloud_historical_full',
        metric,
        total_records_analyzed: count,
        avg,
        max,
        min,
        std_dev: Math.round(Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (count || 1)) * 100) / 100
      };
    } else {
      resultData = filtered.slice(0, 100);
    }

    const duration = performance.now() - startTime;
    const payloadStr = JSON.stringify(resultData);
    const payloadBytes = Buffer.byteLength(payloadStr, 'utf8');

    return {
      data: resultData,
      execution_time_ms: Math.max(3.5, duration),
      record_count: Array.isArray(resultData) ? resultData.length : (resultData ? 1 : 0),
      payload_bytes: payloadBytes
    };
  }

  // Check if data required by request exists in edge database
  public isEdgeEligible(req: GatewayRequest, edgeMaxAgeHours: number): { eligible: boolean; reason?: string } {
    if (req.query_category === 'deep_history' || req.query_category === 'cloud_analytics') {
      return { eligible: false, reason: 'Historical queries across >24h are stored exclusively in cloud warehouse' };
    }

    if (req.start_time) {
      const reqStartMs = new Date(req.start_time).getTime();
      const cutoffMs = Date.now() - (edgeMaxAgeHours * 3600 * 1000);
      if (reqStartMs < cutoffMs) {
        return { eligible: false, reason: `Requested start time (${req.start_time}) precedes edge retention window of ${edgeMaxAgeHours}h` };
      }
    }

    if (req.device_id && !this.devices.has(req.device_id)) {
      return { eligible: false, reason: `Device ${req.device_id} not registered on this edge node` };
    }

    return { eligible: true };
  }

  // Ingest new sensor reading (Edge + Cloud + Invalidate Cache)
  public ingestReading(record: Omit<SensorRecord, 'id' | 'timestamp'> & { timestamp?: string }): { record: SensorRecord; invalidated_cache_entries: number } {
    const fullRecord: SensorRecord = {
      ...record,
      id: `rec-${record.device_id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: record.timestamp || new Date().toISOString()
    };

    // Update memory
    this.edgeRecords.unshift(fullRecord);
    this.cloudRecords.unshift(fullRecord);

    // Update device last_seen
    const dev = this.devices.get(record.device_id);
    if (dev) {
      dev.last_seen = fullRecord.timestamp;
    }

    // Invalidate affected cache entries
    const invalidated = this.cacheEngine.invalidate(record.device_id);

    return { record: fullRecord, invalidated_cache_entries: invalidated };
  }

  // --- Provisioning & Device Management ---
  public getDevicesWithStats(): DeviceInfo[] {
    const countsByDevice = new Map<string, number>();
    for (const r of this.cloudRecords) {
      countsByDevice.set(r.device_id, (countsByDevice.get(r.device_id) || 0) + 1);
    }

    const now = Date.now();
    return Array.from(this.devices.values()).map(dev => {
      const lastSeenMs = new Date(dev.last_seen).getTime();
      const ageHours = (now - lastSeenMs) / (3600 * 1000);
      let status: 'active' | 'warning' | 'idle' | 'offline' = 'active';
      if (ageHours > 48) status = 'offline';
      else if (ageHours > 12) status = 'idle';

      // Check if latest reading has warning
      const latest = this.cloudRecords.find(r => r.device_id === dev.device_id);
      if (latest && (latest.machine_status === 'warning' || latest.machine_status === 'critical')) {
        status = 'warning';
      }

      return {
        ...dev,
        total_records: countsByDevice.get(dev.device_id) || 0,
        status
      };
    });
  }

  public provisionDevice(dev: DeviceInfo): DeviceInfo {
    const existing = this.devices.get(dev.device_id);
    if (existing) {
      const updated = { ...existing, ...dev };
      this.devices.set(dev.device_id, updated);
      return updated;
    }
    const newDev: DeviceInfo = {
      ...dev,
      last_seen: dev.last_seen || new Date().toISOString(),
      status: 'active',
      total_records: 0
    };
    this.devices.set(dev.device_id, newDev);
    return newDev;
  }

  public deprovisionDevice(deviceId: string): boolean {
    const removed = this.devices.delete(deviceId);
    if (removed) {
      this.cacheEngine.invalidate(deviceId);
    }
    return removed;
  }

  // --- Dataset Management ---
  public getDatasets(): DatasetBatch[] {
    return Array.from(this.datasets.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public deleteDataset(datasetId: string): boolean {
    const existed = this.datasets.delete(datasetId);
    if (existed) {
      this.cacheEngine.invalidate();
    }
    return existed;
  }

  public ingestDatasetBatch(batch: {
    name: string;
    description?: string;
    device_id: string;
    factory_id?: string;
    sensor_type?: string;
    storage_tier?: 'edge' | 'cloud' | 'both';
    records: Array<Partial<SensorRecord>>;
  }): { dataset: DatasetBatch; recordsIngested: number; invalidated_cache_entries: number } {
    const tier = batch.storage_tier || 'both';
    const targetDev = this.devices.get(batch.device_id);
    const factoryId = batch.factory_id || targetDev?.factory_id || 'FAC-01';
    const sensorType = batch.sensor_type || targetDev?.sensor_type || 'vibration';
    const location = targetDev?.location || 'Ingestion Bay';

    const now = Date.now();
    const createdDatasetId = `DATASET-${Date.now().toString(36).toUpperCase()}`;
    const timestamps: string[] = [];

    const newSensorRecords: SensorRecord[] = batch.records.map((r, idx) => {
      const recTime = r.timestamp || new Date(now - (batch.records.length - idx) * 2000).toISOString();
      timestamps.push(recTime);
      return {
        id: `rec-${batch.device_id}-${Date.now()}-${idx}`,
        device_id: batch.device_id,
        factory_id: factoryId,
        sensor_type: (sensorType as any) || 'vibration',
        timestamp: recTime,
        temperature: typeof r.temperature === 'number' ? r.temperature : 35.0,
        humidity: typeof r.humidity === 'number' ? r.humidity : 45.0,
        vibration: typeof r.vibration === 'number' ? r.vibration : 1.2,
        pressure: typeof r.pressure === 'number' ? r.pressure : 2.0,
        machine_status: (r.machine_status as any) || 'nominal',
        location: r.location || location
      };
    });

    // Ingest into Edge if 'edge' or 'both'
    if (tier === 'edge' || tier === 'both') {
      this.edgeRecords.unshift(...newSensorRecords);
      this.edgeRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // Ingest into Cloud if 'cloud' or 'both'
    if (tier === 'cloud' || tier === 'both') {
      this.cloudRecords.unshift(...newSensorRecords);
      this.cloudRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // Update target device last_seen
    if (targetDev && newSensorRecords.length > 0) {
      targetDev.last_seen = newSensorRecords[0].timestamp;
    }

    // Register DatasetBatch
    const datasetObj: DatasetBatch = {
      id: createdDatasetId,
      name: batch.name || `Batch Ingest ${batch.device_id}`,
      description: batch.description || `Ingested ${newSensorRecords.length} records into ${tier.toUpperCase()}`,
      device_id: batch.device_id,
      factory_id: factoryId,
      sensor_type: sensorType,
      record_count: newSensorRecords.length,
      time_range: {
        start: timestamps[0] || new Date().toISOString(),
        end: timestamps[timestamps.length - 1] || new Date().toISOString()
      },
      storage_tier: tier,
      created_at: new Date().toISOString()
    };
    this.datasets.set(createdDatasetId, datasetObj);

    // Invalidate Cache for target device
    const invalidated = this.cacheEngine.invalidate(batch.device_id);

    return {
      dataset: datasetObj,
      recordsIngested: newSensorRecords.length,
      invalidated_cache_entries: invalidated
    };
  }

  // Query raw sensor records with filtering
  public getSensorRecords(options: {
    device_id?: string;
    sensor_type?: string;
    tier?: 'edge' | 'cloud';
    limit?: number;
    offset?: number;
  }): { total: number; records: SensorRecord[] } {
    const list = options.tier === 'edge' ? this.edgeRecords : this.cloudRecords;
    let filtered = list;

    if (options.device_id) {
      filtered = filtered.filter(r => r.device_id === options.device_id);
    }
    if (options.sensor_type) {
      filtered = filtered.filter(r => r.sensor_type === options.sensor_type);
    }

    const total = filtered.length;
    const offset = Math.max(0, options.offset || 0);
    const limit = Math.min(Math.max(1, options.limit || 50), 200);
    const paginated = filtered.slice(offset, offset + limit);

    return { total, records: paginated };
  }
}

export const globalStore = new GatewayDatabaseStore();
