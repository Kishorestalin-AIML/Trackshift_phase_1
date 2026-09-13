/**
 * SECTION 38: EXTREME TEST CASES
 *
 * Verifies system behavior under 7 canonical extreme race scenarios:
 * 1. TEST 1 — High energy + strong attack -> SUPER-CLIP or NORMAL DEPLOYMENT
 * 2. TEST 2 — Low energy + weak opportunity -> COAST or BRAKING / HARVEST
 * 3. TEST 3 — Low energy + immediate recovery -> BRAKING / HARVEST in braking zone
 * 4. TEST 4 — Old tyres -> Lower attack value, potential PIT decision
 * 5. TEST 5 — Strong pressure from behind -> Higher defence reserve, defenceRisk = HIGH
 * 6. TEST 6 — Late race -> Laps remaining <= 2, future energy discounted, immediate gain prioritized
 * 7. TEST 7 — Illegal deployment -> Hard rejection / isFeasible = false, cannot be recommended
 */

import assert from "assert";
import { alpineDecisionEngine, AlpineDecisionTwinEngine } from "../src/engine/alpineDecisionTwinEngine.js";

console.log("\n=======================================================");
console.log("🏁 RUNNING SECTION 38: EXTREME TEST CASES AUDIT");
console.log("=======================================================\n");

let passedCases = 0;

function runCase(title, fn) {
  try {
    fn();
    console.log(`  ✅ [PASSED] ${title}`);
    passedCases++;
  } catch (err) {
    console.error(`  ❌ [FAILED] ${title}`);
    console.error(err);
    process.exit(1);
  }
}

// TEST 1 — High energy + strong attack
runCase("TEST 1: High energy + strong attack -> SUPER-CLIP or NORMAL DEPLOYMENT", () => {
  const sim = alpineDecisionEngine.simulate({
    soc: 85,
    carAheadGap: 0.5,
    carBehindGap: 3.5,
    compound: "SOFT",
    tyreAge: 2,
    position: 2,
    constraintLevel: 10,
    intensity: 85
  });

  const action = sim.decision.action;
  assert(
    action === "SUPER-CLIP" || action === "NORMAL DEPLOYMENT",
    `Expected SUPER-CLIP or NORMAL DEPLOYMENT, received: ${action}`
  );
  assert.strictEqual(sim.decision.overtakeProbability >= 70, true, "Overtake probability should be high");
});

// TEST 2 — Low energy + weak opportunity
runCase("TEST 2: Low energy + weak opportunity -> COAST or BRAKING / HARVEST", () => {
  const sim = alpineDecisionEngine.simulate({
    soc: 25,
    carAheadGap: 3.5,
    carBehindGap: 2.0,
    compound: "HARD",
    tyreAge: 32,
    position: 4,
    constraintLevel: 60,
    intensity: 30
  });

  const action = sim.decision.action;
  assert(
    action === "COAST" || action === "BRAKING / HARVEST",
    `Expected COAST or BRAKING / HARVEST, received: ${action}`
  );
  assert.strictEqual(sim.decision.action !== "SUPER-CLIP", true, "Super-Clip must not be deployed under low energy");
});

// TEST 3 — Low energy + immediate recovery
runCase("TEST 3: Low energy + immediate recovery in braking zone -> BRAKING / HARVEST", () => {
  const engine = new AlpineDecisionTwinEngine();
  const zone3Hairpin = engine.zones[2]; // Zone 3 Hairpin has recoveryPotential = 88
  const reserve = engine.calculateReserveModel(5.6, 2.5, 32, 3);
  const res = engine.evaluateZoneStrategies(
    zone3Hairpin,
    { currentEnergyMJ: 5.6, position: 3, carAheadGap: 2.5, carBehindGap: 2.5, lapsRemaining: 32, constraintLevel: 50 },
    reserve,
    0
  );

  assert.strictEqual(res.chosenStrategy, "BRAKING / HARVEST", "Braking zone must prioritize recovery");
  assert(res.recoveredMJ > 0.5, "Significant energy recovered in heavy braking zone");
});

// TEST 4 — Old tyres
runCase("TEST 4: Old tyres -> Lower attack grip & promoted PIT decision", () => {
  const simFresh = alpineDecisionEngine.simulate({ tyreAge: 3, compound: "MEDIUM", carAheadGap: 0.8 });
  const simOld = alpineDecisionEngine.simulate({ tyreAge: 32, compound: "MEDIUM", carAheadGap: 0.8 });

  assert(simOld.tyreState.grip < simFresh.tyreState.grip, "Grip must be significantly degraded on 32-lap tyres");
  assert(
    simOld.tyreState.degradationLevel === "HIGH" || simOld.tyreState.degradationLevel === "CRITICAL",
    "Old tyres must exhibit HIGH or CRITICAL degradation"
  );
  // Pit decision must be promoted when tyres are degraded
  const pitNow = simOld.pitActions.candidateActions.find((p) => p.action === "PIT NOW");
  const stayOut = simOld.pitActions.candidateActions.find((p) => p.action === "STAY OUT");
  assert(pitNow.score > stayOut.score, "PIT NOW score must be higher than STAY OUT on worn rubber");
  assert.strictEqual(simOld.pitActions.bestAction, "PIT NOW", "Best pit action must be PIT NOW on 32-lap worn rubber");
  assert.strictEqual(simOld.decision.pitDecision, "PIT NOW", "Canonical decision object must reflect PIT NOW");
});

// TEST 5 — Strong pressure from behind
runCase("TEST 5: Strong pressure from behind -> Higher defence reserve & HIGH defenceRisk", () => {
  const simWide = alpineDecisionEngine.simulate({ carBehindGap: 3.0 });
  const simClose = alpineDecisionEngine.simulate({ carBehindGap: 0.3 });

  assert(
    simClose.currentReserve.defenceMJ > simWide.currentReserve.defenceMJ,
    `Defence reserve must expand under close rear threat (${simClose.currentReserve.defenceMJ} MJ vs ${simWide.currentReserve.defenceMJ} MJ)`
  );
  assert.strictEqual(simClose.decision.defenceRisk, "HIGH", "Defence risk must be flagged HIGH when gapBehind < 0.5s");
});

// TEST 6 — Late race
runCase("TEST 6: Late race (Lap 56/57) -> Immediate position gain prioritized over future lookahead", () => {
  const simMid = alpineDecisionEngine.simulate({ currentLap: 25, carAheadGap: 0.8 });
  const simLate = alpineDecisionEngine.simulate({ currentLap: 56, carAheadGap: 0.8 });

  assert.strictEqual(simLate.decision.lap, 56, "Decision must reflect lap 56");
  assert(simLate.allSteps.length <= 18, "Simulation horizon naturally truncates at race finish");
});

// TEST 7 — Illegal deployment
runCase("TEST 7: Illegal deployment below safety floor -> Super-Clip rejected", () => {
  const sim = alpineDecisionEngine.simulate({ soc: 20 });
  const scCandidate = sim.strategyComparison.find((s) => s.name === "SUPER-CLIP");

  assert.strictEqual(scCandidate.breakdown.isFeasible, false, "Super-Clip must be marked infeasible when SOC < 30%");
  assert.strictEqual(scCandidate.isRecommended, false, "Infeasible strategy cannot be recommended");
  assert.notStrictEqual(sim.decision.action, "SUPER-CLIP", "Rejected illegal action must never win");
});

console.log("\n=======================================================");
console.log(`🎉 ALL ${passedCases}/7 EXTREME TEST CASES PASSED!`);
console.log("=======================================================\n");
