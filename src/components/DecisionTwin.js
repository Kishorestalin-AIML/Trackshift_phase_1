/**
 * RACE TWIN — Decision Engine Component (Sections 18, 19, 20)
 *
 * Right side top:
 *   3 Large Options:
 *     - ATTACK (Score)
 *     - CONTROLLED (Score)
 *     - SAVE (Score)
 *   RECOMMENDATION (Highest score highlighted)
 *   WHY? Panel (Dynamic multi-factor rationale)
 */

export class DecisionTwin {
  constructor(containerEl, onActionSelect) {
    this.container = containerEl;
    this.onActionSelect = onActionSelect;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="panel-box decision-twin-panel">
        <div class="panel-header">
          <span class="panel-title">DECISION TWIN</span>
          <span class="panel-badge highlight-green" id="dt-mode-badge">OPTIMIZING</span>
        </div>

        <!-- 3 Large Strategy Cards (Section 18) -->
        <div class="strategy-cards-grid">
          <!-- ATTACK -->
          <div class="strategy-card" id="card-attack" data-action="ATTACK">
            <div class="strat-top">
              <span class="strat-name">ATTACK</span>
              <span class="strat-delta">-11% ERS</span>
            </div>
            <div class="strat-score" id="score-attack">72</div>
            <div class="strat-sub">MAX DEPLOYMENT</div>
          </div>

          <!-- CONTROLLED (RECOMMENDED) -->
          <div class="strategy-card active-recommendation" id="card-controlled" data-action="CONTROLLED">
            <div class="strat-top">
              <span class="strat-name">CONTROLLED</span>
              <span class="strat-delta">-7% ERS</span>
            </div>
            <div class="strat-score" id="score-controlled">86</div>
            <div class="strat-sub">OPTIMAL DELTA</div>
          </div>

          <!-- SAVE -->
          <div class="strategy-card" id="card-save" data-action="SAVE">
            <div class="strat-top">
              <span class="strat-name">SAVE</span>
              <span class="strat-delta">+4% REGEN</span>
            </div>
            <div class="strat-score" id="score-save">61</div>
            <div class="strat-sub">MGU-K HARVEST</div>
          </div>
        </div>

        <!-- Highlighted Recommendation Banner -->
        <div class="recommendation-banner" id="recommendation-banner">
          <div class="rec-left">
            <span class="rec-label">RECOMMENDATION</span>
            <strong class="rec-title" id="rec-action-title">CONTROLLED ATTACK</strong>
          </div>
          <div class="rec-right">
            <span class="rec-conf-tag" id="rec-confidence">86% CONFIDENCE</span>
          </div>
        </div>

        <!-- WHY? Dynamic Rationale Panel (Section 19) -->
        <div class="why-rationale-box">
          <div class="why-header">
            <span class="why-title">WHY?</span>
            <span class="why-subtitle">REAL-TIME CONSTRAINT EVALUATION</span>
          </div>
          <pre class="why-text-content" id="why-text">Gap: 0.62 s
Energy: sufficient
Attack zone: high value
Tyres: acceptable
Risk: moderate
Future opportunity: high

CONTROLLED ATTACK has the highest expected race value.</pre>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const cards = this.container.querySelectorAll(".strategy-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const action = card.getAttribute("data-action");
        if (this.onActionSelect) {
          this.onActionSelect(action);
        }
      });
    });
  }

  render(state) {
    if (!state || !state.decision) return;

    const d = state.decision;
    const scoreAttack = this.container.querySelector("#score-attack");
    const scoreControlled = this.container.querySelector("#score-controlled");
    const scoreSave = this.container.querySelector("#score-save");
    const recTitle = this.container.querySelector("#rec-action-title");
    const recConf = this.container.querySelector("#rec-confidence");
    const whyText = this.container.querySelector("#why-text");

    if (scoreAttack) scoreAttack.textContent = d.attackScore;
    if (scoreControlled) scoreControlled.textContent = d.controlledScore;
    if (scoreSave) scoreSave.textContent = d.saveScore;

    // Highlight highest score
    const cardAttack = this.container.querySelector("#card-attack");
    const cardCtrl = this.container.querySelector("#card-controlled");
    const cardSave = this.container.querySelector("#card-save");

    [cardAttack, cardCtrl, cardSave].forEach(c => c && c.classList.remove("active-recommendation", "invalid-action"));

    if (d.recommended === "ATTACK" && cardAttack) {
      cardAttack.classList.add("active-recommendation");
      if (recTitle) recTitle.textContent = "ATTACK NOW";
    } else if (d.recommended === "SAVE" && cardSave) {
      cardSave.classList.add("active-recommendation");
      if (recTitle) recTitle.textContent = "SAVE ENERGY";
    } else if (cardCtrl) {
      cardCtrl.classList.add("active-recommendation");
      if (recTitle) recTitle.textContent = "CONTROLLED ATTACK";
    }

    if (recConf) recConf.textContent = `${d.confidence}% CONFIDENCE`;
    if (whyText) whyText.textContent = d.explanation || "Evaluating race value...";
  }
}
