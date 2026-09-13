/**
 * TRACKSHIFT — Scenario Library & Predefined Demo Situations (Sections 5 & 20)
 *
 * Provides the 8 required tactical race scenarios and the 5 predefined demo situations.
 * Selecting any scenario instantly updates state, triggering deterministic re-evaluation.
 */

export const SCENARIO_LIST = [
  {
    id: "SCENARIO_01",
    number: "01",
    title: "ATTACK WINDOW",
    shortDesc: "Opponent is within overtaking range.",
    detailedDesc: "Optimal slipstream position (0.55s) with strong positive closing speed (+9 km/h). Adequate battery energy allows full electrical thrust without violating reserve floor.",
    params: {
      soc: 76,
      gap: 0.55,
      closingSpeed: 9.0,
      deploymentPower: 320,
      recoveryPotential: 68,
      constraintLevel: 1, // LOW
      lap: 24,
      totalLaps: 57
    },
    expectedStrategy: "ATTACK"
  },
  {
    id: "SCENARIO_02",
    number: "02",
    title: "LOW SOC",
    shortDesc: "Battery energy is critically low.",
    detailedDesc: "SOC is depleted to 22%, dangerously close to the mandatory 15% FIA safety reserve floor. High discharge will trigger regulatory violations and cell overheating.",
    params: {
      soc: 22,
      gap: 1.10,
      closingSpeed: 1.5,
      deploymentPower: 120,
      recoveryPotential: 85,
      constraintLevel: 4, // CRITICAL
      lap: 28,
      totalLaps: 57
    },
    expectedStrategy: "SAVE"
  },
  {
    id: "SCENARIO_03",
    number: "03",
    title: "DEFENSIVE PRESSURE",
    shortDesc: "Opponent is closing from behind.",
    detailedDesc: "Trailing rival has DRS slipstream advantage and is closing rapidly (-4.5 km/h). Immediate defensive electrical deployment is required to break the tow.",
    params: {
      soc: 55,
      gap: 0.35,
      closingSpeed: -4.5,
      deploymentPower: 260,
      recoveryPotential: 60,
      constraintLevel: 4, // CRITICAL
      lap: 32,
      totalLaps: 57
    },
    expectedStrategy: "DEFEND"
  },
  {
    id: "SCENARIO_04",
    number: "04",
    title: "FUTURE ATTACK WINDOW",
    shortDesc: "Current opportunity is mediocre; stronger predicted later.",
    detailedDesc: "Gap is 0.95s with modest closing rate. A much longer straight with 88% overtake probability approaches in 18 seconds. Spending energy now starves the superior future chance.",
    params: {
      soc: 63,
      gap: 0.95,
      closingSpeed: 3.0,
      deploymentPower: 220,
      recoveryPotential: 75,
      constraintLevel: 3, // HIGH
      lap: 36,
      totalLaps: 57
    },
    expectedStrategy: "WAIT"
  },
  {
    id: "SCENARIO_05",
    number: "05",
    title: "ENERGY TRAP",
    shortDesc: "Attacking now leaves insufficient energy to defend later.",
    detailedDesc: "A pass is technically achievable (72%), but consumes 2.1 MJ. The long return straight will leave the car completely defenseless against counter-attack.",
    params: {
      soc: 44,
      gap: 0.65,
      closingSpeed: 7.0,
      deploymentPower: 310,
      recoveryPotential: 55,
      constraintLevel: 3, // HIGH
      lap: 40,
      totalLaps: 57
    },
    expectedStrategy: "WAIT"
  },
  {
    id: "SCENARIO_06",
    number: "06",
    title: "RECOVERY WINDOW",
    shortDesc: "Current zone has strong potential for energy recovery.",
    detailedDesc: "Entering heavy braking complex into slow chicane. MGU-K harvesting efficiency peaks at 92%. Lift-and-coast yields maximum recharge with minimal lap time penalty.",
    params: {
      soc: 48,
      gap: 1.40,
      closingSpeed: 0.0,
      deploymentPower: 80,
      recoveryPotential: 92,
      constraintLevel: 2, // MODERATE
      lap: 44,
      totalLaps: 57
    },
    expectedStrategy: "RECOVER"
  },
  {
    id: "SCENARIO_07",
    number: "07",
    title: "RULE-LIMITED ATTACK",
    shortDesc: "Requested deployment exceeds permitted power constraint.",
    detailedDesc: "User or mapping software calls for 380 kW deployment, breaching the 350 kW 2026 FIA acceleration limit. Optimizer must flag the violation and recommend 350 kW legal cap.",
    params: {
      soc: 68,
      gap: 0.70,
      closingSpeed: 8.0,
      deploymentPower: 380, // Exceeds 350 kW limit
      recoveryPotential: 70,
      constraintLevel: 2, // MODERATE
      lap: 48,
      totalLaps: 57
    },
    expectedStrategy: "ATTACK",
    expectedRuleStatus: "VIOLATION"
  },
  {
    id: "SCENARIO_08",
    number: "08",
    title: "LAST-LAP ATTACK",
    shortDesc: "Limited race distance remains; long-term conservation is void.",
    detailedDesc: "Final lap of the Grand Prix (Lap 57/57). No future stints or tire conservation required. Full electrical deployment of remaining battery capacity is mathematically optimal.",
    params: {
      soc: 42,
      gap: 0.45,
      closingSpeed: 11.0,
      deploymentPower: 350,
      recoveryPotential: 50,
      constraintLevel: 1, // LOW
      lap: 57,
      totalLaps: 57
    },
    expectedStrategy: "ATTACK"
  }
];

export const DEMO_PRESETS = [
  {
    id: "DEMO_1",
    title: "Demo 1: High SOC Attack",
    badge: "ATTACK NOW",
    desc: "SOC = 80%, Gap = 0.6s, Closing = +9 km/h, Constraint = LOW",
    params: {
      soc: 80,
      gap: 0.60,
      closingSpeed: 9.0,
      deploymentPower: 320,
      recoveryPotential: 70,
      constraintLevel: 1
    },
    expected: "ATTACK NOW"
  },
  {
    id: "DEMO_2",
    title: "Demo 2: Low Energy Conservation",
    badge: "SAVE / WAIT",
    desc: "SOC = 38%, Gap = 0.8s, Future opp = HIGH, Constraint = HIGH",
    params: {
      soc: 38,
      gap: 0.80,
      closingSpeed: 4.0,
      deploymentPower: 180,
      recoveryPotential: 65,
      constraintLevel: 3
    },
    expected: "SAVE / WAIT"
  },
  {
    id: "DEMO_3",
    title: "Demo 3: Defensive Tow Repel",
    badge: "DEFEND",
    desc: "SOC = 55%, Opponent closing rapidly (-5 km/h), Constraint = CRITICAL",
    params: {
      soc: 55,
      gap: 0.40,
      closingSpeed: -5.0,
      deploymentPower: 260,
      recoveryPotential: 65,
      constraintLevel: 4
    },
    expected: "DEFEND"
  },
  {
    id: "DEMO_4",
    title: "Demo 4: Tactical Patience",
    badge: "WAIT",
    desc: "SOC = 63%, Current opp = MEDIUM, Future opp = VERY HIGH",
    params: {
      soc: 63,
      gap: 0.90,
      closingSpeed: 3.0,
      deploymentPower: 200,
      recoveryPotential: 75,
      constraintLevel: 2
    },
    expected: "WAIT"
  },
  {
    id: "DEMO_5",
    title: "Demo 5: 2026 Rule Violation & Recalibration",
    badge: "RULE WARNING",
    desc: "SOC = 45%, Requested deployment = 380 kW (> 350 kW limit)",
    params: {
      soc: 45,
      gap: 0.70,
      closingSpeed: 7.0,
      deploymentPower: 380, // > 350 kW
      recoveryPotential: 70,
      constraintLevel: 2
    },
    expected: "RULE WARNING / 350 kW LEGAL ALTERNATIVE"
  }
];
