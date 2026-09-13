"""
TRACKSHIFT - Overtake & Counter Probability Engine (Python Engine)
"""
import math

class OvertakeEngine:
    def __init__(self):
        pass

    def calculate_overtake(self, gap_sec, closing_kmh, zone, power_kw=0):
        if gap_sec > 1.4:
            return 0.05

        gap_term = 1.0 / (1.0 + math.exp(2.2 * (gap_sec - 0.55)))
        closing_term = 1.0 / (1.0 + math.exp(-0.035 * (closing_kmh - 3.0)))
        zone_term = zone.get("overtakingValue", 0.5)

        deploy_factor = (0.45 + 0.55 * min(1.0, power_kw / 300.0)) if power_kw > 0 else 0.18

        p = (0.40 * gap_term + 0.35 * closing_term + 0.25 * zone_term) * deploy_factor
        return max(0.02, min(0.96, round(p, 4)))

    def calculate_counter(self, zone, post_energy_mj, power_kw=0):
        if power_kw == 0:
            return 0.02 # No pass attempted, no counter risk

        base_risk = zone.get("counterRisk", 0.25)
        depletion_risk = 0.40 if post_energy_mj < 1.2 else (0.20 if post_energy_mj < 1.8 else 0.05)
        p = 0.55 * base_risk + 0.45 * depletion_risk
        return max(0.02, min(0.94, round(p, 4)))
