"""
TRACKSHIFT - Energy & Battery Estimator (Python Engine)
"""

class Battery:
    def __init__(self, capacity_mj=4.0, initial_energy=3.20, min_reserve_soc=15.0):
        self.capacity_mj = capacity_mj
        self.energy_mj = initial_energy
        self.min_reserve_soc = min_reserve_soc
        self.min_reserve_floor_mj = (min_reserve_soc / 100.0) * capacity_mj
        self.regen_efficiency = 0.82
        self.vehicle_mass = 798

    def calculate_kinetic_harvest(self, v_before_kmh, v_after_kmh):
        if v_before_kmh <= v_after_kmh:
            return 0.0
        v1 = v_before_kmh / 3.6
        v2 = v_after_kmh / 3.6
        delta_joules = 0.5 * self.vehicle_mass * (v1**2 - v2**2)
        delta_mj = delta_joules / 1e6
        return max(0.0, self.regen_efficiency * delta_mj)

    def calculate_deployment_cost(self, power_kw, duration_sec):
        return (power_kw * duration_sec) / 1000.0

    def step(self, power_kw, duration_sec, is_braking=False, brake_drop_kmh=0):
        deployed = self.calculate_deployment_cost(power_kw, duration_sec)
        harvested = 0.0
        if is_braking and brake_drop_kmh > 0:
            harvested = min(0.95, self.calculate_kinetic_harvest(300, 300 - brake_drop_kmh))

        self.energy_mj = max(0.0, min(self.capacity_mj, self.energy_mj - deployed + harvested))
        soc = (self.energy_mj / self.capacity_mj) * 100.0
        return self.energy_mj, soc, deployed, harvested
