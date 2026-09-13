/**
 * TEST SUITE: Simple Interactive F1 2026 Energy & Overtake Digital Twin
 */

import fs from "fs";
import path from "path";
import { SimpleTwinEngine } from "../src/engine/simpleTwinEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING SIMPLE F1 2026 DIGITAL TWIN TEST SUITE  ===");
console.log("=======================================================\n");

// 1. Audit DOM Architecture (Map-Free & 4 Controls Requirement)
console.log("[1] Auditing index.html for Single-Screen Layout & 4 Controls...");
const html = fs.readFileSync(path.resolve("index.html"), "utf-8");

assert(!html.includes("mount-map-stage"), "Circuit map element is NOT present");
assert(html.includes("id=\"slider-soc\""), "Contains Control 1: Battery SOC (#slider-soc)");
assert(html.includes("id=\"slider-constraint\""), "Contains Control 2: FIA Constraint (#slider-constraint)");
assert(html.includes("id=\"slider-deploy\""), "Contains Control 3: Energy Deployment (#slider-deploy)");
assert(html.includes("id=\"slider-opportunity\""), "Contains Control 4: Overtake Opportunity (#slider-opportunity)");
assert(html.includes("id=\"simple-track-canvas\""), "Contains simple horizontal 2-car race track (#simple-track-canvas)");
assert(html.includes("id=\"finite-battery-fill\""), "Contains finite battery bar (#finite-battery-fill)");
assert(html.includes("id=\"btn-run-overtake\""), "Contains Run Overtake button (#btn-run-overtake)");
assert(html.includes("id=\"btn-try-optimal\""), "Contains TRY OPTIMAL button (#btn-try-optimal)");
assert(html.includes("id=\"result-strip\""), "Contains 4-value result strip (#result-strip)");

// 2. Audit CSS Viewport Lock
console.log("\n[2] Auditing trackshift.css Viewport Height & Styling...");
const css = fs.readFileSync(path.resolve("styles/trackshift.css"), "utf-8");
assert(css.includes("100vh"), "Enforces 100vh viewport height");
assert(css.includes("overflow: hidden"), "Prevents body page scrolling");
assert(css.includes(".twin-console-container"), "Contains centered console container styling");

// 3. Test FIA Constraint Clamping & Status
console.log("\n[3] Testing FIA Constraint Clamping & Status Checks...");
const lowLegalPower = SimpleTwinEngine.getMaxLegalPower(0);
assert(lowLegalPower === 350, "Constraint LOW (0%) allows 350 kW maximum legal power");

const highLegalPower = SimpleTwinEngine.getMaxLegalPower(100);
assert(highLegalPower === 200, "Constraint HIGH (100%) restricts legal power to 200 kW");

// Clamping test: requested 320 kW under 50% constraint (max legal: 275 kW)
const fiaCheck = SimpleTwinEngine.getFiaStatus(320, 50, 60);
assert(fiaCheck.status === "LIMITED", "Exceeding constraint triggers LIMITED status");
assert(fiaCheck.clampedPowerKw === 275, "Deployment is clamped to legal max (275 kW)");

// 4. Test Demo A: Overtake Success
console.log("\n[4] Testing Demo A: Sufficient Energy + Low Constraint -> Overtake Success...");
const simSuccess = SimpleTwinEngine.simulate({
  soc: 70,
  constraintPct: 15,
  deploymentPct: 85, // ~298 kW
  opportunityPct: 80
});

assert(simSuccess.success === true, "Overtake succeeds under favorable conditions");
assert(simSuccess.resultText === "OVERTAKE SUCCESS", "Result text is OVERTAKE SUCCESS");
assert(simSuccess.positionChange === "P2 → P1", "Position changes from P2 to P1");
assert(simSuccess.energyUsedMJ > 0.5, `Energy is consumed (${simSuccess.energyUsedMJ} MJ used)`);
assert(simSuccess.remainingSoc < 70, `SOC decreases (${simSuccess.remainingSoc}% remaining)`);
assert(simSuccess.fiaStatus === "LEGAL", "FIA status is LEGAL");

// 5. Test Demo B: Low Energy Failure & "TRY OPTIMAL" Resolution
console.log("\n[5] Testing Demo B: Low Energy Failure & TRY OPTIMAL Resolution...");
const simFail = SimpleTwinEngine.simulate({
  soc: 25,
  constraintPct: 85,
  deploymentPct: 85,
  opportunityPct: 80
});

assert(simFail.success === false, "Overtake is rejected due to low energy/high constraint");
assert(simFail.resultText === "OVERTAKE NOT POSSIBLE", "Result text is OVERTAKE NOT POSSIBLE");
assert(simFail.failureReason.length > 0, `Failure reason is provided (${simFail.failureReason})`);
assert(simFail.tryRecommendation.includes("TRY: SAVE"), "Recommends TRY: SAVE strategy");
assert(simFail.optimalConfig !== null, "Generates optimal alternative configuration");

// Execute "TRY OPTIMAL" resolution
const optimalSim = SimpleTwinEngine.simulate(simFail.optimalConfig);
assert(optimalSim.success === true, "TRY OPTIMAL configuration successfully executes overtake");
assert(optimalSim.resultText === "OVERTAKE SUCCESS", "TRY OPTIMAL achieves OVERTAKE SUCCESS");

console.log("\n=======================================================");
console.log("=== ALL SIMPLE F1 2026 DIGITAL TWIN TESTS PASSED!   ===");
console.log("=======================================================\n");
