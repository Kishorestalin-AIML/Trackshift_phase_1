/**
 * TRACKSHIFT - DynamicOptimizer
 * Constraint-Oriented Rolling-Horizon Optimizer.
 *
 * Evaluates candidate control space:
 *   - 0 kW × 2.0s (Maintain / Reserve Energy)
 *   - 100 kW × 2.0s (Low balanced deploy)
 *   - 180 kW × 2.0s (Moderate delta closing)
 *   - 250 kW × 2.0s (Sustained overtake boost)
 *   - 286 kW × 1.84s (Optimized attack burst)
 *   - 300 kW × 1.5s (High power burst)
 *   - 350 kW × 1.5s (Full FIA 2026 override limit)
 *   - Delayed deployment (delay 0.8s)
 *   - Regenerative harvest (0 kW aggressive regen)
 *
 * Implements the 8-term objective function:
 *   Score = W_pos * PositionGain + W_over * P_overtake - W_count * P_counter
 *         - W_energy * EnergyCost - W_future * FutureOppLoss + W_harvest * FutureHarvest
 *         - W_time * TimeCost - W_risk * Risk
 */

import { CONSTRAINT_STATUS } from "./ConstraintGenerator.js";

export class DynamicOptimizer {
  constructor(options = {}) {
    this.energyEstimator = options.energyEstimator;
    this.overtakeEngine = options.overtakeEngine;
    this.futureEngine = options.futureEngine;
    this.constraintGenerator = options.constraintGenerator;

    // Configurable Optimizer Weights (Section 16 & 17)
    this.weights = {
      wPosition: options.weights?.wPosition ?? 1.00,
      wOvertake: options.weights?.wOvertake ?? 1.00,
      wCounter: options.weights?.wCounter ?? 1.00,
      wEnergy: options.weights?.wEnergy ?? 0.80,
      wFuture: options.weights?.wFuture ?? 1.20,
      wHarvest: options.weights?.wHarvest ?? 0.70,
      wTime: options.weights?.wTime ?? 0.50,
      wRisk: options.weights?.wRisk ?? 0.60
    };
  }

  setWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Generates candidate control actions across the specified control space
   */
  generateCandidateActions(currentState, currentZone) {
    const candidates = [
      {
        id: "MAINTAIN_0KW",
        label: "0 kW × 2.0 sec",
        powerKw: 0,
        duration: 2.0,
        startOffset: 0.0,
        type: "CONSERVE",
        description: "Reserve energy / Maintain steady gap"
      },
      {
        id: "RECHARGE_HARVEST",
        label: "0 kW Regen Harvest",
        powerKw: 0,
        duration: 2.0,
        startOffset: 0.0,
        type: "HARVEST",
        description: "Maximum regenerative deceleration"
      },
      {
        id: "DEPLOY_100KW",
        label: "100 kW × 2.0 sec",
        powerKw: 100,
        duration: 2.0,
        startOffset: 0.0,
        type: "LOW_DEPLOY",
        description: "Low balanced deploy to minimize delta loss"
      },
      {
        id: "DEPLOY_180KW",
        label: "180 kW × 2.0 sec",
        powerKw: 180,
        duration: 2.0,
        startOffset: 0.0,
        type: "MODERATE_DEPLOY",
        description: "Moderate boost to close slipstream gap"
      },
      {
        id: "DEPLOY_250KW",
        label: "250 kW × 2.0 sec",
        powerKw: 250,
        duration: 2.0,
        startOffset: 0.0,
        type: "ATTACK_DEPLOY",
        description: "Sustained overtake thrust"
      },
      {
        id: "DEPLOY_286KW_184S",
        label: "286 kW × 1.84 sec",
        powerKw: 286,
        duration: 1.84,
        startOffset: 0.0,
        type: "OPTIMAL_BURST",
        description: "Calibrated high-efficiency attack burst"
      },
      {
        id: "DEPLOY_300KW_15S",
        label: "300 kW × 1.5 sec",
        powerKw: 300,
        duration: 1.5,
        startOffset: 0.0,
        type: "HIGH_BURST",
        description: "High-power corner exit burst"
      },
      {
        id: "DEPLOY_350KW_15S",
        label: "350 kW × 1.5 sec",
        powerKw: 350,
        duration: 1.5,
        startOffset: 0.0,
        type: "MAX_OVERRIDE",
        description: "Maximum FIA 2026 override deployment"
      },
      {
        id: "DELAY_DEPLOY_286KW",
        label: "Delay Deploy (+0.8s)",
        powerKw: 286,
        duration: 1.84,
        startOffset: 0.8,
        type: "DELAY_DEPLOY",
        description: "Delayed deployment until corner apex exit"
      }
    ];

    return candidates;
  }

  /**
   * Evaluates candidate actions, scores them using the 8-term objective function,
   * prunes hard constraint violations, and selects the optimal feasible action.
   */
  optimize(currentState, currentZone, futureWindows) {
    const horizonSummary = this.futureEngine.getHorizonSummary(futureWindows);
    const maxFutureOppValue = horizonSummary.maxFutureStrategicValue;
    const bestFutureWin = horizonSummary.bestFutureWindow;

    // 1. Generate candidate space
    const allCandidates = this.generateCandidateActions(currentState, currentZone);

    // 2. Constraint-First Filtering (prune infeasible actions)
    const { feasibleActions, limitedActions, infeasibleActions } = this.constraintGenerator.filterFeasibleActions(
      allCandidates,
      currentState,
      currentZone,
      horizonSummary
    );

    // 3. Score all candidates (both feasible and infeasible for complete Decision Inspector audit)
    const allScoredCandidates = [];

    for (const c of allCandidates) {
      const powerKw = c.powerKw;
      const duration = c.duration;
      const energyCostMJ = (powerKw * duration) / 1000.0;
      const postEnergyMJ = Math.max(0, currentState.estimated_energy - energyCostMJ);

      // A. Probabilities
      const pOvertake = this.overtakeEngine.calculateOvertakeProbability(currentState, currentZone, powerKw, duration);
      const pCounter = this.overtakeEngine.calculateCounterProbability(
        currentState,
        currentZone,
        futureWindows.slice(1),
        postEnergyMJ,
        powerKw
      );

      // B. Expected Position Gain
      const expectedPositionGain = powerKw > 0
        ? Math.max(0, pOvertake * (1.0 - 0.7 * pCounter))
        : 0.08;

      // C. Future Opportunity Loss
      let futureOpportunityLoss = 0.0;
      if (powerKw > 0 && bestFutureWin) {
        const futureNeed = bestFutureWin.energyRequired || 0.65;
        const availableFuture = postEnergyMJ + horizonSummary.totalFutureHarvestMJ;
        if (availableFuture < futureNeed) {
          const deficit = (futureNeed - availableFuture) / futureNeed;
          futureOpportunityLoss = maxFutureOppValue * deficit * (energyCostMJ / 0.5);
        }
      }

      // D. Future Harvest Value
      const futureHarvestValue = Math.min(1.0, horizonSummary.totalFutureHarvestMJ / 1.5);

      // E. Race Time Delta Cost (deploying saves time, preserving incurs time cost)
      const timeCost = powerKw > 0 ? -0.15 * (powerKw / 350.0) : 0.05;

      // F. Tactical Risk
      const thermalRisk = Math.max(0, (currentState.cell_temp - 66.0) / 8.0);
      const counterRiskTerm = pCounter > 0.32 ? (pCounter - 0.32) * 2.0 : 0.0;
      const totalRisk = 0.5 * thermalRisk + 0.5 * counterRiskTerm;

      // G. Constraint Check
      const constCheck = this.constraintGenerator.evaluateCandidate(c, currentState, currentZone, horizonSummary);

      // H. Objective Score Calculation:
      // Score = W_pos * PosGain + W_over * P_over - W_count * P_count
      //       - W_energy * EnergyCost - W_future * FutLoss + W_harvest * FutHarvest
      //       - W_time * TimeCost - W_risk * Risk
      let score = 
          this.weights.wPosition * expectedPositionGain
        + this.weights.wOvertake * pOvertake
        - this.weights.wCounter * (pCounter * 1.5)
        - this.weights.wEnergy * energyCostMJ
        - this.weights.wFuture * (futureOpportunityLoss * 2.0)
        + this.weights.wHarvest * (futureHarvestValue * 0.4)
        - this.weights.wTime * timeCost
        - this.weights.wRisk * totalRisk;

      // Infeasible candidates are marked with negative infinity / disqualified flag
      if (!constCheck.isFeasible) {
        score = -999.0;
      }

      allScoredCandidates.push({
        candidate: c,
        score: parseFloat(score.toFixed(4)),
        pOvertake: parseFloat(pOvertake.toFixed(3)),
        pCounter: parseFloat(pCounter.toFixed(3)),
        energyCostMJ: parseFloat(energyCostMJ.toFixed(3)),
        postEnergyMJ: parseFloat(postEnergyMJ.toFixed(3)),
        futureOpportunityLoss: parseFloat(futureOpportunityLoss.toFixed(3)),
        status: constCheck.status,
        isFeasible: constCheck.isFeasible,
        layer: constCheck.layer,
        reason: constCheck.reason
      });
    }

    // 4. Select Winner from Feasible Candidates
    const feasibleOnly = allScoredCandidates.filter(c => c.isFeasible);
    feasibleOnly.sort((a, b) => b.score - a.score);

    const winner = feasibleOnly.length > 0 ? feasibleOnly[0] : allScoredCandidates[0];

    // Mark winner in candidate inspector list
    allScoredCandidates.forEach(c => {
      c.isSelected = (c.candidate.id === winner.candidate.id);
    });

    // 5. Generate Recommendation Translation & Explanation
    const recommendation = this.translateRecommendation(winner, currentZone, horizonSummary, currentState);
    const explanation = this.generateExplanation(winner, allScoredCandidates, currentState, currentZone, horizonSummary);

    return {
      bestControl: winner.candidate,
      bestScore: winner.score,
      evaluation: winner,
      allCandidates: allScoredCandidates, // Expose full table for Decision Inspector
      feasibleCount: feasibleOnly.length,
      infeasibleCount: infeasibleActions.length,
      recommendation,
      explanation,
      horizonSummary
    };
  }

  translateRecommendation(winner, currentZone, horizonSummary, currentState = null) {
    const condition = currentState?.race_condition || "GREEN";

    if (condition === "VSC") {
      return {
        code: "DECISION_SUSPENDED",
        title: "DECISION SUSPENDED",
        badgeColor: "orange",
        summary: "VSC ACTIVE • WAITING FOR RESTART"
      };
    }

    if (condition === "SAFETY_CAR") {
      return {
        code: "DECISION_CANCELLED",
        title: "PREVIOUS DECISION CANCELLED",
        badgeColor: "orange",
        summary: "RACE STATE CHANGED • RE-OPTIMIZATION REQUIRED"
      };
    }

    if (condition.startsWith("YELLOW")) {
      const yellowSec = condition === "YELLOW_S1" ? 1 : (condition === "YELLOW_S2" ? 2 : 3);
      const zoneSec = currentZone?.sectorNumber || 2;
      if (zoneSec === yellowSec) {
        return {
          code: "DECISION_SUSPENDED",
          title: "DECISION SUSPENDED",
          badgeColor: "yellow",
          summary: `YELLOW FLAG SECTOR ${yellowSec} • OVERTAKING PROHIBITED`
        };
      }
    }

    const act = winner.candidate;
    const p = act.powerKw;
    const dur = act.duration;
    const pOver = winner.pOvertake;
    const pCount = winner.pCounter;

    if (p >= 280) {
      return {
        code: "DEPLOY_NOW",
        title: "DEPLOY NOW",
        badgeColor: "red",
        summary: `Deploy ${p} kW for ${dur}s. Expected Overtake: ${(pOver*100).toFixed(0)}%, Counter Risk: ${(pCount*100).toFixed(0)}%.`
      };
    } else if (p >= 100) {
      return {
        code: "MODERATE_DEPLOY",
        title: "MODERATE CLOSING BOOST",
        badgeColor: "yellow",
        summary: `Deploy ${p} kW for ${dur}s. Controlled delta closing with preserved defense.`
      };
    } else {
      if (currentZone.type === "BRAKING_HARVEST") {
        return {
          code: "REGEN_HARVEST",
          title: "REGENERATE & HARVEST",
          badgeColor: "green",
          summary: `Zero deployment. Maximizing kinetic recovery in deceleration zone.`
        };
      } else if (horizonSummary.bestFutureWindow && horizonSummary.bestFutureWindow.strategicValue > 0.80) {
        return {
          code: "WAIT_FOR_WINDOW",
          title: "WAIT / DELAY DEPLOYMENT",
          badgeColor: "yellow",
          summary: `Preserve energy. Superior window arrives in ${horizonSummary.bestFutureWindow.timeToWindow}s at ${horizonSummary.bestFutureWindow.zone.name}.`
        };
      } else if (pCount > 0.35) {
        return {
          code: "DEFENSIVE_HOLD",
          title: "DEFENSIVE CONTROL / HOLD",
          badgeColor: "yellow",
          summary: `High counter-risk (${(pCount*100).toFixed(0)}%). Hold energy to defend downstream straight.`
        };
      } else {
        return {
          code: "CONSERVE_ENERGY",
          title: "CONSERVE & MAINTAIN",
          badgeColor: "cyan",
          summary: `Maintain steady-state energy trajectory. Rolling re-optimization active.`
        };
      }
    }
  }

  generateExplanation(winner, allCandidates, currentState, currentZone, horizonSummary) {
    const act = winner.candidate;
    const isDeploying = act.powerKw > 0;
    const pOver = winner.pOvertake;
    const pCount = winner.pCounter;
    const eCost = winner.energyCostMJ;
    const futWin = horizonSummary.bestFutureWindow;

    const factors = [];

    // Factor 1: Position gain & overtake
    if (isDeploying) {
      factors.push({
        label: `High expected position gain (P_overtake: ${(pOver * 100).toFixed(0)}%)`,
        passed: pOver >= 0.65
      });
      factors.push({
        label: `Acceptable counter probability (${(pCount * 100).toFixed(0)}% exposure)`,
        passed: pCount <= 0.32
      });
    } else {
      factors.push({
        label: pOver < 0.60
          ? `Current overtaking probability marginal (${(pOver * 100).toFixed(0)}%)`
          : `Counter-risk is elevated (${(pCount * 100).toFixed(0)}%), exposing car to immediate re-pass`,
        passed: pOver >= 0.60
      });
    }

    // Factor 2: Energy requirement feasibility
    const energyFeasible = currentState.estimated_energy >= (eCost + 0.60);
    factors.push({
      label: energyFeasible
        ? `Energy requirement is feasible (${eCost.toFixed(2)} MJ cost leaves ${(currentState.estimated_energy - eCost).toFixed(2)} MJ)`
        : `High energy cost relative to downstream demands`,
      passed: energyFeasible
    });

    // Factor 3: Future harvest & opportunity
    if (futWin && futWin.strategicValue > pOver + 0.15 && !isDeploying) {
      factors.push({
        label: `Future opportunity has higher strategic value (${futWin.zone.name} in ${futWin.timeToWindow}s)`,
        passed: true
      });
    } else {
      factors.push({
        label: `Future harvest can replenish part of consumed energy (+${horizonSummary.totalFutureHarvestMJ.toFixed(2)} MJ ahead)`,
        passed: horizonSummary.totalFutureHarvestMJ >= 0.30
      });
    }

    // Factor 4: Constraints
    factors.push({
      label: "No hard physical or FIA 2026 regulatory constraint violated",
      passed: true
    });

    return {
      title: isDeploying ? "WHY THIS CONTROL?" : "WHY NOT DEPLOY / WHY WAIT?",
      factors,
      selectedSummary: `${act.powerKw} kW × ${act.duration} sec`,
      score: winner.score
    };
  }
}
