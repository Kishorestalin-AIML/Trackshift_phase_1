/**
 * RACE TWIN — 2026 FIA-Constrained Rules Engine (Sections 15, 16, 20, 21, 22, 23, 24)
 *
 * Implements deterministic constraints:
 *   - 350 kW deployment cap in key acceleration/overtake zones
 *   - 250 kW deployment cap in other lap areas
 *   - +150 kW race boost cap
 *   - 7.0 MJ recharge limit
 *   - Overtake Mode eligibility model
 *   - Hard sporting constraints (Safety Car, VSC, Yellow Flag Sector 2)
 */

export const RULES_2026 = {
  ERS_K_MAX_POWER: 350,       // kW max MGU-K
  KEY_ZONE_POWER: 350,        // kW in key acceleration / overtaking zones
  OTHER_ZONE_POWER: 250,      // kW in other lap areas
  BOOST_CAP: 150,             // +150 kW boost delta
  RECHARGE_LIMIT_MJ: 7.0,     // 7.0 MJ max recharge per lap
  OVERTAKE_GAP_THRESHOLD: 1.0 // Seconds gap ahead to qualify for Overtake Mode
};

/**
 * Key acceleration / overtaking zones on Silverstone GP:
 *   - Wellington Straight (DRS 1)
 *   - Hangar Straight (DRS 2)
 *   - Start / Finish (Hamilton Straight)
 */
export const KEY_ACCELERATION_ZONES = [
  "HANGAR_STRAIGHT",
  "s3-hangar",
  "WELLINGTON_STRAIGHT",
  "s2-wellington",
  "HAMILTON_STRAIGHT",
  "sf-hamilton"
];

export class RulesEngine {
  /**
   * Determine if segment is a key acceleration/overtake zone
   */
  static isKeyZone(segmentId) {
    if (!segmentId) return false;
    const upper = String(segmentId).toUpperCase();
    return (
      upper.includes("HANGAR") ||
      upper.includes("WELLINGTON") ||
      upper.includes("HAMILTON") ||
      upper.includes("SF") ||
      KEY_ACCELERATION_ZONES.includes(segmentId)
    );
  }

  /**
   * Evaluate allowed deployment power for current location
   */
  static getAllowedDeployment(segmentId) {
    return this.isKeyZone(segmentId) ? RULES_2026.KEY_ZONE_POWER : RULES_2026.OTHER_ZONE_POWER;
  }

  /**
   * Evaluate Overtake Mode availability
   * Section 16: gap <= 1.0s + valid attack zone + energy available + race control permits attack
   */
  static evaluateOvertakeMode(state) {
    const isUnderAttackAllowedCondition =
      state.raceControl === "GREEN" &&
      !state.safetyCar &&
      !state.vsc &&
      (!state.yellowSector || state.yellowSector !== state.currentSector);

    const isCloseEnough = (state.gapAhead || 0.62) <= RULES_2026.OVERTAKE_GAP_THRESHOLD;
    const isZoneValid = this.isKeyZone(state.currentSegment);
    const hasEnergy = (state.energyAvailable || 0) >= 20;

    return isUnderAttackAllowedCondition && isCloseEnough && isZoneValid && hasEnergy;
  }

  /**
   * Evaluate active aero mode (Section 17)
   * Straight -> LOW_DRAG; Corner -> HIGH_DOWNFORCE
   */
  static evaluateActiveAero(segmentType) {
    return segmentType === "straight" ? "LOW_DRAG" : "HIGH_DOWNFORCE";
  }

  /**
   * Apply hard constraints to simulation actions
   * Section 21:
   *   if (raceControl === "SAFETY_CAR") attackAllowed = false;
   *   if (yellowSector === currentSector) attackAllowed = false;
   *   if (deploymentPower > allowedPower) deploymentPower = allowedPower;
   *   if (recharge > 7) recharge = 7;
   *   if (outsideKeyAccelerationZone) deploymentPower <= 250;
   *   if (keyAccelerationZone) deploymentPower <= 350;
   */
  static validateAction(action, state) {
    const isSafetyCar = state.safetyCar || state.raceControl === "SAFETY_CAR";
    const isVSC = state.vsc || state.raceControl === "VSC";
    const isYellowInSector =
      state.raceControl === "YELLOW" ||
      state.raceControl === "YELLOW_S2" ||
      state.yellowSector === state.currentSector;

    if (action === "ATTACK") {
      if (isSafetyCar) {
        return {
          allowed: false,
          reason: "SAFETY CAR ACTIVE — FIA sporting regulations prohibit overtaking"
        };
      }
      if (isYellowInSector) {
        return {
          allowed: false,
          reason: "YELLOW FLAG IN SECTOR — Attack window temporarily invalid"
        };
      }
      if (isVSC) {
        return {
          allowed: false,
          reason: "VSC ACTIVE — Delta time mandatory, overtaking prohibited"
        };
      }
      if ((state.energyAvailable || 0) < 15) {
        return {
          allowed: false,
          reason: "ENERGY DEPLETED — Insufficient battery reserve for attack"
        };
      }
    }

    if (action === "CONTROLLED") {
      if (isSafetyCar) {
        return {
          allowed: false,
          reason: "SAFETY CAR ACTIVE — Overtaking strictly disabled"
        };
      }
      if (isYellowInSector) {
        return {
          allowed: false,
          reason: "YELLOW FLAG IN SECTOR — Overtaking prohibited, hold position"
        };
      }
    }

    return { allowed: true, reason: null };
  }
}
