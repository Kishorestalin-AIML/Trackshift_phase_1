/**
 * SECTION 37: AUTOMATED CORRELATION TEST (runDependencyAudit)
 *
 * Verifies that changing each of the 11 major inputs:
 * 1. Battery SOC
 * 2. Current Lap
 * 3. Position
 * 4. Gap Ahead
 * 5. Gap Behind
 * 6. Future Laps
 * 7. Tyre Compound
 * 8. Tyre Age
 * 9. Track Condition
 * 10. Constraint Level
 * 11. Deployment Intensity
 *
 * Causes deterministic, measurable changes in downstream calculations.
 * If ANY input produces no downstream changes, it is flagged as DISCONNECTED.
 */

import assert from "assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("\n=======================================================");
console.log("🔍 RUNNING SECTION 37: DEPENDENCY CORRELATION AUDIT");
console.log("=======================================================\n");

const audit = alpineDecisionEngine.runDependencyAudit();

console.log(`Total Inputs Audited : ${audit.totalAudited}`);
console.log(`Connected Inputs     : ${audit.connectedCount}`);
console.log(`Disconnected Inputs  : ${audit.disconnectedCount}`);
console.log(`Audit Passed         : ${audit.passed}\n`);

console.log("Detailed Input Results:");
for (const [key, res] of Object.entries(audit.results)) {
  const icon = res.status === "CONNECTED" ? "✅" : "❌";
  console.log(`  ${icon} [${res.status}] ${res.label} (${res.input}):`);
  res.downstreamChanges.forEach((change) => {
    console.log(`      ↳ ${change}`);
  });
}

assert.strictEqual(audit.totalAudited, 11, "Must audit exactly 11 major inputs specified in Section 37");
assert.strictEqual(audit.connectedCount, 11, "All 11 inputs must be connected to downstream calculations");
assert.strictEqual(audit.disconnectedCount, 0, "Zero inputs may be disconnected or decorative");
assert.strictEqual(audit.passed, true, "Overall audit status must be passed === true");

console.log("\n=======================================================");
console.log("🎉 SECTION 37 AUDIT PASSED: 100% INPUTS CONNECTED!");
console.log("=======================================================\n");
