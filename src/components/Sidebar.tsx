import React from 'react';
import {
  LayoutDashboard,
  Terminal,
  Network,
  Zap,
  FlaskConical,
  Sliders,
  FileCode,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Cpu,
  Globe,
  Leaf,
  Radio
} from 'lucide-react';
import { SimulationConfig } from '../types';
import { QueryLeafLogo } from './QueryLeafLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  config: SimulationConfig | null;
  onQuickRun: () => void;
  onRefresh: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  config,
  onQuickRun,
  onRefresh
}) => {
  const mainNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'telemetry', label: 'Telemetry & Datasets', icon: Radio },
    { id: 'query', label: 'Query Explorer', icon: Terminal },
    { id: 'routing', label: 'Routing Decisions', icon: Network },
    { id: 'energy', label: 'Energy & Carbon', icon: Zap },
    { id: 'benchmark', label: 'Benchmark Lab', icon: FlaskConical }
  ];

  const systemNavItems = [
    { id: 'simulation', label: 'Simulation Controls', icon: Sliders },
    { id: 'docs', label: 'System Architecture', icon: FileCode }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/30 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container - Clean White / Off-white theme (ChatGPT Light Style) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#fbfbfb] border-r border-zinc-200 text-zinc-700 transition-all duration-200 ease-in-out lg:static ${
          isMobileOpen
            ? 'translate-x-0 w-64 shadow-xl'
            : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}`}
      >
        {/* Top Header: Brand & Collapse Toggle */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-zinc-200/80 shrink-0 bg-white">
          {!isCollapsed ? (
            <QueryLeafLogo size="sm" showText={true} subtitle="IoT Gateway v1.0" />
          ) : (
            <div className="mx-auto">
              <QueryLeafLogo size="sm" showText={false} />
            </div>
          )}

          {/* Collapse Button (desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Close button on mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="flex lg:hidden items-center justify-center w-7 h-7 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Button: "+ New Test Query" (ChatGPT Light style) */}
        <div className="p-2.5 shrink-0">
          <button
            onClick={() => {
              onQuickRun();
              if (isMobileOpen) setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all border cursor-pointer ${
              isCollapsed
                ? 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 shadow-2xs'
                : 'bg-white hover:bg-zinc-50 border-zinc-200/90 hover:border-zinc-300 text-zinc-800 shadow-2xs'
            }`}
            title="Execute Test Query"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
            {!isCollapsed && <span className="truncate">New Test Query</span>}
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
          {/* Main Navigation Group */}
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                Gateway & Telemetry
              </div>
            )}
            <nav className="space-y-0.5">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left relative ${
                      isActive
                        ? 'bg-white text-zinc-950 font-semibold border border-zinc-200/90 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 border border-transparent'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-zinc-900' : 'text-zinc-500'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !isCollapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-zinc-900" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* System Settings Group */}
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                Settings & Docs
              </div>
            )}
            <nav className="space-y-0.5">
              {systemNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left relative ${
                      isActive
                        ? 'bg-white text-zinc-950 font-semibold border border-zinc-200/90 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 border border-transparent'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-zinc-900' : 'text-zinc-500'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !isCollapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-zinc-900" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Sidebar: System Status & Refresh in White Theme */}
        <div className="p-2.5 border-t border-zinc-200 bg-white shrink-0">
          {!isCollapsed ? (
            <div className="space-y-2">
              {config && (
                <div className="bg-[#f8f9fa] rounded-lg p-2.5 border border-zinc-200/80 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Policy</span>
                    <span className="text-zinc-900 uppercase font-semibold">
                      {config.active_policy}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-zinc-400" /> Edge CPU
                    </span>
                    <span className="text-zinc-800 tabular-nums font-medium">
                      {config.edge_cpu_utilization_pct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-zinc-400" /> WAN RTT
                    </span>
                    <span className="text-zinc-800 tabular-nums font-medium">
                      {config.cloud_network_rtt_ms}ms
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-0.5 px-1">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Gateway Live</span>
                </div>
                <button
                  onClick={onRefresh}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Refresh Telemetry"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <span
                className="w-2.5 h-2.5 rounded-full bg-emerald-500"
                title="Gateway Live"
              />
              <button
                onClick={onRefresh}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Refresh Telemetry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
