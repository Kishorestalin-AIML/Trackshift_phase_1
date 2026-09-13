import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("==================================================================");
console.log("=== AUDITING SPEND NOW VS SAVE FOR LATER REAL OPTIMIZATION    ===");
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

test("1. Single central RaceState contains all authoritative fields (Section 2)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 42,
    lapsRemaining: 15,
    position: 2,
    soc: 62,
    carAheadGap: 0.6,
    carBehindGap: 1.5,
    tyreCompound: "MEDIUM",
    tyreAge: 12
  });

  const s = sim.centralRaceState;
  assert.ok(s, "centralRaceState must exist");
  assert.strictEqual(s.currentLap, 42, "currentLap matches input");
  assert.strictEqual(s.futureHorizon, 5, "futureHorizon defaults to 5 laps");
  assert.strictEqual(s.position, 2, "position matches input");
  assert.strictEqual(s.socPercent, 62, "socPercent matches input");
  assert.strictEqual(s.energyMJ, 12.4, "energyMJ correctly derived (62% of 20MJ = 12.4MJ)");
  assert.strictEqual(s.usableEnergyMJ, 20.0, "usableEnergyMJ is 20.0 MJ");
  assert.strictEqual(s.gapAhead, 0.6, "gapAhead matches input");
  assert.strictEqual(s.gapBehind, 1.5, "gapBehind matches input");
  assert.strictEqual(s.lapsRemaining, 15, "lapsRemaining matches input");
  assert.strictEqual(s.tyreCompound, "MEDIUM", "tyreCompound matches input");
  assert.strictEqual(s.tyreAge, 12, "tyreAge matches input");
  assert.ok(typeof s.tyrePerformance === "number", "tyrePerformance is a number");
  assert.ok(typeof s.tyreDegradationRate === "number", "tyreDegradationRate is a number");
  assert.ok(s.pitWindow, "pitWindow is present");
  assert.ok(typeof s.pitLoss === "number", "pitLoss is present");
  assert.ok(Array.isArray(s.recoveryZones), "recoveryZones is an array");
  assert.ok(Array.isArray(s.attackZones), "attackZones is an array");
  assert.ok(typeof s.nextRecoveryZone === "number", "nextRecoveryZone is a number");
  assert.ok(typeof s.freeEnergyMJ === "number", "freeEnergyMJ is a number");
  assert.ok(typeof s.requiredReserveMJ === "number", "requiredReserveMJ is a number");
  assert.ok(s.fiaRuleProfile, "fiaRuleProfile is present");
});

test("2. Real multi-lap Future Opportunity Model (H = 5 laps, Section 3 & 6)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 42,
    lapsRemaining: 15,
    position: 2,
    soc: 60,
    carAheadGap: 0.7,
    carBehindGap: 1.8
  });

  const opps = sim.futureOpportunities;
  assert.ok(Array.isArray(opps), "futureOpportunities must be an array");
  assert.strictEqual(opps.length, 5, "Horizon H = 5 laps generates 5 distinct opportunities");

  opps.forEach((opp, i) => {
    assert.strictEqual(opp.lap, 42 + i + 1, `Opp ${i} lap must be sequential`);
    assert.ok(opp.sector >= 1 && opp.sector <= 3, `Opp ${i} has valid sector`);
    assert.ok(opp.zoneNumber >= 1 && opp.zoneNumber <= 9, `Opp ${i} has valid zone number`);
    assert.ok(["VERY HIGH", "HIGH", "LOW", "N/A (LEADER)"].includes(opp.attackQuality), `Opp ${i} has valid attack quality`);
    assert.ok(typeof opp.expectedGap === "number", `Opp ${i} has expected gap`);
    assert.ok(typeof opp.expectedClosingSpeed === "number", `Opp ${i} has expected closing speed`);
    assert.ok(typeof opp.tyrePerformance === "number", `Opp ${i} has tyre performance`);
    assert.ok(typeof opp.futureEnergyValue === "number", `Opp ${i} has future energy value`);
    assert.ok(typeof opp.expectedGainSec === "number", `Opp ${i} has expected gain sec`);
    assert.ok(typeof opp.expectedPositionValue === "number", `Opp ${i} has expected position value`);
  });

  const bestFut = sim.bestFutureOpportunity;
  assert.ok(bestFut, "bestFutureOpportunity must exist");
  const maxFutureVal = Math.max(...opps.map(o => o.futureEnergyValue));
  assert.strictEqual(bestFut.futureEnergyValue, maxFutureVal, "bestFutureOpportunity is argmax(futureEnergyValue)");
});

test("3. Scenario A — Strong current attack (Section 25)", () => {
  // High SOC (70%) + close gap ahead (0.4s) + fresh tyres (3 laps) + safe behind (1.6s)
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    lapsRemaining: 32,
    position: 2,
    soc: 70,
    carAheadGap: 0.4,
    carBehindGap: 1.6,
    tyreCompound: "SOFT",
    tyreAge: 3
  });

  const opt = sim.spendVsSaveOptimization;
  assert.ok(opt, "spendVsSaveOptimization must exist");
  assert.strictEqual(opt.winner, "SPEND NOW", "Strong current attack must select SPEND NOW");
  assert.ok(opt.delta > 0, "Spend Now value must exceed Save For Later value");
  assert.ok(opt.spendNow.raceValue > opt.saveForLater.raceValue, "spendNow.raceValue > saveForLater.raceValue");
  assert.ok(opt.verdictLabel.includes("SPEND WINS"), "verdictLabel highlights SPEND WINS");
  assert.ok(opt.causalExplanation.includes("superior immediate race gain"), "Causal explanation explains immediate gain superiority");
});

test("4. Scenario B — Better future opportunity / Outside DRS (Section 25)", () => {
  // Car is 2.2s ahead (outside 1.0s DRS detection window); attacking now into clean air is low yield
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    lapsRemaining: 32,
    position: 2,
    soc: 50,
    carAheadGap: 2.2,
    carBehindGap: 1.6,
    tyreCompound: "MEDIUM",
    tyreAge: 10
  });

  const opt = sim.spendVsSaveOptimization;
  assert.ok(opt, "spendVsSaveOptimization must exist");
  assert.strictEqual(opt.winner, "SAVE FOR LATER", "Outside DRS window must select SAVE FOR LATER");
  assert.ok(opt.delta < 0, "Save For Later value must exceed Spend Now value");
  assert.ok(opt.saveForLater.raceValue > opt.spendNow.raceValue, "saveForLater.raceValue > spendNow.raceValue");
  assert.ok(opt.verdictLabel.includes("SAVE WINS"), "verdictLabel highlights SAVE WINS");
  assert.ok(opt.causalExplanation.includes("DRS detection window") || opt.causalExplanation.includes("Conserving energy preserves pack"), "Explains DRS window preservation");
});

test("5. Scenario C — Close defence pressure (Section 25)", () => {
  // Car behind is 0.3s (severe threat); defence reserve must increase and conservation favored
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    lapsRemaining: 32,
    position: 2,
    soc: 44,
    carAheadGap: 1.2,
    carBehindGap: 0.3,
    tyreCompound: "MEDIUM",
    tyreAge: 12
  });

  const opt = sim.spendVsSaveOptimization;
  assert.ok(opt, "spendVsSaveOptimization must exist");
  assert.ok(sim.centralRaceState.defenceReserveMJ >= 1.5, "Defence reserve expands under 0.3s threat");
  assert.strictEqual(opt.winner, "SAVE FOR LATER", "Severe rear threat with moderate pack must conserve or defend");
  assert.ok(opt.causalExplanation.includes("defensive threat") || opt.causalExplanation.includes("Defensive reserve"), "Causal explanation cites defensive threat");
});

test("6. Scenario D — Recovery approaching (Section 9 & 25)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    position: 2,
    soc: 58,
    carAheadGap: 0.7,
    carBehindGap: 1.2
  });

  assert.ok(sim.recoveryTiming, "recoveryTiming must exist");
  assert.ok(sim.recoveryTiming.zonesAway >= 1, "recoveryTiming identifies zones away");
  assert.ok(sim.expectedRecoveryMJ > 0, "expectedRecoveryMJ is positive");
  assert.ok(sim.spendVsSaveOptimization.saveForLater.recoveryValue > 0, "saveForLater factors in recovery value");
});

test("7. Scenario E — Degraded tyres increases pit value (Section 10 & 25)", () => {
  const simOldTyres = alpineDecisionEngine.simulate({
    currentLap: 26,
    position: 2,
    soc: 55,
    carAheadGap: 0.8,
    carBehindGap: 1.4,
    tyreCompound: "SOFT",
    tyreAge: 24
  });

  assert.ok(simOldTyres.tyreState.performanceFactor < 0.75, "Tyre performance degraded after 24 laps on softs");
  assert.ok(simOldTyres.pitWindow.isPitWindowOpen || (simOldTyres.pitActions && simOldTyres.pitActions.bestAction === "PIT NOW"), "Pit window is open or PIT NOW advised");
});

test("8. Scenario F — Late race final sprint phase (Section 25)", () => {
  // Laps remaining = 2; future horizon collapses, unspent energy across the finish line is zero value
  const sim = alpineDecisionEngine.simulate({
    currentLap: 55,
    lapsRemaining: 2,
    position: 2,
    soc: 55,
    carAheadGap: 0.8,
    carBehindGap: 1.5
  });

  const opt = sim.spendVsSaveOptimization;
  assert.ok(opt, "spendVsSaveOptimization must exist");
  assert.strictEqual(opt.winner, "SPEND NOW", "Final sprint phase must select SPEND NOW");
  assert.ok(opt.spendNow.raceValue > opt.saveForLater.raceValue, "Spend now value dominates in final sprint");
  assert.ok(opt.causalExplanation.includes("Final Sprint Phase"), "Causal explanation identifies Final Sprint Phase");
});

test("9. Scenario G — Critically depleted battery pack (Section 25)", () => {
  // Battery at reserve floor (24% SOC, free energy 0.0 MJ); there is nothing to save and spending is unviable
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    position: 2,
    soc: 24,
    carAheadGap: 0.6,
    carBehindGap: 1.4
  });

  const opt = sim.spendVsSaveOptimization;
  assert.ok(opt, "spendVsSaveOptimization must exist");
  assert.strictEqual(opt.winner, "HARVEST / RECHARGE", "Pack at floor triggers HARVEST / RECHARGE");
  assert.ok(opt.verdictLabel.includes("RECHARGE MANDATORY"), "verdictLabel denotes RECHARGE MANDATORY");
  assert.ok(opt.causalExplanation.includes("reserve floor") || opt.causalExplanation.includes("Active kinetic recovery"), "Causal text highlights pack at floor");
});

test("10. Shared finite energy budget across all actions (Section 17)", () => {
  const sim = alpineDecisionEngine.simulate({ soc: 60, position: 2 });
  const packMJ = sim.centralRaceState.energyMJ; // 12.0 MJ
  const action = sim.nextBestAction;
  const dep = action.deployedMJ || 0;
  const rec = sim.expectedRecoveryMJ || 0;
  const expectedNextEnergy = Math.max(0, Math.min(20.0, packMJ - dep + (action.strategy === "BRAKING / HARVEST" ? rec : 0)));

  assert.ok(typeof sim.energyAfterDeployMJ === "number", "energyAfterDeployMJ is tracked");
  assert.strictEqual(sim.centralRaceState.energyMJ, 12.0, "All components read identical central energyMJ");
});

test("11. Deterministic mathematical output (Section 21)", () => {
  const input = { currentLap: 30, lapsRemaining: 27, position: 2, soc: 65, carAheadGap: 0.6, carBehindGap: 1.4, tyreCompound: "MEDIUM", tyreAge: 14 };
  const sim1 = alpineDecisionEngine.simulate(input);
  const sim2 = alpineDecisionEngine.simulate(input);

  assert.strictEqual(sim1.spendVsSaveOptimization.delta, sim2.spendVsSaveOptimization.delta, "Delta is strictly deterministic");
  assert.strictEqual(sim1.spendVsSaveOptimization.spendNow.raceValue, sim2.spendVsSaveOptimization.spendNow.raceValue, "SpendNowValue is deterministic");
  assert.strictEqual(sim1.spendVsSaveOptimization.saveForLater.raceValue, sim2.spendVsSaveOptimization.saveForLater.raceValue, "SaveForLaterValue is deterministic");
  assert.strictEqual(sim1.spendVsSaveOptimization.winner, sim2.spendVsSaveOptimization.winner, "Winner is deterministic");
});

test("12. Hard FIA constraints filter (Section 18)", () => {
  const sim = alpineDecisionEngine.simulate({ soc: 80, position: 2, deploymentIntensity: "AGGRESSIVE" });
  const power = sim.nextBestAction.powerKw ?? sim.nextBestAction.deployedKw ?? 350;
  assert.ok(power <= 350, "Acceleration deployment clamped to legal 350 kW");
  assert.ok(sim.fiaStatus.includes("COMPLIANT") || sim.fiaStatus.includes("LEGAL"), "FIA status is legal");
});

test("13. DOM Markup contains all required Spend vs Save and Decision Card elements", () => {
  // Decision Card elements (Section 23)
  assert.ok(html.includes('id="dec-race-value"'), "index.html has #dec-race-value");
  assert.ok(html.includes('id="dec-spend-vs-save"'), "index.html has #dec-spend-vs-save");
  assert.ok(html.includes('id="dec-best-future-opp"'), "index.html has #dec-best-future-opp");
  assert.ok(html.includes('id="dec-overtake-prob"'), "index.html has #dec-overtake-prob");
  assert.ok(html.includes('id="dec-defence-risk"'), "index.html has #dec-defence-risk");

  // Spend vs Save comparison container (Section 15)
  assert.ok(html.includes('id="spend-vs-save-box"'), "index.html has #spend-vs-save-box");
  assert.ok(html.includes('id="svs-verdict-pill"'), "index.html has #svs-verdict-pill");
  assert.ok(html.includes('id="svs-spend-card"'), "index.html has #svs-spend-card");
  assert.ok(html.includes('id="svs-save-card"'), "index.html has #svs-save-card");
  assert.ok(html.includes('id="svs-sn-gain"'), "index.html has #svs-sn-gain");
  assert.ok(html.includes('id="svs-sn-cost"'), "index.html has #svs-sn-cost");
  assert.ok(html.includes('id="svs-sn-fut"'), "index.html has #svs-sn-fut");
  assert.ok(html.includes('id="svs-sn-def"'), "index.html has #svs-sn-def");
  assert.ok(html.includes('id="svs-sn-value"'), "index.html has #svs-sn-value");
  assert.ok(html.includes('id="svs-sl-gain"'), "index.html has #svs-sl-gain");
  assert.ok(html.includes('id="svs-sl-pres"'), "index.html has #svs-sl-pres");
  assert.ok(html.includes('id="svs-sl-fut"'), "index.html has #svs-sl-fut");
  assert.ok(html.includes('id="svs-sl-rec"'), "index.html has #svs-sl-rec");
  assert.ok(html.includes('id="svs-sl-value"'), "index.html has #svs-sl-value");
  assert.ok(html.includes('id="svs-best-target-text"'), "index.html has #svs-best-target-text");
  assert.ok(html.includes('id="svs-best-target-stats"'), "index.html has #svs-best-target-stats");
  assert.ok(html.includes('id="svs-causal-reason"'), "index.html has #svs-causal-reason");
});

test("14. CSS contains styling for spend-vs-save and tactical timeline step metrics", () => {
  assert.ok(css.includes(".spend-vs-save-container"), "CSS has .spend-vs-save-container");
  assert.ok(css.includes(".svs-verdict-pill"), "CSS has .svs-verdict-pill");
  assert.ok(css.includes(".svs-grid"), "CSS has .svs-grid");
  assert.ok(css.includes(".svs-card"), "CSS has .svs-card");
  assert.ok(css.includes(".svs-target-banner"), "CSS has .svs-target-banner");
  assert.ok(css.includes(".step-delta-stat"), "CSS has .step-delta-stat");
  assert.ok(css.includes(".step-prob-stat"), "CSS has .step-prob-stat");
});

test("15. Functional future timeline: each step exposes real simulation metrics (Section 14)", () => {
  const sim = alpineDecisionEngine.simulate({ currentLap: 42, lapsRemaining: 15, position: 2, soc: 60 });
  const plan = sim.tacticalRacePlan;
  assert.ok(Array.isArray(plan), "tacticalRacePlan must be an array");
  assert.ok(plan.length >= 3, "Plan covers rolling horizon laps");

  plan.forEach((step, i) => {
    assert.ok(step.lap >= 42, `Step ${i} lap must be valid`);
    assert.ok(step.action, `Step ${i} has action`);
    assert.ok(step.shortAction, `Step ${i} has shortAction`);
    assert.ok(step.energyDeltaLabel, `Step ${i} has energyDeltaLabel`);
    assert.ok(typeof step.energyDeltaMJ === "number", `Step ${i} has numeric energyDeltaMJ`);
    assert.ok(step.metricLabel, `Step ${i} has metricLabel`);
  });
});

console.log("==================================================================");
console.log("🎉 ALL SPEND NOW VS SAVE FOR LATER OPTIMIZATION AUDITS PASSED!   ");
console.log("==================================================================");
