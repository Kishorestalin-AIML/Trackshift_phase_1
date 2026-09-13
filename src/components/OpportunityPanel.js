/**
 * RACE TWIN — Next Opportunities & Energy Look-Ahead Component (Sections 25, 26)
 *
 * Implements:
 *   - Next 3 tactical opportunities (NOW, +1 LAP, +2 LAPS)
 *   - Mini look-ahead graph (Energy vs Future Opportunity)
 *   - Current Energy (63%), After Attack (52%), After Save (59%)
 */

import { EnergyEngine } from "../engine/energyEngine.js";

export class OpportunityPanel {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="bottom-panel-card opportunity-panel">
        <div class="bottom-card-header">
          <span class="card-title">NEXT OPPORTUNITIES & ENERGY LOOK-AHEAD</span>
          <span class="card-sub-tag">FUTURE OPTIMIZATION</span>
        </div>

        <div class="opp-content-split">
          <!-- 3 Next Tactical Windows (Section 25) -->
          <div class="opp-list">
            <div class="opp-row opp-active">
              <div class="opp-timing">NOW</div>
              <div class="opp-details">
                <span class="opp-zone">HANGAR STRAIGHT (S3)</span>
                <span class="opp-cost">-11% ENERGY</span>
              </div>
              <div class="opp-badge-group">
                <span class="opp-pill opp-high">HIGH</span>
                <strong class="opp-pct text-green">78%</strong>
              </div>
            </div>

            <div class="opp-row">
              <div class="opp-timing">+1 LAP</div>
              <div class="opp-details">
                <span class="opp-zone">BROOKLANDS (S2)</span>
                <span class="opp-cost">-8% ENERGY</span>
              </div>
              <div class="opp-badge-group">
                <span class="opp-pill opp-med">MEDIUM</span>
                <strong class="opp-pct text-cyan">51%</strong>
              </div>
            </div>

            <div class="opp-row">
              <div class="opp-timing">+2 LAPS</div>
              <div class="opp-details">
                <span class="opp-zone">HANGAR STRAIGHT (S3)</span>
                <span class="opp-cost">-10% ENERGY</span>
              </div>
              <div class="opp-badge-group">
                <span class="opp-pill opp-high">HIGH</span>
                <strong class="opp-pct text-green">83%</strong>
              </div>
            </div>
          </div>

          <!-- Energy Look-Ahead Mini SVG Graph (Section 26) -->
          <div class="energy-lookahead-box">
            <div class="lookahead-readouts">
              <div class="la-stat">
                <span class="la-label">CURRENT</span>
                <strong class="la-val text-cyan" id="la-curr-en">63%</strong>
              </div>
              <div class="la-stat">
                <span class="la-label">AFTER ATTACK</span>
                <strong class="la-val text-red" id="la-attack-en">52%</strong>
              </div>
              <div class="la-stat">
                <span class="la-label">AFTER SAVE</span>
                <strong class="la-val text-green" id="la-save-en">59%</strong>
              </div>
            </div>

            <!-- Mini SVG Graph of Energy Trajectory -->
            <div class="la-graph-wrapper">
              <svg viewBox="0 0 240 68" class="la-svg-chart" preserveAspectRatio="none">
                <!-- Grid Lines -->
                <line x1="20" y1="12" x2="230" y2="12" stroke="#142445" stroke-width="1" stroke-dasharray="2,2" />
                <line x1="20" y1="36" x2="230" y2="36" stroke="#142445" stroke-width="1" stroke-dasharray="2,2" />
                <line x1="20" y1="58" x2="230" y2="58" stroke="#142445" stroke-width="1" />

                <!-- Energy Trajectory Curves -->
                <!-- Save Trajectory (Green ascending/preserving) -->
                <path id="la-save-curve" d="M 30,24 Q 90,20 150,16 T 220,12" fill="none" stroke="#00e676" stroke-width="2" stroke-dasharray="3,3" />
                
                <!-- Attack Trajectory (Red steep descending) -->
                <path id="la-attack-curve" d="M 30,24 Q 90,40 150,50 T 220,60" fill="none" stroke="#e10600" stroke-width="2" stroke-dasharray="3,3" />

                <!-- Current / Base Trajectory (Cyan) -->
                <path id="la-base-curve" d="M 30,24 L 90,28 L 150,32 L 220,35" fill="none" stroke="#00f0ff" stroke-width="2.5" />

                <!-- Key Nodes -->
                <circle cx="30" cy="24" r="3.5" fill="#00f0ff" />
                <circle cx="90" cy="28" r="3" fill="#00f0ff" />
                <circle cx="150" cy="32" r="3" fill="#00f0ff" />
                <circle cx="220" cy="35" r="3" fill="#00f0ff" />

                <!-- Axis Labels -->
                <text x="30" y="66" text-anchor="middle" fill="#718096" font-size="8">NOW</text>
                <text x="90" y="66" text-anchor="middle" fill="#718096" font-size="8">+1</text>
                <text x="150" y="66" text-anchor="middle" fill="#718096" font-size="8">+2</text>
                <text x="220" y="66" text-anchor="middle" fill="#718096" font-size="8">+3</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render(state) {
    if (!state) return;

    const currEnEl = this.container.querySelector("#la-curr-en");
    const attackEnEl = this.container.querySelector("#la-attack-en");
    const saveEnEl = this.container.querySelector("#la-save-en");

    const cur = state.energyAvailable ?? 63;
    const afterAttack = Math.max(10, cur - 11);
    const afterSave = Math.min(100, cur - 4); // After controlled save in lap

    if (currEnEl) currEnEl.textContent = `${cur}%`;
    if (attackEnEl) attackEnEl.textContent = `${afterAttack}%`;
    if (saveEnEl) saveEnEl.textContent = `${afterSave}%`;
  }
}
