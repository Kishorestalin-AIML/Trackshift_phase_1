/**
 * TRACKSHIFT - FutureOpportunityEngine
 * Projects multi-horizon tactical windows across:
 *   - Current zone
 *   - Next zone (+1)
 *   - Next 2 zones (+2)
 *   - Next 3 zones (+3)
 *   - Next 4 zones (+4)
 *   - Next lap (Lap N+1)
 *
 * Quantifies time_to_window, distance_to_window, P_overtake, P_counter,
 * energy_required, expected_future_harvest, strategic_value, and counter_risk.
 */

export class FutureOpportunityEngine {
  constructor(trackModel, energyEstimator, overtakeEngine) {
    this.trackModel = trackModel;
    this.energyEstimator = energyEstimator;
    this.overtakeEngine = overtakeEngine;
  }

  /**
   * Generates prospective future windows from the current state vector
   */
  generateFutureWindows(state, lookaheadCount = 4) {
    const { zone: currentZ, index: currentIdx, progressInZone } = this.trackModel.getZoneAtDistance(state.track_distance);
    const nextZones = this.trackModel.getNextZones(currentIdx, lookaheadCount + 2);

    const windows = [];
    let accumulatedDist = (1.0 - progressInZone) * currentZ.length;
    let accumulatedTime = accumulatedDist / (Math.max(100, state.speed) / 3.6);

    // Window 0: Current Zone
    const currentWindowEnergyReq = currentZ.type === "ATTACK_ZONE" ? 0.72 : (currentZ.type === "STRAIGHT" ? 0.45 : 0.20);
    const currentWindowHarvest = currentZ.type === "BRAKING" 
      ? this.energyEstimator.calculateKineticHarvest(currentZ.entrySpeed, currentZ.apexSpeed)
      : (currentZ.harvestPotential * 0.15);

    const curPOver = this.overtakeEngine.calculateOvertakeProbability(state, currentZ, 280, 2.0);
    const curPCounter = this.overtakeEngine.calculateCounterProbability(state, currentZ, nextZones, state.estimated_energy - currentWindowEnergyReq, 280);

    const curStrategicValue = parseFloat((0.6 * curPOver + 0.2 * (1.0 - curPCounter) + 0.2 * (currentZ.attackOpportunity || 0.5)).toFixed(3));

    windows.push({
      windowIndex: 0,
      label: "Current Zone: " + currentZ.name,
      zone: currentZ,
      zoneIndex: currentIdx,
      timeToWindow: 0.0,
      distanceToWindow: 0,
      pOvertake: curPOver,
      pCounter: curPCounter,
      energyRequired: currentWindowEnergyReq,
      expectedFutureHarvest: parseFloat(currentWindowHarvest.toFixed(3)),
      strategicValue: curStrategicValue,
      counterRisk: curPCounter,
      isNextLap: false
    });

    // Windows 1 to N: Upcoming Zones
    let simulatedStateEnergy = state.estimated_energy;

    for (let i = 0; i < nextZones.length && windows.length <= lookaheadCount + 1; i++) {
      const item = nextZones[i];
      const z = item.zone;
      const zoneDist = z.length;
      const avgSpeedMs = (Math.max(80, (z.entrySpeed + z.exitSpeed) / 2)) / 3.6;
      const transitTime = zoneDist / avgSpeedMs;

      const timeToStart = accumulatedTime;
      const distToStart = Math.round(accumulatedDist);

      // Expected harvest in this upcoming zone
      let upcomingHarvest = 0.0;
      if (z.type === "BRAKING") {
        upcomingHarvest = this.energyEstimator.calculateKineticHarvest(z.entrySpeed, z.apexSpeed);
      } else {
        upcomingHarvest = z.harvestPotential * 0.12;
      }
      simulatedStateEnergy = Math.min(4.0, simulatedStateEnergy + upcomingHarvest);

      // Estimated energy required to execute an attack in this window
      let energyReq = 0.0;
      if (z.type === "ATTACK_ZONE") {
        energyReq = 0.65 + (z.drs ? 0.10 : 0.0);
      } else if (z.type === "STRAIGHT") {
        energyReq = 0.40;
      } else {
        energyReq = 0.20;
      }

      // Projected overtake & counter probabilities at future window
      // Projected gap may close if currently closing or if slipstream builds
      const projectedGap = Math.max(0.15, state.opponent_gap - (state.opponent_closing_speed > 0 ? (state.opponent_closing_speed / 3.6) * (timeToStart / 100) : 0));
      const projectedState = state.clone();
      projectedState.opponent_gap = parseFloat(projectedGap.toFixed(2));
      projectedState.speed = z.entrySpeed;

      const futureSubsequentZones = nextZones.slice(i + 1);
      const futPOver = this.overtakeEngine.calculateOvertakeProbability(projectedState, z, 300, 2.2);
      const futPCounter = this.overtakeEngine.calculateCounterProbability(projectedState, z, futureSubsequentZones, simulatedStateEnergy - energyReq, 300);

      // Strategic value: balance of high P(overtake), low P(counter), and track layout potential
      let stratVal = (0.55 * futPOver + 0.25 * (1.0 - futPCounter) + 0.20 * (z.attackOpportunity || 0.5));
      if (z.type === "ATTACK_ZONE") stratVal *= 1.15; // Bonus for dedicated attack straights
      stratVal = parseFloat(Math.min(0.98, Math.max(0.05, stratVal)).toFixed(3));

      windows.push({
        windowIndex: windows.length,
        label: `+${windows.length} (${z.name})`,
        zone: z,
        zoneIndex: item.index,
        timeToWindow: parseFloat(timeToStart.toFixed(1)),
        distanceToWindow: distToStart,
        pOvertake: futPOver,
        pCounter: futPCounter,
        energyRequired: parseFloat(energyReq.toFixed(2)),
        expectedFutureHarvest: parseFloat(upcomingHarvest.toFixed(3)),
        strategicValue: stratVal,
        counterRisk: futPCounter,
        isNextLap: item.isNextLap
      });

      accumulatedDist += zoneDist;
      accumulatedTime += transitTime;
    }

    return windows;
  }

  /**
   * Computes the maximum future opportunity value across the lookahead horizon.
   * This is key for evaluating opportunity cost: if a future window has a significantly
   * higher strategic value and harvest profile, firing energy now incurs high opportunity loss.
   */
  getHorizonSummary(windows) {
    if (!windows || windows.length <= 1) {
      return { maxFutureStrategicValue: 0.5, bestFutureWindowIndex: 0, totalFutureHarvestMJ: 0.2 };
    }

    let maxVal = 0.0;
    let bestIdx = 1;
    let totalHarvest = 0.0;

    for (let i = 1; i < windows.length; i++) {
      const w = windows[i];
      totalHarvest += w.expectedFutureHarvest;
      if (w.strategicValue > maxVal) {
        maxVal = w.strategicValue;
        bestIdx = i;
      }
    }

    return {
      maxFutureStrategicValue: parseFloat(maxVal.toFixed(3)),
      bestFutureWindow: windows[bestIdx],
      bestFutureWindowIndex: bestIdx,
      totalFutureHarvestMJ: parseFloat(totalHarvest.toFixed(3))
    };
  }
}
