/**
 * RACE TWIN — Current State Panel Component (Section 13)
 *
 * Left side top:
 *   POSITION: P4
 *   GAP AHEAD: 0.62 s
 *   GAP BEHIND: 1.84 s
 *   CURRENT SECTOR: S3
 *   CURRENT SEGMENT: HANGAR STRAIGHT
 *   LAP: 38 / 52
 *   Tyre condition: MEDIUM, 18 laps, 82%
 */

export class CurrentState {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="panel-box current-state-panel">
        <div class="panel-header">
          <span class="panel-title">CURRENT STATE</span>
          <span class="panel-badge" id="cs-stint-badge">LAP 38/52</span>
        </div>

        <div class="cs-grid">
          <!-- Primary Position Readout -->
          <div class="cs-metric-block cs-pos-block">
            <span class="cs-label">POSITION</span>
            <div class="cs-val-wrap">
              <span class="cs-pos-val" id="cs-pos">P4</span>
              <span class="cs-hunting-tag" id="cs-target-tag">HUNTING P3</span>
            </div>
          </div>

          <!-- Gap Ahead -->
          <div class="cs-metric-block">
            <span class="cs-label">GAP AHEAD (TARGET)</span>
            <div class="cs-val-wrap">
              <span class="cs-val text-yellow" id="cs-gap-ahead">+0.62 s</span>
              <span class="cs-sub" id="cs-target-driver">LEC (FERRARI)</span>
            </div>
          </div>

          <!-- Gap Behind -->
          <div class="cs-metric-block">
            <span class="cs-label">GAP BEHIND</span>
            <div class="cs-val-wrap">
              <span class="cs-val text-cyan" id="cs-gap-behind">+1.84 s</span>
              <span class="cs-sub" id="cs-behind-driver">SAI (WILLIAMS)</span>
            </div>
          </div>

          <!-- Current Sector & Segment -->
          <div class="cs-metric-block">
            <span class="cs-label">TRACK POSITION</span>
            <div class="cs-val-wrap">
              <span class="cs-sector-badge" id="cs-sector">S3</span>
              <span class="cs-val-segment" id="cs-segment">HANGAR STRAIGHT</span>
            </div>
          </div>

          <!-- Tyre Condition -->
          <div class="cs-metric-block cs-tyre-block">
            <span class="cs-label">TYRES</span>
            <div class="cs-tyre-row">
              <span class="tyre-compound-badge tyre-medium" id="cs-tyre-compound">M</span>
              <div class="tyre-details">
                <span class="cs-tyre-life" id="cs-tyre-life">18 LAPS OLD</span>
                <span class="cs-tyre-cond" id="cs-tyre-cond">82% LIFE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render(state) {
    if (!state) return;

    const posEl = this.container.querySelector("#cs-pos");
    const targetTag = this.container.querySelector("#cs-target-tag");
    const gapAheadEl = this.container.querySelector("#cs-gap-ahead");
    const gapBehindEl = this.container.querySelector("#cs-gap-behind");
    const sectorEl = this.container.querySelector("#cs-sector");
    const segmentEl = this.container.querySelector("#cs-segment");
    const stintBadge = this.container.querySelector("#cs-stint-badge");
    const tyreLife = this.container.querySelector("#cs-tyre-life");
    const tyreCond = this.container.querySelector("#cs-tyre-cond");

    if (posEl) posEl.textContent = `P${state.position || 4}`;
    if (targetTag) targetTag.textContent = state.position === 3 ? "DEFENDING P3" : "HUNTING P3";
    if (gapAheadEl) gapAheadEl.textContent = `+${(state.gapAhead || 0.62).toFixed(2)} s`;
    if (gapBehindEl) gapBehindEl.textContent = `+${(state.gapBehind || 1.84).toFixed(2)} s`;
    if (sectorEl) sectorEl.textContent = `S${state.currentSector || 3}`;
    if (segmentEl) segmentEl.textContent = (state.currentSegmentName || "HANGAR STRAIGHT").toUpperCase();
    if (stintBadge) stintBadge.textContent = `LAP ${state.lap || 38}/${state.totalLaps || 52}`;
    if (tyreLife) tyreLife.textContent = `${state.tyreLife || 18} LAPS OLD`;
    if (tyreCond) tyreCond.textContent = `${state.tyreCondition || 82}% LIFE`;
  }
}
