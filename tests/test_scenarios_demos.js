/**
 * TEST SUITE: 8 Tactical Scenarios & 5 Demo Presets (Sections 5 & 20)
 */

import { SCENARIO_LIST, DEMO_PRESETS } from "../src/engine/scenarioLibrary.js";
import { F1DecisionTwinEngine } from "../src/engine/f1DecisionTwinEngine.js";
import { fiaRuleEngine } from "../src/engine/fia2026RuleEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING SCENARIOS & DEMO PRESETS TEST SUITE     ===");
console.log("=======================================================\n");

// 1. Verify 8 Scenarios Defined
console.log("[1] Verifying 8 Required Tactical Scenarios...");
assert(SCENARIO_LIST.length === 8, `Defined exactly 8 scenarios (got ${SCENARIO_LIST.length})`);

const expectedTitles = [
  "ATTACK WINDOW",
  "LOW SOC",
  "DEFENSIVE PRESSURE",
  "FUTURE ATTACK WINDOW",
  "ENERGY TRAP",
  "RECOVERY WINDOW",
  "RULE-LIMITED ATTACK",
  "LAST-LAP ATTACK"
];

expectedTitles.forEach((title, i) => {
  assert(SCENARIO_LIST[i].title === title, `Scenario ${i+1} is ${title}`);
});

// 2. Test Scenario 01 (Attack Window)
console.log("\n[2] Testing Scenario 01 (Attack Window)...");
const sc1 = SCENARIO_LIST[0];
const res1 = F1DecisionTwinEngine.evaluateAll(sc1.params);
assert(res1.recommendedAction === "ATTACK", `Scenario 01 recommends ATTACK (got ${res1.recommendedAction})`);

// 3. Test Scenario 03 (Defensive Pressure)
console.log("\n[3] Testing Scenario 03 (Defensive Pressure)...");
const sc3 = SCENARIO_LIST[2];
const res3 = F1DecisionTwinEngine.evaluateAll(sc3.params);
assert(res3.recommendedAction === "DEFEND", `Scenario 03 recommends DEFEND (got ${res3.recommendedAction})`);

// 4. Test Scenario 07 (Rule-Limited Attack - 380 kW)
console.log("\n[4] Testing Scenario 07 (Rule-Limited Attack)...");
const sc7 = SCENARIO_LIST[6];
const rule7 = fiaRuleEngine.validateAction(sc7.params, "ATTACK", sc7.params.deploymentPower, true);
assert(rule7.status === "VIOLATION", "Scenario 07 triggers VIOLATION due to 380 kW request");
assert(rule7.recommendedLegalPower === 350, "Scenario 07 recommends 350 kW legal alternative");

// 5. Test 5 Demo Modes (Section 20)
console.log("\n[5] Testing 5 Predefined Demo Modes (Section 20)...");
assert(DEMO_PRESETS.length === 5, `Defined exactly 5 Demo presets (got ${DEMO_PRESETS.length})`);

// Demo 1: SOC = 80%, Gap = 0.6s, Closing = +9 km/h, Constraint = LOW -> ATTACK NOW
const d1Res = F1DecisionTwinEngine.evaluateAll(DEMO_PRESETS[0].params);
assert(d1Res.recommendedAction === "ATTACK", `Demo 1 yields ATTACK NOW (got ${d1Res.recommendedAction})`);

// Demo 2: SOC = 38%, Gap = 0.8s, Future opp = HIGH, Constraint = HIGH -> SAVE / WAIT
const d2Res = F1DecisionTwinEngine.evaluateAll(DEMO_PRESETS[1].params);
assert(d2Res.recommendedAction === "WAIT" || d2Res.recommendedAction === "SAVE", `Demo 2 yields WAIT / SAVE (got ${d2Res.recommendedAction})`);

// Demo 3: SOC = 55%, Opponent closing rapidly -> DEFEND
const d3Res = F1DecisionTwinEngine.evaluateAll(DEMO_PRESETS[2].params);
assert(d3Res.recommendedAction === "DEFEND", `Demo 3 yields DEFEND (got ${d3Res.recommendedAction})`);

// Demo 4: SOC = 63%, Current opp = MEDIUM, Future opp = VERY HIGH -> WAIT
const d4Res = F1DecisionTwinEngine.evaluateAll(DEMO_PRESETS[3].params);
assert(d4Res.recommendedAction === "WAIT", `Demo 4 yields WAIT (got ${d4Res.recommendedAction})`);

// Demo 5: SOC = 45%, Requested deployment = 380 kW (> 350 kW limit) -> RULE WARNING / LEGAL RECOMMENDATION (350 kW)
const d5Rule = fiaRuleEngine.validateAction(DEMO_PRESETS[4].params, "ATTACK", DEMO_PRESETS[4].params.deploymentPower, true);
assert(d5Rule.status === "VIOLATION", "Demo 5 detects regulatory VIOLATION");
assert(d5Rule.recommendedLegalPower === 350, "Demo 5 recommends legal deployment of 350 kW");

console.log("\n=======================================================");
console.log("=== ALL SCENARIO & DEMO TESTS PASSED!               ===");
console.log("=======================================================\n");
