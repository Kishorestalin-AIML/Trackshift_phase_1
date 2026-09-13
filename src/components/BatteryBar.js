/**
 * TRACKSHIFT — Real-Time Battery Visualization Bar (Section 7)
 *
 * Positioned directly underneath the race animation:
 * Displays segmented/gradient SOC gauge, Available Energy in MJ,
 * Deployed MJ, Recovered MJ, and Net MJ. Updates dynamically during simulation.
 */

import { twinStore } from "../state/twinState.js";

export class BatteryBar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.render();
    twinStore.subscribe(state => this.update(state));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="battery-card">
        <div class="battery-header">
          <div class="battery-title-group">
            <span class="battery-title">BATTERY STATE OF CHARGE (SOC)</span>
            <span class="battery-subtitle">4.00 MJ USABLE ESS CAPACITY (2026 REGULATION)</span>
          </div>
          <div class="battery-level-readout" id="battery-level-readout">
            <span class="soc-pct" id="battery-soc-val">62%</span>
            <span class="soc-mj" id="battery-mj-val">(2.48 MJ)</span>
          </div>
        </div>

        <div class="battery-track-wrapper">
          <div class="battery-track">
            <div class="battery-fill" id="battery-fill-bar" style="width: 62%;"></div>
            <div class="battery-reserve-marker" style="left: 15%;" title="15% FIA Safety Reserve Floor (0.60 MJ)">
              <span class="reserve-label">15% FLOOR</span>
            </div>
          </div>
        </div>

        <div class="battery-metrics-grid">
          <div class="battery-metric-box">
            <span class="metric-label">CURRENT SOC</span>
            <span class="metric-value" id="bat-cur-soc">62% <small>(2.48 MJ)</small></span>
          </div>
          <div class="battery-metric-box deployed">
            <span class="metric-label">DEPLOYED</span>
            <span class="metric-value" id="bat-deployed">-0.00 MJ</span>
          </div>
          <div class="battery-metric-box recovered">
            <span class="metric-label">RECOVERED</span>
            <span class="metric-value" id="bat-recovered">+0.00 MJ</span>
          </div>
          <div class="battery-metric-box net">
            <span class="metric-label">NET USABLE</span>
            <span class="metric-value" id="bat-net">0.00 MJ</span>
          </div>
        </div>
      </div>
    `;
  }

  update(state) {
    const soc = Math.max(0, Math.min(100, state.soc ?? 62));
    const cap = state.batteryCapacity ?? 4.00;
    const availableMJ = ((soc / 100) * cap).toFixed(2);

    const socVal = document.getElementById("battery-soc-val");
    const mjVal = document.getElementById("battery-mj-val");
    const fillBar = document.getElementById("battery-fill-bar");
    const curSoc = document.getElementById("bat-cur-soc");
    const deployed = document.getElementById("bat-deployed");
    const recovered = document.getElementById("bat-recovered");
    const net = document.getElementById("bat-net");

    if (socVal) socVal.textContent = `${soc}%`;
    if (mjVal) mjVal.textContent = `(${availableMJ} MJ)`;

    if (fillBar) {
      fillBar.style.width = `${soc}%`;
      if (soc < 20) {
        fillBar.style.background = "linear-gradient(90deg, #ff3b30, #ff9500)";
      } else if (soc < 40) {
        fillBar.style.background = "linear-gradient(90deg, #ff9500, #ffd700)";
      } else {
        fillBar.style.background = "linear-gradient(90deg, #00f0ff, #00ff88)";
      }
    }

    if (curSoc) curSoc.innerHTML = `${soc}% <small>(${availableMJ} MJ)</small>`;
    if (deployed) deployed.textContent = `-${(state.deployedEnergy ?? 0).toFixed(2)} MJ`;
    if (recovered) recovered.textContent = `+${(state.recoveredEnergy ?? 0).toFixed(2)} MJ`;

    const netVal = ((state.recoveredEnergy ?? 0) - (state.deployedEnergy ?? 0)).toFixed(2);
    if (net) {
      const sign = netVal > 0 ? "+" : "";
      net = document.getElementById("bat-net");
      if (net) {
        net.textContent = `${sign}${netVal} MJ`;
        net.style.color = netVal >= 0 ? "#00ff88" : "#ff3b30";
      }
    }
  }
}
