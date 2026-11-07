/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { RoutingAnalyticsTab } from './components/RoutingAnalyticsTab';
import { EnergyAnalyticsTab } from './components/EnergyAnalyticsTab';
import { QueryExplorerTab } from './components/QueryExplorerTab';
import { BenchmarkTab } from './components/BenchmarkTab';
import { SimulationConfigTab } from './components/SimulationConfigTab';
import { ArchitectureDocsTab } from './components/ArchitectureDocsTab';
import { TelemetryHubTab } from './components/TelemetryHubTab';
import { QueryLeafLogo } from './components/QueryLeafLogo';
import {
  OverviewMetrics,
  RouteMetricsResponse,
  EnergyMetricsResponse,
  TelemetryItem,
  Recommendation,
  SimulationConfig,
  DeviceInfo
} from './types';
import {
  fetchOverviewMetrics,
  fetchRouteMetrics,
  fetchEnergyMetrics,
  fetchTelemetryQueries,
  fetchRecommendations,
  fetchSimulationConfig,
  updateSimulationConfig,
  fetchDevices
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('DEV-CNC-001');

  // Collapsing sidebar state (ChatGPT style)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Core Data States
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [routes, setRoutes] = useState<RouteMetricsResponse | null>(null);
  const [energyMetrics, setEnergyMetrics] = useState<EnergyMetricsResponse | null>(null);
  const [queries, setQueries] = useState<TelemetryItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);

  // Load all telemetry and data from the Gateway API
  const refreshData = async () => {
    try {
      const [
        overviewRes,
        routesRes,
        energyRes,
        queriesRes,
        recRes,
        configRes,
        devicesRes
      ] = await Promise.all([
        fetchOverviewMetrics(),
        fetchRouteMetrics(),
        fetchEnergyMetrics(),
        fetchTelemetryQueries(50),
        fetchRecommendations(),
        fetchSimulationConfig(),
        fetchDevices()
      ]);

      setOverview(overviewRes);
      setRoutes(routesRes);
      setEnergyMetrics(energyRes);
      setQueries(queriesRes.queries);
      setRecommendations(recRes.recommendations);
      setConfig(configRes);
      setDevices(devicesRes.devices);
    } catch (err) {
      console.error('[QueryLeaf] Failed to load gateway telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleUpdateConfig = async (updates: Partial<SimulationConfig>) => {
    try {
      const res = await updateSimulationConfig(updates);
      setConfig(res.config);
      refreshData();
    } catch (err) {
      console.error('[QueryLeaf] Failed to update simulation config:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex font-sans selection:bg-zinc-200 selection:text-zinc-900 w-full overflow-x-hidden antialiased">
      {/* Collapsible ChatGPT-style Sidebar in Light Theme */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        config={config}
        onQuickRun={() => setActiveTab('query')}
        onRefresh={refreshData}
      />

      {/* Main Content Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-[#fafafa]">
        {/* Top Minimalist Light Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          config={config}
          onQuickRun={() => setActiveTab('query')}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onRefresh={refreshData}
        />

        {/* Tab Content Container */}
        <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 md:px-8 py-6">
          {activeTab === 'overview' && (
            <OverviewTab
              overview={overview}
              routes={routes}
              devices={devices}
              onNavigateTab={setActiveTab}
              onRefresh={refreshData}
              onSelectDeviceForQuery={(devId) => {
                setSelectedDeviceId(devId);
                setActiveTab('query');
              }}
            />
          )}

          {activeTab === 'telemetry' && (
            <TelemetryHubTab
              devices={devices}
              onRefreshDevices={refreshData}
              onNavigateToQuery={(deviceId) => {
                if (deviceId) setSelectedDeviceId(deviceId);
                setActiveTab('query');
              }}
            />
          )}

          {activeTab === 'routing' && (
            <RoutingAnalyticsTab
              routes={routes}
              queries={queries}
              config={config}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'energy' && (
            <EnergyAnalyticsTab
              energyMetrics={energyMetrics}
              overview={overview}
              config={config}
              onUpdateConfig={handleUpdateConfig}
            />
          )}

          {activeTab === 'query' && (
            <QueryExplorerTab
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onQueryCompleted={refreshData}
            />
          )}

          {activeTab === 'benchmark' && (
            <BenchmarkTab
              onBenchmarkFinished={refreshData}
            />
          )}

          {activeTab === 'simulation' && (
            <SimulationConfigTab
              config={config}
              recommendations={recommendations}
              onUpdateConfig={handleUpdateConfig}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'docs' && (
            <ArchitectureDocsTab />
          )}
        </main>

        {/* Minimal Light Footer */}
        <footer className="border-t border-zinc-200 bg-white/70 py-4 text-xs text-zinc-500 mt-auto w-full">
          <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <QueryLeafLogo size="xs" showText={false} />
              <span className="font-semibold text-zinc-700">QueryLeaf IoT Gateway</span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span className="text-zinc-500">Adaptive Energy-Aware Multi-Tier Fabric</span>
            </div>

            <div className="flex items-center gap-3 text-zinc-500 font-mono text-[11px] flex-wrap justify-center sm:justify-end">
              <span>FastAPI & Express</span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span>Redis Cache</span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span>Edge & Cloud MongoDB</span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span className="text-zinc-700 font-medium">J(route) = α·L + β·E + γ·C</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
