/**
 * TRACKSHIFT - ConstraintGenerator
 * Constraint-First Optimization Filter.
 *
 * Hard constraints are strictly enforced: actions that violate physical,
 * energy/battery, or FIA/regulatory constraints are removed from the candidate
 * action space before objective scoring.
 */

export class ConstraintGenerator {
  constructor(regulations = {}) {
    // FIA & Technical Regulations (Configurable for 2026 specs)
    this.maxPermittedPowerKw = regulations.maxPermittedPowerKw ?? 350.0; // 350 kW (2026 MGU-K spec)
    this.maxLapDeploymentMJ = regulations.maxLapDeploymentMJ ?? 4.0; // 4.0 MJ/lap regulatory cap
    this.minReserveSOC = regulations.minReserveSOC ?? 15.0; // 15% minimum battery protective floor
    this.maxBatteryTemp = regulations.maxBatteryTemp ?? 74.0; // °C thermal safety ceiling
    this.maxStorageCapacity = regulations.maxStorageCapacity ?? 4.0; // MJ
    this.allowOverrideAnywhere = regulations.allowOverrideAnywhere ?? false; // 2026 active override zones
  }

  updateRegulations(newRegs) {
    if (newRegs.maxPermittedPowerKw !== undefined) this.maxPermittedPowerKw = parseFloat(newRegs.maxPermittedPowerKw);
    if (newRegs.maxLapDeploymentMJ !== undefined) this.maxLapDeploymentMJ = parseFloat(newRegs.maxLapDeploymentMJ);
    if (newRegs.minReserveSOC !== undefined) this.minReserveSOC = parseFloat(newRegs.minReserveSOC);
    if (newRegs.maxBatteryTemp !== undefined) this.maxBatteryTemp = parseFloat(newRegs.maxBatteryTemp);
  }

  /**
   * Evaluates an individual candidate action against all hard constraint layers.
   * Returns: { isFeasible: boolean, reason?: string, layer?: string }
   */
  evaluateFeasibility(action, currentState, currentZone) {
    const powerKw = action.powerKw;
    const durationSec = action.duration;
    const actionEnergyMJ = (powerKw * durationSec) / 1000.0;

    // ----------------------------------------------------
    // LAYER 1: PHYSICAL CONSTRAINTS
    // ----------------------------------------------------
    // A. Cannot deploy electrical boost while hard-braking
    if (currentState.brake > 0.3 && powerKw > 40) {
      return {
        isFeasible: false,
        layer: "PHYSICAL",
        reason: "Braking / Deployment conflict: cannot deploy high power under heavy deceleration"
      };
    }

    // B. Traction grip envelope limit at very low speeds
    // Below 70 km/h, delivering > 250 kW causes immediate wheelspin and traction control intervention
    if (currentState.speed < 70 && powerKw > 220) {
      return {
        isFeasible: false,
        layer: "PHYSICAL",
        reason: `Traction limit: ${powerKw} kW at ${currentState.speed.toFixed(0)} km/h exceeds tire grip coefficient`
      };
    }

    // ----------------------------------------------------
    // LAYER 2: ENERGY & BATTERY SAFETY CONSTRAINTS
    // ----------------------------------------------------
    // A. Battery SOC floor protection
    const minEnergyFloorMJ = (this.minReserveSOC / 100.0) * this.maxStorageCapacity;
    const projectedEnergyMJ = currentState.estimated_energy - actionEnergyMJ;
    if (projectedEnergyMJ < minEnergyFloorMJ) {
      return {
        isFeasible: false,
        layer: "ENERGY",
        reason: `SOC Floor Violation: Deployment requires ${actionEnergyMJ.toFixed(2)} MJ, depleting reserve below ${this.minReserveSOC}% (${minEnergyFloorMJ.toFixed(2)} MJ)`
      };
    }

    // B. Cell Thermal Overheat Hard Limit
    if (currentState.cell_temp >= this.maxBatteryTemp && powerKw > 150) {
      return {
        isFeasible: false,
        layer: "ENERGY",
        reason: `Thermal Limit: Cell temperature (${currentState.cell_temp.toFixed(1)}°C) exceeds safety threshold (${this.maxBatteryTemp}°C)`
      };
    }

    // ----------------------------------------------------
    // LAYER 3: FIA / REGULATORY CONSTRAINTS
    // ----------------------------------------------------
    // A. Maximum MGU-K Power Limit
    if (powerKw > this.maxPermittedPowerKw + 0.1) {
      return {
        isFeasible: false,
        layer: "FIA_REGULATORY",
        reason: `FIA Regulation 5.2.1: ${powerKw} kW exceeds maximum permitted power (${this.maxPermittedPowerKw} kW)`
      };
    }

    // B. Maximum Electrical Deployment per Lap Limit
    if (currentState.energy_deployed_lap + actionEnergyMJ > this.maxLapDeploymentMJ + 0.01) {
      const remainingQuota = Math.max(0, this.maxLapDeploymentMJ - currentState.energy_deployed_lap);
      return {
        isFeasible: false,
        layer: "FIA_REGULATORY",
        reason: `FIA Regulation 5.4.3: Exceeds ${this.maxLapDeploymentMJ.toFixed(1)} MJ lap limit (Remaining quota: ${remainingQuota.toFixed(2)} MJ, Required: ${actionEnergyMJ.toFixed(2)} MJ)`
      };
    }

    return { isFeasible: true };
  }

  /**
   * Filters an array of candidate actions, stripping away infeasible candidates.
   */
  filterFeasibleActions(candidateActions, currentState, currentZone) {
    const feasibleActions = [];
    const rejectedActions = [];

    for (const action of candidateActions) {
      const result = this.evaluateFeasibility(action, currentState, currentZone);
      if (result.isFeasible) {
        feasibleActions.push(action);
      } else {
        rejectedActions.push({
          action,
          layer: result.layer,
          reason: result.reason
        });
      }
    }

    return {
      feasibleActions,
      rejectedActions
    };
  }
}
