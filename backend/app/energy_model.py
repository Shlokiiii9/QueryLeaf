"""
Energy Estimation and Sustainability Analytics Module
Formula: Energy (Wh) = Power (W) * Duration (s) / 3600
"""
from typing import Dict, Any
from .models import SimulationConfig, ExecutionPath

class EnergyModel:
    @staticmethod
    def calculate_energy(
        path: ExecutionPath,
        duration_ms: float,
        payload_bytes: int,
        config: SimulationConfig
    ) -> Dict[str, Any]:
        duration_sec = duration_ms / 1000.0
        compute_power_watts = 0.0
        network_transfer_energy_wh = 0.0

        if path == "cache":
            compute_power_watts = config.cache_power_watts
            compute_energy_wh = (compute_power_watts * duration_sec) / 3600.0
        elif path == "edge":
            dynamic_factor = 1.0 + 0.8 * (config.edge_cpu_utilization_pct / 100.0)
            compute_power_watts = config.edge_power_watts * dynamic_factor
            compute_energy_wh = (compute_power_watts * duration_sec) / 3600.0
        else: # cloud
            compute_power_watts = config.cloud_power_watts
            compute_energy_wh = (compute_power_watts * duration_sec) / 3600.0
            payload_mb = max(0.001, payload_bytes / (1024.0 * 1024.0))
            network_transfer_energy_wh = payload_mb * config.network_energy_per_mb_wh

        total_energy_wh = max(0.000001, compute_energy_wh + network_transfer_energy_wh)
        carbon_emissions_g = max(0.000001, (total_energy_wh / 1000.0) * config.carbon_intensity_g_per_kwh)

        return {
            "execution_path": path,
            "duration_ms": duration_ms,
            "compute_power_watts": round(compute_power_watts, 2),
            "compute_energy_wh": compute_energy_wh,
            "network_transfer_energy_wh": network_transfer_energy_wh,
            "total_energy_wh": round(total_energy_wh, 7),
            "carbon_emissions_g": round(carbon_emissions_g, 7),
            "is_simulated": True
        }
