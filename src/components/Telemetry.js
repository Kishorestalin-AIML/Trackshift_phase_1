/**
 * RACE TWIN — Minimal Telemetry Component (Section 28)
 *
 * Left side bottom:
 *   SPEED: 318 km/h
 *   THROTTLE: 97%
 *   LAP TIME: 91.284 (or 1:31.284)
 *   DELTA: +0.214
 *   SECTOR: S3
 */

export class Telemetry {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="panel-box telemetry-panel">
        <div class="panel-header">
          <span class="panel-title">TELEMETRY</span>
          <span class="panel-badge-live">LIVE</span>
        </div>

        <div class="telem-grid">
          <!-- Speed -->
          <div class="telem-cell">
            <span class="telem-label">SPEED</span>
            <div class="telem-val-wrap">
              <strong class="telem-num" id="telem-speed">318</strong>
              <span class="telem-unit">km/h</span>
            </div>
            <div class="telem-bar-track">
              <div class="telem-bar-fill speed-fill" id="telem-speed-bar" style="width: 88%;"></div>
            </div>
          </div>

          <!-- Throttle -->
          <div class="telem-cell">
            <span class="telem-label">THROTTLE</span>
            <div class="telem-val-wrap">
              <strong class="telem-num text-green" id="telem-throttle">97</strong>
              <span class="telem-unit">%</span>
            </div>
            <div class="telem-bar-track">
              <div class="telem-bar-fill throttle-fill" id="telem-throttle-bar" style="width: 97%;"></div>
            </div>
          </div>

          <!-- Lap Time & Delta -->
          <div class="telem-cell">
            <span class="telem-label">LAP TIME</span>
            <strong class="telem-text" id="telem-laptime">1:31.284</strong>
          </div>

          <div class="telem-cell">
            <span class="telem-label">DELTA (REFERENCE)</span>
            <strong class="telem-text text-yellow" id="telem-delta">+0.214</strong>
          </div>

          <!-- Sector -->
          <div class="telem-cell">
            <span class="telem-label">SECTOR</span>
            <strong class="telem-text text-cyan" id="telem-sector">S3</strong>
          </div>
        </div>
      </div>
    `;
  }

  render(state) {
    if (!state) return;

    const speedEl = this.container.querySelector("#telem-speed");
    const speedBar = this.container.querySelector("#telem-speed-bar");
    const throttleEl = this.container.querySelector("#telem-throttle");
    const throttleBar = this.container.querySelector("#telem-throttle-bar");
    const laptimeEl = this.container.querySelector("#telem-laptime");
    const deltaEl = this.container.querySelector("#telem-delta");
    const sectorEl = this.container.querySelector("#telem-sector");

    const speed = state.speed || 318;
    const throttle = state.throttle || 97;

    if (speedEl) speedEl.textContent = Math.round(speed);
    if (speedBar) speedBar.style.width = `${Math.min(100, Math.max(5, (speed / 350) * 100))}%`;
    if (throttleEl) throttleEl.textContent = Math.round(throttle);
    if (throttleBar) throttleBar.style.width = `${Math.min(100, Math.max(0, throttle))}%`;
    if (laptimeEl) laptimeEl.textContent = state.lapTime || "1:31.284";
    if (deltaEl) deltaEl.textContent = state.delta || "+0.214";
    if (sectorEl) sectorEl.textContent = `S${state.currentSector || 3}`;
  }
}
