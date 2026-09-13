/**
 * ALPINE F1 2026 ENERGY DEPLOYMENT DIGITAL TWIN ENGINE
 *
 * Simulates energy flowing through:
 * ZONE → SECTOR → LAP → NEXT LAP
 *
 * Implements:
 * 1. 9-Zone Lap Model across 3 Sectors with individual performance and recovery potentials
 * 2. 4 Configurable Deployment Strategies:
 *    - SUPER-CLIP
 *    - NORMAL DEPLOYMENT
 *    - COAST
 *    - BRAKING / HARVEST
 * 3. Dynamic Energy Reserve Model (Required Reserve vs Free Energy)
 * 4. Continuous Multi-Lap Energy Transfer (E_next = E_current - E_deployed + E_recovered)
 * 5. Recovery Timing & Feasibility Analysis
 * 6. Risk-Reward Strategy Evaluation (Lap, Position, Gaps, Recovery, FIA constraints)
 * 7. "WHY THIS ZONE?" Justification Generator
 * 8. Full Multi-Lap Simulation Stepper
 */

import { FIA_RULE_PROFILE_2026, fiaRuleEngine } from "./fia2026RuleEngine.js";

// Export standard reference
export { FIA_RULE_PROFILE_2026 };

/**
 * 9 Canonical Zones per Lap across 3 Sectors
 */
export const DEFAULT_LAP_ZONES = [
  // Sector 1
  {
    id: "Z1",
    sector: 1,
    zoneNumber: 1,
    name: "Pit Straight Acceleration",
    type: "ACCEL",
    performancePotential: 75,
    recoveryPotential: 15,
    isAccelerationZone: true,
    baseDurationSec: 3.8
  },
  {
    id: "Z2",
    sector: 1,
    zoneNumber: 2,
    name: "Turn 1-2 Technical Complex",
    type: "CORNER",
    performancePotential: 40,
    recoveryPotential: 50,
    isAccelerationZone: false,
    baseDurationSec: 4.2
  },
  {
    id: "Z3",
    sector: 1,
    zoneNumber: 3,
    name: "Heavy Hairpin Entry & Straight Prep",
    type: "BRAKE_HARVEST",
    performancePotential: 45,
    recoveryPotential: 80,
    isAccelerationZone: false,
    baseDurationSec: 3.5
  },
  // Sector 2
  {
    id: "Z4",
    sector: 2,
    zoneNumber: 4,
    name: "Chicane Heavy Braking",
    type: "BRAKE_HARVEST",
    performancePotential: 30,
    recoveryPotential: 80,
    isAccelerationZone: false,
    baseDurationSec: 3.2
  },
  {
    id: "Z5",
    sector: 2,
    zoneNumber: 5,
    name: "Main DRS Acceleration Straight",
    type: "ACCEL",
    performancePotential: 95,
    recoveryPotential: 20,
    isAccelerationZone: true,
    baseDurationSec: 4.6
  },
  {
    id: "Z6",
    sector: 2,
    zoneNumber: 6,
    name: "High-Speed Sweeper Exit",
    type: "CORNER",
    performancePotential: 40,
    recoveryPotential: 75,
    isAccelerationZone: false,
    baseDurationSec: 3.9
  },
  // Sector 3
  {
    id: "Z7",
    sector: 3,
    zoneNumber: 7,
    name: "Esses Complex & Technical Flow",
    type: "CORNER",
    performancePotential: 60,
    recoveryPotential: 70,
    isAccelerationZone: false,
    baseDurationSec: 4.5
  },
  {
    id: "Z8",
    sector: 3,
    zoneNumber: 8,
    name: "Stadium Section Hard Braking",
    type: "BRAKE_HARVEST",
    performancePotential: 35,
    recoveryPotential: 80,
    isAccelerationZone: false,
    baseDurationSec: 3.4
  },
  {
    id: "Z9",
    sector: 3,
    zoneNumber: 9,
    name: "Final Corner & Main Straight Launch",
    type: "ACCEL",
    performancePotential: 85,
    recoveryPotential: 25,
    isAccelerationZone: true,
    baseDurationSec: 4.1
  }
];

export class EnergyDeploymentTwinEngine {
  constructor(zones = DEFAULT_LAP_ZONES) {
    this.zones = zones;
    this.ruleProfile = FIA_RULE_PROFILE_2026;
  }

  /**
   * Calculates dynamic Required Energy Reserve and Free Energy
   */
  calculateReserveMetrics(soc, carBehindGap, lapsRemaining, position) {
    const batteryCapacityMJ = 4.00;
    const currentEnergyMJ = (soc / 100) * batteryCapacityMJ;
    const safetyFloorMJ = (this.ruleProfile.socReserveFloorPct / 100) * batteryCapacityMJ; // 0.60 MJ (15%)

    // 1. Defence Energy: proportional to rear pressure
    let defenceMJ = 0.35;
    if (carBehindGap < 0.5) defenceMJ = 0.90;
    else if (carBehindGap < 1.0) defenceMJ = 0.60;
    else if (carBehindGap > 2.0) defenceMJ = 0.15;
    if (position === 1) defenceMJ += 0.30; // Leader defense

    // 2. Recovery-Gap Buffer: energy needed to bridge until next heavy harvest
    let recoveryGapMJ = 0.25;
    if (lapsRemaining <= 2) recoveryGapMJ = 0.10;

    const requiredReserveMJ = Math.round((safetyFloorMJ + defenceMJ + recoveryGapMJ) * 100) / 100;
    const freeEnergyMJ = Math.round(Math.max(0, currentEnergyMJ - requiredReserveMJ) * 100) / 100;
    const requiredReserveSoc = Math.round((requiredReserveMJ / batteryCapacityMJ) * 100);

    return {
      currentEnergyMJ,
      requiredReserveMJ,
      freeEnergyMJ,
      requiredReserveSoc,
      hasDefensivePressure: carBehindGap < 0.5,
      isRearSafe: carBehindGap > 2.0
    };
  }

  /**
   * Evaluates the 4 strategies for a specific zone given the running state
   */
  evaluateZoneStrategies(zone, state, reserveMetrics) {
    const {
      soc,
      position,
      carAheadGap,
      carBehindGap,
      lapsRemaining,
      intensity = 70 // User slider 0..100 (SAVE to ATTACK)
    } = state;

    const isP1 = position === 1;
    const isLateRace = lapsRemaining <= 3;
    const isFinalLap = lapsRemaining <= 1;

    // Requested power scaled by intensity
    // Intensity 0 = 150 kW, 50 = 265 kW, 100 = 380 kW (clamped to 350 kW legal)
    const basePowerKw = Math.round(150 + (intensity / 100) * 230);
    const clampedPowerKw = zone.isAccelerationZone
      ? Math.min(basePowerKw, this.ruleProfile.accelerationZoneLimitKw)
      : Math.min(basePowerKw, this.ruleProfile.standardZoneLimitKw);
    const isFiaLimitActive = basePowerKw > clampedPowerKw;

    // Energy specs for each strategy in this zone
    const duration = zone.baseDurationSec;
    const superClipPower = clampedPowerKw;
    const superClipMJ = Math.round(((superClipPower * (duration * 0.9)) / 1000) * 100) / 100; // ~1.7 - 2.0 MJ
    const normalMJ = Math.round(((Math.min(clampedPowerKw, 240) * (duration * 0.7)) / 1000) * 100) / 100; // ~0.8 - 1.2 MJ
    const coastMJ = 0.12; // minimal parasitic draw
    const harvestMJ = Math.round(((zone.recoveryPotential / 100) * 0.95) * 100) / 100; // ~0.7 - 0.85 MJ

    // Strategy Scores
    const scores = {
      "SUPER-CLIP": -999,
      "NORMAL DEPLOYMENT": 0,
      "COAST": 0,
      "BRAKING / HARVEST": 0
    };

    // 1. BRAKING / HARVEST
    if (zone.recoveryPotential >= 65) {
      scores["BRAKING / HARVEST"] = zone.recoveryPotential * 1.2;
      if (soc < 45) scores["BRAKING / HARVEST"] += 40;
      if (reserveMetrics.freeEnergyMJ <= 0.3) scores["BRAKING / HARVEST"] += 35;
    } else {
      scores["BRAKING / HARVEST"] = zone.recoveryPotential * 0.4;
    }

    // 2. COAST
    scores["COAST"] = 30;
    if (zone.performancePotential < 50) scores["COAST"] += 35;
    if (reserveMetrics.freeEnergyMJ <= 0.4) scores["COAST"] += 40;
    if (carAheadGap > 1.8 && !isFinalLap) scores["COAST"] += 25; // Don't waste energy if car ahead is far
    if (isLateRace) scores["COAST"] -= 40;

    // 3. NORMAL DEPLOYMENT
    scores["NORMAL DEPLOYMENT"] = 40;
    if (zone.performancePotential >= 50 && zone.performancePotential < 80) scores["NORMAL DEPLOYMENT"] += 35;
    if (reserveMetrics.freeEnergyMJ >= 0.5) scores["NORMAL DEPLOYMENT"] += 25;
    if (reserveMetrics.hasDefensivePressure) scores["NORMAL DEPLOYMENT"] += 30; // hold pace against rear rival

    // 4. SUPER-CLIP
    if (!isP1 && zone.isAccelerationZone && zone.performancePotential >= 80) {
      let sc = zone.performancePotential;
      // Immediate Overtake Opportunity
      if (carAheadGap <= 0.9) sc += 50;
      else if (carAheadGap <= 1.4) sc += 25;
      else sc -= 35;

      // Free Energy availability
      if (reserveMetrics.freeEnergyMJ >= superClipMJ * 0.8) {
        sc += 40;
      } else if (soc < 30 && !isFinalLap) {
        sc -= 70; // Penalize attack if battery is below reserve
      }

      // Defensive threat discount
      if (reserveMetrics.hasDefensivePressure && !isFinalLap) {
        sc -= 45;
      }

      // End of race aggression
      if (isLateRace && carAheadGap <= 1.5) {
        sc += 45;
      }

      scores["SUPER-CLIP"] = sc;
    }

    // Pick winning strategy for this zone
    let chosenStrategy = "COAST";
    let maxScore = -9999;
    for (const [strat, val] of Object.entries(scores)) {
      if (val > maxScore) {
        maxScore = val;
        chosenStrategy = strat;
      }
    }

    // Compute energy delta
    let deltaMJ = 0;
    let deployedMJ = 0;
    let recoveredMJ = 0;

    if (chosenStrategy === "SUPER-CLIP") {
      deployedMJ = Math.min(superClipMJ, (soc / 100) * 4.0 - 0.60); // Don't drop below floor
      deltaMJ = -deployedMJ;
    } else if (chosenStrategy === "NORMAL DEPLOYMENT") {
      deployedMJ = normalMJ;
      deltaMJ = -deployedMJ;
    } else if (chosenStrategy === "COAST") {
      deployedMJ = coastMJ;
      deltaMJ = -deployedMJ;
    } else if (chosenStrategy === "BRAKING / HARVEST") {
      recoveredMJ = harvestMJ;
      deltaMJ = recoveredMJ;
    }

    return {
      zone,
      chosenStrategy,
      scores,
      deployedMJ: Math.round(deployedMJ * 100) / 100,
      recoveredMJ: Math.round(recoveredMJ * 100) / 100,
      deltaMJ: Math.round(deltaMJ * 100) / 100,
      powerKw: chosenStrategy === "SUPER-CLIP" ? superClipPower : chosenStrategy === "NORMAL DEPLOYMENT" ? 220 : 0,
      isFiaLimitActive
    };
  }

  /**
   * Simulates full multi-lap energy transfer:
   * ZONE → SECTOR → LAP → NEXT LAP
   *
   * @param {Object} inputState
   * @returns {Object} Comprehensive multi-lap plan
   */
  simulateMultiLap(inputState) {
    const {
      currentLap = 24,
      futureLaps = 3,
      position = 3,
      carAheadGap = 0.7,
      carBehindGap = 1.4,
      soc = 58,
      intensity = 75
    } = inputState;

    const totalLapsToSimulate = 1 + futureLaps; // e.g. Lap 24 + 3 future = 4 laps total
    let runningSoc = soc;
    let runningPosition = position;
    let runningCarAheadGap = carAheadGap;
    let runningCarBehindGap = carBehindGap;

    const lapPlans = [];
    const allZoneSteps = [];
    let nextBestAction = null;
    let highestValueActionScore = -9999;

    for (let lapOffset = 0; lapOffset < totalLapsToSimulate; lapOffset++) {
      const lapNumber = currentLap + lapOffset;
      const lapsRemaining = Math.max(1, 57 - lapNumber);
      const zoneDecisions = [];
      let lapDeployedTotal = 0;
      let lapRecoveredTotal = 0;
      const lapStartSoc = runningSoc;

      for (let zIndex = 0; zIndex < this.zones.length; zIndex++) {
        const zone = this.zones[zIndex];
        const reserveMetrics = this.calculateReserveMetrics(
          runningSoc,
          runningCarBehindGap,
          lapsRemaining,
          runningPosition
        );

        const stepState = {
          soc: runningSoc,
          position: runningPosition,
          carAheadGap: runningCarAheadGap,
          carBehindGap: runningCarBehindGap,
          lapsRemaining,
          intensity
        };

        const decision = this.evaluateZoneStrategies(zone, stepState, reserveMetrics);

        // Update running energy state continuously (E_next = E_current - E_deployed + E_recovered)
        const batteryCapacityMJ = 4.00;
        const currentEnergyMJ = (runningSoc / 100) * batteryCapacityMJ;
        const nextEnergyMJ = Math.max(0.60, Math.min(4.00, currentEnergyMJ + decision.deltaMJ));
        const nextSoc = Math.round((nextEnergyMJ / batteryCapacityMJ) * 100);

        lapDeployedTotal += decision.deployedMJ;
        lapRecoveredTotal += decision.recoveredMJ;

        const stepRecord = {
          lap: lapNumber,
          isCurrentLap: lapOffset === 0,
          sector: zone.sector,
          zoneId: zone.id,
          zoneNumber: zone.zoneNumber,
          zoneName: zone.name,
          isAccelerationZone: zone.isAccelerationZone,
          performancePotential: zone.performancePotential,
          recoveryPotential: zone.recoveryPotential,
          strategy: decision.chosenStrategy,
          deployedMJ: decision.deployedMJ,
          recoveredMJ: decision.recoveredMJ,
          powerKw: decision.powerKw,
          socBefore: runningSoc,
          socAfter: nextSoc,
          isFiaLimitActive: decision.isFiaLimitActive,
          scores: decision.scores
        };

        zoneDecisions.push(stepRecord);
        allZoneSteps.push(stepRecord);

        // Check if this is the highest value upcoming attack/action
        const actionScore = (decision.chosenStrategy === "SUPER-CLIP" ? 150 : decision.chosenStrategy === "BRAKING / HARVEST" ? 80 : 40)
          + (zone.performancePotential * 0.5)
          - (lapOffset * 20);

        if (actionScore > highestValueActionScore && (decision.chosenStrategy === "SUPER-CLIP" || !nextBestAction)) {
          highestValueActionScore = actionScore;
          nextBestAction = stepRecord;
        }

        // Handle overtake event if SUPER-CLIP succeeds
        if (decision.chosenStrategy === "SUPER-CLIP" && runningPosition > 1 && runningCarAheadGap <= 1.2 && runningSoc >= 30) {
          stepRecord.overtakeOccurred = true;
          stepRecord.oldPosition = `P${runningPosition}`;
          runningPosition = Math.max(1, runningPosition - 1);
          stepRecord.newPosition = `P${runningPosition}`;
          runningCarAheadGap = 1.8; // Car passed, gap reset to next car
        }

        runningSoc = nextSoc;
      }

      lapPlans.push({
        lap: lapNumber,
        isCurrentLap: lapOffset === 0,
        startSoc: lapStartSoc,
        endSoc: runningSoc,
        totalDeployedMJ: Math.round(lapDeployedTotal * 100) / 100,
        totalRecoveredMJ: Math.round(lapRecoveredTotal * 100) / 100,
        netEnergyDeltaMJ: Math.round((lapRecoveredTotal - lapDeployedTotal) * 100) / 100,
        zoneDecisions
      });
    }

    // Default nextBestAction fallback if none selected
    if (!nextBestAction && allZoneSteps.length > 0) {
      nextBestAction = allZoneSteps[0];
    }

    // Find next recovery opportunity from nextBestAction
    let nextRecovery = null;
    const bestIndex = allZoneSteps.findIndex((s) => s === nextBestAction);
    for (let i = bestIndex + 1; i < allZoneSteps.length; i++) {
      if (allZoneSteps[i].strategy === "BRAKING / HARVEST" || allZoneSteps[i].recoveredMJ > 0.4) {
        nextRecovery = allZoneSteps[i];
        break;
      }
    }

    // Synthesize "WHY THIS ZONE?"
    const whyThisZone = this.synthesizeWhyThisZone(nextBestAction, nextRecovery, inputState);

    // Synthesize concise reason
    let reason = "High-value attack window with sufficient reserve for the next defensive requirement.";
    if (nextBestAction.strategy === "COAST") {
      reason = "Conserving electrical reserve in lower-value technical zone to prepare upcoming attack straight.";
    } else if (nextBestAction.strategy === "BRAKING / HARVEST") {
      reason = "Maximizing kinetic recovery under heavy braking to replenish usable electrical reserve.";
    } else if (nextBestAction.strategy === "NORMAL DEPLOYMENT") {
      reason = "Maintaining competitive lap traversal pace while staying within lap energy quota.";
    }

    return {
      currentLap,
      futureLaps,
      position: `P${position}`,
      finalSimulatedPosition: `P${runningPosition}`,
      initialSoc: soc,
      finalSimulatedSoc: runningSoc,
      nextBestAction,
      nextRecovery,
      whyThisZone,
      reason,
      fiaStatus: nextBestAction.isFiaLimitActive ? "FIA LIMIT ACTIVE" : "✓ LEGAL",
      lapPlans,
      allZoneSteps
    };
  }

  synthesizeWhyThisZone(action, nextRecovery, state) {
    const zoneName = action.zoneName;
    const perf = action.performancePotential;
    const strat = action.strategy;

    if (strat === "SUPER-CLIP") {
      const recNote = nextRecovery
        ? `recovery opportunity immediately afterward in ${nextRecovery.zoneId} (+${nextRecovery.recoveredMJ.toFixed(1)} MJ)`
        : "strong straight line acceleration margin";
      return `ZONE ${action.zoneNumber} selected: Performance potential ${perf}/100 + favorable car ahead gap (${state.carAheadGap}s) + ${recNote}.`;
    } else if (strat === "BRAKING / HARVEST") {
      return `ZONE ${action.zoneNumber} selected: High recovery potential (${action.recoveryPotential}/100) under heavy braking, restoring usable energy without loss of track position.`;
    } else if (strat === "COAST") {
      return `ZONE ${action.zoneNumber} selected: Preserving finite energy in a technical sector (Perf ${perf}/100) where heavy electrical deployment yields diminishing returns.`;
    } else {
      return `ZONE ${action.zoneNumber} selected: Balanced deployment maintains competitive delta to car ahead while securing defensive gap behind.`;
    }
  }
}

export const energyDeploymentEngine = new EnergyDeploymentTwinEngine();
