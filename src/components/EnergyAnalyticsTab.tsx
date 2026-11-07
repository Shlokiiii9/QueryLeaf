import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Zap,
  Leaf,
  Cpu,
  Globe,
  Sliders,
  Info,
  Layers,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { EnergyMetricsResponse, OverviewMetrics, SimulationConfig } from '../types';

interface EnergyAnalyticsTabProps {
  energyMetrics: EnergyMetricsResponse | null;
  overview: OverviewMetrics | null;
  config: SimulationConfig | null;
  onUpdateConfig: (updates: Partial<SimulationConfig>) => void;
}

export const EnergyAnalyticsTab: React.FC<EnergyAnalyticsTabProps> = ({
  energyMetrics,
  overview,
  config,
  onUpdateConfig
}) => {
  const [sliderIntensity, setSliderIntensity] = useState<number>(
    config?.carbon_intensity_g_per_kwh || 385
  );

  const handleIntensityChange = (val: number) => {
    setSliderIntensity(val);
    onUpdateConfig({ carbon_intensity_g_per_kwh: val });
  };

  const categoryData = energyMetrics?.by_category
    ? Object.entries(energyMetrics.by_category).map(([cat, stats]) => ({
        category: cat,
        total_energy_wh: stats.total_energy_wh,
        avg_energy_wh: stats.avg_energy_wh * 1000, // display in mWh
        count: stats.count
      }))
    : [];

  const carbonRecalculatedG = overview?.energy.total_wh
    ? Math.round(((overview.energy.total_wh / 1000) * sliderIntensity) * 10000) / 10000
    : 0;

  return (
    <div className="space-y-5 w-full">
      {/* Energy Hero Banner */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 font-semibold">
              <Zap className="w-3.5 h-3.5 text-zinc-600" />
              <span>THERMODYNAMIC ENERGY MODEL</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950">
              QueryLeaf Energy & Sustainability Engine
            </h2>
            <p className="text-xs text-zinc-600 max-w-2xl leading-relaxed">
              Distinguishing compute wattage, memory DRAM power, and WAN payload transmission energy.
              Every query execution route is measured against thermodynamic power formulas rather than arbitrary scores.
            </p>
          </div>

          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 flex flex-col justify-center min-w-[220px] shrink-0">
            <span className="text-[11px] text-zinc-500 font-mono">Total Workload Energy</span>
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900 font-mono tabular-nums mt-0.5">
              {overview?.energy.total_wh || 0} <span className="text-xs font-normal text-zinc-500">Wh</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
              ~{overview?.energy.energy_per_successful_req_wh ? (overview.energy.energy_per_successful_req_wh * 1000).toFixed(2) : 0} mWh / query
            </span>
          </div>
        </div>
      </div>

      {/* Physics Formula Explanation Box */}
      <div className="border border-zinc-200/90 bg-white rounded-xl p-5 w-full shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-zinc-100 text-zinc-800 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-2 text-xs text-zinc-700 w-full">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">
              Thermodynamic & Network Attributed Formulas
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5 font-mono items-stretch">
              <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 flex flex-col justify-between h-full">
                <span className="text-zinc-900 font-bold block text-xs">1. Compute Energy (DRAM / SoC / Cloud VM)</span>
                <span className="text-zinc-800 mt-1.5 block text-xs font-medium">E_compute (Wh) = Power (W) × Duration (s) / 3600</span>
                <span className="text-zinc-500 text-[10px] mt-1.5 block pt-1.5 border-t border-zinc-200">
                  Edge dynamic power scales with CPU%: P = P_base × (1 + 0.8·CPU%)
                </span>
              </div>
              <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 flex flex-col justify-between h-full">
                <span className="text-zinc-900 font-bold block text-xs">2. WAN Network Transmission Energy</span>
                <span className="text-zinc-800 mt-1.5 block text-xs font-medium">E_wan (Wh) = Payload (MB) × {config?.network_energy_per_mb_wh || 0.052} Wh/MB</span>
                <span className="text-zinc-500 text-[10px] mt-1.5 block pt-1.5 border-t border-zinc-200">
                  Zero network transfer overhead for local RAM Cache & Edge DB
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch w-full">
        {/* Category Breakdown Chart */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                  Average Energy by Query Category
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Energy consumed per query in milliWatt-hours (mWh)</p>
              </div>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} unit="mWh" tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '11px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' }}
                    formatter={(val: any) => [`${Number(val).toFixed(3)} mWh`, 'Avg Energy']}
                  />
                  <Bar dataKey="avg_energy_wh" fill="#475569" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 mt-3 pt-2.5 border-t border-zinc-100">
            Note: <strong className="text-zinc-800">cloud_analytics</strong> incurs WAN transmission energy, whereas <strong className="text-zinc-800">latest_status</strong> is dominated by low-power cache hits.
          </p>
        </div>

        {/* Interactive Carbon Intensity Simulator */}
        <div className="border border-zinc-200/90 bg-white rounded-xl p-5 flex flex-col justify-between h-full space-y-4 shadow-2xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono">
                  Carbon Sensitivity Calculator
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Adjust regional electricity grid emissions factor</p>
              </div>
              <Sliders className="w-3.5 h-3.5 text-zinc-500" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-600">Grid Carbon Intensity:</span>
                <span className="text-zinc-950 font-bold">{sliderIntensity} gCO2e / kWh</span>
              </div>
              <input
                type="range"
                min="50"
                max="850"
                step="25"
                value={sliderIntensity}
                onChange={(e) => handleIntensityChange(Number(e.target.value))}
                className="w-full accent-zinc-800 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>50 (Hydro/Wind)</span>
                <span>385 (Global Avg)</span>
                <span>850 (Coal Heavy)</span>
              </div>
            </div>
          </div>

          {/* Calculated Emissions Display */}
          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600 font-sans">Calculated CO2e Emissions:</span>
              <span className="text-base font-bold text-zinc-950 tabular-nums">
                {carbonRecalculatedG} gCO2e
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-zinc-200 pt-2">
              <span className="text-zinc-500 font-sans">Cloud-Only Equivalent:</span>
              <span className="text-zinc-700 tabular-nums">
                {overview?.energy.baseline_cloud_energy_wh
                  ? Math.round(((overview.energy.baseline_cloud_energy_wh / 1000) * sliderIntensity) * 10000) / 10000
                  : 0} gCO2e
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-zinc-200 pt-2">
              <span className="text-emerald-700 font-semibold font-sans">Avoided Carbon Emissions:</span>
              <span className="text-emerald-700 font-bold tabular-nums">
                {overview?.energy.baseline_cloud_energy_wh
                  ? Math.max(
                      0,
                      Math.round(
                        (((overview.energy.baseline_cloud_energy_wh - overview.energy.total_wh) / 1000) * sliderIntensity) * 10000
                      ) / 10000
                    )
                  : 0} gCO2e
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
