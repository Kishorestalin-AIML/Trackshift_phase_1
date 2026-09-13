/**
 * TRACKSHIFT - ConstraintGenerator & FIA 2026 Regulatory Profile
 * Versioned FIA Technical Regulations Engine (v2.4).
 *
 * Implements 5-layer constraint enforcement:
 *   1. Physical Constraints (Tire traction, braking conflict, speed envelope)
 *   2. Energy Constraints (15% SOC floor, 74°C thermal ceiling)
 *   3. Regulatory Constraints (FIA 2026 limits: 350 kW MGU-K, 4.0 MJ/lap deploy, 9.0 MJ harvest)
 *   4. Track-Zone Constraints (Low-speed hairpin deploy limits)
 *   5. Future Energy Feasibility (Reserve preservation)
 */

export const FIA_2026_CONFIG = {
  version: "v2.4 (FIA 2026 TECHNICAL REGS)",
  effectiveDate: "2026-SEASON",
  status: "ACTIVE",

  // Strictly Regulatory Limits (Non-negotiable FIA hard rules)
  regulatory: {
    maxMgukPowerKw: 350.0, // 350 kW electrical power deployment cap
    maxDeployLapEnergyMJ: 4.0, // 4.0 MJ max electrical deployment per lap
    maxHarvestLapEnergyMJ: 9.0, // 9.0 MJ max kinetic energy recovery per lap
    minReserveSOC: 15.0, // 15% protective energy floor (0.60 MJ)
    maxBatteryCapacityMJ: 4.0, // 4.0 MJ usable Energy Store buffer
    activeOverrideAllowed: true // Active aerodynamics & straight override modes
  },

  // Simulation Assumptions (Vehicle & physical parameters)
  simulation: {
    vehicleMassKg: 798, // FIA minimum mass with driver
    regenEfficiency: 0.82, // 82% kinetic brake recovery efficiency
    thermalSafetyCeilingC: 74.0, // 74.0°C cell thermal throttle
    lowSpeedTractionLimitKmh: 75.0, // km/h limit for full 350kW traction
    lowSpeedPowerClampKw: 220.0
  }
};

export const CONSTRAINT_STATUS = {
  FEASIBLE: "FEASIBLE",
  LIMITED: "LIMITED",
  INFEASIBLE: "INFEASIBLE"
};

export class ConstraintGenerator {
  constructor(config = FIA_2026_CONFIG) {
    this.config = JSON.parse(JSON.stringify(FIA_2026_CONFIG));
    if (config) {
      if (config.regulatory) {
        this.config = JSON.parse(JSON.stringify(config));
      } else {
        if (config.maxPermittedPowerKw !== undefined || config.maxMgukPowerKw !== undefined) {
          this.config.regulatory.maxMgukPowerKw = parseFloat(config.maxPermittedPowerKw ?? config.maxMgukPowerKw);
        }
        if (config.maxLapDeploymentMJ !== undefined || config.maxDeployLapEnergyMJ !== undefined) {
          this.config.regulatory.maxDeployLapEnergyMJ = parseFloat(config.maxLapDeploymentMJ ?? config.maxDeployLapEnergyMJ);
        }
        if (config.minReserveSOC !== undefined) {
          this.config.regulatory.minReserveSOC = parseFloat(config.minReserveSOC);
        }
        if (config.thermalSafetyCeilingC !== undefined) {
          this.config.simulation.thermalSafetyCeilingC = parseFloat(config.thermalSafetyCeilingC);
        }
      }
    }
  }

  get maxPermittedPowerKw() {
    return this.config.regulatory.maxMgukPowerKw;
  }

  get maxLapDeploymentMJ() {
    return this.config.regulatory.maxDeployLapEnergyMJ;
  }

  get minReserveSOC() {
    return this.config.regulatory.minReserveSOC;
  }

  updateProfile(updates = {}) {
    if (updates.maxMgukPowerKw !== undefined || updates.maxPermittedPowerKw !== undefined) {
      this.config.regulatory.maxMgukPowerKw = parseFloat(updates.maxMgukPowerKw ?? updates.maxPermittedPowerKw);
    }
    if (updates.maxDeployLapEnergyMJ !== undefined || updates.maxLapDeploymentMJ !== undefined) {
      this.config.regulatory.maxDeployLapEnergyMJ = parseFloat(updates.maxDeployLapEnergyMJ ?? updates.maxLapDeploymentMJ);
    }
    if (updates.minReserveSOC !== undefined) {
      this.config.regulatory.minReserveSOC = parseFloat(updates.minReserveSOC);
    }
    if (updates.thermalSafetyCeilingC !== undefined) {
      this.config.simulation.thermalSafetyCeilingC = parseFloat(updates.thermalSafetyCeilingC);
    }
  }

  /**
   * Compatibility alias for evaluateCandidate
   */
  evaluateFeasibility(candidate, currentState, currentZone, horizonSummary = null) {
    return this.evaluateCandidate(candidate, currentState, currentZone, horizonSummary);
  }

  /**
   * Evaluates an individual candidate control against all 5 constraint layers.
   * Returns: { status: 'FEASIBLE' | 'LIMITED' | 'INFEASIBLE', isFeasible: boolean, layer: string, reason: string }
   */
  evaluateCandidate(candidate, currentState, currentZone, horizonSummary = null) {
    const powerKw = candidate.powerKw;
    const duration = candidate.duration;
    const energyCostMJ = (powerKw * duration) / 1000.0;

    // ----------------------------------------------------
    // LAYER 0: RACE CONDITION CONSTRAINTS (Sections 11 - 15)
    // ----------------------------------------------------
    const condition = currentState.race_condition || "GREEN";
    if (condition !== "GREEN" && powerKw > 0) {
      if (condition === "VSC") {
        return {
          status: CONSTRAINT_STATUS.INFEASIBLE,
          isFeasible: false,
          layer: "RACE_CONDITION",
          reason: "VSC Active: All attack deployments prohibited under Virtual Safety Car"
        };
      }
      if (condition === "SAFETY_CAR") {
        return {
          status: CONSTRAINT_STATUS.INFEASIBLE,
          isFeasible: false,
          layer: "RACE_CONDITION",
          reason: "Safety Car Active: Race neutralized, queue formation in progress"
        };
      }
      if (condition.startsWith("YELLOW")) {
        const yellowSec = condition === "YELLOW_S1" ? 1 : (condition === "YELLOW_S2" ? 2 : (condition === "YELLOW_S3" ? 3 : 2));
        const zoneSec = currentZone?.sectorNumber || 2;
        if (zoneSec === yellowSec) {
          return {
            status: CONSTRAINT_STATUS.INFEASIBLE,
            isFeasible: false,
            layer: "RACE_CONDITION",
            reason: `Yellow Flag in Sector ${yellowSec}: Overtaking & deployment strictly prohibited`
          };
        }
      }
    }

    // ----------------------------------------------------
    // LAYER 1: PHYSICAL CONSTRAINTS
    // ----------------------------------------------------
    if (currentState.brake > 0.3 && powerKw > 40) {
      return {
        status: CONSTRAINT_STATUS.INFEASIBLE,
        isFeasible: false,
        layer: "PHYSICAL",
        reason: "Braking/Deployment conflict: cannot deploy high power under heavy threshold braking"
      };
    }

    if (currentState.speed < this.config.simulation.lowSpeedTractionLimitKmh && powerKw > this.config.simulation.lowSpeedPowerClampKw) {
      return {
        status: CONSTRAINT_STATUS.INFEASIBLE,
        isFeasible: false,
        layer: "PHYSICAL",
        reason: `Traction limit: ${powerKw} kW exceeds tire grip envelope below ${this.config.simulation.lowSpeedTractionLimitKmh} km/h`
      };
    }

    // ----------------------------------------------------
    // LAYER 2: ENERGY & BATTERY CONSTRAINTS
    // ----------------------------------------------------
    const minReserveFloorMJ = (this.config.regulatory.minReserveSOC / 100.0) * this.config.regulatory.maxBatteryCapacityMJ;
    const postEnergyMJ = currentState.estimated_energy - energyCostMJ;

    if (postEnergyMJ < minReserveFloorMJ) {
      return {
        status: CONSTRAINT_STATUS.INFEASIBLE,
        isFeasible: false,
        layer: "ENERGY",
        reason: `SOC Floor Violation: Drains battery reserve (${postEnergyMJ.toFixed(2)} MJ) below ${this.config.regulatory.minReserveSOC}% floor (${minReserveFloorMJ.toFixed(2)} MJ)`
      };
    }

    if (currentState.cell_temp >= this.config.simulation.thermalSafetyCeilingC && powerKw > 150) {
      return {
        status: CONSTRAINT_STATUS.INFEASIBLE,
        isFeasible: false,
        layer: "ENERGY",
        reason: `Thermal Limit: Cell temperature (${currentState.cell_temp.toFixed(1)}°C) exceeds safety ceiling (${this.config.simulation.thermalSafetyCeilingC}°C)`
      };
    }

    // ----------------------------------------------------
    // LAYER 3: FIA REGULATORY CONSTRAINTS (FIA 2026 Rules)
    // ----------------------------------------------------
    if (powerKw > this.config.regulatory.maxMgukPowerKw + 0.1) {
      return {
        status: CONSTRAINT_STATUS.INFEASIBLE,
        isFeasible: false,
        layer: "FIA_REGULATORY",
        reason: `FIA Reg 5.2.1: ${powerKw} kW exceeds 2026 MGU-K cap (${this.config.regulatory.maxMgukPowerKw} kW)`
      };
    }

    if (currentState.energy_deployed_lap + energyCostMJ > this.config.regulatory.maxDeployLapEnergyMJ + 0.01) {
      const remainingQuota = Math.max(0, this.config.regulatory.maxDeployLapEnergyMJ - currentState.energy_deployed_lap);
      return {
        status: CONSTRAINT_STATUS.INFEASIBLE,
        isFeasible: false,
        layer: "FIA_REGULATORY",
        reason: `FIA Reg 5.4.3: Exceeds ${this.config.regulatory.maxDeployLapEnergyMJ.toFixed(1)} MJ lap limit (Remaining: ${remainingQuota.toFixed(2)} MJ, Required: ${energyCostMJ.toFixed(2)} MJ)`
      };
    }

    // ----------------------------------------------------
    // LAYER 4: TRACK-ZONE CONSTRAINTS
    // ----------------------------------------------------
    if (currentZone && currentZone.type === "CORNER" && powerKw > 250) {
      return {
        status: CONSTRAINT_STATUS.LIMITED,
        isFeasible: true,
        layer: "TRACK_ZONE",
        reason: "Lateral g-load warning: mid-corner deployment clamped to prevent snap oversteer"
      };
    }

    // ----------------------------------------------------
    // LAYER 5: FUTURE ENERGY FEASIBILITY
    // ----------------------------------------------------
    if (horizonSummary && horizonSummary.bestFutureWindow && horizonSummary.bestFutureWindow.strategicValue > 0.85) {
      const futureNeed = horizonSummary.bestFutureWindow.energyRequired;
      const expectedSurplus = postEnergyMJ + horizonSummary.totalFutureHarvestMJ;
      if (expectedSurplus < futureNeed && powerKw >= 280) {
        return {
          status: CONSTRAINT_STATUS.LIMITED,
          isFeasible: true,
          layer: "FUTURE_ENERGY",
          reason: `High opportunity cost: spending ${energyCostMJ.toFixed(2)} MJ now starves prime upcoming window at ${horizonSummary.bestFutureWindow.zone.name}`
        };
      }
    }

    return {
      status: CONSTRAINT_STATUS.FEASIBLE,
      isFeasible: true,
      layer: "NONE",
      reason: "Compliant with all physical, energy, track, and FIA 2026 constraints"
    };
  }

  /**
   * Evaluates and categorizes candidate controls
   */
  filterFeasibleActions(candidates, currentState, currentZone, horizonSummary = null) {
    const feasibleActions = [];
    const limitedActions = [];
    const infeasibleActions = [];

    for (const c of candidates) {
      const res = this.evaluateCandidate(c, currentState, currentZone, horizonSummary);
      const enriched = {
        ...c,
        constraintStatus: res.status,
        constraintLayer: res.layer,
        constraintReason: res.reason,
        isFeasible: res.isFeasible
      };

      if (res.status === CONSTRAINT_STATUS.FEASIBLE) {
        feasibleActions.push(enriched);
      } else if (res.status === CONSTRAINT_STATUS.LIMITED) {
        limitedActions.push(enriched);
        feasibleActions.push(enriched); // Limited is feasible but flagged
      } else {
        infeasibleActions.push(enriched);
      }
    }

    return {
      feasibleActions,
      limitedActions,
      infeasibleActions,
      allEvaluated: [...feasibleActions, ...infeasibleActions]
    };
  }
}
