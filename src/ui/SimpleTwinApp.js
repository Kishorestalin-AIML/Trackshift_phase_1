/**
 * TRACKSHIFT — Simple F1 2026 Energy & Overtake Digital Twin Controller
 *
 * Orchestrates:
 * - 4 interactive controls (SOC, FIA Constraint, Energy Deployment, Overtake Opportunity)
 * - Automatic clamping if user exceeds legal FIA constraint
 * - Finite energy battery bar
 * - Horizontal animated race track
 * - [▶ RUN OVERTAKE] animation execution
 * - "TRY OPTIMAL" decision engine resolution
 * - Clean 4-value result strip
 */

import { SimpleTwinEngine } from "../engine/simpleTwinEngine.js";
import { SimpleRaceTrack } from "../components/SimpleRaceTrack.js";

export class SimpleTwinApp {
  constructor() {
    this.raceTrack = null;

    // Simulation state
    this.state = {
      soc: 60,
      constraintPct: 20, // LOW (20%)
      deploymentPct: 80, // ATTACK (80% ~ 280 kW)
      opportunityPct: 75 // HIGH (75%)
    };

    this.latestOutcome = null;
  }

  init() {
    this.raceTrack = new SimpleRaceTrack("simple-track-canvas");
    this.bindControls();
    this.updateControlsUI();
    this.syncBatteryBar(this.state.soc, this.state.soc);
  }

  bindControls() {
    const sliderSoc = document.getElementById("slider-soc");
    const sliderConstraint = document.getElementById("slider-constraint");
    const sliderDeploy = document.getElementById("slider-deploy");
    const sliderOpportunity = document.getElementById("slider-opportunity");
    const btnRun = document.getElementById("btn-run-overtake");
    const btnTryOptimal = document.getElementById("btn-try-optimal");

    if (sliderSoc) {
      sliderSoc.addEventListener("input", (e) => {
        this.state.soc = parseInt(e.target.value, 10);
        this.raceTrack.setSoc(this.state.soc);
        this.updateControlsUI();
        this.syncBatteryBar(this.state.soc, this.state.soc);
      });
    }

    if (sliderConstraint) {
      sliderConstraint.addEventListener("input", (e) => {
        this.state.constraintPct = parseInt(e.target.value, 10);
        this.updateControlsUI();
      });
    }

    if (sliderDeploy) {
      sliderDeploy.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        const maxLegal = SimpleTwinEngine.getMaxLegalPower(this.state.constraintPct);
        const maxLegalPct = Math.round((maxLegal / 350) * 100);

        // Clamping if user tries to exceed legal FIA limit (Section 3 requirement)
        if (val > maxLegalPct) {
          this.state.deploymentPct = maxLegalPct;
          sliderDeploy.value = maxLegalPct;
          this.flashClampedNotice();
        } else {
          this.state.deploymentPct = val;
        }
        this.updateControlsUI();
      });
    }

    if (sliderOpportunity) {
      sliderOpportunity.addEventListener("input", (e) => {
        this.state.opportunityPct = parseInt(e.target.value, 10);
        this.updateControlsUI();
      });
    }

    if (btnRun) {
      btnRun.addEventListener("click", () => this.runSimulation());
    }

    if (btnTryOptimal) {
      btnTryOptimal.addEventListener("click", () => this.applyTryOptimal());
    }
  }

  updateControlsUI() {
    // 1. SOC Readout
    const valSoc = document.getElementById("val-soc");
    if (valSoc) valSoc.textContent = `${this.state.soc}%`;

    // 2. FIA Constraint & Status
    const valConstraint = document.getElementById("val-constraint");
    const fiaIndicator = document.getElementById("fia-status-indicator");
    const maxLegalKw = SimpleTwinEngine.getMaxLegalPower(this.state.constraintPct);
    const requestedKw = Math.round((this.state.deploymentPct / 100) * 350);

    const fiaInfo = SimpleTwinEngine.getFiaStatus(requestedKw, this.state.constraintPct, this.state.soc);

    if (valConstraint) {
      valConstraint.textContent = this.state.constraintPct < 35 ? "LOW" :
                                 this.state.constraintPct < 70 ? "MODERATE" : "HIGH";
    }

    if (fiaIndicator) {
      fiaIndicator.textContent = fiaInfo.label;
      fiaIndicator.className = `fia-badge ${fiaInfo.status.toLowerCase()}`;
    }

    // 3. Deployment Readout
    const valDeploy = document.getElementById("val-deploy");
    if (valDeploy) {
      const mode = this.state.deploymentPct < 35 ? "SAVE" :
                   this.state.deploymentPct < 70 ? "BALANCED" : "ATTACK";
      valDeploy.textContent = `${mode} (${requestedKw} kW / ${maxLegalKw} kW MAX)`;
    }

    // 4. Overtake Opportunity Readout
    const valOpp = document.getElementById("val-opportunity");
    if (valOpp) {
      valOpp.textContent = this.state.opportunityPct < 40 ? "LOW" :
                           this.state.opportunityPct < 75 ? "MODERATE" : "HIGH";
    }
  }

  flashClampedNotice() {
    const fiaIndicator = document.getElementById("fia-status-indicator");
    if (fiaIndicator) {
      fiaIndicator.textContent = "⚠ FIA LIMIT REACHED (CLAMPED TO LEGAL MAX)";
      fiaIndicator.className = "fia-badge limited flash";
      setTimeout(() => {
        this.updateControlsUI();
      }, 1400);
    }
  }

  syncBatteryBar(initialSoc, remainingSoc) {
    const fill = document.getElementById("finite-battery-fill");
    const text = document.getElementById("finite-battery-text");

    if (fill) {
      fill.style.width = `${remainingSoc}%`;
      fill.style.background = remainingSoc < 25 ? "#ff3b30" : remainingSoc < 45 ? "#ff9500" : "#00ff88";
    }

    if (text) {
      if (initialSoc !== remainingSoc) {
        text.textContent = `${initialSoc}% → ${remainingSoc}%`;
      } else {
        text.textContent = `${remainingSoc}%`;
      }
    }
  }

  runSimulation() {
    const outcome = SimpleTwinEngine.simulate(this.state);
    this.latestOutcome = outcome;

    const btnRun = document.getElementById("btn-run-overtake");
    if (btnRun) {
      btnRun.disabled = true;
      btnRun.textContent = "ANIMATING OVERTAKE...";
    }

    // Hide previous failure/optimal banners
    const optimalBanner = document.getElementById("try-optimal-banner");
    if (optimalBanner) optimalBanner.style.display = "none";

    // Run animation
    this.raceTrack.runOvertake(outcome, (res) => {
      if (btnRun) {
        btnRun.disabled = false;
        btnRun.textContent = "▶ RUN OVERTAKE";
      }

      this.displayResults(res);
      this.syncBatteryBar(res.initialSoc, res.remainingSoc);
    });
  }

  displayResults(outcome) {
    const resRow = document.getElementById("result-strip");
    const resOvertake = document.getElementById("res-overtake");
    const resEnergyUsed = document.getElementById("res-energy-used");
    const resEnergyRem = document.getElementById("res-energy-remaining");
    const resFia = document.getElementById("res-fia");

    if (resRow) resRow.style.display = "flex";

    if (resOvertake) {
      resOvertake.textContent = outcome.resultText;
      resOvertake.className = `res-val ${outcome.success ? 'text-green' : 'text-red'}`;
    }

    if (resEnergyUsed) {
      resEnergyUsed.textContent = `${outcome.energyUsedMJ.toFixed(1)} MJ USED`;
    }

    if (resEnergyRem) {
      resEnergyRem.textContent = `${outcome.remainingSoc}% REMAINING`;
    }

    if (resFia) {
      resFia.textContent = `FIA: ${outcome.fiaStatus === 'LEGAL' ? '✓ LEGAL' : outcome.fiaStatus === 'LIMITED' ? '⚠ LIMITED' : '✕ BLOCKED'}`;
      resFia.className = `res-val ${outcome.fiaStatus === 'LEGAL' ? 'text-green' : outcome.fiaStatus === 'LIMITED' ? 'text-amber' : 'text-red'}`;
    }

    // Handle "TRY OPTIMAL" feature (Section "MOST IMPORTANT FEATURE")
    const optimalBanner = document.getElementById("try-optimal-banner");
    const failReason = document.getElementById("fail-reason-text");
    const tryRec = document.getElementById("try-rec-text");

    if (!outcome.success && outcome.optimalConfig) {
      if (optimalBanner) optimalBanner.style.display = "flex";
      if (failReason) failReason.textContent = outcome.failureReason;
      if (tryRec) tryRec.textContent = outcome.tryRecommendation;
    } else {
      if (optimalBanner) optimalBanner.style.display = "none";
    }
  }

  applyTryOptimal() {
    if (!this.latestOutcome || !this.latestOutcome.optimalConfig) return;
    const cfg = this.latestOutcome.optimalConfig;

    // Apply optimal parameters to sliders
    this.state.soc = cfg.soc;
    this.state.constraintPct = cfg.constraintPct;
    this.state.deploymentPct = cfg.deploymentPct;
    this.state.opportunityPct = cfg.opportunityPct;

    const sliderSoc = document.getElementById("slider-soc");
    const sliderConstraint = document.getElementById("slider-constraint");
    const sliderDeploy = document.getElementById("slider-deploy");
    const sliderOpp = document.getElementById("slider-opportunity");

    if (sliderSoc) sliderSoc.value = cfg.soc;
    if (sliderConstraint) sliderConstraint.value = cfg.constraintPct;
    if (sliderDeploy) sliderDeploy.value = cfg.deploymentPct;
    if (sliderOpp) sliderOpp.value = cfg.opportunityPct;

    this.updateControlsUI();
    this.raceTrack.setSoc(this.state.soc);
    this.syncBatteryBar(this.state.soc, this.state.soc);

    // Hide optimal banner and run the successful overtake simulation
    const optimalBanner = document.getElementById("try-optimal-banner");
    if (optimalBanner) optimalBanner.style.display = "none";

    this.runSimulation();
  }
}

// Auto-boot on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const app = new SimpleTwinApp();
  app.init();
  window.__simpleTwinApp = app;
});
