/**
 * AUTOMATED TEST SUITE: ALPINE F1 2026 ENERGY & OVERTAKE DIGITAL TWIN
 *
 * Tests:
 * 1. DOM Architecture (Alpine brand, clean white theme, compact RACE SITUATION controls, 3-car track)
 * 2. Real-time dynamic decision scoring across all 7 inputs
 * 3. Position logic (P1 leader defense vs P2-P8 aggression)
 * 4. Car behind pressure (< 0.5s DEFENSIVE PRESSURE)
 * 5. Lap distance logic (early race conservation vs final lap aggression)
 * 6. FIA 2026 constraint evaluation & legal clamping
 * 7. "OVERCOME CONSTRAINT" Adaptation engine
 * 8. Simulation execution (success, failure reasons, position transition)
 */

import fs from "fs";
import path from "path";
import { AlpineTwinEngine } from "../src/engine/alpineTwinEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("=== RUNNING ALPINE F1 2026 DIGITAL TWIN TEST SUITE  ===");
console.log("=======================================================\n");

// 1. Audit DOM Architecture
console.log("[1] Auditing index.html for Alpine Brand & Clean Controls...");
const html = fs.readFileSync(path.resolve("index.html"), "utf-8");

assert(html.includes("ALPINE"), "Contains ALPINE brand header");
assert(html.includes("ENERGY & OVERTAKE TWIN"), "Contains ENERGY & OVERTAKE TWIN subtitle");
assert(html.includes("RACE SITUATION"), "Contains compact RACE SITUATION section");
assert(html.includes("id=\"slider-current-lap\""), "Contains Current Lap slider");
assert(html.includes("id=\"slider-laps-remaining\""), "Contains Laps Remaining slider");
assert(html.includes("pos-selector-group"), "Contains Position P1-P8 selector group");
assert(html.includes("data-position=\"1\"") && html.includes("data-position=\"8\""), "Contains buttons from P1 to P8");
assert(html.includes("id=\"slider-car-behind\""), "Contains Car Behind Gap slider");
assert(html.includes("id=\"slider-car-ahead\""), "Contains Car Ahead Gap slider");
assert(html.includes("id=\"slider-soc\""), "Contains Battery SOC slider");
assert(html.includes("id=\"slider-constraint\""), "Contains FIA Constraint slider");
assert(html.includes("id=\"alpine-track-canvas\""), "Contains 3-car horizontal canvas track");
assert(html.includes("id=\"finite-battery-fill\""), "Contains finite battery bar");
assert(html.includes("id=\"primary-rec-badge\""), "Contains Primary Recommendation badge");
assert(html.includes("id=\"adaptation-banner\""), "Contains Strategy Adaptation banner");
assert(html.includes("id=\"btn-adapt-strategy\""), "Contains ADAPT STRATEGY button");
assert(html.includes("id=\"btn-run-simulation\""), "Contains RUN SIMULATION button");
assert(html.includes("minimal-result-panel"), "Contains Minimal 5-item Result Panel");

// 2. Audit CSS Theme (White + Alpine Blue)
console.log("\n[2] Auditing trackshift.css for Clean White + Alpine Blue Theme...");
const css = fs.readFileSync(path.resolve("styles/trackshift.css"), "utf-8");
assert(css.includes("--alpine-blue: #0090ff"), "Defines primary Alpine Blue brand color");
assert(css.includes("--bg-page: #f8fafc") || css.includes("--bg-page: #ffffff"), "Defines clean white/light page background");
assert(css.includes(".pos-pill"), "Styles position P1-P8 selector pills");
assert(css.includes(".rec-badge.attack"), "Styles ATTACK recommendation badge");
assert(css.includes(".rec-badge.defend"), "Styles DEFEND recommendation badge");

// 3. Test Dynamic Decision Scoring & Constraint Logic
console.log("\n[3] Testing Dynamic Decision Scoring Engine...");

// Default baseline: P3, 0.7s behind, 0.8s ahead, 58% SOC, 25% constraint
const baseline = AlpineTwinEngine.evaluate({
  currentLap: 24,
  lapsRemaining: 33,
  position: 3,
  carBehindGap: 0.7,
  carAheadGap: 0.8,
  soc: 58,
  constraintPct: 25
});
assert(baseline.recommendation === "ATTACK", `Baseline state recommends ATTACK (got ${baseline.recommendation})`);
assert(baseline.targetPosition === "P2", `Target position is P2 (got ${baseline.targetPosition})`);
assert(baseline.fiaStatus === "LEGAL", `FIA status is LEGAL`);
assert(baseline.why.length > 10, `Generates engineering justification: "${baseline.why}"`);

// Scenario A: Low SOC (25%) -> SAVE
console.log("\n[4] Testing Low SOC constraint (< 30%)...");
const lowSoc = AlpineTwinEngine.evaluate({
  currentLap: 24,
  lapsRemaining: 33,
  position: 3,
  carBehindGap: 1.5,
  carAheadGap: 0.8,
  soc: 25,
  constraintPct: 25
});
assert(lowSoc.recommendation === "SAVE" || lowSoc.recommendation === "WAIT", `Low SOC recommends SAVE or WAIT (got ${lowSoc.recommendation})`);
assert(lowSoc.adaptationNeeded === true, "Triggers adaptation requirement");

// Scenario B: Car Behind Pressure (< 0.5s) -> DEFEND
console.log("\n[5] Testing Defensive Pressure (Car Behind < 0.5s)...");
const defPressure = AlpineTwinEngine.evaluate({
  currentLap: 24,
  lapsRemaining: 33,
  position: 3,
  carBehindGap: 0.4,
  carAheadGap: 0.8,
  soc: 60,
  constraintPct: 20
});
assert(defPressure.recommendation === "DEFEND", `Car behind within 0.4s recommends DEFEND (got ${defPressure.recommendation})`);
assert(defPressure.hasDefensivePressure === true, "Flags defensive pressure");
assert(defPressure.why.includes("DEFENSIVE PRESSURE"), "Why notes DEFENSIVE PRESSURE");

// Scenario C: Final Laps Aggression (2 laps remaining) -> ATTACK
console.log("\n[6] Testing Few Laps Remaining (2 laps remaining)...");
const finalLaps = AlpineTwinEngine.evaluate({
  currentLap: 55,
  lapsRemaining: 2,
  position: 4,
  carBehindGap: 1.2,
  carAheadGap: 0.9,
  soc: 45,
  constraintPct: 30
});
assert(finalLaps.recommendation === "ATTACK", `Few laps remaining favors immediate ATTACK (got ${finalLaps.recommendation})`);

// Scenario D: P1 Race Leader -> DEFEND / SAVE
console.log("\n[7] Testing Position Logic: P1 Race Leader...");
const p1Leader = AlpineTwinEngine.evaluate({
  currentLap: 24,
  lapsRemaining: 33,
  position: 1,
  carBehindGap: 0.7,
  carAheadGap: 0.0,
  soc: 60,
  constraintPct: 20
});
assert(p1Leader.recommendation === "DEFEND" || p1Leader.recommendation === "SAVE", `P1 leader prioritizes DEFEND or SAVE (got ${p1Leader.recommendation})`);
assert(p1Leader.scores.ATTACK < -500, "P1 cannot attack ahead");

// Scenario E: High FIA Constraint (100) -> Restricted Deployment
console.log("\n[8] Testing High FIA Constraint...");
const highConstraint = AlpineTwinEngine.evaluate({
  currentLap: 24,
  lapsRemaining: 33,
  position: 3,
  carBehindGap: 1.5,
  carAheadGap: 1.4,
  soc: 50,
  constraintPct: 85
});
assert(highConstraint.maxLegalPower <= 230, `Max legal power restricted (got ${highConstraint.maxLegalPower} kW)`);
assert(highConstraint.recommendation === "WAIT" || highConstraint.recommendation === "SAVE", `High constraint recommends WAIT or SAVE (got ${highConstraint.recommendation})`);

// 4. Test "OVERCOME CONSTRAINT" Adaptation Feature
console.log("\n[9] Testing 'OVERCOME CONSTRAINT' Adaptation Engine...");
const blockedAttack = AlpineTwinEngine.evaluate({
  currentLap: 24,
  lapsRemaining: 33,
  position: 3,
  carBehindGap: 0.4, // Pressure
  carAheadGap: 0.7,
  soc: 32, // Low
  constraintPct: 75 // High constraint
});
assert(blockedAttack.recommendation !== "ATTACK", "Immediate attack is blocked under severe constraints");
assert(blockedAttack.adaptationNeeded === true, "Adaptation is flagged as needed");
assert(blockedAttack.adaptedConfig !== null, "Generates adapted configuration");

// Simulate the adapted configuration
const adaptedResult = AlpineTwinEngine.simulateOvertake(blockedAttack.adaptedConfig);
assert(adaptedResult.recommendation === "ATTACK", "Adapted configuration opens ATTACK window");
assert(adaptedResult.success === true, "Adapted simulation achieves OVERTAKE SUCCESS");
assert(adaptedResult.resultTitle === "OVERTAKE SUCCESS", "Outcome title is OVERTAKE SUCCESS");

// 5. Test Simulation Execution (Success & Failure Handlers)
console.log("\n[10] Testing Simulation Execution Outcomes...");
const simSuccess = AlpineTwinEngine.simulateOvertake({
  currentLap: 24,
  lapsRemaining: 33,
  position: 3,
  carBehindGap: 1.5,
  carAheadGap: 0.7,
  soc: 65,
  constraintPct: 20
});
assert(simSuccess.success === true, "Simulation succeeds under favorable conditions");
assert(simSuccess.resultSummary === "P3 → P2", "Position moves from P3 to P2");
assert(simSuccess.energyDisplay.includes("→"), "Shows energy transition (e.g. 65% -> 48%)");

console.log("\n=======================================================");
console.log("=== ALL ALPINE F1 2026 DIGITAL TWIN TESTS PASSED!   ===");
console.log("=======================================================\n");
