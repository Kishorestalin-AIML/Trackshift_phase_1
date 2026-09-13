/**
 * RACE TWIN — Overtaking & Risk Simulation Engine (Sections 10, 11, 33, 34)
 */

export class OvertakingEngine {
  /**
   * Calculate overtake probability (0..1)
   * Section 33: gapFactor × speedFactor × attackZoneFactor × energyFactor × tyreFactor × ruleFactor
   */
  static calculateProbability(state, segment) {
    if (state.raceControl === "SAFETY_CAR" || state.safetyCar) return 0.0;
    if (state.yellowSector === state.currentSector || state.raceControl === "YELLOW" || state.raceControl === "YELLOW_S2") {
      return 0.05;
    }
    if (state.vsc || state.raceControl === "VSC") return 0.10;

    const gap = Math.max(0.1, state.gapAhead || 0.62);
    // Closer gap increases factor: 0.3s -> 1.0, 1.0s -> 0.65, 2.0s -> 0.2
    const gapFactor = Math.min(1.0, Math.max(0.1, 1.2 - (gap * 0.55)));

    // Speed factor
    const speed = state.speed || 318;
    const speedFactor = Math.min(1.0, Math.max(0.4, speed / 330));

    // Attack zone factor from track segment
    const attackZoneFactor = segment ? (segment.attackPotential || 0.5) : 0.75;

    // Energy factor (63% -> ~0.85, 20% -> 0.4)
    const energy = state.energyAvailable || 63;
    const energyFactor = Math.min(1.0, Math.max(0.2, energy / 75));

    // Tyre factor (82% -> 0.9)
    const tyreCondition = state.tyreCondition || 82;
    const tyreFactor = Math.min(1.0, Math.max(0.3, tyreCondition / 90));

    const ruleFactor = state.raceControl === "GREEN" ? 1.0 : 0.3;

    const rawProb = gapFactor * speedFactor * attackZoneFactor * energyFactor * tyreFactor * ruleFactor;
    return Math.min(0.96, Math.max(0.02, Math.round(rawProb * 100) / 100));
  }

  /**
   * Calculate tactical risk (0..1)
   * Section 34: speedDifference + closingRate + tyreRisk + energyCost + trackRisk
   */
  static calculateRisk(state, segment) {
    const trackRisk = segment ? (segment.risk || 0.3) : 0.25;
    const tyreRisk = (100 - (state.tyreCondition || 82)) / 200; // 0.09
    const gap = state.gapAhead || 0.62;
    const proximityRisk = gap < 0.4 ? 0.35 : gap < 0.8 ? 0.20 : 0.10;

    const rawRisk = (trackRisk * 0.45) + (tyreRisk * 0.25) + (proximityRisk * 0.30);
    return Math.min(0.95, Math.max(0.05, Math.round(rawRisk * 100) / 100));
  }

  /**
   * Risk Category (LOW, MEDIUM, HIGH)
   */
  static getRiskCategory(riskVal) {
    if (riskVal < 0.30) return "LOW";
    if (riskVal < 0.60) return "MEDIUM";
    return "HIGH";
  }

  /**
   * Dynamic Attack Potential Label
   */
  static getAttackLabel(prob) {
    if (prob >= 0.70) return "HIGH ATTACK VALUE";
    if (prob >= 0.45) return "MEDIUM ATTACK VALUE";
    if (prob >= 0.20) return "LOW ATTACK VALUE";
    return "NO ATTACK";
  }
}
