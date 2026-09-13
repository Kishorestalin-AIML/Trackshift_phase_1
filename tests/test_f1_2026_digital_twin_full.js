/**
 * TEST SUITE: Full Integration & DOM Architecture Audit for F1 2026 Digital Twin
 */

import fs from "fs";
import path from "path";
import { twinStore } from "../src/state/twinState.js";
import { fiaRuleEngine } from "../src/engine/fia2026RuleEngine.js";
import { F1DecisionTwinEngine } from "../src/engine/f1DecisionTwinEngine.js";
import { SCENARIO_LIST } from "../src/engine/scenarioLibrary.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== AUDITING F1 2026 ENERGY & OVERTAKE DIGITAL TWIN ===");
console.log("=======================================================\n");

// 1. Verify index.html Architecture (Map-Free Requirement)
console.log("[1] Auditing index.html Architecture...");
const htmlContent = fs.readFileSync(path.resolve("index.html"), "utf-8");

assert(!htmlContent.includes("mount-map-stage"), "Circuit map element is REMOVED (Map-free requirement)");
assert(htmlContent.includes("mount-race-twin"), "Contains horizontal race twin mount (#mount-race-twin)");
assert(htmlContent.includes("mount-battery-bar"), "Contains real-time battery bar mount (#mount-battery-bar)");
assert(htmlContent.includes("mount-race-state"), "Contains race state input panel mount (#mount-race-state)");
assert(htmlContent.includes("mount-decision-card"), "Contains central decision card mount (#mount-decision-card)");
assert(htmlContent.includes("mount-scenario-timeline"), "Contains scenario timeline mount (#mount-scenario-timeline)");
assert(htmlContent.includes("mount-fia-panel"), "Contains 2026 FIA rule panel mount (#mount-fia-panel)");
assert(htmlContent.includes("mount-counterfactual"), "Contains counterfactual what-if mount (#mount-counterfactual)");
assert(htmlContent.includes("mount-constraint-impact"), "Contains constraint impact mount (#mount-constraint-impact)");
assert(htmlContent.includes("mount-controls-bar"), "Contains simulation controls mount (#mount-controls-bar)");

// 2. Verify trackshift.css Styling
console.log("\n[2] Auditing trackshift.css Motorsport Design...");
const cssContent = fs.readFileSync(path.resolve("styles/trackshift.css"), "utf-8");
assert(cssContent.includes("100vh"), "Enforces 100vh viewport height");
assert(cssContent.includes("overflow: hidden"), "Prevents body page scrolling");
assert(cssContent.includes(".twin-workstation"), "Defines 3-column workstation layout");
assert(cssContent.includes(".battery-track"), "Defines battery track styling");
assert(cssContent.includes(".opportunity-cost-container"), "Defines opportunity cost container");
assert(cssContent.includes(".timeline-stages-grid"), "Defines 7-stage timeline grid");

// 3. Central Reactive twinStore Audit
console.log("\n[3] Auditing Central twinStore & Reactive Energy Model...");
const s = twinStore.getState();
assert(s.soc === 62, "Initial SOC is 62%");
assert(s.availableEnergy === 2.48, "62% SOC converts to 2.48 MJ (4.00 MJ buffer)");
assert(s.gap === 0.80, "Initial gap is 0.80 s");
assert(s.closingSpeed === 8.0, "Initial closing speed is +8.0 km/h");
assert(s.deploymentPower === 280, "Initial deployment is 280 kW");
assert(s.constraintLevel === 2, "Initial constraint level is Level 2 (MODERATE)");

// Test SOC auto-conversion to MJ
twinStore.setState({ soc: 75 });
assert(twinStore.getState().availableEnergy === 3.00, "75% SOC auto-calculates 3.00 MJ available energy");
twinStore.setState({ soc: 62 }); // reset

// 4. Closed Loop: User Input -> Rule Engine -> Decision Engine -> Simulation Update
console.log("\n[4] Auditing Complete Decision Loop...");
// User changes deployment to 380 kW (Violation)
const stateViol = { ...twinStore.getState(), deploymentPower: 380 };
const ruleCheck = fiaRuleEngine.validateAction(stateViol, "ATTACK", 380, true);
assert(ruleCheck.status === "VIOLATION", "Rule check catches 380 kW violation");
assert(ruleCheck.recommendedLegalPower === 350, "Calculates legal alternative: 350 kW");

// Evaluation handles violation gracefully
const evalViol = F1DecisionTwinEngine.evaluateAll(stateViol);
const attackStrat = evalViol.strategies.find(st => st.id === "ATTACK");
assert(attackStrat.ruleStatus === "VIOLATION", "Attack strategy is flagged as VIOLATION");
assert(evalViol.recommendedAction !== "ATTACK", "Optimizer rejects illegal attack and selects valid alternative (WAIT)");

console.log("\n=======================================================");
console.log("=== ALL FULL APP INTEGRATION AUDITS PASSED!         ===");
console.log("=======================================================\n");
