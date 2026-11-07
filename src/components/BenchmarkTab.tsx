import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Play,
  RotateCw,
  TrendingDown,
  Clock,
  Zap,
  Activity,
  Sliders,
  CheckCircle2,
  FlaskConical
} from 'lucide-react';
import { BenchmarkRun, PolicyBenchmarkResult, RoutingPolicy } from '../types';
import { runBenchmark } from '../api';

interface BenchmarkTabProps {
  onBenchmarkFinished: () => void;
}

export const BenchmarkTab: React.FC<BenchmarkTabProps> = ({
  onBenchmarkFinished
}) => {
  const [workloadSize, setWorkloadSize] = useState<number>(100);
  const [running, setRunning] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default query mix distribution
  const [latestPct, setLatestPct] = useState<number>(40);
  const [recentPct, setRecentPct] = useState<number>(25);
  const [deepPct, setDeepPct] = useState<number>(15);
  const [edgeAggPct, setEdgeAggPct] = useState<number>(10);
  const [cloudAnalyticsPct, setCloudAnalyticsPct] = useState<number>(10);

  const handleRunBenchmark = async () => {
    setRunning(true);
    setError(null);

    try {
      const config = {
        workload_size: workloadSize,
        concurrency: 1,
        policies: ['cloud_only', 'fixed_rule', 'cache_first', 'adaptive'] as RoutingPolicy[],
        query_distribution: {
          latest_status_pct: latestPct,
          recent_history_pct: recentPct,
          deep_history_pct: deepPct,
          edge_aggregation_pct: edgeAggPct,
          cloud_analytics_pct: cloudAnalyticsPct
        }
      };

      const result = await runBenchmark(config);
      setBenchmarkResult(result);
      onBenchmarkFinished();
    } catch (err: any) {
      setError(err.message || 'Benchmark run failed');
    } finally {
      setRunning(false);
    }
  };

  // Prepare chart comparison data with clean, minimalist naming
  const chartData = benchmarkResult
    ? Object.values(benchmarkResult.results).map((r) => ({
        policy: r.policy === 'cloud_only'
          ? 'Cloud Only'
          : r.policy === 'cache_first'
          ? 'Cache First'
          : r.policy === 'fixed_rule'
          ? 'Fixed Rule'
          : 'Adaptive (Ours)',
        median_ms: r.median_latency_ms,
        p95_ms: r.p95_latency_ms,
        energy_wh: r.total_energy_wh,
        cloud_reqs: r.cloud_executions,
        cache_hits: r.cache_hits
      }))
    : [];

  return (
    <div className="space-y-5 w-full">
      {/* Header and Controls */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 font-semibold">
              <FlaskConical className="w-3.5 h-3.5 text-zinc-600" />
              <span>BENCHMARK SUITE</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950">
              Controlled Benchmark Lab
            </h2>
            <p className="text-xs text-zinc-600 max-w-2xl leading-relaxed">
              Execute controlled workloads comparing <strong>Cloud-Only</strong>, <strong>Cache-First</strong>,
              <strong>Fixed-Rule</strong>, and <strong>Adaptive</strong> routing policies under identical synthetic query mixes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunBenchmark}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {running ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Benchmarking...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current text-white" />
                  <span>Execute Benchmark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Workload Size & Query Mix Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-100 text-xs">
          <div>
            <label className="block text-zinc-600 mb-1 text-[11px] font-medium">Workload Size</label>
            <select
              value={workloadSize}
              onChange={(e) => setWorkloadSize(Number(e.target.value))}
              disabled={running}
              className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-zinc-900 font-mono text-xs focus:outline-none focus:border-zinc-500"
            >
              <option value={50}>50 Requests (Quick Evaluation)</option>
              <option value={100}>100 Requests (Standard Workload)</option>
              <option value={200}>200 Requests (Thorough Stress Test)</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-600 mb-1 text-[11px] font-medium">Latest Status (%)</label>
            <input
              type="number"
              value={latestPct}
              onChange={(e) => setLatestPct(Number(e.target.value))}
              disabled={running}
              className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-zinc-900 font-mono text-xs focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-zinc-600 mb-1 text-[11px] font-medium">Historical Queries (%)</label>
            <input
              type="number"
              value={deepPct}
              onChange={(e) => setDeepPct(Number(e.target.value))}
              disabled={running}
              className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-zinc-900 font-mono text-xs focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-zinc-600 mb-1 text-[11px] font-medium">Aggregations (%)</label>
            <input
              type="number"
              value={edgeAggPct}
              onChange={(e) => setEdgeAggPct(Number(e.target.value))}
              disabled={running}
              className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-zinc-900 font-mono text-xs focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Benchmark Results Section */}
      {!benchmarkResult ? (
        <div className="py-20 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50 w-full">
          <Activity className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="text-xs font-semibold text-zinc-800 mt-2">No Active Benchmark Run</h3>
          <p className="text-[11px] text-zinc-500 mt-1">
            Click "Execute Benchmark" above to run the comparative evaluation across all 4 routing policies.
          </p>
        </div>
      ) : (
        <div className="space-y-5 w-full">
          {/* Key Findings Card */}
          <div className="border border-zinc-200/90 bg-white rounded-xl p-4 w-full shadow-2xs">
            <h3 className="text-xs font-bold text-zinc-900 mb-2 flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Benchmark Analysis & Key Findings</span>
            </h3>
            <ul className="space-y-1 text-xs text-zinc-600 list-disc list-inside">
              {benchmarkResult.analysis.map((line, idx) => (
                <li key={idx} className="leading-relaxed">{line}</li>
              ))}
            </ul>
          </div>

          {/* Visual Comparison Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch w-full">
            {/* Chart 1: Latency Comparison */}
            <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full shadow-2xs">
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                  Median & p95 Response Latency
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Lower is better (milliseconds)</p>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="policy" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} unit="ms" tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '11px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                    <Bar dataKey="median_ms" name="Median Latency (ms)" fill="#18181b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="p95_ms" name="p95 Latency (ms)" fill="#64748b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Energy Comparison */}
            <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full shadow-2xs">
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                  Total Workload Energy Dissipation
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Lower is better (Watt-hours)</p>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="policy" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} unit="Wh" tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '11px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                    />
                    <Bar dataKey="energy_wh" name="Energy (Wh)" fill="#475569" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Granular Comparison Table */}
          <div className="border border-zinc-200/90 bg-white rounded-xl overflow-hidden w-full shadow-2xs">
            <div className="p-4 border-b border-zinc-200">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                Full Comparative Benchmark Metrics
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">Tested across {workloadSize} deterministic requests per policy</p>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#f8f9fa] text-zinc-500 uppercase tracking-wider border-b border-zinc-200 text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Policy</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Cache Hits</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Edge Exec</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Cloud Exec</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Median Latency</th>
                    <th className="py-2.5 px-4 font-semibold text-right">p95 Latency</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Total Energy</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Energy / Req</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Energy Saved</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Cloud Reduced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700 text-[11px]">
                  {Object.values(benchmarkResult.results).map((res) => {
                    const isAdaptive = res.policy === 'adaptive';
                    return (
                      <tr
                        key={res.policy}
                        className={`hover:bg-zinc-50/80 transition-colors ${
                          isAdaptive ? 'bg-zinc-50/80 font-bold text-zinc-950' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 uppercase">
                          {res.policy}
                          {isAdaptive && <span className="ml-1 text-[9px] bg-zinc-900 text-white px-1.5 py-0.5 rounded">Ours</span>}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-zinc-600">{res.cache_hits}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-zinc-600">{res.edge_executions}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-zinc-600">{res.cloud_executions}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{res.median_latency_ms} ms</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{res.p95_latency_ms} ms</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{res.total_energy_wh} Wh</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{res.energy_per_successful_req_mwh} mWh</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700 font-bold">
                          {res.energy_reduction_pct}%
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-zinc-800 font-medium">
                          {res.cloud_workload_reduction_pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
