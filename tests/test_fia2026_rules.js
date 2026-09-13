/**
 * TEST SUITE: 2026 FIA Constraint Engine & Deterministic Rule Validation
 */

import { Fia2026RuleEngine, DEFAULT_FIA_2026_RULE_PROFILE } from "../src/engine/fia2026RuleEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING 2026 FIA CONSTRAINT ENGINE TEST SUITE   ===");
console.log("=======================================================\n");

const engine = new Fia2026RuleEngine();

// 1. Profile Verification
console.log("[1] Verifying 2026 FIA Rule Profile Object...");
const profile = engine.getProfile();
assert(profile.accelerationZoneLimitKw === 350, "Acceleration zone limit is 350 kW");
assert(profile.standardZoneLimitKw === 250, "Standard zone limit is 250 kW");
assert(profile.raceBoostCapKw === 150, "Race boost cap is +150 kW");
assert(profile.maxLapDeploymentMJ === 4.00, "Maximum lap deployment quota is 4.00 MJ");
assert(profile.socReserveFloorPct === 15.0, "SOC safety reserve floor is 15.0%");

// 2. Deterministic Legality Verification
console.log("\n[2] Testing Deterministic Legality Checks...");
const legalState = { soc: 62, deploymentPower: 280 };
const resLegal = engine.validateAction(legalState, "ATTACK", 280, true);
assert(resLegal.status === "LEGAL", "280 kW deployment in acceleration zone is LEGAL");
assert(resLegal.recommendedLegalPower === 280, "Recommended legal power matches request (280 kW)");

// 3. 350 kW Limit Violation & Nearest Legal Alternative (Section 9)
console.log("\n[3] Testing Regulatory Power Violations & Recalibration...");
const illegalState = { soc: 62, deploymentPower: 380 };
const resViolation = engine.validateAction(illegalState, "ATTACK", 380, true);
assert(resViolation.status === "VIOLATION", "380 kW deployment triggers VIOLATION");
assert(resViolation.recommendedLegalPower === 350, "Automatically calculates nearest legal alternative: 350 kW");
assert(resViolation.reason.includes("exceeds configured 350 kW"), "Explanation notes 350 kW limit");

// 4. Standard Sector Limit Check
console.log("\n[4] Testing Technical Sector Limits (250 kW)...");
const cornerState = { soc: 50, deploymentPower: 280 };
const resCorner = engine.validateAction(cornerState, "ATTACK", 280, false);
assert(resCorner.status === "WARNING", "280 kW in technical sector triggers WARNING");
assert(resCorner.recommendedLegalPower === 250, "Recommends 250 kW for technical sector");

// 5. Battery Safety Reserve Floor Check
console.log("\n[5] Testing 15% SOC Safety Reserve Floor...");
const lowSocState = { soc: 12, deploymentPower: 200 };
const resLowSoc = engine.validateAction(lowSocState, "ATTACK", 200, true);
assert(resLowSoc.status === "VIOLATION", "12% SOC triggers safety floor VIOLATION");
assert(resLowSoc.recommendedLegalPower === 0, "Discharge prohibited below floor (0 kW)");

// 6. Energy Boundaries Check
console.log("\n[6] Testing Energy State Boundaries...");
const es = engine.getEnergyStateMetrics(62, 4.00);
assert(es.currentEnergyMJ === 2.48, "62% SOC yields 2.48 MJ");
assert(es.minEnergyMJ === 0.60, "15% floor yields 0.60 MJ");
assert(es.maxEnergyMJ === 4.00, "Max capacity is 4.00 MJ");
assert(es.energySwingMJ === 3.40, "Usable energy swing is 3.40 MJ");

console.log("\n=======================================================");
console.log("=== ALL 2026 FIA RULE ENGINE TESTS PASSED!          ===");
console.log("=======================================================\n");
