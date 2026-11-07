import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Database,
  Layers,
  ChevronDown,
  RefreshCw,
  Code2,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  Globe
} from 'lucide-react';
import {
  DeviceInfo,
  GatewayExecutionResponse,
  QueryCategory,
  RoutingPolicy
} from '../types';
import { executeQuery } from '../api';

interface QueryExplorerTabProps {
  devices: DeviceInfo[];
  selectedDeviceId?: string;
  onQueryCompleted: () => void;
}

export const QueryExplorerTab: React.FC<QueryExplorerTabProps> = ({
  devices,
  selectedDeviceId,
  onQueryCompleted
}) => {
  const [category, setCategory] = useState<QueryCategory>('latest_status');
  const [selectedDevice, setSelectedDevice] = useState<string>(selectedDeviceId || devices[0]?.device_id || 'DEV-CNC-001');
  const [maxAge, setMaxAge] = useState<string>('30');
  const [deadline, setDeadline] = useState<string>('');
  const [policyOverride, setPolicyOverride] = useState<string>('adaptive');
  const [aggregationType, setAggregationType] = useState<'avg' | 'max' | 'min'>('avg');
  const [metric, setMetric] = useState<'temperature' | 'vibration' | 'pressure' | 'humidity'>('temperature');

  const [executing, setExecuting] = useState(false);
  const [response, setResponse] = useState<GatewayExecutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedDeviceId) {
      setSelectedDevice(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);

    try {
      const payload: any = {
        query_category: category,
        device_id: selectedDevice || undefined,
        force_policy: policyOverride as RoutingPolicy
      };

      if (maxAge) {
        payload.max_age_seconds = Number(maxAge);
      }
      if (deadline) {
        payload.deadline_ms = Number(deadline);
      }
      if (category === 'edge_aggregation' || category === 'cloud_analytics') {
        payload.aggregation_type = aggregationType;
        payload.metric = metric;
      }

      const res = await executeQuery(payload);
      setResponse(res);
      onQueryCompleted();
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const copyJson = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setPreset = (presetType: string) => {
    switch (presetType) {
      case 'cache_test':
        setCategory('latest_status');
        setSelectedDevice('DEV-CNC-001');
        setMaxAge('60');
        setPolicyOverride('adaptive');
        break;
      case 'historical_cloud':
        setCategory('deep_history');
        setSelectedDevice('DEV-FURNACE-001');
        setMaxAge('');
        setPolicyOverride('adaptive');
        break;
      case 'edge_agg':
        setCategory('edge_aggregation');
        setAggregationType('avg');
        setMetric('temperature');
        setMaxAge('30');
        setPolicyOverride('adaptive');
        break;
      case 'strict_sla':
        setCategory('latest_status');
        setSelectedDevice('DEV-PRESS-001');
        setMaxAge('0'); // force rejection of cache
        setDeadline('20'); // forces edge only or fails cloud
        setPolicyOverride('adaptive');
        break;
    }
  };

  return (
    <div className="space-y-5 w-full">
      {/* Header and Quick Presets */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 font-semibold">
              <Code2 className="w-3.5 h-3.5" />
              <span>LIVE PIPELINE INSPECTOR</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight mt-0.5">
              Interactive Query Explorer & Decision Matrix
            </h2>
            <p className="text-xs text-zinc-600 mt-1 max-w-2xl leading-relaxed">
              Submit targeted IoT queries, set freshness and SLA deadlines, and inspect the real-time routing decision
              matrix comparing candidate eligibility, normalization components, and objective function scores J(route).
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-zinc-500 font-mono">Presets:</span>
            <button
              onClick={() => setPreset('cache_test')}
              className="px-2.5 py-1 text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium rounded-md border border-zinc-200 transition-colors cursor-pointer"
            >
              Recent Status
            </button>
            <button
              onClick={() => setPreset('edge_agg')}
              className="px-2.5 py-1 text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium rounded-md border border-zinc-200 transition-colors cursor-pointer"
            >
              Edge Aggregation
            </button>
            <button
              onClick={() => setPreset('historical_cloud')}
              className="px-2.5 py-1 text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium rounded-md border border-zinc-200 transition-colors cursor-pointer"
            >
              30-Day History
            </button>
            <button
              onClick={() => setPreset('strict_sla')}
              className="px-2.5 py-1 text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium rounded-md border border-zinc-200 transition-colors cursor-pointer"
            >
              Strict 20ms SLA
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Form (4 cols) & Inspector (8 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch w-full">
        {/* Left Column: Query Config Form */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 xl:col-span-4 flex flex-col justify-between h-full space-y-4 shadow-2xs">
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
              Query Configuration
            </h3>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Query Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as QueryCategory)}
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs text-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="latest_status">latest_status (Single Device Reading)</option>
                <option value="recent_history">recent_history (Past 24h Sensor Series)</option>
                <option value="edge_aggregation">edge_aggregation (Factory Aggregation)</option>
                <option value="deep_history">deep_history (Historical 30-Day Series)</option>
                <option value="cloud_analytics">cloud_analytics (Cross-Factory Variance)</option>
              </select>
            </div>

            {/* Device */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Target IoT Machine
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs text-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
              >
                {devices.map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_id} · {d.model} ({d.sensor_type})
                  </option>
                ))}
              </select>
            </div>

            {/* If Aggregation */}
            {(category === 'edge_aggregation' || category === 'cloud_analytics') && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Metric</label>
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as any)}
                    className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs text-zinc-800"
                  >
                    <option value="temperature">Temperature</option>
                    <option value="vibration">Vibration</option>
                    <option value="pressure">Pressure</option>
                    <option value="humidity">Humidity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Operator</label>
                  <select
                    value={aggregationType}
                    onChange={(e) => setAggregationType(e.target.value as any)}
                    className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs text-zinc-800"
                  >
                    <option value="avg">AVG</option>
                    <option value="max">MAX</option>
                    <option value="min">MIN</option>
                  </select>
                </div>
              </div>
            )}

            {/* Freshness Requirement */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-zinc-600">
                  Freshness SLA (max_age_seconds)
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">Empty = any</span>
              </div>
              <input
                type="number"
                placeholder="e.g. 30"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Deadline Requirement */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-zinc-600">
                  Latency SLA Deadline (ms)
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">Empty = no deadline</span>
              </div>
              <input
                type="number"
                placeholder="e.g. 50"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Policy Override */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Routing Policy Override
              </label>
              <select
                value={policyOverride}
                onChange={(e) => setPolicyOverride(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs text-zinc-800 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="adaptive">adaptive (Multi-Objective J = αL+βE+γC)</option>
                <option value="cache_first">cache_first (Cache -&gt; Edge -&gt; Cloud)</option>
                <option value="cloud_only">cloud_only (Direct to Cloud Baseline)</option>
                <option value="fixed_rule">fixed_rule (Static Heuristic)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleExecute}
              disabled={executing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-black transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {executing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Evaluating Routing Cost Matrix...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-white" />
                  <span>Submit Gateway Request</span>
                </>
              )}
            </button>

            {error && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Candidate Inspector & Response JSON */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 xl:col-span-8 flex flex-col justify-between h-full space-y-5 shadow-2xs">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                Candidate Evaluation & Response Payload
              </h3>
              {response && (
                <span className="text-[11px] font-mono text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                  Trace: {response.request_id}
                </span>
              )}
            </div>

            {!response ? (
              <div className="py-24 text-center border border-dashed border-zinc-200 rounded-lg bg-zinc-50/50 flex flex-col items-center justify-center">
                <Code2 className="w-8 h-8 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-800 font-semibold">Ready to execute gateway query</p>
                <p className="text-[11px] text-zinc-500 mt-1">Select a preset or click "Submit Gateway Request" to inspect routing scores.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Route Summary Banner */}
                <div className="p-4 bg-zinc-50/70 rounded-lg border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500 font-mono text-[11px]">SELECTED ROUTE:</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase bg-zinc-900 text-white shadow-2xs">
                        {response.execution_path}
                      </span>
                      {response.cache_hit && (
                        <span className="text-emerald-700 text-xs font-mono font-medium">· Cache Hit ({response.cache_age_seconds}s age)</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 max-w-xl leading-relaxed">
                      {response.routing_explanation}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono border-t sm:border-t-0 sm:border-l border-zinc-200 pt-2 sm:pt-0 sm:pl-4 shrink-0">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Duration</span>
                      <span className="text-zinc-950 font-bold text-sm tabular-nums">{response.latency_ms} ms</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Energy</span>
                      <span className="text-zinc-950 font-bold text-sm tabular-nums">
                        {(response.energy_wh * 1000).toFixed(3)} mWh
                      </span>
                    </div>
                  </div>
                </div>

                {/* Candidate Scoring Matrix */}
                <div>
                  <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 font-mono">
                    Candidate Path Multi-Objective Score Comparison J(route)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
                    {(['cache', 'edge', 'cloud'] as const).map((pathKey) => {
                      const candidate = response.candidate_evaluations[pathKey];
                      const isSelected = response.execution_path === pathKey;

                      return (
                        <div
                          key={pathKey}
                          className={`p-3.5 rounded-lg border text-xs font-mono space-y-2 transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs ring-1 ring-zinc-900/10'
                              : candidate?.eligible
                              ? 'bg-zinc-50/70 border-zinc-200 text-zinc-700'
                              : 'bg-zinc-50/40 border-zinc-200 text-zinc-400 opacity-60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`font-semibold uppercase flex items-center gap-1.5 text-xs ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                                {pathKey === 'cache' && <Database className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />}
                                {pathKey === 'edge' && <Cpu className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />}
                                {pathKey === 'cloud' && <Globe className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />}
                                <span>{pathKey}</span>
                              </span>
                              {candidate?.eligible ? (
                                <span className={`flex items-center gap-1 text-[10px] font-medium ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}>
                                  <CheckCircle className="w-3 h-3" /> Eligible
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                                  <XCircle className="w-3 h-3" /> Disqualified
                                </span>
                              )}
                            </div>

                            {candidate?.eligible ? (
                              <div className="space-y-1">
                                <div className={`flex justify-between text-[11px] ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                  <span>Est. Latency:</span>
                                  <span className={`tabular-nums ${isSelected ? 'text-white font-medium' : 'text-zinc-800'}`}>{candidate.estimated_latency_ms} ms</span>
                                </div>
                                <div className={`flex justify-between text-[11px] ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                  <span>Est. Energy:</span>
                                  <span className={`tabular-nums ${isSelected ? 'text-white font-medium' : 'text-zinc-800'}`}>{(candidate.estimated_energy_wh * 1000).toFixed(3)} mWh</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-500 font-sans leading-relaxed pt-0.5">
                                {candidate?.ineligibility_reason || 'Ineligible'}
                              </div>
                            )}
                          </div>

                          {candidate?.eligible && (
                            <div className={`flex justify-between text-xs pt-1.5 border-t ${isSelected ? 'border-zinc-800' : 'border-zinc-200'}`}>
                              <span className={isSelected ? 'text-zinc-300' : 'text-zinc-500'}>Cost J(route):</span>
                              <span className={`font-bold tabular-nums ${isSelected ? 'text-emerald-300' : 'text-zinc-900'}`}>
                                {candidate.objective_score}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* JSON Response Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                      Returned Sensor Payload ({response.result_count} record{response.result_count === 1 ? '' : 's'})
                    </h4>
                    <button
                      onClick={copyJson}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-50 border border-zinc-200 rounded transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-800 max-h-56 overflow-y-auto">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
