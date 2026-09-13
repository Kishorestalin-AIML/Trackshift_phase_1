"""
TRACKSHIFT - Spa-inspired simulation track (Python Engine)
"""

STRATEGIC_ZONE_TYPES = {
    "BRAKING_HARVEST": "BRAKING_HARVEST",
    "CORNER_ENTRY": "CORNER_ENTRY",
    "CORNER": "CORNER",
    "CORNER_EXIT": "CORNER_EXIT",
    "ACCELERATION": "ACCELERATION",
    "ATTACK": "ATTACK",
    "DEFENSE": "DEFENSE",
    "LOW_VALUE": "LOW_VALUE",
    "HIGH_VALUE_ATTACK": "HIGH_VALUE_ATTACK"
}

SPA_SIMULATION_ZONES = [
    {
        "id": "Z1_LA_SOURCE",
        "turn": "T1",
        "name": "T1 La Source",
        "type": "BRAKING_HARVEST",
        "startDistance": 0,
        "endDistance": 380,
        "length": 380,
        "harvestPotential": 0.92,
        "deploymentValue": 0.45,
        "overtakingValue": 0.84,
        "counterRisk": 0.42,
        "entrySpeed": 305,
        "apexSpeed": 70,
        "exitSpeed": 140,
        "drs": False
    },
    {
        "id": "Z2_EAU_ROUGE_RAIDILLON",
        "turn": "T2-T4",
        "name": "T2-T4 Eau Rouge / Raidillon",
        "type": "ACCELERATION",
        "startDistance": 380,
        "endDistance": 1030,
        "length": 650,
        "harvestPotential": 0.10,
        "deploymentValue": 0.72,
        "overtakingValue": 0.25,
        "counterRisk": 0.14,
        "entrySpeed": 140,
        "apexSpeed": 305,
        "exitSpeed": 310,
        "drs": False
    },
    {
        "id": "Z3_KEMMEL_STRAIGHT",
        "turn": "T5",
        "name": "T5 Kemmel Straight",
        "type": "HIGH_VALUE_ATTACK",
        "startDistance": 1030,
        "endDistance": 2050,
        "length": 1020,
        "harvestPotential": 0.05,
        "deploymentValue": 0.98,
        "overtakingValue": 0.94,
        "counterRisk": 0.32,
        "entrySpeed": 310,
        "apexSpeed": 350,
        "exitSpeed": 350,
        "drs": True
    },
    {
        "id": "Z4_LES_COMBES_MALMEDY",
        "turn": "T6-T7",
        "name": "T6-T7 Les Combes & Malmedy",
        "type": "BRAKING_HARVEST",
        "startDistance": 2050,
        "endDistance": 2630,
        "length": 580,
        "harvestPotential": 0.94,
        "deploymentValue": 0.35,
        "overtakingValue": 0.88,
        "counterRisk": 0.40,
        "entrySpeed": 350,
        "apexSpeed": 130,
        "exitSpeed": 195,
        "drs": False
    },
    {
        "id": "Z5_BRUXELLES_RIVAGE",
        "turn": "T8-T9",
        "name": "T8-T9 Bruxelles / Rivage",
        "type": "DEFENSE",
        "startDistance": 2630,
        "endDistance": 3550,
        "length": 920,
        "harvestPotential": 0.55,
        "deploymentValue": 0.30,
        "overtakingValue": 0.38,
        "counterRisk": 0.28,
        "entrySpeed": 240,
        "apexSpeed": 105,
        "exitSpeed": 185,
        "drs": False
    },
    {
        "id": "Z6_POUHON",
        "turn": "T10-T11",
        "name": "T10-T11 Double Pouhon",
        "type": "CORNER_EXIT",
        "startDistance": 3550,
        "endDistance": 4480,
        "length": 930,
        "harvestPotential": 0.35,
        "deploymentValue": 0.50,
        "overtakingValue": 0.32,
        "counterRisk": 0.22,
        "entrySpeed": 290,
        "apexSpeed": 240,
        "exitSpeed": 280,
        "drs": False
    },
    {
        "id": "Z7_FAGNES",
        "turn": "T12",
        "name": "T12 Fagnes Chicane",
        "type": "CORNER_ENTRY",
        "startDistance": 4480,
        "endDistance": 4950,
        "length": 470,
        "harvestPotential": 0.60,
        "deploymentValue": 0.40,
        "overtakingValue": 0.48,
        "counterRisk": 0.32,
        "entrySpeed": 280,
        "apexSpeed": 160,
        "exitSpeed": 215,
        "drs": False
    },
    {
        "id": "Z8_STAVELOT",
        "turn": "T13-T14",
        "name": "T13-T14 Stavelot / Paul Frere",
        "type": "ACCELERATION",
        "startDistance": 4950,
        "endDistance": 5400,
        "length": 450,
        "harvestPotential": 0.25,
        "deploymentValue": 0.65,
        "overtakingValue": 0.40,
        "counterRisk": 0.20,
        "entrySpeed": 215,
        "apexSpeed": 190,
        "exitSpeed": 280,
        "drs": False
    },
    {
        "id": "Z9_BLANCHIMONT",
        "turn": "T15",
        "name": "T15 Blanchimont",
        "type": "ATTACK",
        "startDistance": 5400,
        "endDistance": 6550,
        "length": 1150,
        "harvestPotential": 0.08,
        "deploymentValue": 0.78,
        "overtakingValue": 0.70,
        "counterRisk": 0.24,
        "entrySpeed": 280,
        "apexSpeed": 335,
        "exitSpeed": 335,
        "drs": True
    },
    {
        "id": "Z10_BUS_STOP",
        "turn": "T16-T17",
        "name": "T16-T17 Bus Stop Chicane",
        "type": "BRAKING_HARVEST",
        "startDistance": 6550,
        "endDistance": 7004,
        "length": 454,
        "harvestPotential": 0.90,
        "deploymentValue": 0.35,
        "overtakingValue": 0.86,
        "counterRisk": 0.48,
        "entrySpeed": 335,
        "apexSpeed": 82,
        "exitSpeed": 160,
        "drs": False
    }
]

class Track:
    def __init__(self):
        self.name = "Spa-inspired simulation track"
        self.length = 7004
        self.total_laps = 10
        self.turns_count = 17
        self.zones = SPA_SIMULATION_ZONES

    def get_zone_at_distance(self, distance):
        d = distance % self.length
        for i, z in enumerate(self.zones):
            if z["startDistance"] <= d < z["endDistance"]:
                return z, i, (d - z["startDistance"]) / z["length"]
        return self.zones[0], 0, 0.0

    def get_next_zones(self, current_index, count=4):
        res = []
        total = len(self.zones)
        for i in range(1, count + 1):
            idx = (current_index + i) % total
            res.append({
                "zone": self.zones[idx],
                "index": idx,
                "is_next_lap": (current_index + i) >= total
            })
        return res
