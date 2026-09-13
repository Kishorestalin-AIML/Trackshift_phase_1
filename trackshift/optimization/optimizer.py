"""
TRACKSHIFT - Rolling-Horizon Optimizer (Python Engine)
"""

CANDIDATES = [
    {"label": "0 kW × 2.0 sec", "power": 0, "duration": 2.0},
    {"label": "100 kW × 2.0 sec", "power": 100, "duration": 2.0},
    {"label": "180 kW × 2.0 sec", "power": 180, "duration": 2.0},
    {"label": "250 kW × 2.0 sec", "power": 250, "duration": 2.0},
    {"label": "286 kW × 1.84 sec", "power": 286, "duration": 1.84},
    {"label": "300 kW × 1.5 sec", "power": 300, "duration": 1.5},
    {"label": "350 kW × 1.5 sec", "power": 350, "duration": 1.5}
]

class DynamicOptimizer:
    def __init__(self, overtake_engine, constraint_engine):
        self.overtake_engine = overtake_engine
        self.constraint_engine = constraint_engine

    def optimize(self, current_energy_mj, lap_deployed_mj, zone, gap_sec, closing_kmh, is_braking=False, speed_kmh=250):
        scored_candidates = []

        for c in CANDIDATES:
            p = c["power"]
            dur = c["duration"]
            cost = (p * dur) / 1000.0
            post_energy = max(0.0, current_energy_mj - cost)

            is_feasible, layer, reason = self.constraint_engine.evaluate(
                p, dur, current_energy_mj, lap_deployed_mj, is_braking, speed_kmh
            )

            p_over = self.overtake_engine.calculate_overtake(gap_sec, closing_kmh, zone, p)
            p_counter = self.overtake_engine.calculate_counter(zone, post_energy, p)

            pos_gain = p_over * (1.0 - 0.7 * p_counter) if p > 0 else 0.05
            future_loss = (1.5 * cost) if post_energy < 1.4 else (0.2 * cost)

            # 8-term objective function
            score = (
                1.0 * pos_gain
                + 1.0 * p_over
                - 1.5 * p_counter
                - 0.80 * cost
                - 1.20 * future_loss
            )

            if not is_feasible:
                score = -999.0

            scored_candidates.append({
                "candidate": c,
                "score": round(score, 3),
                "is_feasible": is_feasible,
                "reason": reason,
                "p_overtake": p_over,
                "p_counter": p_counter,
                "cost_mj": cost
            })

        feasible_only = [x for x in scored_candidates if x["is_feasible"]]
        feasible_only.sort(key=lambda x: x["score"], reverse=True)

        winner = feasible_only[0] if feasible_only else scored_candidates[0]
        return winner, scored_candidates
