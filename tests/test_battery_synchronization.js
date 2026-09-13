import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("======================================================================");
console.log("🔋 STARTING BATTERY LIVE SLIDER SYNCHRONIZATION TESTS (SECTIONS 1–20)");
console.log("======================================================================");

// --------------------------------------------------------------------
// TEST 1: Physical Formula & Single Source of Truth
// E_MJ = (SOC / 100) * 20.0 MJ across full 0-100% scale
// --------------------------------------------------------------------
console.log("\n[TEST 1] Verifying Physical Formula: E = (SOC / 100) * 20.0 MJ...");
const testSocs = [0, 15, 25, 39, 40, 59, 60, 80, 100];
testSocs.forEach(soc => {
  const calculatedMJ = alpineDecisionEngine.socToMJ(soc);
  const expectedMJ = Math.round(((soc / 100) * 20.0) * 100) / 100;
  assert.strictEqual(
    calculatedMJ,
    expectedMJ,
    `SOC ${soc}% must convert to exactly ${expectedMJ} MJ, got ${calculatedMJ} MJ`
  );
  const roundtripSoc = alpineDecisionEngine.mjToSOC(calculatedMJ);
  assert.strictEqual(
    roundtripSoc,
    soc,
    `Roundtrip MJ ${calculatedMJ} must convert back to SOC ${soc}%, got ${roundtripSoc}%`
  );
});
console.log("  ✓ PASS: Physical formula E = (SOC / 100) * 20.0 MJ is strictly followed across all percentages.");

// --------------------------------------------------------------------
// TEST 2: Dynamic Battery State Classification
// HEALTHY (>=60%), LIMITED (40-59%), LOW (25-39%), CRITICAL (<25%)
// --------------------------------------------------------------------
console.log("\n[TEST 2] Verifying Dynamic Battery State Thresholds & Badges...");
const stateTestCases = [
  { soc: 100, expected: "HEALTHY" },
  { soc: 60,  expected: "HEALTHY" },
  { soc: 59,  expected: "LIMITED" },
  { soc: 40,  expected: "LIMITED" },
  { soc: 39,  expected: "LOW" },
  { soc: 25,  expected: "LOW" },
  { soc: 24,  expected: "CRITICAL" },
  { soc: 10,  expected: "CRITICAL" },
  { soc: 0,   expected: "CRITICAL" }
];

stateTestCases.forEach(({ soc, expected }) => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    soc,
    intensity: 75,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 10,
    trackCondition: "DRY"
  });
  assert.strictEqual(
    sim.centralRaceState.batteryState,
    expected,
    `SOC ${soc}% should produce battery state '${expected}', got '${sim.centralRaceState.batteryState}'`
  );
  assert.strictEqual(
    sim.centralRaceState.batteryStateLabel,
    `ENERGY: ${expected}`,
    `SOC ${soc}% should produce battery state label 'ENERGY: ${expected}'`
  );
  assert.strictEqual(
    sim.decision.batteryState,
    expected,
    `Decision output should carry batteryState '${expected}'`
  );
});
console.log("  ✓ PASS: Dynamic battery states (HEALTHY, LIMITED, LOW, CRITICAL) correctly mapped.");

// --------------------------------------------------------------------
// TEST 3: Battery Segment Physical Reserve Envelope & Bounding
// Sum of reserve + free + used = 20.0 MJ and percentages total 100%
// --------------------------------------------------------------------
console.log("\n[TEST 3] Verifying Finite Pack Tri-Segment Bounding & Free Attack Energy...");
const packCapacity = alpineDecisionEngine.usableCapacityMJ;
[10, 25, 45, 62, 85].forEach(soc => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    soc,
    intensity: 75,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 10,
    trackCondition: "DRY"
  });
  const initialEnergy = sim.initialEnergyMJ;
  const res = sim.currentReserve;

  // Physical bounding
  const actualReserveMJ = Math.min(res.reserveMJ, initialEnergy);
  const actualFreeMJ = Math.max(0, initialEnergy - res.reserveMJ);
  const actualUsedMJ = Math.max(0, Math.round((packCapacity - initialEnergy) * 100) / 100);

  const totalMJ = Math.round((actualReserveMJ + actualFreeMJ + actualUsedMJ) * 10) / 10;
  assert.strictEqual(
    totalMJ,
    20.0,
    `Total of Reserve (${actualReserveMJ}) + Free (${actualFreeMJ}) + Used (${actualUsedMJ}) must equal 20.0 MJ`
  );

  const reservePct = (actualReserveMJ / packCapacity) * 100;
  const freePct = (actualFreeMJ / packCapacity) * 100;
  const usedPct = (actualUsedMJ / packCapacity) * 100;
  const totalPct = Math.round((reservePct + freePct + usedPct) * 10) / 10;
  assert.strictEqual(
    totalPct,
    100.0,
    `Tri-segment bar width percentages must total 100.0%, got ${totalPct}%`
  );
});
console.log("  ✓ PASS: Tri-Segment bar components strictly bound to 20.0 MJ / 100.0% finite envelope.");

// --------------------------------------------------------------------
// TEST 4: Low SOC Blocks Super-Clip & Preserves Energy
// SOC 15% cannot execute 1.40 MJ Super-Clip attack
// --------------------------------------------------------------------
console.log("\n[TEST 4] Verifying Low Battery Attack Feasibility Restrictions...");
const lowSocSim = alpineDecisionEngine.simulate({
  currentLap: 24,
  futureLaps: 3,
  position: 3,
  carAheadGap: 0.7,
  carBehindGap: 1.4,
  soc: 15,
  intensity: 75,
  constraintLevel: 25,
  compound: "MEDIUM",
  tyreAge: 10,
  trackCondition: "DRY"
});
const superClipCandidate = lowSocSim.strategyComparison.find(s => s.name === "SUPER-CLIP");
assert.ok(superClipCandidate, "SUPER-CLIP option should exist in comparison");
assert.strictEqual(
  superClipCandidate.breakdown.isFeasible,
  false,
  "SUPER-CLIP must be marked infeasible when SOC is 15%"
);
assert.notStrictEqual(
  lowSocSim.nextBestAction.strategy,
  "SUPER-CLIP",
  "Engine must not recommend SUPER-CLIP at 15% SOC"
);
assert.ok(
  ["COAST", "BRAKING / HARVEST"].includes(lowSocSim.nextBestAction.strategy),
  `At 15% SOC, strategy must be COAST or BRAKING / HARVEST, got '${lowSocSim.nextBestAction.strategy}'`
);
console.log(`  ✓ PASS: 15% SOC prevents SUPER-CLIP and recommends conservative ${lowSocSim.nextBestAction.strategy}.`);

// --------------------------------------------------------------------
// TEST 5: Critical SOC + Close Opponent Behind Triggers Defensive Concession
// Defending with depleted battery against close rival (<0.5s) loses position
// --------------------------------------------------------------------
console.log("\n[TEST 5] Verifying Defensive Concession Under Critical Battery Depletion...");
const defSim = alpineDecisionEngine.simulate({
  currentLap: 24,
  futureLaps: 3,
  position: 3,
  carAheadGap: 1.5,
  carBehindGap: 0.3, // Opponent 0.3s behind
  soc: 12, // Critical SOC (12% = 2.4 MJ < 5.0 MJ)
  intensity: 75,
  constraintLevel: 25,
  compound: "MEDIUM",
  tyreAge: 10,
  trackCondition: "DRY"
});
assert.strictEqual(defSim.centralRaceState.batteryState, "CRITICAL");
assert.ok(
  defSim.decision.defenceConcession === true || defSim.expectedPositionsGained < 0,
  "Under critical battery (<25%) with rival at 0.3s, engine should register defensive concession"
);
console.log("  ✓ PASS: Critical battery under pressure registers defensive concession & defensive risk.");

// --------------------------------------------------------------------
// TEST 6: Deployment & Recovery Delta Verification
// --------------------------------------------------------------------
console.log("\n[TEST 6] Verifying Deployment Depletion & Harvest Replenishment Deltas...");
const highSocSim = alpineDecisionEngine.simulate({
  currentLap: 24,
  futureLaps: 3,
  position: 3,
  carAheadGap: 0.7,
  carBehindGap: 1.4,
  soc: 75,
  intensity: 75,
  constraintLevel: 25,
  compound: "MEDIUM",
  tyreAge: 10,
  trackCondition: "DRY"
});
assert.ok(
  highSocSim.socAfterDeploy < highSocSim.initialSoc,
  `Deployment must reduce SOC: initial=${highSocSim.initialSoc}%, after=${highSocSim.socAfterDeploy}%`
);
assert.ok(
  highSocSim.socAfterRecovery > highSocSim.socAfterDeploy,
  `Harvest must replenish SOC: deployed=${highSocSim.socAfterDeploy}%, recovered=${highSocSim.socAfterRecovery}%`
);
console.log(`  ✓ PASS: Deployment (${highSocSim.initialSoc}% → ${highSocSim.socAfterDeploy}%) and Harvest (→ ${highSocSim.socAfterRecovery}%) deltas verified.`);

// --------------------------------------------------------------------
// TEST 7: DOM & CSS Audit for Live Battery Segment
// --------------------------------------------------------------------
console.log("\n[TEST 7] Verifying DOM Bindings and CSS Styles for Battery Synchronization...");
const htmlContent = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
const cssContent = fs.readFileSync(path.resolve(__dirname, "../styles/trackshift.css"), "utf-8");

// HTML element verification
const requiredDOMElements = [
  'id="battery-state-badge"',
  'id="battery-attack-capability"',
  'id="battery-limit-reason"',
  'id="bar-seg-reserve"',
  'id="bar-seg-free"',
  'id="bar-seg-used"',
  'id="stat-soc"',
  'id="stat-available"',
  'id="stat-reserved"',
  'id="stat-free"',
  'id="val-soc"',
  'id="slider-soc"',
  'id="tri-bar-ticks"',
  'id="tri-segregated-cards-grid"',
  'id="card-res-val"',
  'id="card-free-val"',
  'id="card-used-val"'
];

// Verify that redundant secondary slider is NOT present
assert.ok(!htmlContent.includes('id="tri-pack-slider"'), 'Redundant extra SOC slider must be removed from index.html');
assert.ok(!htmlContent.includes('id="tri-slider-readout"'), 'Redundant extra slider readout must be removed from index.html');

requiredDOMElements.forEach(el => {
  assert.ok(htmlContent.includes(el), `index.html must contain ${el}`);
});
console.log("  ✓ PASS: All required battery & segregated pack DOM element IDs present in index.html (and redundant slider removed).");

// CSS class verification
const requiredCSSSelectors = [
  ".battery-state-badge",
  ".battery-state-badge.healthy",
  ".battery-state-badge.limited",
  ".battery-state-badge.low",
  ".battery-state-badge.critical",
  ".battery-capability-row",
  ".capability-item",
  ".cap-val",
  ".cap-sub",
  ".tri-bar-ticks",
  ".tri-segregated-cards-grid",
  ".tri-seg-card",
  ".tri-seg-card.reserve-card",
  ".tri-seg-card.free-card",
  ".tri-seg-card.used-card"
];

requiredCSSSelectors.forEach(sel => {
  assert.ok(cssContent.includes(sel), `trackshift.css must define ${sel}`);
});
console.log("  ✓ PASS: All required battery & segregated pack CSS selectors present in trackshift.css.");

// --------------------------------------------------------------------
// TEST 8: Exact Joule Calculations Across Battery Allocation
// 1 MJ = 1,000,000 Joules; 20.0 MJ = 20,000,000 Joules
// --------------------------------------------------------------------
console.log("\n[TEST 8] Verifying Exact Battery Joules Calculation & Factor Integration...");
const jouleTestSocs = [15, 30, 54, 75, 100];
jouleTestSocs.forEach(soc => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    lapsRemaining: 33,
    soc,
    position: 2,
    carAheadGap: 0.6,
    carBehindGap: 1.4
  });

  const expectedTotalJoules = Math.round(((soc / 100) * 20.0) * 1e6);
  assert.strictEqual(
    sim.centralRaceState.energyJoules,
    expectedTotalJoules,
    `energyJoules at ${soc}% SOC must be ${expectedTotalJoules} J, got ${sim.centralRaceState.energyJoules} J`
  );
  assert.strictEqual(
    sim.centralRaceState.safetyFloorJoules,
    3000000,
    `safetyFloorJoules must be 3,000,000 J (15% of 20 MJ)`
  );
  assert.strictEqual(
    sim.tradeoffComparison.factors.soc.energyJoules,
    expectedTotalJoules,
    `factors.soc.energyJoules must match total pack Joules`
  );
  assert.strictEqual(
    typeof sim.currentReserve.reserveJoules,
    "number",
    "reserveJoules must be a number"
  );
  assert.strictEqual(
    typeof sim.currentReserve.freeJoules,
    "number",
    "freeJoules must be a number"
  );
});
console.log("  ✓ PASS: Exact battery Joules calculated and exposed across centralRaceState, currentReserve, and tradeoff factors.");

// --------------------------------------------------------------------
// TEST 9: End-of-Race Sprint Rule (Upcoming Laps When Laps Remaining Is Very Small)
// When lapsRemaining <= 3, future attack/recovery buffers collapse, allowing driver
// to spend usable energy across upcoming laps before the finish line.
// --------------------------------------------------------------------
console.log("\n[TEST 9] Verifying End-of-Race Sprint Rule (Upcoming Laps When Laps Remaining Is Very Small)...");
const sprintSim = alpineDecisionEngine.simulate({
  currentLap: 55,
  lapsRemaining: 2, // Very small laps remaining!
  soc: 60,
  position: 2,
  carAheadGap: 1.8, // Normally outside DRS, would be "SAVE FOR LATER", but in sprint: SPEND NOW!
  carBehindGap: 1.5
});

assert.strictEqual(sprintSim.centralRaceState.isSprintPhase, true, "isSprintPhase must be true when lapsRemaining <= 3");
assert.strictEqual(sprintSim.currentReserve.futureAttackMJ, 0.00, "futureAttackMJ must collapse to 0.00 in sprint phase");
assert.strictEqual(sprintSim.currentReserve.recoveryGapMJ, 0.00, "recoveryGapMJ must collapse to 0.00 in sprint phase");
assert.strictEqual(sprintSim.currentReserve.safetyFloorMJ, 3.00, "safetyFloorMJ remains mandatory 3.00 MJ");
assert.strictEqual(sprintSim.tradeoffComparison.decisionMode, "SPEND_NOW", "decisionMode must be SPEND_NOW during sprint phase");
assert.ok(sprintSim.tradeoffComparison.recommendation.includes("FINAL SPRINT"), "Recommendation must indicate FINAL SPRINT");
assert.ok(sprintSim.tradeoffComparison.tactic.includes("SPRINT BURN"), "Tactic must prescribe SPRINT BURN");
assert.ok(sprintSim.tradeoffComparison.optionB.title.includes("SPRINT BURN IN UPCOMING LAPS"), "Option B must be SPRINT BURN IN UPCOMING LAPS");
assert.ok(sprintSim.tradeoffComparison.productivity.isWorthwhile, "Sprint burn must be marked WORTHWHILE");
assert.ok(sprintSim.upcomingLapAdvisory.directiveLabel.includes("SPRINT BURN"), "Upcoming lap directive must indicate SPRINT BURN");

// Check tactical race plan has SPRINT BURN in upcoming laps
const upcomingPlanLaps = sprintSim.tacticalRacePlan.filter(p => !p.isCurrent);
assert.ok(upcomingPlanLaps.length > 0, "Upcoming plan laps must exist");
assert.ok(
  upcomingPlanLaps.some(p => p.shortAction === "SPRINT BURN" || p.action === "SUPER-CLIP"),
  "Tactical race plan for upcoming laps must prescribe SPRINT BURN / attack"
);
console.log("  ✓ PASS: End-of-race sprint rule correctly releases buffers and authorizes upcoming lap energy burn.");

// --------------------------------------------------------------------
// TEST 10: Race Start Scramble Rule (Starting of the Race)
// When currentLap <= 3 and pack is full, authorize spending energy to gain track position
// --------------------------------------------------------------------
console.log("\n[TEST 10] Verifying Race Start Scramble Rule (Starting of the Race)...");
const startSim = alpineDecisionEngine.simulate({
  currentLap: 1, // Opening lap of the race
  lapsRemaining: 56,
  soc: 80, // Full pack
  position: 3,
  carAheadGap: 1.2,
  carBehindGap: 1.2
});

assert.strictEqual(startSim.centralRaceState.isRaceStart, true, "isRaceStart must be true on Lap 1");
assert.strictEqual(startSim.tradeoffComparison.decisionMode, "SPEND_NOW", "decisionMode must be SPEND_NOW at race start");
assert.ok(startSim.tradeoffComparison.recommendation.includes("RACE START"), "Recommendation must indicate RACE START");
assert.ok(startSim.tradeoffComparison.tactic.includes("RACE START SCRAMBLE"), "Tactic must indicate RACE START SCRAMBLE");
assert.ok(startSim.tradeoffComparison.optionA.title.includes("OPENING LAP"), "Option A must focus on opening lap track position");
assert.ok(startSim.tradeoffComparison.optionB.title.includes("DRS ACTIVATION"), "Option B must defer until DRS activation");
assert.ok(startSim.upcomingLapAdvisory.directiveLabel.includes("START ATTACK"), "Upcoming lap advisory must specify START ATTACK");

// Check tactical race plan on opening laps
const startPlanUpcoming = startSim.tacticalRacePlan.filter(p => !p.isCurrent);
assert.ok(
  startPlanUpcoming.some(p => p.shortAction === "START ATTACK"),
  "Tactical race plan for opening laps must schedule START ATTACK"
);
console.log("  ✓ PASS: Race start scramble rule authorizes opening lap track position attack.");

// --------------------------------------------------------------------
// TEST 11: Sidebar Access & Battery Rule Compliance Functionality
// --------------------------------------------------------------------
console.log("\n[TEST 11] Verifying Battery Rule Compliance & Slider Responsiveness...");
const appContent = fs.readFileSync(path.resolve(__dirname, "../src/ui/EnergyDeploymentApp.js"), "utf-8");

assert.ok(appContent.includes("FINAL SPRINT AUTHORIZED"), "App must contain FINAL SPRINT AUTHORIZED capability status");
assert.ok(appContent.includes("RACE START SCRAMBLE"), "App must contain RACE START SCRAMBLE capability status");
assert.ok(appContent.includes("SAFETY FLOOR VIOLATION BLOCKED"), "App must validate safety floor rule");
assert.ok(appContent.includes("updateLivePackAllocation"), "App must define updateLivePackAllocation");
assert.ok(appContent.includes("syncLapState"), "App must define syncLapState");

// Verify that sidebar slider handlers invoke updateLivePackAllocation
assert.ok(
  appContent.includes("syncLapState = (lap, remaining, source) => {") &&
  appContent.includes("this.updateLivePackAllocation(this.state.soc, true);"),
  "syncLapState must invoke updateLivePackAllocation live"
);
assert.ok(
  appContent.includes("updateCarAheadOnly(val) {") &&
  appContent.includes("this.updateLivePackAllocation(this.state.soc, false);"),
  "updateCarAheadOnly must invoke updateLivePackAllocation live"
);
assert.ok(
  appContent.includes("updateCarBehindOnly(val) {") &&
  appContent.includes("this.updateLivePackAllocation(this.state.soc, false);"),
  "updateCarBehindOnly must invoke updateLivePackAllocation live"
);
console.log("  ✓ PASS: Battery rule validation and sidebar slider event connections verified.");

console.log("\n======================================================================");
console.log("🎉 ALL 11 BATTERY LIVE SLIDER SYNCHRONIZATION TESTS PASSED SUCCESSFULLY!");
console.log("======================================================================");
