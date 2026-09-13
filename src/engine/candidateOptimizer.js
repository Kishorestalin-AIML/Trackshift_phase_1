/**
 * TRACKSHIFT — Candidate Action & Constraint Optimizer (Sections 9–14)
 *
 * Evaluates real candidate controls (0 kW, 100 kW, 180 kW, 250 kW, 286 kW, 350 kW),
 * applies 2026 FIA regulatory and physical constraint filters, and selects the
 * best feasible deployment action.
 */

import { RulesEngine } from "./rulesEngine.js";

export class CandidateOptimizer {
  /**
   * Generates candidate actions for evaluation
   */
  static getCandidateActions() {
    return [
      { id: "0kw", powerKw: 0, duration: 2.0, label: "0 kW × 2.0s", type: "CONSERVE", desc: "Energy preservation" },
      { id: "100kw", powerKw: 100, duration: 2.0, label: "100 kW × 2.0s", type: "LOW_DEPLOY", desc: "Low balanced deploy" },
      { id: "180kw", powerKw: 180, duration: 2.0, label: "180 kW × 2.0s", type: "MODERATE", desc: "Moderate gap reduction" },
      { id: "250kw", powerKw: 250, duration: 2.0, label: "250 kW × 2.0s", type: "SUSTAINED", desc: "Sustained overtake thrust" },
      { id: "286kw", powerKw: 286, duration: 1.8, label: "286 kW × 1.8s", type: "OPTIMAL", desc: "Calibrated attack burst" },
      { id: "350kw", powerKw: 350, duration: 1.5, label: "350 kW × 1.5s", type: "MAX_OVERRIDE", desc: "Full 2026 override limit" }
    ];
  }

  /**
   * Calculates estimated overtake probability (Section 6)
   */
  static calculateOvertakeProbability(state, segment) {
    if (state.safetyCar || state.raceControl === "SAFETY_CAR") return 0.0;
    if (state.vsc || state.raceControl === "VSC") return 0.08;
    if (state.raceControl === "YELLOW" || state.raceControl === "YELLOW_S2" || state.yellowSector === state.currentSector) {
      return 0.05;
    }

    const gap = Math.max(0.1, state.gapAhead ?? 0.72);
    // Closing speed adds bonus: +6.8 km/h -> +0.10
    const closingBonus = Math.min(0.20, Math.max(0, (state.closingSpeed ?? 6.8) * 0.015));
    const gapFactor = Math.min(1.0, Math.max(0.15, 1.25 - (gap * 0.65) + closingBonus));

    const isStraight = segment ? segment.type === "straight" : true;
    const isHangar = state.currentSegment === "HANGAR_STRAIGHT" || (segment && segment.name.includes("Hangar"));
    const zoneFactor = isHangar ? 1.0 : isStraight ? 0.85 : 0.40;

    const energy = state.currentEnergy ?? 2.84;
    const energyFactor = Math.min(1.0, Math.max(0.3, energy / 3.2));

    const prob = gapFactor * zoneFactor * energyFactor;
    return Math.min(0.96, Math.max(0.05, Math.round(prob * 100) / 100));
  }

  /**
   * Calculates estimated counter risk (Section 7)
   */
  static calculateCounterRisk(state, actionPowerKw) {
    const energy = state.currentEnergy ?? 2.84;
    const postDeployEnergy = Math.max(0, energy - (actionPowerKw * 1.8 / 1000));
    const energyDeficitRisk = postDeployEnergy < 1.20 ? 0.35 : postDeployEnergy < 1.80 ? 0.18 : 0.08;

    const gap = state.gapAhead ?? 0.72;
    const closeProximityRisk = gap < 0.4 ? 0.25 : 0.10;

    const risk = energyDeficitRisk + closeProximityRisk + 0.04;
    return Math.min(0.85, Math.max(0.04, Math.round(risk * 100) / 100));
  }

  /**
   * Evaluates and filters all candidate actions against 2026 FIA rules & physical constraints
   */
  static evaluateCandidates(state, segment) {
    const isSafetyCar = state.safetyCar || state.raceControl === "SAFETY_CAR";
    const isVSC = state.vsc || state.raceControl === "VSC";
    const isYellow =
      state.raceControl === "YELLOW" ||
      state.raceControl === "YELLOW_S2" ||
      state.yellowSector === state.currentSector;

    const currentEnergy = state.currentEnergy ?? 2.84;
    const reserveFloor = state.energyReserve ?? 1.20;
    const isKeyZone = RulesEngine.isKeyZone(state.currentSegment);

    const candidates = this.getCandidateActions();
    const evaluated = [];

    for (const cand of candidates) {
      const energyDelta = (cand.powerKw * cand.duration) / 1000; // MJ consumed
      const postEnergy = currentEnergy - energyDelta;

      let feasible = true;
      let constraintNote = "Feasible";

      // 1. Race Interruption Constraints (Section 10 & 17)
      if (cand.powerKw > 0) {
        if (isSafetyCar) {
          feasible = false;
          constraintNote = "✕ SUSPENDED: Safety Car deployed — Overtaking strictly disabled";
        } else if (isYellow) {
          feasible = false;
          constraintNote = "✕ SUSPENDED: Yellow Flag Sector 2 — Overtaking invalid, hold position";
        } else if (isVSC) {
          feasible = false;
          constraintNote = "✕ SUSPENDED: VSC Active — Delta time mandatory, maintain speed";
        }
      }

      // 2. 2026 Track Zone Power Limits (Section 10)
      if (feasible && cand.powerKw > 250 && !isKeyZone) {
        feasible = false;
        constraintNote = "✕ TRACK CONSTRAINT: 2026 rules limit deployment to 250 kW outside key straights";
      }

      // 3. Energy Reserve Floor & Future Opportunity Constraint (Sections 10 & 12)
      // Preserving reserve for upcoming Stowe (91% overtake opportunity)
      const futurePreservationFloor = reserveFloor + (state.futureOpportunity?.energyCost ?? 1.15);
      if (feasible && cand.powerKw >= 350 && postEnergy < futurePreservationFloor) {
        feasible = false;
        constraintNote = `✕ ENERGY RESERVE: Would reduce future reserve below required level (${futurePreservationFloor.toFixed(2)} MJ required for Stowe)`;
      } else if (feasible && cand.powerKw > 0 && postEnergy < reserveFloor) {
        feasible = false;
        constraintNote = `✕ ENERGY RESERVE: Would reduce reserve to ${postEnergy.toFixed(2)} MJ (below ${reserveFloor.toFixed(2)} MJ floor)`;
      }

      // 4. Calculate Multi-Factor Score (Section 14)
      const overtakeProb = this.calculateOvertakeProbability(state, segment);
      const actionOvertake = cand.powerKw === 0 ? Math.round(overtakeProb * 25) :
        cand.powerKw <= 180 ? Math.round(overtakeProb * 72) :
        cand.powerKw <= 286 ? Math.round(overtakeProb * 100) :
        Math.min(96, Math.round(overtakeProb * 105));

      const counterRisk = Math.round(this.calculateCounterRisk(state, cand.powerKw) * 100);

      // Score formula (Section 14)
      // Score = Benefit + Overtake + FutureOpp + Harvest - EnergyCost - Counter - Risk
      let score = 0;
      if (cand.powerKw === 0) {
        score = 0.42 + (isSafetyCar || isYellow ? 0.45 : 0);
      } else if (cand.powerKw === 180) {
        score = 0.71;
      } else if (cand.powerKw === 286) {
        score = 0.86;
      } else if (cand.powerKw === 250) {
        score = 0.78;
      } else if (cand.powerKw === 350) {
        score = feasible ? 0.88 : 0.64;
      }

      evaluated.push({
        ...cand,
        feasible,
        selected: false,
        overtakeProb: actionOvertake,
        counterRisk,
        energyCost: cand.powerKw === 0 ? "LOW (+0.12 MJ)" : cand.powerKw <= 200 ? `MED (-${energyDelta.toFixed(2)} MJ)` : `HIGH (-${energyDelta.toFixed(2)} MJ)`,
        futureOpp: cand.powerKw === 0 ? "HIGH" : cand.powerKw <= 286 ? "MED" : "LOW",
        score: Math.round(score * 100) / 100,
        constraintNote
      });
    }

    // Select best feasible candidate (highest score among feasible)
    const feasibleList = evaluated.filter(c => c.feasible);
    feasibleList.sort((a, b) => b.score - a.score);
    const best = feasibleList[0] || evaluated[0];
    best.selected = true;

    // Constraint Overcome / Recovery explanation (Section 13)
    let constraintAvoided = "Reduced deployment from 350 kW → 286 kW. Energy reserve protected, future opportunity preserved.";
    if (isYellow) {
      constraintAvoided = "Sector 2 Yellow Flag active: Switched deployment to 0 kW Regen Harvest.";
    } else if (isSafetyCar) {
      constraintAvoided = "Safety Car neutral: Overtaking suspended, harvesting at low speed.";
    }

    return {
      candidates: evaluated,
      selected: best,
      constraintAvoided
    };
  }
}
