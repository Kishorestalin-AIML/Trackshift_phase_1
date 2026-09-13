import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("==================================================================");
console.log("=== AUDITING FUTURE OPPORTUNITY COMPARISON & 4 STRATEGIES      ===");
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
const cssPath = path.resolve("./styles/trackshift.css");
const html = fs.readFileSync(htmlPath, "utf-8");
const app = fs.readFileSync(appPath, "utf-8");
const css = fs.readFileSync(cssPath, "utf-8");

test("1. Engine produces 4 distinct strategic ways and factors in tradeoffComparison", () => {
  const sim = alpineDecisionEngine.simulate({ soc: 60, position: 2, carAheadGap: 0.6, carBehindGap: 1.4 });
  assert.ok(sim.tradeoffComparison, "sim must have tradeoffComparison");
  assert.ok(Array.isArray(sim.tradeoffComparison.strategicWays), "strategicWays must be an array");
  assert.strictEqual(sim.tradeoffComparison.strategicWays.length, 4, "Must have exactly 4 strategic ways");

  const stratIds = sim.tradeoffComparison.strategicWays.map(s => s.id);
  assert.ok(stratIds.includes("super_clip"), "Must contain super_clip strategy");
  assert.ok(stratIds.includes("normal"), "Must contain normal deployment strategy");
  assert.ok(stratIds.includes("coast"), "Must contain coast strategy");
  assert.ok(stratIds.includes("harvest"), "Must contain harvest/braking strategy");

  // Verify factors object
  assert.ok(sim.tradeoffComparison.factors, "tradeoffComparison must have factors object");
  assert.ok(sim.tradeoffComparison.factors.soc, "factors must have soc factor");
  assert.ok(sim.tradeoffComparison.factors.carAhead, "factors must have carAhead factor");
  assert.ok(sim.tradeoffComparison.factors.carBehind, "factors must have carBehind factor");
  assert.strictEqual(sim.tradeoffComparison.factors.soc.percent, 60, "SOC percent matches input");
  assert.strictEqual(sim.tradeoffComparison.factors.carAhead.inDrsWindow, true, "Gap 0.6s is in DRS window");
  assert.strictEqual(sim.tradeoffComparison.factors.carBehind.hasDefensiveThreat, false, "Behind 1.4s has no threat");

  // Verify properties on each strategy
  sim.tradeoffComparison.strategicWays.forEach(s => {
    assert.ok(typeof s.name === "string", "Strategy must have a name");
    assert.ok(typeof s.score === "number", "Strategy must have a score");
    assert.ok(typeof s.powerKw === "number", "Strategy must have powerKw");
    assert.ok(typeof s.energyDeltaMJ === "number", "Strategy must have energyDeltaMJ");
    assert.ok(typeof s.expectedGainSec === "number", "Strategy must have expectedGainSec");
    assert.ok(typeof s.overtakeProb === "number", "Strategy must have overtakeProb");
    assert.ok(typeof s.isFeasible === "boolean", "Strategy must have isFeasible flag");
    assert.ok(typeof s.isRecommended === "boolean", "Strategy must have isRecommended flag");
  });
});

test("2. Causal Dynamic Decision: High SOC with attack opportunity selects SPEND NOW (SUPER-CLIP)", () => {
  const simAttack = alpineDecisionEngine.simulate({ soc: 65, position: 2, carAheadGap: 0.5, carBehindGap: 1.5 });
  const t = simAttack.tradeoffComparison;

  assert.strictEqual(t.recommendation, "SPEND NOW", "Recommendation must be SPEND NOW");
  assert.strictEqual(t.decisionMode, "SPEND_NOW", "decisionMode must be SPEND_NOW");
  assert.ok(t.tactic.includes("SUPER-CLIP"), "Tactic should indicate SUPER-CLIP deploy");

  const superClip = t.strategicWays.find(s => s.id === "super_clip");
  assert.ok(superClip.isRecommended, "Super-clip must be recommended when attacking with abundant SOC");
  assert.strictEqual(superClip.powerKw, 350, "Super-clip power must be 350 kW");
  assert.ok(superClip.score >= 90, "Super-clip score must be >= 90");
});

test("3. Causal Dynamic Decision: Critical Low SOC triggers HARVEST NOW with NOTHING TO SAVE", () => {
  const simLowSOC = alpineDecisionEngine.simulate({ soc: 20, position: 2, carAheadGap: 0.8, carBehindGap: 1.5 });
  const t = simLowSOC.tradeoffComparison;

  assert.ok(t.recommendation.includes("HARVEST") || t.recommendation === "SAVE FOR LATER", "Recommendation must prescribe HARVEST or SAVE");
  assert.strictEqual(t.decisionMode, "HARVEST_NOW", "decisionMode must be HARVEST_NOW");
  assert.ok(t.tactic.includes("HARVEST"), "Tactic must prescribe harvest");

  const superClip = t.strategicWays.find(s => s.id === "super_clip");
  const harvest = t.strategicWays.find(s => s.id === "harvest");

  assert.strictEqual(superClip.isFeasible, false, "Super-clip must be INFEASIBLE when SOC is critically low");
  assert.ok(superClip.statusLabel.includes("INFEASIBLE"), "Status label must indicate infeasible");
  assert.ok(harvest.isRecommended, "Harvest must be recommended when SOC is depleted");
  assert.ok(t.factors.soc.status.includes("NOTHING TO SAVE"), "Factor status must include NOTHING TO SAVE");
  assert.strictEqual(t.factors.soc.action, "RECHARGE VIA MGU-K", "Factor action must specify RECHARGE VIA MGU-K");

  // Verify Energy Productivity & Worthwhile Assessment
  assert.ok(t.productivity, "tradeoffComparison must contain productivity object");
  assert.strictEqual(t.productivity.isWorthwhile, false, "Deploying must be marked NOT worthwhile when battery is depleted");
  assert.strictEqual(t.productivity.badgeClass, "unviable", "Productivity badgeClass must be unviable");
  assert.ok(t.productivity.rating.includes("NOTHING TO SAVE"), "Productivity rating must declare nothing to save");
  assert.ok(t.productivity.worthwhileLabel.includes("NOTHING TO SAVE"), "Productivity label must state nothing to save");
  assert.strictEqual(t.productivity.energyROI, 0.0, "Energy ROI must be 0 for depleted battery");
  assert.ok(t.optionA.title.includes("HARVEST NOW"), "Option A title must be HARVEST NOW");
  assert.ok(t.optionA.description.includes("nothing to save"), "Option A description must explain nothing to save");
  assert.ok(t.optionB.title.includes("DEFER ATTACK UNTIL RECHARGED"), "Option B title must defer attack until recharged");
});

test("4. Causal Dynamic Decision: High SOC but Car Ahead OUT OF RANGE (>1.0s) triggers SAVE FOR LATER", () => {
  const simOutOfRange = alpineDecisionEngine.simulate({ soc: 60, position: 2, carAheadGap: 2.2, carBehindGap: 1.5 });
  const t = simOutOfRange.tradeoffComparison;

  assert.strictEqual(t.recommendation, "SAVE FOR LATER", "Recommendation must be SAVE FOR LATER when car ahead is far");
  assert.strictEqual(t.decisionMode, "SAVE_FOR_LATER", "decisionMode must be SAVE_FOR_LATER");
  assert.ok(t.tactic.includes("APPROACH & QUEUE"), "Tactic should advise approach & queue");
  assert.strictEqual(t.factors.carAhead.inDrsWindow, false, "Gap 2.2s is outside DRS");
  assert.ok(t.factors.carAhead.status.includes("OUT OF RANGE"), "Status must indicate OUT OF RANGE");

  // Productivity check for Out of Range
  assert.strictEqual(t.productivity.isWorthwhile, false, "Deploying into clean air is NOT worthwhile");
  assert.ok(t.productivity.rating.includes("OUT OF DRS RANGE"), "Rating must reflect out of DRS range");
  assert.strictEqual(t.productivity.badgeClass, "low-return", "Badge class should be low-return");

  const superClip = t.strategicWays.find(s => s.id === "super_clip");
  assert.ok(!superClip.isRecommended, "Super-clip must not be recommended into clean air (>1.0s gap)");
});

test("5. Causal Dynamic Decision: Close Rear Pressure (<0.5s) with tight SOC triggers DEFENSIVE ALLOCATION", () => {
  const simDefend = alpineDecisionEngine.simulate({ soc: 35, position: 2, carAheadGap: 0.6, carBehindGap: 0.3 });
  const t = simDefend.tradeoffComparison;

  assert.strictEqual(t.recommendation, "SAVE FOR LATER", "Must save for defense when rear threat <0.5s and SOC tight");
  assert.ok(t.tactic.includes("DEFENSIVE") || t.tactic.includes("GUARD"), "Tactic must prescribe defensive allocation");
  assert.strictEqual(t.factors.carBehind.hasDefensiveThreat, true, "Threat must be flagged");

  // Productivity check for Defensive Priority
  assert.strictEqual(t.productivity.isWorthwhile, false, "Forward attack is NOT worthwhile under rear pressure");
  assert.strictEqual(t.productivity.badgeClass, "defensive", "Badge class must be defensive");
  assert.ok(t.productivity.rating.includes("DEFENSIVE ALLOCATION PRIORITY"), "Rating must be defensive priority");
});

test("6. Causal Dynamic Decision: P1 Race Leader prescribes PACE CONTROL or CONSERVE & RECHARGE", () => {
  const simLeader = alpineDecisionEngine.simulate({ soc: 50, position: 1, carBehindGap: 99.0 });
  const t = simLeader.tradeoffComparison;

  assert.ok(
    t.recommendation === "MAINTAIN PACE" || t.recommendation === "CONSERVE & RECHARGE" || t.recommendation === "SAVE FOR LATER",
    `Leader should maintain pace, conserve, or save, got: ${t.recommendation}`
  );
  assert.ok(t.tactic.includes("PACE") || t.tactic.includes("COAST") || t.tactic.includes("LEAD") || t.tactic.includes("CONSERVE"), "Leader tactic should focus on pace/lead control");
  assert.strictEqual(t.factors.carAhead.label, "RACE LEADER P1", "Leader label must be RACE LEADER P1");
  assert.strictEqual(t.productivity.badgeClass, "leader", "Productivity badge class must be leader");
});

test("7. UI and Styles contain factors bar, chips, directive bar, and 4-strategy grid", () => {
  // Check index.html
  assert.ok(html.includes('id="tradeoff-comparison-box"'), "index.html must have #tradeoff-comparison-box");
  assert.ok(html.includes("tradeoff-factors-bar"), "index.html must include .tradeoff-factors-bar");
  assert.ok(html.includes("BATTERY FACTOR (SOC)"), "index.html must have BATTERY FACTOR chip");
  assert.ok(html.includes("CAR AHEAD CASE"), "index.html must have CAR AHEAD chip");
  assert.ok(html.includes("CAR BEHIND CASE"), "index.html must have CAR BEHIND chip");
  assert.ok(html.includes("tradeoff-directive-bar"), "index.html must include .tradeoff-directive-bar");
  assert.ok(html.includes("tradeoff-4strats-grid"), "index.html must include .tradeoff-4strats-grid");

  // Check EnergyDeploymentApp.js
  assert.ok(app.includes("tradeoff-factors-bar"), "App must render .tradeoff-factors-bar");
  assert.ok(app.includes("tf-factor-chip"), "App must render factor chips");
  assert.ok(app.includes("tf-soc-"), "App must render SOC factor classes");
  assert.ok(app.includes("tf-ahead-"), "App must render Car Ahead factor classes");
  assert.ok(app.includes("tf-behind-"), "App must render Car Behind factor classes");

  // Check trackshift.css
  assert.ok(css.includes(".tradeoff-factors-bar"), "CSS must define .tradeoff-factors-bar");
  assert.ok(css.includes(".tf-factor-chip"), "CSS must define .tf-factor-chip");
  assert.ok(css.includes(".tf-soc-high"), "CSS must define .tf-soc-high");
  assert.ok(css.includes(".tf-ahead-drs"), "CSS must define .tf-ahead-drs");
  assert.ok(css.includes(".tf-behind-threat"), "CSS must define .tf-behind-threat");
});

test("8. Energy Productivity & Worthwhile Assessment Engine across all operational states", () => {
  // Scenario A: Attack window with healthy SOC -> HIGHLY PRODUCTIVE & WORTHWHILE
  const simAttack = alpineDecisionEngine.simulate({ soc: 65, position: 2, carAheadGap: 0.5, carBehindGap: 1.5 });
  const pAttack = simAttack.tradeoffComparison.productivity;
  assert.strictEqual(pAttack.isWorthwhile, true, "Attack with 65% SOC must be worthwhile");
  assert.strictEqual(pAttack.isProductive, true, "Attack with 65% SOC must be productive");
  assert.strictEqual(pAttack.badgeClass, "worthwhile", "Badge class must be worthwhile");
  assert.ok(pAttack.energyROI >= 0.25, `Energy ROI must be high (got ${pAttack.energyROI})`);
  assert.ok(pAttack.roiLabel.includes("s/MJ"), "ROI label must format s/MJ");

  // Scenario B: Critically low SOC -> UNVIABLE (NOTHING TO SAVE — MUST RECHARGE)
  const simLow = alpineDecisionEngine.simulate({ soc: 18, position: 2, carAheadGap: 0.5, carBehindGap: 1.5 });
  const pLow = simLow.tradeoffComparison.productivity;
  assert.strictEqual(pLow.isWorthwhile, false, "Critically low SOC is NOT worthwhile");
  assert.strictEqual(pLow.badgeClass, "unviable", "Badge class must be unviable");
  assert.ok(pLow.rating.includes("NOTHING TO SAVE"), "Must state nothing to save");
  assert.strictEqual(pLow.energyROI, 0.0, "Energy ROI is 0.0");

  // Scenario C: Out of DRS range -> NOT WORTHWHILE
  const simOut = alpineDecisionEngine.simulate({ soc: 70, position: 2, carAheadGap: 2.5, carBehindGap: 1.5 });
  const pOut = simOut.tradeoffComparison.productivity;
  assert.strictEqual(pOut.isWorthwhile, false, "Clean air boost is NOT worthwhile");
  assert.strictEqual(pOut.badgeClass, "low-return", "Badge class must be low-return");

  // Scenario D: Rear threat -> DEFENSIVE PRIORITY ONLY
  const simDef = alpineDecisionEngine.simulate({ soc: 30, position: 2, carAheadGap: 0.5, carBehindGap: 0.3 });
  const pDef = simDef.tradeoffComparison.productivity;
  assert.strictEqual(pDef.badgeClass, "defensive", "Badge class must be defensive");
});

test("9. Productivity Strip DOM elements and CSS rules are fully integrated", () => {
  // index.html
  assert.ok(html.includes("tradeoff-productivity-strip"), "index.html must include .tradeoff-productivity-strip");
  assert.ok(html.includes("ENERGY PRODUCTIVITY &amp; WORTHWHILE ASSESSMENT") || html.includes("ENERGY PRODUCTIVITY & WORTHWHILE ASSESSMENT"), "index.html must include title");
  assert.ok(html.includes("tps-badge"), "index.html must include .tps-badge");
  assert.ok(html.includes("tps-roi"), "index.html must include .tps-roi");

  // EnergyDeploymentApp.js
  assert.ok(app.includes("tradeoff-productivity-strip"), "App must render .tradeoff-productivity-strip");
  assert.ok(app.includes("tps-badge"), "App must render .tps-badge");
  assert.ok(app.includes("tps-roi-val"), "App must render .tps-roi-val");

  // trackshift.css
  assert.ok(css.includes(".tradeoff-productivity-strip"), "CSS must define .tradeoff-productivity-strip");
  assert.ok(css.includes(".tradeoff-productivity-strip.worthwhile"), "CSS must define .worthwhile variant");
  assert.ok(css.includes(".tradeoff-productivity-strip.unviable"), "CSS must define .unviable variant");
  assert.ok(css.includes(".tps-badge.unviable"), "CSS must define unviable badge");
});

test("10. End-of-Race Sprint Burn: When laps remaining are small (<=3), releases buffers and prescribes SPRINT BURN", () => {
  const sprintSim = alpineDecisionEngine.simulate({
    currentLap: 55,
    lapsRemaining: 2,
    soc: 55,
    position: 2,
    carAheadGap: 1.6, // Outside DRS, but in sprint phase we MUST spend remaining usable pack
    carBehindGap: 1.5
  });

  const t = sprintSim.tradeoffComparison;
  assert.strictEqual(t.decisionMode, "SPEND_NOW", "decisionMode must be SPEND_NOW in sprint phase");
  assert.ok(t.recommendation.includes("FINAL SPRINT"), "Recommendation must be SPEND NOW (FINAL SPRINT)");
  assert.ok(t.tactic.includes("SPRINT BURN"), "Tactic must prescribe SPRINT BURN");
  assert.ok(t.optionB.title.includes("SPRINT BURN IN UPCOMING LAPS"), "Option B must be SPRINT BURN IN UPCOMING LAPS");
  assert.strictEqual(t.productivity.status, "FINAL_SPRINT_BURN", "Productivity status must be FINAL_SPRINT_BURN");
  assert.ok(t.productivity.isWorthwhile, "Sprint burn must be worthwhile");
});

test("11. Race Start Scramble: When currentLap <= 3 with healthy pack, prescribes early track position scramble", () => {
  const startSim = alpineDecisionEngine.simulate({
    currentLap: 1,
    lapsRemaining: 56,
    soc: 75,
    position: 3,
    carAheadGap: 1.2,
    carBehindGap: 1.4
  });

  const t = startSim.tradeoffComparison;
  assert.strictEqual(t.decisionMode, "SPEND_NOW", "decisionMode must be SPEND_NOW at race start");
  assert.ok(t.recommendation.includes("RACE START"), "Recommendation must be SPEND NOW (RACE START)");
  assert.ok(t.tactic.includes("RACE START SCRAMBLE"), "Tactic must be RACE START SCRAMBLE");
  assert.ok(t.optionA.title.includes("OPENING LAP"), "Option A must focus on opening lap track position");
  assert.strictEqual(t.productivity.status, "RACE_START_ATTACK", "Productivity status must be RACE_START_ATTACK");
  assert.ok(t.productivity.isWorthwhile, "Race start attack must be worthwhile");
});

test("12. Battery Joule Level Integration: All factors, race state, and reserve models contain exact Joules", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    lapsRemaining: 33,
    soc: 54,
    position: 2,
    carAheadGap: 0.7,
    carBehindGap: 1.4
  });

  const socFactor = sim.tradeoffComparison.factors.soc;
  assert.strictEqual(socFactor.energyJoules, 10800000, "54% SOC must equal 10,800,000 J");
  assert.strictEqual(socFactor.safetyFloorJoules, 3000000, "Safety floor must equal 3,000,000 J");
  assert.ok(typeof socFactor.reserveJoules === "number", "reserveJoules must be number");
  assert.ok(typeof socFactor.freeJoules === "number", "freeJoules must be number");
});

console.log("==================================================================");
console.log("🎉 ALL FUTURE OPPORTUNITY 4-STRATEGY AUDITS PASSED!              ");
console.log("==================================================================");
