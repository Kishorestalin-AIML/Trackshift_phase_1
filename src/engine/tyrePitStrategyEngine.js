/**
 * ALPINE F1 2026 — TYRE & PIT STOP STRATEGY ENGINE
 *
 * Implements:
 * 1. 5 Tyre Compounds (SOFT, MEDIUM, HARD, INTERMEDIATE, WET)
 * 2. Tyre Degradation & Grip Performance Physics (Age, Temperature, Weather)
 * 3. Circuit-Specific Strategic Pit Lane Loss (Stationary 2.4s + Travel Loss = 21.4s)
 * 4. Safety Car / VSC Delta Modifiers (Reduced 13.8s Pit Loss under Neutralization)
 * 5. Undercut & Overcut Potential Assessment
 * 6. Dynamic Optimal Pit Window Generator (e.g. L27-L29, Best L28)
 * 7. Candidate Pit Actions (Stay Out, Pit Now, Pit Next Lap, Pit In 2 Laps, Extend Stint)
 * 8. Tyre Inventory & Mandatory 2-Compound Rule Tracking
 */

import { FIA_RULE_PROFILE_2026 } from "./fia2026RuleEngine.js";

export class TyrePitStrategyEngine {
  constructor(ruleProfile = FIA_RULE_PROFILE_2026) {
    this.ruleProfile = ruleProfile;
    this.compounds = ruleProfile.compounds || {
      SOFT: { id: "SOFT", name: "Soft (C4)", initialPerformance: 100, degradationPerLap: 3.4, peakLaps: 16, dryWet: "DRY" },
      MEDIUM: { id: "MEDIUM", name: "Medium (C3)", initialPerformance: 92, degradationPerLap: 1.8, peakLaps: 26, dryWet: "DRY" },
      HARD: { id: "HARD", name: "Hard (C1)", initialPerformance: 84, degradationPerLap: 0.9, peakLaps: 36, dryWet: "DRY" },
      INTERMEDIATE: { id: "INTERMEDIATE", name: "Intermediate", initialPerformance: 80, degradationPerLap: 2.2, peakLaps: 22, dryWet: "DAMP" },
      WET: { id: "WET", name: "Full Wet", initialPerformance: 72, degradationPerLap: 2.5, peakLaps: 20, dryWet: "WET" }
    };
  }

  /**
   * Calculates comprehensive tyre state
   */
  calculateTyreState({
    compoundId = "MEDIUM",
    tyreAge = 18,
    trackCondition = "DRY",
    trackTempC = 35
  } = {}) {
    const compound = this.compounds[compoundId] || this.compounds.MEDIUM;

    // Weather alignment penalty
    let weatherFactor = 1.0;
    if (trackCondition === "WET") {
      weatherFactor = compound.id === "WET" ? 1.0 : compound.id === "INTERMEDIATE" ? 0.75 : 0.25;
    } else if (trackCondition === "DAMP") {
      weatherFactor = compound.id === "INTERMEDIATE" ? 1.0 : compound.id === "SOFT" ? 0.85 : 0.65;
    } else {
      // DRY track
      weatherFactor = compound.dryWet === "DRY" ? 1.0 : 0.55;
    }

    // Thermal scaling
    const optimalTemp = compound.id === "SOFT" ? 95 : compound.id === "MEDIUM" ? 100 : compound.id === "HARD" ? 105 : 70;
    const estimatedTyreTemp = trackTempC + 60 + Math.min(15, tyreAge * 0.4);
    const tempDelta = Math.abs(estimatedTyreTemp - optimalTemp);
    const thermalEfficiency = Math.max(0.85, 1.0 - (tempDelta * 0.005));

    // Degradation calculation
    const baseGrip = compound.initialPerformance - (tyreAge * compound.degradationPerLap);
    const calculatedGrip = Math.round(Math.max(15, Math.min(100, baseGrip * weatherFactor * thermalEfficiency)));

    // Categorical degradation
    let degradationLevel = "LOW";
    if (tyreAge > compound.peakLaps * 1.1 || calculatedGrip < 45) {
      degradationLevel = "CRITICAL";
    } else if (tyreAge > compound.peakLaps * 0.75 || calculatedGrip < 65) {
      degradationLevel = "HIGH";
    } else if (tyreAge > compound.peakLaps * 0.4) {
      degradationLevel = "MEDIUM";
    }

    const performance = calculatedGrip;
    const performanceFactor = Math.round((performance / 100) * 100) / 100;
    const isCliffReached = degradationLevel === "CRITICAL" || performance < 45;
    const lapsRemainingInStint = Math.max(0, Math.round((performance - 35) / Math.max(0.5, compound.degradationPerLap)));

    return {
      compound,
      compoundId: compound.id,
      compoundName: compound.name,
      tyreAge,
      grip: calculatedGrip,
      performance,
      performanceFactor,
      degradationLevel,
      isCliffReached,
      lapsRemainingInStint,
      trackCondition,
      trackTempC,
      estimatedTyreTemp: Math.round(estimatedTyreTemp)
    };
  }

  /**
   * Evaluates circuit-specific strategic pit loss and rejoining position (Section 31)
   */
  calculatePitLoss({ position = 3, isVscOrSc = false, circuitLossSec = null } = {}) {
    const stationaryTimeSec = this.ruleProfile.stationaryPitStopTimeSec || 2.4;
    const normalLossSec = circuitLossSec || this.ruleProfile.pitLaneTimeLossSec || 21.4;
    const vscLossSec = this.ruleProfile.pitLaneTimeLossVscSec || 13.8;

    const totalPitLossSec = isVscOrSc ? vscLossSec : normalLossSec;
    const timeSavedVsNormalSec = isVscOrSc ? Math.round((normalLossSec - vscLossSec) * 10) / 10 : 0.0;

    // Field gap density modeling (~3.8s per position in mid-pack)
    const predictedDrop = Math.min(15, Math.ceil(totalPitLossSec / 4.2));
    const predictedExitPosition = Math.min(20, position + predictedDrop);

    return {
      stationaryTimeSec,
      totalPitLossSec,
      isVscOrSc,
      timeSavedVsNormalSec,
      currentPosition: position,
      predictedExitPosition: `P${predictedExitPosition}`,
      predictedPositionDrop: predictedDrop,
      freshTyreAdvantageSecPerLap: 1.45,
      breakEvenLaps: Math.ceil(totalPitLossSec / 1.45)
    };
  }

  /**
   * Evaluates Undercut and Overcut Potentials (Sections 38 & 39)
   */
  calculateUndercutOvercut({ carAheadGap = 0.7, tyreAge = 18, compoundId = "MEDIUM" } = {}) {
    const compound = this.compounds[compoundId] || this.compounds.MEDIUM;
    const isWornTyres = tyreAge >= compound.peakLaps * 0.65;
    const isWithinAttackRange = carAheadGap <= 2.2;

    let undercutGainSec = 0.4;
    let undercutViability = "LOW";
    if (isWithinAttackRange && isWornTyres) {
      undercutGainSec = 1.80;
      undercutViability = "HIGH";
    } else if (isWithinAttackRange || isWornTyres) {
      undercutGainSec = 1.10;
      undercutViability = "MEDIUM";
    }

    let overcutGainSec = 0.3;
    let overcutViability = "LOW";
    if (!isWornTyres && carAheadGap <= 1.5) {
      overcutGainSec = 1.20;
      overcutViability = "MODERATE";
    }

    return {
      undercutGainSec,
      undercutViability,
      overcutGainSec,
      overcutViability,
      isUndercutRecommended: undercutViability === "HIGH"
    };
  }

  /**
   * Generates Optimal Pit Window (Section 40)
   */
  calculatePitWindow({ currentLap = 24, tyreAge = 18, compoundId = "MEDIUM", totalRaceLaps = 57 } = {}) {
    const compound = this.compounds[compoundId] || this.compounds.MEDIUM;
    const optimalStintLength = compound.peakLaps;
    const plannedPitLap = Math.min(totalRaceLaps - 5, Math.max(currentLap + 1, currentLap + (optimalStintLength - tyreAge)));
    const windowStart = Math.max(currentLap, plannedPitLap - 1);
    const windowEnd = Math.min(totalRaceLaps - 2, plannedPitLap + 1);

    return {
      plannedPitLap,
      windowStart,
      windowEnd,
      windowString: `Lap ${windowStart}–${windowEnd}`,
      bestLapString: `Best: Lap ${plannedPitLap}`,
      earlyStopRisk: "+0.4s traffic merge risk",
      lateStopRisk: "+1.1s tyre cliff degradation risk"
    };
  }

  /**
   * Evaluates all 5 Candidate Pit Actions (Section 32)
   */
  evaluatePitActions({
    currentLap = 24,
    position = 3,
    tyreState,
    carAheadGap = 0.7,
    carBehindGap = 1.4,
    isVscOrSc = false
  }) {
    const pitLoss = this.calculatePitLoss({ position, isVscOrSc });
    const undercutOvercut = this.calculateUndercutOvercut({
      carAheadGap,
      tyreAge: tyreState.tyreAge,
      compoundId: tyreState.compoundId
    });

    const isDegrading = tyreState.degradationLevel === "HIGH" || tyreState.degradationLevel === "CRITICAL";
    const isCloseAhead = carAheadGap <= 1.5;

    const candidateActions = [
      {
        action: "STAY OUT",
        score: !isDegrading ? 86 : 52,
        timeCostSec: 0.0,
        expectedPosition: `P${position}`,
        undercutPotential: "0.0s",
        trafficRisk: "NONE",
        tyreConditionNext: tyreState.performance - 4,
        rationale: !isDegrading
          ? "Tyres retain competitive pace. Preserving track position and monitoring opponent delta."
          : "Tyres approaching performance cliff. High vulnerability to opponent undercut."
      },
      {
        action: "PIT NOW",
        score: (isDegrading && isCloseAhead) || isVscOrSc ? 91 : isDegrading ? 84 : 58,
        timeCostSec: pitLoss.totalPitLossSec,
        expectedPosition: pitLoss.predictedExitPosition,
        undercutPotential: `+${undercutOvercut.undercutGainSec.toFixed(1)}s`,
        trafficRisk: position <= 3 ? "MEDIUM" : "HIGH",
        tyreConditionNext: 100,
        rationale: isVscOrSc
          ? `VSC/Safety Car active: Pit loss reduced by ${pitLoss.timeSavedVsNormalSec}s. Optimal time to box.`
          : isDegrading
          ? `High undercut advantage (+${undercutOvercut.undercutGainSec.toFixed(1)}s). Fresh rubber recovers track position within ${pitLoss.breakEvenLaps} laps.`
          : "Premature stop. Remaining tyre life would be wasted."
      },
      {
        action: "PIT NEXT LAP",
        score: isDegrading ? 87 : 65,
        timeCostSec: pitLoss.totalPitLossSec,
        expectedPosition: pitLoss.predictedExitPosition,
        undercutPotential: "+1.2s",
        trafficRisk: "MEDIUM",
        tyreConditionNext: 100,
        rationale: "Executing in-lap push. Allows maximum electrical discharge this lap before boxing next lap."
      },
      {
        action: "PIT IN 2 LAPS",
        score: !isDegrading ? 78 : 55,
        timeCostSec: pitLoss.totalPitLossSec,
        expectedPosition: pitLoss.predictedExitPosition,
        undercutPotential: "+0.8s",
        trafficRisk: "LOW",
        tyreConditionNext: 100,
        rationale: "Aligns with optimal pit window centroid. Allows clean air gap evaluation."
      },
      {
        action: "EXTEND STINT",
        score: !isDegrading && carBehindGap > 2.0 ? 80 : 44,
        timeCostSec: 0.0,
        expectedPosition: `P${position}`,
        undercutPotential: "-0.5s",
        trafficRisk: "LOW",
        tyreConditionNext: tyreState.performance - 8,
        rationale: "Gambling on late Safety Car or clean air overcut. High risk if tyre cliff arrives."
      }
    ];

    // Find best action
    let best = candidateActions[0];
    candidateActions.forEach((act) => {
      if (act.score > best.score) best = act;
    });

    return {
      bestAction: best.action,
      candidateActions,
      pitLoss,
      undercutOvercut
    };
  }

  /**
   * Determines Next Compound Selection (Section 34, 35)
   */
  recommendNextCompound({ currentCompoundId = "MEDIUM", currentLap = 24, totalLaps = 57, trackCondition = "DRY" }) {
    if (trackCondition === "WET") return "WET";
    if (trackCondition === "DAMP") return "INTERMEDIATE";

    const remainingLaps = Math.max(1, totalLaps - currentLap);
    // Mandatory 2-compound rule: if currently MEDIUM, recommend HARD or SOFT
    if (currentCompoundId === "MEDIUM") {
      return remainingLaps > 22 ? "HARD" : "SOFT";
    } else if (currentCompoundId === "SOFT") {
      return remainingLaps > 28 ? "HARD" : "MEDIUM";
    } else {
      return remainingLaps <= 18 ? "SOFT" : "MEDIUM";
    }
  }
}

export const tyrePitEngine = new TyrePitStrategyEngine();
