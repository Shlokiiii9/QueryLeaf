"""
Tests for Physical Energy Calculation Formulas and Carbon Modeling
"""
import pytest
from backend.app.models import SimulationConfig
from backend.app.energy_model import EnergyModel

def test_cache_energy_is_minimal():
    cfg = SimulationConfig(cache_power_watts=2.2)
    # 2ms retrieval in cache
    res = EnergyModel.calculate_energy("cache", duration_ms=2.0, payload_bytes=1024, config=cfg)
    assert res["execution_path"] == "cache"
    assert res["compute_energy_wh"] < 0.00001
    assert res["network_transfer_energy_wh"] == 0.0

def test_edge_energy_scales_with_cpu():
    cfg_low = SimulationConfig(edge_power_watts=10.0, edge_cpu_utilization_pct=10.0)
    cfg_high = SimulationConfig(edge_power_watts=10.0, edge_cpu_utilization_pct=90.0)

    res_low = EnergyModel.calculate_energy("edge", duration_ms=20.0, payload_bytes=2048, config=cfg_low)
    res_high = EnergyModel.calculate_energy("edge", duration_ms=20.0, payload_bytes=2048, config=cfg_high)

    assert res_high["compute_power_watts"] > res_low["compute_power_watts"]
    assert res_high["total_energy_wh"] > res_low["total_energy_wh"]

def test_cloud_energy_includes_network_transfer():
    cfg = SimulationConfig(cloud_power_watts=45.0, network_energy_per_mb_wh=0.052)
    # 5 MB payload over WAN
    five_mb = 5 * 1024 * 1024
    res = EnergyModel.calculate_energy("cloud", duration_ms=100.0, payload_bytes=five_mb, config=cfg)

    assert res["network_transfer_energy_wh"] > 0.25 # ~5 * 0.052 = 0.26 Wh
    assert res["total_energy_wh"] > res["compute_energy_wh"]

def test_carbon_emissions_scale_with_grid_factor():
    cfg_clean = SimulationConfig(carbon_intensity_g_per_kwh=50.0) # Hydro/Wind
    cfg_dirty = SimulationConfig(carbon_intensity_g_per_kwh=750.0) # Coal-heavy

    res_clean = EnergyModel.calculate_energy("edge", duration_ms=50.0, payload_bytes=1024, config=cfg_clean)
    res_dirty = EnergyModel.calculate_energy("edge", duration_ms=50.0, payload_bytes=1024, config=cfg_dirty)

    assert res_dirty["carbon_emissions_g"] > res_clean["carbon_emissions_g"] * 10
