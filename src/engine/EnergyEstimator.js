/**
 * TRACKSHIFT - EnergyEstimator
 * Telemetry-derived physical energy estimation module.
 *
 * Implements:
 *   Delta_E_kinetic = 0.5 * m * (v_before² - v_after²)
 *   E_harvest = eta_regen * Delta_E_kinetic
 *   E_deployed = integral(P_MGU-K dt)
 *   E(t+1) = E(t) + E_harvested(t) - E_deployed(t) - E_losses(t)
 *
 * Strictly labeled: "ESTIMATED ERS STATE" (observable telemetry-derived).
 */

export class EnergyEstimator {
  constructor(config = {}) {
    // Physical parameters
    this.vehicleMass = config.vehicleMass ?? 798; // kg (FIA minimum weight including driver)
    this.etaRegen = config.etaRegen ?? 0.82; // 82% regenerative brake recovery efficiency
    this.maxStorageCapacity = config.maxStorageCapacity ?? 4.0; // MJ usable ERS buffer
    this.minReserveSoc = config.minReserveSoc ?? 15.0; // % minimum battery protective floor
    this.maxDischargePower = config.maxDischargePower ?? 350.0; // kW (350 kW 2026 spec / 120-350kW)
    this.maxChargePower = config.maxChargePower ?? 250.0; // kW (max MGU-K regen power)
    this.thermalLossRate = config.thermalLossRate ?? 0.04; // 4% internal resistance & inverter losses

    // Rolling tracking
    this.energyTrend = 0.0; // MJ/min trend
    this.label = "ESTIMATED ERS STATE";
  }

  /**
   * Calculates kinetic energy recovery across a braking transition:
   * vBefore, vAfter in km/h
   * Returns recoverable energy in Megajoules (MJ)
   */
  calculateKineticHarvest(vBeforeKmH, vAfterKmH) {
    if (vBeforeKmH <= vAfterKmH) return 0.0;

    const v1 = vBeforeKmH / 3.6; // m/s
    const v2 = vAfterKmH / 3.6; // m/s

    // Delta_E_kinetic = 0.5 * m * (v1^2 - v2^2) in Joules
    const deltaKineticJoules = 0.5 * this.vehicleMass * (v1 * v1 - v2 * v2);

    // Convert Joules to Megajoules (1 MJ = 1e6 J)
    const deltaKineticMJ = deltaKineticJoules / 1e6;

    // E_harvest = eta_regen * Delta_E_kinetic
    const harvestMJ = this.etaRegen * deltaKineticMJ;
    return Math.max(0.0, harvestMJ);
  }

  /**
   * Calculates electrical energy deployed from MGU-K power over a timestep:
   * powerKw: deployment power in kW
   * dtSeconds: duration in seconds
   * Returns deployed energy in Megajoules (MJ)
   * 1 kW * 1 s = 1 kJ = 0.001 MJ
   */
  calculateDeployedEnergy(powerKw, dtSeconds) {
    if (powerKw <= 0 || dtSeconds <= 0) return 0.0;
    return (powerKw * dtSeconds) / 1000.0; // MJ
  }

  /**
   * Simulates dynamic energy state update over a discrete timestep dt:
   * E(t+1) = E(t) + E_harvested(t) - E_deployed(t) - E_losses(t)
   */
  stepEnergyState(currentState, powerCommandKw, isBraking = false, brakeDeltaKmH = 0, dt = 0.1) {
    const nextState = currentState.clone();
    nextState.time += dt;

    let eHarvested = 0.0;
    let eDeployed = 0.0;

    if (isBraking && brakeDeltaKmH > 0) {
      // Braking regeneration
      const fullZoneHarvest = this.calculateKineticHarvest(currentState.speed, currentState.speed - brakeDeltaKmH);
      // Rate-limited kinetic harvest over dt
      const harvestPowerKw = Math.min(this.maxChargePower, (fullZoneHarvest * 1000.0) / Math.max(0.5, dt));
      eHarvested = (harvestPowerKw * dt) / 1000.0;
      nextState.energy_harvest_rate = harvestPowerKw;
      nextState.energy_deployment_rate = 0.0;
    } else if (powerCommandKw > 0) {
      // Electrical deployment
      const clampedPower = Math.min(this.maxDischargePower, Math.max(0, powerCommandKw));
      eDeployed = this.calculateDeployedEnergy(clampedPower, dt);
      nextState.energy_harvest_rate = 0.0;
      nextState.energy_deployment_rate = clampedPower;
    } else {
      nextState.energy_harvest_rate = 0.0;
      nextState.energy_deployment_rate = 0.0;
    }

    // Thermal / resistance losses
    const losses = (eDeployed + eHarvested) * this.thermalLossRate;

    // Update estimated energy: E(t+1) = E(t) + E_harvested - E_deployed - losses
    let newEnergy = nextState.estimated_energy + eHarvested - eDeployed - losses;
    newEnergy = Math.max(0.0, Math.min(this.maxStorageCapacity, newEnergy));

    nextState.estimated_energy = parseFloat(newEnergy.toFixed(4));
    nextState.estimated_SOC = parseFloat(((newEnergy / this.maxStorageCapacity) * 100).toFixed(1));
    nextState.energy_harvested_lap += eHarvested;
    nextState.energy_deployed_lap += eDeployed;

    // Update cell temperature dynamics
    if (powerCommandKw > 250) {
      nextState.cell_temp = Math.min(72.0, nextState.cell_temp + 0.05 * dt);
    } else if (isBraking) {
      nextState.cell_temp = Math.min(72.0, nextState.cell_temp + 0.02 * dt);
    } else {
      nextState.cell_temp = Math.max(52.0, nextState.cell_temp - 0.02 * dt);
    }

    return nextState;
  }

  /**
   * Predicts future energy trajectory over an array of upcoming zones given a candidate control policy
   */
  predictTrajectory(startState, upcomingZones, candidateControl) {
    const trajectory = [];
    let state = startState.clone();
    let cumulativeDist = 0;

    trajectory.push({
      distanceOffset: 0,
      timeOffset: 0,
      energy: state.estimated_energy,
      soc: state.estimated_SOC,
      powerKw: state.energy_deployment_rate,
      zoneName: state.current_zone
    });

    let remainingDeployDuration = candidateControl.duration;
    const deployPower = candidateControl.powerKw;

    for (let i = 0; i < upcomingZones.length; i++) {
      const z = upcomingZones[i].zone;
      const zoneTime = z.length / (Math.max(120, (z.entrySpeed + z.exitSpeed) / 2) / 3.6);
      const subSteps = 5;
      const subDt = zoneTime / subSteps;

      for (let s = 0; s < subSteps; s++) {
        let activePower = 0;
        let isBraking = false;
        let deltaSpeed = 0;

        if (z.type === "BRAKING") {
          isBraking = true;
          deltaSpeed = Math.abs(z.speedDeltaPotential);
        } else if (remainingDeployDuration > 0 && (z.type === "ATTACK_ZONE" || z.type === "STRAIGHT")) {
          activePower = deployPower;
          remainingDeployDuration -= subDt;
        }

        state = this.stepEnergyState(state, activePower, isBraking, deltaSpeed / subSteps, subDt);
        cumulativeDist += z.length / subSteps;

        trajectory.push({
          distanceOffset: Math.round(cumulativeDist),
          timeOffset: parseFloat((state.time - startState.time).toFixed(2)),
          energy: state.estimated_energy,
          soc: state.estimated_SOC,
          powerKw: activePower,
          zoneName: z.name
        });
      }
    }

    return trajectory;
  }
}
