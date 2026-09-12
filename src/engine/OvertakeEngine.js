/**
 * TRACKSHIFT - OvertakeEngine
 * Computes P(Overtake) and P(Counter) independently from observable telemetry
 * and vehicle/track dynamics, without assuming knowledge of opponent internal battery state.
 */

export class OvertakeEngine {
  constructor(config = {}) {
    this.gapSensitivity = config.gapSensitivity ?? 2.2;
    this.speedDeltaWeight = config.speedDeltaWeight ?? 0.035;
    this.baseThresholdSec = config.baseThresholdSec ?? 1.2; // Maximum gap to consider an attack realistic
  }

  /**
   * Calculates P(overtake) given current vehicle states, zone parameters, and candidate deployment:
   * P_overtake = f(gap, closing_speed, relative_speed, current_zone, attack_zone,
   *                corner_exit_speed, deployment_available, track_geometry, race_position)
   */
  calculateOvertakeProbability(state, zone, deploymentPowerKw = 0, durationSeconds = 0) {
    const gap = Math.max(0.05, state.opponent_gap);
    if (gap > this.baseThresholdSec) {
      // Too far behind for immediate overtake
      const distanceFactor = Math.max(0, 1.0 - (gap - this.baseThresholdSec) / 1.5);
      return Math.min(0.20, 0.15 * distanceFactor);
    }

    // 1. Gap Logit Term: closer gap dramatically increases overtake probability
    // Logistic sigmoid centered around 0.5s gap
    const gapScore = 1.0 / (1.0 + Math.exp(this.gapSensitivity * (gap - 0.55)));

    // 2. Closing Speed & Speed Differential Contribution
    // Deployment power adds delta V: P = F * v -> a_extra = P / (m * v)
    const effectiveMass = 798;
    const currentSpeedMs = Math.max(25, state.speed / 3.6);
    const extraThrustN = (deploymentPowerKw * 1000) / currentSpeedMs;
    const extraAccMs2 = extraThrustN / effectiveMass;
    const deltaVFromBoost = (extraAccMs2 * durationSeconds) * 3.6; // km/h gain

    const totalClosingSpeed = state.opponent_closing_speed + deltaVFromBoost;
    const closingSpeedScore = 1.0 / (1.0 + Math.exp(-this.speedDeltaWeight * (totalClosingSpeed - 4.0)));

    // 3. Track Geometry & Zone Suitability
    const zoneAttackBase = zone.attackOpportunity ?? 0.5;
    const drsBonus = zone.drs ? 0.15 : 0.0;

    // 4. Corner Exit & Traction Efficiency
    const tractionFactor = state.speed >= (zone.entrySpeed * 0.9) ? 1.0 : 0.85;

    // Combined Multi-Factor Probability
    // In equal modern F1 machinery, an overtake on a straight requires deployment overspeed;
    // zero deployment limits pass probability to maintaining slipstream or opponent error.
    const deployFactor = deploymentPowerKw > 0 
      ? (0.45 + 0.55 * Math.min(1.0, deploymentPowerKw / 300.0))
      : 0.18; // Zero deploy yields low pass completion

    let pOvertake = (0.40 * gapScore + 0.35 * closingSpeedScore + 0.25 * (zoneAttackBase + drsBonus)) * tractionFactor * deployFactor;

    // Cap between 0.02 and 0.96 (there is always physical uncertainty in wheel-to-wheel racing)
    pOvertake = Math.max(0.02, Math.min(0.96, pOvertake));
    return parseFloat(pOvertake.toFixed(4));
  }

  /**
   * Calculates P(counter) independently:
   * P_counter = f(opponent_speed, opponent_closing_speed, next_straight,
   *               track_geometry, corner_exit, relative_position, expected energy after maneuver)
   *
   */
  calculateCounterProbability(state, currentZone, nextZones, postManeuverEnergyMJ, deploymentPowerKw = 0) {
    // If chasing (P2+) and choosing not to mount an attack (power = 0),
    // the car cannot be counter-attacked since no pass was attempted.
    if (state.race_position > 1 && deploymentPowerKw === 0) {
      return 0.02; // Neutral baseline
    }

    // 1. Inherent Track Switchback & Next Straight Vulnerability
    const baseZoneRisk = currentZone.counterRisk ?? 0.25;

    // Check if subsequent zone has a long straight with DRS where the opponent can re-pass
    let nextStraightVulnerability = 0.0;
    if (nextZones && nextZones.length > 0) {
      const nextZ = nextZones[0].zone;
      if (nextZ.type === "ATTACK_ZONE" || nextZ.type === "STRAIGHT") {
        nextStraightVulnerability = nextZ.drs ? 0.35 : 0.25;
      }
      if (nextZones.length > 1 && (nextZones[1].zone.type === "ATTACK_ZONE" || nextZones[1].zone.drs)) {
        nextStraightVulnerability += 0.15;
      }
    }

    // 2. Battery Depletion Vulnerability (Vulnerability from running dry!)
    // If post-maneuver energy drops below 1.5 MJ, the car has no defense for the following straight
    let energyDepletionRisk = 0.0;
    if (postManeuverEnergyMJ < 0.8) {
      energyDepletionRisk = 0.50; // Critical energy exhaustion
    } else if (postManeuverEnergyMJ < 1.4) {
      energyDepletionRisk = 0.30;
    } else if (postManeuverEnergyMJ < 2.0) {
      energyDepletionRisk = 0.15;
    }

    // 3. Opponent Momentum / Corner Exit Threat
    // If opponent was faster through corner entry or staying in slipstream
    const opponentMomentum = state.opponent_gap < 0.5 ? 0.25 : 0.10;

    // Aggregate Counter Probability
    let pCounter = 0.35 * baseZoneRisk + 0.35 * nextStraightVulnerability + 0.30 * energyDepletionRisk + opponentMomentum;

    // Cap between 0.02 and 0.94
    pCounter = Math.max(0.02, Math.min(0.94, pCounter));
    return parseFloat(pCounter.toFixed(4));
  }
}
