import { TrackModel } from "../src/models/TrackModel.js";
import { EnergyEstimator } from "../src/engine/EnergyEstimator.js";
import { OvertakeEngine } from "../src/engine/OvertakeEngine.js";
import { FutureOpportunityEngine } from "../src/engine/FutureOpportunityEngine.js";
import { ConstraintGenerator, FIA_2026_CONFIG } from "../src/engine/ConstraintGenerator.js";
import { DynamicOptimizer } from "../src/engine/DynamicOptimizer.js";
import { RaceSimulator } from "../src/engine/RaceSimulator.js";

console.log("=== TESTING SILVERSTONE RACE SIMULATOR & LAP RECORDS ===");

const trackModel = new TrackModel("SILVERSTONE");
const energyEstimator = new EnergyEstimator({ vehicleMass: 798, etaRegen: 0.82 });
const overtakeEngine = new OvertakeEngine();
const futureEngine = new FutureOpportunityEngine(trackModel, energyEstimator, overtakeEngine);
const constraintGenerator = new ConstraintGenerator(FIA_2026_CONFIG);
const optimizer = new DynamicOptimizer({
  energyEstimator,
  overtakeEngine,
  futureEngine,
  constraintGenerator
});

const simulator = new RaceSimulator({
  trackModel,
  energyEstimator,
  overtakeEngine,
  futureEngine,
  constraintGenerator,
  optimizer
});

simulator.start();
simulator.setSpeed(10); // Run at 10x for fast simulation

console.log(`Track: ${trackModel.circuit.name} (${trackModel.circuit.length}m, ${trackModel.circuit.turns} turns)`);
console.log(`Starting Grid: ${simulator.competitors.length} cars`);
console.log(`Player starting position: P${simulator.playerPosition}`);

let overtakes = [];
simulator.onOvertake = (data) => {
  console.log(`  ⚡ OVERTAKE: P${data.fromPos} -> P${data.toPos} (Overtook Car ${data.overtakenCar.number})`);
  overtakes.push(data);
};

let lapsCompleted = 0;
simulator.onLapCompleted = (record) => {
  lapsCompleted++;
  console.log(`  🏁 LAP ${record.lap} COMPLETED: ${record.formattedLapTime} | S1: ${record.sector1}s | S2: ${record.sector2}s | S3: ${record.sector3}s | Gap: ${record.gapEnd}s | Energy: ${record.energyEnd}MJ | Decision: ${record.decisionSummary} | Result: ${record.result}`);
};

// Simulate until race completion or max 1000 seconds
let steps = 0;
while (!simulator.isComplete && steps < 5000) {
  simulator.step(0.1);
  steps++;
}

console.log("\n=== RACE FINISHED ===");
console.log(`Total Steps: ${steps}`);
console.log(`Laps Completed: ${lapsCompleted} / ${simulator.totalLaps}`);
console.log(`Final Player Position: P${simulator.playerPosition}`);
console.log(`Player Overtakes: ${simulator.stats.playerOvertakes}`);
console.log(`Total Energy Deployed: ${simulator.stats.totalEnergyDeployedMJ.toFixed(2)} MJ`);
console.log(`Best Lap Time: ${simulator.formatTime(simulator.bestLapTime)}`);

// Verify Section 35 Lap Records Data Structure
console.log("\n=== VERIFYING SECTION 35 LAP RECORD DATA STRUCTURE ===");
const sample = simulator.lapRecords[0];
console.log("Sample Lap Record Keys:", Object.keys(sample));

const requiredKeys = [
  "lap", "lapTime", "sector1", "sector2", "sector3",
  "positionStart", "positionEnd", "gapStart", "gapEnd",
  "energyStart", "energyHarvested", "energyDeployed", "energyEnd",
  "decisions", "decisionSummary", "result", "delta", "isBestLap"
];

let allKeysPresent = true;
for (const k of requiredKeys) {
  if (!(k in sample)) {
    console.error(`Missing required key: ${k}`);
    allKeysPresent = false;
  }
}

if (allKeysPresent) {
  console.log("✓ ALL SECTION 35 DATA STRUCTURE FIELDS VERIFIED!");
} else {
  process.exit(1);
}

if (simulator.lapRecords.length === 10) {
  console.log("✓ EXACTLY 10 LAP RECORDS GENERATED!");
} else {
  console.error(`Expected 10 lap records, got ${simulator.lapRecords.length}`);
  process.exit(1);
}

console.log("=== ALL SILVERSTONE SIMULATION CHECKS PASSED ===");
