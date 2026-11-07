import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  Cpu,
  Cloud,
  Database,
  Zap,
  TrendingDown,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Server,
  Leaf
} from 'lucide-react';
import { OverviewMetrics, RouteMetricsResponse, DeviceInfo } from '../types';
import { InteractiveTopology } from './InteractiveTopology';
import { FleetMonitor } from './FleetMonitor';

interface OverviewTabProps {
  overview: OverviewMetrics | null;
  routes: RouteMetricsResponse | null;
  devices: DeviceInfo[];
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
  onSelectDeviceForQuery: (deviceId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  overview,
  routes,
  devices,
  onNavigateTab,
  onRefresh,
  onSelectDeviceForQuery
}) => {
  if (!overview) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 border-t-zinc-800"></div>
        <p className="mt-4 text-xs font-mono text-zinc-500">Connecting to gateway telemetry...</p>
      </div>
    );
  }

  // Refined palette for clean white background: high contrast, easy on eyes
  const routeChartData = [
    { name: 'Cache (RAM)', count: overview.route_breakdown.cache, color: '#10b981' },
    { name: 'Edge (MongoDB)', count: overview.route_breakdown.edge, color: '#64748b' },
    { name: 'Cloud (WAN)', count: overview.route_breakdown.cloud, color: '#1e293b' }
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Top Hero Card - White Theme */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-6 relative overflow-hidden w-full shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-700">Smart IoT Energy-Aware Gateway Fabric</span>
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-500">Live Production Telemetry</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
              Adaptive Execution Routing for Constrained IoT
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
              Dynamically evaluates request freshness constraints, edge resource saturation,
              and WAN network overhead to route sensor queries across local DRAM cache, edge-hosted MongoDB,
              and cloud storage with minimal energy consumption.
            </p>
          </div>

          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 lg:border-l border-zinc-200 pt-4 lg:pt-0 lg:pl-8 gap-1 shrink-0">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">Energy Saved</span>
            <div className="flex items-baseline gap-1 text-3xl sm:text-4xl font-bold text-zinc-900 font-mono tabular-nums">
              <TrendingDown className="w-5 h-5 text-emerald-600 inline" />
              <span>{overview.energy.energy_saved_pct}%</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono text-right">
              Saved <strong className="text-zinc-900 font-semibold">{Math.max(0, Math.round((overview.energy.baseline_cloud_energy_wh - overview.energy.total_wh) * 1000) / 1000)} Wh</strong> vs Cloud baseline
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 3-Tier Visual Topology */}
      <InteractiveTopology
        activePath={(routes?.recent_decisions[0]?.execution_path) || 'cache'}
        latencyMs={routes?.recent_decisions[0]?.duration_ms}
      />

      {/* Primary KPI Grid (Clean White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch w-full">
        {/* Metric 1 */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-4 sm:p-5 hover:border-zinc-300 transition-colors flex flex-col justify-between h-full shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total Queries Processed</span>
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-950 font-mono tabular-nums">
            {overview.total_requests}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-100">
            {overview.successful_requests} ok · {overview.error_rate_pct}% errors
          </div>
        </div>

        {/* Metric 2 */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-4 sm:p-5 hover:border-zinc-300 transition-colors flex flex-col justify-between h-full shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Cache Hit Ratio</span>
            <Database className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-950 font-mono tabular-nums">
            {overview.route_breakdown.cache_hit_rate_pct}%
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-100">
            {overview.route_breakdown.cache} queries served from RAM
          </div>
        </div>

        {/* Metric 3 */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-4 sm:p-5 hover:border-zinc-300 transition-colors flex flex-col justify-between h-full shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Median / p95 Latency</span>
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-950 font-mono tabular-nums">
            {overview.latency.median_ms} <span className="text-xs font-normal text-zinc-400">/ {overview.latency.p95_ms} ms</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-100">
            Sub-2ms RAM to ~75ms WAN
          </div>
        </div>

        {/* Metric 4 */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-4 sm:p-5 hover:border-zinc-300 transition-colors flex flex-col justify-between h-full shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Carbon Footprint</span>
            <Leaf className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-950 font-mono tabular-nums">
            {overview.energy.total_carbon_g} <span className="text-xs font-normal text-zinc-400">gCO2e</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-100">
            {overview.energy.total_wh} Wh workload total
          </div>
        </div>
      </div>

      {/* Two Column Section: Path Distribution & Latency Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        {/* Left: Execution Route Distribution */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 lg:col-span-5 flex flex-col justify-between h-full shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                Execution Path Distribution
              </h3>
              <button
                onClick={() => onNavigateTab('routing')}
                className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>Audit</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">Breakdown of gateway query resolutions</p>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={routeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {routeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '11px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-100 text-xs font-mono">
            {routeChartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: item.color }} />
                  <span className="text-zinc-600">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 tabular-nums">
                  <span className="text-zinc-900 font-semibold">{item.count}</span>
                  <span>({overview.total_requests > 0 ? Math.round((item.count / overview.total_requests) * 100) : 0}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Path Latency Comparison Bar */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 lg:col-span-7 flex flex-col justify-between h-full shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                  Observed Latency by Route Tier
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Average roundtrip query response time (milliseconds)</p>
              </div>
              <button
                onClick={() => onNavigateTab('benchmark')}
                className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>Benchmark</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="h-50 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={routes?.distribution || []}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} unit="ms" tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '11px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                    formatter={(val: any) => [`${val} ms`, 'Avg Latency']}
                  />
                  <Bar dataKey="avg_latency_ms" fill="#475569" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-100 text-xs">
            <div>
              <span className="text-zinc-500 block font-mono text-[10px] uppercase">RAM Cache</span>
              <span className="text-zinc-900 font-mono font-semibold tabular-nums mt-0.5 block">
                ~1.5 - 2.5 ms
              </span>
              <span className="text-zinc-400 text-[10px]">Direct RAM lookup</span>
            </div>
            <div>
              <span className="text-zinc-500 block font-mono text-[10px] uppercase">Edge MongoDB</span>
              <span className="text-zinc-800 font-mono font-semibold tabular-nums mt-0.5 block">
                ~12 - 25 ms
              </span>
              <span className="text-zinc-400 text-[10px]">Local cluster query</span>
            </div>
            <div>
              <span className="text-zinc-500 block font-mono text-[10px] uppercase">Cloud Warehouse</span>
              <span className="text-zinc-700 font-mono font-semibold tabular-nums mt-0.5 block">
                ~75 - 120 ms
              </span>
              <span className="text-zinc-400 text-[10px]">WAN roundtrip delay</span>
            </div>
          </div>
        </div>
      </div>

      {/* Industrial Machine Fleet Telemetry Grid */}
      <FleetMonitor
        devices={devices}
        onSelectDeviceForQuery={(devId) => {
          onSelectDeviceForQuery(devId);
          onNavigateTab('query');
        }}
      />

      {/* Recent Routing Decisions Audit Stream */}
      <div className="border border-zinc-200/90 bg-white rounded-xl overflow-hidden w-full shadow-2xs">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
              Live Decision Audit Log
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time trace generated by the multi-objective decision engine</p>
          </div>
          <button
            onClick={() => onNavigateTab('routing')}
            className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fa] text-zinc-500 font-mono uppercase tracking-wider border-b border-zinc-200 text-[10px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Request ID</th>
                <th className="py-2.5 px-4 font-semibold">Query Category</th>
                <th className="py-2.5 px-4 font-semibold">Route Selected</th>
                <th className="py-2.5 px-4 font-semibold text-right">Latency</th>
                <th className="py-2.5 px-4 font-semibold">Routing Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {(routes?.recent_decisions || []).slice(0, 6).map((item) => {
                return (
                  <tr key={item.request_id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-zinc-500">
                      {item.request_id}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-zinc-800 font-medium">{item.query_category}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono uppercase">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] font-semibold border border-zinc-200">
                        {item.execution_path}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-right tabular-nums text-zinc-900 font-medium">
                      {item.duration_ms} ms
                    </td>
                    <td className="py-2.5 px-4 text-zinc-500 max-w-md truncate" title={item.reason}>
                      {item.reason}
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
