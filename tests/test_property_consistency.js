import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("======================================================================");
console.log("📐 STARTING SECTION 32: PROPERTY-BASED CONSISTENCY INVARIANT TESTS");
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
// INVARIANT 1: Energy Conservation
// Never allow energy < minimum (0) or energy > maximum (20.0 MJ).
// E_next = E_current - E_deployed + E_recovered
// ==============================================================================
test("INVARIANT 1: Energy Conservation & Strict Physical Bounding (0 to 20 MJ)", () => {
  const testSocs = [5, 15, 30, 50, 62, 85, 95, 100];

  testSocs.forEach((soc) => {
    const sim = alpineDecisionEngine.simulate({
      currentLap: 24,
      futureLaps: 3,
      position: 3,
      soc,
      carAheadGap: 0.7,
      carBehindGap: 1.4,
      intensity: 75,
      constraintLevel: 25,
      compound: "MEDIUM",
      tyreAge: 12,
      trackCondition: "DRY"
    });

    assert.ok(sim.initialEnergyMJ >= 0 && sim.initialEnergyMJ <= 20.0, `Initial energy (${sim.initialEnergyMJ}) must be within [0, 20.0] MJ`);
    assert.ok(sim.energyAfterDeployMJ >= 0 && sim.energyAfterDeployMJ <= 20.0, `Energy after deploy (${sim.energyAfterDeployMJ}) must be within [0, 20.0] MJ`);
    assert.ok(sim.energyAfterRecoveryMJ >= 0 && sim.energyAfterRecoveryMJ <= 20.0, `Energy after recovery (${sim.energyAfterRecoveryMJ}) must be within [0, 20.0] MJ`);

    // Verify all steps in timeline
    sim.allSteps.forEach((step, idx) => {
      assert.ok(step.energyBeforeMJ >= 0 && step.energyBeforeMJ <= 20.0, `Step ${idx} energyBefore (${step.energyBeforeMJ}) out of bounds`);
      assert.ok(step.energyAfterMJ >= 0 && step.energyAfterMJ <= 20.0, `Step ${idx} energyAfter (${step.energyAfterMJ}) out of bounds`);
      
      const expectedDelta = Math.round((step.recoveredMJ - step.deployedMJ) * 100) / 100;
      assert.strictEqual(step.netDeltaMJ, expectedDelta, `Step ${idx} net delta must equal recovered - deployed`);
    });
  });
});

// ==============================================================================
// INVARIANT 2: Position Consistency with Race Order
// If player.position = P, player must be at index P - 1 in raceOrder.
// ==============================================================================
test("INVARIANT 2: Position Consistency with Active Race Order", () => {
  for (let p = 1; p <= 6; p++) {
    const sim = alpineDecisionEngine.simulate({
      currentLap: 24,
      futureLaps: 3,
      position: p,
      soc: 60,
      carAheadGap: p === 1 ? 0.0 : 0.8,
      carBehindGap: 1.2,
      intensity: 70,
      constraintLevel: 25,
      compound: "MEDIUM",
      tyreAge: 10,
      trackCondition: "DRY"
    });

    const raceOrder = sim.centralRaceState.raceOrder;
    assert.ok(Array.isArray(raceOrder), "raceOrder must be an array");
    assert.ok(raceOrder.length >= 6, "raceOrder must have at least 6 cars");
    
    // Player Gasly (GAS) must be at index p - 1
    const playerCar = raceOrder[p - 1];
    assert.ok(
      playerCar.isPlayer || playerCar.id === "GAS" || playerCar === "ALPINE_USER",
      `Car at index ${p - 1} must be player in position P${p}`
    );
    if (typeof playerCar === "object") {
      assert.strictEqual(playerCar.pos, p, `Player object pos must equal ${p}`);
    }
  }
});

// ==============================================================================
// INVARIANT 3: Gap Consistency
// If car ahead of player: gapAhead >= 0. P1 has gapAhead = 0.
// gapBehind >= 0 always.
// ==============================================================================
test("INVARIANT 3: Gap Consistency & Leader Semantics", () => {
  // P1 Leader
  const simP1 = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 1,
    soc: 60,
    carAheadGap: 0.0,
    carBehindGap: 1.5,
    intensity: 70,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 10,
    trackCondition: "DRY"
  });

  assert.strictEqual(simP1.centralRaceState.position, 1);
  assert.strictEqual(simP1.centralRaceState.gapAhead, 0);
  assert.strictEqual(simP1.overtakeProb, 0, "P1 cannot overtake anyone ahead");
  assert.strictEqual(simP1.constraints13.c5_overtake_window.status, "N/A (RACE LEADER)");

  // P3 Chaser
  const simP3 = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 60,
    carAheadGap: 0.7,
    carBehindGap: 1.1,
    intensity: 70,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 10,
    trackCondition: "DRY"
  });

  assert.ok(simP3.centralRaceState.gapAhead > 0, "P3 must have positive gap ahead");
  assert.ok(simP3.centralRaceState.gapBehind > 0, "P3 must have positive gap behind");
});

// ==============================================================================
// INVARIANT 4: SOC & Megajoule Consistency
// Always: SOC = (energyMJ / usableEnergyMJ) * 100
// ==============================================================================
test("INVARIANT 4: SOC & Megajoule Synchronization", () => {
  for (let soc = 0; soc <= 100; soc += 10) {
    const energyMJ = alpineDecisionEngine.socToMJ(soc);
    const expectedSoc = alpineDecisionEngine.mjToSoc(energyMJ);
    assert.strictEqual(expectedSoc, soc, `SOC ${soc} must match converted MJ ${energyMJ}`);
  }

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

  const computedSoc = Math.round((sim.centralRaceState.energyMJ / sim.centralRaceState.usableEnergyMJ) * 100);
  assert.strictEqual(sim.centralRaceState.socPercent, computedSoc);
});

// ==============================================================================
// INVARIANT 5: Decision Feasibility Consistency
// If an action is selected as nextBestAction, it MUST be feasible.
// An infeasible candidate can NEVER win optimization.
// ==============================================================================
test("INVARIANT 5: Selected Action Must Be Feasible (Never an Infeasible Winner)", () => {
  const stressStates = [
    { soc: 10, gapAhead: 0.4, gapBehind: 0.3 }, // Critical energy + high pressure
    { soc: 18, gapAhead: 2.5, gapBehind: 2.0 }, // Low energy + large gap
    { soc: 50, gapAhead: 0.6, gapBehind: 1.2 }, // Standard mid-field
    { soc: 90, gapAhead: 0.5, gapBehind: 2.5 }  // High attack
  ];

  stressStates.forEach((st) => {
    const sim = alpineDecisionEngine.simulate({
      currentLap: 24,
      futureLaps: 3,
      position: 2,
      soc: st.soc,
      carAheadGap: st.gapAhead,
      carBehindGap: st.gapBehind,
      intensity: 75,
      constraintLevel: 30,
      compound: "MEDIUM",
      tyreAge: 15,
      trackCondition: "DRY"
    });

    const chosen = sim.nextBestAction;
    assert.ok(chosen, "Must select an action");
    assert.strictEqual(chosen.isFeasible, true, `Chosen action ${chosen.strategy} must have isFeasible: true`);

    const matchingInComparison = sim.strategyComparison.find((s) => s.name === chosen.strategy);
    if (matchingInComparison) {
      assert.strictEqual(
        matchingInComparison.breakdown.isFeasible,
        true,
        `Matching strategy ${chosen.strategy} in comparison must be feasible`
      );
    }
  });
});

// ==============================================================================
// INVARIANT 6: Dashboard & Result State Coherence
// Telemetry readouts across decision trace, audit state, and decision must be identical.
// ==============================================================================
test("INVARIANT 6: Dashboard & Result State Coherence Across Subsystems", () => {
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

  // Decision state energy agrees with central race state
  assert.strictEqual(sim.decision.energyInitial, sim.centralRaceState.energyMJ);
  assert.strictEqual(sim.decision.socInitial, sim.centralRaceState.socPercent);
  assert.strictEqual(sim.auditState.energyState.energyMJ, sim.centralRaceState.energyMJ);
  assert.strictEqual(sim.auditState.energyState.socPercent, sim.centralRaceState.socPercent);

  // Reserve values agree
  assert.strictEqual(sim.auditState.reserveState.reserveMJ, sim.currentReserve.reserveMJ);
  assert.strictEqual(sim.auditState.freeEnergyState.freeEnergyMJ, sim.currentReserve.freeEnergyMJ);

  // Decision trace has exactly 12 items as specified by Section 44
  assert.ok(Array.isArray(sim.decisionTrace), "decisionTrace must be an array");
  assert.strictEqual(sim.decisionTrace.length, 12, "decisionTrace must contain exactly 12 points");

  // Tyre parameters agree
  assert.strictEqual(sim.auditState.tyreState.grip, sim.tyreState.grip);
  assert.strictEqual(sim.auditState.tyreState.compoundId, sim.tyreState.compoundId);
  assert.strictEqual(sim.auditState.tyreState.age, sim.tyreState.age);
});

console.log("======================================================================");
console.log("🎉 ALL 6 SECTION 32 PROPERTY-BASED CONSISTENCY INVARIANTS PASSED!");
console.log("======================================================================");
