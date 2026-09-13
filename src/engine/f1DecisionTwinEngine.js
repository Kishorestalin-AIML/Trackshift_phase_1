/**
 * TRACKSHIFT — F1 2026 Decision Twin Engine & Opportunity Cost Estimator
 *
 * Compares the 5 fundamental strategic choices:
 * 1. ATTACK NOW
 * 2. WAIT / DELAY
 * 3. SAVE ENERGY
 * 4. RECOVER
 * 5. DEFEND
 *
 * Evaluates:
 * Score = Immediate Gain - Energy Cost - Future Opportunity Cost - Risk Penalty - Rule Penalty
 *
 * Synthesizes dynamic Energy Opportunity Cost:
 * "Using X.X MJ now increases immediate overtake probability by Y%,
 *  but reduces the probability of successfully defending the next attack window by Z%."
 */

import { fiaRuleEngine } from "./fia2026RuleEngine.js";

export class F1DecisionTwinEngine {
  /**
   * Evaluates all 5 strategies against current race state and constraint severity
   *
   * @param {Object} state - Current twinState object
   * @returns {Object} { recommendation, strategies: Array, opportunityCost, constraintImpacts }
   */
  static evaluateAll(state) {
    const soc = Math.max(0, Math.min(100, state.soc ?? 62));
    const cap = state.batteryCapacity ?? 4.00;
    const currentMJ = (soc / 100) * cap;
    const gap = Math.max(0.1, state.gap ?? 0.80);
    const closingSpeed = state.closingSpeed ?? 8.0;
    const powerKw = state.deploymentPower ?? 280;
    const recoveryPotential = state.recoveryPotential ?? 72;
    const constraintLevel = state.constraintLevel ?? 2; // 1..5

    // Multipliers derived from constraint level (1: LOW .. 5: EXTREME)
    const constraintPenalty = [0.0, 0.05, 0.15, 0.35, 0.65, 1.10][constraintLevel] || 0.20;
    const tacticalPressure = constraintLevel >= 4;

    // Evaluate Strategy 1: ATTACK NOW
    const attackRule = fiaRuleEngine.validateAction(state, "ATTACK", powerKw, true);
    const attackDeployTimeSec = 2.4;
    const attackEnergyCostMJ = Math.min(currentMJ, Math.round(((powerKw * attackDeployTimeSec) / 1000) * 100) / 100);
    const attackRemainingMJ = Math.max(0, Math.round((currentMJ - attackEnergyCostMJ) * 100) / 100);

    // Overtake probability model
    const baseOvertake = Math.max(10, Math.min(95, Math.round(
      (0.55 - gap * 0.35 + (closingSpeed * 0.015) + (powerKw / 350) * 0.25 + (soc / 100) * 0.15 - constraintPenalty * 0.15) * 100
    )));
    const attackOvertakeProb = attackRule.status === "VIOLATION" ? 0 : baseOvertake;
    const attackFutureProb = Math.max(5, Math.min(85, Math.round((attackRemainingMJ / cap) * 85 - constraintPenalty * 15)));
    const attackRisk = soc < 35 || attackRemainingMJ < 0.80 ? "CRITICAL" :
                       constraintLevel >= 4 ? "HIGH" :
                       (soc >= 65 && attackRemainingMJ >= 1.5 && constraintLevel <= 2) ? "LOW" : "MODERATE";

    // Expected position for attack
    const attackPosition = attackOvertakeProb >= 70 ? "P1" : attackOvertakeProb >= 45 ? "P1/P2" : "P2";

    // Evaluate Strategy 2: WAIT / DELAY
    const waitPowerKw = 140;
    const waitDeployTimeSec = 1.8;
    const waitEnergyCostMJ = Math.round(((waitPowerKw * waitDeployTimeSec) / 1000) * 100) / 100;
    const waitRecoverMJ = Math.round(((recoveryPotential / 100) * 0.35) * 100) / 100;
    const waitRemainingMJ = Math.max(0, Math.round((currentMJ - waitEnergyCostMJ + waitRecoverMJ) * 100) / 100);
    const waitOvertakeProb = Math.max(15, Math.min(80, Math.round(baseOvertake * 0.76)));
    const waitFutureProb = Math.max(20, Math.min(95, Math.round(84 + (waitRemainingMJ / cap) * 12 - (constraintLevel - 2) * 5)));
    const waitRisk = closingSpeed < -2 ? "CRITICAL" : constraintLevel >= 5 ? "MODERATE" : "LOW";
    const waitRule = fiaRuleEngine.validateAction(state, "WAIT", waitPowerKw, true);
    const waitPosition = waitFutureProb >= 80 ? "P1/P2" : "P2";

    // Evaluate Strategy 3: SAVE ENERGY
    const savePowerKw = 0;
    const saveEnergyCostMJ = 0.05;
    const saveRecoverMJ = Math.round(((recoveryPotential / 100) * 0.55) * 100) / 100;
    const saveRemainingMJ = Math.min(cap, Math.round((currentMJ - saveEnergyCostMJ + saveRecoverMJ) * 100) / 100);
    const saveOvertakeProb = Math.max(5, Math.min(60, Math.round(baseOvertake * 0.52)));
    const saveFutureProb = Math.max(30, Math.min(96, Math.round(91 + (saveRemainingMJ / cap) * 8 - (constraintLevel - 1) * 3)));
    const saveRisk = closingSpeed < -2 ? "CRITICAL" : "LOW";
    const saveRule = fiaRuleEngine.validateAction(state, "SAVE", savePowerKw, false);
    const savePosition = "P2";

    // Evaluate Strategy 4: RECOVER
    const recoverPowerKw = 0;
    const recoverEnergyCostMJ = 0.0;
    const recoverHarvestMJ = Math.round(((recoveryPotential / 100) * 0.90) * 100) / 100;
    const recoverRemainingMJ = Math.min(cap, Math.round((currentMJ + recoverHarvestMJ) * 100) / 100);
    const recoverOvertakeProb = Math.max(5, Math.min(45, Math.round(baseOvertake * 0.35)));
    const recoverFutureProb = Math.max(40, Math.min(95, Math.round(88 + (recoverRemainingMJ / cap) * 10)));
    const recoverRisk = "LOW";
    const recoverRule = fiaRuleEngine.validateAction(state, "RECOVER", recoverPowerKw, false);
    const recoverPosition = "P2";

    // Evaluate Strategy 5: DEFEND
    const defendPowerKw = 220;
    const defendTimeSec = 2.0;
    const defendEnergyCostMJ = Math.round(((defendPowerKw * defendTimeSec) / 1000) * 100) / 100;
    const defendRemainingMJ = Math.max(0, Math.round((currentMJ - defendEnergyCostMJ) * 100) / 100);
    const defendOvertakeProb = Math.max(5, Math.min(50, Math.round(baseOvertake * 0.40)));
    const defendFutureProb = Math.max(15, Math.min(80, Math.round(68 + (defendRemainingMJ / cap) * 10)));
    const defendRisk = "LOW"; // Defensive boost neutralizes rear threat
    const defendRule = fiaRuleEngine.validateAction(state, "DEFEND", defendPowerKw, true);
    const defendPosition = "P2";

    // Compute Multi-Factor Scores (Section 14 & 18)
    // Score = PositionBenefit + ImmediateGain - EnergyCost - FutureOpportunityCost - RiskPenalty - RulePenalty
    const calcScore = (overtake, future, costMJ, risk, rule, posBenefit = 0) => {
      if (rule.status === "VIOLATION") return -999;
      const posVal = posBenefit;
      const gain = overtake * 0.45;
      const futureVal = future * 0.35;
      const costPenalty = (costMJ / cap) * 22;
      const riskPen = risk === "CRITICAL" ? 35 : risk === "HIGH" ? 20 : risk === "MODERATE" ? 10 : 0;
      const rulePen = rule.status === "WARNING" ? 12 : 0;
      const constrPen = constraintPenalty * 20;
      return Math.round((posVal + gain + futureVal - costPenalty - riskPen - rulePen - constrPen) * 10) / 10;
    };

    const attackPosBenefit = attackPosition === "P1" ? 28 : attackPosition === "P1/P2" ? 14 : 0;

    // Construct Strategy Objects
    const strategies = [
      {
        id: "ATTACK",
        title: "ATTACK NOW",
        desc: "Deploy maximum permissible electrical thrust to execute immediate pass.",
        expectedPosition: attackPosition,
        overtakeProb: attackOvertakeProb,
        energyCostMJ: attackEnergyCostMJ,
        energyRemainingMJ: attackRemainingMJ,
        futureAttackProb: attackFutureProb,
        risk: attackRisk,
        ruleStatus: attackRule.status,
        score: calcScore(attackOvertakeProb, attackFutureProb, attackEnergyCostMJ, attackRisk, attackRule, attackPosBenefit),
        recommendedPowerKw: attackRule.recommendedLegalPower,
        ruleNote: attackRule.reason
      },
      {
        id: "WAIT",
        title: "WAIT / DELAY",
        desc: "Hold slipstream gap and preserve energy for predicted high-probability window.",
        expectedPosition: waitPosition,
        overtakeProb: waitOvertakeProb,
        energyCostMJ: waitEnergyCostMJ,
        energyRemainingMJ: waitRemainingMJ,
        futureAttackProb: waitFutureProb,
        risk: waitRisk,
        ruleStatus: waitRule.status,
        score: calcScore(waitOvertakeProb, waitFutureProb, waitEnergyCostMJ, waitRisk, waitRule),
        recommendedPowerKw: waitPowerKw,
        ruleNote: waitRule.reason
      },
      {
        id: "SAVE",
        title: "SAVE ENERGY",
        desc: "Minimize power discharge, utilize lift-and-coast to build future buffer.",
        expectedPosition: savePosition,
        overtakeProb: saveOvertakeProb,
        energyCostMJ: saveEnergyCostMJ,
        energyRemainingMJ: saveRemainingMJ,
        futureAttackProb: saveFutureProb,
        risk: saveRisk,
        ruleStatus: saveRule.status,
        score: calcScore(saveOvertakeProb, saveFutureProb, saveEnergyCostMJ, saveRisk, saveRule) + (soc < 35 ? 15 : 0),
        recommendedPowerKw: savePowerKw,
        ruleNote: saveRule.reason
      },
      {
        id: "RECOVER",
        title: "RECOVER",
        desc: "Maximize MGU-K regenerative braking; harvest energy for upcoming straight.",
        expectedPosition: recoverPosition,
        overtakeProb: recoverOvertakeProb,
        energyCostMJ: 0.0,
        energyRemainingMJ: recoverRemainingMJ,
        futureAttackProb: recoverFutureProb,
        risk: recoverRisk,
        ruleStatus: recoverRule.status,
        score: calcScore(recoverOvertakeProb, recoverFutureProb, 0, recoverRisk, recoverRule) + (recoveryPotential >= 88 ? 16 : 0),
        recommendedPowerKw: recoverPowerKw,
        ruleNote: recoverRule.reason
      },
      {
        id: "DEFEND",
        title: "DEFEND",
        desc: "Deploy selective rear-guard electrical boost to repel rival closing from behind.",
        expectedPosition: defendPosition,
        overtakeProb: defendOvertakeProb,
        energyCostMJ: defendEnergyCostMJ,
        energyRemainingMJ: defendRemainingMJ,
        futureAttackProb: defendFutureProb,
        risk: defendRisk,
        ruleStatus: defendRule.status,
        score: calcScore(defendOvertakeProb, defendFutureProb, defendEnergyCostMJ, defendRisk, defendRule, closingSpeed < 0 ? 35 : 0),
        recommendedPowerKw: defendPowerKw,
        ruleNote: defendRule.reason
      }
    ];

    // Select the best strategy (highest valid score)
    const validStrategies = strategies.filter(s => s.ruleStatus !== "VIOLATION");
    validStrategies.sort((a, b) => b.score - a.score);
    const best = validStrategies[0] || strategies[1]; // fallback to WAIT if all fail

    // Dynamic Energy Opportunity Cost (Section 12)
    const deltaOvertake = Math.abs(attackOvertakeProb - waitOvertakeProb);
    const deltaDefense = Math.abs(waitFutureProb - attackFutureProb);
    const opportunityCostStatement = `Using ${attackEnergyCostMJ.toFixed(1)} MJ now increases immediate overtake probability by ${deltaOvertake}%, but reduces the probability of successfully defending the next attack window by ${deltaDefense}%.`;

    // Dynamic "WHY?" justification
    let rationale = "";
    if (best.id === "ATTACK") {
      rationale = `Optimal conditions: ${attackOvertakeProb}% immediate overtake probability with acceptable counter-attack risk. Energy buffer (${soc}%) permits aggressive discharge.`;
    } else if (best.id === "WAIT") {
      rationale = `Save ${attackEnergyCostMJ.toFixed(1)} MJ for the next high-value attack window. High future probability (${waitFutureProb}%) outweighs immediate marginal gain.`;
    } else if (best.id === "SAVE") {
      rationale = `Low SOC (${soc}%) threatens 15% reserve floor. Preserving energy now restores tactical flexibility for late-race stint.`;
    } else if (best.id === "RECOVER") {
      rationale = `High recovery potential (${recoveryPotential}%). Prioritizing MGU-K recharge will yield +${recoverHarvestMJ.toFixed(2)} MJ before the next DRS straight.`;
    } else if (best.id === "DEFEND") {
      rationale = `Rival closing at ${Math.abs(closingSpeed)} km/h. Immediate rear-guard electrical deployment mandatory to preserve P2 track position.`;
    }

    // Constraint Impact Calculations across 5 levels (Section 14)
    const constraintImpacts = [
      { level: 1, name: "LOW", expectedGain: "+0.42 s", note: "High energy availability, low tactical pressure, large attack margin." },
      { level: 2, name: "MODERATE", expectedGain: "+0.31 s", note: "Standard operational parameters, balanced attack and defense windows." },
      { level: 3, name: "HIGH", expectedGain: "+0.18 s", note: "Moderate SOC, limited deployment opportunity, higher future energy requirement." },
      { level: 4, name: "CRITICAL", expectedGain: "-0.06 s", note: "Energy must be conserved for the next strategic window. Tight margin." },
      { level: 5, name: "EXTREME", expectedGain: "-0.22 s", note: "Low SOC, very limited deployment, high defensive pressure, narrow legal window." }
    ];

    return {
      recommendedAction: best.id,
      recommendedTitle: best.title,
      rationale,
      opportunityCostStatement,
      overtakeProb: best.overtakeProb,
      futureProb: best.futureAttackProb,
      energyRisk: best.risk,
      confidence: Math.min(95, Math.max(72, Math.round(70 + (best.score / 80) * 25))),
      bestStrategy: best,
      strategies,
      constraintImpacts
    };
  }
}
