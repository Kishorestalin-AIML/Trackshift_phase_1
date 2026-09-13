import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("==================================================================");
console.log("=== AUDITING LAPS REMAINING SLIDER REPLACEMENT & ENGINE SYNC   ===");
console.log("==================================================================");

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

const htmlPath = path.resolve("./index.html");
const appPath = path.resolve("./src/ui/EnergyDeploymentApp.js");
const html = fs.readFileSync(htmlPath, "utf-8");
const app = fs.readFileSync(appPath, "utf-8");

test("1. index.html contains #slider-laps-remaining and removes #slider-future-laps", () => {
  assert.ok(html.includes('id="slider-laps-remaining"'), "index.html must have #slider-laps-remaining");
  assert.ok(html.includes('id="val-laps-remaining"'), "index.html must have #val-laps-remaining");
  assert.ok(!html.includes('id="slider-future-laps"'), "index.html must NOT contain #slider-future-laps");
  assert.ok(html.includes("LAPS REMAINING"), "index.html must contain label 'LAPS REMAINING'");
});

test("2. EnergyDeploymentApp.js binds and synchronizes #slider-laps-remaining", () => {
  assert.ok(app.includes("slider-laps-remaining"), "App must reference slider-laps-remaining");
  assert.ok(app.includes("val-laps-remaining"), "App must reference val-laps-remaining");
  assert.ok(app.includes("lapsRemaining: 33"), "App initial state must define lapsRemaining: 33");
  assert.ok(app.includes("syncLapState"), "App must have syncLapState for bidirectional slider sync");
});

test("3. alpineDecisionTwinEngine validates input with lapsRemaining", () => {
  // Pass lapsRemaining directly without currentLap
  const parsed1 = alpineDecisionEngine.validateInputState({ lapsRemaining: 10 });
  assert.strictEqual(parsed1.lapsRemaining, 10, "lapsRemaining must be 10");
  assert.strictEqual(parsed1.currentLap, 47, "currentLap must be 57 - 10 = 47");

  // Pass currentLap directly
  const parsed2 = alpineDecisionEngine.validateInputState({ currentLap: 25 });
  assert.strictEqual(parsed2.currentLap, 25, "currentLap must be 25");
  assert.strictEqual(parsed2.lapsRemaining, 32, "lapsRemaining must be 57 - 25 = 32");

  // Default state
  const parsedDefault = alpineDecisionEngine.validateInputState({});
  assert.strictEqual(parsedDefault.currentLap, 24, "Default currentLap is 24");
  assert.strictEqual(parsedDefault.lapsRemaining, 33, "Default lapsRemaining is 33");
});

test("4. Simulation output exposes lapsRemaining and updates decisionTrace & auditState", () => {
  const sim = alpineDecisionEngine.simulate({ lapsRemaining: 5, soc: 60, position: 2, carAheadGap: 0.6 });
  assert.strictEqual(sim.lapsRemaining, 5, "sim.lapsRemaining must be 5");
  assert.strictEqual(sim.currentLap, 52, "sim.currentLap must be 52");
  assert.strictEqual(sim.centralRaceState.lapsRemaining, 5, "centralRaceState.lapsRemaining must be 5");
  assert.strictEqual(sim.auditState.inputState.lapsRemaining, 5, "auditState.inputState.lapsRemaining must be 5");

  // Check line 8 in decision trace includes laps remaining
  assert.ok(sim.decisionTrace[7].includes("5 laps remaining"), "Decision trace line 8 must mention 5 laps remaining");
});

console.log("==================================================================");
console.log("🎉 ALL LAPS REMAINING SLIDER & CAUSAL ENGINE AUDITS PASSED!       ");
console.log("==================================================================");
