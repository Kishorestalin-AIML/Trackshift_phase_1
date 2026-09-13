import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("======================================================================");
console.log("🏁 STARTING SECTION 31: CASE-BY-CASE VALIDATION ENGINE (10 CASES)");
console.log("======================================================================");

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

// ==============================================================================
// CASE 1 — High Energy Attack
// High SOC, small gap ahead, fresh tyres, good attack zone, large gap behind
// Expected: aggressive action should become competitive & feasible
// ==============================================================================
test("CASE 1 — High Energy Attack (High SOC, Gap 0.5s, Fresh Soft, Gap Behind 2.0s)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 20,
    futureLaps: 3,
    position: 2,
    soc: 80, // 16.0 MJ available
    carAheadGap: 0.5,
    carBehindGap: 2.0,
    intensity: 85,
    constraintLevel: 15,
    compound: "SOFT",
    tyreAge: 3,
    trackCondition: "DRY"
  });

  assert.strictEqual(sim.nextBestAction.strategy, "SUPER-CLIP", "High energy attack should favor aggressive SUPER-CLIP");
  assert.strictEqual(sim.nextBestAction.isFeasible, true, "Action must be feasible");
  assert.ok(sim.overtakeProb >= 0.70, `Overtake probability should be high (${sim.overtakeProb})`);
  assert.ok(sim.currentReserve.freeEnergyMJ >= 1.40, `Free energy (${sim.currentReserve.freeEnergyMJ}) must comfortably exceed 1.40 MJ`);
  assert.strictEqual(sim.constraints13.c1_finite_energy.status, "PASSED");
  assert.strictEqual(sim.constraints13.c5_overtake_window.status, "WINDOW_OPTIMAL");
});

// ==============================================================================
// CASE 2 — Low Energy
// Low SOC, large gap ahead, old tyres, weak attack zone
// Expected: Super-Clip becomes infeasible or unattractive, Coast/Harvest becomes competitive
// ==============================================================================
test("CASE 2 — Low Energy (Low SOC 18%, Gap Ahead 2.5s, Old Tyres, Weak Attack Zone)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 28,
    futureLaps: 3,
    position: 4,
    soc: 18, // 3.6 MJ total pack
    carAheadGap: 2.5,
    carBehindGap: 1.8,
    intensity: 50,
    constraintLevel: 50,
    compound: "HARD",
    tyreAge: 25,
    trackCondition: "DRY"
  });

  const sc = sim.strategyComparison.find((s) => s.name === "SUPER-CLIP");
  assert.ok(
    !sc.breakdown.isFeasible || sc.score < 50,
    "Super-Clip must be infeasible or severely scored down due to low energy"
  );
  assert.ok(
    sim.nextBestAction.strategy === "COAST" || sim.nextBestAction.strategy === "BRAKING / HARVEST",
    `Conservative strategy expected, got: ${sim.nextBestAction.strategy}`
  );
  assert.ok(sim.constraints13.c1_finite_energy.status !== "PASSED" || sim.currentReserve.freeEnergyMJ < 1.40);
});

// ==============================================================================
// CASE 3 — Low Energy + Close Defender
// Low SOC, P2, P3 very close (<0.5s)
// Expected: defence reserve increases, possible position loss/concession if defence insufficient
// ==============================================================================
test("CASE 3 — Low Energy + Close Defender (P2, SOC 15%, P3 gap 0.3s)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 30,
    futureLaps: 3,
    position: 2,
    soc: 15, // 3.0 MJ pack
    carAheadGap: 1.5,
    carBehindGap: 0.3, // Severe pressure
    intensity: 60,
    constraintLevel: 40,
    compound: "MEDIUM",
    tyreAge: 18,
    trackCondition: "DRY"
  });

  assert.ok(sim.currentReserve.defenceMJ >= 1.5, `Defence reserve must expand under <0.5s pressure (${sim.currentReserve.defenceMJ})`);
  assert.ok(sim.currentReserve.hasDefensivePressure, "Defensive pressure flag must be active");
  assert.ok(sim.defenceRisk === "HIGH" || sim.defenceRiskNum >= 0.70, `Defence risk must be high (${sim.defenceRisk})`);
  assert.ok(sim.constraints13.c6_defence_constraint.status === "HIGH_PRESSURE" || sim.constraints13.c6_defence_constraint.status === "DEFENSIVE_PRESSURE");
  assert.ok(sim.positionLost || sim.defenceConcession, "Position loss or defence concession must be recorded");
});

// ==============================================================================
// CASE 4 — Fresh Tyres
// Fresh Soft compound vs Worn Hard compound
// Expected: higher attack potential, higher tyre performance factor
// ==============================================================================
test("CASE 4 — Fresh Tyres (Fresh Soft vs Worn Hard comparison)", () => {
  const simFresh = alpineDecisionEngine.simulate({
    currentLap: 22,
    futureLaps: 3,
    position: 3,
    soc: 60,
    carAheadGap: 0.8,
    carBehindGap: 2.0,
    intensity: 75,
    constraintLevel: 25,
    compound: "SOFT",
    tyreAge: 2,
    trackCondition: "DRY"
  });

  const simWorn = alpineDecisionEngine.simulate({
    currentLap: 22,
    futureLaps: 3,
    position: 3,
    soc: 60,
    carAheadGap: 0.8,
    carBehindGap: 2.0,
    intensity: 75,
    constraintLevel: 25,
    compound: "HARD",
    tyreAge: 28,
    trackCondition: "DRY"
  });

  assert.ok(
    simFresh.tyreState.performanceFactor > simWorn.tyreState.performanceFactor,
    `Fresh tyre performance (${simFresh.tyreState.performanceFactor}) must exceed worn tyre (${simWorn.tyreState.performanceFactor})`
  );
  assert.ok(simFresh.tyreState.grip > simWorn.tyreState.grip, "Fresh tyre grip must be higher");
  assert.ok(
    simFresh.effectiveGainSec > simWorn.effectiveGainSec || simFresh.overtakeProb > simWorn.overtakeProb,
    "Fresh tyres must yield higher effective race gain or overtake probability"
  );
});

// ==============================================================================
// CASE 5 — Old Tyres
// Old Hard (32 laps)
// Expected: lower pace, higher pit value
// ==============================================================================
test("CASE 5 — Old Tyres (Old Hard 32 laps -> high degradation & pit stop value)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 34,
    futureLaps: 4,
    position: 3,
    soc: 55,
    carAheadGap: 1.2,
    carBehindGap: 1.5,
    intensity: 65,
    constraintLevel: 30,
    compound: "HARD",
    tyreAge: 32,
    trackCondition: "DRY"
  });

  assert.ok(sim.tyreState.grip < 75, `Grip should be degraded (${sim.tyreState.grip}%)`);
  assert.ok(sim.pitWindow.plannedPitLap !== undefined, "Pit window must be calculated");
  assert.ok(sim.tyreState.degradationLevel === "HIGH" || sim.tyreState.degradationLevel === "CRITICAL" || sim.tyreState.grip < 75, "Tyre degradation must be high or critical");
  assert.ok(sim.tacticalRacePlan && sim.tacticalRacePlan.some((step) => step.isPitLap), "Multi-lap plan must contain a planned pit stop");
});

// ==============================================================================
// CASE 6 — Strong Recovery Zone
// Low energy, recovery zone approaching
// Expected: preserve energy, harvest, future attack becomes stronger
// ==============================================================================
test("CASE 6 — Strong Recovery Zone (Low energy + braking harvest zone ahead)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 24,
    carAheadGap: 1.6,
    carBehindGap: 2.2,
    intensity: 60,
    constraintLevel: 30,
    compound: "MEDIUM",
    tyreAge: 10,
    trackCondition: "DRY"
  });

  assert.ok(sim.recoveryTiming.zonesAway <= 3, "Next recovery zone should be proximate");
  assert.ok(sim.expectedRecoveryMJ >= 0.8, `Expected recovery must be substantial (${sim.expectedRecoveryMJ} MJ)`);
  assert.ok(
    sim.nextBestAction.strategy === "BRAKING / HARVEST" || sim.nextBestAction.strategy === "COAST",
    `Should prioritize HARVEST or COAST, got: ${sim.nextBestAction.strategy}`
  );
  assert.ok(sim.socAfterRecovery > sim.initialSoc, "Battery must replenish across recovery phase");
});

// ==============================================================================
// CASE 7 — Late Race
// Lap near race end (Lap 55 of 57)
// Expected: future opportunity value decreases, immediate position gain becomes more valuable
// ==============================================================================
test("CASE 7 — Late Race (Lap 55/57 -> short horizon, immediate race value prioritized)", () => {
  const simLate = alpineDecisionEngine.simulate({
    currentLap: 55,
    futureLaps: 2,
    position: 2,
    soc: 65,
    carAheadGap: 0.6,
    carBehindGap: 1.8,
    intensity: 85,
    constraintLevel: 10,
    compound: "SOFT",
    tyreAge: 5,
    trackCondition: "DRY"
  });

  const simMid = alpineDecisionEngine.simulate({
    currentLap: 25,
    futureLaps: 5,
    position: 2,
    soc: 65,
    carAheadGap: 0.6,
    carBehindGap: 1.8,
    intensity: 85,
    constraintLevel: 10,
    compound: "SOFT",
    tyreAge: 5,
    trackCondition: "DRY"
  });

  assert.ok(
    simLate.optimizationBreakdown.futureEnergyValue < simMid.optimizationBreakdown.futureEnergyValue,
    `Late race future energy reserve weighting (${simLate.optimizationBreakdown.futureEnergyValue}) should be lower than mid-race (${simMid.optimizationBreakdown.futureEnergyValue})`
  );
  assert.strictEqual(simLate.nextBestAction.strategy, "SUPER-CLIP", "Late race attack should be decisively aggressive");
});

// ==============================================================================
// CASE 8 — Illegal / Clamped Action
// Action exceeds configured FIA or physical power limit
// Expected: REJECTED or Clamped
// ==============================================================================
test("CASE 8 — Illegal / Clamped Action (FIA 350 kW clamp & legal compliance)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 20,
    futureLaps: 3,
    position: 2,
    soc: 90,
    carAheadGap: 0.4,
    carBehindGap: 2.5,
    intensity: 100, // Demands 380 kW (> 350 kW limit)
    constraintLevel: 80,
    compound: "SOFT",
    tyreAge: 2,
    trackCondition: "DRY"
  });

  assert.ok(sim.nextBestAction.deployedPowerKw <= 350, `Deployed power (${sim.nextBestAction.deployedPowerKw} kW) must never exceed 350 kW`);
  assert.ok(sim.constraints13.c2_deployment_power.status === "DERATED" || sim.constraints13.c2_deployment_power.status === "POWER_DERATED");
  assert.strictEqual(sim.constraints13.c2_deployment_power.type, "FIA RULE");
  assert.ok(sim.nextBestAction.deployedMJ <= 1.40, `Deployed MJ (${sim.nextBestAction.deployedMJ}) must not exceed FIA single-zone ceiling`);
});

// ==============================================================================
// CASE 9 — Pit Decision
// Compare STAY_OUT vs PIT_NOW vs PIT_NEXT_LAP
// Expected: future tyre gain vs pit loss determines result
// ==============================================================================
test("CASE 9 — Pit Decision (Evaluation of pit actions and undercut/overcut balance)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 26,
    futureLaps: 3,
    position: 3,
    soc: 50,
    carAheadGap: 1.0,
    carBehindGap: 1.2,
    intensity: 70,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 22,
    trackCondition: "DRY"
  });

  const actionsList = Array.isArray(sim.pitActions) ? sim.pitActions : (sim.pitActions.candidateActions || []);
  assert.ok(actionsList.length >= 4, "Must evaluate at least 4 pit candidate actions");
  const pitNow = actionsList.find((a) => a.action === "PIT NOW" || a.action === "PIT_NOW");
  const stayOut = actionsList.find((a) => a.action === "STAY OUT" || a.action === "STAY_OUT");
  assert.ok(pitNow, "PIT NOW action must exist");
  assert.ok(stayOut, "STAY OUT action must exist");
  assert.ok(typeof pitNow.score === "number", "Pit action must have a computed score");
  assert.ok(typeof stayOut.score === "number", "Stay out action must have a computed score");
  const lossSec = sim.pitLoss.totalPitLossSec || sim.pitLoss.totalLossSec;
  assert.ok(lossSec > 15, `Pit loss must be calculated from physical model (${lossSec}s)`);
});

// ==============================================================================
// CASE 10 — Position Loss
// P2, low defence capability (critical battery 14%), P3 close (0.3s)
// Expected: P3 closes, passing opportunity, player loses position P2 -> P3
// ==============================================================================
test("CASE 10 — Position Loss (P2 -> P3 on battery depletion under close pressure)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 2,
    soc: 14, // Critical SOC (2.8 MJ)
    carAheadGap: 1.2,
    carBehindGap: 0.35, // Severe pressure
    intensity: 60,
    constraintLevel: 30,
    compound: "MEDIUM",
    tyreAge: 18,
    trackCondition: "DRY"
  });

  assert.strictEqual(sim.centralRaceState.position, 2, "Initial position was P2");
  assert.strictEqual(sim.positionLost, true, "Position lost must be flagged true");
  assert.strictEqual(sim.simulatedOutcomes.positionBefore, 2);
  assert.strictEqual(sim.simulatedOutcomes.positionAfter, 3);
  
  // Verify race order dynamically reordered
  const raceOrder = sim.simulatedOutcomes.raceOrder;
  assert.strictEqual(raceOrder[0].id, "NOR", "Leader is Norris");
  assert.strictEqual(raceOrder[1].id, "LEC", "Rival Leclerc overtook into P2");
  assert.strictEqual(raceOrder[2].id, "GAS", "Player Gasly dropped to P3");
  assert.strictEqual(raceOrder[2].pos, 3, "Player pos updated to 3");
});

console.log("======================================================================");
console.log("🎉 ALL 10 SECTION 31 CASE VALIDATION TESTS PASSED!");
console.log("======================================================================");
