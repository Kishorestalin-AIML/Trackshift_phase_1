/**
 * RACE TWIN — 2026 Rule Status Component (Sections 15, 16, 17, 41)
 *
 * Right side bottom:
 *   ERS-K MAX: 350 kW
 *   KEY ACCELERATION / OVERTAKE ZONE: 350 kW
 *   OTHER LAP AREAS: 250 kW
 *   BOOST LIMIT: +150 kW
 *   RECHARGE LIMIT: 7 MJ
 *   OVERTAKE MODE: READY / UNAVAILABLE
 *   AERO MODE: LOW DRAG / HIGH DOWNFORCE
 */

import { RulesEngine } from "../engine/rulesEngine.js";

export class RulePanel {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="panel-box rules-panel">
        <div class="panel-header">
          <span class="panel-title">2026 RULE STATUS</span>
          <span class="panel-tag-fia">2026 FIA-CONSTRAINED SIMULATION</span>
        </div>

        <div class="rules-grid">
          <!-- Key Zone & Other Zone Power Limits -->
          <div class="rule-row">
            <span class="rule-key">ERS-K MAX DEPLOYMENT</span>
            <strong class="rule-val text-cyan">350 kW</strong>
          </div>

          <div class="rule-row">
            <span class="rule-key">KEY ZONE POWER (STRAIGHTS)</span>
            <strong class="rule-val text-green" id="rule-key-zone">350 kW (ACTIVE)</strong>
          </div>

          <div class="rule-row">
            <span class="rule-key">OTHER LAP AREAS (CORNERS)</span>
            <strong class="rule-val text-muted">250 kW</strong>
          </div>

          <div class="rule-row">
            <span class="rule-key">BOOST LIMIT</span>
            <strong class="rule-val">+150 kW</strong>
          </div>

          <div class="rule-row">
            <span class="rule-key">RECHARGE LIMIT</span>
            <strong class="rule-val">7.0 MJ</strong>
          </div>

          <!-- Overtake Mode (Section 16) -->
          <div class="rule-highlight-row">
            <span class="rule-key">OVERTAKE MODE</span>
            <span class="status-pill status-ready" id="rule-overtake-mode">READY</span>
          </div>

          <!-- Active Aero Mode (Section 17) -->
          <div class="rule-highlight-row">
            <span class="rule-key">ACTIVE AERO MODE</span>
            <span class="status-pill status-aero" id="rule-aero-mode">LOW DRAG</span>
          </div>
        </div>

        <!-- Official Prototype Disclaimer (Section 41) -->
        <div class="rule-disclaimer">
          <span>Prototype / Decision Support • Not an official FIA system</span>
        </div>
      </div>
    `;
  }

  render(state) {
    if (!state) return;

    const isKey = RulesEngine.isKeyZone(state.currentSegment);
    const keyZoneEl = this.container.querySelector("#rule-key-zone");
    const otModeEl = this.container.querySelector("#rule-overtake-mode");
    const aeroModeEl = this.container.querySelector("#rule-aero-mode");

    if (keyZoneEl) {
      keyZoneEl.textContent = isKey ? "350 kW (ACTIVE)" : "250 kW (STANDBY)";
      keyZoneEl.className = isKey ? "rule-val text-green" : "rule-val text-muted";
    }

    if (otModeEl) {
      if (state.overtakeModeAvailable) {
        otModeEl.textContent = "READY";
        otModeEl.className = "status-pill status-ready";
      } else {
        otModeEl.textContent = "UNAVAILABLE";
        otModeEl.className = "status-pill status-unavailable";
      }
    }

    if (aeroModeEl) {
      const aero = state.activeAero || (isKey ? "LOW DRAG" : "HIGH DOWNFORCE");
      aeroModeEl.textContent = aero.replace("_", " ");
      aeroModeEl.className = aero.includes("LOW") ? "status-pill status-aero-low" : "status-pill status-aero-high";
    }
  }
}
