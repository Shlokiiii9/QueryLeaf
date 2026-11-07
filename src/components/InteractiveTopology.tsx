import React from 'react';
import { Database, Cpu, Globe, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { ExecutionPath } from '../types';
import { QueryLeafLogo } from './QueryLeafLogo';

interface InteractiveTopologyProps {
  activePath?: ExecutionPath;
  latencyMs?: number;
  energyWh?: number;
}

export const InteractiveTopology: React.FC<InteractiveTopologyProps> = ({
  activePath = 'cache',
  latencyMs,
  energyWh
}) => {
  return (
    <div className="border border-zinc-200/90 bg-white rounded-xl p-5 relative overflow-hidden w-full shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="uppercase tracking-wider font-semibold">Live Execution Topology</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight mt-0.5">
            Three-Tier Dynamic Routing Fabric
          </h3>
        </div>

        {latencyMs !== undefined && (
          <div className="flex items-center gap-2.5 text-xs font-mono bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200 shrink-0">
            <span className="text-zinc-500">Last Routed:</span>
            <span className="font-semibold uppercase text-zinc-900">{activePath}</span>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-800 tabular-nums font-medium">{latencyMs} ms</span>
            {energyWh !== undefined && (
              <>
                <span className="text-zinc-300">·</span>
                <span className="text-zinc-700 tabular-nums font-medium">{(energyWh * 1000).toFixed(3)} mWh</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Visual Diagram - Clean White & Soft Gray Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10 items-stretch">
        {/* Tier 0: Inbound Request Gateway */}
        <div className="p-4 rounded-lg bg-zinc-50/60 border border-zinc-200 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-2">
              <span className="font-semibold text-zinc-600">INGRESS</span>
              <span className="text-[10px] bg-white text-zinc-700 px-1.5 py-0.5 rounded font-mono border border-zinc-200 shadow-2xs">SLA Gate</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <QueryLeafLogo size="xs" showText={false} />
              <h4 className="text-xs font-bold text-zinc-900">QueryLeaf Gateway</h4>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed">
              Validates category, checks cache freshness, evaluates edge saturation, and computes objective J(route).
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-200/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>SLA: Freshness & Deadline</span>
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
          </div>
        </div>

        {/* Tier 1: Local RAM Cache */}
        <div
          className={`p-4 rounded-lg border transition-all flex flex-col justify-between h-full ${
            activePath === 'cache'
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs ring-1 ring-zinc-900/10'
              : 'bg-zinc-50/60 border-zinc-200 text-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono mb-2">
              <span className={activePath === 'cache' ? 'text-zinc-200 font-semibold' : 'text-zinc-500 font-medium'}>
                TIER 1 · RAM
              </span>
              <span className={`text-[10px] font-mono ${activePath === 'cache' ? 'text-zinc-300' : 'text-zinc-500'}`}>~1-2 ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className={`w-3.5 h-3.5 ${activePath === 'cache' ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <h4 className={`text-xs font-bold ${activePath === 'cache' ? 'text-white' : 'text-zinc-900'}`}>Redis Cache</h4>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${activePath === 'cache' ? 'text-zinc-300' : 'text-zinc-600'}`}>
              In-memory DRAM lookup for repeated polling. Serves sub-millisecond responses at 2.2W power.
            </p>
          </div>

          <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[10px] font-mono ${activePath === 'cache' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200/80 text-zinc-500'}`}>
            <span>Energy Factor</span>
            <span className={activePath === 'cache' ? 'text-zinc-200 font-semibold' : 'text-zinc-800 font-semibold'}>~0.000001 Wh</span>
          </div>
        </div>

        {/* Tier 2: Edge Database */}
        <div
          className={`p-4 rounded-lg border transition-all flex flex-col justify-between h-full ${
            activePath === 'edge'
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs ring-1 ring-zinc-900/10'
              : 'bg-zinc-50/60 border-zinc-200 text-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono mb-2">
              <span className={activePath === 'edge' ? 'text-zinc-200 font-semibold' : 'text-zinc-500 font-medium'}>
                TIER 2 · EDGE
              </span>
              <span className={`text-[10px] font-mono ${activePath === 'edge' ? 'text-zinc-300' : 'text-zinc-500'}`}>~15-25 ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className={`w-3.5 h-3.5 ${activePath === 'edge' ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <h4 className={`text-xs font-bold ${activePath === 'edge' ? 'text-white' : 'text-zinc-900'}`}>Edge MongoDB</h4>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${activePath === 'edge' ? 'text-zinc-300' : 'text-zinc-600'}`}>
              Local factory node storing last 24h of telemetry. Operates locally with zero WAN roundtrip delay.
            </p>
          </div>

          <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[10px] font-mono ${activePath === 'edge' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200/80 text-zinc-500'}`}>
            <span>Energy Factor</span>
            <span className={activePath === 'edge' ? 'text-zinc-200 font-semibold' : 'text-zinc-800 font-semibold'}>~0.000045 Wh</span>
          </div>
        </div>

        {/* Tier 3: Cloud Data Warehouse */}
        <div
          className={`p-4 rounded-lg border transition-all flex flex-col justify-between h-full ${
            activePath === 'cloud'
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs ring-1 ring-zinc-900/10'
              : 'bg-zinc-50/60 border-zinc-200 text-zinc-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono mb-2">
              <span className={activePath === 'cloud' ? 'text-zinc-200 font-semibold' : 'text-zinc-500 font-medium'}>
                TIER 3 · CLOUD
              </span>
              <span className={`text-[10px] font-mono ${activePath === 'cloud' ? 'text-zinc-300' : 'text-zinc-500'}`}>~75-120 ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className={`w-3.5 h-3.5 ${activePath === 'cloud' ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <h4 className={`text-xs font-bold ${activePath === 'cloud' ? 'text-white' : 'text-zinc-900'}`}>Cloud Warehouse</h4>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${activePath === 'cloud' ? 'text-zinc-300' : 'text-zinc-600'}`}>
              Authoritative multi-week repository for deep historical analytics and complex cross-plant queries.
            </p>
          </div>

          <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[10px] font-mono ${activePath === 'cloud' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200/80 text-zinc-500'}`}>
            <span>Energy Factor</span>
            <span className={activePath === 'cloud' ? 'text-zinc-200 font-semibold' : 'text-zinc-800 font-semibold'}>~0.001150 Wh</span>
          </div>
        </div>
      </div>
    </div>
  );
};
