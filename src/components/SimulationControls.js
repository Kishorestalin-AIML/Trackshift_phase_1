/**
 * RACE TWIN — Simulation Controls Component (Section 30)
 *
 * Controls:
 *   - PLAY, PAUSE, RESET, +1 LAP
 *   - Speed: 1x, 2x, 5x
 *   - Incidents: YELLOW (S2), VSC, SAFETY CAR, CLEAR
 *   - RUN DEMO (Automated Section 36 Demonstration)
 */

export class SimulationControls {
  constructor(containerEl, handlers) {
    this.container = containerEl;
    this.handlers = handlers || {};
    this.init();
  }

  init() {
    if (!this.container.querySelector("#btn-play")) {
      this.container.innerHTML = `
      <div class="bottom-panel-card sim-controls-panel">
        <div class="bottom-card-header">
          <span class="card-title">SIMULATION CONTROLS</span>
          <span class="card-sub-tag">SESSION ORCHESTRATION</span>
        </div>

        <div class="controls-body">
          <!-- Playback Row -->
          <div class="ctrl-group">
            <button class="btn-ctrl-action btn-play" id="btn-play">▶ PLAY</button>
            <button class="btn-ctrl-action btn-pause" id="btn-pause">⏸ PAUSE</button>
            <button class="btn-ctrl-action btn-reset" id="btn-reset">↻ RESET</button>
            <button class="btn-ctrl-action btn-step" id="btn-step-lap">+1 LAP</button>
          </div>

          <!-- Speed Row -->
          <div class="ctrl-group speed-group">
            <span class="ctrl-label">SPEED:</span>
            <button class="btn-speed active-speed" id="btn-speed-1" data-speed="1">1x</button>
            <button class="btn-speed" id="btn-speed-2" data-speed="2">2x</button>
            <button class="btn-speed" id="btn-speed-5" data-speed="5">5x</button>
          </div>

          <!-- Incidents Row (Section 30) -->
          <div class="ctrl-group incidents-group">
            <span class="ctrl-label">INCIDENTS:</span>
            <button class="btn-incident btn-yellow" id="btn-rc-yellow">YELLOW</button>
            <button class="btn-incident btn-vsc" id="btn-rc-vsc">VSC</button>
            <button class="btn-incident btn-sc" id="btn-rc-sc">SAFETY CAR</button>
            <button class="btn-incident btn-clear" id="btn-rc-clear">CLEAR</button>
          </div>

          <!-- Section 36 Deterministic Demo Button -->
          <button class="btn-run-demo" id="btn-auto-demo">
            ⚡ RUN DEMO SEQUENCE
          </button>
        </div>
      </div>
    `;
    }

    this.bindEvents();
  }

  bindEvents() {
    const bind = (id, handler) => {
      const el = this.container.querySelector(`#${id}`);
      if (el && handler) el.addEventListener("click", handler);
    };

    bind("btn-play", this.handlers.onPlay);
    bind("btn-pause", this.handlers.onPause);
    bind("btn-reset", this.handlers.onReset);
    bind("btn-step-lap", this.handlers.onStepLap);

    const speedBtns = this.container.querySelectorAll(".btn-speed");
    speedBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        speedBtns.forEach(b => b.classList.remove("active-speed"));
        btn.classList.add("active-speed");
        const spd = parseInt(btn.getAttribute("data-speed"), 10);
        if (this.handlers.onSpeed) this.handlers.onSpeed(spd);
      });
    });

    bind("btn-rc-yellow", this.handlers.onYellow);
    bind("btn-rc-vsc", this.handlers.onVSC);
    bind("btn-rc-sc", this.handlers.onSafetyCar);
    bind("btn-rc-clear", this.handlers.onClear);
    bind("btn-auto-demo", this.handlers.onRunDemo);
  }

  render(state) {
    if (!state) return;
    // Highlight active incident button
    const btnYellow = this.container.querySelector("#btn-rc-yellow");
    const btnVSC = this.container.querySelector("#btn-rc-vsc");
    const btnSC = this.container.querySelector("#btn-rc-sc");
    const btnClear = this.container.querySelector("#btn-rc-clear");

    [btnYellow, btnVSC, btnSC, btnClear].forEach(b => b && b.classList.remove("incident-active"));

    if (state.raceControl === "YELLOW" || state.raceControl === "YELLOW_S2") {
      if (btnYellow) btnYellow.classList.add("incident-active");
    } else if (state.raceControl === "VSC" || state.vsc) {
      if (btnVSC) btnVSC.classList.add("incident-active");
    } else if (state.raceControl === "SAFETY_CAR" || state.safetyCar) {
      if (btnSC) btnSC.classList.add("incident-active");
    } else {
      if (btnClear) btnClear.classList.add("incident-active");
    }
  }
}
