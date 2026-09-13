/**
 * TRACKSHIFT — Simple F1 2026 Energy & Overtake Digital Twin Engine
 *
 * Implements deterministic 2026 FIA constraint calculations, finite electrical
 * energy consumption, overtake evaluation, and the "TRY OPTIMAL" decision engine.
 */

export class SimpleTwinEngine {
  /**
   * Evaluates the legal maximum power based on the FIA Constraint slider (0 to 100)
   *
   * @param {number} constraintPct - 0 (LOW) to 100 (HIGH)
   * @returns {number} Max legal power in kW (200 kW to 350 kW)
   */
  static getMaxLegalPower(constraintPct) {
    const c = Math.max(0, Math.min(100, constraintPct));
    // When constraint is LOW (0), max legal power is 350 kW
    // When constraint is HIGH (100), max legal power is restricted to 200 kW
    return Math.round(350 - (c / 100) * 150);
  }

  /**
   * Evaluates FIA status string based on requested deployment and constraint
   *
   * @param {number} requestedPowerKw - 0 to 350 kW
   * @param {number} constraintPct - 0 to 100
   * @param {number} soc - 0 to 100
   * @returns {Object} { status: "LEGAL"|"LIMITED"|"BLOCKED", label: string, isClamped: boolean, clampedPowerKw: number }
   */
  static getFiaStatus(requestedPowerKw, constraintPct, soc) {
    const maxLegal = this.getMaxLegalPower(constraintPct);
    const power = requestedPowerKw;

    // Blocked if battery is below 15% safety reserve floor
    if (soc < 15 && power > 50) {
      return {
        status: "BLOCKED",
        label: "✕ BLOCKED (15% SAFETY RESERVE FLOOR)",
        isClamped: true,
        clampedPowerKw: 0,
        maxLegalPower: maxLegal
      };
    }

    if (power > maxLegal) {
      return {
        status: "LIMITED",
        label: `⚠ FIA LIMIT REACHED (${maxLegal} kW MAX)`,
        isClamped: true,
        clampedPowerKw: maxLegal,
        maxLegalPower: maxLegal
      };
    }

    return {
      status: "LEGAL",
      label: `✓ LEGAL DEPLOYMENT (${power} kW / ${maxLegal} kW MAX)`,
      isClamped: false,
      clampedPowerKw: power,
      maxLegalPower: maxLegal
    };
  }

  /**
   * Runs the deterministic overtake simulation
   *
   * @param {Object} params
   * @param {number} params.soc - Battery SOC (0 to 100)
   * @param {number} params.constraintPct - FIA Constraint (0 to 100, LOW to HIGH)
   * @param {number} params.deploymentPct - Energy Deployment (0 to 100, SAVE to ATTACK)
   * @param {number} params.opportunityPct - Overtake Opportunity (0 to 100, LOW to HIGH)
   * @returns {Object} Simulation result
   */
  static simulate({ soc, constraintPct, deploymentPct, opportunityPct }) {
    const batteryCapacityMJ = 4.00; // 4.00 MJ usable ESS
    const currentEnergyMJ = (soc / 100) * batteryCapacityMJ;

    // Deployment slider maps 0..100 to 0..350 kW
    const requestedPowerKw = Math.round((deploymentPct / 100) * 350);

    // FIA constraint clamping
    const fiaInfo = this.getFiaStatus(requestedPowerKw, constraintPct, soc);
    const effectivePowerKw = fiaInfo.clampedPowerKw;

    // Energy deployed: Power (kW) * duration (2.4s) / 1000 = MJ
    const deployDurationSec = 2.4;
    const energyUsedMJ = Math.min(
      currentEnergyMJ,
      Math.round(((effectivePowerKw * deployDurationSec) / 1000) * 100) / 100
    );

    const remainingEnergyMJ = Math.max(0, Math.round((currentEnergyMJ - energyUsedMJ) * 100) / 100);
    const remainingSoc = Math.max(0, Math.round((remainingEnergyMJ / batteryCapacityMJ) * 100));

    // Overtake requirements
    // Needed power depends on opportunity: high opportunity needs less power (e.g. 210 kW), low needs more (e.g. 300 kW)
    const requiredPowerKw = Math.round(310 - (opportunityPct / 100) * 100);
    // Required minimum remaining energy reserve
    const requiredMinEnergyMJ = 1.00; // 25% SOC buffer

    let canOvertake = true;
    let failureReason = "";

    if (soc < 30 || remainingEnergyMJ < requiredMinEnergyMJ) {
      canOvertake = false;
      failureReason = "Energy reserve too low to complete attack and defend.";
    } else if (effectivePowerKw < requiredPowerKw) {
      if (fiaInfo.isClamped && requestedPowerKw > fiaInfo.maxLegalPower) {
        canOvertake = false;
        failureReason = `Insufficient legal deployment (clamped to ${fiaInfo.maxLegalPower} kW by FIA constraint).`;
      } else {
        canOvertake = false;
        failureReason = `Insufficient electrical deployment (${effectivePowerKw} kW requested, ${requiredPowerKw} kW required).`;
      }
    } else if (opportunityPct < 35) {
      canOvertake = false;
      failureReason = "Overtake opportunity too weak (gap too large or poor corner exit).";
    }

    // "TRY OPTIMAL" Decision Engine Recommendation
    let optimalConfig = null;
    let tryRecommendation = "";

    if (!canOvertake) {
      if (soc < 35) {
        tryRecommendation = "TRY: SAVE — Save energy for the next strategic window.";
        optimalConfig = {
          soc: 65, // simulated recovery/preservation over 1 lap
          constraintPct: Math.min(40, constraintPct),
          deploymentPct: 80, // 280 kW
          opportunityPct: 75,
          narrative: "SAVE → Energy preserved (+1.2 MJ) → Wait for high-value DRS zone → Legal 280 kW deployment → OVERTAKE SUCCESS"
        };
      } else if (fiaInfo.status === "LIMITED" || fiaInfo.status === "BLOCKED") {
        tryRecommendation = "TRY: OPTIMIZED CALIBRATION — Deploy within legal FIA window.";
        optimalConfig = {
          soc: Math.max(soc, 55),
          constraintPct: Math.min(35, constraintPct),
          deploymentPct: Math.round((fiaInfo.maxLegalPower / 350) * 100),
          opportunityPct: Math.max(70, opportunityPct),
          narrative: "Calibrate deployment within legal FIA limit → Maximize slipstream tow → OVERTAKE SUCCESS"
        };
      } else {
        tryRecommendation = "TRY: WAIT — Hold tow until DRS attack window opens.";
        optimalConfig = {
          soc: Math.max(soc, 60),
          constraintPct: constraintPct,
          deploymentPct: 85,
          opportunityPct: 80,
          narrative: "Tow held → Gap closed to 0.5s → Full legal attack → OVERTAKE SUCCESS"
        };
      }
    }

    return {
      success: canOvertake,
      resultText: canOvertake ? "OVERTAKE SUCCESS" : "OVERTAKE NOT POSSIBLE",
      positionChange: canOvertake ? "P2 → P1" : "P2 (HOLD)",
      energyUsedMJ,
      currentEnergyMJ,
      remainingEnergyMJ,
      initialSoc: soc,
      remainingSoc,
      fiaStatus: fiaInfo.status,
      fiaLabel: fiaInfo.label,
      effectivePowerKw,
      failureReason,
      tryRecommendation,
      optimalConfig
    };
  }
}
