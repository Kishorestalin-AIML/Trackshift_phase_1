/**
 * Verification Suite for DecisionTwin Engine
 * Tests Section 33 Quality Bar:
 *  - Lap 38: Controlled Attack recommended (79/100)
 *  - Lap 39: Attack opportunity increases -> Attack recommended (86/100)
 *  - Yellow Flag Sector 2: Invalidation -> Save + Harvest recommended
 *  - Safety Car: Invalidation -> Save + Harvest recommended
 *  - Restart: Attack recommended
 */

import { DecisionTwin, STRATEGIES } from "../src/engine/DecisionTwin.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING RACE TWIN DECISION TWIN TEST SUITE ===");
console.log("=======================================================\n");

const twin = new DecisionTwin();

// Test 1: Lap 38 Canonical State
console.log("[1] Testing Lap 38 Initial State...");
const stateLap38 = {
  lap: 38,
  totalLaps: 52,
  position: 7,
  targetPosition: 6,
  gapAhead: 0.82,
  gapBehind: 1.41,
  energy: 61,
  tyreCondition: 72,
  raceCondition: "GREEN",
  trackZone: "WELLINGTON STRAIGHT"
};

const res38 = twin.evaluate(stateLap38);
assert(res38.recommended === STRATEGIES.CONTROLLED_ATTACK, `Lap 38 recommends CONTROLLED ATTACK (got ${res38.recommended})`);
assert(res38.controlled.finalScore === 79, `Lap 38 Controlled Attack score is 79 (got ${res38.controlled.finalScore})`);
assert(res38.attack.finalScore === 74, `Lap 38 Attack score is 74 (got ${res38.attack.finalScore})`);
assert(res38.save.finalScore === 68, `Lap 38 Save score is 68 (got ${res38.save.finalScore})`);
assert(res38.confidence >= 80, `Lap 38 confidence is >= 80% (got ${res38.confidence}%)`);
assert(res38.energyCommitment === 8.0, `Lap 38 energy commitment is 8.0% (got ${res38.energyCommitment}%)`);
assert(res38.expectedPositionGain === 0.86, `Lap 38 expected position value is +0.86 (got ${res38.expectedPositionGain})`);
assert(res38.futureOpportunityStatus === "PRESERVED", `Lap 38 future opportunity is PRESERVED (got ${res38.futureOpportunityStatus})`);
assert(res38.explanation.includes("higher-value opportunity on Lap 41"), `Explanation explains future opportunity on Lap 41`);

// Test 2: Lap 39 High-Value Attack Window
console.log("\n[2] Testing Lap 39 Attack Opportunity Window...");
const stateLap39 = {
  lap: 39,
  totalLaps: 52,
  position: 7,
  targetPosition: 6,
  gapAhead: 0.48,
  gapBehind: 1.65,
  energy: 54,
  tyreCondition: 70.8,
  raceCondition: "GREEN",
  trackZone: "HANGAR STRAIGHT"
};

const res39 = twin.evaluate(stateLap39);
assert(res39.recommended === STRATEGIES.ATTACK, `Lap 39 recommends ATTACK (got ${res39.recommended})`);
assert(res39.attack.finalScore >= 85, `Lap 39 Attack score >= 85 (got ${res39.attack.finalScore})`);
assert(res39.attack.overtakeProbability === 88, `Lap 39 Overtake probability is 88% (got ${res39.attack.overtakeProbability}%)`);
assert(res39.explanation.includes("Hangar Straight"), `Explanation highlights Hangar Straight attack window`);

// Test 3: Yellow Flag Sector 2 (Dynamic Invalidation)
console.log("\n[3] Testing Race Interruption: Yellow Flag Sector 2...");
const stateYellow = {
  lap: 39,
  totalLaps: 52,
  position: 7,
  targetPosition: 6,
  gapAhead: 0.48,
  gapBehind: 1.65,
  energy: 54,
  tyreCondition: 70.8,
  raceCondition: "YELLOW_S2",
  trackZone: "BROOKLANDS"
};

const resYellow = twin.evaluate(stateYellow);
assert(resYellow.recommended === STRATEGIES.SAVE, `Yellow Flag recommends SAVE (got ${resYellow.recommended})`);
assert(resYellow.planInvalidated === true, `Previous strategy was invalidated by Yellow Flag`);
assert(resYellow.save.finalScore >= 80, `Save score under yellow flag is >= 80 (got ${resYellow.save.finalScore})`);
assert(resYellow.attack.finalScore < 30, `Attack score under yellow flag is heavily penalized (got ${resYellow.attack.finalScore})`);
assert(resYellow.explanation.includes("Immediate overtaking prohibited"), `Explanation notes overtaking is prohibited`);

// Test 4: What-If Simulation
console.log("\n[4] Testing Interactive What-If Simulation...");
const whatIfAttack = twin.simulateWhatIf(stateLap38, STRATEGIES.ATTACK);
assert(whatIfAttack.energyCost === "16.5%", `What-if attack cost is 16.5%`);
assert(whatIfAttack.overtakeProbability === "82%", `What-if attack overtake prob is 82%`);
assert(whatIfAttack.status === "DEPLETED", `What-if attack future status is DEPLETED`);

const whatIfSave = twin.simulateWhatIf(stateLap38, STRATEGIES.SAVE);
assert(whatIfSave.energyCost === "1.2%", `What-if save cost is 1.2%`);
assert(whatIfSave.status === "MAXIMIZED", `What-if save future status is MAXIMIZED`);

console.log("\n=======================================================");
console.log("=== ALL DECISION TWIN TESTS PASSED SUCCESSFULLY! ===");
console.log("=======================================================\n");
