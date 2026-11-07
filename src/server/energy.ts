/**
 * Energy & Sustainability Estimation Module for QueryLeaf Gateway
 *
 * Implements transparent physical energy modeling:
 * E (Wh) = Power (Watts) * Duration (seconds) / 3600
 *
 * Attributed Energy Components:
 * 1. Cache Path: Low-power DRAM memory cache access
 * 2. Edge Path: Local edge SoC / SBC compute power scaled by CPU utilization
 * 3. Cloud Path: Cloud server CPU allocation + WAN network packet transmission energy
 *
 * Carbon Emissions:
 * CO2e (g) = Energy (kWh) * Carbon Intensity (gCO2e / kWh)
 */

import { ExecutionPath, SimulationConfig } from './models.js';

export interface EnergyBreakdown {
  execution_path: ExecutionPath;
  duration_ms: number;
  compute_power_watts: number;
  compute_energy_wh: number;
  network_transfer_energy_wh: number;
  total_energy_wh: number;
  carbon_emissions_g: number;
  estimation_model: string;
  is_simulated: boolean;
}

export class EnergyEstimationEngine {
  /**
   * Estimate energy consumption for a given execution path and workload
   */
  public calculateEnergy(
    path: ExecutionPath,
    durationMs: number,
    payloadBytes: number,
    config: SimulationConfig
  ): EnergyBreakdown {
    const durationSec = durationMs / 1000;
    let computePowerWatts = 0;
    let computeEnergyWh = 0;
    let networkTransferEnergyWh = 0;
    let modelName = '';

    switch (path) {
      case 'cache': {
        // Cache lookup: in-memory Redis / DRAM buffer access
        // Low power overhead (~2.5 W memory subsystem) for sub-5ms duration
        computePowerWatts = config.cache_power_watts;
        computeEnergyWh = (computePowerWatts * durationSec) / 3600;
        networkTransferEnergyWh = 0; // Local in-process or localhost loopback
        modelName = 'Redis-DRAM-Attributed-v1';
        break;
      }

      case 'edge': {
        // Edge node power: base power + dynamic power scaled by CPU utilization
        // P_active = P_base * (1 + 0.8 * (CPU% / 100))
        const dynamicFactor = 1 + 0.8 * (config.edge_cpu_utilization_pct / 100);
        computePowerWatts = config.edge_power_watts * dynamicFactor;
        computeEnergyWh = (computePowerWatts * durationSec) / 3600;
        networkTransferEnergyWh = 0; // Local LAN / gateway bus
        modelName = 'Edge-SoC-Utilization-Model-v1';
        break;
      }

      case 'cloud': {
        // Cloud query: Cloud VM compute power + WAN routing transmission energy
        // Transfer energy: payload (MB) * network_energy_per_mb_wh
        computePowerWatts = config.cloud_power_watts;
        computeEnergyWh = (computePowerWatts * durationSec) / 3600;
        
        const payloadMb = Math.max(0.001, payloadBytes / (1024 * 1024));
        networkTransferEnergyWh = payloadMb * config.network_energy_per_mb_wh;
        modelName = 'Cloud-WAN-Transfer-Model-v1';
        break;
      }
    }

    const totalEnergyWh = computeEnergyWh + networkTransferEnergyWh;
    // CO2e = (Energy Wh / 1000 kWh) * carbon_intensity_g_per_kwh
    const carbonEmissionsG = (totalEnergyWh / 1000) * config.carbon_intensity_g_per_kwh;

    return {
      execution_path: path,
      duration_ms: durationMs,
      compute_power_watts: Math.round(computePowerWatts * 100) / 100,
      compute_energy_wh: Math.max(0.000001, totalEnergyWh),
      network_transfer_energy_wh: networkTransferEnergyWh,
      total_energy_wh: Math.max(0.000001, totalEnergyWh),
      carbon_emissions_g: Math.max(0.000001, carbonEmissionsG),
      estimation_model: modelName,
      is_simulated: true
    };
  }

  /**
   * Predict energy for route candidate prior to execution
   */
  public predictCandidateEnergy(
    path: ExecutionPath,
    predictedDurationMs: number,
    estimatedPayloadBytes: number,
    config: SimulationConfig
  ): number {
    return this.calculateEnergy(path, predictedDurationMs, estimatedPayloadBytes, config).total_energy_wh;
  }
}

export const energyEngine = new EnergyEstimationEngine();
