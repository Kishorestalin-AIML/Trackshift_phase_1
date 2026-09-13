/**
 * TRACKSHIFT - Terminal Race Simulation Runner
 * Runs a live rolling-horizon race stint through the console, demonstrating
 * dynamic decision emergence, physical kinetic harvesting, and multi-horizon lookahead.
 */

import { TrackModel } from "./src/models/TrackModel.js";
import { EnergyEstimator } from "./src/engine/EnergyEstimator.js";
import { OvertakeEngine } from "./src/engine/OvertakeEngine.js";
import { FutureOpportunityEngine } from "./src/engine/FutureOpportunityEngine.js";
import { ConstraintGenerator } from "./src/engine/ConstraintGenerator.js";
import { DynamicOptimizer } from "./src/engine/DynamicOptimizer.js";
import { SCENARIOS } from "./src/scenarios/ScenarioLibrary.js";

// ANSI Color Codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const DIM = "\x1b[2m";

console.log(`\n${BOLD}${RED}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${RED}║      TRACKSHIFT // DYNAMIC CONSTRAINT-BASED F1 ENERGY DECISION ENGINE        ║${RESET}`);
console.log(`${BOLD}${RED}║                 ROLLING-HORIZON RACE SIMULATION STREAM                       ║${RESET}`);
console.log(`${BOLD}${RED}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}\n`);

const trackModel = new TrackModel("MONZA");
const energyEstimator = new EnergyEstimator({ vehicleMass: 798, etaRegen: 0.82 });
const overtakeEngine = new OvertakeEngine();
const futureEngine = new FutureOpportunityEngine(trackModel, energyEstimator, overtakeEngine);
const constraintGenerator = new ConstraintGenerator();
const optimizer = new DynamicOptimizer({
  energyEstimator,
  overtakeEngine,
  futureEngine,
  constraintGenerator
});

// Load Scenario 1 as starting state
let state = SCENARIOS[0].state.clone();
const zones = trackModel.circuit.zones;

console.log(`${CYAN}CIRCUIT: ${BOLD}${trackModel.circuit.name} (${trackModel.circuit.length}m, ${trackModel.circuit.totalLaps} Laps)${RESET}`);
console.log(`${DIM}Starting Stint from Lap ${state.lap} // Chasing P1 with Gap: ${state.opponent_gap}s${RESET}\n`);

// Run through a full sequence of track zones
for (let i = 0; i < zones.length; i++) {
  const zone = zones[i];
  state.track_distance = zone.startDist;
  state.current_zone = zone.name;
  state.speed = (zone.entrySpeed + zone.exitSpeed) / 2;

  const isBraking = zone.type === "BRAKING";
  if (isBraking) {
    state.brake = 0.9;
    state.throttle = 0.0;
    state.gear = 3;
  } else if (zone.type === "ATTACK_ZONE") {
    state.brake = 0.0;
    state.throttle = 1.0;
    state.gear = 7;
  } else {
    state.brake = 0.0;
    state.throttle = 0.85;
    state.gear = 6;
  }

  // 1. Generate multi-horizon lookahead windows
  const futureWindows = futureEngine.generateFutureWindows(state, 4);

  // 2. Run Dynamic Optimizer
  const result = optimizer.optimize(state, zone, futureWindows);
  const bestAction = result.bestControl;
  const evalData = result.evaluation;
  const rec = result.recommendation;
  const horizon = result.horizonSummary;

  // 3. Step physical energy dynamics
  const deltaBrake = isBraking ? Math.abs(zone.speedDeltaPotential) : 0;
  const prevEnergy = state.estimated_energy;
  state = energyEstimator.stepEnergyState(state, bestAction.powerKw, isBraking, deltaBrake, 2.2);

  // Formatting output
  const borderColor = rec.badgeColor === "red" ? RED : (rec.badgeColor === "yellow" ? YELLOW : GREEN);

  console.log(`${DIM}────────────────────────────────────────────────────────────────────────────────${RESET}`);
  console.log(`${BOLD}${WHITE}[LAP ${state.lap}] [TIME ${state.formattedTime}] [DIST ${Math.round(state.track_distance)}m] ${CYAN}[ZONE: ${zone.name.toUpperCase()}]${RESET}`);
  console.log(`${DIM}────────────────────────────────────────────────────────────────────────────────${RESET}`);

  console.log(`  ${BOLD}CURRENT STATE:${RESET}`);
  console.log(`    ${CYAN}ESTIMATED ERS STATE:${RESET} ${BOLD}${prevEnergy.toFixed(2)} MJ${RESET} (SOC: ${state.estimated_SOC}%)`);
  console.log(`    Speed: ${BOLD}${state.speed.toFixed(1)} km/h${RESET} | Gap: ${YELLOW}${state.opponent_gap.toFixed(2)}s${RESET} | Closing: ${GREEN}+${state.opponent_closing_speed.toFixed(1)} km/h${RESET}`);

  console.log(`\n  ${BOLD}DECISION ENGINE (MULTI-HORIZON):${RESET}`);
  console.log(`    P(OVERTAKE): ${GREEN}${BOLD}${(evalData.pOvertake * 100).toFixed(0)}%${RESET} | P(COUNTER): ${RED}${BOLD}${(evalData.pCounter * 100).toFixed(0)}%${RESET}`);
  console.log(`    Energy Required: ${evalData.energyCostMJ.toFixed(2)} MJ | Expected Harvest: ${GREEN}+${horizon.totalFutureHarvestMJ.toFixed(2)} MJ${RESET} | Fut Opp Value: ${horizon.maxFutureStrategicValue}`);

  console.log(`\n  ${BOLD}OPTIMAL FEASIBLE CONTROL:${RESET}`);
  console.log(`    Power: ${BOLD}${bestAction.powerKw} kW${RESET} | Duration: ${bestAction.duration}s | Est Cost: ${evalData.energyCostMJ.toFixed(2)} MJ`);
  console.log(`    RECOMMENDATION: ${borderColor}${BOLD}${rec.title}${RESET} (${rec.summary})`);

  console.log(`\n  ${BOLD}DECISION EXPLANATION:${RESET}`);
  result.explanation.factors.forEach(f => {
    const icon = f.passed ? `${GREEN}✓${RESET}` : `${RED}✕${RESET}`;
    console.log(`    ${icon} ${f.label}`);
  });

  const deltaE = state.estimated_energy - prevEnergy;
  const deltaSign = deltaE >= 0 ? "+" : "";
  console.log(`\n  ${DIM}POST-TRANSITION ERS:${RESET} ${BOLD}${state.estimated_energy.toFixed(2)} MJ${RESET} (${deltaSign}${deltaE.toFixed(2)} MJ)\n`);
}

console.log(`${BOLD}${GREEN}================================================================================${RESET}`);
console.log(`${BOLD}${GREEN}✔ STINT SIMULATION COMPLETE: OPTIMIZER EXECUTED ACROSS ALL TRACK ZONES.${RESET}`);
console.log(`${BOLD}${GREEN}================================================================================${RESET}\n`);
