/**
 * COMPREHENSIVE TEST SUITE FOR ALPINE F1 2026 DECISION DIGITAL TWIN
 *
 * Tests:
 * 1. Megajoule-First Energy Physics (20.0 MJ Pack, 1 MW * 1s = 1 MJ)
 * 2. Non-1:1 Independent Energy Recovery Model (C4)
 * 3. Dynamic Reserve & Free Energy Allocation (C9)
 * 4. 13 General Decision Engine Constraints (C1 - C13)
 * 5. Multi-Lap Continuous Energy Transfer (Zone -> Sector -> Lap -> Next Lap)
 * 6. Dynamic Recalculation Across All 8 Parameters
 * 7. Decision Output Structure (WHAT, WHERE, WHEN, WHY)
 * 8. Constraint -> Decision -> Outcome Adaptation Pipeline
 */

import assert from "assert";
import { alpineDecisionEngine, AlpineDecisionTwinEngine, ALPINE_CIRCUIT_ZONES } from "../src/engine/alpineDecisionTwinEngine.js";
import { FIA_RULE_PROFILE_2026, fiaRuleEngine } from "../src/engine/fia2026RuleEngine.js";

console.log("\n=======================================================");
console.log("🏎️  STARTING ALPINE F1 2026 DECISION DIGITAL TWIN TESTS");
console.log("=======================================================\n");

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// TEST 1: Megajoule-First Physics
runTest("1. Megajoule-First conversion (62% = 12.4 MJ on 20.0 MJ pack)", () => {
  const engine = new AlpineDecisionTwinEngine();
  assert.strictEqual(engine.usableCapacityMJ, 20.0);

  const mj62 = engine.socToMJ(62);
  assert.strictEqual(mj62, 12.4);

  const soc12_4 = engine.mjToSoc(12.4);
  assert.strictEqual(soc12_4, 62);

  const soc11_0 = engine.mjToSoc(11.0);
  assert.strictEqual(soc11_0, 55);

  const soc11_8 = engine.mjToSoc(11.8);
  assert.strictEqual(soc11_8, 59);

  const mj100 = engine.socToMJ(100);
  assert.strictEqual(mj100, 20.0);

  const mj0 = engine.socToMJ(0);
  assert.strictEqual(mj0, 0.0);
});

// TEST 2: Dynamic Reserve Model Baseline Values
runTest("2. Dynamic Reserve model at baseline: 4.1 MJ reserved, 8.3 MJ free", () => {
  const engine = new AlpineDecisionTwinEngine();
  const currentEnergyMJ = 12.4; // 62% SOC
  const carBehindGap = 1.4; // Safe rear
  const lapsRemaining = 33; // Lap 24 / 57
  const position = 3;

  const res = engine.calculateReserveModel(currentEnergyMJ, carBehindGap, lapsRemaining, position);

  assert.strictEqual(res.safetyFloorMJ, 3.0); // 15% floor
  assert.strictEqual(res.defenceMJ, 0.5);
  assert.strictEqual(res.futureAttackMJ, 0.4);
  assert.strictEqual(res.recoveryGapMJ, 0.2);
  assert.strictEqual(res.reserveMJ, 4.1);
  assert.strictEqual(res.freeEnergyMJ, 8.3);
  assert.strictEqual(res.reserveSoc, 21); // 4.1 / 20 * 100
  assert.strictEqual(res.freeSoc, 42); // 8.3 / 20 * 100
});

// TEST 3: Dynamic Reserve scales under rear pressure
runTest("3. Dynamic Reserve scales under close rear pressure (< 0.5s)", () => {
  const engine = new AlpineDecisionTwinEngine();
  const resPressure = engine.calculateReserveModel(12.4, 0.35, 33, 3);

  // Close rear threat increases defence allocation to 1.6 MJ
  assert.strictEqual(resPressure.defenceMJ, 1.6);
  assert.strictEqual(resPressure.reserveMJ, 5.2);
  assert.strictEqual(resPressure.freeEnergyMJ, 7.2);
  assert.strictEqual(resPressure.hasDefensivePressure, true);
});

// TEST 4: Non-1:1 Independent Energy Recovery
runTest("4. Independent Non-1:1 Recovery (braking potential, efficiency, lap harvest cap)", () => {
  const engine = new AlpineDecisionTwinEngine();
  const z6 = ALPINE_CIRCUIT_ZONES.find((z) => z.id === "Z6");
  assert.ok(z6, "Zone 6 must exist");

  const rec = engine.calculateRecovery(z6, 0.0, 55);
  // Recovery should be ~0.80 MJ (83% potential * 0.88 * 1.10)
  assert.strictEqual(rec, 0.80);

  // Quota exhaustion: When 6.9 MJ has already been harvested this lap
  const recCapped = engine.calculateRecovery(z6, 6.8, 55);
  assert.strictEqual(recCapped, 0.20); // Only 0.20 MJ remaining before 7.0 MJ cap

  // Full quota reached
  const recZero = engine.calculateRecovery(z6, 7.0, 55);
  assert.strictEqual(recZero, 0.0);
});

// TEST 5: Full Simulation at Reference State (L24, 3 Laps, P3, SOC 62%, Ahead 0.7s, Behind 1.4s)
runTest("5. Full multi-lap simulation at reference state selects SUPER-CLIP on Zone 5", () => {
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

  assert.ok(sim, "Simulation result must exist");
  assert.strictEqual(sim.initialSoc, 62);
  assert.strictEqual(sim.initialEnergyMJ, 12.4);

  // Optimal action
  const action = sim.nextBestAction;
  assert.ok(action, "Next best action must be identified");
  assert.strictEqual(action.strategy, "SUPER-CLIP");
  assert.strictEqual(action.zoneNumber, 5);
  assert.strictEqual(action.deployedMJ, 1.40);
  assert.strictEqual(sim.expectedRecoveryMJ, 0.80);
  assert.strictEqual(sim.expectedGainSec, 0.42);
  assert.strictEqual(sim.netEnergyChangeMJ, -0.60);

  // Overtake probability and defence risk
  assert.ok(sim.overtakeProb >= 80, "Overtake probability should be high with 0.7s gap and high free energy");
  assert.strictEqual(sim.defenceRisk, "LOW");
  assert.strictEqual(sim.fiaStatus, "LEGAL");
});

// TEST 6: Multi-Lap Continuous Energy Transfer (Section 3)
runTest("6. Multi-lap continuous energy transfer persists without arbitrary resets", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 2,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25
  });

  assert.strictEqual(sim.lapResults.length, 3); // Current lap + 2 future laps = 3 laps

  // Lap N end energy MUST equal Lap N+1 start energy
  for (let i = 0; i < sim.lapResults.length - 1; i++) {
    const lapEnd = sim.lapResults[i].endEnergyMJ;
    const nextStart = sim.lapResults[i + 1].startEnergyMJ;
    assert.strictEqual(lapEnd, nextStart, `Lap ${i} end energy (${lapEnd}) must match Lap ${i + 1} start (${nextStart})`);
  }

  // Zone by zone continuity
  for (let j = 0; j < sim.allSteps.length - 1; j++) {
    const stepEnd = sim.allSteps[j].energyAfterMJ;
    const nextStepStart = sim.allSteps[j + 1].energyBeforeMJ;
    assert.strictEqual(stepEnd, nextStepStart, `Step ${j} energy after must equal Step ${j + 1} energy before`);
  }
});

// TEST 7: 13 General Decision Engine Constraints (C1 to C13)
runTest("7. 13 General Decision Engine constraints (C1 to C13) evaluated and reported", () => {
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

  const c = sim.constraints13;
  assert.ok(c, "Constraints object must exist");
  assert.ok(c.c1_finite_energy, "C1 must exist");
  assert.ok(c.c2_deployment_power, "C2 must exist");
  assert.ok(c.c3_soc_operating, "C3 must exist");
  assert.ok(c.c4_harvesting, "C4 must exist");
  assert.ok(c.c5_overtake_window, "C5 must exist");
  assert.ok(c.c6_defence_constraint, "C6 must exist");
  assert.ok(c.c7_future_opportunity, "C7 must exist");
  assert.ok(c.c8_recovery_timing, "C8 must exist");
  assert.ok(c.c9_future_energy_reserve, "C9 must exist");
  assert.ok(c.c10_laps_remaining, "C10 must exist");
  assert.ok(c.c11_position_constraint, "C11 must exist");
  assert.ok(c.c12_opponent_counterattack, "C12 must exist");
  assert.ok(c.c13_zone_performance, "C13 must exist");

  // Verify types
  assert.strictEqual(c.c2_deployment_power.type, "FIA RULE");
  assert.strictEqual(c.c3_soc_operating.type, "FIA RULE");
  assert.strictEqual(c.c4_harvesting.type, "FIA RULE");
  assert.strictEqual(c.c5_overtake_window.type, "MODEL ESTIMATE");
  assert.strictEqual(c.c6_defence_constraint.type, "MODEL ESTIMATE");
  assert.strictEqual(c.c1_finite_energy.type, "SIMULATION ASSUMPTION");
});

// TEST 8: Dynamic Recalculation across Controls
runTest("8. Critical inputs dynamically adapt recommendation: Low SOC triggers COAST/SAVE", () => {
  // Low SOC: 20%
  const simLowSoc = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 20, // 4.0 MJ available, near 3.0 MJ floor
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25
  });

  // At 20% SOC, free energy is severely limited, Super-Clip is blocked
  assert.notStrictEqual(simLowSoc.nextBestAction.strategy, "SUPER-CLIP", "Low SOC must block SUPER-CLIP");
  assert.ok(
    simLowSoc.nextBestAction.strategy === "COAST" || simLowSoc.nextBestAction.strategy === "BRAKING / HARVEST",
    "Low SOC must prioritize COAST or BRAKING / HARVEST"
  );
});

// TEST 9: Gap Ahead Sensitivity
runTest("9. Large gap ahead (2.5s) advises COAST / energy conservation", () => {
  const simLargeGap = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 2.5, // Outside attack window
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25
  });

  assert.notStrictEqual(simLargeGap.nextBestAction.strategy, "SUPER-CLIP", "Gap of 2.5s should not trigger SUPER-CLIP");
});

// TEST 10: Late Race Aggression (C10)
runTest("10. Late race (Lap 56 / 57) releases future reserve to maximize immediate gain", () => {
  const simLateRace = alpineDecisionEngine.simulate({
    currentLap: 56,
    futureLaps: 1,
    position: 3,
    soc: 45, // 9.0 MJ
    carAheadGap: 0.9,
    carBehindGap: 1.4,
    intensity: 85,
    constraintLevel: 20
  });

  assert.strictEqual(simLateRace.nextBestAction.strategy, "SUPER-CLIP", "Final laps must deploy available energy aggressively");
});

// TEST 11: Constraint Level Sensitivity
runTest("11. High Constraint Level clamps power and tightens conservation", () => {
  const simHighConstraint = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 48,
    carAheadGap: 1.2,
    carBehindGap: 1.4,
    intensity: 80,
    constraintLevel: 90 // VERY CONSERVATIVE
  });

  assert.notStrictEqual(simHighConstraint.nextBestAction.strategy, "SUPER-CLIP", "High constraint level must block SUPER-CLIP");
  assert.ok(
    ["COAST", "NORMAL DEPLOYMENT", "BRAKING / HARVEST"].includes(simHighConstraint.nextBestAction.strategy),
    "High constraint level should force conservative strategy (COAST, NORMAL, or BRAKING/HARVEST)"
  );
});

// TEST 12: Adaptation Pipeline (Constraint -> Decision -> Outcome)
runTest("12. Adaptation pipeline reports 6 clear causal steps", () => {
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

  const flow = sim.adaptationFlow;
  assert.ok(flow.constraint, "Step 1: Constraint must be defined");
  assert.ok(flow.engineDetects, "Step 2: Engine detection must be defined");
  assert.ok(flow.decision, "Step 3: Decision must be defined");
  assert.ok(flow.recovery, "Step 4: Recovery must be defined");
  assert.ok(flow.nextAttack, "Step 5: Next attack must be defined");
  assert.ok(flow.outcome, "Step 6: Outcome must be defined");
});

// TEST 13: Candidate Strategy Optimization Evaluation (Section 8, 13)
runTest("13. Strategy Optimization evaluates all 4 candidates with 0-100 scores", () => {
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
  assert.strictEqual(sim.strategyComparison.length, 4, "Must evaluate exactly 4 strategies");

  const expectedNames = ["SUPER-CLIP", "NORMAL DEPLOYMENT", "COAST", "BRAKING / HARVEST"];
  sim.strategyComparison.forEach((strat) => {
    assert.ok(expectedNames.includes(strat.name), `Strategy name ${strat.name} must be valid`);
    assert.ok(strat.score >= 0 && strat.score <= 100, `Score ${strat.score} must be normalized between 0 and 100`);
    assert.strictEqual(typeof strat.isRecommended, "boolean");
  });

  // Winning strategy check
  const winner = sim.strategyComparison.find((s) => s.isRecommended);
  assert.ok(winner, "Must flag recommended strategy");
  assert.strictEqual(winner.name, "SUPER-CLIP", "SUPER-CLIP should be recommended in reference attack state");
  assert.ok(winner.score >= 80, "Winner score should be high (>=80)");
});

// TEST 14: Optimization Breakdown ('Why This Won') (Section 14)
runTest("14. Optimization Breakdown decomposes objective function into 11 explainable terms", () => {
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

  const b = sim.optimizationBreakdown;
  assert.ok(b, "optimizationBreakdown must exist");
  assert.strictEqual(typeof b.immediateRaceGain, "number");
  assert.strictEqual(typeof b.futureEnergyValue, "number");
  assert.strictEqual(typeof b.recoveryValue, "number");
  assert.strictEqual(typeof b.positionBenefit, "number");
  assert.strictEqual(typeof b.energyCost, "number");
  assert.strictEqual(typeof b.attackRisk, "number");
  assert.strictEqual(typeof b.defenceRisk, "number");
  assert.strictEqual(typeof b.futureOpportunityCost, "number");
  assert.strictEqual(typeof b.totalRawScore, "number");
  assert.strictEqual(typeof b.normalizedScore, "number");

  // Verify internal arithmetic consistency per Section 44:
  const computedRaw = b.immediateRaceGain + b.positionBenefit + b.futureEnergyValue + b.recoveryValue + b.overtakeValue
    + b.tyrePerformanceValue + b.pitStrategyValue + b.undercutValue
    - b.energyCost - b.attackRisk - b.defenceRisk - b.futureOpportunityCost - b.counterattackRisk
    - b.pitLaneTimeLoss - b.tyreDegradationCost - b.trafficRisk - b.rulePenalty;
  assert.strictEqual(b.totalRawScore, computedRaw, "totalRawScore must equal the sum of its terms");
  assert.strictEqual(b.normalizedScore, sim.strategyScore, "normalizedScore must match strategyScore");
});

// TEST 15: Option A vs Option B Trade-off Comparison (Section 9)
runTest("15. Trade-off Analysis evaluates Spend Now vs Save For Later", () => {
  const simAttack = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25
  });

  const tAttack = simAttack.tradeoffComparison;
  assert.ok(tAttack, "tradeoffComparison must exist");
  assert.ok(tAttack.optionA, "Option A must exist");
  assert.ok(tAttack.optionB, "Option B must exist");
  assert.strictEqual(tAttack.recommendation, "SPEND NOW", "With high SOC and 0.7s gap, SPEND NOW should win");

  // With low SOC, saving for later should win
  const simSave = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 25,
    carAheadGap: 1.4,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 50
  });

  const tSave = simSave.tradeoffComparison;
  assert.ok(tSave.recommendation.includes("HARVEST") || tSave.recommendation === "SAVE FOR LATER", "With low SOC, HARVEST NOW / RECHARGE should be recommended");
});

// TEST 16: Active Zone Information (Section 18)
runTest("16. Active Zone Information provides 5-dimensional performance telemetry", () => {
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

  const z = sim.activeZoneInfo;
  assert.ok(z, "activeZoneInfo must exist");
  assert.strictEqual(z.zoneNumber, 5, "Reference state targets Zone 5");
  assert.ok(z.performancePotential >= 90, "Zone 5 performance potential must be >= 90");
  assert.ok(z.overtakePotential >= 90, "Zone 5 overtake potential must be >= 90");
  assert.ok(z.recoveryPotential > 0, "Zone 5 recovery potential must be > 0");
  assert.ok(z.defenceValue > 0, "Zone 5 defence value must be > 0");
  assert.ok(z.energyEfficiency > 0, "Zone 5 energy efficiency must be > 0");
  assert.strictEqual(z.closingSpeed, "HIGH", "0.7s gap should report HIGH closing speed");
});

// TEST 17: Tyre State & Degradation Model (Section 33 & 34)
runTest("17. Tyre State Model evaluates grip, degradation, and thermal efficiency across compounds", () => {
  const simFresh = alpineDecisionEngine.simulate({
    currentLap: 10,
    compound: "MEDIUM",
    tyreAge: 2,
    trackCondition: "DRY"
  });

  assert.ok(simFresh.tyreState, "Tyre state must exist");
  assert.strictEqual(simFresh.tyreState.compoundId, "MEDIUM");
  assert.strictEqual(simFresh.tyreState.tyreAge, 2);
  assert.ok(simFresh.tyreState.grip >= 80, "Fresh Medium tyre grip should be >= 80");
  assert.strictEqual(simFresh.tyreState.degradationLevel, "LOW");

  const simOld = alpineDecisionEngine.simulate({
    currentLap: 26,
    compound: "MEDIUM",
    tyreAge: 24,
    trackCondition: "DRY"
  });

  assert.ok(simOld.tyreState.grip < 65, "Worn 24-lap tyre grip should drop below 65");
  assert.ok(["HIGH", "CRITICAL"].includes(simOld.tyreState.degradationLevel), "Degradation should be HIGH or CRITICAL");
});

// TEST 18: Circuit Pit Stop Loss & Safety Car Impact (Section 31 & 41)
runTest("18. Circuit Pit Stop Loss distinguishes stationary 2.4s from total 21.4s loss, VSC saves 7.6s", () => {
  const simNormal = alpineDecisionEngine.simulate({
    position: 2,
    isVscOrSc: false
  });

  const pLoss = simNormal.pitLoss;
  assert.strictEqual(pLoss.stationaryTimeSec, 2.4, "Stationary tyre change must be 2.4s");
  assert.strictEqual(pLoss.totalPitLossSec, 21.4, "Total pit loss must be configurable circuit parameter (21.4s)");
  assert.strictEqual(pLoss.currentPosition, 2);
  assert.strictEqual(pLoss.predictedExitPosition, "P8", "P2 rejoining after 21.4s loss drops ~6 positions");

  // VSC / Safety Car pit stop
  const simVsc = alpineDecisionEngine.simulate({
    position: 2,
    isVscOrSc: true
  });

  assert.strictEqual(simVsc.pitLoss.totalPitLossSec, 13.8, "VSC pit loss reduced to 13.8s");
  assert.strictEqual(simVsc.pitLoss.timeSavedVsNormalSec, 7.6, "VSC saves 7.6s vs green flag");
});

// TEST 19: Undercut & Overcut Potential (Section 38 & 39)
runTest("19. Undercut model estimates +1.8s expected gain against worn tyres", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 26,
    carAheadGap: 0.8,
    tyreAge: 22,
    compound: "MEDIUM"
  });

  assert.ok(sim.undercutOvercut, "Undercut/Overcut model must exist");
  assert.strictEqual(sim.undercutOvercut.undercutGainSec, 1.8, "Undercut should yield +1.8s in optimal attack window");
  assert.strictEqual(sim.undercutOvercut.undercutViability, "HIGH");
  assert.strictEqual(sim.undercutOvercut.isUndercutRecommended, true);
});

// TEST 20: Candidate Pit Actions (Section 32)
runTest("20. Optimizer evaluates all 5 candidate pit actions (Stay Out, Pit Now, Next Lap, In 2 Laps, Extend)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    carAheadGap: 0.7,
    tyreAge: 24,
    compound: "MEDIUM"
  });

  assert.ok(sim.pitActions, "pitActions must exist");
  assert.ok(Array.isArray(sim.pitActions.candidateActions), "candidateActions must be array");
  assert.strictEqual(sim.pitActions.candidateActions.length, 5, "Must evaluate exactly 5 pit actions");

  const expectedActions = ["STAY OUT", "PIT NOW", "PIT NEXT LAP", "PIT IN 2 LAPS", "EXTEND STINT"];
  sim.pitActions.candidateActions.forEach((act) => {
    assert.ok(expectedActions.includes(act.action), `Action ${act.action} must be canonical`);
    assert.strictEqual(typeof act.score, "number");
    assert.strictEqual(typeof act.timeCostSec, "number");
  });
});

// TEST 21: Optimal Pit Window Generator (Section 40)
runTest("21. Dynamic Pit Window calculates optimal centroid and early/late risks", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    tyreAge: 18,
    compound: "MEDIUM"
  });

  assert.ok(sim.pitWindow, "pitWindow must exist");
  assert.ok(sim.pitWindow.windowString.includes("Lap"), "Window string formatted correctly");
  assert.ok(sim.pitWindow.bestLapString.includes("Best:"), "Best lap identified");
  assert.ok(sim.pitWindow.earlyStopRisk.includes("+0.4s"), "Early stop risk quantified");
  assert.ok(sim.pitWindow.lateStopRisk.includes("+1.1s"), "Late stop risk quantified");
});

// TEST 22: Tactical Multi-Lap Race Plan & Energy-Tyre Strategy Interaction (Section 36, 37, 45, 48)
runTest("22. Tactical Race Plan synthesizes 5-lap multi-layer plan (Energy + Tyre + Pit)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    tyreAge: 22,
    compound: "MEDIUM",
    carAheadGap: 1.5,
    soc: 52
  });

  assert.ok(Array.isArray(sim.tacticalRacePlan), "tacticalRacePlan must be an array");
  assert.strictEqual(sim.tacticalRacePlan.length, 5, "Must output a 5-lap timeline plan");

  // First step should be current lap
  assert.strictEqual(sim.tacticalRacePlan[0].lap, 24);
  assert.strictEqual(sim.tacticalRacePlan[0].isCurrentLap, true);

  // Pit step should exist in the plan
  const pitStep = sim.tacticalRacePlan.find((p) => p.isPitLap);
  assert.ok(pitStep, "A planned pit step must be present in the multi-lap timeline");
  assert.strictEqual(pitStep.shortAction, "PIT");
  assert.ok(pitStep.compound.includes("→"), "Should show compound transition e.g. MEDIUM -> HARD");

  // Why explanation should incorporate tyre degradation and post-pit attack reasoning
  assert.ok(sim.why.includes("Old tyres") || sim.why.includes("fresh"), "Why must explain tyre & pit trade-off");
});

console.log("\n=======================================================");
console.log(`🎉 ALL ${passedTests} ALPINE DECISION DIGITAL TWIN TESTS PASSED!`);
console.log("=======================================================\n");
