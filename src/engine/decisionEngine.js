/**
 * RACE TWIN — Decision Twin Engine (Sections 18, 19, 20, 21, 24, 35)
 *
 * Evaluates:
 *   Race Value = Position Gain + Overtake Probability + Future Opportunity - Energy Cost - Tyre Cost - Risk
 * Filters by 2026 Hard Constraints
 * Produces explainable "WHY?" narrative
 */

import { RulesEngine } from "./rulesEngine.js";

export class DecisionEngine {
  /**
   * Evaluate the 3 actions: ATTACK, CONTROLLED, SAVE
   */
  static evaluate(state) {
    const isSafetyCar = state.safetyCar || state.raceControl === "SAFETY_CAR";
    const isVSC = state.vsc || state.raceControl === "VSC";
    const isYellowInSector =
      state.yellowSector === state.currentSector ||
      state.raceControl === "YELLOW" ||
      (state.raceControl === "YELLOW_S2" && state.currentSector === 2);

    // Baseline inputs from state
    const gap = state.gapAhead ?? 0.62;
    const energy = state.energyAvailable ?? 63;
    const tyre = state.tyreCondition ?? 82;
    const overtakeProb = state.overtakeProbability ?? 0.78;
    const risk = state.attackRisk ?? 0.22;
    const futureOpp = state.futureOpportunity ?? 0.81;

    // -------------------------------------------------------------
    // 1. CALCULATE RAW RACE VALUES (Normalized 0..100)
    // -------------------------------------------------------------
    // ATTACK: High reward, high energy cost (11%), higher risk, lower future preservation
    let attackValue =
      (overtakeProb * 48) +
      (gap < 0.8 ? 22 : 12) +
      (energy > 60 ? 16 : 8) +
      ((futureOpp * 0.4) * 15) -
      (risk * 20) -
      ((100 - tyre) * 0.15);

    // CONTROLLED: Balanced reward, moderate energy cost (7%), preserves future opportunity (81%)
    let controlledValue =
      (overtakeProb * 40) +
      (gap < 1.0 ? 18 : 10) +
      (energy > 40 ? 20 : 10) +
      (futureOpp * 24) -
      (risk * 12) -
      ((100 - tyre) * 0.08);

    // SAVE: Preserves energy (+4%), high future opportunity, low risk, 0 position gain now
    let saveValue =
      (futureOpp * 38) +
      ((100 - energy) * 0.30) +
      (tyre * 0.15) -
      (risk * 5);

    // -------------------------------------------------------------
    // 2. APPLY HARD CONSTRAINTS & INCIDENTS (Section 21, 22, 23, 24)
    // -------------------------------------------------------------
    let attackConstraint = RulesEngine.validateAction("ATTACK", state);
    let controlledConstraint = RulesEngine.validateAction("CONTROLLED", state);

    if (isSafetyCar) {
      // Under Safety Car, overtaking is prohibited. SAVE is mandatory.
      attackValue = 10;
      controlledValue = 25;
      saveValue = 95;
    } else if (isYellowInSector) {
      // Yellow Flag in sector: Attack and Controlled strictly penalized.
      attackValue = 8;
      controlledValue = 22;
      saveValue = 92;
    } else if (isVSC) {
      attackValue = 18;
      controlledValue = 45;
      saveValue = 88;
    } else {
      // Green flag conditions
      if (!attackConstraint.allowed) attackValue = 15;
      if (!controlledConstraint.allowed) controlledValue = 30;
    }

    // Clamp and round to integer scores
    const attackScore = Math.min(98, Math.max(8, Math.round(attackValue)));
    const controlledScore = Math.min(98, Math.max(12, Math.round(controlledValue)));
    const saveScore = Math.min(98, Math.max(10, Math.round(saveValue)));

    // -------------------------------------------------------------
    // 3. SELECT BEST LEGAL ACTION
    // -------------------------------------------------------------
    let recommended = "CONTROLLED";
    let confidence = controlledScore;

    if (saveScore > controlledScore && saveScore > attackScore) {
      recommended = "SAVE";
      confidence = saveScore;
    } else if (attackScore > controlledScore && attackScore > saveScore && attackConstraint.allowed) {
      recommended = "ATTACK";
      confidence = attackScore;
    } else {
      recommended = "CONTROLLED";
      confidence = controlledScore;
    }

    // -------------------------------------------------------------
    // 4. DYNAMIC EXPLANATION GENERATOR (Section 19)
    // -------------------------------------------------------------
    const explanationLines = [];
    explanationLines.push(`Gap: ${gap.toFixed(2)} s`);
    explanationLines.push(`Energy: ${energy >= 50 ? "sufficient" : "conserving"} (${energy}%)`);
    explanationLines.push(`Attack zone: ${state.currentSegmentName || "Hangar Straight"} (${overtakeProb >= 0.7 ? "high value" : "moderate"})`);
    explanationLines.push(`Tyres: ${tyre >= 70 ? "acceptable" : "degraded"} (${state.tyreCompound || "MEDIUM"})`);
    explanationLines.push(`Risk: ${risk < 0.3 ? "moderate" : "high"} (${Math.round(risk * 100)}%)`);
    explanationLines.push(`Future opportunity: ${futureOpp >= 0.75 ? "high" : "standard"} (+2 Laps)`);
    explanationLines.push("");

    if (isSafetyCar) {
      explanationLines.push("SAFETY CAR DEPLOYED:");
      explanationLines.push("Overtaking prohibited. Save energy and harvest at low speed.");
    } else if (isYellowInSector) {
      explanationLines.push("YELLOW FLAG IN SECTOR:");
      explanationLines.push("ATTACK WINDOW TEMPORARILY INVALID.");
      explanationLines.push("Switching to SAVE to harvest energy until track is clear.");
    } else if (isVSC) {
      explanationLines.push("VSC DELTA MANDATORY:");
      explanationLines.push("Overtaking suspended. Maintain positive delta and harvest.");
    } else if (recommended === "CONTROLLED") {
      explanationLines.push("CONTROLLED ATTACK has the highest expected race value.");
      explanationLines.push("Balances current closing delta while preserving battery for +2 Lap Hangar opportunity.");
    } else if (recommended === "ATTACK") {
      explanationLines.push("ATTACK NOW — Optimal deployment window detected.");
      explanationLines.push("Maximum ERS-K deployment into braking zone to secure track position.");
    } else {
      explanationLines.push("SAVE ENERGY — Sub-optimal track sector for pass.");
      explanationLines.push("Harvest kinetic energy to prepare for upcoming straight.");
    }

    return {
      attackScore,
      controlledScore,
      saveScore,
      recommended,
      confidence,
      explanation: explanationLines.join("\n"),
      attackAllowed: attackConstraint.allowed,
      controlledAllowed: controlledConstraint.allowed
    };
  }
}
