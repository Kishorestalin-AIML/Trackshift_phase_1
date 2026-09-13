/**
 * TEST SUITE: Decision Twin Engine, 5 Strategies & Energy Opportunity Cost
 */

import { F1DecisionTwinEngine } from "../src/engine/f1DecisionTwinEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING DECISION TWIN & STRATEGY TEST SUITE     ===");
console.log("=======================================================\n");

// 1. Initial Balanced State (Scenario 04: Moderate gap, high future opp)
console.log("[1] Testing Initial Evaluation & Strategy Ranking...");
const testState = {
  soc: 62,
  batteryCapacity: 4.00,
  gap: 0.80,
  closingSpeed: 8.0,
  deploymentPower: 280,
  recoveryPotential: 72,
  constraintLevel: 2 // MODERATE
};

const result = F1DecisionTwinEngine.evaluateAll(testState);

assert(result.strategies.length === 5, "Evaluated all 5 strategies (ATTACK, WAIT, SAVE, RECOVER, DEFEND)");
assert(result.recommendedAction === "WAIT", `Balanced state recommends WAIT (got ${result.recommendedAction})`);
assert(result.confidence >= 80, `Confidence is >= 80% (got ${result.confidence}%)`);
assert(result.futureProb >= 80, `Future attack probability is >= 80% (got ${result.futureProb}%)`);

// 2. High SOC Attack Window (Scenario 01)
console.log("\n[2] Testing High SOC Attack Window...");
const attackState = {
  soc: 82,
  batteryCapacity: 4.00,
  gap: 0.50,
  closingSpeed: 10.0,
  deploymentPower: 320,
  recoveryPotential: 65,
  constraintLevel: 1 // LOW
};
const attackRes = F1DecisionTwinEngine.evaluateAll(attackState);
assert(attackRes.recommendedAction === "ATTACK", `High SOC + close gap recommends ATTACK (got ${attackRes.recommendedAction})`);
assert(attackRes.overtakeProb >= 75, `Overtake probability is >= 75% (got ${attackRes.overtakeProb}%)`);
assert(attackRes.bestStrategy.expectedPosition === "P1", `Expected position is P1 (got ${attackRes.bestStrategy.expectedPosition})`);

// 3. Low SOC Conservation (Scenario 02)
console.log("\n[3] Testing Low SOC Conservation...");
const lowSocState = {
  soc: 22,
  batteryCapacity: 4.00,
  gap: 1.10,
  closingSpeed: 1.0,
  deploymentPower: 120,
  recoveryPotential: 85,
  constraintLevel: 4 // CRITICAL
};
const lowSocRes = F1DecisionTwinEngine.evaluateAll(lowSocState);
assert(lowSocRes.recommendedAction === "SAVE" || lowSocRes.recommendedAction === "WAIT", `Low SOC recommends SAVE or WAIT (got ${lowSocRes.recommendedAction})`);
assert(lowSocRes.bestStrategy.ruleStatus !== "VIOLATION", "Recommended strategy is legally valid");

// 4. Defensive Pressure (Scenario 03)
console.log("\n[4] Testing Defensive Pressure...");
const defendState = {
  soc: 55,
  batteryCapacity: 4.00,
  gap: 0.35,
  closingSpeed: -4.5,
  deploymentPower: 260,
  recoveryPotential: 60,
  constraintLevel: 4
};
const defendRes = F1DecisionTwinEngine.evaluateAll(defendState);
assert(defendRes.recommendedAction === "DEFEND", `Opponent closing rapidly recommends DEFEND (got ${defendRes.recommendedAction})`);

// 5. Energy Opportunity Cost Verification (Section 12)
console.log("\n[5] Testing Dynamic Energy Opportunity Cost Synthesis...");
assert(result.opportunityCostStatement.includes("increases immediate overtake probability"), "Opportunity cost explains immediate gain");
assert(result.opportunityCostStatement.includes("reduces the probability of successfully defending"), "Opportunity cost explains downstream defense reduction");

// 6. Constraint Impact Matrix Verification (Section 14)
console.log("\n[6] Testing Constraint Impact Matrix (5 Levels)...");
assert(result.constraintImpacts.length === 5, "Includes 5 distinct constraint levels (L1 to L5)");
assert(result.constraintImpacts[0].expectedGain === "+0.42 s", "Level 1 LOW has +0.42 s expected gain");
assert(result.constraintImpacts[4].expectedGain === "-0.22 s", "Level 5 EXTREME has -0.22 s expected gain");

console.log("\n=======================================================");
console.log("=== ALL DECISION TWIN TESTS PASSED!                 ===");
console.log("=======================================================\n");
