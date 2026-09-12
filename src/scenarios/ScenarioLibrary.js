/**
 * TRACKSHIFT - ScenarioLibrary
 * Provides the 10 core tactical simulation scenarios demonstrating why dynamic optimization
 * is fundamentally superior to fixed threshold rules.
 */

import { StateVector } from "../models/StateVector.js";

export const SCENARIOS = [
  {
    id: "SCENARIO_1_HIGH_OVERTAKE_LOW_RISK",
    caseCode: "Case A",
    title: "1. High Overtake / Low Counter-Risk",
    circuitId: "MONZA",
    zoneIndex: 7, // Rettifilo di Rialto (Back Straight)
    description: "P(overtake) is 82%, P(counter) is low (12%), with heavy braking at Parabolica ahead to recharge. Immediate tactical strike is optimal.",
    expectedOutcome: "DEPLOY NOW (312 kW for 2.3s)",
    state: new StateVector({
      lap: 23,
      time: 78.432,
      track_distance: 4382.0,
      speed: 314.5,
      acceleration: 4.8,
      throttle: 1.0,
      brake: 0.0,
      gear: 7,
      estimated_energy: 2.91,
      estimated_SOC: 72.8,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 184.0,
      cell_temp: 58.4,
      opponent_gap: 0.52,
      opponent_closing_speed: 7.4,
      race_position: 2,
      current_zone: "Rettifilo di Rialto (Back Straight)",
      remaining_laps: 30,
      energy_harvested_lap: 0.85,
      energy_deployed_lap: 1.94
    })
  },

  {
    id: "SCENARIO_2_HIGH_OVERTAKE_HIGH_RISK",
    caseCode: "Case B / D",
    title: "2. High Overtake / High Counter-Risk",
    circuitId: "MONZA",
    zoneIndex: 3, // Variante della Roggia
    description: "P(overtake) is high (84%), but exit leads onto long straight where rival will retain DRS. Depleting battery leaves car defenseless. Optimizer chooses to hold / position.",
    expectedOutcome: "DO NOT DEPLOY / DEFENSIVE HOLD",
    state: new StateVector({
      lap: 24,
      time: 82.115,
      track_distance: 2150.0,
      speed: 308.0,
      acceleration: 2.1,
      throttle: 0.85,
      brake: 0.0,
      gear: 6,
      estimated_energy: 1.65,
      estimated_SOC: 41.2,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 64.2,
      opponent_gap: 0.48,
      opponent_closing_speed: 6.8,
      race_position: 2,
      current_zone: "Variante della Roggia (T4-T5)",
      remaining_laps: 29,
      energy_harvested_lap: 0.42,
      energy_deployed_lap: 2.10
    })
  },

  {
    id: "SCENARIO_3_LOW_ENERGY_STRONG_FUTURE",
    caseCode: "Case B",
    title: "3. Low Energy / Strong Future Opportunity",
    circuitId: "SPA",
    zoneIndex: 0, // La Source
    description: "Battery is critically low (1.10 MJ). Current hairpin pass is tempting, but Kemmel Straight follows after Raidillon. Optimizer hoards charge for Kemmel.",
    expectedOutcome: "WAIT & PRESERVE FOR KEMMEL",
    state: new StateVector({
      lap: 18,
      time: 21.050,
      track_distance: 120.0,
      speed: 165.0,
      acceleration: 3.2,
      throttle: 0.70,
      brake: 0.0,
      gear: 2,
      estimated_energy: 1.10,
      estimated_SOC: 27.5,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 61.8,
      opponent_gap: 0.65,
      opponent_closing_speed: 3.1,
      race_position: 3,
      current_zone: "La Source (T1)",
      remaining_laps: 26,
      energy_harvested_lap: 0.22,
      energy_deployed_lap: 0.90
    })
  },

  {
    id: "SCENARIO_4_HIGH_ENERGY_POOR_OPP",
    caseCode: "Strategic Hoard",
    title: "4. High Energy / Poor Current Opportunity",
    circuitId: "SILVERSTONE",
    zoneIndex: 6, // Maggotts-Becketts-Chapel
    description: "Battery is full (3.75 MJ), but car is navigating high-speed complex where passing is impossible (P_overtake = 18%). Optimizer refuses wasteful power dump.",
    expectedOutcome: "CRUISE & MAINTAIN (0 kW)",
    state: new StateVector({
      lap: 14,
      time: 48.230,
      track_distance: 3880.0,
      speed: 282.0,
      acceleration: 1.1,
      throttle: 0.92,
      brake: 0.0,
      gear: 6,
      estimated_energy: 3.75,
      estimated_SOC: 93.8,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 56.0,
      opponent_gap: 1.25,
      opponent_closing_speed: -1.2,
      race_position: 4,
      current_zone: "Maggotts / Becketts / Chapel",
      remaining_laps: 38,
      energy_harvested_lap: 0.60,
      energy_deployed_lap: 0.40
    })
  },

  {
    id: "SCENARIO_5_STRONG_FUTURE_HARVEST",
    caseCode: "Aggressive Spend",
    title: "5. Strong Future Harvest Ahead",
    circuitId: "MONZA",
    zoneIndex: 0, // Main Straight heading to T1
    description: "Entering Rettifilo main straight. Massive deceleration from 350 to 75 km/h at Prima Variante guarantees +0.95 MJ harvest. Full deployment is justified.",
    expectedOutcome: "FULL ATTACK DEPLOY (350 kW)",
    state: new StateVector({
      lap: 11,
      time: 14.200,
      track_distance: 450.0,
      speed: 322.0,
      acceleration: 3.9,
      throttle: 1.0,
      brake: 0.0,
      gear: 7,
      estimated_energy: 2.45,
      estimated_SOC: 61.2,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 280.0,
      cell_temp: 59.5,
      opponent_gap: 0.58,
      opponent_closing_speed: 8.2,
      race_position: 2,
      current_zone: "Rettifilo Tribune (Main Straight)",
      remaining_laps: 42,
      energy_harvested_lap: 0.10,
      energy_deployed_lap: 0.85
    })
  },

  {
    id: "SCENARIO_6_WEAK_FUTURE_HARVEST",
    caseCode: "Conservation Demand",
    title: "6. Weak Future Harvest Horizon",
    circuitId: "SILVERSTONE",
    zoneIndex: 1, // Abbey & Farm
    description: "Flowing high-speed section with minimal braking. Harvesting over next 3 zones is near zero. Optimizer preserves energy rather than burning reserves.",
    expectedOutcome: "LOW BALANCED DEPLOY (80 kW)",
    state: new StateVector({
      lap: 32,
      time: 19.800,
      track_distance: 920.0,
      speed: 295.0,
      acceleration: 1.8,
      throttle: 0.88,
      brake: 0.0,
      gear: 7,
      estimated_energy: 1.80,
      estimated_SOC: 45.0,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 62.0,
      opponent_gap: 0.78,
      opponent_closing_speed: 2.4,
      race_position: 3,
      current_zone: "Abbey & Farm (T1-T2)",
      remaining_laps: 20,
      energy_harvested_lap: 0.15,
      energy_deployed_lap: 1.45
    })
  },

  {
    id: "SCENARIO_7_COMPETING_WINDOWS",
    caseCode: "Multi-Zone Optimization",
    title: "7. Multiple Competing Overtake Windows",
    circuitId: "MONZA",
    zoneIndex: 5, // Serraglio approaching Ascari
    description: "Window at Ascari (Z7) has P(overtake)=75%, but Back Straight (Z8) has 82% with 20% counter-risk. Optimizer saves burst for Z8.",
    expectedOutcome: "PRESERVE FOR RETTIFILO DI RIALTO",
    state: new StateVector({
      lap: 28,
      time: 55.400,
      track_distance: 3350.0,
      speed: 290.0,
      acceleration: 2.8,
      throttle: 0.95,
      brake: 0.0,
      gear: 7,
      estimated_energy: 2.20,
      estimated_SOC: 55.0,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 61.2,
      opponent_gap: 0.72,
      opponent_closing_speed: 4.8,
      race_position: 2,
      current_zone: "Curva del Serraglio",
      remaining_laps: 25,
      energy_harvested_lap: 0.70,
      energy_deployed_lap: 1.80
    })
  },

  {
    id: "SCENARIO_8_LATE_RACE_SCARCITY",
    caseCode: "Final Stint",
    title: "8. Late-Race Energy Scarcity",
    circuitId: "MONZA",
    zoneIndex: 0, // Lap 51 of 53
    description: "Lap 51 of 53. Only 2 laps remain. Cumulative stint wear and thermal saturation require surgical deployment only when move sticks.",
    expectedOutcome: "CALCULATED ATTACK (240 kW for 1.5s)",
    state: new StateVector({
      lap: 51,
      time: 12.100,
      track_distance: 350.0,
      speed: 310.0,
      acceleration: 3.5,
      throttle: 1.0,
      brake: 0.0,
      gear: 7,
      estimated_energy: 1.35,
      estimated_SOC: 33.8,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 68.4,
      opponent_gap: 0.42,
      opponent_closing_speed: 6.5,
      race_position: 2,
      current_zone: "Rettifilo Tribune (Main Straight)",
      remaining_laps: 2,
      energy_harvested_lap: 0.05,
      energy_deployed_lap: 0.20
    })
  },

  {
    id: "SCENARIO_9_DEFENSIVE_SITUATION",
    caseCode: "Defend P1",
    title: "9. Defensive Situation (Leading Car)",
    circuitId: "SPA",
    zoneIndex: 6, // Blanchimont
    description: "Car is P1 with rival closing at 0.35s in slipstream before Bus Stop chicane. Optimizer calculates defensive deployment to break DRS tow.",
    expectedOutcome: "DEFENSIVE BURST (160 kW)",
    state: new StateVector({
      lap: 39,
      time: 92.400,
      track_distance: 5700.0,
      speed: 328.0,
      acceleration: 2.2,
      throttle: 1.0,
      brake: 0.0,
      gear: 8,
      estimated_energy: 2.15,
      estimated_SOC: 53.8,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 63.5,
      opponent_gap: 0.35, // Rival is 0.35s behind!
      opponent_closing_speed: -5.2, // Rival closing in
      race_position: 1, // P1 defending!
      current_zone: "Blanchimont (T16-T17)",
      remaining_laps: 5,
      energy_harvested_lap: 0.65,
      energy_deployed_lap: 1.95
    })
  },

  {
    id: "SCENARIO_10_CONSTRAINT_LIMITED",
    caseCode: "Regulation Bound",
    title: "10. Constraint-Limited Deployment",
    circuitId: "MONZA",
    zoneIndex: 7, // Back Straight
    description: "Car has already deployed 3.65 MJ this lap out of 4.0 MJ FIA limit. Candidate 350 kW for 2.5s (0.87 MJ) violates hard FIA limit. Optimizer finds feasible sub-limit control.",
    expectedOutcome: "REGULATORY CLAMPED SUB-LIMIT (160 kW for 1.5s)",
    state: new StateVector({
      lap: 19,
      time: 72.800,
      track_distance: 4420.0,
      speed: 312.0,
      acceleration: 3.1,
      throttle: 1.0,
      brake: 0.0,
      gear: 7,
      estimated_energy: 2.80,
      estimated_SOC: 70.0,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 0.0,
      cell_temp: 60.1,
      opponent_gap: 0.55,
      opponent_closing_speed: 6.2,
      race_position: 2,
      current_zone: "Rettifilo di Rialto (Back Straight)",
      remaining_laps: 34,
      energy_harvested_lap: 0.90,
      energy_deployed_lap: 3.68 // Only 0.32 MJ left in lap quota!
    })
  }
];
