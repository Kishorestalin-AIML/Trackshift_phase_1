/**
 * ALPINE F1 2026 ENERGY & OVERTAKE DIGITAL TWIN ENGINE
 *
 * Implements the real-time dynamic decision scoring model:
 * Decision Score = Immediate Overtake Value
 *                + Position Value
 *                + Defensive Value
 *                - Energy Cost
 *                - Future Opportunity Cost
 *                - Risk
 *                - FIA Constraint Penalty
 *
 * Evaluates: ATTACK, WAIT, SAVE, RECOVER, DEFEND
 */

export class AlpineTwinEngine {
  /**
   * Evaluates maximum legal power based on FIA Constraint (0 to 100)
   * LOW (0) = 350 kW, MODERATE (50) = 275 kW, HIGH (100) = 200 kW
   */
  static getMaxLegalPower(constraintPct) {
    const c = Math.max(0, Math.min(100, constraintPct));
    return Math.round(350 - (c / 100) * 150);
  }

  /**
   * Evaluates the best real-time recommendation based on all 7 race situation inputs
   *
   * @param {Object} state
   * @param {number} state.currentLap - 1 to 57
   * @param {number} state.lapsRemaining - 1 to 57
   * @param {number} state.position - 1 to 8 (P1 to P8)
   * @param {number} state.carBehindGap - 0.2 to 5.0 seconds
   * @param {number} state.carAheadGap - 0.2 to 5.0 seconds
   * @param {number} state.soc - 0 to 100%
   * @param {number} state.constraintPct - 0 (LOW) to 100 (HIGH)
   * @returns {Object} Complete decision package
   */
  static evaluate(state) {
    const {
      currentLap = 24,
      lapsRemaining = 33,
      position = 3,
      carBehindGap = 0.7,
      carAheadGap = 0.8,
      soc = 58,
      constraintPct = 25
    } = state;

    const isP1 = position === 1;
    const maxLegalPower = this.getMaxLegalPower(constraintPct);
    const hasDefensivePressure = carBehindGap < 0.5;
    const hasModerateRearThreat = carBehindGap < 0.8;
    const isRearSafe = carBehindGap > 2.0;

    const isLowSoc = soc < 30;
    const isCriticalSoc = soc < 20;
    const isHighSoc = soc >= 65;

    const isFewLapsRemaining = lapsRemaining <= 3;
    const isFinalLap = lapsRemaining === 1 || currentLap >= 57;
    const isEarlyRace = lapsRemaining > 35;

    const isAheadClose = !isP1 && carAheadGap <= 1.0;
    const isAheadVeryClose = !isP1 && carAheadGap <= 0.6;
    const isAheadDistant = isP1 || carAheadGap > 2.2;

    // 1. Scoring Candidates
    // ATTACK, WAIT, SAVE, RECOVER, DEFEND
    const scores = {
      ATTACK: 0,
      WAIT: 0,
      SAVE: 0,
      RECOVER: 0,
      DEFEND: 0
    };

    // --- ATTACK SCORING ---
    if (isP1) {
      scores.ATTACK = -999; // Cannot attack ahead in P1
    } else {
      // Immediate Overtake Value
      let overtakeVal = isAheadVeryClose ? 95 : isAheadClose ? 75 : carAheadGap <= 1.5 ? 45 : 10;
      // Position Value (P2/P3 high value, lower positions justify aggressive moves)
      let posVal = position >= 6 ? 40 : position >= 3 ? 35 : 30;
      // Energy Cost & SOC penalty
      let energyCost = isLowSoc ? (isFewLapsRemaining ? 15 : 65) : isCriticalSoc ? 90 : 15;
      // Future Opportunity Cost (high when many laps remaining, near zero when few laps remaining)
      let futureCost = isEarlyRace ? 30 : isFewLapsRemaining ? 0 : 15;
      // Defensive Risk (danger of counter-attack from car behind)
      let defRisk = hasDefensivePressure ? 75 : hasModerateRearThreat ? 20 : isRearSafe ? 0 : 10;
      // FIA Constraint Penalty
      let fiaPenalty = constraintPct > 70 ? 45 : constraintPct > 40 ? 25 : 5;

      scores.ATTACK = overtakeVal + posVal - energyCost - futureCost - defRisk - fiaPenalty;
      if (isFewLapsRemaining && !isLowSoc && carAheadGap <= 1.5) {
        scores.ATTACK += 40; // End-of-race aggression
      }
    }

    // --- DEFEND SCORING ---
    if (hasDefensivePressure) {
      scores.DEFEND = 95;
    } else if (hasModerateRearThreat) {
      scores.DEFEND = isP1 ? 85 : isLowSoc ? 70 : 40;
    } else {
      scores.DEFEND = isP1 ? 65 : 15;
    }
    if (isP1) scores.DEFEND += 40; // Leader defense is primary

    // --- SAVE SCORING ---
    scores.SAVE = isCriticalSoc ? 85 : isLowSoc ? 70 : 35;
    if (isEarlyRace) scores.SAVE += 20;
    if (constraintPct > 60) scores.SAVE += 25;
    if (isFewLapsRemaining) scores.SAVE -= 45; // Do not save on final laps
    if (isAheadDistant && !hasDefensivePressure) scores.SAVE += 15;

    // --- WAIT SCORING ---
    scores.WAIT = isAheadClose && !isAheadVeryClose ? 55 : 35;
    if (constraintPct > 50) scores.WAIT += 20;
    if (isLowSoc && !isCriticalSoc) scores.WAIT += 15;
    if (hasDefensivePressure) scores.WAIT -= 30;

    // --- RECOVER SCORING ---
    scores.RECOVER = isCriticalSoc ? 90 : isLowSoc ? 65 : 25;
    if (hasDefensivePressure) scores.RECOVER -= 40; // Cannot recover easily under close defense
    if (isFewLapsRemaining) scores.RECOVER -= 30;

    // Determine primary recommendation
    let bestAction = "WAIT";
    let highestScore = -9999;
    for (const [action, sc] of Object.entries(scores)) {
      if (sc > highestScore) {
        highestScore = sc;
        bestAction = action;
      }
    }

    // Enforce strict priority rules based on explicit specification:
    // P1: DEFEND > SAVE > ATTACK
    if (isP1) {
      if (hasModerateRearThreat || hasDefensivePressure) {
        bestAction = "DEFEND";
      } else if (isLowSoc || constraintPct > 50) {
        bestAction = "SAVE";
      } else {
        bestAction = "DEFEND";
      }
    } else {
      // If car behind is within 0.5s -> DEFEND takes precedence unless final lap
      if (hasDefensivePressure && !isFinalLap) {
        bestAction = "DEFEND";
      } else if (isLowSoc && !isFewLapsRemaining && bestAction === "ATTACK") {
        bestAction = "SAVE";
      } else if (constraintPct > 70 && bestAction === "ATTACK" && !isAheadVeryClose) {
        bestAction = "WAIT";
      }
    }

    // Synthesize engineering "WHY" justification
    let why = "";
    if (bestAction === "ATTACK") {
      if (isFinalLap) {
        why = `Final lap of the race: full legal electrical attack deployed to secure P${position - 1}.`;
      } else if (isAheadVeryClose) {
        why = `Car ahead is in optimal attack range (${carAheadGap.toFixed(1)}s) with ${soc}% SOC and rear gap secure (${carBehindGap.toFixed(1)}s).`;
      } else {
        why = `Car ahead is within range (${carAheadGap.toFixed(1)}s) and sufficient legal energy is available.`;
      }
    } else if (bestAction === "DEFEND") {
      if (hasDefensivePressure) {
        why = `Car behind is within ${carBehindGap.toFixed(1)}s (DEFENSIVE PRESSURE): attacking now would expose P${position} to an immediate counter-pass.`;
      } else if (isP1) {
        why = `P1 race leader: defensive energy conservation prioritized over unnecessary high-risk deployment.`;
      } else {
        why = `Car behind is closing (${carBehindGap.toFixed(1)}s): electrical reserve required to defend line into braking zone.`;
      }
    } else if (bestAction === "SAVE") {
      if (isLowSoc) {
        why = `SOC is low (${soc}%) and a stronger attack opportunity is expected in 2 laps.`;
      } else if (isEarlyRace) {
        why = `${lapsRemaining} laps remaining: preserving finite battery capacity to avoid late-race performance cliff.`;
      } else {
        why = `Regulatory constraint is restrictive (${maxLegalPower} kW legal limit): conserve finite energy for DRS attack zone.`;
      }
    } else if (bestAction === "WAIT") {
      if (constraintPct > 50) {
        why = `FIA constraint is high (${maxLegalPower} kW limit): hold slipstream tow and wait for cleaner attack window.`;
      } else if (isAheadDistant) {
        why = `Car ahead is ${carAheadGap.toFixed(1)}s ahead: close gap in slipstream before deploying attack mode.`;
      } else {
        why = `Hold position: energy conservation and tow alignment will yield higher expected overtake probability next lap.`;
      }
    } else if (bestAction === "RECOVER") {
      why = `Battery reserve critically depleted (${soc}%): harvest kinetic energy under braking to prepare next tactical window.`;
    }

    // Energy delta model
    let energyUsedMJ = 0;
    let deltaSoc = 0;
    let targetPos = position;
    let fiaStatus = "LEGAL";

    if (bestAction === "ATTACK") {
      const requestedKw = 280;
      const deployKw = Math.min(requestedKw, maxLegalPower);
      energyUsedMJ = Math.round(((deployKw * 2.2) / 1000) * 100) / 100;
      deltaSoc = -Math.round((energyUsedMJ / 4.0) * 100);
      targetPos = Math.max(1, position - 1);
      fiaStatus = isCriticalSoc ? "BLOCKED" : maxLegalPower < requestedKw ? "LIMITED" : "LEGAL";
    } else if (bestAction === "DEFEND") {
      energyUsedMJ = 0.28;
      deltaSoc = -7;
      targetPos = position;
      fiaStatus = "LEGAL";
    } else if (bestAction === "SAVE") {
      energyUsedMJ = 0.08;
      deltaSoc = -2;
      targetPos = position;
      fiaStatus = "LEGAL";
    } else if (bestAction === "WAIT") {
      energyUsedMJ = 0.12;
      deltaSoc = -3;
      targetPos = position;
      fiaStatus = "LEGAL";
    } else if (bestAction === "RECOVER") {
      energyUsedMJ = -0.32; // Harvested
      deltaSoc = +8;
      targetPos = position;
      fiaStatus = "LEGAL";
    }

    const remainingSoc = Math.max(5, Math.min(100, soc + deltaSoc));

    // "OVERCOME CONSTRAINT" / Adaptation Engine
    let adaptationNeeded = false;
    let adaptationReason = "";
    let adaptedConfig = null;

    if (bestAction !== "ATTACK" && !isP1) {
      adaptationNeeded = true;
      if (hasDefensivePressure) {
        adaptationReason = `Immediate attack blocked: car behind (${carBehindGap.toFixed(1)}s) threatens position P${position}.`;
        adaptedConfig = {
          currentLap: Math.min(57, currentLap + 1),
          lapsRemaining: Math.max(1, lapsRemaining - 1),
          position: position,
          carBehindGap: 1.8, // Defended successfully, built buffer
          carAheadGap: Math.max(0.4, carAheadGap - 0.2), // Tucked into tow
          soc: Math.min(100, soc + 15), // Recovered
          constraintPct: Math.min(30, constraintPct),
          adaptationPath: "DEFEND → RECOVER → CLOSE GAP → ATTACK",
          narrative: "Defensive line held → Rear gap expanded to 1.8s → Tucked into slipstream → High-power ATTACK window opened!"
        };
      } else if (isLowSoc) {
        adaptationReason = `Immediate attack blocked: SOC is too low (${soc}%) to complete overtake.`;
        adaptedConfig = {
          currentLap: Math.min(57, currentLap + 2),
          lapsRemaining: Math.max(1, lapsRemaining - 2),
          position: position,
          carBehindGap: Math.max(1.2, carBehindGap),
          carAheadGap: 0.6,
          soc: 68, // Saved and recovered
          constraintPct: Math.min(25, constraintPct),
          adaptationPath: "SAVE → RECOVER → TOW ALIGNMENT → ATTACK",
          narrative: "Energy conserved for 2 laps → Battery recharged to 68% → Perfect DRS exit → ATTACK SUCCESS!"
        };
      } else {
        adaptationReason = `Immediate attack blocked: high FIA constraint restricts legal deployment to ${maxLegalPower} kW.`;
        adaptedConfig = {
          currentLap: currentLap,
          lapsRemaining: lapsRemaining,
          position: position,
          carBehindGap: carBehindGap,
          carAheadGap: 0.5,
          soc: Math.max(55, soc),
          constraintPct: 20, // Clean acceleration zone
          adaptationPath: "WAIT FOR DRIVING ZONE → MAXIMIZE SLIPSTREAM → LEGAL ATTACK",
          narrative: "Tow sustained through technical sector → Reached primary acceleration straight → 320 kW LEGAL ATTACK!"
        };
      }
    }

    return {
      recommendation: bestAction,
      why,
      scores,
      initialSoc: soc,
      remainingSoc,
      energyUsedMJ: Math.abs(energyUsedMJ),
      initialPosition: `P${position}`,
      targetPosition: `P${targetPos}`,
      positionTransition: position === targetPos ? `P${position} (HELD)` : `P${position} → P${targetPos}`,
      fiaStatus,
      maxLegalPower,
      hasDefensivePressure,
      adaptationNeeded,
      adaptationReason,
      adaptedConfig
    };
  }

  /**
   * Evaluates the outcome of running the simulation under current conditions
   */
  static simulateOvertake(state) {
    const decision = this.evaluate(state);

    if (decision.recommendation === "ATTACK") {
      // Check if attack is physically and legally successful
      const legalPower = decision.maxLegalPower;
      const sufficientPower = legalPower >= 240;
      const sufficientSoc = state.soc >= 28;
      const sufficientGap = state.carAheadGap <= 1.5;

      if (sufficientPower && sufficientSoc && sufficientGap) {
        return {
          ...decision,
          success: true,
          resultTitle: "OVERTAKE SUCCESS",
          resultSummary: `${decision.initialPosition} → ${decision.targetPosition}`,
          energyDisplay: `${decision.initialSoc}% → ${decision.remainingSoc}%`
        };
      } else {
        let reason = "Attack window too weak";
        if (!sufficientPower) reason = "Insufficient legal energy deployment (restricted by FIA constraint)";
        else if (!sufficientSoc) reason = "Finite electrical energy depleted before completing pass";
        else if (!sufficientGap) reason = "Car ahead gap too large to overcome in available straightaway";

        return {
          ...decision,
          success: false,
          resultTitle: "OVERTAKE FAILED",
          resultSummary: `${decision.initialPosition} (RETAINED)`,
          failureReason: reason,
          energyDisplay: `${decision.initialSoc}% → ${decision.remainingSoc}%`
        };
      }
    } else {
      // Non-attack decision simulation (Defend, Save, Wait, Recover)
      return {
        ...decision,
        success: true,
        resultTitle: `${decision.recommendation} EXECUTED`,
        resultSummary: decision.positionTransition,
        energyDisplay: `${decision.initialSoc}% → ${decision.remainingSoc}%`
      };
    }
  }
}
