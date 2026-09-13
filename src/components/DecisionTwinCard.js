/**
 * TRACKSHIFT — Central Decision Recommendation Card & Opportunity Cost Engine (Sections 10 & 12)
 *
 * Displays:
 * - High-impact Recommended Action (ATTACK, WAIT, SAVE, RECOVER, DEFEND)
 * - Rationale explanation
 * - Probability & Risk telemetry (Overtake %, Future %, Risk, Confidence)
 * - Prominent ENERGY OPPORTUNITY COST statement answering "What do I lose by spending this energy now?"
 */

import { twinStore } from "../state/twinState.js";

export class DecisionTwinCard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="decision-twin-card">
        <div class="decision-card-header">
          <div class="header-tag-group">
            <span class="badge-decision-rec">RECOMMENDED ACTION</span>
            <span class="decision-confidence-badge" id="disp-confidence">87% CONFIDENCE</span>
          </div>
          <span class="text-mono sub-tag">DETERMINISTIC 2026 OPTIMIZER</span>
        </div>

        <div class="decision-action-hero" id="decision-hero-container">
          <div class="decision-action-title" id="disp-rec-action">WAIT</div>
          <div class="decision-action-sub" id="disp-rec-title">PRESERVE FOR NEXT STRATEGIC WINDOW</div>
          <p class="decision-action-rationale" id="disp-rec-rationale">
            Save 1.2 MJ for the next high-value attack window. High future probability (84%) outweighs immediate marginal gain.
          </p>
        </div>

        <div class="decision-kpi-row">
          <div class="kpi-box">
            <span class="kpi-label">OVERTAKE PROB</span>
            <span class="kpi-value text-cyan" id="disp-kpi-overtake">63%</span>
            <div class="kpi-bar-track">
              <div class="kpi-bar-fill cyan" id="disp-bar-overtake" style="width: 63%;"></div>
            </div>
          </div>
          <div class="kpi-box">
            <span class="kpi-label">FUTURE PROB</span>
            <span class="kpi-value text-green" id="disp-kpi-future">84%</span>
            <div class="kpi-bar-track">
              <div class="kpi-bar-fill green" id="disp-bar-future" style="width: 84%;"></div>
            </div>
          </div>
          <div class="kpi-box">
            <span class="kpi-label">ENERGY RISK</span>
            <span class="kpi-value text-amber" id="disp-kpi-risk">LOW</span>
            <span class="kpi-subtext">RESERVE SAFE</span>
          </div>
        </div>

        <!-- Section 12: Energy Opportunity Cost Engine -->
        <div class="opportunity-cost-container">
          <div class="opp-cost-header">
            <span class="opp-cost-badge">⚡ ENERGY OPPORTUNITY COST</span>
            <span class="text-mono sub-tag">STRATEGIC TRADE-OFF</span>
          </div>
          <div class="opp-cost-body" id="disp-opp-cost-statement">
            Using 1.8 MJ now increases immediate overtake probability by 17%, but reduces the probability of successfully defending the next attack window by 21%.
          </div>
          <div class="opp-cost-footer">
            <small>CORE DIGITAL TWIN PRINCIPLE: "DO NOT JUST CALCULATE CAN I PASS; EVALUATE WHAT IS LOST DOWNSTREAM."</small>
          </div>
        </div>
      </div>
    `;
  }

  update(state) {
    const rec = state.recommendation;
    if (!rec) return;

    const actionElem = document.getElementById("disp-rec-action");
    const titleElem = document.getElementById("disp-rec-title");
    const rationaleElem = document.getElementById("disp-rec-rationale");
    const confElem = document.getElementById("disp-confidence");
    const overtakeElem = document.getElementById("disp-kpi-overtake");
    const barOvertake = document.getElementById("disp-bar-overtake");
    const futureElem = document.getElementById("disp-kpi-future");
    const barFuture = document.getElementById("disp-bar-future");
    const riskElem = document.getElementById("disp-kpi-risk");
    const heroElem = document.getElementById("decision-hero-container");
    const oppCostElem = document.getElementById("disp-opp-cost-statement");

    if (actionElem) actionElem.textContent = rec.action;
    if (titleElem) titleElem.textContent = rec.title;
    if (rationaleElem) rationaleElem.textContent = rec.rationale;
    if (confElem) confElem.textContent = `${rec.confidence}% CONFIDENCE`;

    if (overtakeElem) overtakeElem.textContent = `${rec.overtakeProb}%`;
    if (barOvertake) barOvertake.style.width = `${rec.overtakeProb}%`;

    if (futureElem) futureElem.textContent = `${rec.futureProb}%`;
    if (barFuture) barFuture.style.width = `${rec.futureProb}%`;

    if (riskElem) {
      riskElem.textContent = rec.energyRisk;
      riskElem.className = `kpi-value ${rec.energyRisk === 'CRITICAL' ? 'text-red' : rec.energyRisk === 'HIGH' ? 'text-amber' : 'text-green'}`;
    }

    if (heroElem) {
      heroElem.className = `decision-action-hero hero-${rec.action.toLowerCase()}`;
    }

    if (oppCostElem) {
      oppCostElem.textContent = rec.opportunityCostStatement;
    }
  }
}
