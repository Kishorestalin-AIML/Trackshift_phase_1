/**
 * RACE TWIN — Interactive What-If Simulator (Section 27)
 *
 * 3 Simulation Buttons:
 *   - SIMULATE ATTACK
 *   - SIMULATE CONTROLLED
 *   - SIMULATE SAVE
 *
 * Projection Display:
 *   - ACTION
 *   - POSITION
 *   - ENERGY
 *   - OVERTAKE PROBABILITY
 *   - RISK
 *   - FUTURE OPPORTUNITY
 *
 * Commitment:
 *   - APPLY DECISION (Only button that mutates live state!)
 */

export class WhatIfPanel {
  constructor(containerEl, onSimulate, onApply) {
    this.container = containerEl;
    this.onSimulate = onSimulate;
    this.onApply = onApply;
    this.init();
  }

  init() {
    if (!this.container.querySelector("#btn-whatif-attack")) {
      this.container.innerHTML = `
      <div class="bottom-panel-card whatif-panel">
        <div class="bottom-card-header">
          <span class="card-title">WHAT-IF SIMULATION</span>
          <span class="card-sub-tag">PRE-COMMITMENT ANALYSIS</span>
        </div>

        <div class="whatif-body">
          <!-- 3 Mode Simulation Selectors -->
          <div class="whatif-btn-row">
            <button class="btn-whatif" id="btn-whatif-attack" data-mode="ATTACK">SIMULATE ATTACK</button>
            <button class="btn-whatif active-whatif" id="btn-whatif-ctrl" data-mode="CONTROLLED">SIMULATE CONTROLLED</button>
            <button class="btn-whatif" id="btn-whatif-save" data-mode="SAVE">SIMULATE SAVE</button>
          </div>

          <!-- Projection Results Readout Grid (Section 27) -->
          <div class="whatif-preview-box">
            <div class="wi-cell">
              <span class="wi-label">POSITION</span>
              <strong class="wi-val text-yellow" id="wi-pos">P4 (DELTA -0.22s)</strong>
            </div>
            <div class="wi-cell">
              <span class="wi-label">ENERGY</span>
              <strong class="wi-val text-cyan" id="wi-energy">63% → 56%</strong>
            </div>
            <div class="wi-cell">
              <span class="wi-label">OVERTAKE PROB</span>
              <strong class="wi-val text-green" id="wi-prob">78%</strong>
            </div>
            <div class="wi-cell">
              <span class="wi-label">TACTICAL RISK</span>
              <strong class="wi-val" id="wi-risk">22%</strong>
            </div>
            <div class="wi-cell">
              <span class="wi-label">FUTURE OPPORTUNITY</span>
              <strong class="wi-val text-green" id="wi-future">81%</strong>
            </div>
          </div>

          <!-- Commit Button (Section 27: Only this changes real race state) -->
          <button class="btn-apply-decision" id="btn-apply-decision">
            APPLY DECISION
          </button>
        </div>
      </div>
    `;
    }

    this.bindEvents();
  }

  bindEvents() {
    const buttons = this.container.querySelectorAll(".btn-whatif");
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active-whatif"));
        btn.classList.add("active-whatif");
        const mode = btn.getAttribute("data-mode");
        if (this.onSimulate) this.onSimulate(mode);
      });
    });

    const applyBtn = this.container.querySelector("#btn-apply-decision");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        if (this.onApply) this.onApply();
      });
    }
  }

  render(state) {
    if (!state || !state.whatIf || !state.whatIf.projected) return;

    const p = state.whatIf.projected;
    const posEl = this.container.querySelector("#wi-pos");
    const enEl = this.container.querySelector("#wi-energy");
    const probEl = this.container.querySelector("#wi-prob");
    const riskEl = this.container.querySelector("#wi-risk");
    const futureEl = this.container.querySelector("#wi-future");

    if (posEl) posEl.textContent = p.position || "P4";
    if (enEl) enEl.textContent = p.energy || "63%";
    if (probEl) probEl.textContent = p.overtakeProbability || "78%";
    if (riskEl) riskEl.textContent = p.risk || "22%";
    if (futureEl) futureEl.textContent = p.futureOpportunity || "81%";
  }
}
