/**
 * TRACKSHIFT — Counterfactual Strategy Comparison Grid ("WHAT IF?") (Section 11)
 *
 * Compares the 5 fundamental strategies side-by-side:
 * - ATTACK NOW
 * - WAIT / DELAY
 * - SAVE ENERGY
 * - RECOVER
 * - DEFEND
 *
 * Highlights the optimal strategy and allows clicking any card to test/simulate that alternative.
 */

import { twinStore } from "../state/twinState.js";
import { F1DecisionTwinEngine } from "../engine/f1DecisionTwinEngine.js";

export class CounterfactualGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    this.bindEvents();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel-card counterfactual-panel">
        <div class="panel-section-title">
          <span>WHAT IF? — STRATEGY COMPARISON</span>
          <small class="text-mono">COUNTERFACTUAL OUTCOME SIMULATION</small>
        </div>
        <div class="strategy-cards-grid" id="strategy-cards-grid">
          <!-- Populated dynamically by update() -->
        </div>
      </div>
    `;
    this.update(twinStore.getState());
  }

  bindEvents() {
    this.container.addEventListener("click", (e) => {
      const card = e.target.closest(".strategy-card");
      if (card) {
        const strategyId = card.getAttribute("data-id");
        if (strategyId) {
          twinStore.setState({ selectedStrategy: strategyId });
        }
      }
    });
  }

  update(state) {
    const grid = document.getElementById("strategy-cards-grid");
    if (!grid) return;

    const evaluation = F1DecisionTwinEngine.evaluateAll(state);
    const bestId = evaluation.recommendedAction;
    const currentSelected = state.selectedStrategy || bestId;

    grid.innerHTML = evaluation.strategies.map(strat => {
      const isBest = strat.id === bestId;
      const isSelected = strat.id === currentSelected;
      const isViolation = strat.ruleStatus === "VIOLATION";

      return `
        <div class="strategy-card ${isBest ? 'best-strategy' : ''} ${isSelected ? 'selected' : ''} ${isViolation ? 'violation' : ''}" data-id="${strat.id}">
          <div class="strat-card-header">
            <span class="strat-name">${strat.title}</span>
            ${isBest ? '<span class="strat-badge-opt">★ OPTIMAL</span>' : ''}
            ${isViolation ? '<span class="strat-badge-viol">✕ VIOLATION</span>' : ''}
          </div>

          <div class="strat-result-row">
            <span class="strat-pos-label">RESULT</span>
            <span class="strat-pos-val ${strat.expectedPosition === 'P1' ? 'text-green' : 'text-cyan'}">${strat.expectedPosition}</span>
          </div>

          <div class="strat-metrics-list">
            <div class="strat-metric-item">
              <span>Overtake:</span>
              <strong class="${strat.overtakeProb >= 70 ? 'text-green' : strat.overtakeProb >= 40 ? 'text-cyan' : 'text-muted'}">${strat.overtakeProb}%</strong>
            </div>
            <div class="strat-metric-item">
              <span>Energy Cost:</span>
              <strong>${strat.energyCostMJ.toFixed(1)} MJ</strong>
            </div>
            <div class="strat-metric-item">
              <span>Remaining:</span>
              <strong>${strat.energyRemainingMJ.toFixed(1)} MJ</strong>
            </div>
            <div class="strat-metric-item">
              <span>Future Attack:</span>
              <strong class="${strat.futureAttackProb >= 80 ? 'text-green' : 'text-amber'}">${strat.futureAttackProb}%</strong>
            </div>
            <div class="strat-metric-item">
              <span>Risk:</span>
              <span class="risk-tag ${strat.risk.toLowerCase()}">${strat.risk}</span>
            </div>
            <div class="strat-metric-item">
              <span>Rule Status:</span>
              <span class="rule-tag ${strat.ruleStatus.toLowerCase()}">${strat.ruleStatus}</span>
            </div>
          </div>

          <div class="strat-score-bar">
            <span>SCORE: ${strat.score}</span>
            <button class="btn-select-strat" title="Simulate this strategy">
              ${isSelected ? 'ACTIVE' : 'TEST →'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}
