import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("==================================================================");
console.log("=== AUDITING SECTION K (DECISION TRACE & AUDIT MODE) DOM + CSS ===");
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
const cssPath = path.resolve("./styles/trackshift.css");
const appPath = path.resolve("./src/ui/EnergyDeploymentApp.js");

const html = fs.readFileSync(htmlPath, "utf-8");
const css = fs.readFileSync(cssPath, "utf-8");
const app = fs.readFileSync(appPath, "utf-8");

test("1. Checking Section K HTML structure and element IDs in index.html", () => {
  const ids = [
    "decision-trace-audit-section",
    "btn-toggle-trace",
    "decision-trace-box",
    "trace-winner-badge",
    "trace-lines-grid",
    "internal-audit-panel",
    "audit-category-grid"
  ];
  ids.forEach(id => {
    assert.ok(html.includes(`id="${id}"`), `index.html must contain id="${id}"`);
  });
});

test("2. Checking Section K CSS classes in styles/trackshift.css", () => {
  const classes = [
    ".decision-trace-audit-section",
    ".btn-toggle-trace",
    ".decision-trace-box",
    ".trace-header",
    ".trace-badge",
    ".trace-winner-badge",
    ".trace-lines-grid",
    ".trace-line-item",
    ".trace-num",
    ".trace-text",
    ".internal-audit-panel",
    ".audit-header",
    ".audit-title",
    ".audit-category-grid",
    ".audit-cat-card",
    ".audit-cat-title",
    ".audit-cat-rows",
    ".audit-row",
    ".audit-lbl",
    ".audit-val"
  ];
  classes.forEach(cls => {
    assert.ok(css.includes(cls), `trackshift.css must define class ${cls}`);
  });
});

test("3. Checking UI controller wiring in EnergyDeploymentApp.js", () => {
  assert.ok(app.includes("btn-toggle-trace"), "Must bind btn-toggle-trace");
  assert.ok(app.includes("trace-winner-badge"), "Must update trace-winner-badge");
  assert.ok(app.includes("trace-lines-grid"), "Must populate trace-lines-grid");
  assert.ok(app.includes("audit-category-grid"), "Must populate audit-category-grid");
  assert.ok(app.includes("updateDecisionTraceAndAuditUI"), "Must define updateDecisionTraceAndAuditUI");
});

test("4. Checking Engine Decision Trace and Audit State generation", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 12,
    trackCondition: "DRY"
  });

  assert.ok(Array.isArray(sim.decisionTrace), "sim.decisionTrace must be an array");
  assert.strictEqual(sim.decisionTrace.length, 12, "decisionTrace must contain 12 points");

  assert.ok(sim.auditState, "sim.auditState must exist");
  assert.ok(sim.auditState.inputState, "auditState.inputState must exist");
  assert.ok(sim.auditState.energyState, "auditState.energyState must exist");
  assert.ok(sim.auditState.reserveState, "auditState.reserveState must exist");
  assert.ok(sim.auditState.freeEnergyState, "auditState.freeEnergyState must exist");
  assert.ok(sim.auditState.tyreState, "auditState.tyreState must exist");
  assert.ok(sim.auditState.pitState, "auditState.pitState must exist");
  assert.ok(sim.auditState.zoneState, "auditState.zoneState must exist");
  assert.ok(sim.auditState.recoveryState, "auditState.recoveryState must exist");
  assert.ok(sim.auditState.attackState, "auditState.attackState must exist");
  assert.ok(sim.auditState.defenceState, "auditState.defenceState must exist");
  assert.ok(sim.auditState.constraints, "auditState.constraints must exist");
  assert.ok(sim.auditState.candidateActions, "auditState.candidateActions must exist");
  assert.ok(sim.auditState.simulatedOutcomes, "auditState.simulatedOutcomes must exist");
  assert.ok(sim.auditState.finalDecision, "auditState.finalDecision must exist");
});

console.log("==================================================================");
console.log("🎉 ALL SECTION K DOM, CSS & ENGINE AUDITS PASSED SUCCESSFULLY! ===");
console.log("==================================================================");
