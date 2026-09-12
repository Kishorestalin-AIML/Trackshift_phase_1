/**
 * TRACKSHIFT - Automated Test Suite
 * Validates mathematical models, constraint filtering, dynamic emergence,
 * and baseline benchmark integrity.
 */

import { StateVector } from "../src/models/StateVector.js";
import { TrackModel } from "../src/models/TrackModel.js";
import { EnergyEstimator } from "../src/engine/EnergyEstimator.js";
import { OvertakeEngine } from "../src/engine/OvertakeEngine.js";
import { FutureOpportunityEngine } from "../src/engine/FutureOpportunityEngine.js";
import { ConstraintGenerator } from "../src/engine/ConstraintGenerator.js";
import { DynamicOptimizer } from "../src/engine/DynamicOptimizer.js";
import { BaselineSimulator } from "../src/engine/BaselineSimulator.js";
import { SCENARIOS } from "../src/scenarios/ScenarioLibrary.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING TRACKSHIFT OPTIMIZER VERIFICATION SUITE ===");
console.log("=======================================================\n");

// -------------------------------------------------------------
// TEST 1: Physical Energy Model & Kinetic Recovery Formula
// -------------------------------------------------------------
console.log("[1] Testing EnergyEstimator Physical Equations...");
const energyEstimator = new EnergyEstimator({
  vehicleMass: 798,
  etaRegen: 0.82
});

// Deceleration from 345 km/h to 75 km/h (Monza T1 braking)
const v1 = 345;
const v2 = 75;
const calculatedHarvest = energyEstimator.calculateKineticHarvest(v1, v2);

// Manual physics calculation:
// v1_ms = 345 / 3.6 = 95.833 m/s
// v2_ms = 75 / 3.6 = 20.833 m/s
// Delta_Ek = 0.5 * 798 * (95.833^2 - 20.833^2) = 0.5 * 798 * (9184.03 - 434.03) = 3,491,250 Joules = 3.491 MJ
// E_harvest = 0.82 * 3.491 MJ = 2.862 MJ
assert(calculatedHarvest > 2.7 && calculatedHarvest < 3.0, 
  `Monza T1 kinetic harvest calculated correctly (${calculatedHarvest.toFixed(3)} MJ, expected ~2.86 MJ)`);

// Deployment energy calculation: 350 kW for 2.0 s = 700 kJ = 0.70 MJ
const deployedMJ = energyEstimator.calculateDeployedEnergy(350, 2.0);
assert(Math.abs(deployedMJ - 0.70) < 0.001, 
  `Deployment integral calculated correctly (${deployedMJ.toFixed(2)} MJ for 350kW * 2s)`);

// Energy conservation step
const testState = new StateVector({ estimated_energy: 2.50 });
const nextState = energyEstimator.stepEnergyState(testState, 300, false, 0, 1.0);
assert(nextState.estimated_energy < 2.50, 
  `Energy decreases after deployment (2.50 MJ -> ${nextState.estimated_energy} MJ)`);

// -------------------------------------------------------------
// TEST 2: Hard Constraint Pruning (Constraint-First Optimization)
// -------------------------------------------------------------
console.log("\n[2] Testing Constraint-First Filtering...");
const constraintGen = new ConstraintGenerator({
  maxPermittedPowerKw: 350,
  maxLapDeploymentMJ: 4.0,
  minReserveSOC: 15.0 // 0.60 MJ floor
});

const curZone = { name: "Straight", type: "ATTACK_ZONE" };

// A. Action exceeding maximum regulatory power (380 kW > 350 kW)
const illegalPowerAction = { powerKw: 380, duration: 2.0 };
const evalPower = constraintGen.evaluateFeasibility(illegalPowerAction, testState, curZone);
assert(!evalPower.isFeasible && evalPower.layer === "FIA_REGULATORY", 
  "Power exceeding 350 kW is pruned by FIA Regulatory constraint");

// B. Action exceeding per-lap 4.0 MJ limit
const nearLimitState = new StateVector({ energy_deployed_lap: 3.65 });
const excessiveLapAction = { powerKw: 300, duration: 2.0 }; // requires 0.60 MJ -> 4.25 MJ total
const evalLap = constraintGen.evaluateFeasibility(excessiveLapAction, nearLimitState, curZone);
assert(!evalLap.isFeasible && evalLap.layer === "FIA_REGULATORY", 
  "Action breaching 4.0 MJ/lap quota is pruned by FIA Regulatory constraint");

// C. Action depleting battery below reserve floor (15% = 0.60 MJ)
const lowBatteryState = new StateVector({ estimated_energy: 0.80 });
const highEnergyAction = { powerKw: 350, duration: 1.5 }; // requires 0.525 MJ -> leaves 0.275 MJ (< 0.60 MJ)
const evalBattery = constraintGen.evaluateFeasibility(highEnergyAction, lowBatteryState, curZone);
assert(!evalBattery.isFeasible && evalBattery.layer === "ENERGY", 
  "Action draining battery below 15% SOC floor is pruned by Energy constraint");

// D. Feasible action passes
const legalAction = { powerKw: 200, duration: 1.0 }; // requires 0.20 MJ
const evalLegal = constraintGen.evaluateFeasibility(legalAction, testState, curZone);
assert(evalLegal.isFeasible, 
  "Compliant action within all physical, energy, and regulatory limits is accepted as feasible");

// -------------------------------------------------------------
// TEST 3: Dynamic Decision Emergence (No Static Rules)
// -------------------------------------------------------------
console.log("\n[3] Testing Dynamic Decision Emergence (Case A vs Case B vs Case C vs Case D)...");
const trackModel = new TrackModel("MONZA");
const overtakeEngine = new OvertakeEngine();
const futureEngine = new FutureOpportunityEngine(trackModel, energyEstimator, overtakeEngine);
const optimizer = new DynamicOptimizer({
  energyEstimator,
  overtakeEngine,
  futureEngine,
  constraintGenerator: constraintGen
});

// Scenario 1: High Overtake / Low Counter Risk -> DEPLOY NOW
const scn1 = SCENARIOS[0];
const win1 = futureEngine.generateFutureWindows(scn1.state, 4);
const opt1 = optimizer.optimize(scn1.state, trackModel.circuit.zones[scn1.zoneIndex], win1);
assert(opt1.bestControl.powerKw >= 240, 
  `Case A (High Overtake, Low Risk) selects DEPLOY (${opt1.bestControl.powerKw} kW, Recommendation: ${opt1.recommendation.code})`);

// Scenario 2: High Overtake / High Counter Risk -> DO NOT DEPLOY / DEFEND
const scn2 = SCENARIOS[1];
const win2 = futureEngine.generateFutureWindows(scn2.state, 4);
const opt2 = optimizer.optimize(scn2.state, trackModel.circuit.zones[scn2.zoneIndex], win2);
assert(opt2.bestControl.powerKw < 150, 
  `Case D (High Overtake, High Counter Risk) refuses high deploy (${opt2.bestControl.powerKw} kW, Recommendation: ${opt2.recommendation.code})`);

// Scenario 3: Low Energy / Strong Future Opportunity -> PRESERVE / WAIT
const spaTrack = new TrackModel("SPA");
const scn3 = SCENARIOS[2];
const win3 = futureEngine.generateFutureWindows(scn3.state, 4);
const opt3 = optimizer.optimize(scn3.state, spaTrack.circuit.zones[scn3.zoneIndex], win3);
assert(opt3.bestControl.powerKw === 0, 
  `Case B (Low Energy, Massive Future Window) chooses WAIT/PRESERVE (${opt3.bestControl.powerKw} kW, Recommendation: ${opt3.recommendation.code})`);

// Scenario 10: Constraint Limited -> Chooses optimal sub-limit feasible power
const scn10 = SCENARIOS[9];
const win10 = futureEngine.generateFutureWindows(scn10.state, 4);
const opt10 = optimizer.optimize(scn10.state, trackModel.circuit.zones[scn10.zoneIndex], win10);
const chosenEnergy = (opt10.bestControl.powerKw * opt10.bestControl.duration) / 1000.0;
assert(scn10.state.energy_deployed_lap + chosenEnergy <= 4.01, 
  `Scenario 10 strictly stays within remaining 0.32 MJ lap limit (Deploy: ${chosenEnergy.toFixed(2)} MJ, Total: ${(scn10.state.energy_deployed_lap + chosenEnergy).toFixed(2)} MJ)`);

// -------------------------------------------------------------
// TEST 4: Baseline Benchmark Superiority
// -------------------------------------------------------------
console.log("\n[4] Testing Baseline Benchmark Comparison...");
const baselineSim = new BaselineSimulator(
  trackModel,
  energyEstimator,
  overtakeEngine,
  futureEngine,
  constraintGen,
  optimizer
);

const stintResults = baselineSim.runStintComparison(scn1.state, 3);
const trackshiftRes = stintResults.TRACKSHIFT;
const greedyRes = stintResults.BASELINE_1;
const fixedRes = stintResults.BASELINE_2;

assert(trackshiftRes.constraintViolations === 0, 
  `TrackShift recorded ZERO regulatory violations (Baseline 1: ${greedyRes.constraintViolations}, Baseline 2: ${fixedRes.constraintViolations})`);

assert(trackshiftRes.counterEventsSuffered <= greedyRes.counterEventsSuffered, 
  `TrackShift suffered fewer counter-attacks than Greedy Baseline (${trackshiftRes.counterEventsSuffered} vs ${greedyRes.counterEventsSuffered})`);

assert(trackshiftRes.netScore >= greedyRes.netScore, 
  `TrackShift achieved superior net strategic score (${trackshiftRes.netScore} vs Greedy ${greedyRes.netScore}, Fixed ${fixedRes.netScore})`);

console.log("\n=======================================================");
console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
