/**
 * TRACKSHIFT — Constraint Impact Matrix (Section 14)
 *
 * Demonstrates how regulatory and operational constraint levels
 * shift the expected tactical delta gain across the race:
 * LOW (+0.42s) -> MODERATE (+0.31s) -> HIGH (+0.18s) -> CRITICAL (-0.06s) -> EXTREME (-0.22s)
 */

import { twinStore } from "../state/twinState.js";
import { F1DecisionTwinEngine } from "../engine/f1DecisionTwinEngine.js";

export class ConstraintImpactView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel-card constraint-impact-panel">
        <div class="panel-section-title">
          <span>CONSTRAINT SEVERITY IMPACT</span>
          <small class="text-mono">EXPECTED TACTICAL DELTA</small>
        </div>

        <div class="constraint-impact-table" id="constraint-impact-table">
          <!-- Populated by update() -->
        </div>
      </div>
    `;
    this.update(twinStore.getState());
  }

  update(state) {
    const table = document.getElementById("constraint-impact-table");
    if (!table) return;

    const evaluation = F1DecisionTwinEngine.evaluateAll(state);
    const activeLvl = state.constraintLevel ?? 2;

    table.innerHTML = evaluation.constraintImpacts.map(ci => {
      const isActive = ci.level === activeLvl;
      const isPositive = ci.expectedGain.startsWith("+");

      return `
        <div class="impact-row ${isActive ? 'active-level' : ''}" data-level="${ci.level}">
          <div class="impact-col-lvl">
            <span class="lvl-badge ${isActive ? 'active' : ''}">L${ci.level}</span>
            <span class="lvl-name">${ci.name}</span>
          </div>
          <div class="impact-col-gain ${isPositive ? 'text-green' : 'text-red'}">
            ${ci.expectedGain}
          </div>
          <div class="impact-col-note">
            ${ci.note}
          </div>
        </div>
      `;
    }).join('');
  }
}
