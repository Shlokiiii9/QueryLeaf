import React from 'react';
import {
  PanelLeft,
  RefreshCw,
  Play
} from 'lucide-react';
import { SimulationConfig } from '../types';
import { QueryLeafLogo } from './QueryLeafLogo';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: SimulationConfig | null;
  onQuickRun: () => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  onOpenMobileSidebar: () => void;
  onRefresh: () => void;
}

const tabTitles: Record<string, string> = {
  overview: 'Overview',
  telemetry: 'Telemetry & Datasets',
  routing: 'Routing Decisions',
  energy: 'Energy & Carbon',
  query: 'Query Explorer',
  benchmark: 'Benchmark Lab',
  simulation: 'Simulation Controls',
  docs: 'System Architecture'
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  config,
  onQuickRun,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  onOpenMobileSidebar,
  onRefresh
}) => {
  return (
    <header className="h-14 border-b border-zinc-200/90 bg-white/90 backdrop-blur sticky top-0 z-30 w-full flex items-center justify-between px-3 sm:px-6 shadow-2xs">
      {/* Left: Sidebar Toggle Button + Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Toggle on desktop */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Toggle on mobile / tablet */}
        <button
          onClick={onOpenMobileSidebar}
          className="flex lg:hidden items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <QueryLeafLogo size="xs" showText={false} />
            <span className="text-zinc-600 font-semibold hidden sm:inline">QueryLeaf</span>
          </div>
          <span className="text-zinc-300 hidden sm:inline">/</span>
          <span className="text-zinc-900 font-semibold tracking-tight text-xs sm:text-sm">
            {tabTitles[activeTab] || 'Dashboard'}
          </span>
        </div>
      </div>

      {/* Right: Clean Minimal Status & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Minimalist Live Status Stats */}
        {config && (
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-zinc-600 bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200">
            <span className="flex items-center gap-1.5 font-medium text-zinc-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{config.active_policy}</span>
            </span>
            <span className="text-zinc-300">|</span>
            <span>Edge: <strong className="text-zinc-900 tabular-nums">{config.edge_cpu_utilization_pct}%</strong></span>
            <span className="text-zinc-300">|</span>
            <span>WAN: <strong className="text-zinc-900 tabular-nums">{config.cloud_network_rtt_ms}ms</strong></span>
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Refresh Telemetry"
          aria-label="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Quick Test Query button */}
        <button
          onClick={onQuickRun}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
        >
          <Play className="w-3 h-3 fill-current text-white" />
          <span>Test Query</span>
        </button>
      </div>
    </header>
  );
};
