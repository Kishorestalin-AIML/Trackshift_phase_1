/**
 * TRACKSHIFT — Simulation Settings & Advanced Parameters Drawer (Sections 5, 11, 18)
 *
 * Slid in on demand without cluttering the main screen.
 * Configures:
 *   - Starting Energy (1.0 - 4.0 MJ)
 *   - Energy Reserve Floor (0.5 - 2.0 MJ)
 *   - Harvest Efficiency (50% - 95%)
 *   - Deployment Power (100 - 350 kW)
 *   - Deployment Duration (0.5 - 2.5s)
 *   - External factors (Traffic density, Track Grip, Incident toggle)
 */

export class SettingsDrawer {
  constructor(containerEl, onClose, onSettingsChange) {
    this.container = containerEl;
    this.onClose = onClose;
    this.onSettingsChange = onSettingsChange;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="settings-drawer-backdrop hidden" id="settings-backdrop"></div>
      <aside class="settings-drawer-panel drawer-closed" id="settings-panel">
        <div class="drawer-header">
          <div class="drawer-title-wrap">
            <span class="drawer-badge">SIMULATION PARAMETERS</span>
            <h2 class="drawer-title">ENERGY & RACE CONFIG</h2>
          </div>
          <button class="drawer-close-btn" id="settings-close" title="Close Settings">&times;</button>
        </div>

        <div class="drawer-body">
          <!-- 1. ENERGY PROFILE CONFIG (Section 5) -->
          <section class="drawer-section">
            <h3 class="section-title">ENERGY MANAGEMENT (MJ)</h3>
            
            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-energy">CURRENT ERS ENERGY</label>
                <span class="setting-val text-cyan" id="cfg-energy-val">2.84 MJ</span>
              </div>
              <input type="range" id="cfg-energy" min="1.0" max="4.0" step="0.05" value="2.84" class="slider-input">
            </div>

            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-reserve">PROTECTIVE ENERGY RESERVE FLOOR</label>
                <span class="setting-val text-yellow" id="cfg-reserve-val">1.20 MJ</span>
              </div>
              <input type="range" id="cfg-reserve" min="0.5" max="2.2" step="0.05" value="1.20" class="slider-input">
            </div>

            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-harvest">HARVEST EFFICIENCY (MGU-K)</label>
                <span class="setting-val text-green" id="cfg-harvest-val">78%</span>
              </div>
              <input type="range" id="cfg-harvest" min="50" max="95" step="1" value="78" class="slider-input">
            </div>
          </section>

          <!-- 2. DEPLOYMENT CONTROLS (Section 18) -->
          <section class="drawer-section">
            <h3 class="section-title">DEPLOYMENT CALIBRATION</h3>

            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-power">TARGET DEPLOY POWER</label>
                <span class="setting-val text-white" id="cfg-power-val">286 kW</span>
              </div>
              <input type="range" id="cfg-power" min="100" max="350" step="5" value="286" class="slider-input">
            </div>

            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-duration">DEPLOYMENT DURATION</label>
                <span class="setting-val text-white" id="cfg-duration-val">1.8 s</span>
              </div>
              <input type="range" id="cfg-duration" min="0.5" max="3.0" step="0.1" value="1.8" class="slider-input">
            </div>
          </section>

          <!-- 3. EXTERNAL FACTORS (Section 11) -->
          <section class="drawer-section">
            <h3 class="section-title">EXTERNAL FACTORS</h3>

            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-gap">TARGET GAP AHEAD</label>
                <span class="setting-val text-yellow" id="cfg-gap-val">0.72 s</span>
              </div>
              <input type="range" id="cfg-gap" min="0.2" max="2.5" step="0.02" value="0.72" class="slider-input">
            </div>

            <div class="setting-group">
              <div class="setting-label-row">
                <label for="cfg-closing">CLOSING RATE</label>
                <span class="setting-val text-green" id="cfg-closing-val">+6.8 km/h</span>
              </div>
              <input type="range" id="cfg-closing" min="-5.0" max="15.0" step="0.5" value="6.8" class="slider-input">
            </div>
          </section>
        </div>
      </aside>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector("#settings-close");
    const backdrop = this.container.querySelector("#settings-backdrop");

    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (backdrop) backdrop.addEventListener("click", () => this.close());

    // Listen to range sliders
    const bindSlider = (id, valId, unit, formatter, onChangeKey) => {
      const input = this.container.querySelector(`#${id}`);
      const valEl = this.container.querySelector(`#${valId}`);
      if (input && valEl) {
        input.addEventListener("input", (e) => {
          const val = parseFloat(e.target.value);
          valEl.textContent = formatter ? formatter(val) : `${val} ${unit}`;
          if (this.onSettingsChange) {
            this.onSettingsChange({ [onChangeKey]: val });
          }
        });
      }
    };

    bindSlider("cfg-energy", "cfg-energy-val", "MJ", (v) => `${v.toFixed(2)} MJ`, "currentEnergy");
    bindSlider("cfg-reserve", "cfg-reserve-val", "MJ", (v) => `${v.toFixed(2)} MJ`, "energyReserve");
    bindSlider("cfg-harvest", "cfg-harvest-val", "%", (v) => `${Math.round(v)}%`, "harvestEfficiency");
    bindSlider("cfg-gap", "cfg-gap-val", "s", (v) => `${v.toFixed(2)} s`, "gapAhead");
    bindSlider("cfg-closing", "cfg-closing-val", "km/h", (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} km/h`, "closingSpeed");
  }

  open() {
    const backdrop = this.container.querySelector("#settings-backdrop");
    const panel = this.container.querySelector("#settings-panel");
    if (backdrop) backdrop.classList.remove("hidden");
    if (panel) panel.classList.remove("drawer-closed");
  }

  close() {
    const backdrop = this.container.querySelector("#settings-backdrop");
    const panel = this.container.querySelector("#settings-panel");
    if (backdrop) backdrop.classList.add("hidden");
    if (panel) panel.classList.add("drawer-closed");
    if (this.onClose) this.onClose();
  }

  render(state) {
    if (!state) return;
    const setVal = (id, val, text) => {
      const el = this.container.querySelector(`#${id}`);
      const txt = this.container.querySelector(`#${id}-val`);
      if (el && document.activeElement !== el) el.value = val;
      if (txt) txt.textContent = text;
    };

    if (state.currentEnergy !== undefined) {
      setVal("cfg-energy", state.currentEnergy, `${state.currentEnergy.toFixed(2)} MJ`);
    }
    if (state.energyReserve !== undefined) {
      setVal("cfg-reserve", state.energyReserve, `${state.energyReserve.toFixed(2)} MJ`);
    }
    if (state.gapAhead !== undefined) {
      setVal("cfg-gap", state.gapAhead, `${state.gapAhead.toFixed(2)} s`);
    }
  }
}
