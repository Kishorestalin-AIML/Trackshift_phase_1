/**
 * TRACKSHIFT — Scenario Result Timeline (Section 13)
 *
 * Visualizes the 7-stage chronological simulation progression:
 * 00s Current state -> 04s Attack begins -> 07s Overtake opportunity ->
 * 09s Energy depleted -> 15s Recovery -> 22s Defensive threat -> 30s Future attack
 *
 * Progresses dynamically during the animated simulation run.
 */

import { twinStore } from "../state/twinState.js";

export const TIMELINE_STAGES = [
  { index: 0, timeSec: "00s", name: "CURRENT STATE", desc: "Slipstream tow established" },
  { index: 1, timeSec: "04s", name: "ATTACK BEGINS", desc: "MGU-K 280kW discharge" },
  { index: 2, timeSec: "07s", name: "OVERTAKE ATTEMPT", desc: "Pulling alongside rival" },
  { index: 3, timeSec: "09s", name: "ENERGY CEILING", desc: "Battery drops to reserve" },
  { index: 4, timeSec: "15s", name: "RECOVERY PHASE", desc: "Heavy braking kinetic regen" },
  { index: 5, timeSec: "22s", name: "DEFENSIVE THREAT", desc: "Counter-attack pressure" },
  { index: 6, timeSec: "30s", name: "FUTURE ATTACK", desc: "Next high-value DRS straight" }
];

export class ScenarioTimeline {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel-card scenario-timeline-panel">
        <div class="timeline-header">
          <span class="timeline-title">SCENARIO RESULT TIMELINE (00s → 30s)</span>
          <span class="timeline-clock text-mono" id="timeline-clock">T+00.0s / 30.0s</span>
        </div>

        <div class="timeline-progress-track">
          <div class="timeline-progress-fill" id="timeline-progress-bar" style="width: 0%;"></div>
        </div>

        <div class="timeline-stages-grid">
          ${TIMELINE_STAGES.map(st => `
            <div class="timeline-stage-node ${st.index === 0 ? 'active' : ''}" id="stage-node-${st.index}">
              <div class="stage-time text-mono">${st.timeSec}</div>
              <div class="stage-dot"></div>
              <div class="stage-name">${st.name}</div>
              <div class="stage-desc">${st.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  update(state) {
    const clock = document.getElementById("timeline-clock");
    const bar = document.getElementById("timeline-progress-bar");
    const sec = state.timelineProgressSec ?? 0.0;
    const pct = Math.min(100, Math.max(0, (sec / 30.0) * 100));

    if (clock) clock.textContent = `T+${sec.toFixed(1)}s / 30.0s`;
    if (bar) bar.style.width = `${pct}%`;

    const activeStage = state.timelineStageIndex ?? 0;
    TIMELINE_STAGES.forEach(st => {
      const node = document.getElementById(`stage-node-${st.index}`);
      if (node) {
        node.classList.toggle("active", st.index === activeStage);
        node.classList.toggle("passed", st.index < activeStage);
      }
    });
  }
}
