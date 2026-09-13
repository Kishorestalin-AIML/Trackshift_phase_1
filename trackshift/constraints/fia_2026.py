"""
TRACKSHIFT - FIA 2026 Regulatory & Constraint Layer (Python Engine)
"""

class FIA2026Config:
    version = "v2.4 (FIA 2026 TECHNICAL REGS)"
    max_mguk_power_kw = 350.0
    max_deploy_lap_mj = 4.0
    max_harvest_lap_mj = 9.0
    min_reserve_soc = 15.0 # 0.60 MJ floor
    max_battery_capacity_mj = 4.0

class ConstraintEngine:
    def __init__(self, config=FIA2026Config()):
        self.config = config

    def evaluate(self, power_kw, duration_sec, current_energy_mj, lap_deployed_mj, is_braking=False, speed_kmh=200):
        energy_cost = (power_kw * duration_sec) / 1000.0

        # Physical
        if is_braking and power_kw > 40:
            return False, "PHYSICAL", "Braking/Deployment conflict"
        if speed_kmh < 75.0 and power_kw > 220:
            return False, "PHYSICAL", "Traction wheelspin limit below 75 km/h"

        # Regulatory
        if power_kw > self.config.max_mguk_power_kw:
            return False, "REGULATORY", f"Power {power_kw} kW exceeds 350 kW FIA 2026 limit"
        if lap_deployed_mj + energy_cost > self.config.max_deploy_lap_mj:
            return False, "REGULATORY", f"Deployment exceeds 4.0 MJ/lap FIA quota"

        # Energy
        min_floor = (self.config.min_reserve_soc / 100.0) * self.config.max_battery_capacity_mj
        if current_energy_mj - energy_cost < min_floor:
            return False, "ENERGY", f"Drains reserve below {self.config.min_reserve_soc}% SOC floor"

        return True, "FEASIBLE", "Compliant"
