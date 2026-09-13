/**
 * Strategy Optimization Operations & Constraint Slider Integration Test Suite
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("\n==================================================================");
console.log("=== AUDITING STRATEGY OPERATIONS & CONSTRAINT SLIDER INTEGRATION ===");
console.log("==================================================================\n");

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Candidate Operational Specifications (Power, Energy, Gain, Constraint Status)
console.log("[1] Testing Candidate Operational Specifications...");
runTest("All 4 candidate strategies expose complete operational metrics", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25
  });

  assert.ok(Array.isArray(sim.strategyComparison), "strategyComparison must be an array");
  assert.strictEqual(sim.strategyComparison.length, 4, "Must contain exactly 4 candidates");

  const candidates = {};
  sim.strategyComparison.forEach((c) => {
    candidates[c.name] = c;
    assert.ok(typeof c.powerKw === "number", `${c.name} must have numeric powerKw`);
    assert.ok(typeof c.powerLabel === "string", `${c.name} must have powerLabel`);
    assert.ok(typeof c.energyDeltaMJ === "number", `${c.name} must have numeric energyDeltaMJ`);
    assert.ok(typeof c.energyLabel === "string", `${c.name} must have energyLabel`);
    assert.ok(typeof c.expectedGainSec === "number", `${c.name} must have numeric expectedGainSec`);
    assert.ok(typeof c.expectedGainLabel === "string", `${c.name} must have expectedGainLabel`);
    assert.ok(typeof c.constraintRelation === "string", `${c.name} must have constraintRelation`);
    assert.ok(typeof c.constraintStatus === "string", `${c.name} must have constraintStatus`);
  });

  // Check SUPER-CLIP baseline
  const sc = candidates["SUPER-CLIP"];
  assert.strictEqual(sc.powerKw, 350, "Super-Clip baseline power should be 350 kW");
  assert.strictEqual(sc.energyDeltaMJ, -1.4, "Super-Clip baseline energy delta should be -1.40 MJ");
  assert.strictEqual(sc.expectedGainSec, 0.42, "Super-Clip baseline gain should be 0.42s");
  assert.strictEqual(sc.constraintStatus, "COMPLIANT", "Super-Clip baseline status should be COMPLIANT");

  // Check NORMAL DEPLOYMENT
  const norm = candidates["NORMAL DEPLOYMENT"];
  assert.strictEqual(norm.powerKw, 200, "Normal deployment power should be 200 kW");
  assert.strictEqual(norm.energyDeltaMJ, -0.8, "Normal deployment energy should be -0.80 MJ");
  assert.strictEqual(norm.expectedGainSec, 0.18, "Normal deployment gain should be 0.18s");

  // Check COAST
  const coast = candidates["COAST"];
  assert.strictEqual(coast.powerKw, 0, "Coast power should be 0 kW");
  assert.strictEqual(coast.energyDeltaMJ, -0.05, "Coast energy should be -0.05 MJ baseline draw");
  assert.strictEqual(coast.constraintStatus, "PRESERVATION", "Coast status should be PRESERVATION");

  // Check BRAKING / HARVEST
  const harvest = candidates["BRAKING / HARVEST"];
  assert.strictEqual(harvest.powerKw, -280, "Harvest regen power should be -280 kW");
  assert.ok(harvest.energyDeltaMJ >= 0, "Harvest energy delta must be non-negative");
  assert.strictEqual(harvest.constraintStatus, "HARVEST COMPLIANT", "Harvest status should be HARVEST COMPLIANT");
});

// 2. Constraint Slider Live Coupling & Power Clamping
console.log("\n[2] Testing Constraint Slider Live Coupling & Derating...");
runTest("Constraint slider at 85% derates Super-Clip power and restricts high gap", () => {
  const simHigh = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 1.1, // Gap > 0.8s high constraint limit
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 85
  });

  const sc = simHigh.strategyComparison.find((c) => c.name === "SUPER-CLIP");
  assert.ok(sc, "Super-Clip candidate must exist");
  assert.ok(sc.powerKw <= 302, `Super-Clip power (${sc.powerKw} kW) must be derated below 310 kW at 85% constraint`);
  assert.strictEqual(sc.constraintStatus, "RESTRICTED", "Super-Clip must be RESTRICTED when gap > 0.8s at high constraint");
  assert.notStrictEqual(simHigh.nextBestAction.strategy, "SUPER-CLIP", "High constraint must not recommend SUPER-CLIP with gap > 0.8s");
});

// 3. Argmax Optimality Guarantee
console.log("\n[3] Testing Argmax Optimality Guarantee...");
runTest("Winning candidate always has score >= all other candidate scores", () => {
  const testCases = [
    { soc: 62, gapA: 0.7, cLevel: 25 },
    { soc: 22, gapA: 0.7, cLevel: 25 },
    { soc: 62, gapA: 2.2, cLevel: 25 },
    { soc: 62, gapA: 0.7, cLevel: 90 },
    { soc: 40, gapA: 1.5, cLevel: 60 }
  ];

  testCases.forEach((tc, idx) => {
    const sim = alpineDecisionEngine.simulate({
      currentLap: 24,
      futureLaps: 3,
      position: 3,
      soc: tc.soc,
      carAheadGap: tc.gapA,
      carBehindGap: 1.4,
      intensity: 75,
      constraintLevel: tc.cLevel
    });

    const winner = sim.strategyComparison.find((c) => c.isRecommended);
    assert.ok(winner, `Test case ${idx}: Must have a recommended candidate`);
    sim.strategyComparison.forEach((c) => {
      if (!c.isRecommended) {
        assert.ok(
          winner.score >= c.score,
          `Test case ${idx}: Winner ${winner.name} (${winner.score}) must have score >= ${c.name} (${c.score})`
        );
      }
    });
  });
});

// 4. HTML Structure & DOM Element Audit
console.log("\n[4] Auditing HTML Structure & Strategy Operations Toolbar...");
runTest("HTML contains Strategy Operations Toolbar, synchronized slider, and inspection controls", () => {
  const htmlPath = path.resolve(__dirname, "../index.html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  assert.ok(html.includes('id="slider-strategy-constraint"'), "Must contain #slider-strategy-constraint");
  assert.ok(html.includes('id="val-strategy-constraint"'), "Must contain #val-strategy-constraint");
  assert.ok(html.includes('id="strat-inspect-status"'), "Must contain #strat-inspect-status");
  assert.ok(html.includes('id="strat-inspect-name"'), "Must contain #strat-inspect-name");
  assert.ok(html.includes('id="btn-reset-inspection"'), "Must contain #btn-reset-inspection");
  assert.ok(html.includes('id="strategy-comparison-grid"'), "Must contain #strategy-comparison-grid");
});

// 5. CSS Class Definition Audit
console.log("\n[5] Auditing CSS Rules for Strategy Operations...");
runTest("CSS defines all required styling rules for strategy operations", () => {
  const cssPath = path.resolve(__dirname, "../styles/trackshift.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert.ok(css.includes(".strat-operations-toolbar"), "CSS must define .strat-operations-toolbar");
  assert.ok(css.includes(".strat-slider-cell"), "CSS must define .strat-slider-cell");
  assert.ok(css.includes(".strat-inspect-cell"), "CSS must define .strat-inspect-cell");
  assert.ok(css.includes(".strat-specs-row"), "CSS must define .strat-specs-row");
  assert.ok(css.includes(".strat-constraint-banner"), "CSS must define .strat-constraint-banner");
  assert.ok(css.includes(".strategy-option-card.inspected"), "CSS must define .strategy-option-card.inspected");
  assert.ok(css.includes(".breakdown-inspect-banner"), "CSS must define .breakdown-inspect-banner");
});

console.log("\n==================================================================");
console.log("🎉 ALL STRATEGY OPERATIONS & CONSTRAINT SLIDER TESTS PASSED!   ===");
console.log("==================================================================\n");
