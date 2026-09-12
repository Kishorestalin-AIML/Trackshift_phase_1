/**
 * TRACKSHIFT - BaselineSimulator
 * Benchmarks TrackShift against simplistic heuristic strategies:
 *   - Baseline 1 (Threshold Greedy): Deploys whenever P_overtake > 75%
 *   - Baseline 2 (Fixed Energy): Always dumps fixed energy (0.8 MJ) in every attack zone
 *   - Baseline 3 (Ultra-Conservative): Conserves energy until the final 5 laps
 *   - TrackShift: Dynamic constraint-based rolling-horizon optimization
 */

export class BaselineSimulator {
  constructor(trackModel, energyEstimator, overtakeEngine, futureEngine, constraintGenerator, optimizer) {
    this.trackModel = trackModel;
    this.energyEstimator = energyEstimator;
    this.overtakeEngine = overtakeEngine;
    this.futureEngine = futureEngine;
    this.constraintGenerator = constraintGenerator;
    this.optimizer = optimizer;
  }

  /**
   * Runs a multi-lap simulated stint comparing all 4 strategies under identical initial conditions
   */
  runStintComparison(startState, numLaps = 5) {
    const strategies = [
      { id: "TRACKSHIFT", name: "TrackShift Dynamic Optimizer", isTrackShift: true },
      { id: "BASELINE_1", name: "Baseline 1 (Greedy Threshold > 75%)", threshold: 0.75 },
      { id: "BASELINE_2", name: "Baseline 2 (Fixed 0.8 MJ / Attack Zone)", fixedEnergyMJ: 0.80 },
      { id: "BASELINE_3", name: "Baseline 3 (Passive Hoarding)", conserveUntilLap: startState.lap + numLaps - 1 }
    ];

    const results = {};

    for (const strat of strategies) {
      results[strat.id] = {
        name: strat.name,
        successfulOvertakes: 0,
        positionGained: 0,
        totalEnergyDeployedMJ: 0.0,
        totalEnergyHarvestedMJ: 0.0,
        failedAttacks: 0,
        counterEventsSuffered: 0,
        constraintViolations: 0,
        finalEnergyMJ: 0.0,
        finalSOC: 0.0,
        avgLapTimeDelta: 0.0,
        history: []
      };

      let state = startState.clone();
      let currentPosition = state.race_position;

      // Simulate through zones across numLaps
      const totalZones = this.trackModel.circuit.zones.length;

      for (let lap = 0; lap < numLaps; lap++) {
        state.energy_deployed_lap = 0.0;
        state.energy_harvested_lap = 0.0;

        for (let zIdx = 0; zIdx < totalZones; zIdx++) {
          const zone = this.trackModel.circuit.zones[zIdx];
          state.track_distance = zone.startDist;
          state.current_zone = zone.name;
          state.speed = (zone.entrySpeed + zone.exitSpeed) / 2;

          let chosenPowerKw = 0;
          let chosenDurationSec = 0;

          // Compute prospective probabilities
          const pOver = this.overtakeEngine.calculateOvertakeProbability(state, zone, 300, 2.0);
          const pCounter = this.overtakeEngine.calculateCounterProbability(state, zone, [], state.estimated_energy - 0.6, 300);

          if (strat.isTrackShift) {
            // Full Rolling Horizon Dynamic Optimization
            const windows = this.futureEngine.generateFutureWindows(state, 4);
            const optResult = this.optimizer.optimize(state, zone, windows);
            chosenPowerKw = optResult.bestControl.powerKw;
            chosenDurationSec = optResult.bestControl.duration;
          } else if (strat.id === "BASELINE_1") {
            // Naive Threshold rule: if P_overtake > 75%, fire maximum power
            if (pOver > strat.threshold && zone.type !== "BRAKING") {
              chosenPowerKw = 350;
              chosenDurationSec = 2.5;
            }
          } else if (strat.id === "BASELINE_2") {
            // Fixed Energy rule: always fire 0.8 MJ in attack zone regardless of gap or risk
            if (zone.type === "ATTACK_ZONE") {
              chosenPowerKw = 320;
              chosenDurationSec = 2.5; // 0.8 MJ
            }
          } else if (strat.id === "BASELINE_3") {
            // Ultra-Conservative: do not spend unless final laps
            if (state.lap >= strat.conserveUntilLap && zone.type === "ATTACK_ZONE") {
              chosenPowerKw = 280;
              chosenDurationSec = 2.0;
            }
          }

          // Check if chosen action breaches constraints in real life
          const proposedEnergy = (chosenPowerKw * chosenDurationSec) / 1000.0;
          if (chosenPowerKw > 0) {
            const feasCheck = this.constraintGenerator.evaluateFeasibility(
              { powerKw: chosenPowerKw, duration: chosenDurationSec },
              state,
              zone
            );
            if (!feasCheck.isFeasible) {
              results[strat.id].constraintViolations++;
              // In race conditions, exceeding limits gets penalized or clamped
              chosenPowerKw = Math.min(this.constraintGenerator.maxPermittedPowerKw, chosenPowerKw);
            }
          }

          // Step state
          const isBraking = zone.type === "BRAKING";
          const deltaBrake = isBraking ? Math.abs(zone.speedDeltaPotential) : 0;
          state = this.energyEstimator.stepEnergyState(state, chosenPowerKw, isBraking, deltaBrake, 2.0);

          results[strat.id].totalEnergyDeployedMJ += proposedEnergy;
          results[strat.id].totalEnergyHarvestedMJ += isBraking ? 0.35 : 0.05;

          // Evaluate attack outcome
          if (chosenPowerKw > 150 && zone.type === "ATTACK_ZONE") {
            // Successful overtake happens if P_overtake was high and P_counter was low
            if (pOver >= 0.70 && pCounter < 0.30 && state.opponent_gap < 0.9) {
              results[strat.id].successfulOvertakes++;
              results[strat.id].positionGained++;
              currentPosition = Math.max(1, currentPosition - 1);
              state.opponent_gap = 1.8; // Established gap in front
            } else if (pOver >= 0.70 && pCounter >= 0.35) {
              // Counter-attack occurred! Rival switchbacked on exit
              results[strat.id].counterEventsSuffered++;
              results[strat.id].failedAttacks++;
            } else {
              results[strat.id].failedAttacks++;
            }
          }
        }
        state.lap++;
      }

      results[strat.id].finalEnergyMJ = state.estimated_energy;
      results[strat.id].finalSOC = state.estimated_SOC;
      results[strat.id].totalEnergyDeployedMJ = parseFloat(results[strat.id].totalEnergyDeployedMJ.toFixed(2));
      results[strat.id].totalEnergyHarvestedMJ = parseFloat(results[strat.id].totalEnergyHarvestedMJ.toFixed(2));

      // Efficiency metric: Net position gain per MJ spent
      const deployed = Math.max(0.1, results[strat.id].totalEnergyDeployedMJ);
      results[strat.id].energyEfficiency = parseFloat((results[strat.id].positionGained / deployed).toFixed(3));
      results[strat.id].netScore = parseFloat(
        (results[strat.id].positionGained * 10 - results[strat.id].counterEventsSuffered * 6 - results[strat.id].constraintViolations * 8 + (state.estimated_energy * 1.5)).toFixed(1)
      );
    }

    return results;
  }
}
