import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import {
  Layers,
  Cpu,
  Globe,
  Database,
  Sliders,
  Network
} from 'lucide-react';
import { RouteMetricsResponse, SimulationConfig, TelemetryItem } from '../types';

interface RoutingAnalyticsTabProps {
  routes: RouteMetricsResponse | null;
  queries: TelemetryItem[];
  config: SimulationConfig | null;
  onNavigateTab: (tab: string) => void;
}

export const RoutingAnalyticsTab: React.FC<RoutingAnalyticsTabProps> = ({
  routes,
  queries,
  config,
  onNavigateTab
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const filteredQueries = selectedCategoryFilter === 'all'
    ? queries
    : queries.filter(q => q.query_category === selectedCategoryFilter);

  // Group queries into time buckets for the decisions over time line chart
  const timelineData = [...queries].reverse().slice(0, 30).map((q, idx) => ({
    index: idx + 1,
    latency: q.duration_ms,
    path: q.execution_path,
    category: q.query_category
  }));

  return (
    <div className="space-y-5 w-full">
      {/* Header explanation */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 font-semibold">
              <Network className="w-3.5 h-3.5" />
              <span>ROUTING FABRIC</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight mt-0.5">
              Adaptive Routing Decision Analytics
            </h2>
            <p className="text-xs text-zinc-600 mt-1 max-w-2xl leading-relaxed">
              Every inbound IoT request undergoes hard SLA constraint evaluation (freshness deadline, data availability)
              followed by multi-objective cost optimization J(route) = α·L + β·E + γ·C across eligible paths.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('simulation')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 rounded-md border border-zinc-200 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-500" />
              <span>Tune α, β, γ Weights</span>
            </button>
          </div>
        </div>
      </div>

      {/* Execution Path Cards (3 Equal Height Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch w-full">
        {/* Cache Path Card */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">Local RAM Cache</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-medium">
                Freshness SLA
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Deterministic Key</span>
                <span className="text-zinc-800 font-mono text-[11px]">gw:query:&lt;cat&gt;:&lt;dev&gt;</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Typical Retrieval</span>
                <span className="text-zinc-900 font-mono font-medium">1.5 - 2.5 ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Power Overhead</span>
                <span className="text-zinc-900 font-mono font-medium">{config?.cache_power_watts || 2.2} W (DRAM)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Disqualification</span>
                <span className="text-zinc-700 font-mono text-[11px]">age &gt; max_age_seconds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edge MongoDB Card */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">Edge MongoDB Node</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-medium">
                ≤ 24h Window
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Current Edge CPU</span>
                <span className="text-zinc-900 font-mono font-medium">{config?.edge_cpu_utilization_pct}% Load</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Typical Retrieval</span>
                <span className="text-zinc-900 font-mono font-medium">12 - 35 ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Power Overhead</span>
                <span className="text-zinc-900 font-mono font-medium">{config?.edge_power_watts || 8.5} W base</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Disqualification</span>
                <span className="text-zinc-700 font-mono text-[11px]">start_time &gt; 24h or overload</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cloud Warehouse Card */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">Cloud Warehouse</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-medium">
                Authoritative 30d
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Simulated WAN RTT</span>
                <span className="text-zinc-900 font-mono font-medium">{config?.cloud_network_rtt_ms} ms roundtrip</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Typical Retrieval</span>
                <span className="text-zinc-900 font-mono font-medium">75 - 130 ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Power + WAN Energy</span>
                <span className="text-zinc-900 font-mono font-medium">45 W + 0.052 Wh/MB</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Disqualification</span>
                <span className="text-zinc-700 font-mono text-[11px]">WAN RTT &gt; strict deadline</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latency History Timeline Chart */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
              Query Latency Timeline
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Response time across sequential requests</p>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-zinc-50 rounded-lg border border-zinc-200 text-xs font-medium overflow-x-auto">
            {['all', 'latest_status', 'recent_history', 'edge_aggregation', 'deep_history', 'cloud_analytics'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-white text-zinc-950 font-semibold shadow-2xs border border-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="index" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} unit="ms" tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '11px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                formatter={(val: any, name: any, item: any) => [
                  `${val} ms (${item.payload.path.toUpperCase()})`,
                  `Latency`
                ]}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#18181b"
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: '#18181b' }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Decision Rationale Detailed Table */}
      <div className="border border-zinc-200/90 bg-white rounded-xl overflow-hidden w-full shadow-2xs">
        <div className="p-4 border-b border-zinc-200">
          <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
            Routing Decision Records
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Auditable trace of routing resolutions</p>
        </div>

        <div className="overflow-x-auto max-h-96 w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fa] sticky top-0 text-zinc-500 font-mono uppercase tracking-wider border-b border-zinc-200 z-10 text-[10px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Request ID</th>
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold">Route</th>
                <th className="py-2.5 px-4 font-semibold text-right">Duration</th>
                <th className="py-2.5 px-4 font-semibold text-right">Energy</th>
                <th className="py-2.5 px-4 font-semibold">Decision Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-mono text-[11px]">
              {filteredQueries.map((q) => {
                return (
                  <tr key={q.request_id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-2 px-4 text-zinc-500">
                      {new Date(q.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-4 text-zinc-600">
                      {q.request_id}
                    </td>
                    <td className="py-2 px-4 text-zinc-900 font-medium">
                      {q.query_category}
                    </td>
                    <td className="py-2 px-4 uppercase">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] font-semibold border border-zinc-200">
                        {q.execution_path}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-zinc-900 font-medium">
                      {q.duration_ms} ms
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-zinc-800">
                      {(q.estimated_energy_wh * 1000).toFixed(3)} mWh
                    </td>
                    <td className="py-2 px-4 font-sans text-zinc-500 max-w-sm truncate" title={q.decision_reason}>
                      {q.decision_reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
