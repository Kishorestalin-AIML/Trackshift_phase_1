/**
 * TRACKSHIFT — Left Control Panel: Race State, Constraints & Scenarios (Sections 3, 4, 5)
 *
 * Provides interactive sliders for:
 * - Battery SOC (0–100%) + Available Energy MJ conversion
 * - Gap to Opponent (0.2–3.0 s)
 * - Closing Speed (-5 to +15 km/h)
 * - Electrical Deployment (0–380 kW)
 * - Energy Recovery (0–100%)
 * - Constraint Level (1 to 5: LOW to EXTREME)
 * - 8 Selectable Scenario Cards
 */

import { twinStore } from "../state/twinState.js";
import { SCENARIO_LIST } from "../engine/scenarioLibrary.js";
import { F1DecisionTwinEngine } from "../engine/f1DecisionTwinEngine.js";
import { fiaRuleEngine } from "../engine/fia2026RuleEngine.js";

export class RaceStatePanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.bindEvents();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel-card race-state-panel">
        <div class="panel-section-title">
          <span>RACE STATE</span>
          <small class="text-mono">SIMULATED TELEMETRY</small>
        </div>

        <!-- 1. Battery SOC Control -->
        <div class="input-control-group">
          <div class="control-label-row">
            <label for="slider-soc">BATTERY SOC</label>
            <div class="control-value-badge" id="disp-soc">62% <small id="disp-mj">(2.48 MJ)</small></div>
          </div>
          <input type="range" class="trackshift-slider" id="slider-soc" min="5" max="100" step="1" value="62">
          <div class="slider-scale-row">
            <span>0%</span>
            <span class="text-amber">15% RESERVE</span>
            <span>100%</span>
          </div>
        </div>

        <!-- 2. Gap to Opponent Control -->
        <div class="input-control-group">
          <div class="control-label-row">
            <label for="slider-gap">GAP TO OPPONENT</label>
            <div class="control-value-badge" id="disp-gap">0.80 s</div>
          </div>
          <input type="range" class="trackshift-slider" id="slider-gap" min="0.2" max="3.0" step="0.05" value="0.80">
          <div class="slider-scale-row">
            <span>0.20 s (DRS TOW)</span>
            <span>1.50 s</span>
            <span>3.00 s</span>
          </div>
        </div>

        <!-- 3. Closing Speed Control -->
        <div class="input-control-group">
          <div class="control-label-row">
            <label for="slider-closing">CLOSING SPEED</label>
            <div class="control-value-badge" id="disp-closing">+8.0 km/h</div>
          </div>
          <input type="range" class="trackshift-slider" id="slider-closing" min="-5" max="15" step="0.5" value="8.0">
          <div class="slider-scale-row">
            <span class="text-red">-5 km/h (DROPPING)</span>
            <span>0 km/h</span>
            <span class="text-cyan">+15 km/h (RAPID)</span>
          </div>
        </div>

        <!-- 4. Electrical Deployment Control -->
        <div class="input-control-group">
          <div class="control-label-row">
            <label for="slider-deploy">ELECTRICAL DEPLOYMENT</label>
            <div class="control-value-badge" id="disp-deploy">280 kW</div>
          </div>
          <input type="range" class="trackshift-slider" id="slider-deploy" min="0" max="380" step="10" value="280">
          <div class="slider-scale-row">
            <span>0 kW</span>
            <span class="text-cyan">250 kW CORNER</span>
            <span class="text-amber">350 kW MAX</span>
          </div>
        </div>

        <!-- 5. Recovery Potential Control -->
        <div class="input-control-group">
          <div class="control-label-row">
            <label for="slider-recovery">ENERGY RECOVERY</label>
            <div class="control-value-badge" id="disp-recovery">Recovery potential: 72%</div>
          </div>
          <input type="range" class="trackshift-slider" id="slider-recovery" min="0" max="100" step="1" value="72">
          <div class="slider-scale-row">
            <span>0% (FULL THROTTLE)</span>
            <span>50%</span>
            <span>100% (PEAK BRAKING)</span>
          </div>
        </div>

        <div class="panel-divider"></div>

        <!-- 6. Constraint Severity Slider (Section 4) -->
        <div class="constraint-control-box">
          <div class="control-label-row">
            <label for="slider-constraint">CONSTRAINT LEVEL</label>
            <span class="constraint-badge" id="disp-constraint-level">LEVEL 2 — MODERATE</span>
          </div>
          <input type="range" class="trackshift-slider slider-constraint" id="slider-constraint" min="1" max="5" step="1" value="2">
          <div class="constraint-levels-row">
            <span>L1 LOW</span>
            <span>L2 MOD</span>
            <span>L3 HIGH</span>
            <span>L4 CRIT</span>
            <span>L5 EXT</span>
          </div>
          <div class="constraint-desc-box" id="disp-constraint-desc">
            Standard operational parameters, balanced attack and defense windows.
          </div>
        </div>

        <div class="panel-divider"></div>

        <!-- 7. Scenario Selector Cards (Section 5) -->
        <div class="scenario-section">
          <div class="scenario-section-header">
            <span>RACE SCENARIOS</span>
            <small class="text-mono">SELECTABLE TACTICAL STATES</small>
          </div>
          <div class="scenario-cards-list" id="scenario-cards-list">
            ${SCENARIO_LIST.map(sc => `
              <div class="scenario-card ${sc.id === 'SCENARIO_01' ? 'active' : ''}" data-id="${sc.id}">
                <div class="scenario-card-top">
                  <span class="sc-number">SCENARIO ${sc.number}</span>
                  <span class="sc-badge">${sc.expectedStrategy}</span>
                </div>
                <div class="sc-title">${sc.title}</div>
                <div class="sc-short">${sc.shortDesc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const sliderSoc = document.getElementById("slider-soc");
    const sliderGap = document.getElementById("slider-gap");
    const sliderClosing = document.getElementById("slider-closing");
    const sliderDeploy = document.getElementById("slider-deploy");
    const sliderRecovery = document.getElementById("slider-recovery");
    const sliderConstraint = document.getElementById("slider-constraint");

    if (sliderSoc) {
      sliderSoc.addEventListener("input", (e) => {
        twinStore.setState({ soc: parseInt(e.target.value, 10) });
        this.recalculateAll();
      });
    }

    if (sliderGap) {
      sliderGap.addEventListener("input", (e) => {
        twinStore.setState({ gap: parseFloat(e.target.value) });
        this.recalculateAll();
      });
    }

    if (sliderClosing) {
      sliderClosing.addEventListener("input", (e) => {
        twinStore.setState({ closingSpeed: parseFloat(e.target.value) });
        this.recalculateAll();
      });
    }

    if (sliderDeploy) {
      sliderDeploy.addEventListener("input", (e) => {
        twinStore.setState({ deploymentPower: parseInt(e.target.value, 10) });
        this.recalculateAll();
      });
    }

    if (sliderRecovery) {
      sliderRecovery.addEventListener("input", (e) => {
        twinStore.setState({ recoveryPotential: parseInt(e.target.value, 10) });
        this.recalculateAll();
      });
    }

    if (sliderConstraint) {
      sliderConstraint.addEventListener("input", (e) => {
        twinStore.setState({ constraintLevel: parseInt(e.target.value, 10) });
        this.recalculateAll();
      });
    }

    // Scenario card click binding
    const cards = this.container.querySelectorAll(".scenario-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        this.selectScenario(id);
      });
    });
  }

  selectScenario(scenarioId) {
    const sc = SCENARIO_LIST.find(s => s.id === scenarioId);
    if (!sc) return;

    // Update active card class
    this.container.querySelectorAll(".scenario-card").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-id") === scenarioId);
    });

    // Update state with scenario parameters
    twinStore.setState({
      activeScenarioId: sc.id,
      activeScenarioName: sc.title,
      soc: sc.params.soc,
      gap: sc.params.gap,
      closingSpeed: sc.params.closingSpeed,
      deploymentPower: sc.params.deploymentPower,
      recoveryPotential: sc.params.recoveryPotential,
      constraintLevel: sc.params.constraintLevel,
      lap: sc.params.lap ?? 24,
      totalLaps: sc.params.totalLaps ?? 57
    });

    // Sync sliders
    const sliderSoc = document.getElementById("slider-soc");
    const sliderGap = document.getElementById("slider-gap");
    const sliderClosing = document.getElementById("slider-closing");
    const sliderDeploy = document.getElementById("slider-deploy");
    const sliderRecovery = document.getElementById("slider-recovery");
    const sliderConstraint = document.getElementById("slider-constraint");

    if (sliderSoc) sliderSoc.value = sc.params.soc;
    if (sliderGap) sliderGap.value = sc.params.gap;
    if (sliderClosing) sliderClosing.value = sc.params.closingSpeed;
    if (sliderDeploy) sliderDeploy.value = sc.params.deploymentPower;
    if (sliderRecovery) sliderRecovery.value = sc.params.recoveryPotential;
    if (sliderConstraint) sliderConstraint.value = sc.params.constraintLevel;

    this.recalculateAll();
  }

  recalculateAll() {
    const state = twinStore.getState();

    // 1. Deterministic Rule Check
    const ruleResult = fiaRuleEngine.validateAction(state, "ATTACK", state.deploymentPower, true);

    // 2. Decision Twin Multi-Factor Optimization
    const decisionResult = F1DecisionTwinEngine.evaluateAll(state);

    twinStore.setState({
      ruleStatus: ruleResult.status,
      ruleViolationMessage: ruleResult.reason,
      recommendedLegalPower: ruleResult.recommendedLegalPower,
      recommendation: {
        action: decisionResult.recommendedAction,
        title: decisionResult.recommendedTitle,
        rationale: decisionResult.rationale,
        overtakeProb: decisionResult.overtakeProb,
        futureProb: decisionResult.futureProb,
        energyRisk: decisionResult.energyRisk,
        confidence: decisionResult.confidence,
        opportunityCostStatement: decisionResult.opportunityCostStatement
      },
      selectedStrategy: decisionResult.recommendedAction
    });
  }

  update(state) {
    const dispSoc = document.getElementById("disp-soc");
    const dispGap = document.getElementById("disp-gap");
    const dispClosing = document.getElementById("disp-closing");
    const dispDeploy = document.getElementById("disp-deploy");
    const dispRecovery = document.getElementById("disp-recovery");
    const dispConstraintLevel = document.getElementById("disp-constraint-level");
    const dispConstraintDesc = document.getElementById("disp-constraint-desc");

    if (dispSoc) {
      const cap = state.batteryCapacity ?? 4.00;
      const mj = ((state.soc / 100) * cap).toFixed(2);
      dispSoc.innerHTML = `${state.soc}% <small>(${mj} MJ)</small>`;
    }
    if (dispGap) dispGap.textContent = `${state.gap.toFixed(2)} s`;
    if (dispClosing) {
      const sign = state.closingSpeed >= 0 ? "+" : "";
      dispClosing.textContent = `${sign}${state.closingSpeed.toFixed(1)} km/h`;
      dispClosing.style.color = state.closingSpeed >= 0 ? "#00f0ff" : "#ff3b30";
    }
    if (dispDeploy) dispDeploy.textContent = `${state.deploymentPower} kW`;
    if (dispRecovery) dispRecovery.textContent = `Recovery potential: ${state.recoveryPotential}%`;

    const levelNames = ["", "LEVEL 1 — LOW", "LEVEL 2 — MODERATE", "LEVEL 3 — HIGH", "LEVEL 4 — CRITICAL", "LEVEL 5 — EXTREME"];
    const levelDescs = [
      "",
      "High energy availability, low tactical pressure, large attack margin.",
      "Standard operational parameters, balanced attack and defense windows.",
      "Moderate SOC, limited deployment opportunity, higher future energy requirement.",
      "CRITICAL: Energy must be conserved for the next strategic window. Tight margin.",
      "Low SOC, very limited deployment, high defensive pressure, narrow legal window."
    ];

    if (dispConstraintLevel) dispConstraintLevel.textContent = levelNames[state.constraintLevel] || "LEVEL 2 — MODERATE";
    if (dispConstraintDesc) dispConstraintDesc.textContent = levelDescs[state.constraintLevel] || "";
  }
}
