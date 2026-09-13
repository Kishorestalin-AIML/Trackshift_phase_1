/**
 * TRACKSHIFT — Master Digital Twin Application Orchestrator
 *
 * Mounts all components into the dark motorsport workstation:
 * - Header status indicators (Live, Profile, Lap, Mode, Rule Status)
 * - Left Panel: RaceStatePanel (SOC, Gap, Closing, Deploy, Recovery, Constraint Levels, Scenarios)
 * - Center: RaceTwinCanvas, BatteryBar, DecisionTwinCard, ScenarioTimeline
 * - Right Panel: FiaRulePanel, CounterfactualGrid, ConstraintImpactView
 * - Bottom Bar: SimulationControlsBar
 */

import { twinStore } from "../state/twinState.js";
import { RaceStatePanel } from "../components/RaceStatePanel.js";
import { RaceTwinCanvas } from "../components/RaceTwinCanvas.js";
import { BatteryBar } from "../components/BatteryBar.js";
import { DecisionTwinCard } from "../components/DecisionTwinCard.js";
import { ScenarioTimeline } from "../components/ScenarioTimeline.js";
import { FiaRulePanel } from "../components/FiaRulePanel.js";
import { CounterfactualGrid } from "../components/CounterfactualGrid.js";
import { ConstraintImpactView } from "../components/ConstraintImpactView.js";
import { SimulationControlsBar } from "../components/SimulationControlsBar.js";
import { F1DecisionTwinEngine } from "../engine/f1DecisionTwinEngine.js";
import { fiaRuleEngine } from "../engine/fia2026RuleEngine.js";

export class TwinApp {
  constructor() {
    this.components = {};
  }

  init() {
    // 1. Initial evaluation
    const state = twinStore.getState();
    const evaluation = F1DecisionTwinEngine.evaluateAll(state);
    const ruleRes = fiaRuleEngine.validateAction(state, "ATTACK", state.deploymentPower, true);

    twinStore.setState({
      selectedStrategy: evaluation.recommendedAction,
      ruleStatus: ruleRes.status,
      ruleViolationMessage: ruleRes.reason,
      recommendation: {
        action: evaluation.recommendedAction,
        title: evaluation.recommendedTitle,
        rationale: evaluation.rationale,
        overtakeProb: evaluation.overtakeProb,
        futureProb: evaluation.futureProb,
        energyRisk: evaluation.energyRisk,
        confidence: evaluation.confidence,
        opportunityCostStatement: evaluation.opportunityCostStatement
      }
    });

    // 2. Instantiate and mount UI components
    this.components.raceCanvas = new RaceTwinCanvas("mount-race-twin");
    this.components.batteryBar = new BatteryBar("mount-battery-bar");
    this.components.raceState = new RaceStatePanel("mount-race-state");
    this.components.decisionCard = new DecisionTwinCard("mount-decision-card");
    this.components.timeline = new ScenarioTimeline("mount-scenario-timeline");
    this.components.fiaPanel = new FiaRulePanel("mount-fia-panel");
    this.components.counterfactual = new CounterfactualGrid("mount-counterfactual");
    this.components.constraintImpact = new ConstraintImpactView("mount-constraint-impact");

    this.components.controlsBar = new SimulationControlsBar("mount-controls-bar", (strategy) => {
      if (this.components.raceCanvas) {
        this.components.raceCanvas.triggerAnimation(strategy);
      }
    });

    // 3. Bind header updates
    twinStore.subscribe(s => this.updateHeader(s));
    this.updateHeader(twinStore.getState());
  }

  updateHeader(state) {
    const modeBadge = document.getElementById("hdr-mode-badge");
    const ruleBadge = document.getElementById("hdr-rule-badge");
    const lapReadout = document.getElementById("hdr-lap-readout");

    if (modeBadge) {
      modeBadge.textContent = `MODE: ${state.selectedStrategy || 'WAIT'}`;
      modeBadge.className = `hdr-indicator-pill mode-${(state.selectedStrategy || 'wait').toLowerCase()}`;
    }

    if (ruleBadge) {
      ruleBadge.textContent = `RULE STATUS: ${state.ruleStatus}`;
      ruleBadge.className = `hdr-indicator-pill rule-${state.ruleStatus.toLowerCase()}`;
    }

    if (lapReadout) {
      lapReadout.textContent = `LAP ${state.lap} / ${state.totalLaps}`;
    }
  }
}

// Auto-boot when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const app = new TwinApp();
  app.init();
  window.__twinApp = app;
});
