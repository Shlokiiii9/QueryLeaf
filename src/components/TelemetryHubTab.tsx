import React, { useState, useEffect } from 'react';
import {
  Radio,
  Cpu,
  Database,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
  Trash2,
  Upload,
  Sparkles,
  FileSpreadsheet,
  Activity,
  HardDrive,
  Cloud,
  Server,
  Zap,
  Sliders,
  X,
  ChevronRight,
  Filter,
  BarChart2,
  Download,
  FileText
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { DeviceInfo, DatasetBatch } from '../types';
import {
  fetchDatasets,
  ingestDatasetBatch,
  deleteDataset,
  provisionDevice,
  deprovisionDevice,
  fetchSensorRecords
} from '../api';

interface TelemetryHubTabProps {
  devices: DeviceInfo[];
  onRefreshDevices: () => void;
  onNavigateToQuery: (deviceId?: string, category?: string) => void;
}

export const TelemetryHubTab: React.FC<TelemetryHubTabProps> = ({
  devices,
  onRefreshDevices,
  onNavigateToQuery,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'units' | 'datasets' | 'stream'>('units');
  const [datasets, setDatasets] = useState<DatasetBatch[]>([]);
  const [rawRecords, setRawRecords] = useState<any[]>([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters for units
  const [unitSearch, setUnitSearch] = useState('');
  const [unitFactoryFilter, setUnitFactoryFilter] = useState('all');
  const [unitSensorFilter, setUnitSensorFilter] = useState('all');

  // Filters for raw stream
  const [streamDeviceFilter, setStreamDeviceFilter] = useState('all');
  const [streamTierFilter, setStreamTierFilter] = useState<'edge' | 'cloud'>('edge');

  // Modals & Drawers
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [selectedDeviceForIngest, setSelectedDeviceForIngest] = useState<string>('');

  // Provision Form State
  const [provDeviceId, setProvDeviceId] = useState('');
  const [provFactoryId, setProvFactoryId] = useState('FAC-01');
  const [provSensorType, setProvSensorType] = useState('vibration');
  const [provModel, setProvModel] = useState('');
  const [provLocation, setProvLocation] = useState('');
  const [provEdgeHosted, setProvEdgeHosted] = useState(true);
  const [provRateHz, setProvRateHz] = useState(25);

  // Ingest Form State
  const [ingestMode, setIngestMode] = useState<'upload' | 'preset' | 'json'>('upload');
  const [ingestPreset, setIngestPreset] = useState<'milling_spindle' | 'cold_chain' | 'hydraulic_stamping' | 'cleanroom'>('milling_spindle');
  const [ingestName, setIngestName] = useState('');
  const [ingestDesc, setIngestDesc] = useState('');
  const [ingestTargetDevice, setIngestTargetDevice] = useState(devices[0]?.device_id || 'DEV-CNC-001');
  const [ingestStorageTier, setIngestStorageTier] = useState<'edge' | 'cloud' | 'both'>('both');
  const [ingestCount, setIngestCount] = useState(50);
  const [ingestJsonText, setIngestJsonText] = useState('');
  const [ingestSubmitting, setIngestSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; count: number; records: any[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [datasetToDelete, setDatasetToDelete] = useState<DatasetBatch | null>(null);
  const [deletingDatasetId, setDeletingDatasetId] = useState<string | null>(null);
  const [deviceToDeprovision, setDeviceToDeprovision] = useState<DeviceInfo | null>(null);
  const [deprovisioningDeviceId, setDeprovisioningDeviceId] = useState<string | null>(null);

  // Load datasets & stream records
  const loadData = async () => {
    setLoading(true);
    try {
      const [dsRes, streamRes] = await Promise.all([
        fetchDatasets(),
        fetchSensorRecords({
          device_id: streamDeviceFilter !== 'all' ? streamDeviceFilter : undefined,
          tier: streamTierFilter,
          limit: 40
        })
      ]);
      setDatasets(dsRes.datasets);
      setRawRecords(streamRes.records);
      setRawTotal(streamRes.total);
    } catch (err: any) {
      console.error('Failed to load telemetry hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [streamDeviceFilter, streamTierFilter]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Robust CSV parser to sensor records
  const parseCsvToRecords = (csvText: string): any[] => {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        const val = values[idx] || '';
        if (['temperature', 'humidity', 'vibration', 'pressure', 'temp', 'vib', 'press', 'hum'].includes(h)) {
          const key = h === 'temp' ? 'temperature' : h === 'vib' ? 'vibration' : h === 'press' ? 'pressure' : h === 'hum' ? 'humidity' : h;
          obj[key] = Number(val) || 0;
        } else {
          obj[h] = val;
        }
      });
      if (!obj.machine_status) obj.machine_status = 'nominal';
      if (!obj.timestamp) obj.timestamp = new Date(Date.now() - (lines.length - i) * 3000).toISOString();
      records.push(obj);
    }
    return records;
  };

  // Browser download trigger
  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert records to CSV format
  const recordsToCsv = (records: any[]): string => {
    if (!records || records.length === 0) return '';
    const headers = ['id', 'device_id', 'factory_id', 'sensor_type', 'timestamp', 'temperature', 'humidity', 'vibration', 'pressure', 'machine_status', 'location'];
    const rows = records.map(r => [
      r.id || '',
      r.device_id || '',
      r.factory_id || '',
      r.sensor_type || '',
      r.timestamp || '',
      r.temperature ?? '',
      r.humidity ?? '',
      r.vibration ?? '',
      r.pressure ?? '',
      r.machine_status || 'nominal',
      `"${(r.location || '').replace(/"/g, '""')}"`
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  // Download a specific dataset as JSON or CSV
  const handleDownloadDataset = async (ds: DatasetBatch, format: 'json' | 'csv') => {
    setDownloadingId(`${ds.id}-${format}`);
    try {
      const res = await fetchSensorRecords({
        device_id: ds.device_id,
        tier: ds.storage_tier === 'edge' ? 'edge' : 'cloud',
        limit: Math.min(ds.record_count || 100, 200)
      });
      const data = res.records.length > 0 ? res.records : [];
      if (format === 'json') {
        const jsonStr = JSON.stringify(data, null, 2);
        triggerDownload(jsonStr, `${ds.id}_${ds.sensor_type}.json`, 'application/json');
      } else {
        const csvStr = recordsToCsv(data);
        triggerDownload(csvStr, `${ds.id}_${ds.sensor_type}.csv`, 'text/csv');
      }
      showToast(`Downloaded ${ds.name} as .${format.toUpperCase()}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to download dataset', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Download Sample Template for user reference
  const handleDownloadTemplate = (format: 'json' | 'csv') => {
    if (format === 'csv') {
      const sampleCsv = `timestamp,temperature,humidity,vibration,pressure,machine_status
2026-10-15T08:00:00Z,32.4,45.2,1.25,2.1,nominal
2026-10-15T08:00:05Z,34.1,44.8,1.42,2.2,nominal
2026-10-15T08:00:10Z,38.9,43.5,3.15,2.4,warning
2026-10-15T08:00:15Z,43.2,42.1,4.82,2.8,critical
2026-10-15T08:00:20Z,33.0,45.0,1.18,2.0,nominal`;
      triggerDownload(sampleCsv, 'queryleaf_telemetry_template.csv', 'text/csv');
      showToast('Downloaded sample CSV template');
    } else {
      const sampleJson = [
        { timestamp: "2026-10-15T08:00:00Z", temperature: 32.4, humidity: 45.2, vibration: 1.25, pressure: 2.1, machine_status: "nominal" },
        { timestamp: "2026-10-15T08:00:05Z", temperature: 34.1, humidity: 44.8, vibration: 1.42, pressure: 2.2, machine_status: "nominal" },
        { timestamp: "2026-10-15T08:00:10Z", temperature: 38.9, humidity: 43.5, vibration: 3.15, pressure: 2.4, machine_status: "warning" },
        { timestamp: "2026-10-15T08:00:15Z", temperature: 43.2, humidity: 42.1, vibration: 4.82, pressure: 2.8, machine_status: "critical" },
        { timestamp: "2026-10-15T08:00:20Z", temperature: 33.0, humidity: 45.0, vibration: 1.18, pressure: 2.0, machine_status: "nominal" }
      ];
      triggerDownload(JSON.stringify(sampleJson, null, 2), 'queryleaf_telemetry_template.json', 'application/json');
      showToast('Downloaded sample JSON template');
    }
  };

  // Download currently filtered stream
  const handleDownloadStream = (format: 'json' | 'csv') => {
    if (rawRecords.length === 0) {
      showToast('No records in current stream to download', 'error');
      return;
    }
    if (format === 'json') {
      triggerDownload(JSON.stringify(rawRecords, null, 2), `queryleaf_stream_${streamTierFilter}.json`, 'application/json');
    } else {
      triggerDownload(recordsToCsv(rawRecords), `queryleaf_stream_${streamTierFilter}.csv`, 'text/csv');
    }
    showToast(`Exported ${rawRecords.length} stream records as .${format.toUpperCase()}`);
  };

  // File drop / input handler
  const handleProcessFile = (file: File) => {
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');
    if (!isJson && !isCsv) {
      showToast('Please upload a .json or .csv file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let parsed: any[] = [];
        if (isJson) {
          const raw = JSON.parse(text);
          parsed = Array.isArray(raw) ? raw : [raw];
        } else {
          parsed = parseCsvToRecords(text);
        }

        if (parsed.length === 0) {
          throw new Error('File contained no valid records');
        }

        setUploadedFile({
          name: file.name,
          size: file.size,
          count: parsed.length,
          records: parsed
        });

        if (!ingestName) {
          setIngestName(file.name.replace(/\.[^/.]+$/, ''));
        }
        showToast(`Parsed ${parsed.length} records from ${file.name}`);
      } catch (err: any) {
        showToast(err.message || 'Failed to parse file', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Filtered devices
  const filteredDevices = devices.filter((dev) => {
    const matchesSearch =
      dev.device_id.toLowerCase().includes(unitSearch.toLowerCase()) ||
      dev.model.toLowerCase().includes(unitSearch.toLowerCase()) ||
      dev.location.toLowerCase().includes(unitSearch.toLowerCase());
    const matchesFactory = unitFactoryFilter === 'all' || dev.factory_id === unitFactoryFilter;
    const matchesSensor = unitSensorFilter === 'all' || dev.sensor_type === unitSensorFilter;
    return matchesSearch && matchesFactory && matchesSensor;
  });

  // Handle Provisioning
  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provDeviceId.trim()) {
      showToast('Device ID cannot be empty', 'error');
      return;
    }

    try {
      await provisionDevice({
        device_id: provDeviceId.trim().toUpperCase(),
        factory_id: provFactoryId,
        sensor_type: provSensorType,
        model: provModel || 'QueryLeaf Certified IoT Node',
        location: provLocation || 'Plant Zone',
        edge_hosted: provEdgeHosted,
        sampling_rate_hz: Number(provRateHz) || 20
      });
      showToast(`Provisioned unit ${provDeviceId.toUpperCase()} successfully`);
      setShowProvisionModal(false);
      setProvDeviceId('');
      setProvModel('');
      setProvLocation('');
      onRefreshDevices();
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to provision unit', 'error');
    }
  };

  // Handle Deprovisioning - Prompt confirmation modal
  const promptDeprovision = (dev: DeviceInfo) => {
    setDeviceToDeprovision(dev);
  };

  const handleConfirmDeprovision = async () => {
    if (!deviceToDeprovision) return;
    const targetId = deviceToDeprovision.device_id;
    setDeprovisioningDeviceId(targetId);
    try {
      await deprovisionDevice(targetId);
      showToast(`Unit ${targetId} deprovisioned successfully`);
      setDeviceToDeprovision(null);
      onRefreshDevices();
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to deprovision unit', 'error');
    } finally {
      setDeprovisioningDeviceId(null);
    }
  };

  // Handle Ingest Dataset
  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestSubmitting(true);
    try {
      let customRecords: any[] | undefined = undefined;

      if (ingestMode === 'upload') {
        if (!uploadedFile || uploadedFile.records.length === 0) {
          throw new Error('Please select or drop a valid .csv or .json file');
        }
        customRecords = uploadedFile.records;
      } else if (ingestMode === 'json') {
        if (!ingestJsonText.trim()) {
          throw new Error('Please paste a valid JSON array or CSV text');
        }
        if (ingestJsonText.trim().startsWith('[') || ingestJsonText.trim().startsWith('{')) {
          const parsed = JSON.parse(ingestJsonText);
          customRecords = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          customRecords = parseCsvToRecords(ingestJsonText);
        }
      }

      const res = await ingestDatasetBatch({
        name: ingestName.trim() || `${ingestMode === 'upload' ? uploadedFile?.name : ingestPreset} Series (${ingestTargetDevice})`,
        description: ingestDesc.trim() || `Telemetry batch ingested into ${ingestStorageTier.toUpperCase()} tier`,
        device_id: ingestTargetDevice,
        storage_tier: ingestStorageTier,
        preset_type: ingestMode === 'preset' ? ingestPreset : undefined,
        count: ingestCount,
        records: customRecords
      });

      showToast(`Ingested ${res.records_count} records into ${ingestStorageTier.toUpperCase()} tier!`);
      setShowIngestModal(false);
      setIngestName('');
      setIngestDesc('');
      setIngestJsonText('');
      setUploadedFile(null);
      loadData();
      onRefreshDevices();
    } catch (err: any) {
      showToast(err.message || 'Failed to ingest dataset', 'error');
    } finally {
      setIngestSubmitting(false);
    }
  };

  // Handle Delete Dataset - Prompt confirmation modal
  const promptDeleteDataset = (ds: DatasetBatch) => {
    setDatasetToDelete(ds);
  };

  const handleConfirmDeleteDataset = async () => {
    if (!datasetToDelete) return;
    const targetId = datasetToDelete.id;
    const targetName = datasetToDelete.name;
    setDeletingDatasetId(targetId);
    try {
      await deleteDataset(targetId);
      showToast(`Dataset "${targetName}" (${targetId}) removed successfully`);
      setDatasetToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete dataset', 'error');
    } finally {
      setDeletingDatasetId(null);
    }
  };

  // Sensor badge styling
  const getSensorBadge = (type: string) => {
    switch (type) {
      case 'vibration':
        return { label: 'Vibration (50Hz)', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'thermal':
        return { label: 'Thermal Sensor', color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'hydraulic':
        return { label: 'Hydraulic Pressure', color: 'bg-sky-50 text-sky-800 border-sky-200' };
      case 'environmental':
        return { label: 'Ambient Environmental', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      default:
        return { label: type, color: 'bg-zinc-100 text-zinc-800 border-zinc-200' };
    }
  };

  const totalSensorReadings = datasets.reduce((acc, d) => acc + d.record_count, 0) + rawTotal;
  const edgeHostedCount = devices.filter((d) => d.edge_hosted).length;

  return (
    <div className="space-y-6 w-full">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-zinc-500 hover:text-zinc-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 font-semibold">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>IOT TELEMETRY & DATASET HUB</span>
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-500">Dual-Tier Storage Fabric</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 mt-1">
              Provisioned Units & Telemetry Datasets
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-2xl leading-relaxed">
              Monitor provisioned edge IoT devices, inject synthetic or production telemetry datasets,
              and route queries dynamically across local cache, edge MongoDB, and cloud warehouse.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => {
                setProvDeviceId(`DEV-IOT-${Math.floor(100 + Math.random() * 900)}`);
                setShowProvisionModal(true);
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Provision Unit</span>
            </button>
            <button
              onClick={() => {
                if (devices.length > 0) {
                  setIngestTargetDevice(devices[0].device_id);
                }
                setShowIngestModal(true);
              }}
              className="px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-600" />
              <span>Add Dataset</span>
            </button>
            <button
              onClick={() => {
                onRefreshDevices();
                loadData();
              }}
              disabled={loading}
              className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 rounded-lg text-xs transition-colors cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-zinc-100">
          <div className="bg-zinc-50/70 p-3 rounded-lg border border-zinc-200/70">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>PROVISIONED UNITS</span>
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="mt-1 text-xl font-bold text-zinc-950 font-mono tabular-nums">
              {devices.length}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {edgeHostedCount} local edge · {devices.length - edgeHostedCount} cloud nodes
            </div>
          </div>

          <div className="bg-zinc-50/70 p-3 rounded-lg border border-zinc-200/70">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>ACTIVE DATASETS</span>
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="mt-1 text-xl font-bold text-zinc-950 font-mono tabular-nums">
              {datasets.length}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              Available for query evaluation
            </div>
          </div>

          <div className="bg-zinc-50/70 p-3 rounded-lg border border-zinc-200/70">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>RECORDS IN WAREHOUSE</span>
              <Database className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="mt-1 text-xl font-bold text-zinc-950 font-mono tabular-nums">
              {totalSensorReadings}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              Edge 24h & Cloud 30d records
            </div>
          </div>

          <div className="bg-zinc-50/70 p-3 rounded-lg border border-zinc-200/70">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>STORAGE TOPOLOGY</span>
              <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="mt-1 text-xl font-bold text-zinc-950 font-mono">
              Dual-Tier
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              RAM Cache + Edge + Cloud
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('units')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'units'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Provisioned Units ({devices.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('datasets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'datasets'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Datasets & Batch Ingestion ({datasets.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('stream')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'stream'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Sensor Stream</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
          QueryLeaf Hardware Fabric v1.0
        </span>
      </div>

      {/* TAB 1: PROVISIONED UNITS */}
      {activeSubTab === 'units' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search unit by ID, model, or location..."
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Factory Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-zinc-500 font-mono text-[11px]">Factory:</span>
                <select
                  value={unitFactoryFilter}
                  onChange={(e) => setUnitFactoryFilter(e.target.value)}
                  className="px-2 py-1 text-xs bg-white border border-zinc-200 rounded-md text-zinc-800 focus:outline-none"
                >
                  <option value="all">All Facilities</option>
                  <option value="FAC-01">FAC-01 (Milling & Robotics)</option>
                  <option value="FAC-02">FAC-02 (Heavy Stamping)</option>
                  <option value="FAC-03">FAC-03 (Packaging & Sorting)</option>
                </select>
              </div>

              {/* Sensor Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-zinc-500 font-mono text-[11px]">Sensor:</span>
                <select
                  value={unitSensorFilter}
                  onChange={(e) => setUnitSensorFilter(e.target.value)}
                  className="px-2 py-1 text-xs bg-white border border-zinc-200 rounded-md text-zinc-800 focus:outline-none"
                >
                  <option value="all">All Sensor Types</option>
                  <option value="vibration">Vibration</option>
                  <option value="thermal">Thermal</option>
                  <option value="hydraulic">Hydraulic</option>
                  <option value="environmental">Environmental</option>
                </select>
              </div>
            </div>
          </div>

          {/* Unit Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
            {filteredDevices.map((dev) => {
              const badge = getSensorBadge(dev.sensor_type);
              const isWarning = dev.status === 'warning';
              const isIdle = dev.status === 'idle';

              return (
                <div
                  key={dev.device_id}
                  className="border border-zinc-200/90 bg-white rounded-xl p-4 flex flex-col justify-between hover:border-zinc-300 transition-colors shadow-2xs group"
                >
                  <div>
                    {/* Top Row: Device ID & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isWarning ? 'bg-amber-500 animate-pulse' : isIdle ? 'bg-zinc-400' : 'bg-emerald-500'
                          }`}
                          title={`Status: ${dev.status || 'active'}`}
                        />
                        <span className="font-mono text-xs font-bold text-zinc-950 tracking-tight">
                          {dev.device_id}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
                        {dev.factory_id}
                      </span>
                    </div>

                    {/* Model & Location */}
                    <div className="mt-2 text-xs font-semibold text-zinc-800">
                      {dev.model}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
                      <span>{dev.location}</span>
                    </div>

                    {/* Sensor Badge & Edge Badge */}
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          dev.edge_hosted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                        }`}
                      >
                        {dev.edge_hosted ? 'Edge-Hosted' : 'Cloud Remote'}
                      </span>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-100 text-[11px] font-mono text-zinc-600">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">SAMPLING</span>
                        <span className="font-semibold text-zinc-800">{dev.sampling_rate_hz} Hz</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">STORED RECORDS</span>
                        <span className="font-semibold text-zinc-800">{dev.total_records || 300} pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => onNavigateToQuery(dev.device_id, 'latest_status')}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                      title="Run query with this unit"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Query Unit</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setIngestTargetDevice(dev.device_id);
                          setShowIngestModal(true);
                        }}
                        className="text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                        title="Add telemetry data to this device"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Data</span>
                      </button>
                      <button
                        onClick={() => promptDeprovision(dev)}
                        disabled={deprovisioningDeviceId === dev.device_id}
                        className="text-zinc-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Deprovision unit"
                      >
                        {deprovisioningDeviceId === dev.device_id ? (
                          <RefreshCw className="w-3.5 h-3.5 text-rose-500 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDevices.length === 0 && (
            <div className="text-center py-12 border border-dashed border-zinc-200 rounded-xl bg-white text-zinc-500 text-xs">
              No provisioned units matched your filter criteria.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DATASETS & BATCH INGESTION */}
      {activeSubTab === 'datasets' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Registered Telemetry Datasets</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Download sample templates, export active datasets as JSON/CSV, or upload new batches.
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Download Starter Templates */}
              <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-0.5 text-[11px] font-mono text-zinc-600">
                <span className="px-2 text-zinc-400">Templates:</span>
                <button
                  onClick={() => handleDownloadTemplate('csv')}
                  className="px-2 py-1 bg-white hover:bg-zinc-100 rounded text-zinc-800 font-semibold border border-zinc-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Download Starter CSV Template"
                >
                  <Download className="w-3 h-3 text-zinc-500" />
                  <span>Sample CSV</span>
                </button>
                <button
                  onClick={() => handleDownloadTemplate('json')}
                  className="px-2 py-1 bg-white hover:bg-zinc-100 rounded text-zinc-800 font-semibold border border-zinc-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Download Starter JSON Template"
                >
                  <Download className="w-3 h-3 text-zinc-500" />
                  <span>Sample JSON</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setIngestMode('upload');
                  setShowIngestModal(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Dataset (.csv / .json)</span>
              </button>
            </div>
          </div>

          {/* Datasets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((ds) => {
              const tierBadge =
                ds.storage_tier === 'edge'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : ds.storage_tier === 'cloud'
                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                  : 'bg-indigo-50 text-indigo-800 border-indigo-200';

              return (
                <div
                  key={ds.id}
                  className="border border-zinc-200/90 bg-white rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-zinc-300 transition-colors shadow-2xs"
                >
                  <div>
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <h4 className="font-semibold text-xs sm:text-sm text-zinc-950 tracking-tight">
                          {ds.name}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${tierBadge}`}>
                        {ds.storage_tier.toUpperCase()} TIER
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                      {ds.description}
                    </p>

                    {/* Dataset Metadata Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200/60 text-[11px] font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">TARGET UNIT</span>
                        <span className="font-semibold text-zinc-800">{ds.device_id}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">RECORD COUNT</span>
                        <span className="font-semibold text-zinc-800">{ds.record_count} pts</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-zinc-400 block">TYPE</span>
                        <span className="font-semibold text-zinc-800 capitalize">{ds.sensor_type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Strip: Query & Download as JSON/CSV */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => onNavigateToQuery(ds.device_id, 'recent_history')}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Test in Query Explorer</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownloadDataset(ds, 'json')}
                        disabled={downloadingId === `${ds.id}-json`}
                        className="text-[11px] font-mono text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 bg-white px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        title="Download dataset as JSON"
                      >
                        <Download className="w-3 h-3 text-zinc-500" />
                        <span>JSON</span>
                      </button>
                      <button
                        onClick={() => handleDownloadDataset(ds, 'csv')}
                        disabled={downloadingId === `${ds.id}-csv`}
                        className="text-[11px] font-mono text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 bg-white px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        title="Download dataset as CSV"
                      >
                        <Download className="w-3 h-3 text-zinc-500" />
                        <span>CSV</span>
                      </button>
                      <button
                        onClick={() => promptDeleteDataset(ds)}
                        disabled={deletingDatasetId === ds.id}
                        className="text-zinc-500 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer ml-1 flex items-center gap-1 group disabled:opacity-50"
                        title={`Delete dataset ${ds.name}`}
                        aria-label={`Delete dataset ${ds.name}`}
                      >
                        {deletingDatasetId === ds.id ? (
                          <RefreshCw className="w-3.5 h-3.5 text-rose-500 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-rose-600 transition-colors" />
                        )}
                        <span className="text-[11px] font-medium text-zinc-500 group-hover:text-rose-600 hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {datasets.length === 0 && (
            <div className="text-center py-12 border border-dashed border-zinc-200 rounded-xl bg-white text-zinc-500 text-xs">
              No datasets registered. Click "Add New Dataset" above to ingest an industrial batch.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE SENSOR STREAM (RAW READINGS) */}
      {activeSubTab === 'stream' && (
        <div className="space-y-4">
          {/* Stream Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-zinc-500 font-mono text-[11px]">Source Unit:</span>
                <select
                  value={streamDeviceFilter}
                  onChange={(e) => setStreamDeviceFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-md text-zinc-800 focus:outline-none"
                >
                  <option value="all">All Units ({devices.length})</option>
                  {devices.map((d) => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_id} ({d.model})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-zinc-500 font-mono text-[11px]">Storage Tier:</span>
                <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-md border border-zinc-200">
                  <button
                    onClick={() => setStreamTierFilter('edge')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      streamTierFilter === 'edge' ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600'
                    }`}
                  >
                    Edge MongoDB (24h)
                  </button>
                  <button
                    onClick={() => setStreamTierFilter('cloud')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      streamTierFilter === 'cloud' ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600'
                    }`}
                  >
                    Cloud Warehouse (30d)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-zinc-500">
                {rawRecords.length} of {rawTotal} records in {streamTierFilter.toUpperCase()}
              </span>
              <button
                onClick={() => handleDownloadStream('csv')}
                className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded text-xs font-mono flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                title="Export current stream as CSV"
              >
                <Download className="w-3 h-3 text-zinc-500" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => handleDownloadStream('json')}
                className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded text-xs font-mono flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                title="Export current stream as JSON"
              >
                <Download className="w-3 h-3 text-zinc-500" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Time Series Mini Chart */}
          {rawRecords.length > 0 && (
            <div className="border border-zinc-200/90 bg-white rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold text-zinc-900">Telemetry Sensor Waveform</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Temperature (°C) & Vibration (mm/s)
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...rawRecords].reverse().slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <Line type="monotone" dataKey="temperature" stroke="#10b981" strokeWidth={1.5} dot={false} name="Temp (°C)" />
                    <Line type="monotone" dataKey="vibration" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Vibration (mm/s)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Raw Records Table */}
          <div className="border border-zinc-200/90 bg-white rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Device ID</th>
                    <th className="py-2.5 px-3">Sensor Type</th>
                    <th className="py-2.5 px-3">Temp (°C)</th>
                    <th className="py-2.5 px-3">Vib (mm/s)</th>
                    <th className="py-2.5 px-3">Pressure (bar)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                  {rawRecords.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                        {r.device_id}
                      </td>
                      <td className="py-2 px-3 text-zinc-600 capitalize">
                        {r.sensor_type}
                      </td>
                      <td className="py-2 px-3 text-zinc-800 font-semibold tabular-nums">
                        {r.temperature}°C
                      </td>
                      <td className="py-2 px-3 text-zinc-800 font-semibold tabular-nums">
                        {r.vibration}
                      </td>
                      <td className="py-2 px-3 text-zinc-800 tabular-nums">
                        {r.pressure}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            r.machine_status === 'critical'
                              ? 'bg-rose-50 text-rose-700 font-bold'
                              : r.machine_status === 'warning'
                              ? 'bg-amber-50 text-amber-700 font-bold'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {r.machine_status || 'nominal'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-500 whitespace-nowrap text-[10px]">
                        {r.location || 'Line'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rawRecords.length === 0 && (
              <div className="text-center py-10 text-zinc-400 text-xs">
                No records found for this unit and tier.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: PROVISION NEW UNIT */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-zinc-950">Provision New IoT Unit</h3>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-700 font-medium mb-1">Device ID / Asset Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEV-TURBINE-001"
                  value={provDeviceId}
                  onChange={(e) => setProvDeviceId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Factory / Facility Zone</label>
                  <select
                    value={provFactoryId}
                    onChange={(e) => setProvFactoryId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none"
                  >
                    <option value="FAC-01">FAC-01 (Milling & Robotics)</option>
                    <option value="FAC-02">FAC-02 (Heavy Stamping)</option>
                    <option value="FAC-03">FAC-03 (Packaging & Sorting)</option>
                    <option value="FAC-04">FAC-04 (Cleanroom Assembly)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Primary Sensor Type *</label>
                  <select
                    value={provSensorType}
                    onChange={(e) => setProvSensorType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none"
                  >
                    <option value="vibration">Vibration (Accelerometer)</option>
                    <option value="thermal">Thermal (Thermocouple)</option>
                    <option value="hydraulic">Hydraulic (Pressure)</option>
                    <option value="environmental">Environmental (Temp/RH)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1">Equipment Model</label>
                <input
                  type="text"
                  placeholder="e.g. Siemens Sinumerik Edge Micro 400"
                  value={provModel}
                  onChange={(e) => setProvModel(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-900 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1">Physical Installation Location</label>
                <input
                  type="text"
                  placeholder="e.g. Hall C - Bearing Housing Unit 4"
                  value={provLocation}
                  onChange={(e) => setProvLocation(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-900 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Sampling Frequency (Hz)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={provRateHz}
                    onChange={(e) => setProvRateHz(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-900 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Edge Node Hosting</label>
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provEdgeHosted}
                      onChange={(e) => setProvEdgeHosted(e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-zinc-700 text-xs font-medium">Local Edge Resident</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-3 py-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  Confirm Provisioning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INGEST DATASET */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-zinc-950">Add Telemetry Dataset Batch</h3>
              </div>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ingestion Mode Selector */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg border border-zinc-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setIngestMode('upload')}
                className={`flex-1 py-1.5 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  ingestMode === 'upload' ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Upload File (.csv / .json)</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('preset')}
                className={`flex-1 py-1.5 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  ingestMode === 'preset' ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Industrial Presets</span>
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('json')}
                className={`flex-1 py-1.5 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  ingestMode === 'json' ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>Paste Text</span>
              </button>
            </div>

            <form onSubmit={handleIngestSubmit} className="space-y-3.5 text-xs">
              {/* Target Device & Tier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Target Provisioned Unit *</label>
                  <select
                    value={ingestTargetDevice}
                    onChange={(e) => setIngestTargetDevice(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none font-mono"
                  >
                    {devices.map((d) => (
                      <option key={d.device_id} value={d.device_id}>
                        {d.device_id} ({d.sensor_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Destination Storage Tier *</label>
                  <select
                    value={ingestStorageTier}
                    onChange={(e) => setIngestStorageTier(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none font-mono"
                  >
                    <option value="both">Both (Edge + Cloud Mirror)</option>
                    <option value="edge">Edge Only (Local MongoDB)</option>
                    <option value="cloud">Cloud Only (Warehouse)</option>
                  </select>
                </div>
              </div>

              {/* MODE 1: FILE UPLOAD (.CSV / .JSON) */}
              {ingestMode === 'upload' && (
                <div className="space-y-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleProcessFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : uploadedFile
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                    }`}
                  >
                    <input
                      type="file"
                      id="telemetry-file-input"
                      accept=".csv,.json,text/csv,application/json"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {uploadedFile ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        <span className="font-semibold text-zinc-900 font-mono text-xs">
                          {uploadedFile.name}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {uploadedFile.count} sensor records parsed · {(uploadedFile.size / 1024).toFixed(1)} KB
                        </span>
                        <label
                          htmlFor="telemetry-file-input"
                          className="mt-2 text-xs text-emerald-700 hover:underline cursor-pointer font-medium"
                        >
                          Choose a different file
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload className="w-8 h-8 text-zinc-400" />
                        <div className="text-zinc-700 font-medium">
                          Drag & drop your <span className="font-semibold text-zinc-900">.csv</span> or <span className="font-semibold text-zinc-900">.json</span> dataset
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Supports time-series columns: temperature, vibration, pressure, humidity
                        </p>
                        <label
                          htmlFor="telemetry-file-input"
                          className="mt-2 inline-block px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800 rounded-lg font-medium cursor-pointer shadow-2xs"
                        >
                          Browse File
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Starter Templates Helper */}
                  <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px]">
                    <span className="text-zinc-500">Need a sample format?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate('csv')}
                        className="text-emerald-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Sample CSV</span>
                      </button>
                      <span className="text-zinc-300">·</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate('json')}
                        className="text-emerald-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Sample JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: INDUSTRIAL PRESETS */}
              {ingestMode === 'preset' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-zinc-700 font-medium mb-1">Preset Industrial Domain</label>
                    <select
                      value={ingestPreset}
                      onChange={(e) => setIngestPreset(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none"
                    >
                      <option value="milling_spindle">High-Precision CNC Milling Spindle Dynamics (Vibration chatter)</option>
                      <option value="cold_chain">Cold Chain Storage Excursion (Thermal excursion alert)</option>
                      <option value="hydraulic_stamping">Heavy 2000T Stamping Pressure Profile (Hydraulic relief)</option>
                      <option value="cleanroom">Cleanroom Ambient Logger (Temp & Humidity curve)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-700 font-medium mb-1">Records to Generate & Ingest: {ingestCount}</label>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="10"
                      value={ingestCount}
                      onChange={(e) => setIngestCount(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-0.5">
                      <span>10 records</span>
                      <span>150 records</span>
                      <span>300 records</span>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: MANUAL PASTE (JSON OR CSV) */}
              {ingestMode === 'json' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-700 font-medium">
                      Raw JSON Array or CSV Text
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Accepts [&#123;...&#125;] or CSV lines
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    placeholder={`Paste CSV:\ntimestamp,temperature,vibration,pressure,machine_status\n2026-10-15T08:00:00Z,32.4,1.25,2.1,nominal\n\nOr paste JSON:\n[\n  { "temperature": 42.5, "vibration": 2.1, "machine_status": "nominal" }\n]`}
                    value={ingestJsonText}
                    onChange={(e) => setIngestJsonText(e.target.value)}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg text-zinc-900 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 leading-tight"
                  />
                </div>
              )}

              {/* Dataset Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Dataset Label (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Spindle Harmonic Run #4"
                    value={ingestName}
                    onChange={(e) => setIngestName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-900 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">Brief Description</label>
                  <input
                    type="text"
                    placeholder="e.g. High-speed chatter during milling cycle"
                    value={ingestDesc}
                    onChange={(e) => setIngestDesc(e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-900 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-3 py-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingestSubmitting}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {ingestSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Ingest Telemetry Batch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dataset Confirmation Modal */}
      {datasetToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!deletingDatasetId) setDatasetToDelete(null);
          }}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-950 tracking-tight">
                    Delete Telemetry Dataset
                  </h3>
                  <button
                    onClick={() => {
                      if (!deletingDatasetId) setDatasetToDelete(null);
                    }}
                    className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-zinc-900 font-semibold">{datasetToDelete.name}</strong>?
                </p>

                {/* Dataset detail summary card */}
                <div className="mt-3.5 p-3 rounded-lg bg-zinc-50 border border-zinc-200/80 text-[11px] font-mono space-y-1.5 text-zinc-600">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Dataset ID:</span>
                    <span className="font-semibold text-zinc-800">{datasetToDelete.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Target IoT Unit:</span>
                    <span className="font-semibold text-zinc-800">{datasetToDelete.device_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Record Count:</span>
                    <span className="font-semibold text-emerald-700">{datasetToDelete.record_count} points</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Storage Tier:</span>
                    <span className="font-semibold text-zinc-800 uppercase">{datasetToDelete.storage_tier}</span>
                  </div>
                </div>

                <p className="text-[11px] text-rose-600/90 font-medium mt-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>This removes the registry entry and purges associated cached queries.</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3.5 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setDatasetToDelete(null)}
                disabled={deletingDatasetId !== null}
                className="px-3.5 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDataset}
                disabled={deletingDatasetId !== null}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {deletingDatasetId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Dataset...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Dataset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deprovision Unit Confirmation Modal */}
      {deviceToDeprovision && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!deprovisioningDeviceId) setDeviceToDeprovision(null);
          }}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-950 tracking-tight">
                    Deprovision IoT Unit
                  </h3>
                  <button
                    onClick={() => {
                      if (!deprovisioningDeviceId) setDeviceToDeprovision(null);
                    }}
                    className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                  Are you sure you want to deprovision{' '}
                  <strong className="text-zinc-900 font-semibold">{deviceToDeprovision.device_id}</strong>?
                </p>

                <div className="mt-3.5 p-3 rounded-lg bg-zinc-50 border border-zinc-200/80 text-[11px] font-mono space-y-1.5 text-zinc-600">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Unit ID:</span>
                    <span className="font-semibold text-zinc-800">{deviceToDeprovision.device_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Factory:</span>
                    <span className="font-semibold text-zinc-800">{deviceToDeprovision.factory_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Sensor Type:</span>
                    <span className="font-semibold text-zinc-800 capitalize">{deviceToDeprovision.sensor_type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Deployment Tier:</span>
                    <span className="font-semibold text-zinc-800">{deviceToDeprovision.edge_hosted ? 'Edge + Cloud' : 'Cloud Only'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3.5 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setDeviceToDeprovision(null)}
                disabled={deprovisioningDeviceId !== null}
                className="px-3.5 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeprovision}
                disabled={deprovisioningDeviceId !== null}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {deprovisioningDeviceId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deprovisioning...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Deprovision Unit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
