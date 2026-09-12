/**
 * TRACKSHIFT - DynamicOptimizer
 * Core Rolling-Horizon Constraint-Based Optimizer.
 *
 * Implements:
 *   J(a) = V_gain * P_overtake(a)
 *        - V_loss * P_counter(a)
 *        - lambda_E * E_cost(a)
 *        - lambda_F * FutureOpportunityLoss(a)
 *        - lambda_R * Risk(a)
 *
 * Generates continuous/discrete candidate actions, filters hard constraints,
 * evaluates multi-factor strategic outcomes across the horizon, and selects
 * the optimal feasible control policy.
 */

export class DynamicOptimizer {
  constructor(options = {}) {
    this.energyEstimator = options.energyEstimator;
    this.overtakeEngine = options.overtakeEngine;
    this.futureEngine = options.futureEngine;
    this.constraintGenerator = options.constraintGenerator;

    // Configurable Objective Weights
    this.weights = {
      vGain: options.weights?.vGain ?? 1.4, // Position gain & overtake reward
      vLoss: options.weights?.vLoss ?? 1.2, // Counter-attack penalty
      lambdaE: options.weights?.lambdaE ?? 0.85, // Energy cost penalty
      lambdaF: options.weights?.lambdaF ?? 1.1, // Future opportunity loss penalty
      lambdaR: options.weights?.lambdaR ?? 0.6 // Tactical risk penalty
    };
  }

  setWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Generates candidate control vectors in the continuous/discrete space:
   * powerKw, duration, startOffset, harvestStrategy
   */
  generateCandidateActions(currentState, currentZone) {
    const candidates = [];

    // Continuous/discrete grid of MGU-K power delivery levels
    const powerLevels = [0, 80, 160, 240, 285, 320, 350];
    const durations = [0.8, 1.5, 2.3, 3.2];
    const startOffsets = [0.0, 0.4, 0.8]; // relative to now / entry
    const harvestStrategies = ["BALANCED", "AGGRESSIVE", "COAST"];

    // Base passive / maintenance candidate
    candidates.push({
      id: "MAINTAIN_0KW",
      powerKw: 0,
      duration: 0.0,
      startOffset: 0.0,
      harvestStrategy: "BALANCED",
      description: "Zero deployment / Cruise & Maintain"
    });

    // Pure harvest candidates for braking / lifting zones
    candidates.push({
      id: "HARVEST_MAX",
      powerKw: 0,
      duration: 0.0,
      startOffset: 0.0,
      harvestStrategy: "AGGRESSIVE",
      description: "Max Regenerative Harvesting & Lift-and-Coast"
    });

    // Active deployment candidates
    for (const p of powerLevels) {
      if (p === 0) continue;
      for (const dur of durations) {
        for (const offset of startOffsets) {
          candidates.push({
            id: `DEPLOY_${p}KW_${dur}S_T${offset}`,
            powerKw: p,
            duration: dur,
            startOffset: offset,
            harvestStrategy: "BALANCED",
            description: `MGU-K ${p} kW for ${dur}s at +${offset}s`
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Evaluates candidate actions through rolling horizon simulation and calculates J(a).
   */
  optimize(currentState, currentZone, futureWindows) {
    // 1. Generate candidate action set
    const allCandidates = this.generateCandidateActions(currentState, currentZone);

    // 2. Constraint-First Filtering (prune infeasible actions)
    const { feasibleActions, rejectedActions } = this.constraintGenerator.filterFeasibleActions(
      allCandidates,
      currentState,
      currentZone
    );

    if (feasibleActions.length === 0) {
      // Fallback safe action if everything else is constrained
      const safeAction = {
        id: "SAFE_FALLBACK",
        powerKw: 0,
        duration: 0.0,
        startOffset: 0.0,
        harvestStrategy: "BALANCED",
        description: "Zero deployment safe fallback"
      };
      feasibleActions.push(safeAction);
    }

    // 3. Horizon Context: find best upcoming future window & harvest
    const horizonSummary = this.futureEngine.getHorizonSummary(futureWindows);
    const maxFutureOppValue = horizonSummary.maxFutureStrategicValue;
    const bestFutureWin = horizonSummary.bestFutureWindow;

    // 4. Simulate and Score each feasible action
    const scoredActions = [];

    for (const action of feasibleActions) {
      const powerKw = action.powerKw;
      const duration = action.duration;
      const energyCostMJ = (powerKw * duration) / 1000.0;
      const postEnergyMJ = Math.max(0, currentState.estimated_energy - energyCostMJ);

      // A. Overtake Probability P(overtake)
      const pOvertake = this.overtakeEngine.calculateOvertakeProbability(
        currentState,
        currentZone,
        powerKw,
        duration
      );

      // B. Counter-Attack Probability P(counter)
      const pCounter = this.overtakeEngine.calculateCounterProbability(
        currentState,
        currentZone,
        futureWindows.slice(1),
        postEnergyMJ,
        powerKw
      );

      // C. Future Opportunity Loss
      // If we spend heavily now when a high-value window is coming up and energy is constrained,
      // future opportunity loss is high.
      let futureOpportunityLoss = 0.0;
      if (powerKw > 0) {
        const futureNeed = (bestFutureWin ? bestFutureWin.energyRequired : 0.65);
        const energySurplusAfterHarvest = postEnergyMJ + horizonSummary.totalFutureHarvestMJ;
        const deficitAtFutureWindow = Math.max(0, futureNeed - energySurplusAfterHarvest);
        const futureScarcity = deficitAtFutureWindow / futureNeed;
        futureOpportunityLoss = maxFutureOppValue * futureScarcity * (energyCostMJ / 0.45);
      }

      // D. Tactical Risk
      // Risk spikes if gap is unstable, or if cell temperature is near threshold
      const thermalRisk = Math.max(0, (currentState.cell_temp - 66.0) / 8.0);
      const counterSpike = pCounter > 0.32 ? (pCounter - 0.32) * 2.0 : 0.0;
      const tacticalRisk = 0.5 * thermalRisk + 0.5 * counterSpike;

      // Position gain utility: higher when within strike distance
      const positionGainPotential = currentState.opponent_gap < 1.0 ? 1.0 : 0.4;

      // E. Dynamic Objective Function:
      // J(a) = V_gain * P_overtake - V_loss * P_counter - lambda_E * E_cost - lambda_F * FutLoss - lambda_R * Risk
      const score = 
          this.weights.vGain * (pOvertake * positionGainPotential)
        - this.weights.vLoss * (pCounter * 1.6)
        - this.weights.lambdaE * (energyCostMJ * 1.0)
        - this.weights.lambdaF * (futureOpportunityLoss * 2.2)
        - this.weights.lambdaR * tacticalRisk;

      scoredActions.push({
        action,
        score: parseFloat(score.toFixed(4)),
        pOvertake: parseFloat(pOvertake.toFixed(3)),
        pCounter: parseFloat(pCounter.toFixed(3)),
        energyCostMJ: parseFloat(energyCostMJ.toFixed(3)),
        futureOpportunityLoss: parseFloat(futureOpportunityLoss.toFixed(3)),
        tacticalRisk: parseFloat(tacticalRisk.toFixed(3)),
        postEnergyMJ: parseFloat(postEnergyMJ.toFixed(3))
      });
    }

    // 5. Select Best Action (Maximizing Objective J(a))
    scoredActions.sort((a, b) => b.score - a.score);
    const bestCandidate = scoredActions[0];

    // 6. Generate Human-Readable Recommendation based on optimal parameters
    const recommendation = this.translateToRecommendation(bestCandidate, currentZone, horizonSummary);

    // 7. Generate Explainability Diagnostics ("Why this control?" / "Why not deploy?")
    const explanation = this.generateExplanation(bestCandidate, scoredActions, currentState, currentZone, horizonSummary);

    return {
      bestControl: bestCandidate.action,
      bestScore: bestCandidate.score,
      evaluation: bestCandidate,
      scoredActions: scoredActions.slice(0, 10), // Top 10 for telemetry view
      rejectedCount: rejectedActions.length,
      sampleRejections: rejectedActions.slice(0, 4),
      recommendation,
      explanation,
      horizonSummary
    };
  }

  /**
   * Translates the optimal continuous control into human-readable engineering instruction
   */
  translateToRecommendation(bestCandidate, currentZone, horizonSummary) {
    const act = bestCandidate.action;
    const p = act.powerKw;
    const dur = act.duration;
    const pOver = bestCandidate.pOvertake;
    const pCount = bestCandidate.pCounter;

    if (p >= 280) {
      if (currentZone.type === "ATTACK_ZONE") {
        return {
          code: "DEPLOY_NOW",
          title: "FULL ATTACK DEPLOY",
          badgeColor: "red",
          summary: `Deploy ${p} kW for ${dur}s at +${act.startOffset}s into attack zone. High strike efficiency.`
        };
      } else {
        return {
          code: "OVERRIDE_BURST",
          title: "TACTICAL BURST DEPLOY",
          badgeColor: "red",
          summary: `Deploy ${p} kW for ${dur}s to secure track position before braking.`
        };
      }
    } else if (p >= 150) {
      return {
        code: "MODERATE_DEPLOY",
        title: "MODERATE CLOSING BOOST",
        badgeColor: "yellow",
        summary: `Deploy ${p} kW for ${dur}s to close delta without exhausting battery defense.`
      };
    } else if (p > 0) {
      return {
        code: "LOW_DEPLOY",
        title: "LOW BALANCED DEPLOY",
        badgeColor: "yellow",
        summary: `Deploy ${p} kW for ${dur}s to maintain slipstream with minimal energy loss.`
      };
    } else {
      if (act.harvestStrategy === "AGGRESSIVE" || currentZone.type === "BRAKING") {
        return {
          code: "HARVEST_RECHARGE",
          title: "REGENERATE & HARVEST",
          badgeColor: "green",
          summary: `Zero deployment. Maximize kinetic regeneration (-250 kW) in deceleration phase.`
        };
      } else if (horizonSummary.bestFutureWindow && horizonSummary.bestFutureWindow.strategicValue > 0.75) {
        return {
          code: "CONSERVE_FOR_WINDOW",
          title: `PRESERVE FOR ${horizonSummary.bestFutureWindow.zone.name.toUpperCase()}`,
          badgeColor: "yellow",
          summary: `Preserve ERS. High-value window arrives in ${horizonSummary.bestFutureWindow.timeToWindow}s (+${horizonSummary.bestFutureWindow.distanceToWindow}m).`
        };
      } else if (pCount > 0.35) {
        return {
          code: "DEFENSIVE_HOLD",
          title: "DEFENSIVE HOLD / POSITION",
          badgeColor: "yellow",
          summary: `Counter-risk elevated (${(pCount * 100).toFixed(0)}%). Retain reserve to defend subsequent straight.`
        };
      } else {
        return {
          code: "CRUISE_MAINTAIN",
          title: "CRUISE & RE-EVALUATE",
          badgeColor: "cyan",
          summary: `Maintain steady-state energy trajectory. Rolling re-optimization active.`
        };
      }
    }
  }

  /**
   * Generates dynamic checklist and explanatory diagnostic text:
   * "WHY THIS CONTROL?" or "WHY NOT DEPLOY?"
   */
  generateExplanation(bestCandidate, allScored, currentState, currentZone, horizonSummary) {
    const act = bestCandidate.action;
    const isDeploying = act.powerKw > 0;
    const pOver = bestCandidate.pOvertake;
    const pCount = bestCandidate.pCounter;
    const eCost = bestCandidate.energyCostMJ;
    const futWin = horizonSummary.bestFutureWindow;

    const factors = [];

    // Factor 1: Energy sufficiency
    const energySufficient = currentState.estimated_energy >= (eCost + 0.8);
    factors.push({
      label: energySufficient ? "Current energy sufficient for candidate maneuver" : "Energy reserve tight relative to downstream demands",
      passed: energySufficient
    });

    // Factor 2: Overtake probability vs Counter risk
    if (isDeploying) {
      factors.push({
        label: `Overtake probability favorable (${(pOver * 100).toFixed(0)}%) with expected position delta`,
        passed: pOver >= 0.60
      });
      factors.push({
        label: `Counter-attack probability acceptable (${(pCount * 100).toFixed(0)}% exposure)`,
        passed: pCount <= 0.32
      });
    } else {
      factors.push({
        label: pOver < 0.60 
          ? `Current overtaking probability marginal (${(pOver * 100).toFixed(0)}%)` 
          : `Overtaking feasible (${(pOver * 100).toFixed(0)}%) but counter-risk is critical (${(pCount * 100).toFixed(0)}%)`,
        passed: pOver >= 0.60
      });
    }

    // Factor 3: Future window comparison
    if (futWin && futWin.strategicValue > pOver + 0.15) {
      factors.push({
        label: `Future window (${futWin.zone.name}) has superior strategic yield (${(futWin.strategicValue * 100).toFixed(0)}% vs ${(pOver * 100).toFixed(0)}%) in ${futWin.timeToWindow}s`,
        passed: !isDeploying // If not deploying, it's a reason to wait!
      });
    } else {
      factors.push({
        label: "Immediate window offers prime tactical return along horizon",
        passed: true
      });
    }

    // Factor 4: Harvesting outlook
    const futureHarvestGood = horizonSummary.totalFutureHarvestMJ >= 0.35;
    factors.push({
      label: futureHarvestGood 
        ? `Upcoming braking zones provide substantial kinetic recovery (+${horizonSummary.totalFutureHarvestMJ.toFixed(2)} MJ)` 
        : `Limited downstream regeneration (+${horizonSummary.totalFutureHarvestMJ.toFixed(2)} MJ) demands conservation`,
      passed: futureHarvestGood
    });

    // Factor 5: Regulatory & technical headroom
    factors.push({
      label: "Action fully compliant with configured 2026 FIA power & lap energy constraints",
      passed: true
    });

    return {
      title: isDeploying ? "WHY THIS CONTROL?" : "WHY NOT DEPLOY?",
      factors,
      optimalResultText: isDeploying
        ? `Deploy ${act.powerKw} kW for ${act.duration.toFixed(1)}s (Cost: ${eCost.toFixed(2)} MJ, Score: ${bestCandidate.score})`
        : `Preserve ERS and re-evaluate at next zone transition (Score: ${bestCandidate.score})`
    };
  }
}
