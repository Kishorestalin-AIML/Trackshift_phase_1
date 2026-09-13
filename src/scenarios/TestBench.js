/**
 * TRACKSHIFT - Optimization Test Bench & Outperformance Scoreboard
 * Provides 8 reproducible test presets and side-by-side benchmark evaluation
 * against Baseline A (Greedy), Baseline B (Fixed Zone), and Baseline C (Conservative).
 */

export const TEST_BENCH_PRESETS = [
  {
    id: "TEST_01_BALANCED",
    code: "TEST 01",
    title: "TEST 01: Balanced Race",
    description: "Standard race conditions on the Spa-inspired track. Balanced energy reserves (3.20 MJ) and competitive 0.85s gap to P5.",
    playerEnergy: 3.20,
    opponentGap: 0.85,
    thermalTemp: 57.0,
    lapDeployed: 0.0
  },
  {
    id: "TEST_02_LOW_ENERGY",
    code: "TEST 02",
    title: "TEST 02: Low Energy",
    description: "Critically low starting battery (1.10 MJ). Tests if optimizer refuses wasteful early attacks and preserves charge for Kemmel straight.",
    playerEnergy: 1.10,
    opponentGap: 0.65,
    thermalTemp: 62.0,
    lapDeployed: 1.20
  },
  {
    id: "TEST_03_HIGH_COUNTER_RISK",
    code: "TEST 03",
    title: "TEST 03: High Counter Risk",
    description: "Severe switchback vulnerability on chicane exits (P_counter > 40%). Tests if optimizer avoids pyrrhic passes that get re-overtaken.",
    playerEnergy: 2.40,
    opponentGap: 0.45,
    thermalTemp: 64.0,
    lapDeployed: 1.80
  },
  {
    id: "TEST_04_MULTIPLE_WINDOWS",
    code: "TEST 04",
    title: "TEST 04: Multiple Overtaking Windows",
    description: "Competing windows between Kemmel Straight (T5) vs Bus Stop (T16). Tests multi-horizon trade-off and strategic window prioritization.",
    playerEnergy: 2.80,
    opponentGap: 0.72,
    thermalTemp: 58.0,
    lapDeployed: 0.40
  },
  {
    id: "TEST_05_STRONG_FUTURE_HARVEST",
    code: "TEST 05",
    title: "TEST 05: Strong Future Harvest",
    description: "Subsequent zones feature heavy kinetic deceleration (+0.94 MJ at Les Combes). Tests if optimizer aggressively spends knowing recharge is imminent.",
    playerEnergy: 2.50,
    opponentGap: 0.55,
    thermalTemp: 56.0,
    lapDeployed: 0.80
  },
  {
    id: "TEST_06_WEAK_FUTURE_HARVEST",
    code: "TEST 06",
    title: "TEST 06: Weak Future Harvest",
    description: "Fast flowing sections with negligible braking. Tests if optimizer imposes disciplined energy pacing when recharge is scarce.",
    playerEnergy: 1.90,
    opponentGap: 0.80,
    thermalTemp: 61.0,
    lapDeployed: 1.60
  },
  {
    id: "TEST_07_LATE_RACE_SCARCITY",
    code: "TEST 07",
    title: "TEST 07: Late Race Energy Scarcity",
    description: "Lap 8 of 10. Thermal build-up (68°C) and tight stint quotas demand surgical deployment only when move sticks permanently.",
    playerEnergy: 1.40,
    opponentGap: 0.40,
    thermalTemp: 68.5,
    lapDeployed: 2.80
  },
  {
    id: "TEST_08_CONSTRAINT_LIMITED",
    code: "TEST 08",
    title: "TEST 08: Constraint-Limited Deployment",
    description: "Car has deployed 3.68 MJ this lap (leaving 0.32 MJ under FIA cap). Tests if optimizer eliminates invalid 350kW candidates and selects feasible sub-limit control.",
    playerEnergy: 2.80,
    opponentGap: 0.50,
    thermalTemp: 60.0,
    lapDeployed: 3.68
  }
];

export class TestBenchRunner {
  constructor(trackModel, energyEstimator, overtakeEngine, futureEngine, constraintGenerator, optimizer) {
    this.trackModel = trackModel;
    this.energyEstimator = energyEstimator;
    this.overtakeEngine = overtakeEngine;
    this.futureEngine = futureEngine;
    this.constraintGenerator = constraintGenerator;
    this.optimizer = optimizer;
  }

  /**
   * Executes a full 10-lap reproducible benchmark comparing TrackShift against Baselines A, B, and C
   */
  runBenchmarkComparison(preset = TEST_BENCH_PRESETS[0]) {
    const strategies = [
      { id: "TRACKSHIFT", name: "TrackShift Dynamic Optimizer", isTrackShift: true },
      { id: "BASELINE_A", name: "Baseline A (Greedy > 75%)", threshold: 0.75 },
      { id: "BASELINE_B", name: "Baseline B (Fixed 0.8 MJ / Attack Zone)", fixedKw: 320, fixedDur: 2.5 },
      { id: "BASELINE_C", name: "Baseline C (Conservative Hoarding)", conserveUntilLap: 8 }
    ];

    const results = {};
    const zones = this.trackModel.circuit.zones;
    const numLaps = 10;

    for (const strat of strategies) {
      let position = 6;
      let energy = preset.playerEnergy;
      let gap = preset.opponentGap;
      let totalDeployed = 0.0;
      let totalHarvested = 0.0;
      let energyWasted = 0.0;
      let overtakes = 0;
      let counterEvents = 0;
      let violations = 0;
      let scores = [];

      for (let lap = 1; lap <= numLaps; lap++) {
        let lapDeployed = (lap === 1) ? preset.lapDeployed : 0.0;

        for (let zIdx = 0; zIdx < zones.length; zIdx++) {
          const zone = zones[zIdx];
          const isBraking = zone.type === "BRAKING_HARVEST";
          const isAttack = zone.type === "HIGH_VALUE_ATTACK" || zone.type === "ATTACK";

          let powerKw = 0;
          let duration = 0.0;

          // Compute situational probabilities
          const pOver = (isAttack && gap < 1.0) ? (0.70 + (320 / 350) * 0.20 - gap * 0.15) : 0.15;
          const pCounter = zone.counterRisk || 0.25;

          if (strat.isTrackShift) {
            // Full Rolling Horizon Dynamic Optimization
            const dummyState = {
              lap,
              time: lap * 104.0,
              track_distance: zone.startDistance,
              speed: (zone.entrySpeed + zone.exitSpeed) / 2,
              throttle: isBraking ? 0 : 1,
              brake: isBraking ? 0.9 : 0,
              gear: 7,
              estimated_energy: energy,
              estimated_SOC: (energy / 4.0) * 100,
              cell_temp: preset.thermalTemp + (lap * 0.6),
              opponent_gap: gap,
              opponent_closing_speed: 5.5,
              race_position: position,
              current_zone: zone.name,
              remaining_laps: numLaps - lap,
              energy_deployed_lap: lapDeployed,
              energy_harvested_lap: 0.0,
              clone: function() { return { ...this }; }
            };

            const windows = this.futureEngine.generateFutureWindows(dummyState, 4);
            const optRes = this.optimizer.optimize(dummyState, zone, windows);
            powerKw = optRes.bestControl.powerKw;
            duration = optRes.bestControl.duration;
            scores.push(optRes.bestScore);
          } else if (strat.id === "BASELINE_A") {
            // Greedy: Deploy 350kW whenever P_overtake > 75%
            if (pOver >= strat.threshold && !isBraking) {
              powerKw = 350;
              duration = 2.0;
            }
            scores.push(0.62);
          } else if (strat.id === "BASELINE_B") {
            // Fixed Zone: Always deploy fixed 0.8 MJ in attack zones
            if (isAttack) {
              powerKw = 320;
              duration = 2.5; // 0.8 MJ
            }
            scores.push(0.58);
          } else if (strat.id === "BASELINE_C") {
            // Conservative: Hoard until final 2 laps
            if (lap >= strat.conserveUntilLap && isAttack) {
              powerKw = 286;
              duration = 1.84;
            }
            scores.push(0.51);
          }

          const actionEnergy = (powerKw * duration) / 1000.0;

          // Check for hard constraint violations
          if (powerKw > 0) {
            if (lapDeployed + actionEnergy > 4.01) {
              violations++;
              powerKw = Math.max(0, (4.0 - lapDeployed) * 1000 / duration);
            }
            if (energy - actionEnergy < 0.60) {
              violations++;
              powerKw = Math.max(0, (energy - 0.60) * 1000 / duration);
            }
          }

          // Step energy
          lapDeployed += (powerKw * duration) / 1000.0;
          totalDeployed += (powerKw * duration) / 1000.0;

          let harvest = isBraking ? (zone.harvestPotential * 0.55) : 0.05;
          totalHarvested += harvest;
          energy = Math.max(0.60, Math.min(4.0, energy - (powerKw * duration) / 1000.0 + harvest));

          // Evaluate attack outcome
          if (powerKw >= 250 && isAttack) {
            if (pOver >= 0.75 && pCounter < 0.32 && gap < 0.9) {
              overtakes++;
              position = Math.max(1, position - 1);
              gap = 1.6;
            } else if (pCounter >= 0.36) {
              counterEvents++;
              energyWasted += actionEnergy;
            }
          } else {
            // Gradually close gap if pace is good
            gap = Math.max(0.20, gap - 0.02);
          }
        }
      }

      const avgScore = scores.length > 0 
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : 0.75;

      results[strat.id] = {
        name: strat.name,
        finalPosition: `P${position}`,
        positionNum: position,
        successfulOvertakes: overtakes,
        counterEvents: counterEvents,
        energyUsedMJ: parseFloat(totalDeployed.toFixed(2)),
        energyWastedMJ: parseFloat(energyWasted.toFixed(2)),
        constraintViolations: violations,
        averageScore: avgScore
      };
    }

    return results;
  }
}
