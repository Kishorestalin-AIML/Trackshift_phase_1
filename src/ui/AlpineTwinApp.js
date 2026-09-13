/**
 * ALPINE ENERGY & OVERTAKE TWIN — APP CONTROLLER
 *
 * Implements:
 * - Clean White + Alpine Blue UI interactions
 * - Compact RACE SITUATION controls (Current Lap, Laps Remaining, Position P1-P8,
 *   Car Behind Gap, Car Ahead Gap, SOC, FIA Constraint)
 * - Real-time dynamic re-scoring upon ANY slider/position change
 * - 3-car race strip animation orchestration
 * - "OVERCOME CONSTRAINT" Adaptation engine ([⚡ ADAPT STRATEGY])
 * - Minimal 5-item result panel
 */

import { AlpineTwinEngine } from "../engine/alpineTwinEngine.js";
import { AlpineRaceTrack } from "../components/AlpineRaceTrack.js";

export class AlpineTwinApp {
  constructor() {
    this.raceTrack = null;

    // 7 Race Situation parameters
    this.state = {
      currentLap: 24,
      lapsRemaining: 33,
      position: 3,
      carBehindGap: 0.7,
      carAheadGap: 0.8,
      soc: 58,
      constraintPct: 25 // LOW to MODERATE
    };

    this.latestDecision = null;
    this.isSimulating = false;
  }

  init() {
    this.raceTrack = new AlpineRaceTrack("alpine-track-canvas");
    this.bindControls();
    this.recalculateDecision();
  }

  bindControls() {
    // 1. Current Lap Slider
    const sliderLap = document.getElementById("slider-current-lap");
    if (sliderLap) {
      sliderLap.addEventListener("input", (e) => {
        this.state.currentLap = parseInt(e.target.value, 10);
        // Automatically sync remaining laps if requested
        const rem = Math.max(1, 57 - this.state.currentLap);
        this.state.lapsRemaining = rem;
        const sliderRem = document.getElementById("slider-laps-remaining");
        if (sliderRem) sliderRem.value = rem;
        this.recalculateDecision();
      });
    }

    // 2. Laps Remaining Slider
    const sliderRem = document.getElementById("slider-laps-remaining");
    if (sliderRem) {
      sliderRem.addEventListener("input", (e) => {
        this.state.lapsRemaining = parseInt(e.target.value, 10);
        this.recalculateDecision();
      });
    }

    // 3. Position Selector Pills (P1 to P8)
    const posButtons = document.querySelectorAll(".pos-pill");
    posButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        posButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.position = parseInt(btn.dataset.position, 10);

        // If P1, dim or disable Car Ahead
        const aheadRow = document.getElementById("ctrl-car-ahead-row");
        if (aheadRow) {
          aheadRow.style.opacity = this.state.position === 1 ? "0.4" : "1.0";
          aheadRow.style.pointerEvents = this.state.position === 1 ? "none" : "auto";
        }

        this.recalculateDecision();
      });
    });

    // 4. Car Behind Gap Slider
    const sliderBehind = document.getElementById("slider-car-behind");
    if (sliderBehind) {
      sliderBehind.addEventListener("input", (e) => {
        this.state.carBehindGap = parseFloat(e.target.value);
        this.recalculateDecision();
      });
    }

    // 5. Car Ahead Gap Slider
    const sliderAhead = document.getElementById("slider-car-ahead");
    if (sliderAhead) {
      sliderAhead.addEventListener("input", (e) => {
        this.state.carAheadGap = parseFloat(e.target.value);
        this.recalculateDecision();
      });
    }

    // 6. SOC Slider
    const sliderSoc = document.getElementById("slider-soc");
    if (sliderSoc) {
      sliderSoc.addEventListener("input", (e) => {
        this.state.soc = parseInt(e.target.value, 10);
        this.recalculateDecision();
      });
    }

    // 7. FIA Constraint Slider
    const sliderConstraint = document.getElementById("slider-constraint");
    if (sliderConstraint) {
      sliderConstraint.addEventListener("input", (e) => {
        this.state.constraintPct = parseInt(e.target.value, 10);
        this.recalculateDecision();
      });
    }

    // Run Button
    const btnRun = document.getElementById("btn-run-simulation");
    if (btnRun) {
      btnRun.addEventListener("click", () => this.runSimulation());
    }

    // Adapt Button
    const btnAdapt = document.getElementById("btn-adapt-strategy");
    if (btnAdapt) {
      btnAdapt.addEventListener("click", () => this.applyAdaptation());
    }
  }

  /**
   * Recalculates the real-time dynamic recommendation whenever ANY slider or input changes
   */
  recalculateDecision() {
    this.latestDecision = AlpineTwinEngine.evaluate(this.state);
    this.updateControlsUI();
    this.updateDecisionDisplay(this.latestDecision);

    if (this.raceTrack) {
      this.raceTrack.updateLiveState({
        ...this.state,
        recommendation: this.latestDecision.recommendation
      });
    }
  }

  updateControlsUI() {
    // Current Lap Readout
    const valLap = document.getElementById("val-current-lap");
    if (valLap) valLap.textContent = `LAP ${this.state.currentLap}`;

    // Laps Remaining Readout
    const valRem = document.getElementById("val-laps-remaining");
    if (valRem) valRem.textContent = `${this.state.lapsRemaining} LAPS`;

    // Car Behind Readout
    const valBehind = document.getElementById("val-car-behind");
    if (valBehind) {
      valBehind.textContent = `${this.state.carBehindGap.toFixed(1)} s`;
      if (this.state.carBehindGap < 0.5) {
        valBehind.textContent += " (DEFENSIVE PRESSURE)";
        valBehind.className = "ctrl-val text-red";
      } else if (this.state.carBehindGap < 0.8) {
        valBehind.className = "ctrl-val text-amber";
      } else {
        valBehind.className = "ctrl-val text-blue";
      }
    }

    // Car Ahead Readout
    const valAhead = document.getElementById("val-car-ahead");
    if (valAhead) {
      if (this.state.position === 1) {
        valAhead.textContent = "N/A (RACE LEADER P1)";
        valAhead.className = "ctrl-val text-muted";
      } else {
        valAhead.textContent = `${this.state.carAheadGap.toFixed(1)} s`;
        valAhead.className = this.state.carAheadGap <= 0.8 ? "ctrl-val text-green" : "ctrl-val text-blue";
      }
    }

    // SOC Readout
    const valSoc = document.getElementById("val-soc");
    if (valSoc) {
      valSoc.textContent = `${this.state.soc}%`;
      valSoc.className = this.state.soc < 30 ? "ctrl-val text-red" : this.state.soc < 50 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }

    // FIA Constraint Readout
    const valConstraint = document.getElementById("val-constraint");
    if (valConstraint) {
      const label = this.state.constraintPct < 35 ? "LOW (350 kW)" :
                    this.state.constraintPct < 70 ? "MODERATE (275 kW)" : "HIGH (200 kW)";
      valConstraint.textContent = label;
    }
  }

  updateDecisionDisplay(decision) {
    // 1. Primary Recommendation Badge
    const recBadge = document.getElementById("primary-rec-badge");
    if (recBadge) {
      recBadge.textContent = decision.recommendation;
      recBadge.className = `rec-badge ${decision.recommendation.toLowerCase()}`;
    }

    // 2. Engineering "WHY"
    const recWhy = document.getElementById("primary-rec-why");
    if (recWhy) recWhy.textContent = decision.why;

    // 3. Finite Battery Bar
    const batteryFill = document.getElementById("finite-battery-fill");
    const batteryText = document.getElementById("finite-battery-text");
    if (batteryFill) {
      batteryFill.style.width = `${decision.remainingSoc}%`;
      batteryFill.style.background = decision.remainingSoc < 25 ? "#ef4444" : decision.remainingSoc < 45 ? "#f59e0b" : "#0090ff";
    }
    if (batteryText) {
      batteryText.textContent = `${decision.initialSoc}% → ${decision.remainingSoc}%`;
    }

    // 4. Result Panel Readouts
    const resDecision = document.getElementById("res-decision");
    if (resDecision) resDecision.textContent = decision.recommendation;

    const resWhy = document.getElementById("res-why");
    if (resWhy) resWhy.textContent = decision.why;

    const resEnergy = document.getElementById("res-energy");
    if (resEnergy) resEnergy.textContent = `${decision.initialSoc}% → ${decision.remainingSoc}%`;

    const resPos = document.getElementById("res-position");
    if (resPos) resPos.textContent = decision.positionTransition;

    const resFia = document.getElementById("res-fia");
    if (resFia) {
      resFia.textContent = decision.fiaStatus === "LEGAL" ? "✓ LEGAL" : "⚠ FIA LIMIT";
      resFia.className = `res-val ${decision.fiaStatus === "LEGAL" ? "text-green" : "text-amber"}`;
    }

    // 5. "OVERCOME CONSTRAINT" Adaptation Banner
    const adaptBanner = document.getElementById("adaptation-banner");
    const adaptReason = document.getElementById("adaptation-reason-text");
    const adaptPath = document.getElementById("adaptation-path-text");

    if (decision.adaptationNeeded && decision.adaptedConfig) {
      if (adaptBanner) adaptBanner.style.display = "flex";
      if (adaptReason) adaptReason.textContent = decision.adaptationReason;
      if (adaptPath) adaptPath.textContent = `STRATEGY ADAPTATION: ${decision.adaptedConfig.adaptationPath}`;
    } else {
      if (adaptBanner) adaptBanner.style.display = "none";
    }
  }

  runSimulation() {
    if (this.isSimulating) return;
    this.isSimulating = true;

    const btnRun = document.getElementById("btn-run-simulation");
    if (btnRun) {
      btnRun.disabled = true;
      btnRun.textContent = "ANIMATING TWIN...";
    }

    const simResult = AlpineTwinEngine.simulateOvertake(this.state);

    this.raceTrack.runSimulation(simResult, (res) => {
      this.isSimulating = false;
      if (btnRun) {
        btnRun.disabled = false;
        btnRun.textContent = "▶ RUN SIMULATION";
      }

      // Update Result Strip with final outcome
      const resDecision = document.getElementById("res-decision");
      if (resDecision) {
        resDecision.textContent = res.resultTitle;
        resDecision.className = `res-val ${res.success ? "text-green" : "text-red"}`;
      }

      const resWhy = document.getElementById("res-why");
      if (resWhy) {
        resWhy.textContent = res.failureReason ? `REASON: ${res.failureReason}` : res.why;
      }

      const resPos = document.getElementById("res-position");
      if (resPos) resPos.textContent = res.resultSummary;
    });
  }

  applyAdaptation() {
    if (!this.latestDecision || !this.latestDecision.adaptedConfig) return;
    const cfg = this.latestDecision.adaptedConfig;

    // Apply adapted parameters to state
    this.state.currentLap = cfg.currentLap;
    this.state.lapsRemaining = cfg.lapsRemaining;
    this.state.position = cfg.position;
    this.state.carBehindGap = cfg.carBehindGap;
    this.state.carAheadGap = cfg.carAheadGap;
    this.state.soc = cfg.soc;
    this.state.constraintPct = cfg.constraintPct;

    // Update DOM inputs
    const sliderLap = document.getElementById("slider-current-lap");
    const sliderRem = document.getElementById("slider-laps-remaining");
    const sliderBehind = document.getElementById("slider-car-behind");
    const sliderAhead = document.getElementById("slider-car-ahead");
    const sliderSoc = document.getElementById("slider-soc");
    const sliderConstraint = document.getElementById("slider-constraint");

    if (sliderLap) sliderLap.value = cfg.currentLap;
    if (sliderRem) sliderRem.value = cfg.lapsRemaining;
    if (sliderBehind) sliderBehind.value = cfg.carBehindGap;
    if (sliderAhead) sliderAhead.value = cfg.carAheadGap;
    if (sliderSoc) sliderSoc.value = cfg.soc;
    if (sliderConstraint) sliderConstraint.value = cfg.constraintPct;

    // Update position pills
    document.querySelectorAll(".pos-pill").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.position, 10) === cfg.position);
    });

    // Recalculate
    this.recalculateDecision();

    // Automatically run the adapted simulation to achieve success
    setTimeout(() => {
      this.runSimulation();
    }, 200);
  }
}

// Auto-bootstrap
document.addEventListener("DOMContentLoaded", () => {
  const app = new AlpineTwinApp();
  app.init();
  window.__alpineTwinApp = app;
});
