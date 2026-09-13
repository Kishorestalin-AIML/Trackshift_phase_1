/**
 * SECTION 21 VERIFICATION: CONNECTED DECISION ENGINE TEST SUITE
 * 
 * Tests the 7 Core Technical Debug Cases from Section 21:
 * CASE 1: High SOC + small gap + fresh tyre -> aggressive attack is attractive (SUPER-CLIP)
 * CASE 2: Low SOC + weak current opportunity -> conservation is attractive (COAST)
 * CASE 3: Low SOC + strong recovery opportunity -> harvest is attractive (BRAKING / HARVEST)
 * CASE 4: Strong attack + old tyres -> tyre degradation reduces attack value & increases pit value
 * CASE 5: Very small gap behind -> defence reserve increases & affects the decision
 * CASE 6: Late race / final lap -> future opportunity value decreases (fewer future laps)
 * CASE 7: Illegal candidate action -> rejected by FIA constraint engine rather than winning
 * 
 * Also tests:
 * - Single Central Race State object validation (Section 2)
 * - Sigmoid Overtake model validation (Section 7)
 * - Energy Reserve & Free Energy equation (Section 4)
 */

import assert from "assert";
import { alpineDecisionEngine, ALPINE_CIRCUIT_ZONES } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("\n====================================================================");
console.log("🏎️  STARTING CONNECTED DECISION ENGINE VERIFICATION (SECTION 21)");
console.log("====================================================================\n");

let passed = 0;

function testCase(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ============================================================================
// SINGLE CENTRAL RACE STATE VALIDATION (SECTION 2)
// ============================================================================
testCase("Section 2: Single Central Race State contains all required variables", () => {
  const state = {
    currentLap: 25,
    futureLaps: 3,
    position: 2,
    soc: 70,
    carAheadGap: 0.6,
    carBehindGap: 2.0,
    compound: "MEDIUM",
    tyreAge: 8,
    trackCondition: "DRY",
    constraintLevel: 25
  };

  const centralState = alpineDecisionEngine.buildCentralRaceState(state);
  assert.ok(centralState, "centralRaceState must be created");

  // Verify all 18 specified fields exist and are populated
  assert.strictEqual(centralState.currentLap, 25);
  assert.strictEqual(centralState.futureLaps, 3);
  assert.strictEqual(centralState.position, 2);
  assert.strictEqual(centralState.SOC, 70);
  assert.strictEqual(centralState.energyMJ, 14.0); // 70% of 20.0 MJ
  assert.strictEqual(centralState.usableEnergy, 20.0);
  assert.strictEqual(centralState.gapAhead, 0.6);
  assert.strictEqual(centralState.gapBehind, 2.0);
  assert.ok(typeof centralState.closingSpeed === "number", "closingSpeed must be a number");
  assert.strictEqual(centralState.tyreCompound, "MEDIUM");
  assert.strictEqual(centralState.tyreAge, 8);
  assert.ok(centralState.tyrePerformance >= 0.70, "8-lap Medium tyre performance should be >= 0.70");
  assert.strictEqual(centralState.trackCondition, "DRY");
  assert.ok(centralState.pitWindow, "pitWindow must exist");
  assert.ok(typeof centralState.pitLoss === "number", "pitLoss must be a number");
  assert.ok(Array.isArray(centralState.recoveryZones) && centralState.recoveryZones.length > 0, "recoveryZones array");
  assert.ok(Array.isArray(centralState.attackZones) && centralState.attackZones.length > 0, "attackZones array");
  assert.strictEqual(centralState.constraintLevel, 25);

  // Verify simulate() also embeds this centralRaceState
  const sim = alpineDecisionEngine.simulate(state);
  assert.ok(sim.centralRaceState, "sim must include centralRaceState");
  assert.ok(sim.raceState, "sim must include raceState alias");
  assert.strictEqual(sim.centralRaceState.currentLap, 25);
});

// ============================================================================
// CASE 1: High SOC + small gap + fresh tyre -> aggressive attack is attractive
// ============================================================================
testCase("CASE 1: High SOC + small gap + fresh tyre -> aggressive attack is attractive (SUPER-CLIP)", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 25,
    futureLaps: 3,
    position: 2,
    soc: 70,
    carAheadGap: 0.6,
    carBehindGap: 2.0,
    compound: "MEDIUM",
    tyreAge: 8,
    intensity: 85,
    constraintLevel: 25
  });

  // Section 18 example scenario
  assert.strictEqual(sim.nextBestAction.strategy, "SUPER-CLIP", "SUPER-CLIP must be recommended");
  assert.strictEqual(sim.nextBestAction.zoneNumber, 5, "Must target primary attack straight (Zone 5)");
  assert.ok(sim.strategyScore >= 80, `Expected score >= 80, got ${sim.strategyScore}`);
  assert.ok(sim.overtakeProb >= 75, `Expected overtake probability >= 75%, got ${sim.overtakeProb}%`);
});

// ============================================================================
// CASE 2: Low SOC + weak current opportunity -> conservation is attractive
// ============================================================================
testCase("CASE 2: Low SOC + weak current opportunity -> conservation is attractive (COAST)", () => {
  // When gap ahead is large (2.5s) and SOC is low (25%), discretionary attack is unjustified and recovery is low
  const z5 = ALPINE_CIRCUIT_ZONES.find(z => z.id === "Z5");
  const lowSoc = 25; // 5.0 MJ
  const reserve = alpineDecisionEngine.calculateReserveModel(5.0, 1.4, 30, 3);
  
  const stepInput = {
    currentEnergyMJ: 5.0,
    position: 3,
    carAheadGap: 2.5, // Large gap ahead = weak current opportunity
    carBehindGap: 1.4,
    lapsRemaining: 30,
    intensity: 75,
    constraintLevel: 25
  };

  const decision = alpineDecisionEngine.evaluateZoneStrategies(
    z5,
    stepInput,
    reserve,
    0.0,
    { performanceFactor: 0.85, degradationLevel: "LOW" },
    null
  );

  assert.strictEqual(decision.chosenStrategy, "COAST", "COAST must be chosen in weak opportunity with low SOC");
  assert.ok(decision.scores["COAST"] > decision.scores["SUPER-CLIP"], "COAST must outscore SUPER-CLIP");
  assert.ok(decision.scores["COAST"] > decision.scores["NORMAL DEPLOYMENT"], "COAST must outscore NORMAL DEPLOYMENT");
  assert.ok(decision.candidateBreakdowns["SUPER-CLIP"].isFeasible === false, "SUPER-CLIP must be infeasible due to low SOC");
});

// ============================================================================
// CASE 3: Low SOC + strong recovery opportunity -> harvest is attractive
// ============================================================================
testCase("CASE 3: Low SOC + strong recovery opportunity -> harvest is attractive (BRAKING / HARVEST)", () => {
  // Zone 4 is chicane heavy braking (recovery potential 85)
  const z4 = ALPINE_CIRCUIT_ZONES.find(z => z.id === "Z4");
  const lowSoc = 28; // 5.6 MJ
  const reserve = alpineDecisionEngine.calculateReserveModel(5.6, 1.4, 30, 3);

  const stepInput = {
    currentEnergyMJ: 5.6,
    position: 3,
    carAheadGap: 1.2,
    carBehindGap: 1.4,
    lapsRemaining: 30,
    intensity: 75,
    constraintLevel: 25
  };

  const decision = alpineDecisionEngine.evaluateZoneStrategies(
    z4,
    stepInput,
    reserve,
    0.0,
    { performanceFactor: 0.85, degradationLevel: "LOW" },
    null
  );

  assert.strictEqual(decision.chosenStrategy, "BRAKING / HARVEST", "BRAKING / HARVEST must be chosen in heavy braking zone");
  assert.ok(decision.scores["BRAKING / HARVEST"] >= 75, `Expected HARVEST score >= 75, got ${decision.scores["BRAKING / HARVEST"]}`);
  assert.ok(decision.recoveredMJ > 0.5, "Expected positive recovery MJ");
});

// ============================================================================
// CASE 4: Strong attack + old tyres -> tyre degradation reduces attack value & increases pit value
// ============================================================================
testCase("CASE 4: Strong attack + old tyres -> tyre degradation reduces attack value & increases pit value", () => {
  const z5 = ALPINE_CIRCUIT_ZONES.find(z => z.id === "Z5");
  const freshTyreState = alpineDecisionEngine.tyrePitEngine.calculateTyreState({
    compoundId: "MEDIUM",
    tyreAge: 6
  });
  const oldTyreState = alpineDecisionEngine.tyrePitEngine.calculateTyreState({
    compoundId: "MEDIUM",
    tyreAge: 26 // Critical degradation
  });

  assert.ok(freshTyreState.performanceFactor > oldTyreState.performanceFactor, "Fresh tyre factor must be higher than old tyre");

  const reserve = alpineDecisionEngine.calculateReserveModel(14.0, 1.8, 30, 2);
  const stepInput = {
    currentEnergyMJ: 14.0,
    position: 2,
    carAheadGap: 0.7,
    carBehindGap: 1.8,
    lapsRemaining: 30,
    intensity: 85,
    constraintLevel: 25
  };

  const decisionFresh = alpineDecisionEngine.evaluateZoneStrategies(z5, stepInput, reserve, 0.0, freshTyreState, null);
  const decisionOld = alpineDecisionEngine.evaluateZoneStrategies(z5, stepInput, reserve, 0.0, oldTyreState, null);

  const superClipFresh = decisionFresh.candidateBreakdowns["SUPER-CLIP"];
  const superClipOld = decisionOld.candidateBreakdowns["SUPER-CLIP"];

  // Verify attack value is reduced by tyre degradation
  assert.ok(superClipFresh.immediateGain > superClipOld.immediateGain, "Immediate attack gain must decrease with tyre age");
  assert.ok(superClipFresh.tyreValue > superClipOld.tyreValue, "Tyre value term must decrease with tyre age");

  // Verify Pit Value increases when tyres are old
  const pitActionsFresh = alpineDecisionEngine.tyrePitEngine.evaluatePitActions({
    currentLap: 25,
    position: 2,
    tyreState: freshTyreState,
    carAheadGap: 0.7,
    carBehindGap: 1.8
  });
  const pitActionsOld = alpineDecisionEngine.tyrePitEngine.evaluatePitActions({
    currentLap: 25,
    position: 2,
    tyreState: oldTyreState,
    carAheadGap: 0.7,
    carBehindGap: 1.8
  });

  const pitNowFresh = pitActionsFresh.candidateActions.find(a => a.action === "PIT NOW");
  const pitNowOld = pitActionsOld.candidateActions.find(a => a.action === "PIT NOW");

  assert.ok(pitNowOld.score > pitNowFresh.score, "Pit Now score must be higher with old degrading tyres than fresh tyres");
});

// ============================================================================
// CASE 5: Very small gap behind -> defence reserve must affect the decision
// ============================================================================
testCase("CASE 5: Very small gap behind -> defence reserve increases and affects the decision", () => {
  const currentEnergy = 12.0; // 60% SOC
  const resSafeRear = alpineDecisionEngine.calculateReserveModel(currentEnergy, 2.0, 30, 2);
  const resPressuredRear = alpineDecisionEngine.calculateReserveModel(currentEnergy, 0.35, 30, 2);

  // Defence reserve must increase under close threat
  assert.ok(resPressuredRear.defenceMJ > resSafeRear.defenceMJ, "Defence reserve must increase under close rear threat");
  assert.strictEqual(resPressuredRear.hasDefensivePressure, true);
  assert.ok(resPressuredRear.freeEnergyMJ < resSafeRear.freeEnergyMJ, "Free energy must decrease when defence reserve increases");

  // In Zone 5 with tight rear pressure
  const z5 = ALPINE_CIRCUIT_ZONES.find(z => z.id === "Z5");
  const stepSafe = {
    currentEnergyMJ: currentEnergy,
    position: 2,
    carAheadGap: 0.7,
    carBehindGap: 2.0,
    lapsRemaining: 30,
    intensity: 75,
    constraintLevel: 25
  };
  const stepPressure = {
    ...stepSafe,
    carBehindGap: 0.35
  };

  const decSafe = alpineDecisionEngine.evaluateZoneStrategies(z5, stepSafe, resSafeRear, 0.0, null, null);
  const decPressure = alpineDecisionEngine.evaluateZoneStrategies(z5, stepPressure, resPressuredRear, 0.0, null, null);

  const defCostSafe = decSafe.candidateBreakdowns["SUPER-CLIP"].defenceCost;
  const defCostPressure = decPressure.candidateBreakdowns["SUPER-CLIP"].defenceCost;

  assert.ok(defCostPressure > defCostSafe, "SUPER-CLIP defence cost must be significantly higher under rear pressure");
});

// ============================================================================
// CASE 6: Late race / final lap -> future opportunity value decreases
// ============================================================================
testCase("CASE 6: Late race / final lap -> future opportunity value decreases (fewer future laps)", () => {
  const z5 = ALPINE_CIRCUIT_ZONES.find(z => z.id === "Z5");
  const reserveMidRace = alpineDecisionEngine.calculateReserveModel(14.0, 1.8, 32, 2);
  const reserveFinalLap = alpineDecisionEngine.calculateReserveModel(14.0, 1.8, 1, 2);

  const stepMidRace = {
    currentEnergyMJ: 14.0,
    position: 2,
    carAheadGap: 0.7,
    carBehindGap: 1.8,
    lapsRemaining: 32,
    intensity: 85,
    constraintLevel: 25
  };
  const stepFinalLap = {
    ...stepMidRace,
    lapsRemaining: 1
  };

  const decMid = alpineDecisionEngine.evaluateZoneStrategies(z5, stepMidRace, reserveMidRace, 0.0, null, null);
  const decFinal = alpineDecisionEngine.evaluateZoneStrategies(z5, stepFinalLap, reserveFinalLap, 0.0, null, null);

  // On the final lap, future attack buffer is released
  assert.ok(reserveFinalLap.futureAttackMJ < reserveMidRace.futureAttackMJ, "Final lap releases future attack reserve");

  // In COAST: futureOpportunityValue is high in mid-race (saving for future) and near zero on final lap
  const coastMidFutureVal = decMid.candidateBreakdowns["COAST"].futureOpportunityValue;
  const coastFinalFutureVal = decFinal.candidateBreakdowns["COAST"].futureOpportunityValue;

  assert.ok(coastFinalFutureVal < coastMidFutureVal, "COAST future opportunity value must decrease when fewer laps remain");
});

// ============================================================================
// CASE 7: Illegal candidate action -> rejected by FIA constraint engine
// ============================================================================
testCase("CASE 7: Illegal candidate action -> rejected by FIA constraint engine rather than winning", () => {
  const z5 = ALPINE_CIRCUIT_ZONES.find(z => z.id === "Z5");
  // Force low SOC = 20% (below 40% threshold for 350 kW SUPER-CLIP)
  const lowEnergy = 4.0;
  const reserve = alpineDecisionEngine.calculateReserveModel(lowEnergy, 1.4, 30, 2);

  const stepInput = {
    currentEnergyMJ: lowEnergy,
    position: 2,
    carAheadGap: 0.6,
    carBehindGap: 1.4,
    lapsRemaining: 30,
    intensity: 85,
    constraintLevel: 25
  };

  const decision = alpineDecisionEngine.evaluateZoneStrategies(z5, stepInput, reserve, 0.0, null, null);
  const superClip = decision.candidateBreakdowns["SUPER-CLIP"];

  // SUPER-CLIP must be infeasible / illegal
  assert.strictEqual(superClip.isFeasible, false, "SUPER-CLIP must be marked infeasible under low SOC envelope");
  assert.ok(superClip.constraintStatus === "BLOCKED" || superClip.constraintStatus === "RESTRICTED", "Constraint status must be BLOCKED or RESTRICTED");
  assert.notStrictEqual(decision.chosenStrategy, "SUPER-CLIP", "Illegal action must not be chosen as optimal strategy");
});

// ============================================================================
// JOINT SIGMOID OVERTAKE MODEL VALIDATION (SECTION 7)
// ============================================================================
testCase("Section 7: Joint Sigmoid Overtake Model combines all 6 factors", () => {
  // 1. Prime conditions: close gap (0.6s), favorable closing, attack straight (92), good energy, fresh tyre (0.95), low defence risk
  const pPrime = alpineDecisionEngine.calculateOvertakeProbability({
    gapAhead: 0.6,
    closingSpeed: 0.8,
    zoneOvertakeValue: 92,
    energyAdvantage: 3.0,
    tyrePerformance: 0.95,
    defenceRisk: 0.1
  });
  assert.ok(pPrime >= 90, `Prime overtake probability should be >= 90%, got ${pPrime}%`);

  // 2. High gap reduces overtake probability
  const pBigGap = alpineDecisionEngine.calculateOvertakeProbability({
    gapAhead: 2.2,
    closingSpeed: -0.5,
    zoneOvertakeValue: 92,
    energyAdvantage: 3.0,
    tyrePerformance: 0.95,
    defenceRisk: 0.1
  });
  assert.ok(pBigGap < pPrime, `Larger gap ahead must reduce overtake probability (${pBigGap}% vs ${pPrime}%)`);

  // 3. Degraded tyre reduces overtake probability
  const pWornTyre = alpineDecisionEngine.calculateOvertakeProbability({
    gapAhead: 0.6,
    closingSpeed: 0.8,
    zoneOvertakeValue: 92,
    energyAdvantage: 3.0,
    tyrePerformance: 0.40, // Worn tyre
    defenceRisk: 0.1
  });
  assert.ok(pWornTyre < pPrime, `Worn tyres must reduce overtake probability (${pWornTyre}% vs ${pPrime}%)`);

  // 4. Heavy defence risk reduces overtake probability
  const pDefended = alpineDecisionEngine.calculateOvertakeProbability({
    gapAhead: 0.6,
    closingSpeed: 0.8,
    zoneOvertakeValue: 92,
    energyAdvantage: 3.0,
    tyrePerformance: 0.95,
    defenceRisk: 0.9 // Heavy defence pressure from behind
  });
  assert.ok(pDefended < pPrime, `Heavy defence risk must reduce overtake probability (${pDefended}% vs ${pPrime}%)`);
});

// ============================================================================
// UPCOMING LAP TACTICAL DIRECTIVE & 4-WAY CANDIDATE EVALUATION (SAVE / USE / HARVEST)
// ============================================================================
testCase("Upcoming Lap Advisory: Validates structure and responsive directive switching across slider iterations", () => {
  // 1. Prime attack condition -> Directive = USE, Best Pick = SUPER-CLIP
  const simUse = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 2,
    soc: 70,
    carAheadGap: 0.6,
    carBehindGap: 2.0,
    compound: "MEDIUM",
    tyreAge: 8,
    constraintLevel: 25
  });

  const advUse = simUse.upcomingLapAdvisory;
  assert.ok(advUse, "upcomingLapAdvisory must exist on sim");
  assert.strictEqual(advUse.upcomingLapNumber, 25, "Upcoming lap should be currentLap + 1");
  assert.strictEqual(advUse.directive, "USE", "Should recommend USE under prime attack conditions");
  assert.strictEqual(advUse.bestPick, "SUPER-CLIP", "Best pick should be SUPER-CLIP");
  assert.strictEqual(advUse.directiveBadgeClass, "directive-use");
  assert.ok(advUse.candidatesEvaluation["SUPER-CLIP"].isBest, "SUPER-CLIP candidate must be marked isBest");
  assert.ok(advUse.constraintChips.length >= 2, "Must supply active constraint chips");
  assert.ok(advUse.directiveRationale.includes("USE"), "Rationale must reference USE");

  // 2. Low SOC condition (<38%) -> Directive = HARVEST, Best Pick = BRAKING / HARVEST
  const simHarvest = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 30, // Low SOC < 38%
    carAheadGap: 0.6,
    carBehindGap: 2.0,
    compound: "MEDIUM",
    tyreAge: 8,
    constraintLevel: 25
  });

  const advHarvest = simHarvest.upcomingLapAdvisory;
  assert.strictEqual(advHarvest.directive, "HARVEST", "Should recommend HARVEST under low SOC");
  assert.strictEqual(advHarvest.bestPick, "BRAKING / HARVEST", "Best pick should be BRAKING / HARVEST");
  assert.strictEqual(advHarvest.directiveBadgeClass, "directive-harvest");
  assert.ok(advHarvest.candidatesEvaluation["BRAKING / HARVEST"].isBest, "BRAKING / HARVEST candidate must be marked isBest");
  assert.ok(advHarvest.constraintChips.some(c => c.id === "C3"), "Must include C3 SOC constraint chip");
  assert.ok(advHarvest.candidatesEvaluation["SUPER-CLIP"].verdict.includes("BLOCKED"), "SUPER-CLIP must be blocked below 40% SOC");

  // 3. Close car behind gap (<0.5s) -> Directive = SAVE, Best Pick = COAST (Defensive pressure)
  const simDefend = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 60,
    carAheadGap: 0.8,
    carBehindGap: 0.3, // Defensive pressure active
    compound: "MEDIUM",
    tyreAge: 8,
    constraintLevel: 25
  });

  const advDefend = simDefend.upcomingLapAdvisory;
  assert.strictEqual(advDefend.directive, "SAVE", "Should recommend SAVE when under defensive threat");
  assert.strictEqual(advDefend.bestPick, "COAST", "Best pick should be COAST under defensive threat");
  assert.strictEqual(advDefend.directiveBadgeClass, "directive-save");
  assert.ok(advDefend.candidatesEvaluation["COAST"].isBest, "COAST candidate must be marked isBest");
  assert.ok(advDefend.constraintChips.some(c => c.id === "C6"), "Must include C6 Rear Threat chip");
  assert.ok(advDefend.constraintChips.some(c => c.id === "C9"), "Must include C9 Defence Reserve chip");

  // 4. Large gap ahead (>1.8s) -> Directive = SAVE, Best Pick = COAST (Outside attack window)
  const simGapAhead = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 60,
    carAheadGap: 2.5, // > 1.8s
    carBehindGap: 2.0,
    compound: "MEDIUM",
    tyreAge: 8,
    constraintLevel: 25
  });

  const advGapAhead = simGapAhead.upcomingLapAdvisory;
  assert.strictEqual(advGapAhead.directive, "SAVE", "Should recommend SAVE when outside attack window");
  assert.strictEqual(advGapAhead.bestPick, "COAST", "Best pick should be COAST when outside attack window");
  assert.ok(advGapAhead.constraintChips.some(c => c.id === "C5"), "Must include C5 Overtake Window chip");

  // 5. High tyre degradation -> Directive = SAVE, Best Pick = COAST
  const simTyreDeg = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 60,
    carAheadGap: 0.8,
    carBehindGap: 2.0,
    compound: "SOFT",
    tyreAge: 32, // Cliff degradation
    constraintLevel: 25
  });

  const advTyreDeg = simTyreDeg.upcomingLapAdvisory;
  assert.strictEqual(advTyreDeg.directive, "SAVE", "Should recommend SAVE when tyre grip is degraded");
  assert.strictEqual(advTyreDeg.bestPick, "COAST", "Best pick should be COAST when tyre grip is degraded");
  assert.ok(advTyreDeg.constraintChips.some(c => c.id === "TYRE"), "Must include TYRE degradation chip");
});

// ============================================================================
// OPTIMIZATION BREAKDOWN, TRADE-OFF ANALYSIS & CURRENT ZONE TELEMETRY
// ============================================================================
testCase("Optimization Breakdown, Trade-off Analysis & Zone Telemetry are fully generated and populated", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 58,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    compound: "MEDIUM",
    tyreAge: 12,
    constraintLevel: 25
  });

  // 1. Optimization Breakdown
  assert.ok(sim.optimizationBreakdown, "optimizationBreakdown must exist on sim");
  assert.ok(typeof sim.optimizationBreakdown.immediateRaceGain === "number", "immediateRaceGain must be number");
  assert.ok(typeof sim.optimizationBreakdown.energyCost === "number", "energyCost must be number");
  assert.ok(typeof sim.optimizationBreakdown.normalizedScore === "number", "normalizedScore must be number");
  assert.ok(sim.optimizationBreakdown.normalizedScore >= 0 && sim.optimizationBreakdown.normalizedScore <= 100);

  // 2. Trade-Off Analysis
  assert.ok(sim.tradeoffComparison, "tradeoffComparison must exist on sim");
  assert.ok(sim.tradeoffComparison.optionA, "optionA must exist");
  assert.ok(sim.tradeoffComparison.optionB, "optionB must exist");
  assert.ok(sim.tradeoffComparison.recommendation, "recommendation must exist");
  assert.ok(sim.tradeoffComparison.rationale, "rationale text must exist");
  assert.ok(sim.tradeoffComparison.optionA.title.includes("SPEND NOW") || sim.tradeoffComparison.optionA.title.includes("OPTION A"));
  assert.ok(sim.tradeoffComparison.optionB.title.includes("SAVE") || sim.tradeoffComparison.optionB.title.includes("OPTION B"));

  // 3. Current Zone Telemetry & Performance Metrics
  assert.ok(sim.activeZoneInfo, "activeZoneInfo must exist on sim");
  assert.strictEqual(sim.activeZoneInfo.zoneNumber, 5, "Active attack zone should be Zone 5");
  assert.ok(sim.activeZoneInfo.zoneName.includes("Straight") || sim.activeZoneInfo.zoneName.includes("DRS"), "Zone name should identify Straight or DRS");
  assert.strictEqual(sim.activeZoneInfo.sector, 2, "Main DRS Straight is in Sector 2");
  assert.ok(sim.activeZoneInfo.performancePotential >= 80, "Zone 5 performance potential should be >= 80");
  assert.ok(sim.activeZoneInfo.overtakePotential >= 80, "Zone 5 overtake potential should be >= 80");
  assert.ok(typeof sim.activeZoneInfo.recoveryPotential === "number");
  assert.ok(typeof sim.activeZoneInfo.defenceValue === "number");
  assert.ok(typeof sim.activeZoneInfo.energyEfficiency === "number");
  assert.strictEqual(sim.activeZoneInfo.closingSpeed, "HIGH", "Closing speed at 0.7s gap should be HIGH");
});

console.log("\n====================================================================");
console.log(`🎉 ALL ${passed} CONNECTED DECISION ENGINE & SECTION 21 TESTS PASSED!`);
console.log("====================================================================\n");
