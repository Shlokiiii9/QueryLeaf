import React, { useState } from 'react';
import {
  Sliders,
  Cpu,
  Globe,
  Database,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Recommendation, SimulationConfig } from '../types';
import { clearCache, ingestSensorReading } from '../api';

interface SimulationConfigTabProps {
  config: SimulationConfig | null;
  recommendations: Recommendation[];
  onUpdateConfig: (updates: Partial<SimulationConfig>) => void;
  onRefresh: () => void;
}

export const SimulationConfigTab: React.FC<SimulationConfigTabProps> = ({
  config,
  recommendations,
  onUpdateConfig,
  onRefresh
}) => {
  const [localConfig, setLocalConfig] = useState<SimulationConfig | null>(config);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheClearMessage, setCacheClearMessage] = useState<string | null>(null);

  // Ingest sensor form state
  const [ingestDevice, setIngestDevice] = useState('DEV-CNC-001');
  const [ingestTemp, setIngestTemp] = useState('42.5');
  const [ingestStatus, setIngestStatus] = useState('warning');
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  if (!localConfig) {
    return <div className="text-zinc-500 p-6 text-xs font-mono">Loading configuration...</div>;
  }

  const handleWeightChange = (key: 'alpha_latency' | 'beta_energy' | 'gamma_cost', val: number) => {
    setLocalConfig(prev => prev ? { ...prev, [key]: val } : null);
  };

  const handleSave = () => {
    if (!localConfig) return;
    onUpdateConfig(localConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const res = await clearCache();
      setCacheClearMessage(`Invalidated ${res.cleared_entries} entries from Redis cache.`);
      onRefresh();
    } catch (err: any) {
      setCacheClearMessage('Failed to invalidate cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await ingestSensorReading({
        device_id: ingestDevice,
        factory_id: 'FAC-01',
        temperature: Number(ingestTemp),
        machine_status: ingestStatus
      });
      setIngestMessage(`Reading recorded! Invalidated ${res.invalidated_cache_entries} cache keys.`);
      onRefresh();
    } catch (err: any) {
      setIngestMessage('Failed to ingest reading.');
    }
  };

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 font-semibold">
              <Sliders className="w-3.5 h-3.5 text-zinc-600" />
              <span>SIMULATION CONTROLS</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight">
              Simulation & Environmental Parameters
            </h2>
            <p className="text-xs text-zinc-600 max-w-2xl leading-relaxed">
              Fine-tune multi-objective routing weights, simulate edge node CPU thermal throttle conditions,
              and adjust simulated WAN network latencies and power ratings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-black rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Simulation parameters updated successfully. Gateway routing engine adjusted.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch w-full">
        {/* Left Column: Weights and Active Policy */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full space-y-4 shadow-2xs">
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
              Multi-Objective Weights
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-mono mb-1 text-zinc-600 text-[11px]">
                  <span>Latency Weight (α):</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{localConfig.alpha_latency}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localConfig.alpha_latency}
                  onChange={(e) => handleWeightChange('alpha_latency', Number(e.target.value))}
                  className="w-full accent-zinc-800 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1 text-zinc-600 text-[11px]">
                  <span>Energy Weight (β):</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{localConfig.beta_energy}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localConfig.beta_energy}
                  onChange={(e) => handleWeightChange('beta_energy', Number(e.target.value))}
                  className="w-full accent-zinc-800 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1 text-zinc-600 text-[11px]">
                  <span>Operational Cost Weight (γ):</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{localConfig.gamma_cost}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localConfig.gamma_cost}
                  onChange={(e) => handleWeightChange('gamma_cost', Number(e.target.value))}
                  className="w-full accent-zinc-800 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100">
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Gateway Active Policy
            </label>
            <select
              value={localConfig.active_policy}
              onChange={(e) => setLocalConfig(prev => prev ? { ...prev, active_policy: e.target.value as any } : null)}
              className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 font-mono focus:outline-none focus:border-zinc-500"
            >
              <option value="adaptive">adaptive (Multi-Objective Optimization)</option>
              <option value="cache_first">cache_first (Cache -&gt; Edge -&gt; Cloud)</option>
              <option value="cloud_only">cloud_only (Direct to Cloud Baseline)</option>
              <option value="fixed_rule">fixed_rule (Static Heuristic)</option>
            </select>
          </div>
        </div>

        {/* Center Column: Edge & Cloud Simulation Sliders */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full space-y-4 shadow-2xs">
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
              Edge & Cloud Environment
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-mono mb-1 text-zinc-600 text-[11px]">
                  <span>Edge CPU Utilization:</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{localConfig.edge_cpu_utilization_pct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="5"
                  value={localConfig.edge_cpu_utilization_pct}
                  onChange={(e) => setLocalConfig(prev => prev ? { ...prev, edge_cpu_utilization_pct: Number(e.target.value) } : null)}
                  className="w-full accent-zinc-800 cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500 block mt-0.5">High CPU load induces queueing delay on edge database</span>
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1 text-zinc-600 text-[11px]">
                  <span>Simulated Cloud WAN RTT:</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{localConfig.cloud_network_rtt_ms} ms</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="250"
                  step="5"
                  value={localConfig.cloud_network_rtt_ms}
                  onChange={(e) => setLocalConfig(prev => prev ? { ...prev, cloud_network_rtt_ms: Number(e.target.value) } : null)}
                  className="w-full accent-zinc-800 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1 text-zinc-600 text-[11px]">
                  <span>Cache TTL (seconds):</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{localConfig.cache_ttl_seconds}s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={localConfig.cache_ttl_seconds}
                  onChange={(e) => setLocalConfig(prev => prev ? { ...prev, cache_ttl_seconds: Number(e.target.value) } : null)}
                  className="w-full accent-zinc-800 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Invalidation & Ingest Controls */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full space-y-4 shadow-2xs">
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
              Cache & Write Ingestion
            </h3>

            <div className="space-y-2">
              <span className="text-xs text-zinc-600 block">
                Purge all currently cached query responses to simulate cold-cache behavior.
              </span>
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
                <span>{clearingCache ? 'Purging Cache...' : 'Invalidate Entire Redis Cache'}</span>
              </button>
              {cacheClearMessage && (
                <p className="text-[11px] text-zinc-600 font-mono mt-1">{cacheClearMessage}</p>
              )}
            </div>

            {/* Ingest sensor reading form */}
            <form onSubmit={handleIngest} className="pt-3 border-t border-zinc-100 space-y-2.5">
              <span className="text-xs font-semibold text-zinc-800 block">
                Test Write Ingestion & Invalidation
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-zinc-500 text-[10px] mb-0.5">Device</label>
                  <select
                    value={ingestDevice}
                    onChange={(e) => setIngestDevice(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-md px-2 py-1 text-zinc-900 font-mono text-xs focus:outline-none focus:border-zinc-500"
                  >
                    <option value="DEV-CNC-001">DEV-CNC-001</option>
                    <option value="DEV-FURNACE-001">DEV-FURNACE-001</option>
                    <option value="DEV-PRESS-001">DEV-PRESS-001</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 text-[10px] mb-0.5">Temp (°C)</label>
                  <input
                    type="text"
                    value={ingestTemp}
                    onChange={(e) => setIngestTemp(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-md px-2 py-1 text-zinc-900 font-mono text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-md transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3 h-3 text-zinc-600" />
                <span>Ingest Reading & Invalidate Cache</span>
              </button>
              {ingestMessage && (
                <p className="text-[11px] text-zinc-600 font-mono mt-1">{ingestMessage}</p>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Recommendations Engine Section */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
          <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
            System Optimization Recommendations
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch w-full">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/60 space-y-2.5 text-xs flex flex-col justify-between h-full"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900">{rec.title}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase bg-white text-zinc-700 border border-zinc-200 font-semibold shadow-2xs">
                    {rec.severity}
                  </span>
                </div>
                <p className="text-zinc-600 leading-relaxed text-[11px]">{rec.description}</p>
              </div>

              <div className="pt-2 border-t border-zinc-200/80 text-[11px] space-y-0.5">
                <div>
                  <strong className="text-zinc-800">Benefit: </strong>
                  <span className="text-zinc-600">{rec.estimated_benefit}</span>
                </div>
                <div>
                  <strong className="text-zinc-700">Trade-off: </strong>
                  <span className="text-zinc-500">{rec.risk}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
