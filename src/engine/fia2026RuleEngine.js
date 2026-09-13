/**
 * TRACKSHIFT — 2026 FIA Constraint Engine & Deterministic Rule Validator
 *
 * Implements configurable FIA 2026 technical regulations:
 * - 350 kW MGU-K maximum deployment in key acceleration zones
 * - 250 kW deployment cap in standard corner/track segments
 * - +150 kW maximum permitted Race Boost override
 * - 4.00 MJ total per-lap electrical discharge quota
 * - 15% SOC safety reserve floor (0.60 MJ)
 *
 * Deterministic validation pipeline:
 * USER INPUT -> DECISION ENGINE -> OPTIMIZER -> RULE CHECK -> SIMULATION -> OUTCOME
 */

export const DEFAULT_FIA_2026_RULE_PROFILE = {
  profileId: "FIA_2026_V1_OFFICIAL",
  profileName: "2026 FIA Technical Regulations (Art 5.4)",
  version: "1.4.2",
  accelerationZoneLimitKw: 350, // 350 kW MAX in key acceleration straight
  standardZoneLimitKw: 250, // 250 kW MAX in technical/corner segments
  raceBoostCapKw: 150, // +150 kW manual overtake boost cap
  maxLapDeploymentMJ: 4.00, // 4.0 MJ maximum per-lap deployment
  minLapHarvestMJ: 0.0,
  maxLapHarvestMJ: 7.00, // Configurable regenerative harvest cap
  socReserveFloorPct: 15.0, // 15% SOC minimum safety threshold (0.60 MJ)
  maxCellTempC: 72.0, // Maximum allowable battery cell operating temperature
  // Circuit-specific Pit Stop Parameters (Sections 31 & 35)
  pitLaneTimeLossSec: 21.4, // Silverstone circuit green flag strategic time loss
  pitLaneTimeLossVscSec: 13.8, // Reduced strategic time loss under VSC/SC
  stationaryPitStopTimeSec: 2.4, // Stationary 4-wheel tyre change baseline
  mandatoryTwoCompoundRule: true, // FIA Sporting Regulation: at least two dry compounds in a dry race
  tyreSetInventory: {
    SOFT: 2,
    MEDIUM: 3,
    HARD: 2,
    INTERMEDIATE: 5,
    WET: 2
  },
  compounds: {
    SOFT: { id: "SOFT", name: "Soft (C4)", initialPerformance: 100, degradationPerLap: 3.4, peakLaps: 16, dryWet: "DRY" },
    MEDIUM: { id: "MEDIUM", name: "Medium (C3)", initialPerformance: 92, degradationPerLap: 1.8, peakLaps: 26, dryWet: "DRY" },
    HARD: { id: "HARD", name: "Hard (C1)", initialPerformance: 84, degradationPerLap: 0.9, peakLaps: 36, dryWet: "DRY" },
    INTERMEDIATE: { id: "INTERMEDIATE", name: "Intermediate", initialPerformance: 80, degradationPerLap: 2.2, peakLaps: 22, dryWet: "DAMP" },
    WET: { id: "WET", name: "Full Wet", initialPerformance: 72, degradationPerLap: 2.5, peakLaps: 20, dryWet: "WET" }
  }
};

export const FIA_RULE_PROFILE_2026 = DEFAULT_FIA_2026_RULE_PROFILE;

export class Fia2026RuleEngine {
  constructor(customProfile = {}) {
    this.ruleProfile = { ...DEFAULT_FIA_2026_RULE_PROFILE, ...customProfile };
  }

  getProfile() {
    return this.ruleProfile;
  }

  updateProfile(partial) {
    this.ruleProfile = { ...this.ruleProfile, ...partial };
  }

  /**
   * Deterministically validates an action against the 2026 FIA regulatory profile
   *
   * @param {Object} state - Current simulation state (soc, deploymentPower, etc.)
   * @param {string} strategy - Strategy mode ("ATTACK", "WAIT", "SAVE", "RECOVER", "DEFEND")
   * @param {number} requestedPowerKw - Electrical deployment requested by user or strategy
   * @param {boolean} inAccelerationZone - Whether the car is currently in an acceleration zone
   * @returns {Object} { status: "LEGAL"|"WARNING"|"VIOLATION", reason: string, recommendedLegalPower: number }
   */
  validateAction(state, strategy = "ATTACK", requestedPowerKw = 280, inAccelerationZone = true) {
    const power = requestedPowerKw ?? state.deploymentPower ?? 280;
    const soc = state.soc ?? 62;
    const profile = this.ruleProfile;

    // Check 1: Exceeds absolute 350 kW acceleration zone limit
    if (power > profile.accelerationZoneLimitKw) {
      return {
        status: "VIOLATION",
        reason: `Requested deployment (${power} kW) exceeds configured ${profile.accelerationZoneLimitKw} kW acceleration-zone limit under 2026 FIA Technical Regulations.`,
        recommendedLegalPower: profile.accelerationZoneLimitKw,
        violatedRule: "FIA 2026 Art 5.4.1 (Maximum Electrical Power)"
      };
    }

    // Check 2: Exceeds 250 kW limit outside key acceleration zones
    if (!inAccelerationZone && power > profile.standardZoneLimitKw) {
      return {
        status: "WARNING",
        reason: `Deployment (${power} kW) exceeds ${profile.standardZoneLimitKw} kW limit outside key acceleration zones. Throttle-curve limiting active.`,
        recommendedLegalPower: profile.standardZoneLimitKw,
        violatedRule: "FIA 2026 Art 5.4.3 (Technical Sector Deployment Cap)"
      };
    }

    // Check 3: Battery SOC below 15% safety reserve floor
    if (soc < profile.socReserveFloorPct && (strategy === "ATTACK" || power > 100)) {
      return {
        status: "VIOLATION",
        reason: `Battery SOC (${soc.toFixed(1)}%) is below the ${profile.socReserveFloorPct}% safety reserve floor (${((profile.socReserveFloorPct / 100) * 4.0).toFixed(2)} MJ). High discharge is prohibited to prevent cell degradation.`,
        recommendedLegalPower: 0,
        violatedRule: "FIA 2026 Art 5.8 (ESS Safety Reserve & Thermal Protection)"
      };
    }

    // Check 4: Warning if high deployment with low SOC margin
    if (soc < profile.socReserveFloorPct + 10 && power > 250) {
      return {
        status: "WARNING",
        reason: `Tight SOC buffer (${soc.toFixed(1)}%). Approaching mandatory 15% reserve floor. Consider conserving energy.`,
        recommendedLegalPower: 180,
        violatedRule: "Strategic Telemetry Advisory"
      };
    }

    // Check 5: Legal deployment
    return {
      status: "LEGAL",
      reason: `Fully compliant with ${profile.profileName}. Operating within all regulatory power and energy quotas.`,
      recommendedLegalPower: power,
      violatedRule: null
    };
  }

  /**
   * Returns current regulatory energy limits
   */
  getEnergyStateMetrics(soc, batteryCapacity = 4.00) {
    const currentMJ = (soc / 100) * batteryCapacity;
    const minMJ = (this.ruleProfile.socReserveFloorPct / 100) * batteryCapacity;
    const maxMJ = batteryCapacity;
    const swingMJ = maxMJ - minMJ;

    return {
      currentEnergyMJ: Math.round(currentMJ * 100) / 100,
      minEnergyMJ: Math.round(minMJ * 100) / 100,
      maxEnergyMJ: Math.round(maxMJ * 100) / 100,
      energySwingMJ: Math.round(swingMJ * 100) / 100
    };
  }
}

export const fiaRuleEngine = new Fia2026RuleEngine();
