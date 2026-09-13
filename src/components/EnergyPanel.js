/**
 * RACE TWIN — Energy Management Panel (Section 14)
 *
 * Right side middle/bottom:
 *   AVAILABLE: 63%
 *   DEPLOYED: 18%
 *   HARVESTED: 7%
 *   RESERVE: 45%
 *   Simple segmented energy bar
 */

export class EnergyPanel {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="panel-box energy-panel">
        <div class="panel-header">
          <span class="panel-title">ENERGY</span>
          <span class="panel-badge highlight-cyan" id="en-soc-badge">63% SOC</span>
        </div>

        <!-- Segmented Energy Bar (Section 14) -->
        <div class="energy-bar-container">
          <div class="energy-bar-track">
            <div class="energy-bar-fill" id="en-bar-fill" style="width: 63%;"></div>
          </div>
          <div class="energy-bar-scale">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        <!-- 4 Core Metrics Grid (Section 14) -->
        <div class="energy-metrics-grid">
          <div class="en-cell">
            <span class="en-label">AVAILABLE</span>
            <strong class="en-val text-cyan" id="en-available">63%</strong>
          </div>
          <div class="en-cell">
            <span class="en-label">DEPLOYED</span>
            <strong class="en-val text-red" id="en-deployed">18%</strong>
          </div>
          <div class="en-cell">
            <span class="en-label">HARVESTED</span>
            <strong class="en-val text-green" id="en-harvested">7%</strong>
          </div>
          <div class="en-cell">
            <span class="en-label">RESERVE</span>
            <strong class="en-val text-yellow" id="en-reserve">45%</strong>
          </div>
        </div>
      </div>
    `;
  }

  render(state) {
    if (!state) return;

    const availEl = this.container.querySelector("#en-available");
    const deployEl = this.container.querySelector("#en-deployed");
    const harvestEl = this.container.querySelector("#en-harvested");
    const reserveEl = this.container.querySelector("#en-reserve");
    const barFill = this.container.querySelector("#en-bar-fill");
    const socBadge = this.container.querySelector("#en-soc-badge");

    const avail = state.energyAvailable ?? 63;
    const reserve = state.energyReserve ?? 45;

    if (availEl) availEl.textContent = `${avail}%`;
    if (reserveEl) reserveEl.textContent = `${reserve}%`;
    if (deployEl) deployEl.textContent = `${state.deploymentPower ? Math.round((state.deploymentPower / 350) * 20) : 18}%`;
    if (harvestEl) harvestEl.textContent = `${state.harvestPower ? Math.round((state.harvestPower / 180) * 15) : 7}%`;
    if (barFill) barFill.style.width = `${Math.min(100, Math.max(0, avail))}%`;
    if (socBadge) socBadge.textContent = `${avail}% SOC`;
  }
}
