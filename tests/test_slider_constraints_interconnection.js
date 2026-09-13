import assert from "node:assert";
import { alpineDecisionEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("======================================================================");
console.log("🏎️  STARTING MULTI-SLIDER & CONSTRAINT INTERCONNECTION TESTS");
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

// TEST 1: Baseline Reference State Check
test("1. Baseline reference state (62% SOC, P3, 0.7s ahead, 1.4s behind, 25% constraint)", () => {
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
    trackCondition: "DRY",
    isVscOrSc: false
  });

  assert.strictEqual(sim.nextBestAction.strategy, "SUPER-CLIP");
  assert.strictEqual(sim.constraints13.c1_finite_energy.status, "PASSED");
  assert.strictEqual(sim.constraints13.c2_deployment_power.status, "COMPLIANT");
  assert.strictEqual(sim.constraints13.c3_soc_operating.status, "COMPLIANT");
  assert.strictEqual(sim.constraints13.c5_overtake_window.status, "WINDOW_OPTIMAL");
  assert.strictEqual(sim.constraints13.c6_defence_constraint.status, "SECURE");
  assert.strictEqual(sim.constraints13.c12_opponent_counterattack.status, "LOW_COUNTER_RISK");

  // Summary counts
  assert.ok(sim.constraintSummary, "constraintSummary must exist");
  assert.strictEqual(typeof sim.constraintSummary.limitingCount, "number");
  assert.strictEqual(typeof sim.constraintSummary.compliantCount, "number");
  assert.strictEqual(sim.constraintSummary.limitingCount + sim.constraintSummary.compliantCount, 13);
});

// TEST 2: Battery SOC Slider Interconnection
test("2. Battery SOC Slider drops to 20%: C1, C3, C9 restrict Super-Clip to COAST/SAVE", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 20, // Critical SOC (4.0 MJ available, 4.1 MJ reserve needed)
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 12
  });

  // Action switches away from SUPER-CLIP to preserve safety floor
  assert.notStrictEqual(sim.nextBestAction.strategy, "SUPER-CLIP");
  assert.ok(sim.nextBestAction.strategy === "COAST" || sim.nextBestAction.strategy === "BRAKING / HARVEST");

  // C1 and C3 flag the restriction
  assert.strictEqual(sim.constraints13.c1_finite_energy.status, "RESTRICTED");
  assert.strictEqual(sim.constraints13.c3_soc_operating.status, "VIOLATION_PREVENTED");
  assert.strictEqual(sim.constraints13.c9_future_energy_reserve.status, "CRITICAL_RESERVE");
  assert.strictEqual(sim.constraints13.c3_soc_operating.isLimiting, true);

  // Driver slider label reflects exact SOC
  assert.ok(sim.constraints13.c3_soc_operating.driverSlider.includes("20%"));

  // Adaptation flow reflects low SOC
  assert.ok(sim.adaptationFlow.constraint.includes("SOC Operating Floor"));
});

// TEST 3: Car Behind Gap Slider Interconnection (< 0.5s Rear Threat)
test("3. Car Behind Gap Slider drops to 0.4s: C6 expands defence reserve and raises C12 risk", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 0.4, // Opponent right on rear bumper
    intensity: 75,
    constraintLevel: 25,
    compound: "MEDIUM",
    tyreAge: 12
  });

  assert.strictEqual(sim.currentReserve.hasDefensivePressure, true);
  assert.ok(sim.currentReserve.defenceMJ >= 1.0, "Defence reserve must expand under 0.4s gap");
  assert.strictEqual(sim.constraints13.c6_defence_constraint.status, "HIGH_PRESSURE");
  assert.strictEqual(sim.constraints13.c12_opponent_counterattack.status, "HIGH_COUNTER_RISK");
  assert.ok(sim.constraints13.c6_defence_constraint.driverSlider.includes("0.4s"));

  // Breakdown records non-zero defence risk & counterattack risk
  const breakdown = sim.optimizationBreakdown;
  assert.ok(breakdown.defenceRisk >= 2);
  assert.ok(breakdown.counterattackRisk >= 4);
});

// TEST 4: Tyre Age Slider Interconnection (Degradation Cliff)
test("4. Tyre Age Slider increases to 30 laps: C13 triggers TYRE_GRIP_LIMITED, derating effective gain", () => {
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
    tyreAge: 30 // Heavy wear
  });

  assert.ok(sim.tyreState.grip < 60, "Tyre grip should be low at 30 laps on Medium");
  assert.strictEqual(sim.constraints13.c13_zone_performance.status, "TYRE_GRIP_LIMITED");
  assert.strictEqual(sim.constraints13.c13_zone_performance.isLimiting, true);
  assert.ok(sim.effectiveGainSec < sim.expectedGainSec, "Effective gain must be derated by tyre degradation");

  // Adaptation flow reflects tyre degradation
  assert.ok(sim.adaptationFlow.constraint.includes("Tyre Degradation Cliff"));
});

// TEST 5: Constraint Level Slider Interconnection (Regulatory Derating)
test("5. Constraint Level Slider increases to 80%: C2 derates power to legal ceiling", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 80 // High derating
  });

  assert.strictEqual(sim.constraints13.c2_deployment_power.status, "DERATED");
  assert.strictEqual(sim.constraints13.c2_deployment_power.isLimiting, true);
  assert.ok(sim.constraints13.c2_deployment_power.driverSlider.includes("80%"));
});

// TEST 6: Safety Car / VSC Interconnection
test("6. Safety Car / VSC Toggle Active: C2, C4, C5 reflect Article 55 neutralization", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 3,
    soc: 62,
    carAheadGap: 0.7,
    carBehindGap: 1.4,
    intensity: 75,
    constraintLevel: 25,
    isVscOrSc: true
  });

  assert.strictEqual(sim.constraints13.c2_deployment_power.status, "RESTRICTED_UNDER_VSC");
  assert.strictEqual(sim.constraints13.c4_harvesting.status, "SC_HARVEST_MAXIMIZED");
  assert.strictEqual(sim.constraints13.c5_overtake_window.status, "BANNED_UNDER_SC");
  assert.ok(sim.pitLoss.isVscOrSc, "Pit loss model must identify VSC/SC");
  assert.ok(sim.pitLoss.timeSavedVsNormalSec > 0, "VSC pit savings must be positive");
  assert.ok(sim.adaptationFlow.constraint.includes("Safety Car"));
});

// TEST 7: Race Leader P1 Position Interconnection
test("7. P1 Race Leader Position: C5 is N/A, C11 is LEADER_DEFEND, Trade-off switches to Pace Control", () => {
  const sim = alpineDecisionEngine.simulate({
    currentLap: 24,
    futureLaps: 3,
    position: 1, // P1 Leader
    soc: 62,
    carAheadGap: 0.0,
    carBehindGap: 1.2,
    intensity: 75,
    constraintLevel: 25
  });

  assert.strictEqual(sim.constraints13.c5_overtake_window.status, "N/A (RACE LEADER)");
  assert.strictEqual(sim.constraints13.c11_position_constraint.status, "LEADER_DEFEND");
  assert.ok(sim.tradeoffComparison.optionA.title.includes("PACE CONTROL"));
  assert.ok(sim.tradeoffComparison.optionB.title.includes("RECHARGE & CONSERVE GAP"));
});

// TEST 8: All 13 Constraints have active driverSlider descriptions
test("8. All 13 Constraints have valid types, driver sliders, and status classes", () => {
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

  const cList = Object.values(sim.constraints13);
  assert.strictEqual(cList.length, 13, "Must have exactly 13 constraints");

  cList.forEach((c) => {
    assert.ok(c.id, "Constraint must have id");
    assert.ok(c.name, "Constraint must have name");
    assert.ok(["FIA RULE", "MODEL ESTIMATE", "SIMULATION ASSUMPTION"].includes(c.type), `Valid type for ${c.id}`);
    assert.ok(c.status, `Status for ${c.id}`);
    assert.ok(["ok", "clamped", "restricted", "active"].includes(c.statusClass), `Valid statusClass for ${c.id}: ${c.statusClass}`);
    assert.ok(c.driverSlider, `driverSlider string must exist for ${c.id}`);
    assert.ok(c.description, `Description must exist for ${c.id}`);
  });
});

console.log("======================================================================");
console.log("🎉 ALL 8 MULTI-SLIDER & CONSTRAINT INTERCONNECTION TESTS PASSED!");
console.log("======================================================================");
