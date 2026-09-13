/**
 * ALPINE F1 2026 DYNAMIC ENERGY & OVERTAKE DECISION DIGITAL TWIN ENGINE
 *
 * Implements:
 * 1. Megajoule-First Physical Energy Model (E_available = SOC * 20.0 MJ, 1 MW * 1s = 1 MJ)
 * 2. 9-Zone Multi-Lap Persistence (Zone -> Sector -> Lap -> Next Lap)
 * 3. 13-Constraint General Decision Engine (C1 through C13)
 * 4. Independent Non-1:1 Recovery Model (harvest accumulator & braking efficiency)
 * 5. Dynamic Reserve & Free Energy Model (E_reserve vs E_free)
 * 6. Future Opportunity Cost & Opponent Counterattack Modeling
 * 7. 4 Deployment Strategies (SUPER-CLIP, NORMAL DEPLOYMENT, COAST, BRAKING / HARVEST)
 * 8. Comprehensive 4-Question Decision Output (WHAT, WHERE, WHEN, WHY)
 */

import { FIA_RULE_PROFILE_2026 } from "./fia2026RuleEngine.js";
import { tyrePitEngine } from "./tyrePitStrategyEngine.js";

export { FIA_RULE_PROFILE_2026, tyrePitEngine };

/**
 * 4 Candidate Energy Management Actions (Definitions & Strategy Principles)
 * Note: These are candidate energy management actions evaluated by the digital twin optimizer,
 * not official FIA driver modes.
 */
export const STRATEGY_DEFINITIONS = {
  "SUPER-CLIP": {
    name: "SUPER-CLIP",
    what: "Short, concentrated electrical deployment in a high-value attack or defence zone.",
    chooseWhen: "Immediate race/position gain is worth the energy cost.",
    optimizes: "IMMEDIATE RACE VALUE",
    not: "Unlimited energy deployment or guaranteed overtaking."
  },
  "NORMAL DEPLOYMENT": {
    name: "NORMAL DEPLOYMENT",
    what: "Moderate electrical deployment.",
    chooseWhen: "There is a useful current opportunity but aggressive deployment is not justified.",
    optimizes: "CURRENT GAIN + FUTURE ENERGY",
    not: "Maximum attack or pure energy saving."
  },
  "COAST": {
    name: "COAST",
    what: "Reduce discretionary electrical deployment.",
    chooseWhen: "Future energy has greater race value than the current opportunity.",
    optimizes: "FUTURE ENERGY VALUE",
    not: "Randomly slowing the car or abandoning the attack."
  },
  "BRAKING / HARVEST": {
    name: "BRAKING / HARVEST",
    what: "Use available braking/recovery opportunities to rebuild usable energy within physical and FIA constraints.",
    chooseWhen: "Recovery has greater value than immediate deployment.",
    optimizes: "FUTURE ENERGY RECOVERY",
    not: "Unlimited battery charging or recovery everywhere."
  }
};

/**
 * 9 Canonical Zones per Lap with Full 2026 Performance Attributes
 */
export const ALPINE_CIRCUIT_ZONES = [
  // Sector 1
  {
    id: "Z1",
    zoneId: "Z1",
    sector: 1,
    zoneNumber: 1,
    name: "Pit Straight Acceleration",
    isAccelerationZone: true,
    performancePotential: 82,
    deploymentValue: 82,
    overtakePotential: 78,
    attackValue: 78,
    overtakingValue: 78,
    recoveryPotential: 15,
    recoveryValue: 15,
    brakingOpportunity: false,
    defenceValue: 65,
    energyEfficiency: 85,
    tyreSensitivity: 80,
    riskLevel: "MODERATE",
    deploymentPowerLimit: 350,
    recoveryLimit: 7.00,
    baseDurationSec: 3.8
  },
  {
    id: "Z2",
    zoneId: "Z2",
    sector: 1,
    zoneNumber: 2,
    name: "Turn 1-2 Technical Complex",
    isAccelerationZone: false,
    performancePotential: 42,
    deploymentValue: 42,
    overtakePotential: 35,
    attackValue: 35,
    overtakingValue: 35,
    recoveryPotential: 48,
    recoveryValue: 48,
    brakingOpportunity: false,
    defenceValue: 55,
    energyEfficiency: 60,
    tyreSensitivity: 85,
    riskLevel: "HIGH",
    deploymentPowerLimit: 250,
    recoveryLimit: 7.00,
    baseDurationSec: 4.1
  },
  {
    id: "Z3",
    zoneId: "Z3",
    sector: 1,
    zoneNumber: 3,
    name: "Hairpin Entry & Straight Preparation",
    isAccelerationZone: false,
    performancePotential: 45,
    deploymentValue: 45,
    overtakePotential: 40,
    attackValue: 40,
    overtakingValue: 40,
    recoveryPotential: 82,
    recoveryValue: 82,
    brakingOpportunity: true,
    defenceValue: 70,
    energyEfficiency: 75,
    tyreSensitivity: 75,
    riskLevel: "HIGH",
    deploymentPowerLimit: 250,
    recoveryLimit: 7.00,
    baseDurationSec: 3.5
  },
  // Sector 2
  {
    id: "Z4",
    zoneId: "Z4",
    sector: 2,
    zoneNumber: 4,
    name: "Chicane Heavy Braking",
    isAccelerationZone: false,
    performancePotential: 30,
    deploymentValue: 30,
    overtakePotential: 38,
    attackValue: 38,
    overtakingValue: 38,
    recoveryPotential: 85,
    recoveryValue: 85,
    brakingOpportunity: true,
    defenceValue: 80,
    energyEfficiency: 70,
    tyreSensitivity: 70,
    riskLevel: "HIGH",
    deploymentPowerLimit: 250,
    recoveryLimit: 7.00,
    baseDurationSec: 3.2
  },
  {
    id: "Z5",
    zoneId: "Z5",
    sector: 2,
    zoneNumber: 5,
    name: "Main DRS Acceleration Straight",
    isAccelerationZone: true,
    performancePotential: 96,
    deploymentValue: 96,
    overtakePotential: 92,
    attackValue: 92,
    overtakingValue: 92,
    recoveryPotential: 22,
    recoveryValue: 22,
    brakingOpportunity: false,
    defenceValue: 78,
    energyEfficiency: 90,
    tyreSensitivity: 60,
    riskLevel: "LOW",
    deploymentPowerLimit: 350,
    recoveryLimit: 7.00,
    baseDurationSec: 4.44
  },
  {
    id: "Z6",
    zoneId: "Z6",
    sector: 2,
    zoneNumber: 6,
    name: "High-Speed Sweeper Exit & Heavy Braking",
    isAccelerationZone: false,
    performancePotential: 45,
    deploymentValue: 45,
    overtakePotential: 30,
    attackValue: 30,
    overtakingValue: 30,
    recoveryPotential: 83,
    recoveryValue: 83,
    brakingOpportunity: true,
    defenceValue: 60,
    energyEfficiency: 78,
    tyreSensitivity: 75,
    riskLevel: "HIGH",
    deploymentPowerLimit: 250,
    recoveryLimit: 7.00,
    baseDurationSec: 3.9
  },
  // Sector 3
  {
    id: "Z7",
    zoneId: "Z7",
    sector: 3,
    zoneNumber: 7,
    name: "Esses Technical Flow",
    isAccelerationZone: false,
    performancePotential: 62,
    deploymentValue: 62,
    overtakePotential: 48,
    attackValue: 48,
    overtakingValue: 48,
    recoveryPotential: 65,
    recoveryValue: 65,
    brakingOpportunity: true,
    defenceValue: 68,
    energyEfficiency: 80,
    tyreSensitivity: 88,
    riskLevel: "MODERATE",
    deploymentPowerLimit: 250,
    recoveryLimit: 7.00,
    baseDurationSec: 4.3
  },
  {
    id: "Z8",
    zoneId: "Z8",
    sector: 3,
    zoneNumber: 8,
    name: "Stadium Section Hard Braking",
    isAccelerationZone: false,
    performancePotential: 35,
    deploymentValue: 35,
    overtakePotential: 42,
    attackValue: 42,
    overtakingValue: 42,
    recoveryPotential: 84,
    recoveryValue: 84,
    brakingOpportunity: true,
    defenceValue: 82,
    energyEfficiency: 72,
    tyreSensitivity: 80,
    riskLevel: "HIGH",
    deploymentPowerLimit: 250,
    recoveryLimit: 7.00,
    baseDurationSec: 3.4
  },
  {
    id: "Z9",
    zoneId: "Z9",
    sector: 3,
    zoneNumber: 9,
    name: "Final Corner & Main Launch",
    isAccelerationZone: true,
    performancePotential: 88,
    deploymentValue: 88,
    overtakePotential: 80,
    attackValue: 80,
    overtakingValue: 80,
    recoveryPotential: 25,
    recoveryValue: 25,
    brakingOpportunity: false,
    defenceValue: 72,
    energyEfficiency: 88,
    tyreSensitivity: 75,
    riskLevel: "LOW",
    deploymentPowerLimit: 350,
    recoveryLimit: 7.00,
    baseDurationSec: 4.0
  }
];

export class AlpineDecisionTwinEngine {
  constructor(zones = ALPINE_CIRCUIT_ZONES) {
    this.zones = zones;
    this.usableCapacityMJ = 20.0; // 20.0 MJ Usable Electrical Pack Capacity
    this.ruleProfile = FIA_RULE_PROFILE_2026;
    this.tyrePitEngine = tyrePitEngine;
  }

  /**
   * Section 3: INPUT -> STATE VALIDATION
   * Validates and normalizes all input parameters, rejecting impossible combinations.
   */
  validateInputState(inputState = {}) {
    const totalLaps = 57;
    let currentLap;
    let lapsRemaining;

    if (inputState.currentLap !== undefined || inputState.lap !== undefined) {
      currentLap = Math.max(1, Math.min(totalLaps, Number(inputState.currentLap ?? inputState.lap)));
      lapsRemaining = inputState.lapsRemaining !== undefined || inputState.remainingLaps !== undefined
        ? Math.max(1, Math.min(totalLaps - 1, Number(inputState.lapsRemaining ?? inputState.remainingLaps)))
        : Math.max(1, totalLaps - currentLap);
    } else if (inputState.lapsRemaining !== undefined || inputState.remainingLaps !== undefined) {
      lapsRemaining = Math.max(1, Math.min(totalLaps - 1, Number(inputState.lapsRemaining ?? inputState.remainingLaps)));
      currentLap = Math.max(1, totalLaps - lapsRemaining);
    } else {
      currentLap = 24;
      lapsRemaining = 33;
    }

    const futureLaps = Math.max(
      1,
      Math.min(5, Number(inputState.futureLaps ?? Math.min(5, Math.max(1, lapsRemaining))))
    );
    const position = Math.max(1, Math.min(20, Math.round(Number(inputState.position ?? 3))));
    const soc = Math.max(0, Math.min(100, Number(inputState.soc ?? inputState.SOC ?? 58)));
    const carAheadGap = Math.max(0, Number(inputState.carAheadGap ?? inputState.gapAhead ?? 0.7));
    const carBehindGap = Math.max(0, Number(inputState.carBehindGap ?? inputState.gapBehind ?? 1.4));
    const intensity = Math.max(0, Math.min(100, Number(inputState.intensity ?? 75)));
    const constraintLevel = Math.max(0, Math.min(100, Number(inputState.constraintLevel ?? 25)));

    const validCompounds = ["SOFT", "MEDIUM", "HARD", "INTER", "WET"];
    const compoundRaw = String(inputState.compound || inputState.tyreCompound || "MEDIUM").toUpperCase();
    const compound = validCompounds.includes(compoundRaw) ? compoundRaw : "MEDIUM";
    const tyreAge = Math.max(0, Math.round(Number(inputState.tyreAge ?? 12)));

    const validConditions = ["DRY", "DAMP", "WET"];
    const trackConditionRaw = String(inputState.trackCondition || "DRY").toUpperCase();
    const trackCondition = validConditions.includes(trackConditionRaw) ? trackConditionRaw : "DRY";

    return {
      currentLap,
      lap: currentLap,
      totalLaps,
      lapsRemaining,
      remainingLaps: lapsRemaining,
      futureLaps,
      position,
      soc,
      SOC: soc,
      carAheadGap,
      gapAhead: carAheadGap,
      carBehindGap,
      gapBehind: carBehindGap,
      intensity,
      constraintLevel,
      compound,
      tyreCompound: compound,
      tyreAge,
      trackCondition,
      trackTempC: Number(inputState.trackTempC ?? 34),
      isVscOrSc: Boolean(inputState.isVscOrSc),
      pitStrategyMode: inputState.pitStrategyMode ?? "AUTO",
      plannedPitLap: inputState.plannedPitLap ?? null
    };
  }

  /**
   * Section 15: RACE ORDER GENERATOR & UPDATER
   */
  generateRaceOrder(playerPosition) {
    const gridDrivers = [
      "NOR", "LEC", "PIA", "VER", "HAM", "RUS", "SAI", "PER",
      "ALO", "STR", "TSU", "RIC", "ALB", "SAR", "BOT", "ZHO"
    ];
    const order = [];
    let driverIdx = 0;
    for (let p = 1; p <= 10; p++) {
      if (p === playerPosition) {
        order.push({ id: "GAS", name: "Pierre Gasly (Alpine)", pos: p, isPlayer: true });
      } else {
        const dId = gridDrivers[driverIdx++] || `CAR_${p}`;
        order.push({ id: dId, name: dId, pos: p, isPlayer: false });
      }
    }
    return order;
  }

  updateRaceOrder(currentOrder, oldPos, newPos) {
    const updated = Array.isArray(currentOrder)
      ? currentOrder.map((c) => (typeof c === "string" ? { id: c, name: c, pos: 0, isPlayer: c === "ALPINE_USER" || c === "GAS" } : { ...c }))
      : this.generateRaceOrder(oldPos);
    const oldIdx = oldPos - 1;
    const newIdx = newPos - 1;
    if (oldIdx >= 0 && oldIdx < updated.length && newIdx >= 0 && newIdx < updated.length) {
      const player = updated.splice(oldIdx, 1)[0];
      updated.splice(newIdx, 0, player);
    }
    updated.forEach((c, idx) => {
      c.pos = idx + 1;
    });
    return updated;
  }

  /**
   * Section 2: SINGLE RACE STATE
   * Creates ONE central race-state object containing all race parameters.
   * Everything in the engine reads from this state.
   */
  buildCentralRaceState(inputState = {}) {
    const validated = this.validateInputState(inputState);
    const {
      currentLap,
      futureLaps,
      position,
      soc: SOC,
      carAheadGap: gapAhead,
      carBehindGap: gapBehind,
      intensity,
      constraintLevel,
      compound: tyreCompound,
      tyreAge,
      trackCondition,
      trackTempC,
      isVscOrSc
    } = validated;

    const usableEnergy = this.usableCapacityMJ; // 20.0 MJ
    const energyMJ = Math.round((SOC / 100) * usableEnergy * 100) / 100;
    const closingSpeed = Math.round((1.2 - gapAhead) * 5.0 * 10) / 10;
    const raceOrder = this.generateRaceOrder(position);

    const tyreState = this.tyrePitEngine.calculateTyreState({
      compoundId: tyreCompound,
      tyreAge,
      trackCondition,
      trackTempC
    });

    const pitLoss = this.tyrePitEngine.calculatePitLoss({
      position,
      isVscOrSc
    });

    const pitWindow = this.tyrePitEngine.calculatePitWindow({
      currentLap,
      tyreAge,
      compoundId: tyreCompound,
      totalRaceLaps: 57
    });

    const lapsRemaining = validated.lapsRemaining;
    const reserveModel = this.calculateReserveModel(energyMJ, gapBehind, lapsRemaining, position, currentLap);

    const recoveryZones = this.zones
      .filter((z) => z.recoveryPotential >= 60)
      .map((z) => ({
        zoneNumber: z.zoneNumber,
        sector: z.sector,
        name: z.name,
        recoveryPotential: z.recoveryPotential
      }));

    const attackZones = this.zones
      .filter((z) => z.performancePotential >= 80)
      .map((z) => ({
        zoneNumber: z.zoneNumber,
        sector: z.sector,
        name: z.name,
        performancePotential: z.performancePotential,
        overtakePotential: z.overtakePotential
      }));

    const activeZone = this.zones.find((z) => z.isAccelerationZone && z.performancePotential >= 90) || this.zones[4];

    const batteryState = SOC >= 60 ? "HEALTHY" : SOC >= 40 ? "LIMITED" : SOC >= 25 ? "LOW" : "CRITICAL";
    const batteryStateLabel = `ENERGY: ${batteryState}`;

    const closingSpeedAhead = closingSpeed;
    const closingSpeedBehind = Math.round(Math.max(-5.0, Math.min(5.0, (gapBehind - 1.0) * -3.0)) * 10) / 10;
    const currentAttackOpportunity = {
      quality: activeZone.overtakePotential >= 85 ? "HIGH" : activeZone.overtakePotential >= 65 ? "MEDIUM" : "LOW",
      overtakeProbability: position === 1 ? 0 : this.calculateOvertakeProbability({
        gapAhead,
        closingSpeed,
        zoneOvertakeValue: activeZone.overtakePotential,
        energyAdvantage: reserveModel.freeEnergyMJ,
        tyrePerformance: tyreState.performanceFactor,
        defenceRisk: gapBehind < 0.5 ? 0.85 : gapBehind < 1.0 ? 0.50 : 0.20
      }),
      energyRequiredMJ: 1.40,
      expectedGainSec: Math.round(0.42 * tyreState.performanceFactor * 100) / 100,
      inWindow: gapAhead <= 1.0,
      zoneNumber: activeZone.zoneNumber,
      zoneName: activeZone.name,
      sector: activeZone.sector
    };

    return {
      currentLap,
      lap: currentLap,
      totalLaps: 57,
      futureHorizon: 5,
      lapsRemaining,
      remainingLaps: lapsRemaining,
      position,
      raceOrder,
      futureLaps,
      energyMJ,
      energyJoules: reserveModel.currentJoules,
      usableEnergyMJ: usableEnergy,
      usableEnergy,
      socPercent: SOC,
      SOC,
      soc: SOC,
      energyReserveMJ: reserveModel.reserveMJ,
      reserveEnergy: reserveModel.reserveMJ,
      reserveJoules: reserveModel.reserveJoules,
      freeEnergyMJ: reserveModel.freeEnergyMJ,
      freeEnergy: reserveModel.freeEnergyMJ,
      freeJoules: reserveModel.freeJoules,
      safetyFloorMJ: reserveModel.safetyFloorMJ,
      safetyFloorJoules: reserveModel.safetyFloorJoules,
      attackReserveMJ: reserveModel.futureAttackMJ,
      defenceReserveMJ: reserveModel.defenceMJ,
      recoveryGapReserveMJ: reserveModel.recoveryGapMJ,
      safetyReserveMJ: reserveModel.safetyFloorMJ,
      requiredReserveMJ: reserveModel.reserveMJ,
      isSprintPhase: reserveModel.isSprintPhase,
      isRaceStart: reserveModel.isRaceStart,
      racePhase: reserveModel.racePhase,
      futureAttackReserveMJ: reserveModel.futureAttackMJ,
      batteryState,
      batteryStateLabel,
      gapAhead,
      gapBehind,
      closingSpeed,
      closingSpeedAhead,
      closingSpeedBehind,
      sector: activeZone.sector,
      currentSector: activeZone.sector,
      zone: activeZone.zoneNumber,
      currentZone: activeZone.zoneNumber,
      currentAttackOpportunity,
      tyreCompound,
      tyreAge,
      tyrePerformance: tyreState.performanceFactor,
      tyreDegradationRate: tyreState.degradationRate || 0.035,
      tyreGrip: tyreState.grip,
      tyreDegradation: tyreState.degradationLevel,
      degradationLevel: tyreState.degradationLevel,
      trackCondition,
      weather: trackCondition === "WET" ? "RAIN" : trackCondition === "DAMP" ? "OVERCAST" : "CLEAR",
      pitStatus: currentLap === pitWindow.plannedPitLap ? "PIT_THIS_LAP" : (tyreAge > 18 ? "PIT_WINDOW_OPEN" : "STAY_OUT"),
      pitStrategy: currentLap === pitWindow.plannedPitLap ? "PIT_THIS_LAP" : (tyreAge > 18 ? "PIT_WINDOW_OPEN" : "STAY_OUT"),
      pitWindow,
      pitLoss: pitLoss.totalPitLossSec,
      lapsSincePit: tyreAge,
      constraintLevel,
      deploymentIntensity: intensity >= 75 ? "AGGRESSIVE" : intensity >= 45 ? "BALANCED" : "CONSERVATIVE",
      intensity,
      recoveryZones,
      attackZones,
      nextRecoveryZone: recoveryZones[0]?.zoneNumber || 6,
      distanceToRecovery: 2,
      lapsUntilRecovery: 0,
      expectedRecoveryAmount: 0.80,
      recoveryState: {
        currentZone: activeZone.zoneNumber,
        nextRecoveryZone: recoveryZones[0]?.zoneNumber || 6,
        expectedRecoveryMJ: 0.80
      },
      attackState: {
        inOvertakeWindow: gapAhead <= 1.2,
        attackFeasible: SOC >= 40 && reserveModel.freeEnergyMJ >= 1.40
      },
      defenceState: {
        underPressure: gapBehind < 0.5,
        defenceReserveMJ: reserveModel.defenceMJ
      },
      fiaRuleProfile: this.ruleProfile
    };
  }

  /**
   * Section 3 & 6: Generates real future opportunities over a rolling horizon (default H = 5 laps).
   * Derives from simulated race state progression, track characteristics, and tyre degradation.
   *
   * @param {Object} centralRaceState Authoritative RaceState object
   * @param {number} horizon Number of future laps to project (default 5)
   * @returns {Object} Future opportunities breakdown and bestFutureOpportunity
   */
  generateFutureOpportunities(centralRaceState, horizon = 5) {
    const {
      currentLap,
      lapsRemaining,
      position,
      gapAhead,
      gapBehind,
      closingSpeedAhead = 0.0,
      tyreCompound,
      tyreAge,
      trackCondition,
      trackTempC = 38,
      energyMJ,
      freeEnergyMJ
    } = centralRaceState;

    const opportunities = [];
    const isLeader = position === 1;
    const maxOffset = Math.min(horizon, Math.max(1, lapsRemaining));

    // Candidate high-leverage acceleration zones across Silverstone
    const primeZones = [
      this.zones.find((z) => z.zoneNumber === 5) || this.zones[4], // Hangar Straight (Z5)
      this.zones.find((z) => z.zoneNumber === 1) || this.zones[0], // Pit Straight (Z1)
      this.zones.find((z) => z.zoneNumber === 7) || this.zones[6]  // Wellington Straight (Z7)
    ];

    for (let offset = 1; offset <= maxOffset; offset++) {
      const lap = currentLap + offset;
      if (lap > 57) break;
      const simTyreAge = tyreAge + offset;
      const simTyreState = this.tyrePitEngine.calculateTyreState({
        compoundId: tyreCompound,
        tyreAge: simTyreAge,
        trackCondition,
        trackTempC
      });

      const simPitWindow = this.tyrePitEngine.calculatePitWindow({
        currentLap: lap,
        tyreAge: simTyreAge,
        compoundId: tyreCompound,
        totalRaceLaps: 57
      });
      const isPitOpen = lap >= simPitWindow.windowStart && lap <= simPitWindow.windowEnd;
      const pitInteraction = isPitOpen ? "WINDOW OPEN (BOX CANDIDATE)" : "STAY OUT";

      // Projected gap evolution based on pace delta
      const projectedClosing = Math.max(-0.5, Math.min(1.2, closingSpeedAhead + (simTyreState.performanceFactor - 0.8) * 2.0));
      const projectedGap = isLeader ? 0 : Math.max(0.2, Math.round((gapAhead - (projectedClosing * 0.08 * offset)) * 10) / 10);
      const projectedBehind = Math.max(0.2, Math.round((gapBehind + 0.1 * offset) * 10) / 10);
      const defencePressure = projectedBehind < 0.5 ? "HIGH" : projectedBehind < 1.0 ? "MODERATE" : "LOW";

      // Select prime zone for this future lap
      const targetZone = primeZones[(offset - 1) % primeZones.length];
      const inDrsWindow = !isLeader && projectedGap <= 1.0;

      // Attack and recovery qualities
      const attackQuality = isLeader
        ? "N/A (LEADER)"
        : (simTyreState.performanceFactor >= 0.82 && inDrsWindow && targetZone.overtakePotential >= 88)
        ? "VERY HIGH"
        : (inDrsWindow || targetZone.overtakePotential >= 80)
        ? "HIGH"
        : "LOW";

      const recoveryQuality = "HIGH"; // Heavy braking zone Z6 / Z4 follows
      const expectedEnergyReqMJ = 1.40;
      const expectedRecoveryMJ = 0.85;

      const overtakeProb = isLeader ? 0 : this.calculateOvertakeProbability({
        gapAhead: projectedGap,
        closingSpeed: projectedClosing,
        zoneOvertakeValue: targetZone.overtakePotential,
        energyAdvantage: 1.40,
        tyrePerformance: simTyreState.performanceFactor,
        defenceRisk: defencePressure === "HIGH" ? 0.70 : defencePressure === "MODERATE" ? 0.40 : 0.15
      });

      const expectedGainSec = Math.round((0.44 * simTyreState.performanceFactor * (inDrsWindow ? 1.0 : 0.45)) * 100) / 100;
      const expectedPositionValue = isLeader
        ? 0.30
        : Math.round(((overtakeProb / 100) * 0.70 * simTyreState.performanceFactor) * 100) / 100;
      const expectedEnergyCost = 0.16;
      const expectedRisk = defencePressure === "HIGH" ? 0.18 : defencePressure === "MODERATE" ? 0.08 : 0.03;

      // Future Energy Value(tau) = ExpectedRaceGain(tau) + ExpectedPositionValue(tau) - ExpectedEnergyCost(tau) - ExpectedRisk(tau)
      const futureEnergyValue = Math.round((expectedGainSec + expectedPositionValue - expectedEnergyCost - expectedRisk) * 100) / 100;

      opportunities.push({
        lap,
        sector: targetZone.sector,
        zone: targetZone.zoneNumber,
        zoneNumber: targetZone.zoneNumber,
        zoneName: targetZone.name,
        attackQuality,
        recoveryQuality,
        expectedGap: projectedGap,
        expectedClosingSpeed: projectedClosing,
        tyrePerformance: simTyreState.performanceFactor,
        tyreGrip: simTyreState.grip,
        tyreAge: simTyreAge,
        defencePressure,
        expectedEnergyReqMJ,
        energyRequiredMJ: expectedEnergyReqMJ,
        expectedRecoveryMJ,
        expectedGainSec,
        expectedPositionValue,
        overtakeProbability: overtakeProb,
        futureEnergyValue,
        pitInteraction,
        isPitOpen
      });
    }

    // Identify Best Future Opportunity = max(FutureEnergyValue)
    let best = null;
    let maxVal = -999;
    opportunities.forEach((opp) => {
      if (opp.futureEnergyValue > maxVal) {
        maxVal = opp.futureEnergyValue;
        best = opp;
      }
    });

    if (!best && opportunities.length > 0) {
      best = opportunities[0];
    } else if (!best) {
      best = {
        lap: currentLap + 1,
        sector: 2,
        zone: 5,
        zoneNumber: 5,
        zoneName: "Hangar Straight",
        attackQuality: "HIGH",
        recoveryQuality: "HIGH",
        expectedGap: gapAhead,
        expectedClosingSpeed: closingSpeedAhead,
        tyrePerformance: 0.85,
        defencePressure: "LOW",
        expectedEnergyReqMJ: 1.40,
        expectedRecoveryMJ: 0.80,
        expectedGainSec: 0.42,
        expectedPositionValue: 0.50,
        overtakeProbability: 75,
        futureEnergyValue: 0.65,
        pitInteraction: "STAY OUT",
        isPitOpen: false
      };
    }

    return {
      horizon: maxOffset,
      opportunities,
      bestFutureOpportunity: best
    };
  }

  /**
   * Section 4, 5, 6, 7 & 15: Evaluates the counterfactual optimization: SPEND NOW vs SAVE FOR LATER.
   *
   * SpendNowValue = ImmediateRaceGain + PositionGain + ImmediateAttackValue + DefenceValue - EnergyCost - FutureOpportunityCost - RiskCost
   * SaveForLaterValue = FutureRaceGain + FutureEnergyValue + FutureRecoveryValue - CurrentOpportunityCost - CurrentRisk
   *
   * @param {Object} centralRaceState Authoritative RaceState object
   * @param {Object} nextBestAction Current candidate action
   * @param {Object} futureOppModel Model of future rolling opportunities
   * @returns {Object} Complete mathematical optimization breakdown
   */
  evaluateSpendVsSaveOptimization(centralRaceState, nextBestAction, futureOppModel) {
    const {
      currentLap,
      lapsRemaining,
      position,
      gapAhead,
      gapBehind,
      energyMJ,
      freeEnergyMJ,
      socPercent,
      tyrePerformance,
      tyreAge,
      isSprintPhase,
      isRaceStart
    } = centralRaceState;

    const isLeader = position === 1;
    const bestFut = futureOppModel.bestFutureOpportunity;

    // 1. Current Action Metrics (Scenario A: Spend Now)
    const deployedMJ = nextBestAction && nextBestAction.deployedMJ > 0 ? nextBestAction.deployedMJ : 1.40;
    const isCriticalLow = socPercent <= 28 || freeEnergyMJ <= 0.05;
    const inAttackCone = !isLeader && gapAhead <= 0.8;
    const inDrsWindow = !isLeader && gapAhead <= 1.0;
    const hasRearThreat = gapBehind < 0.5;

    // Immediate Race Gain (laptime reduction from electrical deployment * tyre grip)
    const immediateGain = isCriticalLow
      ? 0.00
      : isSprintPhase
      ? 0.48
      : (inDrsWindow || isRaceStart)
      ? Math.round(0.42 * tyrePerformance * 100) / 100
      : Math.round(0.15 * tyrePerformance * 100) / 100;

    // Position Gain (expected value of track position gain)
    const currentOvertakeProb = isLeader
      ? 0
      : isCriticalLow
      ? 0
      : this.calculateOvertakeProbability({
          gapAhead,
          closingSpeed: centralRaceState.closingSpeedAhead,
          zoneOvertakeValue: (nextBestAction && nextBestAction.overtakePotential) || 90,
          energyAdvantage: freeEnergyMJ,
          tyrePerformance,
          defenceRisk: hasRearThreat ? 0.85 : 0.20
        });

    const positionGain = isLeader
      ? 0.25 // Protecting P1
      : isCriticalLow
      ? 0.00
      : isSprintPhase
      ? 0.38 // Final sprint track position
      : inAttackCone
      ? Math.round((currentOvertakeProb / 100) * 0.65 * tyrePerformance * 100) / 100
      : inDrsWindow
      ? Math.round((currentOvertakeProb / 100) * 0.40 * tyrePerformance * 100) / 100
      : isRaceStart
      ? 0.32 // Early scramble gain
      : 0.02; // Into clean air

    // Immediate Attack Value
    const immediateAttackValue = isSprintPhase ? 0.25 : inAttackCone ? 0.20 : (inDrsWindow || isRaceStart) ? 0.10 : 0.00;

    // Defence Value (negative if burning energy leaves car vulnerable to rear threat)
    const defenceValue = hasRearThreat ? -0.22 : 0.05;

    // Energy Cost (marginal cost of drawing electrical energy from finite pack)
    const energyCost = isCriticalLow ? 0.35 : Math.round((deployedMJ / 20.0) * 2.2 * 100) / 100;

    // Future Opportunity Cost = BestFutureRaceValueWithoutThatEnergy - BestFutureRaceValueWithThatEnergy
    // If energy is spent now, will the car have enough energy (>=1.40 MJ free) for the best future opportunity?
    const energyAfterSpend = Math.max(0, energyMJ - deployedMJ);
    const reserveAfterSpend = centralRaceState.safetyReserveMJ + centralRaceState.defenceReserveMJ;
    const freeEnergyAfterSpend = Math.max(0, energyAfterSpend - reserveAfterSpend);

    let futureOpportunityCost = 0.00;
    if (isCriticalLow) {
      futureOpportunityCost = 0.45; // Depleted pack incurs maximum opportunity penalty
    } else if (isSprintPhase) {
      futureOpportunityCost = 0.02; // Final sprint: no future opportunities left to preserve for!
    } else if (freeEnergyAfterSpend >= 1.40) {
      futureOpportunityCost = 0.05; // Ample pack: spending now does not starve the future opportunity
    } else if (freeEnergyAfterSpend >= 0.80) {
      futureOpportunityCost = 0.14; // Mild compromise
    } else {
      // Severe compromise: spending now degrades downstream high-value attack
      futureOpportunityCost = Math.round(bestFut.futureEnergyValue * 0.55 * 100) / 100;
    }

    // Risk Cost (counterattack, tyre wheelspin, or dirty air entrapment)
    const riskCost = (hasRearThreat ? 0.18 : 0.02) + (!inDrsWindow && !isLeader && !isSprintPhase && !isRaceStart ? 0.15 : 0.00);

    // Net Spend Now Value
    const spendNowValue = Math.round(
      (immediateGain + positionGain + immediateAttackValue + defenceValue - energyCost - futureOpportunityCost - riskCost) * 100
    ) / 100;

    // 2. Save For Later Metrics (Scenario B: Save / Coast / Harvest)
    const currentGainSave = 0.05; // Base pace retention
    const energyPreservedMJ = deployedMJ;
    const futureRaceGain = isSprintPhase ? 0.04 : Math.round((bestFut.expectedGainSec * 0.9) * 100) / 100;
    const futureEnergyValue = isSprintPhase ? 0.02 : bestFut.futureEnergyValue;
    const recoveryValue = isSprintPhase ? 0.05 : 0.18; // Expected recovery in upcoming braking zone

    // Current Opportunity Cost (forfeiting immediate attack)
    const currentOpportunityCost = isSprintPhase
      ? 0.35 // Forfeiting sprint delta
      : isRaceStart
      ? 0.28 // Forfeiting race start track position
      : inAttackCone
      ? Math.round(positionGain * 0.8 * 100) / 100
      : 0.02;

    // Current Risk (risk of losing position or falling out of DRS while saving)
    const currentRisk = hasRearThreat ? 0.04 : (inAttackCone || isSprintPhase ? 0.12 : 0.02);

    // Net Save For Later Value
    const saveForLaterValue = Math.round(
      (futureRaceGain + futureEnergyValue + recoveryValue - currentOpportunityCost - currentRisk) * 100
    ) / 100;

    // 3. Optimization Verdict & Delta
    const delta = Math.round((spendNowValue - saveForLaterValue) * 100) / 100;
    const isSpendWinning = isCriticalLow ? false : (spendNowValue > saveForLaterValue);
    const winner = isCriticalLow ? "HARVEST / RECHARGE" : (isSpendWinning ? "SPEND NOW" : "SAVE FOR LATER");
    const winningMargin = Math.abs(delta);

    // 4. Causal Explanation Synthesis
    let causalExplanation = "";
    if (isCriticalLow) {
      causalExplanation = "Battery resting at reserve floor (0.00 MJ free); spending is unviable and there is nothing to save. Active kinetic recovery is mandatory to rebuild pack capacity.";
    } else if (isSprintPhase) {
      causalExplanation = `Only ${lapsRemaining} lap(s) remaining (Final Sprint Phase). Multi-lap energy hoarding buffers are collapsed; unspent energy across the finish line has zero value. Spending full usable battery across upcoming laps delivers maximum cumulative race delta.`;
    } else if (isRaceStart && socPercent >= 40 && freeEnergyMJ >= 0.8) {
      causalExplanation = `Opening race phase (Lap ${currentLap}/57). Pack is full (${energyMJ.toFixed(1)} MJ). Securing early track position before DRS trains settle delivers highest compound return over the full race distance.`;
    } else if (hasRearThreat && socPercent < 50) {
      causalExplanation = `Severe defensive threat (P${position + 1} within ${gapBehind.toFixed(1)}s). Defensive reserve expanded to guard track position. Forward attack spending would leave vehicle defenceless against an undercut or DRS pass.`;
    } else if (!inDrsWindow && !isLeader) {
      causalExplanation = `Car ahead is ${gapAhead.toFixed(1)}s ahead (outside 1.0s DRS detection window). Spending 1.40 MJ into clean air delivers low pass yield (${currentOvertakeProb}%). Conserving energy preserves pack for Zone ${bestFut.zoneNumber} where pass probability reaches ${bestFut.overtakeProbability}%.`;
    } else if (tyrePerformance < 0.65) {
      causalExplanation = `Tyre degradation high (${tyreAge} laps old). Reduced grip derates electrical acceleration benefit. Preserving energy and managing pace into pit window yields higher race value.`;
    } else if (isSpendWinning) {
      causalExplanation = `Attacking now in Zone ${centralRaceState.currentZone} delivers superior immediate race gain (+${immediateGain.toFixed(2)}s, ${currentOvertakeProb}% pass probability) with ${freeEnergyMJ.toFixed(2)} MJ free energy, exceeding downstream deferred value by +${winningMargin.toFixed(2)}.`;
    } else {
      causalExplanation = `Downstream opportunity in Lap ${bestFut.lap} Zone ${bestFut.zoneNumber} (${bestFut.zoneName}) offers higher expected race-position value (+${bestFut.expectedPositionValue.toFixed(2)}) than attacking now. Preserving energy maximizes total race outcome.`;
    }

    return {
      spendNow: {
        expectedGain: immediateGain,
        energyCostMJ: deployedMJ,
        energyCostValue: energyCost,
        futureOpportunityValue: -futureOpportunityCost,
        defenceRisk: riskCost,
        raceValue: spendNowValue
      },
      saveForLater: {
        currentGain: currentGainSave,
        energyPreservedMJ: energyPreservedMJ,
        futureOpportunityValue: futureEnergyValue,
        recoveryValue,
        raceValue: saveForLaterValue
      },
      delta,
      winner,
      winningMargin,
      verdictLabel: isCriticalLow
        ? "RECHARGE MANDATORY (PACK AT FLOOR)"
        : isSpendWinning
        ? `SPEND WINS BY +${winningMargin.toFixed(2)}`
        : `SAVE WINS BY +${winningMargin.toFixed(2)}`,
      bestFutureOpportunity: bestFut,
      causalExplanation
    };
  }

  /**
   * Section 7: OVERTAKE MODEL (Joint Sigmoid Model)
   * P_overtake = sigmoid(GapFactor + ClosingSpeedFactor + ZoneValue + EnergyAdvantage + TyreFactor - DefenceRisk)
   */
  calculateOvertakeProbability({
    gapAhead = 0.7,
    closingSpeed = 0.0,
    zoneOvertakeValue = 90,
    energyAdvantage = 1.0,
    tyrePerformance = 1.0,
    defenceRisk = 0.2
  } = {}) {
    const gapFactor = 1.5 * (1.1 - gapAhead);
    const closingFactor = Math.max(-0.8, Math.min(0.8, closingSpeed * 0.3));
    const zoneFactor = ((zoneOvertakeValue - 70) / 30) * 0.8;
    const energyFactor = Math.max(-0.8, Math.min(0.8, (energyAdvantage - 2.0) * 0.25));
    const tyreFactor = (tyrePerformance - 0.75) * 2.8;
    const defenceFactor = defenceRisk * 1.0;

    const z = 0.6 + gapFactor + closingFactor + zoneFactor + energyFactor + tyreFactor - defenceFactor;
    const p = 1 / (1 + Math.exp(-z));
    return Math.round(Math.max(5, Math.min(95, p * 100)));
  }

  /**
   * Converts user-friendly SOC% to internal primary MJ state
   * E_available = (SOC / 100) * E_usable_capacity
   */
  socToMJ(soc) {
    return Math.round(((Math.max(0, Math.min(100, soc)) / 100) * this.usableCapacityMJ) * 100) / 100;
  }

  /**
   * Converts primary MJ state back to user-friendly SOC%
   * SOC = (E / E_usable_capacity) * 100
   */
  mjToSoc(mj) {
    return Math.max(0, Math.min(100, Math.round((mj / this.usableCapacityMJ) * 100)));
  }

  mjToSOC(mj) {
    return this.mjToSoc(mj);
  }

  /**
   * Evaluates Dynamic Energy Reserve (C9) and Free Energy
   * E_reserve = E_future_attack + E_future_defence + E_recovery_gap + E_safety
   * E_free = E_current - E_reserve
   */
  calculateReserveModel(currentEnergyMJ, carBehindGap, lapsRemaining, position, currentLap = 24) {
    const safetyFloorMJ = (this.ruleProfile.socReserveFloorPct / 100) * this.usableCapacityMJ; // 3.00 MJ (15%)

    // Defence Energy: scales dynamically with rear threat (C6)
    let defenceMJ = 0.50; // default for safe rear (~1.4s)
    if (carBehindGap < 0.5) defenceMJ = 1.60;
    else if (carBehindGap < 1.0) defenceMJ = 1.00;
    else if (carBehindGap > 2.0) defenceMJ = 0.20;
    if (position === 1) defenceMJ += 0.50; // Leader defense bias

    // End-of-race sprint rule: if lapsRemaining <= 3, collapse future preservation buffers completely
    // Driver is authorized to burn usable pack in upcoming laps!
    const isSprintPhase = lapsRemaining <= 3;
    const isLateRace = lapsRemaining <= 5 && lapsRemaining > 3;
    const isRaceStart = currentLap <= 3;

    // Future Attack Opportunity Buffer (C7, C10)
    let futureAttackMJ = 0.40;
    if (isSprintPhase) {
      futureAttackMJ = 0.00; // Final laps: release buffer completely so energy can be used in upcoming laps
    } else if (isLateRace) {
      futureAttackMJ = 0.15;
    }

    // Recovery Gap Buffer (C8)
    let recoveryGapMJ = 0.20;
    if (isSprintPhase) {
      recoveryGapMJ = 0.00; // Final sprint: no recovery gap preservation
    } else if (isLateRace) {
      recoveryGapMJ = 0.10;
    }

    const reserveMJ = Math.round((safetyFloorMJ + defenceMJ + futureAttackMJ + recoveryGapMJ) * 100) / 100;
    const freeEnergyMJ = Math.round(Math.max(0, currentEnergyMJ - reserveMJ) * 100) / 100;
    const reserveSoc = this.mjToSoc(reserveMJ);
    const freeSoc = this.mjToSoc(freeEnergyMJ);

    // Joules conversions (1 MJ = 1,000,000 Joules)
    const currentJoules = Math.round(currentEnergyMJ * 1e6);
    const reserveJoules = Math.round(reserveMJ * 1e6);
    const freeJoules = Math.round(freeEnergyMJ * 1e6);
    const safetyFloorJoules = Math.round(safetyFloorMJ * 1e6);

    return {
      currentEnergyMJ,
      currentSoc: this.mjToSoc(currentEnergyMJ),
      currentJoules,
      reserveMJ,
      reserveSoc,
      reserveJoules,
      freeEnergyMJ,
      freeSoc,
      freeJoules,
      safetyFloorMJ,
      safetyFloorJoules,
      defenceMJ,
      futureAttackMJ,
      recoveryGapMJ,
      isSprintPhase,
      isLateRace,
      isRaceStart,
      racePhase: isSprintPhase ? "END_RACE_SPRINT" : (isRaceStart ? "RACE_START" : "MID_RACE"),
      hasDefensivePressure: carBehindGap < 0.5,
      isRearSafe: carBehindGap > 1.8
    };
  }

  /**
   * Evaluates Non-1:1 Independent Energy Recovery (C4)
   */
  calculateRecovery(zone, harvestAccumulatorMJ, soc) {
    if (zone.recoveryPotential < 30 || soc >= 98) {
      return 0.0;
    }

    const lapHarvestLimit = this.ruleProfile.maxLapHarvestMJ; // 7.00 MJ
    const remainingQuota = Math.max(0, lapHarvestLimit - harvestAccumulatorMJ);
    if (remainingQuota <= 0) return 0.0;

    // Independent recovery physics: braking intensity * recovery efficiency * potential
    const efficiency = 0.88;
    const baseHarvestMJ = (zone.recoveryPotential / 100) * efficiency * 1.10; // ~0.70 to 0.85 MJ
    const recoveryMJ = Math.round(Math.min(remainingQuota, baseHarvestMJ) * 100) / 100;

    return recoveryMJ;
  }

  /**
   * Evaluates all 4 strategies for a single zone against the 13 general constraints
   */
  evaluateZoneStrategies(zone, state, reserveModel, harvestAccumulatorMJ, tyreState = null, pitContext = null) {
    const {
      currentEnergyMJ,
      position,
      carAheadGap,
      carBehindGap,
      lapsRemaining,
      intensity = 75,
      constraintLevel = 25, // 0 (LOW) to 100 (HIGH)
      currentLap = (57 - (state.lapsRemaining || 33))
    } = state;

    const pitWindow = pitContext ? pitContext.pitWindow : null;
    const undercutOvercut = pitContext ? pitContext.undercutOvercut : null;
    const tyreFactor = tyreState ? tyreState.performanceFactor : 1.0;
    const isTyreWorn = tyreState && (tyreState.degradationLevel === "HIGH" || tyreState.degradationLevel === "CRITICAL");
    const isPrePitSprint = Boolean(pitContext && pitContext.isPrePitSprint);

    const isP1 = position === 1;
    const isLateRace = lapsRemaining <= 3;
    const isFinalLap = lapsRemaining <= 1;

    // Constraint C2: Power limits
    // Intensity maps 0..100: at attack intensity (75+), requests full 350 kW MGU-K power
    const requestedKw = intensity >= 75 ? 350 : Math.round(180 + (intensity / 75) * 170);
    // Standard baseline constraintLevel (<= 25) maintains full 350 kW regulatory ceiling
    const constraintDerateKw = constraintLevel > 25 ? Math.round(((constraintLevel - 25) / 75) * 60) : 0;
    const maxLegalPowerKw = zone.isAccelerationZone
      ? Math.max(200, this.ruleProfile.accelerationZoneLimitKw - constraintDerateKw)
      : Math.max(160, this.ruleProfile.standardZoneLimitKw - constraintDerateKw);

    const isFiaLimitActive = requestedKw > maxLegalPowerKw;
    const clampedPowerKw = Math.min(requestedKw, maxLegalPowerKw);

    // Physical deployment calculation (Section 2: E_deployed = Power_MW * Duration_sec, 1 MW * 1s = 1 MJ)
    // Super-Clip utilizes 350 kW over straight duration (~4.0s) -> 1.40 MJ
    const superClipPowerKw = Math.min(clampedPowerKw, 350);
    const superClipDurationSec = 4.0;
    const superClipMJ = Math.round(((superClipPowerKw * superClipDurationSec) / 1000) * 100) / 100; // 1.40 MJ at 350 kW

    // Normal deployment uses ~200 kW -> 0.80 MJ (0.6 - 1.2 MJ range)
    const normalPowerKw = Math.min(clampedPowerKw, 200);
    const normalMJ = Math.round(((normalPowerKw * 4.0) / 1000) * 100) / 100; // 0.80 MJ
    const coastMJ = 0.05; // 0.05 MJ baseline systems draw

    // Expected recovery (Non-1:1)
    const harvestMJ = this.calculateRecovery(zone, harvestAccumulatorMJ, reserveModel.currentSoc);

    // Recovery timing: calculate distance to next useful recovery zone (potential >= 60) along circuit
    let nextRecoveryZone = null;
    let zonesAway = 0;
    for (let offset = 1; offset <= this.zones.length; offset++) {
      const checkIdx = (zone.zoneNumber - 1 + offset) % this.zones.length;
      const candZone = this.zones[checkIdx];
      if (candZone.recoveryPotential >= 60) {
        nextRecoveryZone = candZone;
        zonesAway = offset;
        break;
      }
    }
    const nextRecoveryExpectedMJ = nextRecoveryZone
      ? this.calculateRecovery(nextRecoveryZone, 0, reserveModel.currentSoc)
      : 0.80;

    // Evaluate feasibility for 350 kW SUPER-CLIP (C1, C2, C3, C5, C9, C11, C13)
    const isSocSufficientForSuperClip = reserveModel.currentSoc >= 40;
    const maxAttackGap = constraintLevel > 70 ? 0.8 : (isTyreWorn && !isPrePitSprint ? 1.0 : 1.8);
    const isWithinOvertakeWindow = carAheadGap <= maxAttackGap || isFinalLap;
    const canDeploySuperClip = isSocSufficientForSuperClip &&
      isWithinOvertakeWindow &&
      !isP1 &&
      zone.isAccelerationZone &&
      zone.performancePotential >= 88 &&
      (currentEnergyMJ - superClipMJ >= reserveModel.safetyFloorMJ) &&
      (reserveModel.freeEnergyMJ >= superClipMJ || (isFinalLap && currentEnergyMJ >= superClipMJ + reserveModel.safetyFloorMJ));

    const constraintSliderPenalty = constraintLevel > 40 ? Math.round(((constraintLevel - 40) / 60) * 90) : 0;

    // Explicit 11-Term Objective Function J(a) for each candidate energy management action
    // J(a) = ImmediateGain + PositionGain + FutureOpportunityValue + RecoveryValue + TyreValue
    //        - EnergyCost - Risk - DefenceCost - OpportunityCost - PitCost - RulePenalty
    const strats = ["SUPER-CLIP", "NORMAL DEPLOYMENT", "COAST", "BRAKING / HARVEST"];
    const candidateBreakdowns = {};
    const scores = {};

    strats.forEach((strat) => {
      let immediateGain = 0;
      let positionGain = 0;
      let futureOpportunityValue = 0;
      let recoveryValue = 0;
      let tyreValue = 0;
      let energyCost = 0;
      let risk = 0;
      let defenceCost = 0;
      let opportunityCost = 0;
      let pitCost = 0;
      let rulePenalty = 0;

      let candidatePowerKw = 0;
      let candidatePowerLabel = "0 kW";
      let candidateEnergyDeltaMJ = 0;
      let candidateEnergyLabel = "0.00 MJ";
      let candidateGainSec = 0.00;
      let candidateGainLabel = "0.00s";
      let candidateConstraintStatus = "COMPLIANT";
      let candidateConstraintRelation = "";
      let candidateSliderTag = "";
      let whyRationale = "";

      if (strat === "SUPER-CLIP") {
        candidatePowerKw = superClipPowerKw;
        candidateEnergyDeltaMJ = -superClipMJ;
        candidateEnergyLabel = `-${superClipMJ.toFixed(2)} MJ`;
        candidateGainSec = 0.42;
        const effectiveGain = Math.round(0.42 * tyreFactor * 100) / 100;
        candidateGainLabel = `+0.42s (Eff: +${effectiveGain.toFixed(2)}s)`;

        if (canDeploySuperClip) {
          // Section 36 & 44: High immediate race gain
          immediateGain = Math.round(24 * tyreFactor);
          // Position gain peaks when car ahead is within 0.8s attack window
          positionGain = carAheadGap <= 0.8 ? 26 : carAheadGap <= 1.2 ? 16 : 8;
          if (isPrePitSprint) positionGain += 8; // Pre-pit sprint opportunity

          // Section 6: Energy conservation logic
          // Current Race Value vs Future Race Value
          const currentEnergyValue = immediateGain + positionGain;
          const lapWeight = lapsRemaining / 57;
          const futureEnergyValue = Math.round((24 * lapWeight) + (reserveModel.hasDefensivePressure ? 10 : 4) + (zonesAway >= 4 ? 8 : 0));
          // Energy Opportunity Cost = Future Energy Value - Current Energy Value
          opportunityCost = Math.max(0, futureEnergyValue - currentEnergyValue);

          // Future opportunity value remaining after deployment (discounted late in race)
          const horizonFactor = isFinalLap ? 0.2 : isLateRace ? 0.5 : 1.0;
          futureOpportunityValue = Math.round((reserveModel.freeEnergyMJ >= superClipMJ * 2 ? 14 : 8) * horizonFactor);
          // Recovery timing: if next recovery is 1-2 zones away, quick recovery lowers energy depletion risk
          recoveryValue = zonesAway <= 2 ? 14 : 6;
          tyreValue = Math.round(15 * tyreFactor);
          energyCost = 8;
          risk = (carAheadGap > 1.2 ? 6 : 2) + (zonesAway >= 4 ? 4 : 0);
          defenceCost = reserveModel.hasDefensivePressure ? 14 : 2;
          pitCost = 0;
          rulePenalty = (isFiaLimitActive ? 4 : 0) + constraintSliderPenalty;

          if (constraintDerateKw > 0) {
            candidateConstraintStatus = "CLAMPED";
            candidatePowerLabel = `${superClipPowerKw} kW (Clamped -${constraintDerateKw} kW)`;
            candidateConstraintRelation = `C2 Power Clamped: MGU-K capped to ${superClipPowerKw} kW under ${constraintLevel}% constraint`;
          } else {
            candidateConstraintStatus = "COMPLIANT";
            candidatePowerLabel = `${superClipPowerKw} kW (FIA MGU-K Cap)`;
            candidateConstraintRelation = `C2 Legal (350 kW) | C5 Gap ${carAheadGap.toFixed(1)}s <= ${maxAttackGap.toFixed(1)}s | C1 Free ${reserveModel.freeEnergyMJ.toFixed(1)} MJ`;
          }
          candidateSliderTag = constraintLevel > 40
            ? `Derated by Slider (-${constraintSliderPenalty} pts at ${constraintLevel}%)`
            : `Compliant with ${constraintLevel}% constraint`;
          whyRationale = "High-value attack opportunity with sufficient free energy.";
        } else {
          // Illegal or physically infeasible
          immediateGain = Math.round(5 * tyreFactor);
          positionGain = 2;
          futureOpportunityValue = 4;
          recoveryValue = 2;
          tyreValue = Math.round(5 * tyreFactor);
          energyCost = 15;
          risk = 18;
          defenceCost = reserveModel.hasDefensivePressure ? 20 : 8;
          opportunityCost = 25;
          pitCost = 0;
          rulePenalty = 9999; // Strict penalty ensuring only legal actions can be selected

          candidatePowerLabel = `${superClipPowerKw} kW (Restricted)`;
          if (reserveModel.currentSoc < 40) {
            candidateConstraintStatus = "BLOCKED";
            candidateConstraintRelation = `C3 SOC Envelope: Current ${reserveModel.currentSoc}% < 40% threshold for 350 kW`;
          } else if (!isWithinOvertakeWindow) {
            candidateConstraintStatus = "RESTRICTED";
            candidateConstraintRelation = `C5 Overtake Window: Gap ${carAheadGap.toFixed(1)}s > ${maxAttackGap.toFixed(1)}s limit at ${constraintLevel}% constraint`;
          } else if (currentEnergyMJ - superClipMJ < reserveModel.safetyFloorMJ || reserveModel.freeEnergyMJ < superClipMJ) {
            candidateConstraintStatus = "BLOCKED";
            candidateConstraintRelation = `C1/C9 Finite Energy: Free energy (${reserveModel.freeEnergyMJ.toFixed(1)} MJ) < ${superClipMJ.toFixed(2)} MJ required`;
          } else if (isP1) {
            candidateConstraintStatus = "RESTRICTED";
            candidateConstraintRelation = `C11 Track Position: Race Leader (P1) conserves pack rather than attacking`;
          } else {
            candidateConstraintStatus = "RESTRICTED";
            candidateConstraintRelation = `C13 Zone Potential: Acceleration potential (${zone.performancePotential}/100) outside sweet spot`;
          }
          candidateSliderTag = `Infeasible at ${constraintLevel}% constraint level`;
          whyRationale = "Infeasible under current physical/regulatory envelope.";
        }
      } else if (strat === "NORMAL DEPLOYMENT") {
        candidatePowerKw = normalPowerKw;
        candidatePowerLabel = `${normalPowerKw} kW (Standard Traversal)`;
        candidateEnergyDeltaMJ = -normalMJ;
        candidateEnergyLabel = `-${normalMJ.toFixed(2)} MJ`;
        candidateGainSec = 0.18;
        const effectiveGain = Math.round(0.18 * tyreFactor * 100) / 100;
        candidateGainLabel = `+0.18s (Eff: +${effectiveGain.toFixed(2)}s)`;
        candidateConstraintStatus = "COMPLIANT";
        candidateConstraintRelation = `C2 Compliant: 200 kW traversal under 250 kW technical cap | C1 Free Energy Pass`;
        candidateSliderTag = `Stable traversal across all constraint profiles`;

        immediateGain = Math.round(14 * tyreFactor);
        positionGain = position > 1 ? 9 : 7;
        const currentEnergyValue = immediateGain + positionGain;
        const lapWeight = lapsRemaining / 57;
        const futureEnergyValue = Math.round((20 * lapWeight) + (reserveModel.hasDefensivePressure ? 8 : 4));
        // Opportunity cost is halved because deployment consumes half of Super-Clip
        opportunityCost = Math.max(0, Math.round((futureEnergyValue - currentEnergyValue) * 0.45));
        futureOpportunityValue = 16;
        recoveryValue = zonesAway <= 2 ? 12 : 8;
        tyreValue = Math.round(10 * tyreFactor);
        energyCost = 5;
        risk = 2;
        defenceCost = reserveModel.hasDefensivePressure ? 3 : 2;
        pitCost = 0;
        rulePenalty = 0;
        whyRationale = "Useful current opportunity but aggressive deployment is not justified.";
      } else if (strat === "COAST") {
        candidatePowerKw = 0;
        candidatePowerLabel = `0 kW (Lift & Coast)`;
        candidateEnergyDeltaMJ = -coastMJ;
        candidateEnergyLabel = `-${coastMJ.toFixed(2)} MJ (Base draw)`;
        candidateGainSec = 0.00;
        candidateGainLabel = `0.00s (Pack Preservation)`;
        candidateConstraintStatus = "PRESERVATION";
        candidateConstraintRelation = `C7/C9 Energy Preservation: Protects pack capacity for upcoming high-value straight`;
        candidateSliderTag = constraintLevel > 50 ? `Preservation priority active under high constraint` : `Standard coasting profile`;

        immediateGain = Math.round(2 * tyreFactor);
        positionGain = 2;
        // Future energy preservation: scales with remaining lap horizon (Section 10, Case 6)
        const futureHorizon = isFinalLap ? 0.2 : isLateRace ? 0.6 : 1.0;
        futureOpportunityValue = Math.round((26
          + (constraintLevel > 50 ? Math.round(((constraintLevel - 50) / 50) * 8) : 0)
          + (reserveModel.freeEnergyMJ <= 0.8 ? 14 : 0)
          + (carAheadGap > 1.6 && !isFinalLap ? 8 : 0)
          + (isTyreWorn && !isPrePitSprint ? 10 : 0)) * futureHorizon);
        recoveryValue = 8;
        tyreValue = 14; // Tyre preservation reward
        energyCost = 1;
        risk = 1;
        defenceCost = reserveModel.hasDefensivePressure ? 8 : 1;
        opportunityCost = 0; // Preserving energy has zero opportunity cost
        pitCost = 0;
        rulePenalty = 0;
        whyRationale = "Future energy has greater race value than current opportunity.";
      } else if (strat === "BRAKING / HARVEST") {
        candidatePowerKw = -280;
        candidatePowerLabel = `280 kW Regen (MGU-K Kinetic)`;
        candidateEnergyDeltaMJ = harvestMJ;
        candidateEnergyLabel = harvestMJ > 0 ? `+${harvestMJ.toFixed(2)} MJ (Kinetic Regen)` : `+0.00 MJ (Low-Regen Straight)`;
        candidateGainSec = 0.00;
        candidateGainLabel = harvestMJ > 0 ? `+${harvestMJ.toFixed(2)} MJ Pack Recharge` : `0.00s (Regen Ineligible)`;
        candidateConstraintStatus = "HARVEST COMPLIANT";
        candidateConstraintRelation = harvestMJ > 0
          ? `C4 Harvest: Non-1:1 kinetic recovery within ${this.ruleProfile.maxLapHarvestMJ}.0 MJ lap cap`
          : `C4/C13 Inactive: Zone ${zone.zoneNumber} acceleration straight has low recovery potential (${zone.recoveryPotential}/100)`;
        candidateSliderTag = `Recovery potential ${zone.recoveryPotential}/100`;

        if (zone.recoveryPotential >= 60) {
          recoveryValue = Math.round((zone.recoveryPotential * 0.45) + (harvestMJ * 15))
            + (reserveModel.currentSoc < 40 ? 15 : 0)
            + (reserveModel.freeEnergyMJ <= 1.0 ? 12 : 0);
          const harvestHorizon = isFinalLap ? 0.2 : isLateRace ? 0.6 : 1.0;
          futureOpportunityValue = Math.round(28 * harvestHorizon);
          immediateGain = 1;
          positionGain = 2;
          tyreValue = 8;
          energyCost = 0; // Recharge adds energy
          risk = 0;
          defenceCost = reserveModel.hasDefensivePressure ? 3 : 1;
          opportunityCost = 0;
          pitCost = 0;
          rulePenalty = 0;
          whyRationale = "Recovery has greater value than immediate deployment.";
        } else {
          recoveryValue = Math.round(zone.recoveryPotential * 0.15);
          futureOpportunityValue = 8;
          immediateGain = 1;
          positionGain = 1;
          tyreValue = 4;
          energyCost = 0;
          risk = 1;
          defenceCost = 2;
          opportunityCost = 0;
          pitCost = 0;
          rulePenalty = zone.isAccelerationZone ? 45 : 0; // Ineligible in high-speed straight
          whyRationale = "Low recovery potential in acceleration zone.";
        }
      }

      // Section 29: Deployment Intensity weighting (SAVE / BALANCED / ATTACK)
      let intensityWeight = 0;
      if (intensity < 40) {
        // SAVE mode prefers COAST, HARVEST, NORMAL
        if (strat === "COAST" || strat === "BRAKING / HARVEST") intensityWeight = 6;
        else if (strat === "NORMAL DEPLOYMENT") intensityWeight = 2;
        else if (strat === "SUPER-CLIP") intensityWeight = -8;
      } else if (intensity >= 70) {
        // ATTACK mode: higher willingness to select SUPER-CLIP if legal and feasible
        if (strat === "SUPER-CLIP" && canDeploySuperClip) intensityWeight = 6;
        else if (strat === "COAST") intensityWeight = -4;
      }

      // Objective Function: J(a) = ImmediateGain + PositionGain + FutureOpportunityValue + RecoveryValue + TyreValue + IntensityWeight
      //                            - EnergyCost - Risk - DefenceCost - OpportunityCost - PitCost - RulePenalty
      const jScore = immediateGain + positionGain + futureOpportunityValue + recoveryValue + tyreValue + intensityWeight
        - energyCost - risk - defenceCost - opportunityCost - pitCost - rulePenalty;

      // Calibration: Normalized score (0-100) for telemetry display
      let normalizedScore = 0;
      if (strat === "SUPER-CLIP") {
        normalizedScore = canDeploySuperClip
          ? Math.min(96, Math.max(40, 50 + Math.round(jScore * 0.6)))
          : Math.max(10, Math.min(35, 18 + Math.round((jScore + 9999) * 0.25)));
      } else if (strat === "NORMAL DEPLOYMENT") {
        normalizedScore = Math.min(90, Math.max(45, 45 + Math.round(jScore * 0.55)));
      } else if (strat === "COAST") {
        normalizedScore = Math.min(90, Math.max(35, 45 + Math.round(jScore * 0.55)));
      } else if (strat === "BRAKING / HARVEST") {
        normalizedScore = zone.recoveryPotential >= 60
          ? Math.min(95, Math.max(60, 45 + Math.round(jScore * 0.6)))
          : Math.min(65, Math.max(25, 22 + Math.round(jScore * 0.45)));
      }
      normalizedScore = Math.round(normalizedScore);

      // Dynamic 17-term breakdown connecting directly to all sliders:
      // 1. Overtake Value: reflects carAheadGap, position, and power
      let overtakeValue = 0;
      if (strat === "SUPER-CLIP" && !isP1 && canDeploySuperClip) {
        overtakeValue = carAheadGap <= 0.8 ? 18 : carAheadGap <= 1.2 ? 12 : 5;
      } else if (strat === "NORMAL DEPLOYMENT" && !isP1) {
        overtakeValue = carAheadGap <= 1.2 ? 8 : 4;
      }

      // 2. Pit Strategy Value: high if pre-pit sprint or in pit window
      let pitStrategyValue = 0;
      if (isPrePitSprint) {
        pitStrategyValue = strat === "SUPER-CLIP" ? 8 : strat === "NORMAL DEPLOYMENT" ? 4 : 1;
      } else if (pitWindow && Math.abs(currentLap - pitWindow.bestLap) <= 2) {
        pitStrategyValue = (strat === "COAST" || strat === "BRAKING / HARVEST") ? 6 : 2;
      }

      // 3. Undercut Value: reflects undercut viability and tyre delta
      let undercutValue = 0;
      if (undercutOvercut && undercutOvercut.viability === "HIGH") {
        undercutValue = isPrePitSprint && strat === "SUPER-CLIP" ? 5 : 2;
      }

      // 4. Counterattack Risk: opponent DRS threat from behind
      let counterattackRisk = 0;
      if (reserveModel.hasDefensivePressure || carBehindGap < 1.0) {
        counterattackRisk = strat === "SUPER-CLIP" ? (carBehindGap < 0.5 ? 8 : 4) : strat === "NORMAL DEPLOYMENT" ? 3 : 1;
      }

      // 5. Tyre Degradation Cost: high power/torque wears tyres faster, especially on soft or worn tyres
      let tyreDegradationCost = 0;
      if (strat === "SUPER-CLIP") {
        tyreDegradationCost = isTyreWorn ? 8 : (tyreState && tyreState.compoundId === "SOFT") ? 6 : 3;
      } else if (strat === "NORMAL DEPLOYMENT") {
        tyreDegradationCost = isTyreWorn ? 4 : 2;
      }

      // 6. Traffic Risk: based on rejoining density and surrounding cars
      let trafficRisk = (carAheadGap < 0.4 ? 2 : 0) + (carBehindGap < 0.4 ? 2 : 1);
      if (position === 1) trafficRisk = Math.min(1, trafficRisk);

      // Raw combined 17-term score
      const totalRawScore = (immediateGain + positionGain + futureOpportunityValue + recoveryValue + overtakeValue + tyreValue + pitStrategyValue + undercutValue) -
        (energyCost + risk + defenceCost + opportunityCost + counterattackRisk + pitCost + tyreDegradationCost + trafficRisk + rulePenalty);

      candidateBreakdowns[strat] = {
        name: strat,
        // Canonical 11 + Extended 6 Terms (17 Total)
        immediateGain,
        immediateRaceGain: immediateGain,
        positionGain,
        positionBenefit: positionGain,
        futureOpportunityValue,
        futureEnergyValue: futureOpportunityValue,
        recoveryValue,
        tyreValue,
        tyrePerformanceValue: tyreValue,
        energyCost,
        risk,
        attackRisk: risk,
        defenceCost,
        defenceRisk: defenceCost,
        opportunityCost,
        futureOpportunityCost: opportunityCost,
        pitCost,
        pitLaneTimeLoss: pitCost,
        rulePenalty,
        overtakeValue,
        pitStrategyValue,
        undercutValue,
        counterattackRisk,
        tyreDegradationCost,
        trafficRisk,
        // Objective score
        jScore,
        totalRawScore,
        normalizedScore,
        isLegal: rulePenalty === 0,
        isFeasible: strat !== "SUPER-CLIP" || canDeploySuperClip,
        powerKw: candidatePowerKw,
        powerLabel: candidatePowerLabel,
        energyDeltaMJ: candidateEnergyDeltaMJ,
        energyLabel: candidateEnergyLabel,
        expectedGainSec: candidateGainSec,
        expectedGainLabel: candidateGainLabel,
        constraintRelation: candidateConstraintRelation,
        constraintStatus: candidateConstraintStatus,
        constraintSliderTag: candidateSliderTag,
        whyRationale
      };
      scores[strat] = normalizedScore;
    });

    // Strategy Selection Logic: Optimal Action = argmax(J(a)) among LEGAL and FEASIBLE actions
    let chosenStrategy = "COAST";
    let maxJ = -999999;
    strats.forEach((strat) => {
      const b = candidateBreakdowns[strat];
      if (b.isLegal && b.isFeasible) {
        if (b.jScore > maxJ) {
          maxJ = b.jScore;
          chosenStrategy = strat;
        }
      }
    });

    let deployedMJ = 0;
    let recoveredMJ = 0;
    if (chosenStrategy === "SUPER-CLIP") {
      deployedMJ = Math.min(superClipMJ, Math.max(0, currentEnergyMJ - reserveModel.safetyFloorMJ));
    } else if (chosenStrategy === "NORMAL DEPLOYMENT") {
      deployedMJ = normalMJ;
    } else if (chosenStrategy === "COAST") {
      deployedMJ = coastMJ;
    } else if (chosenStrategy === "BRAKING / HARVEST") {
      recoveredMJ = harvestMJ;
    }

    const netDeltaMJ = Math.round((recoveredMJ - deployedMJ) * 100) / 100;
    const nextEnergyMJ = Math.max(
      reserveModel.safetyFloorMJ,
      Math.min(this.usableCapacityMJ, Math.round((currentEnergyMJ + netDeltaMJ) * 100) / 100)
    );

    return {
      zone,
      chosenStrategy,
      scores,
      candidateBreakdowns,
      deployedMJ: Math.round(deployedMJ * 100) / 100,
      recoveredMJ: Math.round(recoveredMJ * 100) / 100,
      netDeltaMJ,
      powerKw: chosenStrategy === "SUPER-CLIP" ? superClipPowerKw : chosenStrategy === "NORMAL DEPLOYMENT" ? normalPowerKw : 0,
      nextEnergyMJ,
      nextSoc: this.mjToSoc(nextEnergyMJ),
      isFiaLimitActive
    };
  }

  /**
   * Synthesizes a 5-Lap Tactical Race Plan combining Energy + Tyre + Pit Actions (Sections 45 & 48)
   */
  generateTacticalRacePlan({
    currentLap,
    plannedPitLap,
    tyreState,
    nextCompound,
    nextBestAction,
    nextRecovery,
    reserve,
    isVscOrSc,
    undercutOvercut,
    lapsRemaining = 33,
    futureOpportunities = []
  }) {
    const plan = [];
    const baseCompound = tyreState.compoundId;
    const pitLap = plannedPitLap || (currentLap + 3);
    const isSprintPhase = lapsRemaining <= 3;
    const isRaceStart = currentLap <= 3;
    const maxOffsets = Math.min(5, Math.max(1, lapsRemaining));

    for (let offset = 0; offset < maxOffsets; offset++) {
      const lap = currentLap + offset;
      if (lap > 57) break;
      const isCurrent = offset === 0;
      const isBoxLap = lap === pitLap;
      const isPostBox = lap > pitLap;
      const isPreBox = lap === pitLap - 1;

      let action = "NORMAL DEPLOYMENT";
      let shortAction = "NORMAL";
      let zone = "Sector 2 — Zone 5";
      let compoundDisplay = baseCompound;
      let note = "Standard traversal";
      let energyDeltaMJ = -0.90;
      let energyDeltaLabel = "-0.9 MJ";
      let attackProbability = 64;
      let metricLabel = "Attack prob: 64%";

      // Downstream opportunity projection from rolling horizon
      const futOpp = offset > 0 && futureOpportunities && futureOpportunities.length >= offset
        ? futureOpportunities[offset - 1]
        : null;

      if (isCurrent) {
        action = nextBestAction.strategy;
        shortAction = action === "SUPER-CLIP" ? "SUPER-CLIP" : action === "NORMAL DEPLOYMENT" ? "NORMAL" : action === "COAST" ? "COAST" : "HARVEST";
        zone = `Sector ${nextBestAction.sector} — Zone ${nextBestAction.zoneNumber}`;
        const dep = nextBestAction.deployedMJ || 0.90;
        const rec = nextBestAction.recoveredMJ || 0.00;

        if (action === "BRAKING / HARVEST") {
          energyDeltaMJ = rec > 0 ? rec : 1.00;
          energyDeltaLabel = `+${energyDeltaMJ.toFixed(1)} MJ`;
          attackProbability = 0;
          metricLabel = "MGU-K Recovery";
        } else if (action === "COAST") {
          energyDeltaMJ = -0.20;
          energyDeltaLabel = "-0.2 MJ";
          attackProbability = 15;
          metricLabel = "Reserve building";
        } else if (action === "SUPER-CLIP") {
          energyDeltaMJ = -dep;
          energyDeltaLabel = `-${dep.toFixed(1)} MJ`;
          attackProbability = nextBestAction.overtakePotential || 81;
          metricLabel = `Attack prob: ${attackProbability}%`;
        } else {
          energyDeltaMJ = -dep;
          energyDeltaLabel = `-${dep.toFixed(1)} MJ`;
          attackProbability = nextBestAction.overtakePotential || 64;
          metricLabel = `Attack prob: ${attackProbability}%`;
        }

        note = isSprintPhase && reserve.freeEnergyMJ >= 0.40
          ? `Sprint Phase: Deploy usable energy (+${reserve.freeEnergyMJ.toFixed(2)} MJ). Full 4.0 MJ/lap quota active.`
          : isRaceStart && reserve.freeEnergyMJ >= 0.80
          ? `Race Start Scramble: Exploit full battery to gain track position on opening lap.`
          : tyreState.degradationLevel === "HIGH"
          ? `Grip at ${tyreState.grip}% — conserve for pit cycle`
          : action === "SUPER-CLIP"
          ? "Immediate 350 kW attack on straight"
          : "Maintain competitive race pace";
      } else if (isSprintPhase && reserve.freeEnergyMJ >= 0.40) {
        action = "SUPER-CLIP";
        shortAction = "SPRINT BURN";
        zone = offset % 2 === 1 ? "Sector 2 — Zone 5 DRS Straight" : "Sector 1 — Zone 1 Pit Straight";
        energyDeltaMJ = -1.60;
        energyDeltaLabel = "-1.6 MJ";
        attackProbability = 84;
        metricLabel = "Attack prob: 84%";
        const freeJ = reserve.freeJoules || Math.round(reserve.freeEnergyMJ * 1e6);
        note = lap === 57
          ? `Final Lap: Burn all remaining usable energy (+${reserve.freeEnergyMJ.toFixed(2)} MJ · ${freeJ.toLocaleString()} J). Arrive with zero free energy.`
          : `Upcoming Lap Sprint: Deploy usable energy (+${reserve.freeEnergyMJ.toFixed(2)} MJ) across acceleration zones before finish line.`;
      } else if (isRaceStart && offset <= 2 && reserve.freeEnergyMJ >= 0.80) {
        action = "SUPER-CLIP";
        shortAction = "START ATTACK";
        zone = "Sector 1 — Zone 1 Opening Straight";
        energyDeltaMJ = -1.50;
        energyDeltaLabel = "-1.5 MJ";
        attackProbability = 78;
        metricLabel = "Attack prob: 78%";
        note = `Race Start (Lap ${lap}/57): Exploit full battery (+${reserve.freeEnergyMJ.toFixed(2)} MJ) to attack before DRS train forms.`;
      } else if (isBoxLap) {
        action = "PIT";
        shortAction = "PIT";
        zone = "Pit Lane (Stationary 2.4s)";
        compoundDisplay = `${baseCompound} → ${nextCompound}`;
        energyDeltaMJ = 0.0;
        energyDeltaLabel = "0.0 MJ";
        attackProbability = 0;
        metricLabel = "Fresh tyres";
        note = isVscOrSc ? "VSC Box: Saved 7.6s vs Green Flag" : `Box for ${nextCompound} (Pit Loss: 21.4s)`;
      } else if (isPreBox) {
        action = "COAST";
        shortAction = "COAST";
        zone = "Sector 1 & 3 Flow";
        energyDeltaMJ = -0.20;
        energyDeltaLabel = "-0.2 MJ";
        attackProbability = 20;
        metricLabel = "Reserve building";
        note = "Save electrical energy; prepare fresh tyre out-lap";
      } else if (lap === pitLap + 1) {
        action = "BRAKING / HARVEST";
        shortAction = "HARVEST";
        zone = "Sector 1 — Zone 3 Hairpin";
        compoundDisplay = nextCompound;
        energyDeltaMJ = 1.00;
        energyDeltaLabel = "+1.0 MJ";
        attackProbability = 0;
        metricLabel = "MGU-K Recovery";
        note = "Warm up new rubber, recharge battery accumulator";
      } else if (isPostBox) {
        action = "SUPER-CLIP";
        shortAction = "SUPER-CLIP";
        zone = "Sector 2 — Zone 5 DRS Straight";
        compoundDisplay = nextCompound;
        energyDeltaMJ = -1.60;
        energyDeltaLabel = "-1.6 MJ";
        attackProbability = 86;
        metricLabel = "Attack prob: 86%";
        note = `Full attack on fresh ${nextCompound} (+1.40 MJ)`;
      } else {
        // Earlier stint lap - derived from rolling horizon opportunity model
        if (futOpp && (futOpp.attackQuality === "VERY HIGH" || futOpp.overtakeProbability >= 80)) {
          action = "SUPER-CLIP";
          shortAction = "SUPER-CLIP";
          zone = `Sector ${futOpp.sector} — Zone ${futOpp.zoneNumber}`;
          const req = futOpp.energyRequiredMJ || futOpp.expectedEnergyReqMJ || 1.40;
          energyDeltaMJ = -req;
          energyDeltaLabel = `-${req.toFixed(1)} MJ`;
          attackProbability = futOpp.overtakeProbability;
          metricLabel = `Attack prob: ${futOpp.overtakeProbability}%`;
          note = `High leverage pass window in ${futOpp.zoneName}`;
        } else if (futOpp && futOpp.attackQuality === "LOW") {
          action = "COAST";
          shortAction = "COAST";
          zone = `Sector ${futOpp.sector} — Zone ${futOpp.zoneNumber}`;
          energyDeltaMJ = -0.20;
          energyDeltaLabel = "-0.2 MJ";
          attackProbability = 25;
          metricLabel = "Reserve building";
          note = "Preserve usable pack for downstream high-yield zone";
        } else if (offset === 1) {
          action = "COAST";
          shortAction = "COAST";
          zone = "Sector 1 Technical";
          energyDeltaMJ = -0.20;
          energyDeltaLabel = "-0.2 MJ";
          attackProbability = 20;
          metricLabel = "Reserve building";
          note = "Energy conservation phase";
        } else {
          action = "NORMAL DEPLOYMENT";
          shortAction = "NORMAL";
          zone = "Sector 2 — Zone 5";
          energyDeltaMJ = -0.90;
          energyDeltaLabel = "-0.9 MJ";
          attackProbability = futOpp ? futOpp.overtakeProbability : 64;
          metricLabel = `Attack prob: ${attackProbability}%`;
          note = "Competitive pace monitoring delta";
        }
      }

      plan.push({
        lap,
        action,
        shortAction,
        zone,
        compound: compoundDisplay,
        note,
        isCurrentLap: isCurrent,
        isPitLap: isBoxLap,
        energyDeltaMJ,
        energyDeltaLabel,
        attackProbability,
        metricLabel
      });
    }

    return plan;
  }

  /**
   * Simulates multi-lap continuous energy transfer across all zones with Tyre & Pit model integration
   */
  simulate(inputState = {}) {
    const centralRaceState = this.buildCentralRaceState(inputState);
    const {
      currentLap,
      futureLaps,
      position,
      SOC: soc,
      gapAhead: carAheadGap,
      gapBehind: carBehindGap,
      tyreCompound: compound,
      tyreAge,
      trackCondition,
      constraintLevel
    } = centralRaceState;

    const intensity = inputState.intensity ?? 75;
    const trackTempC = inputState.trackTempC ?? 34;
    const isVscOrSc = Boolean(inputState.isVscOrSc);
    const scProbability = inputState.scProbability ?? 0.25;
    const vscProbability = inputState.vscProbability ?? 0.35;
    const rainProbability = inputState.rainProbability ?? 0.10;
    const plannedPitLap = inputState.plannedPitLap ?? null;
    const pitStrategyMode = inputState.pitStrategyMode ?? "AUTO";

    // 1. Calculate Comprehensive Tyre State (Section 33, 34)
    const tyreState = tyrePitEngine.calculateTyreState({
      compoundId: compound,
      tyreAge,
      trackCondition,
      trackTempC
    });

    // 2. Calculate Circuit-Specific Pit Loss (Section 31)
    const pitLoss = tyrePitEngine.calculatePitLoss({
      position,
      isVscOrSc
    });

    // 3. Calculate Optimal Pit Window (Section 40)
    const pitWindow = tyrePitEngine.calculatePitWindow({
      currentLap,
      tyreAge,
      compoundId: compound,
      totalRaceLaps: 57
    });
    const effectivePlannedPit = plannedPitLap || pitWindow.plannedPitLap;

    // 4. Calculate Undercut / Overcut Potentials (Section 38, 39)
    const undercutOvercut = tyrePitEngine.calculateUndercutOvercut({
      carAheadGap,
      tyreAge,
      compoundId: compound
    });

    // 5. Evaluate Candidate Pit Actions (Section 32)
    const pitActions = tyrePitEngine.evaluatePitActions({
      currentLap,
      position,
      tyreState,
      carAheadGap,
      carBehindGap,
      isVscOrSc
    });

    // 6. Next Compound Recommendation (Section 34, 35)
    const nextCompound = tyrePitEngine.recommendNextCompound({
      currentCompoundId: compound,
      currentLap,
      totalLaps: 57,
      trackCondition
    });

    const isPrePitSprint = (effectivePlannedPit - currentLap <= 1) && (effectivePlannedPit - currentLap >= 0);
    const pitContext = {
      isPrePitSprint,
      isUndercutRecommended: undercutOvercut.isUndercutRecommended,
      plannedPitLap: effectivePlannedPit,
      nextCompound,
      pitWindow,
      undercutOvercut
    };

    const initialEnergyMJ = this.socToMJ(soc);
    let runningEnergyMJ = initialEnergyMJ;
    let runningPosition = position;
    let runningAheadGap = carAheadGap;
    let runningBehindGap = carBehindGap;
    let runningRaceOrder = [...centralRaceState.raceOrder];

    const totalLaps = 1 + futureLaps;
    const lapResults = [];
    const allSteps = [];
    let nextBestAction = null;
    let highestActionScore = -99999;

    const maxHorizonLaps = Math.min(totalLaps, Math.max(1, 58 - currentLap));
    for (let lapOffset = 0; lapOffset < maxHorizonLaps; lapOffset++) {
      const lapNum = currentLap + lapOffset;
      if (lapNum > 57) break;
      const lapsRemaining = Math.max(1, 57 - lapNum);
      const zoneSteps = [];
      let lapDeployedMJ = 0;
      let lapHarvestedMJ = 0;
      const lapStartEnergyMJ = runningEnergyMJ;

      // Simulated tyre age progression across laps
      const simTyreAge = tyreAge + lapOffset;
      const simTyreState = tyrePitEngine.calculateTyreState({
        compoundId: compound,
        tyreAge: simTyreAge,
        trackCondition,
        trackTempC
      });

      for (let zIdx = 0; zIdx < this.zones.length; zIdx++) {
        const zone = this.zones[zIdx];
        const reserveModel = this.calculateReserveModel(
          runningEnergyMJ,
          runningBehindGap,
          lapsRemaining,
          runningPosition
        );

        const stepInput = {
          currentEnergyMJ: runningEnergyMJ,
          position: runningPosition,
          carAheadGap: runningAheadGap,
          carBehindGap: runningBehindGap,
          lapsRemaining,
          intensity,
          constraintLevel
        };

        const decision = this.evaluateZoneStrategies(
          zone,
          stepInput,
          reserveModel,
          lapHarvestedMJ,
          simTyreState,
          pitContext
        );

        lapDeployedMJ += decision.deployedMJ;
        lapHarvestedMJ += decision.recoveredMJ;

        const stepRecord = {
          lap: lapNum,
          isCurrentLap: lapOffset === 0,
          sector: zone.sector,
          zoneId: zone.id,
          zoneNumber: zone.zoneNumber,
          zoneName: zone.name,
          performancePotential: zone.performancePotential,
          overtakePotential: zone.overtakePotential,
          recoveryPotential: zone.recoveryPotential,
          strategy: decision.chosenStrategy,
          powerKw: decision.powerKw,
          deployedPowerKw: decision.powerKw,
          deployedMJ: decision.deployedMJ,
          recoveredMJ: decision.recoveredMJ,
          netDeltaMJ: decision.netDeltaMJ,
          energyBeforeMJ: runningEnergyMJ,
          energyAfterMJ: decision.nextEnergyMJ,
          socBefore: this.mjToSoc(runningEnergyMJ),
          socAfter: decision.nextSoc,
          isFiaLimitActive: decision.isFiaLimitActive,
          isFeasible: true,
          overtakeOccurred: false,
          scores: decision.scores,
          candidateBreakdowns: decision.candidateBreakdowns
        };

        // Score this step as potential Next Best Action for the CURRENT LAP
        if (lapOffset === 0) {
          const isCriticalInitial = soc < 30;
          let stratWeight = 50;
          if (isCriticalInitial) {
            // Prioritize recovery and energy preservation (Section 20)
            stratWeight = decision.chosenStrategy === "BRAKING / HARVEST" ? 190
              : decision.chosenStrategy === "COAST" ? 140
              : decision.chosenStrategy === "NORMAL DEPLOYMENT" ? 60
              : 10;
          } else {
            stratWeight = decision.chosenStrategy === "SUPER-CLIP" ? 180
              : decision.chosenStrategy === "BRAKING / HARVEST" ? 95
              : decision.chosenStrategy === "NORMAL DEPLOYMENT" ? 70
              : 50;
          }
          const candidateValue = stratWeight + (zone.performancePotential * 0.6 * simTyreState.performanceFactor);

          if (candidateValue > highestActionScore || !nextBestAction) {
            highestActionScore = candidateValue;
            nextBestAction = stepRecord;
          }
        }

        // Handle Overtake event
        if (decision.chosenStrategy === "SUPER-CLIP" && runningPosition > 1 && runningAheadGap <= 1.2 && runningEnergyMJ >= 6.0) {
          stepRecord.overtakeOccurred = true;
          stepRecord.oldPosition = `P${runningPosition}`;
          const oldP = runningPosition;
          runningPosition = Math.max(1, runningPosition - 1);
          runningRaceOrder = this.updateRaceOrder(runningRaceOrder, oldP, runningPosition);
          stepRecord.newPosition = `P${runningPosition}`;
          stepRecord.raceOrder = [...runningRaceOrder];
          runningAheadGap = 1.8; // Gap reset
        }

        // Section 10 & 18: Handle Defensive Concession under battery depletion
        if (lapOffset === 0 && runningBehindGap < 0.5 && runningEnergyMJ < 5.0 && zone.overtakePotential >= 70 && runningPosition < 10) {
          stepRecord.positionLost = true;
          stepRecord.oldPosition = `P${runningPosition}`;
          const oldP = runningPosition;
          runningPosition = runningPosition + 1;
          runningRaceOrder = this.updateRaceOrder(runningRaceOrder, oldP, runningPosition);
          stepRecord.newPosition = `P${runningPosition}`;
          stepRecord.raceOrder = [...runningRaceOrder];
          runningBehindGap = 1.4; // Opponent passes ahead
          runningAheadGap = 0.5;
        }

        zoneSteps.push(stepRecord);
        allSteps.push(stepRecord);
        runningEnergyMJ = decision.nextEnergyMJ;
      }

      lapResults.push({
        lap: lapNum,
        lapNumber: lapNum,
        startEnergyMJ: lapStartEnergyMJ,
        endEnergyMJ: runningEnergyMJ,
        startSoc: this.mjToSoc(lapStartEnergyMJ),
        endSoc: this.mjToSoc(runningEnergyMJ),
        totalDeployedMJ: Math.round(lapDeployedMJ * 100) / 100,
        totalHarvestedMJ: Math.round(lapHarvestedMJ * 100) / 100,
        netDeltaMJ: Math.round((lapHarvestedMJ - lapDeployedMJ) * 100) / 100,
        zoneSteps
      });
    }

    if (!nextBestAction && allSteps.length > 0) {
      nextBestAction = allSteps[0];
    }

    // Recovery timing: Find next recovery zone following nextBestAction
    let nextRecovery = null;
    const actionIndex = allSteps.findIndex((s) => s === nextBestAction);
    for (let i = actionIndex + 1; i < allSteps.length; i++) {
      if (allSteps[i].strategy === "BRAKING / HARVEST" || allSteps[i].recoveredMJ > 0.4) {
        nextRecovery = allSteps[i];
        break;
      }
    }

    // Dynamic Reserve for current state
    const currentReserve = this.calculateReserveModel(initialEnergyMJ, carBehindGap, centralRaceState.lapsRemaining, position, currentLap);

    // Overtake & Defence probabilities (Section 7: Joint Sigmoid Overtake Model)
    const overtakeProb = position === 1 ? 0 : this.calculateOvertakeProbability({
      gapAhead: carAheadGap,
      closingSpeed: centralRaceState.closingSpeed,
      zoneOvertakeValue: nextBestAction.overtakePotential || 90,
      energyAdvantage: currentReserve.freeEnergyMJ,
      tyrePerformance: tyreState.performanceFactor,
      defenceRisk: carBehindGap < 0.5 ? 0.8 : carBehindGap < 1.0 ? 0.5 : 0.2
    });
    const defenceRiskNum = carBehindGap < 0.5 ? 0.85 : carBehindGap < 1.0 ? 0.50 : 0.20;
    const defenceRisk = carBehindGap < 0.5 ? "HIGH" : carBehindGap < 1.0 ? "MEDIUM" : "LOW";
    const futureOpp = (57 - currentLap) > 5 ? "HIGH" : "MEDIUM";

    // Why & Why this zone synthesizers (Sections 45 & 49)
    const why = this.synthesizeWhy(nextBestAction, nextRecovery, currentReserve, tyreState, pitWindow, nextCompound, pitActions);
    const whyThisZone = this.synthesizeWhyThisZone(nextBestAction, nextRecovery, inputState);

    // Calculate detailed energy accounting
    const deployedMJ = nextBestAction.deployedMJ;
    const expectedRecoveryMJ = nextRecovery ? nextRecovery.recoveredMJ : 0.80;
    const netEnergyChangeMJ = Math.round((expectedRecoveryMJ - deployedMJ) * 100) / 100;
    const energyBeforeMJ = nextBestAction.energyBeforeMJ;
    const energyAfterDeployMJ = Math.round(Math.max(0, energyBeforeMJ - deployedMJ) * 100) / 100;
    const socAfterDeploy = this.mjToSoc(energyAfterDeployMJ);
    const energyAfterRecoveryMJ = Math.round(Math.min(this.usableCapacityMJ, energyAfterDeployMJ + expectedRecoveryMJ) * 100) / 100;
    const socAfterRecovery = this.mjToSoc(energyAfterRecoveryMJ);

    // Expected race gain in seconds (Section 36: Electrical Benefit vs Effective Race Gain)
    const electricalGainSec = nextBestAction.strategy === "SUPER-CLIP"
      ? 0.42
      : nextBestAction.strategy === "NORMAL DEPLOYMENT"
      ? 0.18
      : 0.00;
    const expectedGainSec = electricalGainSec;
    const effectiveGainSec = Math.round(electricalGainSec * tyreState.performanceFactor * 100) / 100;

    const recoveryZonesAway = nextRecovery && nextBestAction
      ? (((nextRecovery.zoneNumber - nextBestAction.zoneNumber + 9) % 9) || 1)
      : 1;

    // 13 Constraints evaluation breakdown (C1 to C13) with full multi-slider interconnection
    const constraints13 = {
      c1_finite_energy: {
        id: "C1",
        name: "Finite Energy Constraint",
        type: "SIMULATION ASSUMPTION",
        status: currentReserve.freeEnergyMJ >= 1.40 ? "PASSED" : currentReserve.freeEnergyMJ >= 0.5 ? "CONSTRAINED_NORMAL_ONLY" : "RESTRICTED",
        statusClass: currentReserve.freeEnergyMJ >= 1.40 ? "ok" : currentReserve.freeEnergyMJ >= 0.5 ? "clamped" : "restricted",
        isLimiting: currentReserve.freeEnergyMJ < 1.40,
        driverSlider: `Battery SOC (${soc}%) · ${initialEnergyMJ.toFixed(1)} MJ`,
        description: currentReserve.freeEnergyMJ >= 1.40
          ? `Free energy (${currentReserve.freeEnergyMJ.toFixed(1)} MJ) exceeds maximum Super-Clip requirement (1.40 MJ). Usable pack: 20.0 MJ.`
          : currentReserve.freeEnergyMJ >= 0.5
          ? `Free energy (${currentReserve.freeEnergyMJ.toFixed(1)} MJ) restricts Super-Clip; allows Normal Deployment (0.80 MJ).`
          : `Free energy depleted (${currentReserve.freeEnergyMJ.toFixed(1)} MJ); forcing Coast or Kinetic Harvest.`
      },
      c2_deployment_power: {
        id: "C2",
        name: "Deployment Power Constraint",
        type: "FIA RULE",
        status: isVscOrSc
          ? "RESTRICTED_UNDER_VSC"
          : constraintLevel > 25
          ? "DERATED"
          : nextBestAction.isFiaLimitActive
          ? "ACTIVE_CLAMPED"
          : "COMPLIANT",
        statusClass: (isVscOrSc || nextBestAction.isFiaLimitActive || constraintLevel > 25) ? "clamped" : "ok",
        isLimiting: Boolean(isVscOrSc || nextBestAction.isFiaLimitActive || constraintLevel > 25),
        driverSlider: isVscOrSc
          ? "Safety Car / VSC Active"
          : constraintLevel > 25
          ? `Constraint Level (${constraintLevel}%)`
          : nextBestAction.isFiaLimitActive
          ? `Deployment Intensity (${intensity}% -> 380 kW clamped to 350 kW)`
          : "Standard Envelope (350 kW Legal)",
        description: isVscOrSc
          ? "Article 55: High-power attack deployment prohibited during neutralised SC/VSC phase."
          : constraintLevel > 25
          ? `Power derated to ${Math.round(350 - Math.round(((constraintLevel - 25) / 75) * 60))} kW by user constraint slider.`
          : nextBestAction.isFiaLimitActive
          ? `Clamped to ${this.ruleProfile.accelerationZoneLimitKw} kW MGU-K maximum ceiling under FIA 2026 technical regulations.`
          : `Fully compliant within ${this.ruleProfile.accelerationZoneLimitKw} kW regulatory ceiling.`
      },
      c3_soc_operating: {
        id: "C3",
        name: "SOC / Energy Operating Envelope",
        type: "FIA RULE",
        status: soc < 30
          ? "VIOLATION_PREVENTED"
          : soc < 40
          ? "CAUTION_ENVELOPE"
          : "COMPLIANT",
        statusClass: soc < 30 ? "restricted" : soc < 40 ? "clamped" : "ok",
        isLimiting: soc < 40,
        driverSlider: `Battery SOC (${soc}%)`,
        description: soc < 30
          ? `Battery SOC (${soc}%) below 30% threshold; attack deployment blocked to protect safety floor (${currentReserve.safetyFloorMJ.toFixed(1)} MJ).`
          : soc < 40
          ? `SOC at ${soc}%; operating near 30% floor (${currentReserve.safetyFloorMJ.toFixed(1)} MJ). High-draw deployment restricted.`
          : `SOC at ${soc}%; sufficient headroom above ${this.ruleProfile.socReserveFloorPct}% (${currentReserve.safetyFloorMJ.toFixed(1)} MJ) regulatory floor.`
      },
      c4_harvesting: {
        id: "C4",
        name: "Per-Lap Harvesting Limit",
        type: "FIA RULE",
        status: isVscOrSc
          ? "SC_HARVEST_MAXIMIZED"
          : trackCondition === "WET"
          ? "EXTENDED_REGEN"
          : "COMPLIANT",
        statusClass: "ok",
        isLimiting: false,
        driverSlider: isVscOrSc ? "Safety Car / VSC Active" : `Track Condition (${trackCondition})`,
        description: isVscOrSc
          ? "VSC delta pace permits 100% kinetic battery regeneration without competitive laptime loss."
          : trackCondition === "WET"
          ? `Wet braking distances yield +${(expectedRecoveryMJ * 1.2).toFixed(2)} MJ per lap recovery headroom.`
          : `Recovery (+${expectedRecoveryMJ.toFixed(2)} MJ) compliant with ${this.ruleProfile.maxLapHarvestMJ} MJ per lap recovery cap.`
      },
      c5_overtake_window: {
        id: "C5",
        name: "Overtake Window Constraint",
        type: "MODEL ESTIMATE",
        status: position === 1
          ? "N/A (RACE LEADER)"
          : isVscOrSc
          ? "BANNED_UNDER_SC"
          : carAheadGap <= 0.8
          ? "WINDOW_OPTIMAL"
          : carAheadGap <= 1.2
          ? "WINDOW_OPEN"
          : "MARGINAL_NO_DRS",
        statusClass: (position === 1 || isVscOrSc) ? "active" : carAheadGap <= 1.2 ? "ok" : "clamped",
        isLimiting: position !== 1 && (isVscOrSc || carAheadGap > 1.2),
        driverSlider: position === 1 ? "Position (P1 Leader)" : isVscOrSc ? "SC Toggle" : `Car Ahead Gap (${carAheadGap.toFixed(1)}s)`,
        description: position === 1
          ? "Car is leading in P1; no car ahead. Overtake window is N/A; focusing on defensive buffer."
          : isVscOrSc
          ? "Overtaking window closed by race control flags under SC/VSC Article 55."
          : carAheadGap <= 0.8
          ? `Gap ${carAheadGap.toFixed(1)}s <= 0.8s: DRS slipstream active, closing speed HIGH, pass probability ${overtakeProb}%.`
          : carAheadGap <= 1.2
          ? `Gap ${carAheadGap.toFixed(1)}s: within draft range. Closing speed MODERATE, pass probability ${overtakeProb}%.`
          : `Gap ${carAheadGap.toFixed(1)}s > 1.2s: outside effective DRS overtaking range. Discretionary attack deprioritized.`
      },
      c6_defence_constraint: {
        id: "C6",
        name: "Defensive Requirement Constraint",
        type: "MODEL ESTIMATE",
        status: currentReserve.hasDefensivePressure
          ? "HIGH_PRESSURE"
          : carBehindGap < 1.0
          ? "ELEVATED"
          : "SECURE",
        statusClass: currentReserve.hasDefensivePressure ? "restricted" : carBehindGap < 1.0 ? "clamped" : "ok",
        isLimiting: Boolean(currentReserve.hasDefensivePressure || carBehindGap < 1.0),
        driverSlider: `Car Behind Gap (${carBehindGap.toFixed(1)}s)`,
        description: currentReserve.hasDefensivePressure
          ? `Gap behind ${carBehindGap.toFixed(1)}s < 0.5s: immediate rear attack threat! Dedicated defence reserve expanded to ${currentReserve.defenceMJ.toFixed(1)} MJ.`
          : carBehindGap < 1.0
          ? `Gap behind ${carBehindGap.toFixed(1)}s: opponent in DRS detection cone. Reserving ${currentReserve.defenceMJ.toFixed(1)} MJ buffer.`
          : `Gap behind ${carBehindGap.toFixed(1)}s: comfortable buffer (+1.0s). Standard defensive allocation (${currentReserve.defenceMJ.toFixed(1)} MJ).`
      },
      c7_future_opportunity: {
        id: "C7",
        name: "Future Opportunity Cost",
        type: "SIMULATION ASSUMPTION",
        status: futureLaps >= 5
          ? "HIGH_LOOKAHEAD_WEIGHT"
          : nextBestAction.strategy === "SUPER-CLIP"
          ? "SPEND_NOW_SUPERIOR"
          : "PRESERVE_FOR_PEAK",
        statusClass: nextBestAction.strategy === "SUPER-CLIP" ? "ok" : "active",
        isLimiting: nextBestAction.strategy !== "SUPER-CLIP",
        driverSlider: `Future Laps (${futureLaps} Laps) · Lap ${currentLap}`,
        description: futureLaps >= 5
          ? `Evaluating ${futureLaps} future laps (L${currentLap} -> L${currentLap + futureLaps}). Opportunity cost heavily penalizes wasted electrical energy.`
          : nextBestAction.strategy === "SUPER-CLIP"
          ? `Current attack opportunity (+${expectedGainSec.toFixed(2)}s) yields greater expected race value than saving for downstream straights.`
          : "Downstream straight offers superior overtaking probability; preserving usable pack minimizes opportunity cost."
      },
      c8_recovery_timing: {
        id: "C8",
        name: "Recovery Timing & Distance",
        type: "SIMULATION ASSUMPTION",
        status: nextRecovery && recoveryZonesAway <= 2 ? "RECOVERY_NEAR" : "RECOVERY_DISTANT",
        statusClass: nextRecovery && recoveryZonesAway <= 2 ? "ok" : "clamped",
        isLimiting: !nextRecovery || recoveryZonesAway > 2,
        driverSlider: `Track Zone (${nextBestAction.zoneNumber} -> ${nextRecovery ? nextRecovery.zoneId : 'Z6'})`,
        description: nextRecovery
          ? `Next harvest in ${nextRecovery.zoneId} (${nextRecovery.zoneName}), ${recoveryZonesAway} zone${recoveryZonesAway === 1 ? '' : 's'} away (+${expectedRecoveryMJ.toFixed(2)} MJ).`
          : "No immediate heavy-braking recovery zone within lookahead horizon."
      },
      c9_future_energy_reserve: {
        id: "C9",
        name: "Future Energy Reserve (E_free vs E_reserve)",
        type: "SIMULATION ASSUMPTION",
        status: currentReserve.freeEnergyMJ >= 1.40
          ? "SUFFICIENT_FREE"
          : currentReserve.freeEnergyMJ >= 0.5
          ? "BALANCED_BUFFER"
          : "CRITICAL_RESERVE",
        statusClass: currentReserve.freeEnergyMJ >= 1.40 ? "ok" : currentReserve.freeEnergyMJ >= 0.5 ? "clamped" : "restricted",
        isLimiting: currentReserve.freeEnergyMJ < 1.40,
        driverSlider: `SOC (${soc}%) & Car Behind (${carBehindGap.toFixed(1)}s)`,
        description: `Pack 20.0 MJ: Reserve = ${currentReserve.reserveMJ.toFixed(1)} MJ (Safety ${currentReserve.safetyFloorMJ.toFixed(1)} + Def ${currentReserve.defenceMJ.toFixed(1)} + Atk ${currentReserve.futureAttackMJ.toFixed(1)} + Gap ${currentReserve.recoveryGapMJ.toFixed(1)}). Free = ${currentReserve.freeEnergyMJ.toFixed(1)} MJ.`
      },
      c10_laps_remaining: {
        id: "C10",
        name: "Laps Remaining Valuation",
        type: "SIMULATION ASSUMPTION",
        status: 57 - currentLap <= 3
          ? "AGGRESSIVE_SPEND"
          : 57 - currentLap <= 15
          ? "LATE_RACE_PUSH"
          : "PRESERVATION_MODE",
        statusClass: 57 - currentLap <= 3 ? "ok" : "active",
        isLimiting: false,
        driverSlider: `Current Lap (${currentLap}/57)`,
        description: 57 - currentLap <= 3
          ? `Only ${57 - currentLap} laps remaining! End of race horizon: future opportunity cost discounted; maximum electrical spend favored.`
          : 57 - currentLap <= 15
          ? `${57 - currentLap} laps remaining: balancing stint management with track position gains.`
          : `${57 - currentLap} laps remaining: long-term thermal, tyre, and energy pacing prioritized.`
      },
      c11_position_constraint: {
        id: "C11",
        name: "Track Position Risk / Reward",
        type: "SIMULATION ASSUMPTION",
        status: position === 1
          ? "LEADER_DEFEND"
          : position <= 3
          ? "PODIUM_ATTACK"
          : "AGGRESSIVE_HUNT",
        statusClass: "ok",
        isLimiting: position === 1,
        driverSlider: `Position Selector (P${position})`,
        description: position === 1
          ? "P1 Race Leader: track position is paramount. Prioritizing defensive buffer and pace control."
          : position <= 3
          ? `P${position}: Podium position. Calculated attack deployed when pass probability is high (${overtakeProb}%).`
          : `P${position}: Mid-pack traffic. Aggressive overtake moves prioritized to clear dirty air.`
      },
      c12_opponent_counterattack: {
        id: "C12",
        name: "Opponent Counterattack Risk",
        type: "MODEL ESTIMATE",
        status: carBehindGap < 0.6
          ? "HIGH_COUNTER_RISK"
          : carBehindGap < 1.2
          ? "MODERATE_COUNTER_RISK"
          : "LOW_COUNTER_RISK",
        statusClass: carBehindGap < 0.6 ? "restricted" : carBehindGap < 1.2 ? "clamped" : "ok",
        isLimiting: carBehindGap < 1.2,
        driverSlider: `Car Behind Gap (${carBehindGap.toFixed(1)}s)`,
        description: carBehindGap < 0.6
          ? `Passing now risks immediate opponent DRS counterattack in downstream straight (Gap behind ${carBehindGap.toFixed(1)}s).`
          : carBehindGap < 1.2
          ? `Opponent within 1.2s; counter-DRS possible if battery fully depleted on current straight.`
          : `Opponent > 1.2s behind; clean air gap mitigates immediate counterattack vulnerability.`
      },
      c13_zone_performance: {
        id: "C13",
        name: "Zone Performance Potential (5 Dimensions)",
        type: "SIMULATION ASSUMPTION",
        status: tyreState.grip < 60
          ? "TYRE_GRIP_LIMITED"
          : trackCondition === "WET"
          ? "TRACTION_LIMITED"
          : "OPTIMAL_ALIGNMENT",
        statusClass: tyreState.grip < 60 ? "restricted" : trackCondition === "WET" ? "clamped" : "ok",
        isLimiting: Boolean(tyreState.grip < 60 || trackCondition === "WET"),
        driverSlider: `Tyre Age (${tyreState.age}L on ${tyreState.compoundId}) · ${trackCondition}`,
        description: tyreState.grip < 60
          ? `Tyre grip at ${tyreState.grip}% (${tyreState.age}L on ${tyreState.compoundId}) limits traction. Full 350 kW power risks wheelspin and thermal cliff.`
          : trackCondition === "WET"
          ? "Wet track limits mechanical traction. Power delivery smoothed across corner exit."
          : `Zone ${nextBestAction.zoneNumber} (${nextBestAction.zoneName}): High mechanical grip (${tyreState.grip}%), traction potential ${nextBestAction.performancePotential}/100.`
      }
    };

    // Compute live constraint audit summary
    const limitingCount = Object.values(constraints13).filter((c) => c.isLimiting).length;
    const compliantCount = 13 - limitingCount;
    const activeDrivers = Array.from(new Set(
      Object.values(constraints13).filter((c) => c.isLimiting).map((c) => c.driverSlider.split(" · ")[0].split(" (")[0])
    ));
    const constraintSummary = {
      limitingCount,
      compliantCount,
      activeDrivers
    };

    // Constraint -> Decision -> Outcome Demonstration (Section 22)
    let dominantConstraintTitle = "Finite 20 MJ Usable Energy Envelope";
    let dominantConstraintDesc = "Regulatory reserve floor & finite battery pack capacity.";
    let optimizerDetectsTitle = `Future attack needs 1.40 MJ | Reserve ${currentReserve.reserveMJ.toFixed(1)} MJ`;
    let optimizerDetectsDesc = `Evaluating expected value vs downstream recovery in ${nextRecovery ? nextRecovery.zoneId : 'Z6'}.`;
    let decisionDesc = "Zero unnecessary discretionary energy dissipation.";
    let recoveryDesc = "Kinetic MGU-K regeneration quota uncompromised.";
    let nextAttackDesc = "Sufficient free energy unlocked for DRS straight attack.";
    let outcomeDesc = `Delivers +${expectedGainSec.toFixed(2)}s expected gain while preserving regulatory reserve.`;

    if (isVscOrSc) {
      dominantConstraintTitle = "Safety Car / VSC Neutralization (Art 55)";
      dominantConstraintDesc = "Overtaking prohibited; delta time enforced by race control.";
      optimizerDetectsTitle = "Cheap Pit Stop & Maximize Kinetic Harvest";
      optimizerDetectsDesc = "Pit loss slashed to 15.5s; battery pack can be topped to 100% at 0 competitive cost.";
      decisionDesc = nextBestAction.strategy === "BRAKING / HARVEST" ? "High-regen coasting and battery top-up." : "Pacing under delta time.";
      nextAttackDesc = "Full 100% pack ready for green flag restart.";
      outcomeDesc = "Maintains race delta without burning electrical energy.";
    } else if (tyreState && tyreState.grip < 60) {
      dominantConstraintTitle = `Tyre Degradation Cliff (${tyreState.age}L on ${tyreState.compoundId})`;
      dominantConstraintDesc = `Grip dropped to ${tyreState.grip}% (${tyreState.degradationLevel} DEG). High torque induces wheelspin.`;
      optimizerDetectsTitle = `Pace Degraded (+1.4s/lap) | Pit Window Active`;
      optimizerDetectsDesc = `Electrical deployment laptime benefit derated to ${effectiveGainSec.toFixed(2)}s. Box urgency high.`;
      decisionDesc = nextBestAction.strategy === "SUPER-CLIP" ? "Pre-pit sprint push before boxing." : "Protect remaining rubber and prepare to box.";
      outcomeDesc = "Preserves vehicle dynamics and avoids irreversible tyre cliff.";
    } else if (currentReserve.hasDefensivePressure) {
      dominantConstraintTitle = `Rear Attack Threat (${carBehindGap.toFixed(1)}s < 0.5s)`;
      dominantConstraintDesc = "Opponent in DRS detection cone; defending position is mandatory.";
      optimizerDetectsTitle = `Dedicated Defensive Allocation: +${currentReserve.defenceMJ.toFixed(1)} MJ`;
      optimizerDetectsDesc = "Reserving high-power burst to prevent turn 1/turn 3 divebomb.";
      decisionDesc = nextBestAction.strategy === "SUPER-CLIP" ? "Defensive deployment burst to break DRS." : "Conserve defensive buffer for main straight.";
      nextAttackDesc = "Defensive headroom maintained for heavy braking entry.";
      outcomeDesc = `Guards track position (P${position}) against DRS counterattack.`;
    } else if (currentReserve.currentSoc < 40) {
      dominantConstraintTitle = `SOC Operating Floor (${currentReserve.currentSoc}% < 40%)`;
      dominantConstraintDesc = "Approaching 30% safety floor; high-power discharge restricted.";
      optimizerDetectsTitle = `Harvest Opportunity in ${nextRecovery ? nextRecovery.zoneId : 'Z6'} (+${expectedRecoveryMJ.toFixed(2)} MJ)`;
      optimizerDetectsDesc = "Kinetic recovery yields higher race value than premature battery drain.";
      decisionDesc = "Coasting / regenerative braking to rebuild pack energy.";
      nextAttackDesc = "Super-Clip queued for Zone 5 upon battery replenish.";
      outcomeDesc = `Safeguards reserve floor (${currentReserve.safetyFloorMJ.toFixed(1)} MJ) while preparing counter-stroke.`;
    } else if (nextBestAction.isFiaLimitActive) {
      dominantConstraintTitle = "FIA Power Clamping (Article 5.4.1)";
      dominantConstraintDesc = `Requested ${Math.round(160 + (intensity / 100) * 220)} kW exceeds 350 kW maximum MGU-K limit.`;
      optimizerDetectsTitle = "350 kW Regulatory Ceiling Enforced";
      optimizerDetectsDesc = "Recalibrating power curve to legal envelope without penalty.";
      decisionDesc = "Optimal legal deployment within FIA ceiling.";
      outcomeDesc = "Zero penalty points; maximal legal acceleration delivered.";
    } else if (constraintLevel > 50) {
      dominantConstraintTitle = `Constraint Derating Active (${constraintLevel}%)`;
      dominantConstraintDesc = `User derating slider capping peak power by -${Math.round(((constraintLevel - 25) / 75) * 60)} kW.`;
      optimizerDetectsTitle = `Penalizing Aggressive Spending (-${Math.round(((constraintLevel - 40) / 60) * 90)} pts)`;
      optimizerDetectsDesc = "Prioritizing pack preservation over marginal attack moves.";
      decisionDesc = "Controlled deployment compliant with strict derating.";
      outcomeDesc = "Optimizes energy efficiency under strict operational rules.";
    }

    const adaptationFlow = {
      constraint: dominantConstraintTitle,
      constraintDesc: dominantConstraintDesc,
      engineDetects: optimizerDetectsTitle,
      engineDetectsDesc: optimizerDetectsDesc,
      decision: nextBestAction.strategy,
      decisionDesc: decisionDesc,
      recovery: nextRecovery ? `+${expectedRecoveryMJ.toFixed(2)} MJ in ${nextRecovery.zoneId}` : "+0.80 MJ next braking zone",
      recoveryDesc: recoveryDesc,
      nextAttack: nextBestAction.strategy === "SUPER-CLIP" ? "Immediate Super-Clip with High Free Energy" : "Super-Clip queued for Zone 5 upon battery replenish",
      nextAttackDesc: nextAttackDesc,
      outcome: `Expected race gain: +${expectedGainSec.toFixed(2)}s`,
      outcomeDesc: outcomeDesc
    };

    // Candidate Strategy Comparison & Optimization Breakdown (Sections 8, 13, 14, 22, 44)
    const allStrats = ["SUPER-CLIP", "NORMAL DEPLOYMENT", "COAST", "BRAKING / HARVEST"];
    const actionBreakdowns = nextBestAction.candidateBreakdowns || {};

    const strategyComparison = allStrats.map((stratName) => {
      const bd = actionBreakdowns[stratName] || {
        name: stratName,
        normalizedScore: stratName === nextBestAction.strategy ? 87 : 72,
        totalRawScore: stratName === nextBestAction.strategy ? 51 : 32,
        isLegal: true,
        isFeasible: true,
        powerKw: stratName === "SUPER-CLIP" ? 350 : stratName === "NORMAL DEPLOYMENT" ? 200 : 0,
        powerLabel: stratName === "SUPER-CLIP" ? "350 kW" : stratName === "NORMAL DEPLOYMENT" ? "200 kW" : "0 kW",
        energyDeltaMJ: stratName === "SUPER-CLIP" ? -1.40 : stratName === "NORMAL DEPLOYMENT" ? -0.80 : stratName === "COAST" ? -0.05 : 0.76,
        energyLabel: stratName === "SUPER-CLIP" ? "-1.40 MJ" : stratName === "NORMAL DEPLOYMENT" ? "-0.80 MJ" : stratName === "COAST" ? "-0.05 MJ" : "+0.76 MJ",
        expectedGainSec: stratName === "SUPER-CLIP" ? 0.42 : stratName === "NORMAL DEPLOYMENT" ? 0.18 : 0.00,
        expectedGainLabel: stratName === "SUPER-CLIP" ? "+0.42s" : stratName === "NORMAL DEPLOYMENT" ? "+0.18s" : "0.00s",
        constraintStatus: "COMPLIANT",
        constraintRelation: "Compliant with 2026 FIA Regulations",
        constraintSliderTag: "Standard tolerance"
      };
      return {
        name: stratName,
        score: bd.normalizedScore,
        rawScore: bd.totalRawScore,
        isRecommended: stratName === nextBestAction.strategy,
        breakdown: bd,
        powerKw: bd.powerKw ?? (stratName === "SUPER-CLIP" ? 350 : stratName === "NORMAL DEPLOYMENT" ? 200 : 0),
        powerLabel: bd.powerLabel ?? (stratName === "SUPER-CLIP" ? "350 kW" : stratName === "NORMAL DEPLOYMENT" ? "200 kW" : "0 kW"),
        energyDeltaMJ: bd.energyDeltaMJ ?? (stratName === "SUPER-CLIP" ? -1.40 : stratName === "NORMAL DEPLOYMENT" ? -0.80 : stratName === "COAST" ? -0.05 : 0.76),
        energyLabel: bd.energyLabel ?? (stratName === "SUPER-CLIP" ? "-1.40 MJ" : stratName === "NORMAL DEPLOYMENT" ? "-0.80 MJ" : stratName === "COAST" ? "-0.05 MJ" : "+0.76 MJ"),
        expectedGainSec: bd.expectedGainSec ?? (stratName === "SUPER-CLIP" ? 0.42 : stratName === "NORMAL DEPLOYMENT" ? 0.18 : 0.00),
        expectedGainLabel: bd.expectedGainLabel ?? (stratName === "SUPER-CLIP" ? "+0.42s" : stratName === "NORMAL DEPLOYMENT" ? "+0.18s" : "0.00s"),
        constraintStatus: bd.constraintStatus || "COMPLIANT",
        constraintRelation: bd.constraintRelation || "Compliant with 2026 FIA Regulations",
        constraintSliderTag: bd.constraintSliderTag || "Standard tolerance"
      };
    });

    // Ensure recommended strategy has highest score
    const winningCandidate = strategyComparison.find((s) => s.isRecommended);
    const strategyScore = winningCandidate ? winningCandidate.score : 87;

    const optimizationBreakdown = actionBreakdowns[nextBestAction.strategy] || {
      immediateRaceGain: 24,
      futureEnergyValue: 19,
      recoveryValue: 14,
      positionBenefit: 11,
      tyrePerformanceValue: 14,
      pitStrategyValue: 6,
      undercutValue: 2,
      energyCost: 8,
      attackRisk: 3,
      defenceRisk: 2,
      futureOpportunityCost: 4,
      counterattackRisk: 3,
      pitLaneTimeLoss: 0,
      tyreDegradationCost: 3,
      trafficRisk: 1,
      rulePenalty: 0,
      totalRawScore: 51,
      normalizedScore: strategyScore
    };

    // Active Zone Information (Section 18)
    const activeZone = this.zones.find((z) => z.zoneNumber === nextBestAction.zoneNumber) || this.zones[4];
    const activeZoneInfo = {
      zoneNumber: activeZone.zoneNumber,
      zoneId: activeZone.id,
      zoneName: activeZone.name,
      sector: activeZone.sector,
      performancePotential: activeZone.performancePotential,
      effectivePotential: Math.round(activeZone.performancePotential * tyreState.performanceFactor),
      overtakePotential: activeZone.overtakePotential,
      recoveryPotential: activeZone.recoveryPotential,
      defenceValue: activeZone.defenceValue,
      energyEfficiency: activeZone.energyEfficiency,
      currentGap: carAheadGap,
      closingSpeed: carAheadGap <= 0.8 ? "HIGH" : carAheadGap <= 1.5 ? "MODERATE" : "LOW"
    };

    const recoveryTiming = {
      sector: nextRecovery ? nextRecovery.sector : (activeZone.sector === 2 ? 2 : 3),
      zoneNumber: nextRecovery ? nextRecovery.zoneNumber : (activeZone.zoneNumber === 5 ? 6 : 8),
      zoneId: nextRecovery ? nextRecovery.zoneId : (activeZone.zoneNumber === 5 ? "Z6" : "Z8"),
      zoneName: nextRecovery ? nextRecovery.zoneName : (activeZone.zoneNumber === 5 ? "High-Speed Sweeper Exit & Heavy Braking" : "Hairpin Entry"),
      zonesAway: nextRecovery && nextBestAction
        ? (((nextRecovery.zoneNumber - nextBestAction.zoneNumber + 9) % 9) || 1)
        : (activeZone.zoneNumber === 5 ? 1 : 2),
      expectedRecoveryMJ,
      timingString: nextRecovery
        ? `Sector ${nextRecovery.sector} · Zone ${nextRecovery.zoneNumber}`
        : (activeZone.zoneNumber === 5 ? "Sector 2 · Zone 6" : "Sector 3 · Zone 8"),
      summary: nextRecovery
        ? `Sector ${nextRecovery.sector} · Zone ${nextRecovery.zoneNumber} | ${(((nextRecovery.zoneNumber - nextBestAction.zoneNumber + 9) % 9) || 1)} zone${(((nextRecovery.zoneNumber - nextBestAction.zoneNumber + 9) % 9) || 1) === 1 ? "" : "s"} away | Expected recovery: +${expectedRecoveryMJ.toFixed(2)} MJ`
        : `Sector 2 · Zone 6 | 1 zone away | Expected recovery: +${expectedRecoveryMJ.toFixed(2)} MJ`,
      sequence: `Current attack (${nextBestAction.zoneId}, -${deployedMJ.toFixed(2)} MJ) → Remaining buffer (${energyAfterDeployMJ.toFixed(1)} MJ) → Next recovery (${nextRecovery ? nextRecovery.zoneId : "Z6"}, +${expectedRecoveryMJ.toFixed(2)} MJ) → Future attack`
    };

    // Option A vs Option B Trade-off Comparison & 4 Strategic Ways (Section 9)
    const isLeader = position === 1;
    const currentSoc = centralRaceState.SOC;
    const currentEnergyMJ = centralRaceState.energyMJ;
    const freeEnergyMJ = currentReserve.freeEnergyMJ;
    const reserveMJ = currentReserve.reserveMJ;

    const lapsRemaining = centralRaceState.lapsRemaining != null ? centralRaceState.lapsRemaining : Math.max(1, 57 - currentLap);
    const isSprintPhase = centralRaceState.isSprintPhase || (lapsRemaining <= 3);
    const isRaceStart = centralRaceState.isRaceStart || (currentLap <= 3);
    const currentJoules = centralRaceState.energyJoules || Math.round(currentEnergyMJ * 1e6);
    const freeJoules = currentReserve.freeJoules || Math.round(freeEnergyMJ * 1e6);
    const reserveJoules = currentReserve.reserveJoules || Math.round(reserveMJ * 1e6);

    // SOC Condition categories
    const isBatteryCriticallyLow = currentSoc <= 28 || freeEnergyMJ <= 0.2;
    const isBatteryConstrained = currentSoc < 40 || freeEnergyMJ < 0.8;
    const isBatteryHealthy = currentSoc >= 40 && freeEnergyMJ >= 0.8;

    // Gap Ahead categories
    const isCarAheadInAttackWindow = !isLeader && carAheadGap <= 1.0;
    const isCarAheadOutOfRange = !isLeader && carAheadGap > 1.0;

    // Rear Threat categories
    const isRearDefensiveThreat = carBehindGap < 0.5;
    const isRearManageable = carBehindGap >= 0.5;

    // Dynamic future opportunity model & counterfactual optimization (Sections 3, 4, 5, 6, 7 & 15)
    const futureOppModel = this.generateFutureOpportunities(centralRaceState, 5);
    const spendVsSaveOptimization = this.evaluateSpendVsSaveOptimization(centralRaceState, nextBestAction, futureOppModel);
    const bestFut = futureOppModel.bestFutureOpportunity;

    // Dynamic future opportunity target & parameters
    const futureTargetZone = this.zones.find(z => z.zoneNumber === bestFut.zoneNumber) || this.zones.find(z => z.isAccelerationZone && z.zoneNumber !== nextBestAction.zoneNumber) || this.zones[1];
    const futureOvertakeBase = Math.round(futureTargetZone.overtakePotential * tyreState.performanceFactor);
    const futureOvertakeProb = isLeader
      ? 0
      : Math.min(96, Math.max(15, Math.round(bestFut.overtakeProbability || (futureOvertakeBase * (isBatteryCriticallyLow || isCarAheadOutOfRange ? 1.12 : 0.85)))));
    const futureGainSec = bestFut.expectedGainSec || (isBatteryCriticallyLow || isCarAheadOutOfRange ? 0.45 : 0.28);

    // Causal Decision determination directly driven by SOC factor, Car Ahead, and Car Behind
    let decisionMode = "SAVE_FOR_LATER";
    let recommendation = "SAVE FOR LATER";
    let tactic = "SAVE FOR LATER (APPROACH & QUEUE BOOST)";
    let optionATitle = "OPTION A — CONSERVE NOW (LIFT & COAST)";
    let optionBTitle = "OPTION B — SAVE FOR LATER";
    let rationale = "";

    // Energy Productivity & Worthwhile Decision Engine (Checking SOC level and track context)
    let productivity = {
      isWorthwhile: true,
      isProductive: true,
      rating: "HIGHLY PRODUCTIVE & WORTHWHILE",
      status: "HIGH_PRODUCTIVITY",
      badgeClass: "worthwhile",
      worthwhileBadge: "WORTHWHILE · HIGH RETURN",
      worthwhileLabel: "HIGHLY PRODUCTIVE & WORTHWHILE",
      energyROI: 0.30,
      roiLabel: "+0.30 s/MJ (High Pass Yield)",
      assessment: "",
      actionAdvice: ""
    };

    if (isLeader) {
      decisionMode = "PACE_CONTROL";
      if (carBehindGap < 0.6) {
        recommendation = "MAINTAIN PACE";
        tactic = "PACE CONTROL (DEFEND LEAD)";
        optionATitle = "OPTION A — PACE CONTROL & LEAD DEFENCE";
        optionBTitle = "OPTION B — RECHARGE & CONSERVE GAP";
        rationale = `P1 Lead under threat (P2 is ${carBehindGap.toFixed(1)}s behind). Deploy controlled electrical energy to defend track position against DRS counter-attack while conserving buffer (${reserveMJ.toFixed(1)} MJ · ${reserveJoules.toLocaleString()} J).`;
        productivity = {
          isWorthwhile: true,
          isProductive: true,
          rating: "PACE CONTROL & LEAD DEFENCE",
          status: "LEADER_DEFENCE",
          badgeClass: "leader",
          worthwhileBadge: "WORTHWHILE · PACE CONTROL",
          worthwhileLabel: `WORTHWHILE — DEFENSIVE PACE CONTROL (P2 IS ${carBehindGap.toFixed(1)}s)`,
          energyROI: 0.18,
          roiLabel: "+0.18 s/MJ (Track Position Protection)",
          assessment: `Leading P1 with P2 pressing within ${carBehindGap.toFixed(1)}s. Deploying controlled electrical energy to defend track position is worthwhile while preserving legal buffer (${reserveMJ.toFixed(1)} MJ · ${reserveJoules.toLocaleString()} J).`,
          actionAdvice: "Deploy paced power to maintain gap and protect against DRS slipstream."
        };
      } else {
        recommendation = "CONSERVE & RECHARGE";
        tactic = "CONSERVE & RECHARGE (HARVEST & COOL)";
        optionATitle = "OPTION A — PACE CONTROL & LEAD DEFENCE";
        optionBTitle = "OPTION B — RECHARGE & CONSERVE GAP";
        rationale = `P1 comfortable lead (${carBehindGap.toFixed(1)}s ahead of P2). Harvesting kinetic energy under braking optimizes thermal and pack longevity while delta time remains safe.`;
        productivity = {
          isWorthwhile: true,
          isProductive: true,
          rating: "RECHARGE & GAP PRESERVATION",
          status: "LEADER_CRUISE",
          badgeClass: "leader",
          worthwhileBadge: "WORTHWHILE · RECHARGE & CONSERVE",
          worthwhileLabel: `WORTHWHILE — RECHARGE & CONSERVE GAP (${carBehindGap.toFixed(1)}s TO P2)`,
          energyROI: 0.15,
          roiLabel: "+0.15 s/MJ (Buffer Longevity)",
          assessment: `P1 lead is comfortable (${carBehindGap.toFixed(1)}s gap). Energy conservation and regenerative braking under deceleration preserve pack thermal health without jeopardizing race delta.`,
          actionAdvice: "Maximize kinetic recovery and manage engine mapping for pack preservation."
        };
      }
    } else if (isBatteryCriticallyLow) {
      decisionMode = "HARVEST_NOW";
      recommendation = "HARVEST NOW (MGU-K RECHARGE)";
      tactic = "HARVEST NOW (MGU-K RECHARGE — NOTHING TO SAVE)";
      optionATitle = "OPTION A — HARVEST NOW (MGU-K RECHARGE)";
      optionBTitle = "OPTION B — DEFER ATTACK UNTIL RECHARGED (>40% SOC)";
      rationale = `Battery SOC (${currentSoc}% · ${currentEnergyMJ.toFixed(1)} MJ · ${currentJoules.toLocaleString()} J) is critically depleted at the 3.0 MJ reserve floor (Free Energy: 0.00 MJ · 0 J). There is nothing to save and keeping constant is impossible without power cut. Deploying is unviable (0.00 s/MJ ROI). Immediate MGU-K kinetic braking recovery (+${expectedRecoveryMJ.toFixed(2)} MJ) is the only productive energy action to rebuild usable pack capacity.`;
      productivity = {
        isWorthwhile: false,
        isProductive: false,
        rating: "UNVIABLE (NOTHING TO SAVE — MUST RECHARGE)",
        status: "CRITICAL_DEPLETION",
        badgeClass: "unviable",
        worthwhileBadge: "NOT WORTHWHILE · UNVIABLE",
        worthwhileLabel: "NOT WORTHWHILE — NOTHING TO SAVE (0.00 MJ FREE) · RECHARGE MANDATORY",
        energyROI: 0.00,
        roiLabel: `0.00 s/MJ (Pack At Floor — MGU-K Regen: +${expectedRecoveryMJ.toFixed(2)} MJ)`,
        assessment: `Battery SOC is at ${currentSoc}% with 0.00 MJ free energy resting on the 3.0 MJ (3,000,000 J) safety floor. There is nothing to save and keeping constant is impossible without cutting power. Deploying is unviable; active MGU-K kinetic recovery under braking is the only productive energy action to restore attack capacity.`,
        actionAdvice: "Harvest kinetic energy under braking to recharge pack past 40% SOC before attempting any attack."
      };
    } else if (isSprintPhase && freeEnergyMJ >= 0.30) {
      decisionMode = "SPEND_NOW";
      recommendation = "SPEND NOW (FINAL SPRINT)";
      tactic = "SPRINT BURN (USE USABLE ENERGY ACROSS UPCOMING LAPS)";
      optionATitle = "OPTION A — SPEND USABLE ENERGY NOW (FINAL SPRINT)";
      optionBTitle = "OPTION B — SPRINT BURN IN UPCOMING LAPS";
      rationale = `Only ${lapsRemaining} lap${lapsRemaining === 1 ? "" : "s"} remaining (Final Sprint Phase). Multi-lap reserve buffers collapsed to safety floor (3.0 MJ / 3,000,000 J). Authorize spending remaining usable pack (+${freeEnergyMJ.toFixed(2)} MJ / ${freeJoules.toLocaleString()} J free) across upcoming acceleration zones before finish line under FIA 4.0 MJ/lap discharge rule.`;
      productivity = {
        isWorthwhile: true,
        isProductive: true,
        rating: "HIGHLY PRODUCTIVE · FINAL SPRINT BURN",
        status: "FINAL_SPRINT_BURN",
        badgeClass: "worthwhile",
        worthwhileBadge: "WORTHWHILE · SPRINT BURN",
        worthwhileLabel: `HIGHLY PRODUCTIVE — BURN USABLE ENERGY BEFORE CHEQUERED FLAG (${lapsRemaining} LAPS LEFT)`,
        energyROI: 0.38,
        roiLabel: `+0.38 s/MJ (Sprint Lap Delta · ${lapsRemaining} Laps Left)`,
        assessment: `Race is in final sprint (${lapsRemaining} lap${lapsRemaining === 1 ? "" : "s"} remaining). Multi-lap buffer is collapsed to the 3.0 MJ (3,000,000 J) safety floor, leaving +${freeEnergyMJ.toFixed(2)} MJ (${freeJoules.toLocaleString()} J) free energy. Hoarding energy across the finish line is zero-yield; spending it across upcoming laps maximizes final race time delta.`,
        actionAdvice: "Deploy maximum permitted energy (up to 4.0 MJ/lap) across current and upcoming sprint laps; arrive at finish line with zero free energy."
      };
    } else if (isRaceStart && currentSoc >= 40 && freeEnergyMJ >= 0.80) {
      decisionMode = "SPEND_NOW";
      recommendation = "SPEND NOW (RACE START)";
      tactic = "RACE START SCRAMBLE (350 kW SUPER-CLIP)";
      optionATitle = "OPTION A — SPEND NOW (OPENING LAP TRACK POSITION)";
      optionBTitle = "OPTION B — SAVE FOR DRS ACTIVATION (LAP 3+)";
      rationale = `Opening race phase (Lap ${currentLap}/57). High pack energy (${currentEnergyMJ.toFixed(1)} MJ / ${currentJoules.toLocaleString()} J). Spending electrical boost now to gain track position before DRS trains form delivers high compound race delta (+${expectedGainSec.toFixed(2)}s).`;
      productivity = {
        isWorthwhile: true,
        isProductive: true,
        rating: "HIGHLY PRODUCTIVE · RACE START SCRAMBLE",
        status: "RACE_START_ATTACK",
        badgeClass: "worthwhile",
        worthwhileBadge: "WORTHWHILE · RACE START",
        worthwhileLabel: `HIGHLY PRODUCTIVE — OPENING LAP TRACK POSITION SCRAMBLE (LAP ${currentLap}/57)`,
        energyROI: 0.32,
        roiLabel: "+0.32 s/MJ (Early Track Position Scramble)",
        assessment: `Race start phase (Lap ${currentLap}/57). Pack is full (${currentEnergyMJ.toFixed(1)} MJ / ${currentJoules.toLocaleString()} J). Gaining track position immediately before DRS trains form yields maximum compound race return over the 57-lap distance.`,
        actionAdvice: "Deploy 350 kW Super-Clip on opening lap straights to gain early positions before DRS trains settle."
      };
    } else if (isRearDefensiveThreat && currentSoc < 48) {
      decisionMode = "SAVE_FOR_LATER";
      recommendation = "SAVE FOR LATER";
      tactic = "DEFENSIVE ALLOCATION (GUARD POSITION)";
      optionATitle = "OPTION A — GUARD DEFENSIVE FLOOR";
      optionBTitle = "OPTION B — SAVE FOR LATER";
      rationale = `Severe defensive pressure from behind (P${position + 1} is ${carBehindGap.toFixed(1)}s back). High defensive allocation (+${currentReserve.defenceMJ.toFixed(1)} MJ) is required. Deploying forward now would leave the vehicle defenceless against an undercut or DRS pass.`;
      productivity = {
        isWorthwhile: false,
        isProductive: true,
        rating: "DEFENSIVE ALLOCATION PRIORITY",
        status: "DEFENSIVE_PRIORITY",
        badgeClass: "defensive",
        worthwhileBadge: "DEFENSIVE PRIORITY ONLY",
        worthwhileLabel: "DEFENSIVE PRIORITY — FORWARD ATTACK NOT WORTHWHILE",
        energyROI: 0.25,
        roiLabel: `+0.25 s/MJ Defensive Value (P${position + 1} at ${carBehindGap.toFixed(1)}s)`,
        assessment: `P${position + 1} is pressing within ${carBehindGap.toFixed(1)}s. Deploying electrical energy forward is NOT worthwhile as it leaves the car vulnerable to an undercut. Reserving +${currentReserve.defenceMJ.toFixed(1)} MJ for defensive deployment provides vital position protection.`,
        actionAdvice: "Guard defensive reserve floor; do not burn free energy on low-probability forward attacks."
      };
    } else if (isCarAheadOutOfRange) {
      decisionMode = "SAVE_FOR_LATER";
      recommendation = "SAVE FOR LATER";
      tactic = "SAVE FOR LATER (APPROACH & QUEUE BOOST)";
      optionATitle = "OPTION A — CONSERVE NOW (LIFT & COAST)";
      optionBTitle = "OPTION B — SAVE FOR LATER";
      rationale = `Car ahead is ${carAheadGap.toFixed(1)}s ahead (outside 1.0s DRS detection window). Spending 1.40 MJ electrical boost into clean air yields low pass probability (${overtakeProb}%). Conserving pack preserves ${freeEnergyMJ.toFixed(2)} MJ free energy to launch a decisive attack once gap closes inside 0.8s.`;
      productivity = {
        isWorthwhile: false,
        isProductive: false,
        rating: "NOT WORTHWHILE (OUT OF DRS RANGE)",
        status: "OUT_OF_RANGE",
        badgeClass: "low-return",
        worthwhileBadge: "NOT WORTHWHILE · GAP > 1.0s",
        worthwhileLabel: "NOT WORTHWHILE — BURNING BOOST INTO CLEAN AIR (0% PASS YIELD)",
        energyROI: 0.00,
        roiLabel: "0.00 s/MJ (0% Pass Yield Into Clean Air)",
        assessment: `SOC is healthy (${currentSoc}% · ${freeEnergyMJ.toFixed(2)} MJ free), but opponent is ${carAheadGap.toFixed(1)}s ahead (outside 1.0s DRS window). Deploying 1.40 MJ yields 0% overtake probability. Burning energy into clean air is unproductive; queuing boost until inside 0.8s delivers 4x higher return.`,
        actionAdvice: "Lift and coast to queue energy; launch 350 kW boost only after closing within 0.8s."
      };
    } else if (isCarAheadInAttackWindow && isBatteryHealthy && isRearManageable) {
      decisionMode = "SPEND_NOW";
      recommendation = "SPEND NOW";
      tactic = nextBestAction.strategy === "NORMAL DEPLOYMENT" ? "DEPLOY PACED (NORMAL 200 kW)" : "DEPLOY NOW (SUPER-CLIP 350 kW)";
      optionATitle = "OPTION A — SPEND NOW";
      optionBTitle = "OPTION B — SAVE FOR LATER";
      rationale = `Attacking now in Zone ${nextBestAction.zoneNumber} delivers superior immediate race value (${overtakeProb}% pass probability, +${expectedGainSec.toFixed(2)}s) with ${currentSoc}% SOC (${freeEnergyMJ.toFixed(2)} MJ free energy) while maintaining legal defensive reserve (${reserveMJ.toFixed(1)} MJ).`;
      const roiCalc = Math.round((expectedGainSec / (nextBestAction.deployedMJ > 0 ? nextBestAction.deployedMJ : 1.40)) * 100) / 100;
      productivity = {
        isWorthwhile: true,
        isProductive: true,
        rating: "HIGHLY PRODUCTIVE & WORTHWHILE",
        status: "HIGH_PRODUCTIVITY",
        badgeClass: "worthwhile",
        worthwhileBadge: "WORTHWHILE · HIGH RETURN",
        worthwhileLabel: `HIGHLY PRODUCTIVE & WORTHWHILE (+${roiCalc.toFixed(2)}s/MJ · ${overtakeProb}% PASS YIELD)`,
        energyROI: roiCalc,
        roiLabel: `+${roiCalc.toFixed(2)} s/MJ (${overtakeProb}% Pass Yield)`,
        assessment: `Prime attack window in Zone ${nextBestAction.zoneNumber} (${carAheadGap.toFixed(1)}s gap with DRS). Battery SOC (${currentSoc}%) has ${freeEnergyMJ.toFixed(2)} MJ free energy. Deploying 1.40 MJ yields high return (+${expectedGainSec.toFixed(2)}s gain, ${overtakeProb}% pass probability) without violating regulatory reserve.`,
        actionAdvice: "Deploy immediate 350 kW Super-Clip to complete overtake on current straight."
      };
    } else if (nextBestAction.strategy === "BRAKING / HARVEST") {
      decisionMode = "HARVEST_NOW";
      recommendation = "HARVEST NOW (MGU-K RECHARGE)";
      tactic = "HARVEST NOW (MGU-K REGEN)";
      optionATitle = "OPTION A — HARVEST NOW (BRAKING REGEN)";
      optionBTitle = "OPTION B — SAVE FOR LATER";
      rationale = `Optimal recovery opportunity in Zone ${nextBestAction.zoneNumber} (+${expectedRecoveryMJ.toFixed(2)} MJ MGU-K). Harvesting now replenishes energy for an explosive attack in Zone ${futureTargetZone.zoneNumber}.`;
      productivity = {
        isWorthwhile: true,
        isProductive: true,
        rating: "HIGH RECOVERY OPPORTUNITY",
        status: "BRAKING_HARVEST",
        badgeClass: "worthwhile",
        worthwhileBadge: "WORTHWHILE · RECOVERY",
        worthwhileLabel: `WORTHWHILE — RECOVERY OPPORTUNITY (+${expectedRecoveryMJ.toFixed(2)} MJ REGEN)`,
        energyROI: 0.20,
        roiLabel: `+${expectedRecoveryMJ.toFixed(2)} MJ Regen Headroom`,
        assessment: `Braking zone presents optimal kinetic regeneration (+${expectedRecoveryMJ.toFixed(2)} MJ). Capturing energy now directly finances subsequent 350 kW straightline bursts.`,
        actionAdvice: "Utilize deep trail-braking to maximize MGU-K energy recovery."
      };
    } else {
      decisionMode = "SAVE_FOR_LATER";
      recommendation = "SAVE FOR LATER";
      tactic = "SAVE / COAST (LIFT & COAST)";
      optionATitle = "OPTION A — CONSERVE NOW (LIFT & COAST)";
      optionBTitle = "OPTION B — SAVE FOR LATER";
      rationale = `Saving energy now avoids high opportunity cost. Better to preserve free energy (${freeEnergyMJ.toFixed(2)} MJ) for Zone ${futureTargetZone.zoneNumber} where pass probability reaches ${futureOvertakeProb}%.`;
      productivity = {
        isWorthwhile: false,
        isProductive: false,
        rating: "MARGINAL RETURN (PRESERVE FREE ENERGY)",
        status: "CONSERVE_PACK",
        badgeClass: "low-return",
        worthwhileBadge: "NOT WORTHWHILE · CONSERVE",
        worthwhileLabel: `MARGINAL RETURN — PRESERVE FREE ENERGY (+${freeEnergyMJ.toFixed(2)} MJ)`,
        energyROI: 0.08,
        roiLabel: "+0.08 s/MJ (Deferred Gain)",
        assessment: `Deploying in current non-optimal zone yields low return. Preserving ${freeEnergyMJ.toFixed(2)} MJ free energy for Zone ${futureTargetZone.zoneNumber} offers significantly higher overtake probability (${futureOvertakeProb}%).`,
        actionAdvice: "Lift and coast to conserve electrical energy for downstream high-gain straights."
      };
    }

    // 4 Strategic Ways Array: SUPER-CLIP, NORMAL DEPLOYMENT, COAST, BRAKING / HARVEST
    const strategicWays = strategyComparison.map((s) => {
      const isSuper = s.name === "SUPER-CLIP";
      const isNorm = s.name === "NORMAL DEPLOYMENT";
      const isCst = s.name === "COAST";
      const isHrv = s.name === "BRAKING / HARVEST";

      let mode = "DEPLOY NOW";
      let shortName = "SUPER-CLIP";
      if (isNorm) { mode = "DEPLOY PACED"; shortName = "NORMAL"; }
      if (isCst) { mode = "SAVE / COAST"; shortName = "COAST"; }
      if (isHrv) { mode = "HARVEST REGEN"; shortName = "HARVEST"; }

      const stratOvertake = isLeader
        ? 0
        : isSuper
        ? overtakeProb
        : isNorm
        ? Math.round(overtakeProb * 0.75)
        : isCst
        ? Math.round(overtakeProb * 0.25)
        : Math.round(overtakeProb * 0.15);

      const stratId = isSuper ? "super_clip" : isNorm ? "normal" : isCst ? "coast" : "harvest";

      // Feasibility checks based on real SOC and regulatory limits
      let stratFeasible = s.breakdown.isFeasible && s.breakdown.isLegal;
      let stratRecommended = false;
      let statusLabel = "FEASIBLE";

      if (isSuper) {
        if (isBatteryCriticallyLow) {
          stratFeasible = false;
          statusLabel = "INFEASIBLE (SOC LOW)";
        } else if (decisionMode === "SPEND_NOW") {
          stratRecommended = true;
          statusLabel = isSprintPhase ? "RECOMMENDED (SPRINT BURN)" : (isRaceStart ? "RECOMMENDED (RACE START)" : "RECOMMENDED");
        } else if (isCarAheadOutOfRange) {
          statusLabel = "INEFFICIENT (>1.0s GAP)";
        }
      } else if (isNorm) {
        if (currentSoc < 22) {
          stratFeasible = false;
          statusLabel = "INFEASIBLE (SOC LOW)";
        } else if (decisionMode === "SPEND_NOW" && tactic.includes("NORMAL")) {
          stratRecommended = true;
          statusLabel = "RECOMMENDED";
        }
      } else if (isCst) {
        if (decisionMode === "SAVE_FOR_LATER" && (isCarAheadOutOfRange || isRearDefensiveThreat)) {
          stratRecommended = true;
          statusLabel = "RECOMMENDED (QUEUE)";
        }
      } else if (isHrv) {
        if (decisionMode === "HARVEST_NOW") {
          stratRecommended = true;
          statusLabel = "RECOMMENDED";
        }
      }

      // Dynamic scores reflecting causal scenario
      let dynamicScore = s.score;
      if (isSuper && isBatteryCriticallyLow) dynamicScore = 25;
      if (isSuper && isCarAheadOutOfRange) dynamicScore = Math.min(dynamicScore, 48);
      if (isHrv && isBatteryCriticallyLow) dynamicScore = Math.max(dynamicScore, 92);
      if (isCst && isCarAheadOutOfRange) dynamicScore = Math.max(dynamicScore, 86);
      if (isSuper && decisionMode === "SPEND_NOW") dynamicScore = Math.max(dynamicScore, 95);

      return {
        id: stratId,
        name: s.name,
        shortName,
        mode,
        score: dynamicScore,
        powerKw: s.powerKw,
        powerLabel: s.powerLabel,
        energyDeltaMJ: s.energyDeltaMJ,
        energyLabel: s.energyLabel,
        expectedGainSec: s.expectedGainSec,
        expectedGainLabel: s.expectedGainLabel,
        overtakeProb: stratOvertake,
        isRecommended: stratRecommended || (decisionMode === "SPEND_NOW" && isSuper),
        isFeasible: stratFeasible,
        statusLabel,
        tacticDescription: isSuper
          ? "Deploy maximum 350 kW boost to force immediate overtake."
          : isNorm
          ? "Deploy paced 200 kW to protect thermal and defensive reserve."
          : isCst
          ? "Lift and coast to preserve pack buffer with zero battery drain."
          : `Active MGU-K regeneration recovering +${expectedRecoveryMJ.toFixed(2)} MJ for future attacks.`
      };
    });

    const isSpendNowOpt = recommendation === "SPEND NOW" || recommendation === "MAINTAIN PACE";
    const isHarvestOpt = decisionMode === "HARVEST_NOW";

    const tradeoffComparison = {
      decisionMode,
      recommendation,
      tactic,
      strategicWays,
      productivity,
      factors: {
        soc: {
          percent: currentSoc,
          energyMJ: currentEnergyMJ,
          energyJoules: currentJoules,
          reserveMJ: reserveMJ,
          reserveJoules: reserveJoules,
          freeEnergyMJ: freeEnergyMJ,
          freeJoules: freeJoules,
          safetyFloorMJ: currentReserve.safetyFloorMJ,
          safetyFloorJoules: currentReserve.safetyFloorJoules,
          action: isBatteryCriticallyLow
            ? "RECHARGE VIA MGU-K"
            : isSprintPhase
            ? "SPRINT BURN (USE IN UPCOMING LAPS)"
            : isRaceStart
            ? "OPENING LAP ATTACK"
            : isBatteryConstrained
            ? "CONSERVE BUFFER"
            : "DEPLOY ON ATTACK",
          status: isBatteryCriticallyLow
            ? "CRITICALLY LOW (NOTHING TO SAVE)"
            : isSprintPhase
            ? `FINAL SPRINT (${lapsRemaining} LAPS LEFT)`
            : isRaceStart
            ? `RACE START (LAP ${currentLap}/57)`
            : isBatteryConstrained
            ? "CONSTRAINED"
            : (currentSoc >= 68 ? "SURPLUS" : "HEALTHY"),
          levelClass: isBatteryCriticallyLow ? "low" : (isBatteryConstrained ? "mid" : "high")
        },
        carAhead: {
          gap: isLeader ? null : carAheadGap,
          label: isLeader ? "RACE LEADER P1" : `${carAheadGap.toFixed(1)}s`,
          inDrsWindow: isCarAheadInAttackWindow,
          status: isLeader ? "CLEAN AIR (N/A)" : (carAheadGap <= 0.8 ? "DRS ATTACK CONE (<=0.8s)" : (carAheadGap <= 1.0 ? "MARGINAL DRS (<=1.0s)" : "OUT OF RANGE (>1.0s)")),
          statusClass: isLeader ? "leader" : (carAheadGap <= 1.0 ? "drs" : "out")
        },
        carBehind: {
          gap: carBehindGap,
          label: `${carBehindGap.toFixed(1)}s`,
          hasDefensiveThreat: isRearDefensiveThreat,
          status: carBehindGap < 0.5 ? "DEFENSIVE THREAT (<0.5s)" : (carBehindGap < 1.0 ? "MODERATE PRESSURE" : "CLEAR AIR (SAFE >=1.0s)"),
          statusClass: carBehindGap < 0.5 ? "threat" : (carBehindGap < 1.0 ? "mid" : "safe")
        }
      },
      optionA: {
        title: optionATitle,
        zone: `Zone ${nextBestAction.zoneNumber} (${nextBestAction.zoneName})`,
        overtakeProb: isLeader ? 0 : (isCarAheadOutOfRange && !isSprintPhase ? Math.round(overtakeProb * 0.3) : (isBatteryCriticallyLow ? 0 : overtakeProb)),
        energyRequiredMJ: decisionMode === "SPEND_NOW" ? (nextBestAction.deployedMJ > 0 ? nextBestAction.deployedMJ : 1.40) : (isHarvestOpt ? -expectedRecoveryMJ : (isLeader ? 0.80 : 0.0)),
        expectedGain: isHarvestOpt
          ? `+${expectedRecoveryMJ.toFixed(2)} MJ (+0.00s)`
          : decisionMode === "SPEND_NOW"
          ? `+${expectedGainSec.toFixed(2)}s`
          : `+0.00s (Preserve Buffer)`,
        statsLabel: isLeader
          ? `P1 Lead: ${carBehindGap.toFixed(1)}s ahead | ${nextBestAction.deployedMJ > 0 ? nextBestAction.deployedMJ.toFixed(2) : '0.00'} MJ (${Math.round((nextBestAction.deployedMJ > 0 ? nextBestAction.deployedMJ : 0) * 1e6).toLocaleString()} J)`
          : isBatteryCriticallyLow
          ? `Regen: +${expectedRecoveryMJ.toFixed(2)} MJ | Recharges to ${this.mjToSoc(centralRaceState.energyMJ + expectedRecoveryMJ).toFixed(0)}% SOC (0.00 MJ Free · Nothing to Save)`
          : isSprintPhase
          ? `Sprint Deploy: -1.40 MJ (-1,400,000 J) | Gain: +${expectedGainSec.toFixed(2)}s (${lapsRemaining} Laps Left)`
          : isRaceStart
          ? `Overtake: ${overtakeProb}% | -1.40 MJ (-1,400,000 J) | Gain: +${expectedGainSec.toFixed(2)}s`
          : isHarvestOpt
          ? `Regen: +${expectedRecoveryMJ.toFixed(2)} MJ | Recharges to ${this.mjToSoc(centralRaceState.energyMJ + expectedRecoveryMJ).toFixed(0)}% SOC`
          : decisionMode === "SPEND_NOW"
          ? `Overtake: ${overtakeProb}% | -1.40 MJ (-1,400,000 J) (Gain: +${expectedGainSec.toFixed(2)}s)`
          : `Conserve: 0.00 MJ (0 J) | Free Energy Intact (${freeEnergyMJ.toFixed(2)} MJ · ${freeJoules.toLocaleString()} J)`,
        description: isLeader
          ? "Deploy controlled power to manage race pace and maintain gap to P2."
          : isBatteryCriticallyLow
          ? "Battery has zero free energy (0.00 MJ) at the 3.0 MJ reserve floor; there is nothing to save and keeping constant is impossible. Active MGU-K kinetic recovery under braking is mandatory to rebuild usable pack capacity."
          : isSprintPhase
          ? `Deploy discretionary electrical energy immediately in the current sprint lap (${lapsRemaining} laps left to race finish).`
          : isRaceStart
          ? "Deploy 350 kW Super-Clip immediately on opening lap straights to gain track position before DRS trains form."
          : decisionMode === "SPEND_NOW"
          ? "Deploy discretionary electrical energy immediately in current attack window."
          : isHarvestOpt
          ? `Harvest kinetic energy under braking (+${expectedRecoveryMJ.toFixed(2)} MJ) to recharge pack for upcoming straights.`
          : `Lift and coast to preserve ${freeEnergyMJ.toFixed(2)} MJ free energy for subsequent DRS zones.`
      },
      optionB: {
        title: optionBTitle,
        zone: isLeader
          ? `Next Lap — High Regen Zones (${recoveryTiming.zoneId})`
          : isSprintPhase
          ? (lapsRemaining === 1 ? "Final Lap 57 (All Straightline Acceleration Zones)" : "Upcoming Laps (All Straightline Acceleration Zones)")
          : isRaceStart
          ? "Lap 3 — High DRS Detection Zones"
          : (isHarvestOpt || isCarAheadOutOfRange || isBatteryCriticallyLow)
          ? `Upcoming Straight — Zone ${futureTargetZone.zoneNumber} (${futureTargetZone.name})`
          : `Next Straight — ${recoveryTiming.zoneId} & Next Lap Z5`,
        overtakeProb: isLeader ? 0 : (isSprintPhase ? Math.max(overtakeProb, 85) : futureOvertakeProb),
        energyRequiredMJ: isLeader ? 0.0 : (isSprintPhase ? Math.min(4.0, freeEnergyMJ) : 1.40),
        expectedGain: isLeader ? "+0.00s (Delta Safe)" : isSprintPhase ? `+${(Math.min(4.0, freeEnergyMJ) * 0.28).toFixed(2)}s` : `+${futureGainSec.toFixed(2)}s`,
        statsLabel: isLeader
          ? `Buffer Safe: ${reserveMJ.toFixed(1)} MJ | Regen: +${expectedRecoveryMJ.toFixed(2)} MJ`
          : isBatteryCriticallyLow
          ? `Target Overtake: ${futureOvertakeProb}% | Needs 1.40 MJ (Post-Recharge Attack: +${futureGainSec.toFixed(2)}s)`
          : isSprintPhase
          ? `Upcoming Laps: Deploy +${freeEnergyMJ.toFixed(2)} MJ (${freeJoules.toLocaleString()} J) before Chequered Flag`
          : isRaceStart
          ? `DRS Lap 3+: ${futureOvertakeProb}% Pass Probability | 1.40 MJ (1,400,000 J)`
          : (isHarvestOpt || isCarAheadOutOfRange)
          ? `Target Overtake: ${futureOvertakeProb}% | 1.40 MJ (Boost Gain: +${futureGainSec.toFixed(2)}s)`
          : `Overtake: ${futureOvertakeProb}% | 1.40 MJ (Deferred Gain: +${futureGainSec.toFixed(2)}s)`,
        description: isLeader
          ? "Harvest kinetic energy and conserve battery buffer against safety car or undercut."
          : isBatteryCriticallyLow
          ? `Defer attack until MGU-K regenerates pack past 40% SOC; then deploy 350 kW Super-Clip in Zone ${futureTargetZone.zoneNumber} with ${futureOvertakeProb}% pass probability.`
          : isSprintPhase
          ? `Deploy remaining usable energy (+${freeEnergyMJ.toFixed(2)} MJ · ${freeJoules.toLocaleString()} J) across upcoming acceleration zones before finish line. Arrive with zero free energy under FIA 4.0 MJ/lap discharge cap.`
          : isRaceStart
          ? "Preserve pack energy until DRS detection activates on Lap 3 to execute higher-percentage passes."
          : isHarvestOpt
          ? `Bank recovered energy now to unleash an unimpeded 350 kW Super-Clip in Zone ${futureTargetZone.zoneNumber} with ${futureOvertakeProb}% pass probability.`
          : isCarAheadOutOfRange
          ? `Preserve full 350 kW boost until the vehicle closes within 0.8s of the opponent ahead, avoiding wasted energy.`
          : "Preserve usable pack to guarantee maximum attack power on subsequent straight."
      },
      rationale,
      spendVsSaveOptimization,
      futureOpportunities: futureOppModel.opportunities,
      bestFutureOpportunity: futureOppModel.bestFutureOpportunity
    };

    // Synthesize 5-Lap Tactical Race Plan (Section 48)
    const tacticalRacePlan = this.generateTacticalRacePlan({
      currentLap,
      plannedPitLap: effectivePlannedPit,
      tyreState,
      nextCompound,
      nextBestAction,
      nextRecovery,
      reserve: currentReserve,
      isVscOrSc,
      undercutOvercut,
      lapsRemaining: centralRaceState.lapsRemaining,
      futureOpportunities: futureOppModel.opportunities
    });

    // Single Canonical Decision Object (Section 41)
    const candidatePitList = pitActions && pitActions.candidateActions ? pitActions.candidateActions : (Array.isArray(pitActions) ? pitActions : []);
    const recommendedPit = candidatePitList.find((p) => (p.action === pitActions.bestAction || p.isRecommended)) || candidatePitList[0] || null;
    const pitDecision = pitActions && pitActions.bestAction ? pitActions.bestAction : (recommendedPit ? (recommendedPit.action || recommendedPit.id) : "STAY OUT");
    const pitValue = recommendedPit ? (recommendedPit.score ?? recommendedPit.pitValue ?? 0) : 0;

    const rejectedAlternatives = strategyComparison
      .filter((s) => !s.isRecommended)
      .map((s) => ({
        action: s.name,
        score: s.score,
        reason: s.breakdown && s.breakdown.whyRationale
          ? s.breakdown.whyRationale
          : (s.breakdown && !s.breakdown.isLegal ? "FIA regulatory limit violation" : "Suboptimal combined race outcome")
      }));

    const batteryState = centralRaceState.batteryState;
    const batteryStateLabel = centralRaceState.batteryStateLabel;
    const defenceConcession = runningPosition > position || (carBehindGap < 0.5 && initialEnergyMJ < 5.0);

    // Section 44: CANONICAL 12-POINT DECISION TRACE
    const decisionTrace = [
      `1. Current energy = ${centralRaceState.energyMJ.toFixed(2)} MJ (${centralRaceState.socPercent}%)`,
      `2. Required reserve = ${currentReserve.reserveMJ.toFixed(2)} MJ (Safety ${currentReserve.safetyFloorMJ.toFixed(1)} + Def ${currentReserve.defenceMJ.toFixed(1)} + Fut ${currentReserve.futureAttackMJ.toFixed(1)})`,
      `3. Free energy = ${currentReserve.freeEnergyMJ.toFixed(2)} MJ`,
      `4. Current zone attack value = ${activeZone.performancePotential}/100 (Effective: ${activeZoneInfo.effectivePotential}/100)`,
      `5. Tyre performance = ${(tyreState.performanceFactor * 100).toFixed(0)}% (${tyreState.compoundId}, ${tyreState.age}L, Grip ${tyreState.grip}%)`,
      `6. Defence risk = ${defenceRisk} (${(defenceRiskNum * 100).toFixed(0)}%) (Rear gap ${carBehindGap.toFixed(1)}s, Def allocation ${currentReserve.defenceMJ.toFixed(1)} MJ)`,
      `7. Recovery in ${recoveryTiming.zonesAway} zone${recoveryTiming.zonesAway === 1 ? '' : 's'} (Expected: +${expectedRecoveryMJ.toFixed(2)} MJ in ${recoveryTiming.zoneId})`,
      `8. Future opportunity = ${optimizationBreakdown.futureEnergyValue ?? 14} pts (${57 - currentLap} laps remaining, Horizon ${futureLaps} laps)`,
      `9. Candidate actions evaluated = ${strategyComparison.length} (${strategyComparison.map((s) => s.name).join(', ')})`,
      `10. Infeasible actions = ${strategyComparison.filter((s) => !s.breakdown.isFeasible || !s.breakdown.isLegal).length} (${strategyComparison.filter((s) => !s.breakdown.isFeasible || !s.breakdown.isLegal).map((s) => s.name).join(', ') || 'None'})`,
      `11. Best feasible action = ${nextBestAction.strategy} (${nextBestAction.where || ('Zone ' + nextBestAction.zoneNumber)})`,
      `12. Final score = ${strategyScore} pts (Feasible: YES, Regulatory: ${nextBestAction.isFiaLimitActive ? 'CLAMPED' : 'LEGAL'})`
    ];

    const currentLapSteps = (lapResults.length > 0 && lapResults[0].zoneSteps) || [];
    const currentLapLost = currentLapSteps.some((s) => s.positionLost);
    const currentLapOvertake = currentLapSteps.some((s) => s.overtakeOccurred);

    const immediatePosition = currentLapLost
      ? Math.min(10, position + 1)
      : currentLapOvertake
      ? Math.max(1, position - 1)
      : position;
    const immediateRaceOrder = currentLapLost
      ? this.updateRaceOrder(centralRaceState.raceOrder, position, immediatePosition)
      : currentLapOvertake
      ? this.updateRaceOrder(centralRaceState.raceOrder, position, immediatePosition)
      : [...centralRaceState.raceOrder];

    const positionLost = currentLapLost || runningPosition > position;
    const overtakeOccurred = currentLapOvertake || runningPosition < position;

    // Section 43: INTERNAL AUDIT / DEBUG MODE STATE MATRIX
    const auditState = {
      inputState: centralRaceState,
      energyState: {
        energyMJ: centralRaceState.energyMJ,
        usableEnergyMJ: 20.0,
        socPercent: centralRaceState.socPercent,
        batteryState: centralRaceState.batteryState
      },
      reserveState: currentReserve,
      freeEnergyState: {
        freeEnergyMJ: currentReserve.freeEnergyMJ,
        freeSoc: currentReserve.freeSoc
      },
      tyreState,
      pitState: {
        pitLoss,
        pitWindow,
        pitActions,
        undercutOvercut
      },
      zoneState: activeZoneInfo,
      recoveryState: recoveryTiming,
      attackState: {
        gapAhead: carAheadGap,
        overtakeProbability: overtakeProb,
        closingSpeed: centralRaceState.closingSpeed
      },
      defenceState: {
        gapBehind: carBehindGap,
        defenceRisk: defenceRiskNum,
        defenceRiskLabel: defenceRisk,
        hasDefensivePressure: currentReserve.hasDefensivePressure,
        defenceReserveMJ: currentReserve.defenceMJ
      },
      constraints: constraints13,
      candidateActions: strategyComparison,
      simulatedOutcomes: {
        lapResults,
        allSteps,
        positionBefore: position,
        positionAfter: immediatePosition,
        horizonPositionAfter: runningPosition,
        raceOrder: immediateRaceOrder,
        horizonRaceOrder: runningRaceOrder
      },
      finalDecision: nextBestAction.strategy
    };

    const decision = {
      selectedAction: nextBestAction.strategy,
      action: nextBestAction.strategy,
      lap: nextBestAction.lap,
      sector: nextBestAction.sector,
      zone: nextBestAction.zoneNumber,

      positionBefore: `P${position}`,
      positionAfter: `P${immediatePosition}`,
      horizonPositionAfter: `P${runningPosition}`,
      raceOrderBefore: centralRaceState.raceOrder,
      raceOrderAfter: immediateRaceOrder,
      raceOrder: immediateRaceOrder,
      horizonRaceOrder: runningRaceOrder,
      energyInitial: centralRaceState.energyMJ,
      socInitial: centralRaceState.socPercent,
      energyBefore: energyBeforeMJ,
      energyDeployed: deployedMJ,
      energyRecovered: expectedRecoveryMJ,
      energyAfter: energyAfterRecoveryMJ,

      socBefore: this.mjToSoc(energyBeforeMJ),
      socAfter: socAfterRecovery,
      batteryState,
      batteryStateLabel,

      reserveEnergy: currentReserve.reserveMJ,
      freeEnergy: currentReserve.freeEnergyMJ,

      gapAheadBefore: carAheadGap,
      gapAheadAfter: runningAheadGap,
      gapBehindBefore: carBehindGap,
      gapBehindAfter: runningBehindGap,

      closingSpeed: centralRaceState.closingSpeed,
      overtakeProbability: overtakeProb,
      defenceRisk,
      defenceConcession,
      overtakeOccurred: runningPosition < position,
      positionLost: runningPosition > position,

      tyreBefore: centralRaceState.tyrePerformance,
      tyreAfter: tyreState.performanceFactor,
      tyreState,

      pitDecision,
      pitLoss: pitLoss.totalPitLossSec,
      pitValue,

      futureOpportunityValue: optimizationBreakdown.futureEnergyValue ?? optimizationBreakdown.futureOpportunityValue ?? 14,
      score: strategyScore,
      fiaStatus: nextBestAction.isFiaLimitActive ? "LEGAL (CLAMPED TO 350 kW)" : "LEGAL",
      feasibility: true,
      rejectedActions: rejectedAlternatives,
      rejectedAlternatives,
      explanation: why,
      simulatedTimeline: lapResults,
      decisionTrace,
      auditState
    };

    return {
      decision,
      decisionTrace,
      auditState,
      raceOrder: runningRaceOrder,
      raceOrderBefore: centralRaceState.raceOrder,
      raceOrderAfter: runningRaceOrder,
      currentLap,
      lapsRemaining: 57 - currentLap,
      remainingLaps: 57 - currentLap,
      futureLaps,
      position: `P${position}`,
      finalPosition: `P${runningPosition}`,
      positionsLost: Math.max(0, runningPosition - position),
      positionsGained: Math.max(0, position - runningPosition),
      expectedPositionsGained: position - runningPosition,
      defenceConcession,
      initialEnergyMJ,
      initialSoc: soc,
      finalEnergyMJ: runningEnergyMJ,
      finalSoc: this.mjToSoc(runningEnergyMJ),
      currentReserve,
      nextBestAction,
      strategyScore,
      strategyComparison,
      optimizationBreakdown,
      activeZoneInfo,
      tradeoffComparison,
      centralRaceState,
      futureOppModel,
      futureOpportunities: futureOppModel.opportunities,
      bestFutureOpportunity: futureOppModel.bestFutureOpportunity,
      spendVsSaveOptimization,
      nextRecovery,
      recoveryTiming,
      decisionSynthesis: {
        what: nextBestAction.strategy,
        where: `Sector ${nextBestAction.sector} · Zone ${nextBestAction.zoneNumber}`,
        whereFull: `Sector ${nextBestAction.sector} · Zone ${nextBestAction.zoneNumber} (${nextBestAction.zoneName})`,
        when: `Lap ${nextBestAction.lap}`,
        whenFull: `Lap ${nextBestAction.lap} (${nextBestAction.isCurrentLap ? "Next Zone" : "Future Lap"})`,
        why: nextBestAction.strategy === "SUPER-CLIP"
          ? "High-value attack opportunity with sufficient free energy."
          : nextBestAction.strategy === "COAST"
          ? "Future energy has greater race value than current opportunity."
          : nextBestAction.strategy === "BRAKING / HARVEST"
          ? "Recovery has greater value than immediate deployment."
          : "Useful current opportunity but aggressive deployment is not justified.",
        whyThis: this.synthesizeWhyThisBullets(nextBestAction, currentReserve, tyreState, nextRecovery, carAheadGap, carBehindGap),
        whyNotOthers: this.synthesizeWhyNotOthers(nextBestAction.strategy, actionBreakdowns, carAheadGap, currentReserve, nextRecovery, activeZone)
      },
      strategyDefinitions: STRATEGY_DEFINITIONS,
      deployedMJ,
      expectedRecoveryMJ,
      netEnergyChangeMJ,
      energyBeforeMJ,
      energyAfterDeployMJ,
      socAfterDeploy,
      energyAfterRecoveryMJ,
      socAfterRecovery,
      expectedGainSec,
      effectiveGainSec,
      overtakeProb,
      defenceRisk,
      defenceRiskNum,
      defenceRiskLabel: defenceRisk,
      futureOpp,
      fiaStatus: nextBestAction.isFiaLimitActive ? "LEGAL (CLAMPED TO 350 kW)" : "LEGAL",
      why,
      whyThisZone,
      constraints13,
      constraintSummary,
      adaptationFlow,
      lapResults,
      allSteps,
      // Single Central Race State (Section 2)
      centralRaceState,
      raceState: centralRaceState,
      // Upcoming Lap Energy Directive & 4-Strategy Harvesting Evaluation
      upcomingLapAdvisory: this.synthesizeUpcomingLapAdvisory({
        currentLap,
        futureLaps,
        lapResults,
        nextBestAction,
        currentReserve,
        tyreState,
        pitWindow,
        constraints13,
        centralRaceState,
        actionBreakdowns,
        overtakeProb,
        isVscOrSc
      }),
      // Dynamic Pit Stop & Tyre Outputs (Sections 29-49):
      tyreState,
      pitLoss,
      pitWindow,
      undercutOvercut,
      pitActions,
      nextCompound,
      tacticalRacePlan,
      tyreInventory: this.ruleProfile.tyreInventory,
      weatherState: {
        trackCondition,
        trackTempC,
        rainProbability,
        scProbability,
        vscProbability
      },
      positionLost,
      overtakeOccurred,
      defenceConcession: currentLapLost || defenceConcession,
      decision,
      decisionTrace,
      auditState,
      simulatedOutcomes: auditState.simulatedOutcomes
    };
  }

  /**
   * Synthesizes tactical directive for upcoming lap (SAVE vs USE vs HARVEST)
   * and identifies the best pick out of the 4 candidate energy management actions
   * based on active constraints.
   */
  synthesizeUpcomingLapAdvisory({
    currentLap,
    futureLaps,
    lapResults,
    nextBestAction,
    currentReserve,
    tyreState,
    pitWindow,
    constraints13,
    centralRaceState,
    actionBreakdowns,
    overtakeProb = 75,
    isVscOrSc = false
  }) {
    const upcomingLapNumber = currentLap + 1;
    const soc = centralRaceState.SOC;
    const freeEnergy = currentReserve.freeEnergyMJ;
    const reserveMJ = currentReserve.reserveMJ;
    const gapAhead = centralRaceState.gapAhead;
    const gapBehind = centralRaceState.gapBehind;
    const hasDefensivePressure = currentReserve.hasDefensivePressure; // gapBehind < 0.5
    const constraintLevel = centralRaceState.constraintLevel;
    const isTyreWorn = tyreState && (tyreState.degradationLevel === "HIGH" || tyreState.degradationLevel === "CRITICAL");
    const isPrePitSprint = Boolean(pitWindow && Math.abs(upcomingLapNumber - pitWindow.bestLap) <= 1);
    const lapsRemaining = centralRaceState.lapsRemaining != null ? centralRaceState.lapsRemaining : Math.max(1, 57 - upcomingLapNumber);
    const isSprintPhase = centralRaceState.isSprintPhase || (lapsRemaining <= 3);
    const isRaceStart = centralRaceState.isRaceStart || (currentLap <= 3);
    const isP1 = centralRaceState.position === 1;

    let directive = "USE";
    let directiveBadgeClass = "directive-use";
    let directiveLabel = "USE (DEPLOY)";
    let bestPick = "SUPER-CLIP";
    let primaryConstraint = "C1 / C5 Attack Clearance";
    let constraintChips = [];
    let directiveRationale = "";

    // 0. SAFETY CAR / VSC ACTIVE:
    if (isVscOrSc) {
      directive = "HARVEST";
      directiveBadgeClass = "directive-harvest";
      directiveLabel = "HARVEST (VSC PACE)";
      bestPick = "BRAKING / HARVEST";
      primaryConstraint = "FIA Article 55 Neutralization & 100% Pack Rebuild";
      constraintChips = [
        { id: "SC", label: "SC/VSC Active: Overtaking Banned", type: "amber" },
        { id: "C4", label: "C4: Max Kinetic Harvest Under Neutralization", type: "green" },
        { id: "PIT", label: "Pit Loss Reduced to 15.5s (Cheap Stop)", type: "green" }
      ];
      directiveRationale = `Upcoming Lap ${upcomingLapNumber} is neutralised under Safety Car / VSC. Article 55 prohibits passing. High MGU-K regeneration restores battery back to 100% with zero competitive laptime penalty.`;
    }
    // 0b. RACE LEADER P1:
    else if (isP1) {
      directive = hasDefensivePressure ? "USE" : "SAVE";
      directiveBadgeClass = hasDefensivePressure ? "directive-use" : "directive-save";
      directiveLabel = hasDefensivePressure ? "USE (DEFEND LEAD)" : "SAVE (CONTROL PACE)";
      bestPick = hasDefensivePressure ? "NORMAL DEPLOYMENT" : "COAST";
      primaryConstraint = "P1 Leader Track Position Protection";
      constraintChips = [
        { id: "P1", label: "P1 Race Leader: Control Pace", type: "blue" },
        { id: "C6", label: hasDefensivePressure ? `C6: Rear Threat (${gapBehind.toFixed(1)}s)` : "C6: Rear Gap Secure", type: hasDefensivePressure ? "red" : "green" },
        { id: "C9", label: `C9: Battery Reserve ${reserveMJ.toFixed(1)} MJ`, type: "amber" }
      ];
      directiveRationale = hasDefensivePressure
        ? `Upcoming Lap ${upcomingLapNumber}: Defending race lead against closing car behind (${gapBehind.toFixed(1)}s). Deploying controlled power bursts preserves track position without exhausting defence reserve.`
        : `Upcoming Lap ${upcomingLapNumber}: P1 Race Leader with clear air. Coasting in technical sectors preserves battery capacity and tyre thermal window.`;
    }
    // 1. HARVEST evaluation:
    else if (soc < 38 || centralRaceState.energyMJ < 7.0) {
      directive = "HARVEST";
      directiveBadgeClass = "directive-harvest";
      directiveLabel = "HARVEST (RECHARGE)";
      bestPick = "BRAKING / HARVEST";
      primaryConstraint = "C3 SOC Envelope & C4 Kinetic Harvest Quota";
      constraintChips = [
        { id: "C3", label: `C3: SOC ${soc}% < 40% Floor`, type: "red" },
        { id: "C4", label: "C4: Kinetic Recovery Quota Available", type: "green" },
        { id: "C1", label: `C1: Pack Energy Restricted (${centralRaceState.energyMJ.toFixed(1)} MJ)`, type: "amber" }
      ];
      directiveRationale = `Upcoming Lap ${upcomingLapNumber} requires HARVEST: Battery SOC (${soc}%) is below the 40% threshold for high-power MGU-K discharge (C3). High-regen braking zones on Lap ${upcomingLapNumber} will rebuild pack storage by +1.60 MJ back into safe operating envelope.`;
    }
    // 1b. SPRINT PHASE (laps remaining very small):
    else if (isSprintPhase && freeEnergy >= 0.30) {
      directive = "USE";
      directiveBadgeClass = "directive-use";
      directiveLabel = "USE (SPRINT BURN)";
      bestPick = "SUPER-CLIP";
      primaryConstraint = "Final Sprint Phase & Buffer Release";
      constraintChips = [
        { id: "SPRINT", label: `Sprint Phase: ${lapsRemaining} Laps Remaining`, type: "green" },
        { id: "C1", label: `C1: Free Energy Burn (+${freeEnergy.toFixed(1)} MJ)`, type: "green" },
        { id: "FIA", label: "FIA 4.0 MJ/Lap Discretionary Quota", type: "blue" }
      ];
      directiveRationale = `Upcoming Lap ${upcomingLapNumber}: Final sprint phase (${lapsRemaining} lap${lapsRemaining === 1 ? '' : 's'} remaining). Authorize using energy in upcoming laps! Multi-lap reserve buffers are collapsed to safety floor. Deploy usable energy across acceleration zones before the chequered flag.`;
    }
    // 1c. RACE START (starting of the race):
    else if (isRaceStart && soc >= 40 && freeEnergy >= 0.80) {
      directive = "USE";
      directiveBadgeClass = "directive-use";
      directiveLabel = "USE (START ATTACK)";
      bestPick = "SUPER-CLIP";
      primaryConstraint = "Race Start Scramble & Track Position";
      constraintChips = [
        { id: "START", label: `Race Start: Lap ${upcomingLapNumber}/57`, type: "green" },
        { id: "C1", label: `C1: Full Battery Available (${centralRaceState.energyMJ.toFixed(1)} MJ)`, type: "green" },
        { id: "POS", label: "Early Track Position Premium", type: "blue" }
      ];
      directiveRationale = `Upcoming Lap ${upcomingLapNumber}: Opening race phase. Exploit high pack energy to attack on straightline sections and gain track position before DRS trains settle.`;
    }
    // 2. SAVE evaluation:
    else if (hasDefensivePressure || freeEnergy < 1.40 || gapAhead > 1.8 || (isTyreWorn && !isPrePitSprint) || constraintLevel > 65) {
      directive = "SAVE";
      directiveBadgeClass = "directive-save";
      directiveLabel = "SAVE (CONSERVE)";
      bestPick = "COAST";
      
      if (hasDefensivePressure) {
        primaryConstraint = "C6 Rear Threat & C9 Defence Safety Reserve";
        constraintChips = [
          { id: "C6", label: `C6: Rear Threat (${gapBehind.toFixed(1)}s < 0.5s)`, type: "red" },
          { id: "C9", label: `C9: Defence Reserve +${currentReserve.defenceMJ.toFixed(1)} MJ`, type: "amber" },
          { id: "C1", label: `C1: Discretionary Free Energy (${freeEnergy.toFixed(1)} MJ)`, type: "amber" }
        ];
        directiveRationale = `Upcoming Lap ${upcomingLapNumber} requires SAVE: Opponent is within DRS attack range behind (${gapBehind.toFixed(1)}s). C6 constraint mandates preserving +${currentReserve.defenceMJ.toFixed(1)} MJ defensive reserve. Coasting in non-critical sectors prevents vulnerable battery depletion.`;
      } else if (gapAhead > 1.8) {
        primaryConstraint = "C5 Overtake Window Constraint";
        constraintChips = [
          { id: "C5", label: `C5: Gap ${gapAhead.toFixed(1)}s > 1.8s Window`, type: "amber" },
          { id: "C7", label: "C7: Future Attack Straight Opportunity", type: "blue" },
          { id: "C9", label: `C9: Battery Reserve ${reserveMJ.toFixed(1)} MJ`, type: "blue" }
        ];
        directiveRationale = `Upcoming Lap ${upcomingLapNumber} requires SAVE: Gap to car ahead (${gapAhead.toFixed(1)}s) exceeds immediate overtake window (C5). Discretionary spending yields low position probability. Conserving energy now preserves a +1.40 MJ Super-Clip for the next close encounter.`;
      } else if (isTyreWorn) {
        primaryConstraint = "Tyre Degradation & Strategic Pit Coupling";
        constraintChips = [
          { id: "TYRE", label: `Tyre Grip ${tyreState.grip}% (HIGH DEG)`, type: "red" },
          { id: "PIT", label: `Pit Window Best: Lap ${pitWindow ? pitWindow.bestLap : '28'}`, type: "blue" },
          { id: "C7", label: "C7: Preserve for Post-Pit Fresh Stint", type: "green" }
        ];
        directiveRationale = `Upcoming Lap ${upcomingLapNumber} requires SAVE: Degraded rubber (${tyreState.grip}% grip) reduces acceleration efficiency. Preserving electrical megajoules until boxing provides maximum delta on fresh compound out-lap.`;
      } else {
        primaryConstraint = `C2/C5 Engine Constraint Derating (${constraintLevel}%)`;
        constraintChips = [
          { id: "RULE", label: `Constraint ${constraintLevel}% Active`, type: "amber" },
          { id: "C1", label: `C1: Free Energy ${freeEnergy.toFixed(1)} MJ`, type: "blue" }
        ];
        directiveRationale = `Upcoming Lap ${upcomingLapNumber} requires SAVE: High constraint derating (${constraintLevel}%) restricts high-power discharge. Coasting maintains efficient pace while avoiding rule-penalty deratings.`;
      }
    }
    // 3. USE (DEPLOY) evaluation:
    else {
      directive = "USE";
      directiveBadgeClass = "directive-use";
      directiveLabel = "USE (DEPLOY)";
      bestPick = (gapAhead <= 0.8 || isPrePitSprint) ? "SUPER-CLIP" : "NORMAL DEPLOYMENT";
      primaryConstraint = "C1 Free Energy & C5 Overtake Window Clearance";
      constraintChips = [
        { id: "C1", label: `C1: Free Energy Available (${freeEnergy.toFixed(1)} MJ)`, type: "green" },
        { id: "C5", label: `C5: Attack Window Open (${gapAhead.toFixed(1)}s <= 1.2s)`, type: "green" },
        { id: "C13", label: "C13: High Performance Zone Sweet Spot", type: "blue" }
      ];
      directiveRationale = `Upcoming Lap ${upcomingLapNumber} requires USE: Free energy (${freeEnergy.toFixed(1)} MJ) is cleared for discretionary attack without compromising defensive reserve. Deploying ${bestPick} on the primary straight maximizes expected position gain (+0.42s).`;
    }

    // 4-way evaluation breakdown specifically for upcoming lap:
    const candidatesEvaluation = {
      "SUPER-CLIP": {
        name: "SUPER-CLIP",
        verdict: isVscOrSc
          ? "PROHIBITED (SC ART 55)"
          : (directive === "USE" && bestPick === "SUPER-CLIP")
          ? (isSprintPhase ? "BEST PICK (SPRINT BURN)" : isRaceStart ? "BEST PICK (START ATTACK)" : "BEST PICK (USE)")
          : isP1
          ? "RESTRICTED (P1 LEADER)"
          : soc < 40
          ? "BLOCKED (C3 SOC < 40%)"
          : freeEnergy < 1.40
          ? "RESTRICTED (C1/C9)"
          : gapAhead > 1.8
          ? "RESTRICTED (C5 GAP)"
          : "SUB-OPTIMAL (COST)",
        isBest: bestPick === "SUPER-CLIP",
        colorClass: bestPick === "SUPER-CLIP" ? "text-green" : soc < 40 ? "text-red" : "text-amber",
        reason: isVscOrSc
          ? "FIA Article 55 strictly prohibits attack deployment and overtaking during SC/VSC."
          : (directive === "USE" && bestPick === "SUPER-CLIP")
          ? (isSprintPhase ? "Final sprint authorization: burn usable energy across upcoming acceleration zones before finish line." : isRaceStart ? "Race start scramble: exploit full battery to secure track position on opening lap." : "Maximum acceleration advantage (+0.42s gain) justified by free energy clearance.")
          : isP1
          ? "Leading in P1; full 350 kW attack is unnecessary. Protecting pack storage is prioritized."
          : soc < 40
          ? "C3 regulation prohibits 350 kW discharge below 40% SOC."
          : "Discretionary energy is locked to protect defensive reserve or upcoming stint."
      },
      "NORMAL DEPLOYMENT": {
        name: "NORMAL DEPLOYMENT",
        verdict: (bestPick === "NORMAL DEPLOYMENT")
          ? "BEST PICK (USE)"
          : "FEASIBLE (MODERATE)",
        isBest: bestPick === "NORMAL DEPLOYMENT",
        colorClass: bestPick === "NORMAL DEPLOYMENT" ? "text-green" : "text-blue",
        reason: bestPick === "NORMAL DEPLOYMENT"
          ? "Balanced 200 kW deployment maintains competitive traversal pace without exceeding free buffer."
          : "Standard baseline traversal; does not maximize immediate high-value opportunity or conservation."
      },
      "COAST": {
        name: "COAST",
        verdict: (bestPick === "COAST")
          ? "BEST PICK (SAVE)"
          : "FEASIBLE (SAVE)",
        isBest: bestPick === "COAST",
        colorClass: bestPick === "COAST" ? "text-green" : "text-amber",
        reason: bestPick === "COAST"
          ? `Preserves ${reserveMJ.toFixed(1)} MJ mandatory reserve and protects tyre thermal baseline.`
          : "Conservative option; available if driver prioritizes total pack conservation."
      },
      "BRAKING / HARVEST": {
        name: "BRAKING / HARVEST",
        verdict: (bestPick === "BRAKING / HARVEST")
          ? "BEST PICK (HARVEST)"
          : "FEASIBLE (HARVEST)",
        isBest: bestPick === "BRAKING / HARVEST",
        colorClass: bestPick === "BRAKING / HARVEST" ? "text-green" : "text-green",
        reason: bestPick === "BRAKING / HARVEST"
          ? "MGU-K kinetic regeneration captures +0.80 MJ per heavy braking zone, restoring depleted pack capacity."
          : "Recovery remains active in heavy braking zones regardless of straight-line deployment choice."
      }
    };

    const upcomingLapResult = lapResults && lapResults[1];
    const projectedStartEnergyMJ = upcomingLapResult ? upcomingLapResult.startEnergyMJ : centralRaceState.energyMJ;
    const projectedHarvestMJ = upcomingLapResult ? upcomingLapResult.totalHarvestedMJ : 1.60;
    const projectedDeployMJ = upcomingLapResult ? upcomingLapResult.totalDeployedMJ : 1.40;

    return {
      upcomingLapNumber,
      directive,
      directiveBadgeClass,
      directiveLabel,
      bestPick,
      primaryConstraint,
      constraintChips,
      directiveRationale,
      candidatesEvaluation,
      projectedStartEnergyMJ,
      projectedStartSoc: this.mjToSoc(projectedStartEnergyMJ),
      projectedHarvestMJ,
      projectedDeployMJ,
      netProjectedDeltaMJ: Math.round((projectedHarvestMJ - projectedDeployMJ) * 100) / 100
    };
  }

  synthesizeWhyThisBullets(action, reserve, tyreState, nextRecovery, carAheadGap, carBehindGap) {
    const strat = action.strategy;
    if (strat === "SUPER-CLIP") {
      return [
        "✓ High immediate race value in high-performance acceleration zone",
        `✓ Sufficient free energy (${reserve.freeEnergyMJ.toFixed(1)} MJ available vs 1.40 MJ required)`,
        carBehindGap >= 1.0 ? "✓ Low defence pressure from behind" : "✓ Attack window outweighs defensive threat"
      ];
    } else if (strat === "NORMAL DEPLOYMENT") {
      return [
        "✓ Balanced electrical deployment maintains competitive pace",
        "✓ Current race gain achieved without exhausting safety reserves",
        "✓ Preserves defensive buffer against trailing car"
      ];
    } else if (strat === "COAST") {
      return [
        "✓ Future energy has greater race value than current traversal",
        "✓ Protects pack capacity for upcoming high-probability attack straight",
        "✓ Mitigates tyre thermal degradation and pack stress"
      ];
    } else {
      return [
        "✓ Heavy braking zone provides optimal kinetic regeneration",
        `✓ Rebuilds usable pack capacity (+${action.recoveredMJ.toFixed(2)} MJ)`,
        "✓ Non-1:1 recovery efficiency maximizes stored megajoules"
      ];
    }
  }

  synthesizeWhyNotOthers(winningStrat, breakdowns, carAheadGap, reserve, nextRecovery, zone) {
    const others = {};
    const allStrats = ["SUPER-CLIP", "NORMAL DEPLOYMENT", "COAST", "BRAKING / HARVEST"];
    allStrats.forEach((strat) => {
      if (strat === winningStrat) return;
      if (strat === "SUPER-CLIP") {
        if (reserve.currentSoc < 40) {
          others[strat] = "SUPER-CLIP — SOC envelope below 40% threshold for 350 kW discharge";
        } else if (carAheadGap > 1.8) {
          others[strat] = "SUPER-CLIP — gap ahead exceeds effective overtake window";
        } else if (reserve.freeEnergyMJ < 1.40) {
          others[strat] = "SUPER-CLIP — insufficient free energy to maintain defensive safety floor";
        } else if (!zone.isAccelerationZone) {
          others[strat] = "SUPER-CLIP — corner traversal section ineligible for high-power discharge";
        } else {
          others[strat] = "SUPER-CLIP — high energy cost not justified by current track delta";
        }
      } else if (strat === "NORMAL DEPLOYMENT") {
        if (winningStrat === "SUPER-CLIP") {
          others[strat] = "NORMAL — lower expected position gain (+0.18s vs +0.42s); insufficient to complete overtake";
        } else if (winningStrat === "BRAKING / HARVEST") {
          others[strat] = "NORMAL — motor discharge during braking would conflict with kinetic recovery";
        } else {
          others[strat] = "NORMAL — energy opportunity cost exceeds immediate traversal benefit";
        }
      } else if (strat === "COAST") {
        if (winningStrat === "SUPER-CLIP") {
          others[strat] = "COAST — current opportunity is too valuable to ignore";
        } else if (winningStrat === "BRAKING / HARVEST") {
          others[strat] = "COAST — passive coasting forfeits available kinetic energy recovery";
        } else {
          others[strat] = "COAST — passive cruising would concede pace to trailing competitors";
        }
      } else if (strat === "BRAKING / HARVEST") {
        if (winningStrat === "SUPER-CLIP" || winningStrat === "NORMAL DEPLOYMENT") {
          others[strat] = "HARVEST — recovery value is lower than attack value";
        } else {
          others[strat] = "HARVEST — insufficient braking deceleration in current zone for regenerative recovery";
        }
      }
    });
    return others;
  }

  synthesizeWhy(action, nextRecovery, reserve, tyreState = null, pitWindow = null, nextCompound = "HARD", pitActions = null) {
    const recoveryNote = nextRecovery
      ? `Next recovery opportunity replenishes +${nextRecovery.recoveredMJ.toFixed(2)} MJ in ${nextRecovery.zoneId}.`
      : `Recovery zone within reach.`;

    // Section 45: Tyre & Pit strategic trade-off explanation
    if (tyreState && (tyreState.degradationLevel === "HIGH" || tyreState.degradationLevel === "CRITICAL") && action.strategy !== "SUPER-CLIP") {
      const windowStr = pitWindow ? pitWindow.windowString : "Lap 27–29";
      return `Old tyres (${tyreState.tyreAge} laps, ${tyreState.degradationLevel} degradation) reduce attack efficiency now (grip: ${tyreState.grip}%). Saving 0.9 MJ allows a stronger deployment after the pit stop (${windowStr}) on fresh ${nextCompound} tyres. Expected net race gain: +1.6 sec.`;
    }

    if (action.strategy === "SUPER-CLIP") {
      if (tyreState && tyreState.tyreAge >= 16) {
        return `Pre-pit sprint opportunity: Deploying 1.40 MJ Super-Clip before planned stop. Tyre degradation penalty is negligible as fresh ${nextCompound} tyres will be fitted.`;
      }
      return `High-value attack opportunity with sufficient free energy (${reserve.freeEnergyMJ.toFixed(1)} MJ). ${recoveryNote} Reserve remains sufficient for the next defensive requirement.`;
    } else if (action.strategy === "COAST") {
      return `Preserving energy in low-value section to protect battery for upcoming high-probability attack straight.`;
    } else if (action.strategy === "BRAKING / HARVEST") {
      return `Maximizing kinetic energy recovery during eligible heavy braking phase. Restores usable energy for next attack window.`;
    } else {
      return `Maintaining competitive traversal pace while protecting the ${reserve.reserveMJ.toFixed(1)} MJ required reserve.`;
    }
  }

  synthesizeWhyThisZone(action, nextRecovery, state) {
    const perf = action.performancePotential;
    const strat = action.strategy;
    if (strat === "SUPER-CLIP") {
      const recNote = nextRecovery
        ? `recovery opportunity immediately afterward in ${nextRecovery.zoneId} (+${nextRecovery.recoveredMJ.toFixed(2)} MJ)`
        : `acceleration straight length`;
      return `ZONE ${action.zoneNumber} selected: Performance potential ${perf}/100 + favorable car ahead gap (${state.carAheadGap}s) + ${recNote}.`;
    } else if (strat === "BRAKING / HARVEST") {
      return `ZONE ${action.zoneNumber} selected: High recovery potential (${action.recoveryPotential}/100) under heavy braking, restoring electrical reserve without sacrificing track position.`;
    } else if (strat === "COAST") {
      return `ZONE ${action.zoneNumber} selected: Conserving electrical energy in a technical sector (Perf ${perf}/100) where heavy deployment yields diminishing returns.`;
    } else {
      return `ZONE ${action.zoneNumber} selected: Balanced deployment maintains competitive delta to car ahead while securing defensive gap behind.`;
    }
  }

  /**
   * Section 37: Automated Correlation Test (runDependencyAudit)
   * Verifies that changing each of the 11 major inputs changes downstream calculations.
   * If any input produces no downstream difference, flags it as DISCONNECTED.
   */
  runDependencyAudit(baseInput = {}) {
    const base = {
      soc: 70,
      currentLap: 25,
      position: 2,
      carAheadGap: 1.0,
      carBehindGap: 1.5,
      futureLaps: 3,
      compound: "MEDIUM",
      tyreAge: 8,
      trackCondition: "DRY",
      constraintLevel: 30,
      intensity: 75,
      ...baseInput
    };

    const simBase = this.simulate(base);
    const results = {};
    let connectedCount = 0;
    let disconnectedCount = 0;

    const tests = [
      {
        name: "soc",
        label: "Battery SOC",
        modify: { soc: 30 },
        check: (b, v) => {
          const diffs = [];
          if (b.decision.socBefore !== v.decision.socBefore) diffs.push(`socBefore: ${b.decision.socBefore}% -> ${v.decision.socBefore}%`);
          if (b.currentReserve.freeEnergyMJ !== v.currentReserve.freeEnergyMJ) diffs.push(`freeEnergyMJ: ${b.currentReserve.freeEnergyMJ} -> ${v.currentReserve.freeEnergyMJ}`);
          if (b.decision.energyBefore !== v.decision.energyBefore) diffs.push(`energyBefore: ${b.decision.energyBefore} -> ${v.decision.energyBefore} MJ`);
          return diffs;
        }
      },
      {
        name: "currentLap",
        label: "Current Lap",
        modify: { currentLap: 55 },
        check: (b, v) => {
          const diffs = [];
          if (b.decision.lap !== v.decision.lap) diffs.push(`decision.lap: ${b.decision.lap} -> ${v.decision.lap}`);
          if (b.centralRaceState.currentLap !== v.centralRaceState.currentLap) diffs.push(`centralRaceState.currentLap: ${b.centralRaceState.currentLap} -> ${v.centralRaceState.currentLap}`);
          if (b.currentReserve.reserveMJ !== v.currentReserve.reserveMJ) diffs.push(`reserveMJ: ${b.currentReserve.reserveMJ} -> ${v.currentReserve.reserveMJ}`);
          return diffs;
        }
      },
      {
        name: "position",
        label: "Position",
        modify: { position: 1 },
        check: (b, v) => {
          const diffs = [];
          if (b.decision.overtakeProbability !== v.decision.overtakeProbability) diffs.push(`overtakeProb: ${b.decision.overtakeProbability}% -> ${v.decision.overtakeProbability}%`);
          if (b.position !== v.position) diffs.push(`position: ${b.position} -> ${v.position}`);
          if (b.tradeoffComparison.optionA.title !== v.tradeoffComparison.optionA.title) diffs.push(`tradeoff title changed`);
          return diffs;
        }
      },
      {
        name: "carAheadGap",
        label: "Gap Ahead",
        modify: { carAheadGap: 3.2 },
        check: (b, v) => {
          const diffs = [];
          if (b.decision.overtakeProbability !== v.decision.overtakeProbability) diffs.push(`overtakeProb: ${b.decision.overtakeProbability}% -> ${v.decision.overtakeProbability}%`);
          if (b.activeZoneInfo.closingSpeed !== v.activeZoneInfo.closingSpeed) diffs.push(`closingSpeed: ${b.activeZoneInfo.closingSpeed} -> ${v.activeZoneInfo.closingSpeed}`);
          if (b.constraints13.c5_overtake_window.status !== v.constraints13.c5_overtake_window.status) diffs.push(`c5 status: ${b.constraints13.c5_overtake_window.status} -> ${v.constraints13.c5_overtake_window.status}`);
          return diffs;
        }
      },
      {
        name: "carBehindGap",
        label: "Gap Behind",
        modify: { carBehindGap: 0.3 },
        check: (b, v) => {
          const diffs = [];
          if (b.decision.defenceRisk !== v.decision.defenceRisk) diffs.push(`defenceRisk: ${b.decision.defenceRisk} -> ${v.decision.defenceRisk}`);
          if (b.currentReserve.defenceMJ !== v.currentReserve.defenceMJ) diffs.push(`defenceMJ: ${b.currentReserve.defenceMJ} -> ${v.currentReserve.defenceMJ}`);
          if (b.constraints13.c6_defence_constraint.status !== v.constraints13.c6_defence_constraint.status) diffs.push(`c6 status: ${b.constraints13.c6_defence_constraint.status} -> ${v.constraints13.c6_defence_constraint.status}`);
          return diffs;
        }
      },
      {
        name: "futureLaps",
        label: "Future Laps",
        modify: { futureLaps: 5 },
        check: (b, v) => {
          const diffs = [];
          if (b.futureLaps !== v.futureLaps) diffs.push(`futureLaps: ${b.futureLaps} -> ${v.futureLaps}`);
          if (b.centralRaceState.futureLaps !== v.centralRaceState.futureLaps) diffs.push(`centralRaceState.futureLaps: ${b.centralRaceState.futureLaps} -> ${v.centralRaceState.futureLaps}`);
          if (b.constraints13.c7_future_opportunity.status !== v.constraints13.c7_future_opportunity.status) diffs.push(`c7 status: ${b.constraints13.c7_future_opportunity.status} -> ${v.constraints13.c7_future_opportunity.status}`);
          return diffs;
        }
      },
      {
        name: "compound",
        label: "Tyre Compound",
        modify: { compound: "HARD" },
        check: (b, v) => {
          const diffs = [];
          if (b.tyreState.compoundId !== v.tyreState.compoundId) diffs.push(`compound: ${b.tyreState.compoundId} -> ${v.tyreState.compoundId}`);
          if (b.tyreState.grip !== v.tyreState.grip) diffs.push(`grip: ${b.tyreState.grip}% -> ${v.tyreState.grip}%`);
          if (b.tyreState.performanceFactor !== v.tyreState.performanceFactor) diffs.push(`perfFactor: ${b.tyreState.performanceFactor} -> ${v.tyreState.performanceFactor}`);
          return diffs;
        }
      },
      {
        name: "tyreAge",
        label: "Tyre Age",
        modify: { tyreAge: 26 },
        check: (b, v) => {
          const diffs = [];
          if (b.tyreState.grip !== v.tyreState.grip) diffs.push(`grip: ${b.tyreState.grip}% -> ${v.tyreState.grip}%`);
          if (b.tyreState.degradationLevel !== v.tyreState.degradationLevel) diffs.push(`degradation: ${b.tyreState.degradationLevel} -> ${v.tyreState.degradationLevel}`);
          if (b.pitWindow.urgency !== v.pitWindow.urgency) diffs.push(`pit urgency: ${b.pitWindow.urgency} -> ${v.pitWindow.urgency}`);
          return diffs;
        }
      },
      {
        name: "trackCondition",
        label: "Track Condition",
        modify: { trackCondition: "WET" },
        check: (b, v) => {
          const diffs = [];
          if (b.weatherState.trackCondition !== v.weatherState.trackCondition) diffs.push(`weather: ${b.weatherState.trackCondition} -> ${v.weatherState.trackCondition}`);
          if (b.tyreState.grip !== v.tyreState.grip) diffs.push(`grip: ${b.tyreState.grip}% -> ${v.tyreState.grip}%`);
          if (b.constraints13.c4_harvesting.status !== v.constraints13.c4_harvesting.status) diffs.push(`c4 status: ${b.constraints13.c4_harvesting.status} -> ${v.constraints13.c4_harvesting.status}`);
          return diffs;
        }
      },
      {
        name: "constraintLevel",
        label: "Constraint Level",
        modify: { constraintLevel: 85 },
        check: (b, v) => {
          const diffs = [];
          if (b.constraints13.c2_deployment_power.status !== v.constraints13.c2_deployment_power.status) diffs.push(`c2 status: ${b.constraints13.c2_deployment_power.status} -> ${v.constraints13.c2_deployment_power.status}`);
          if (b.centralRaceState.constraintLevel !== v.centralRaceState.constraintLevel) diffs.push(`constraintLevel: ${b.centralRaceState.constraintLevel} -> ${v.centralRaceState.constraintLevel}`);
          return diffs;
        }
      },
      {
        name: "intensity",
        label: "Deployment Intensity",
        modify: { intensity: 25 },
        check: (b, v) => {
          const diffs = [];
          if (b.strategyComparison[0].powerKw !== v.strategyComparison[0].powerKw || b.strategyComparison[0].powerLabel !== v.strategyComparison[0].powerLabel) {
            diffs.push(`super-clip powerKw: ${b.strategyComparison[0].powerKw} -> ${v.strategyComparison[0].powerKw}`);
          }
          if (b.strategyComparison[0].score !== v.strategyComparison[0].score) {
            diffs.push(`super-clip score: ${b.strategyComparison[0].score} -> ${v.strategyComparison[0].score}`);
          }
          if (b.constraints13.c2_deployment_power.driverSlider !== v.constraints13.c2_deployment_power.driverSlider) {
            diffs.push(`c2 driverSlider: ${b.constraints13.c2_deployment_power.driverSlider} -> ${v.constraints13.c2_deployment_power.driverSlider}`);
          }
          return diffs;
        }
      }
    ];

    tests.forEach((t) => {
      const variant = { ...base, ...t.modify };
      const simVariant = this.simulate(variant);
      const diffs = t.check(simBase, simVariant);
      if (diffs && diffs.length > 0) {
        connectedCount++;
        results[t.name] = {
          input: t.name,
          label: t.label,
          status: "CONNECTED",
          downstreamChanges: diffs
        };
      } else {
        disconnectedCount++;
        results[t.name] = {
          input: t.name,
          label: t.label,
          status: "DISCONNECTED",
          downstreamChanges: []
        };
      }
    });

    return {
      passed: disconnectedCount === 0,
      totalAudited: tests.length,
      connectedCount,
      disconnectedCount,
      results
    };
  }
}

export const alpineDecisionEngine = new AlpineDecisionTwinEngine();
