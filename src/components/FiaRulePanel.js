/**
 * TRACKSHIFT — 2026 FIA Constraint Engine Card & Rule Validator (Sections 8 & 9)
 *
 * Displays:
 * - Configurable Rule Profile parameters (350 kW, 250 kW, +150 kW, 4.0 MJ quota, 15% floor)
 * - Energy State metrics (Current, Minimum, Maximum, Energy Swing)
 * - Live Rule Validation status (LEGAL, WARNING, VIOLATION)
 * - Immediate violation explanation & 1-click "APPLY LEGAL LIMIT" button
 */

import { twinStore } from "../state/twinState.js";
import { fiaRuleEngine } from "../engine/fia2026RuleEngine.js";

export class FiaRulePanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.bindEvents();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    const profile = fiaRuleEngine.getProfile();

    this.container.innerHTML = `
      <div class="panel-card fia-rule-panel">
        <div class="panel-section-title">
          <span>2026 FIA CONSTRAINT ENGINE</span>
          <span class="badge-rule-status legal" id="badge-rule-status">LEGAL</span>
        </div>

        <div class="rule-profile-header">
          <span class="rule-prof-name text-mono">${profile.profileName}</span>
          <span class="rule-ver text-mono">v${profile.version}</span>
        </div>

        <!-- Regulatory Deployment Caps -->
        <div class="rule-limits-grid">
          <div class="rule-limit-box">
            <span class="limit-label">KEY ACCELERATION ZONE</span>
            <span class="limit-value text-amber">${profile.accelerationZoneLimitKw} kW MAX</span>
            <small class="limit-sub">Full straightaway discharge</small>
          </div>
          <div class="rule-limit-box">
            <span class="limit-label">OTHER PERMITTED SECTORS</span>
            <span class="limit-value text-cyan">${profile.standardZoneLimitKw} kW MAX</span>
            <small class="limit-sub">Technical corner zones</small>
          </div>
          <div class="rule-limit-box">
            <span class="limit-label">RACE BOOST OVERRIDE</span>
            <span class="limit-value text-green">+${profile.raceBoostCapKw} kW</span>
            <small class="limit-sub">Manual overtake push</small>
          </div>
          <div class="rule-limit-box">
            <span class="limit-label">LAP DISCHARGE QUOTA</span>
            <span class="limit-value">${profile.maxLapDeploymentMJ.toFixed(2)} MJ</span>
            <small class="limit-sub">Per lap regulatory ceiling</small>
          </div>
        </div>

        <!-- Energy State Metrics (Section 8) -->
        <div class="energy-state-box">
          <div class="energy-state-title">ENERGY STATE BOUNDARIES</div>
          <div class="energy-state-row">
            <span>CURRENT ENERGY</span>
            <strong id="disp-es-current">2.48 MJ</strong>
          </div>
          <div class="energy-state-row">
            <span>MINIMUM RESERVE (15% FLOOR)</span>
            <strong class="text-amber" id="disp-es-min">0.60 MJ</strong>
          </div>
          <div class="energy-state-row">
            <span>MAXIMUM CAPACITY</span>
            <strong id="disp-es-max">4.00 MJ</strong>
          </div>
          <div class="energy-state-row">
            <span>USABLE ENERGY SWING</span>
            <strong class="text-cyan" id="disp-es-swing">3.40 MJ</strong>
          </div>
        </div>

        <!-- Rule Validation Alert & Auto-Recovery (Section 9) -->
        <div class="rule-alert-container" id="rule-alert-container" style="display: none;">
          <div class="rule-alert-header">
            <span class="alert-icon">⚠️</span>
            <span class="alert-title" id="rule-alert-title">REGULATORY VIOLATION</span>
          </div>
          <p class="rule-alert-msg" id="rule-alert-msg">
            Requested deployment (380 kW) exceeds configured 350 kW acceleration-zone limit under 2026 FIA Technical Regulations.
          </p>
          <div class="rule-alert-actions">
            <span class="rec-legal-text" id="rec-legal-text">Recommended legal deployment: 350 kW</span>
            <button class="btn-apply-legal" id="btn-apply-legal-power">
              APPLY LEGAL LIMIT (350 kW)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const fixBtn = document.getElementById("btn-apply-legal-power");
    if (fixBtn) {
      fixBtn.addEventListener("click", () => {
        const state = twinStore.getState();
        const target = state.recommendedLegalPower || 350;
        twinStore.setState({ deploymentPower: target });

        // Update slider
        const sliderDeploy = document.getElementById("slider-deploy");
        if (sliderDeploy) sliderDeploy.value = target;

        // Re-validate
        const ruleResult = fiaRuleEngine.validateAction(twinStore.getState(), "ATTACK", target, true);
        twinStore.setState({
          ruleStatus: ruleResult.status,
          ruleViolationMessage: ruleResult.reason
        });
      });
    }
  }

  update(state) {
    const statusBadge = document.getElementById("badge-rule-status");
    const alertBox = document.getElementById("rule-alert-container");
    const alertTitle = document.getElementById("rule-alert-title");
    const alertMsg = document.getElementById("rule-alert-msg");
    const recText = document.getElementById("rec-legal-text");
    const fixBtn = document.getElementById("btn-apply-legal-power");

    // Energy state readouts
    const es = fiaRuleEngine.getEnergyStateMetrics(state.soc, state.batteryCapacity);
    const esCurrent = document.getElementById("disp-es-current");
    const esMin = document.getElementById("disp-es-min");
    const esMax = document.getElementById("disp-es-max");
    const esSwing = document.getElementById("disp-es-swing");

    if (esCurrent) esCurrent.textContent = `${es.currentEnergyMJ.toFixed(2)} MJ`;
    if (esMin) esMin.textContent = `${es.minEnergyMJ.toFixed(2)} MJ`;
    if (esMax) esMax.textContent = `${es.maxEnergyMJ.toFixed(2)} MJ`;
    if (esSwing) esSwing.textContent = `${es.energySwingMJ.toFixed(2)} MJ`;

    // Rule Status Display
    if (statusBadge) {
      statusBadge.textContent = state.ruleStatus;
      statusBadge.className = `badge-rule-status ${state.ruleStatus.toLowerCase()}`;
    }

    if (alertBox) {
      if (state.ruleStatus === "VIOLATION" || state.ruleStatus === "WARNING") {
        alertBox.style.display = "block";
        alertBox.className = `rule-alert-container ${state.ruleStatus.toLowerCase()}`;
        if (alertTitle) alertTitle.textContent = state.ruleStatus === "VIOLATION" ? "REGULATORY VIOLATION" : "REGULATORY ADVISORY";
        if (alertMsg) alertMsg.textContent = state.ruleViolationMessage || "Power limits exceeded.";
        if (recText) recText.textContent = `Recommended legal deployment: ${state.recommendedLegalPower} kW`;
        if (fixBtn) {
          fixBtn.textContent = `APPLY LEGAL LIMIT (${state.recommendedLegalPower} kW)`;
          fixBtn.style.display = state.deploymentPower !== state.recommendedLegalPower ? "inline-block" : "none";
        }
      } else {
        alertBox.style.display = "none";
      }
    }
  }
}
