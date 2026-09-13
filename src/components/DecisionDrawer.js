/**
 * TRACKSHIFT — Decision Details Drawer (Section 20)
 *
 * Slides open from the right when the user clicks 'VIEW DECISION'.
 * Displays:
 *   - Current State breakdown (ERS MJ, Gap, Overtake %, Counter %, Zone)
 *   - Feasible Actions Table with ✓ and ✕ indicators
 *   - Why the selected action (286 kW) was chosen
 *   - Detailed constraint explanation of why 350 kW was rejected
 *   - Constraint Overcome / Recovery narrative
 */

export class DecisionDrawer {
  constructor(containerEl, onClose, onSelectCandidate) {
    this.container = containerEl;
    this.onClose = onClose;
    this.onSelectCandidate = onSelectCandidate;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="decision-drawer-backdrop hidden" id="drawer-backdrop"></div>
      <aside class="decision-drawer-panel drawer-closed" id="drawer-panel">
        <div class="drawer-header">
          <div class="drawer-title-wrap">
            <span class="drawer-badge">DECISION TWIN INTELLIGENCE</span>
            <h2 class="drawer-title">OPTIMIZATION & CONSTRAINTS</h2>
          </div>
          <button class="drawer-close-btn" id="drawer-close" title="Close Drawer">&times;</button>
        </div>

        <div class="drawer-body">
          <!-- 1. CURRENT STATE SUMMARY (Section 20) -->
          <section class="drawer-section">
            <h3 class="section-title">CURRENT RACE STATE</h3>
            <div class="drawer-state-grid">
              <div class="state-cell">
                <span class="cell-label">ERS USABLE</span>
                <strong class="cell-val text-cyan" id="dw-ers">2.84 MJ</strong>
              </div>
              <div class="state-cell">
                <span class="cell-label">GAP AHEAD</span>
                <strong class="cell-val text-yellow" id="dw-gap">0.72 s</strong>
              </div>
              <div class="state-cell">
                <span class="cell-label">OVERTAKE PROB</span>
                <strong class="cell-val text-green" id="dw-overtake">84%</strong>
              </div>
              <div class="state-cell">
                <span class="cell-label">COUNTER RISK</span>
                <strong class="cell-val text-yellow" id="dw-counter">19%</strong>
              </div>
              <div class="state-cell cell-span-2">
                <span class="cell-label">CURRENT ZONE</span>
                <strong class="cell-val text-white" id="dw-zone">HANGAR STRAIGHT (S3)</strong>
              </div>
            </div>
          </section>

          <!-- 2. FEASIBLE ACTIONS TABLE (Sections 9, 10, 14, 20) -->
          <section class="drawer-section">
            <h3 class="section-title">FEASIBLE CANDIDATE ACTIONS</h3>
            <div class="candidates-table-wrap">
              <table class="candidates-table">
                <thead>
                  <tr>
                    <th>ACTION</th>
                    <th>OVERTAKE</th>
                    <th>COUNTER</th>
                    <th>ENERGY</th>
                    <th>SCORE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody id="candidates-tbody">
                  <!-- Injected via render() -->
                </tbody>
              </table>
            </div>
          </section>

          <!-- 3. WHY 286 kW? (Section 20) -->
          <section class="drawer-section">
            <h3 class="section-title" id="dw-why-title">WHY 286 kW?</h3>
            <div class="why-bullet-card">
              <div class="why-bullet">
                <span class="bullet-icon text-green">✓</span>
                <span class="bullet-text"><strong>High Overtake Probability (84%):</strong> Maximizes closing acceleration on Hangar Straight slipstream.</span>
              </div>
              <div class="why-bullet">
                <span class="bullet-icon text-cyan">✓</span>
                <span class="bullet-text"><strong>Acceptable Counter Risk (19%):</strong> Preserves enough battery buffer to defend against opponent DRS into Stowe.</span>
              </div>
              <div class="why-bullet">
                <span class="bullet-icon text-green">✓</span>
                <span class="bullet-text"><strong>Future Opportunity Protected:</strong> Retains 2.32 MJ, leaving ample energy for the 91% window at Stowe.</span>
              </div>
            </div>
          </section>

          <!-- 4. CONSTRAINT EXPLANATION (Section 12) -->
          <section class="drawer-section">
            <h3 class="section-title">ACTIVE CONSTRAINTS</h3>
            <div class="constraint-alert-box" id="dw-constraint-box">
              <div class="constraint-title text-red">350 kW REJECTED // ENERGY RESERVE</div>
              <div class="constraint-desc" id="dw-constraint-desc">
                Deploying 350 kW would consume 0.53 MJ, pulling energy below the required 1.20 MJ floor and jeopardizing the subsequent Stowe attack.
              </div>
            </div>
          </section>

          <!-- 5. CONSTRAINT OVERCOME / RECOVERY (Section 13) -->
          <section class="drawer-section">
            <h3 class="section-title">CONSTRAINT RECOVERY</h3>
            <div class="recovery-box">
              <div class="recovery-badge">CONSTRAINT AVOIDED</div>
              <div class="recovery-text" id="dw-recovery-text">
                Reduced deployment from 350 kW → 286 kW.<br>
                Energy reserve protected • Future opportunity preserved.
              </div>
            </div>
          </section>
        </div>
      </aside>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector("#drawer-close");
    const backdrop = this.container.querySelector("#drawer-backdrop");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }
    if (backdrop) {
      backdrop.addEventListener("click", () => this.close());
    }
  }

  open() {
    const backdrop = this.container.querySelector("#drawer-backdrop");
    const panel = this.container.querySelector("#drawer-panel");
    if (backdrop) backdrop.classList.remove("hidden");
    if (panel) panel.classList.remove("drawer-closed");
  }

  close() {
    const backdrop = this.container.querySelector("#drawer-backdrop");
    const panel = this.container.querySelector("#drawer-panel");
    if (backdrop) backdrop.classList.add("hidden");
    if (panel) panel.classList.add("drawer-closed");
    if (this.onClose) this.onClose();
  }

  render(state) {
    if (!state) return;

    const ers = this.container.querySelector("#dw-ers");
    const gap = this.container.querySelector("#dw-gap");
    const ot = this.container.querySelector("#dw-overtake");
    const count = this.container.querySelector("#dw-counter");
    const zone = this.container.querySelector("#dw-zone");

    if (ers) ers.textContent = `${(state.currentEnergy ?? 2.84).toFixed(2)} MJ`;
    if (gap) gap.textContent = `${(state.gapAhead ?? 0.72).toFixed(2)} s`;
    if (ot) ot.textContent = `${Math.round((state.overtakeProbability ?? 0.84) * 100)}%`;
    if (count) count.textContent = `${Math.round((state.counterRisk ?? 0.19) * 100)}%`;
    if (zone) zone.textContent = `${(state.currentSegmentName || "HANGAR STRAIGHT").toUpperCase()} (S${state.currentSector || 3})`;

    // Render Candidates Table (Section 14 & 20)
    const tbody = this.container.querySelector("#candidates-tbody");
    if (tbody && state.candidateActions) {
      tbody.innerHTML = state.candidateActions.map(cand => {
        const isSelected = cand.selected;
        const statusBadge = cand.feasible
          ? isSelected
            ? `<span class="badge-status badge-selected">✓ SELECTED</span>`
            : `<span class="badge-status badge-feasible">✓ FEASIBLE</span>`
          : `<span class="badge-status badge-infeasible">✕ CONSTRAINT</span>`;

        return `
          <tr class="${isSelected ? 'tr-selected' : !cand.feasible ? 'tr-infeasible' : ''}" data-action-id="${cand.id}">
            <td class="td-action"><strong>${cand.label}</strong></td>
            <td class="text-green">${cand.overtakeProb}%</td>
            <td class="text-yellow">${cand.counterRisk}%</td>
            <td class="text-muted font-mono">${cand.energyCost}</td>
            <td class="font-mono text-cyan">${cand.score.toFixed(2)}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join("");

      // Bind row clicks to select action
      tbody.querySelectorAll("tr").forEach(tr => {
        tr.addEventListener("click", () => {
          const actionId = tr.getAttribute("data-action-id");
          if (this.onSelectCandidate && actionId) {
            this.onSelectCandidate(actionId);
          }
        });
      });
    }

    // Constraint narrative updates
    const whyTitle = this.container.querySelector("#dw-why-title");
    const selectedAction = (state.candidateActions || []).find(c => c.selected);
    if (whyTitle && selectedAction) {
      whyTitle.textContent = `WHY ${selectedAction.label.split(" ")[0]} kW?`;
    }

    const recText = this.container.querySelector("#dw-recovery-text");
    if (recText && state.decision?.constraintAvoided) {
      recText.textContent = state.decision.constraintAvoided;
    }
  }
}
