/**
 * TRACKSHIFT — Map-First Digital Twin Application Controller
 *
 * Coordinates:
 *   - MapDigitalTwin (Hero Silverstone canvas with on-track HUD callouts)
 *   - DecisionDrawer (Slide-out candidate actions table and constraint explanations)
 *   - SettingsDrawer (Configurable energy sliders and external factors)
 *   - LapRecordsModal (Session telemetry log)
 *   - Minimal playback and incident bar
 */

import { raceStore } from "../state/raceState.js";
import { raceEngine } from "../engine/raceEngine.js";
import { MapDigitalTwin } from "../components/MapDigitalTwin.js";
import { DecisionDrawer } from "../components/DecisionDrawer.js";
import { SettingsDrawer } from "../components/SettingsDrawer.js";
import { LapRecordsModal } from "../components/LapRecordsModal.js";

export class App {
  constructor() {
    this.store = raceStore;
    this.engine = raceEngine;
    this.components = {};
  }

  init() {
    console.log("Initializing TRACKSHIFT Map-First Digital Twin...");

    // 1. Mount Map Digital Twin
    const mapContainer = document.getElementById("mount-map-stage");
    if (mapContainer) {
      this.components.mapTwin = new MapDigitalTwin(
        mapContainer,
        () => this.components.decisionDrawer.open(),
        () => this.components.settingsDrawer.open()
      );
    }

    // 2. Mount Slide-Out Decision Drawer
    const decisionDrawerContainer = document.getElementById("mount-decision-drawer");
    if (decisionDrawerContainer) {
      this.components.decisionDrawer = new DecisionDrawer(
        decisionDrawerContainer,
        () => {},
        (actionId) => this.engine.applyCandidateAction(actionId)
      );
    }

    // 3. Mount Slide-Out Settings Drawer
    const settingsDrawerContainer = document.getElementById("mount-settings-drawer");
    if (settingsDrawerContainer) {
      this.components.settingsDrawer = new SettingsDrawer(
        settingsDrawerContainer,
        () => {},
        (newSettings) => {
          this.store.setState(newSettings);
          this.engine.recalculate();
        }
      );
    }

    // 4. Mount Lap Records Modal
    const recordsContainer = document.getElementById("mount-records-modal");
    if (recordsContainer) {
      this.components.recordsModal = new LapRecordsModal(recordsContainer, () => {});
    }

    // 5. Bind Header and Bottom Bar Controls
    this.bindControls();

    // 6. Subscribe to State Store
    this.store.subscribe((state) => this.render(state));

    // 7. Initial Evaluation & Render
    this.engine.recalculate();
    this.render(this.store.getState());

    // Auto-start live race simulation tick
    this.engine.start();
  }

  bindControls() {
    const bind = (id, handler) => {
      const el = document.getElementById(id);
      if (el && handler) el.addEventListener("click", handler);
    };

    // Header Triggers
    bind("btn-header-view-decision", () => this.components.decisionDrawer.open());
    bind("btn-header-settings", () => this.components.settingsDrawer.open());

    // Playback Controls
    bind("btn-play", () => this.engine.start());
    bind("btn-pause", () => this.engine.stop());
    bind("btn-reset", () => this.engine.reset());
    bind("btn-step-lap", () => this.engine.stepLap());

    // Speed Controls
    const speedBtns = document.querySelectorAll(".btn-speed-ctrl");
    speedBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        speedBtns.forEach(b => b.classList.remove("active-speed"));
        btn.classList.add("active-speed");
        const spd = parseInt(btn.getAttribute("data-speed"), 10);
        this.engine.setSpeed(spd);
      });
    });

    // Incident Controls (Section 17)
    bind("btn-rc-yellow", () => this.engine.triggerYellow(2));
    bind("btn-rc-vsc", () => this.engine.triggerVSC());
    bind("btn-rc-sc", () => this.engine.triggerSafetyCar());
    bind("btn-rc-clear", () => this.engine.clearIncidents());

    // Demo Sequence
    bind("btn-auto-demo", () => this.engine.runDemo());

    // Lap Record Pill
    bind("btn-lap-record-pill", () => this.components.recordsModal.open());
  }

  render(state) {
    // Header updates
    const lapEl = document.getElementById("top-lap-text");
    const flagBadge = document.getElementById("top-flag-badge");
    const flagDot = document.getElementById("top-flag-dot");
    const flagText = document.getElementById("top-flag-text");

    if (lapEl) lapEl.textContent = `LAP ${state.lap}/${state.totalLaps}`;

    if (flagBadge && flagText) {
      if (state.raceControl === "SAFETY_CAR" || state.safetyCar) {
        flagBadge.className = "top-flag-badge flag-safety-car";
        flagText.textContent = "SAFETY CAR";
        if (flagDot) flagDot.textContent = "⚠";
      } else if (state.raceControl === "VSC" || state.vsc) {
        flagBadge.className = "top-flag-badge flag-vsc";
        flagText.textContent = "VSC ACTIVE";
        if (flagDot) flagDot.textContent = "⚠";
      } else if (state.raceControl === "YELLOW" || state.raceControl === "YELLOW_S2" || state.yellowSector) {
        flagBadge.className = "top-flag-badge flag-yellow";
        flagText.textContent = "S2 YELLOW";
        if (flagDot) flagDot.textContent = "●";
      } else {
        flagBadge.className = "top-flag-badge flag-green";
        flagText.textContent = "GREEN FLAG";
        if (flagDot) flagDot.textContent = "●";
      }
    }

    // Pass render to components
    if (this.components.mapTwin) this.components.mapTwin.render(state);
    if (this.components.decisionDrawer) this.components.decisionDrawer.render(state);
    if (this.components.settingsDrawer) this.components.settingsDrawer.render(state);
    if (this.components.recordsModal) this.components.recordsModal.render(state);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
  window.__trackshiftApp = app;
  window.__raceStore = raceStore;
  window.__raceEngine = raceEngine;
});
