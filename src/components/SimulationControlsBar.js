/**
 * TRACKSHIFT — Simulation Controls Bar & Demo Launcher (Sections 16 & 20)
 *
 * Provides responsive, fully functional controls:
 * - [▶ RUN SIMULATION]
 * - [⏸ PAUSE]
 * - [↻ RESET]
 * - [⚡ ATTACK NOW]
 * - [🛡 DEFEND]
 * - [💾 SAVE]
 * - [♻ RECOVER]
 * - [⏩ FAST FORWARD (1x, 2x, 5x)]
 * - [DEMO SCENARIOS (D1 - D5)]
 */

import { twinStore } from "../state/twinState.js";
import { DEMO_PRESETS } from "../engine/scenarioLibrary.js";
import { F1DecisionTwinEngine } from "../engine/f1DecisionTwinEngine.js";

export class SimulationControlsBar {
  constructor(containerId, onRunAnimation) {
    this.container = document.getElementById(containerId);
    this.onRunAnimation = onRunAnimation; // callback to trigger RaceTwinCanvas animation
    this.render();
    this.bindEvents();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="simulation-dock">
        <!-- Playback Group -->
        <div class="dock-group playback-group">
          <button class="btn-dock btn-run" id="btn-run-sim" title="Run Dynamic Race Simulation">
            ▶ RUN SIMULATION
          </button>
          <button class="btn-dock btn-pause" id="btn-pause-sim" title="Pause Simulation">
            ⏸ PAUSE
          </button>
          <button class="btn-dock btn-reset" id="btn-reset-sim" title="Reset to Initial Parameters">
            ↻ RESET
          </button>
          <button class="btn-dock btn-speed" id="btn-ff-sim" title="Toggle Speed Multiplier (1x, 2x, 5x)">
            ⏩ 1x SPEED
          </button>
        </div>

        <div class="dock-separator"></div>

        <!-- Direct Strategy Triggers -->
        <div class="dock-group strategy-group">
          <span class="dock-group-label text-mono">FORCE STRATEGY:</span>
          <button class="btn-dock btn-strat-attack" id="btn-strat-attack">
            ⚡ ATTACK NOW
          </button>
          <button class="btn-dock btn-strat-wait" id="btn-strat-wait">
            ⏱ WAIT
          </button>
          <button class="btn-dock btn-strat-save" id="btn-strat-save">
            💾 SAVE
          </button>
          <button class="btn-dock btn-strat-defend" id="btn-strat-defend">
            🛡 DEFEND
          </button>
          <button class="btn-dock btn-strat-recover" id="btn-strat-recover">
            ♻ RECOVER
          </button>
        </div>

        <div class="dock-separator"></div>

        <!-- Demo Scenarios Dropdown (Section 20) -->
        <div class="dock-group demo-group">
          <span class="dock-group-label text-mono">DEMO PRESETS:</span>
          ${DEMO_PRESETS.map((demo, idx) => `
            <button class="btn-dock btn-demo" data-demo-id="${demo.id}" title="${demo.desc}">
              D${idx + 1}: ${demo.badge}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  bindEvents() {
    const btnRun = document.getElementById("btn-run-sim");
    const btnPause = document.getElementById("btn-pause-sim");
    const btnReset = document.getElementById("btn-reset-sim");
    const btnFf = document.getElementById("btn-ff-sim");

    if (btnRun) {
      btnRun.addEventListener("click", () => {
        const state = twinStore.getState();
        if (this.onRunAnimation) {
          this.onRunAnimation(state.selectedStrategy || "ATTACK");
        }
      });
    }

    if (btnPause) {
      btnPause.addEventListener("click", () => {
        twinStore.setState({ simulationMode: "PAUSED" });
      });
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        twinStore.reset();
        this.syncAllInputs();
      });
    }

    if (btnFf) {
      btnFf.addEventListener("click", () => {
        const cur = twinStore.getState().speedMultiplier || 1;
        const next = cur === 1 ? 2 : cur === 2 ? 5 : 1;
        twinStore.setState({ speedMultiplier: next });
        btnFf.textContent = `⏩ ${next}x SPEED`;
      });
    }

    // Direct Strategy Triggers
    const stratMap = {
      "btn-strat-attack": "ATTACK",
      "btn-strat-wait": "WAIT",
      "btn-strat-save": "SAVE",
      "btn-strat-defend": "DEFEND",
      "btn-strat-recover": "RECOVER"
    };

    Object.entries(stratMap).forEach(([btnId, strat]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          twinStore.setState({ selectedStrategy: strat });
          if (this.onRunAnimation) {
            this.onRunAnimation(strat);
          }
        });
      }
    });

    // Demo Preset Buttons (Section 20)
    const demoBtns = this.container.querySelectorAll(".btn-demo");
    demoBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const demoId = btn.getAttribute("data-demo-id");
        const preset = DEMO_PRESETS.find(d => d.id === demoId);
        if (preset) {
          this.loadDemoPreset(preset);
        }
      });
    });
  }

  loadDemoPreset(preset) {
    twinStore.setState({
      soc: preset.params.soc,
      gap: preset.params.gap,
      closingSpeed: preset.params.closingSpeed,
      deploymentPower: preset.params.deploymentPower,
      recoveryPotential: preset.params.recoveryPotential,
      constraintLevel: preset.params.constraintLevel,
      overtakeResult: null,
      timelineProgressSec: 0.0,
      timelineStageIndex: 0
    });

    this.syncAllInputs();

    // Re-evaluate
    const state = twinStore.getState();
    const evaluation = F1DecisionTwinEngine.evaluateAll(state);
    twinStore.setState({
      selectedStrategy: evaluation.recommendedAction,
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

    // Auto-trigger simulation animation
    if (this.onRunAnimation) {
      this.onRunAnimation(evaluation.recommendedAction);
    }
  }

  syncAllInputs() {
    const state = twinStore.getState();
    const sliderSoc = document.getElementById("slider-soc");
    const sliderGap = document.getElementById("slider-gap");
    const sliderClosing = document.getElementById("slider-closing");
    const sliderDeploy = document.getElementById("slider-deploy");
    const sliderRecovery = document.getElementById("slider-recovery");
    const sliderConstraint = document.getElementById("slider-constraint");

    if (sliderSoc) sliderSoc.value = state.soc;
    if (sliderGap) sliderGap.value = state.gap;
    if (sliderClosing) sliderClosing.value = state.closingSpeed;
    if (sliderDeploy) sliderDeploy.value = state.deploymentPower;
    if (sliderRecovery) sliderRecovery.value = state.recoveryPotential;
    if (sliderConstraint) sliderConstraint.value = state.constraintLevel;
  }

  update(state) {
    // Highlight currently selected strategy button
    const stratButtons = {
      "ATTACK": document.getElementById("btn-strat-attack"),
      "WAIT": document.getElementById("btn-strat-wait"),
      "SAVE": document.getElementById("btn-strat-save"),
      "DEFEND": document.getElementById("btn-strat-defend"),
      "RECOVER": document.getElementById("btn-strat-recover")
    };

    Object.entries(stratButtons).forEach(([strat, btn]) => {
      if (btn) {
        btn.classList.toggle("active", state.selectedStrategy === strat);
      }
    });

    const runBtn = document.getElementById("btn-run-sim");
    if (runBtn) {
      runBtn.classList.toggle("running", state.simulationMode === "RUNNING");
    }
  }
}
