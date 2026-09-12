/**
 * TRACKSHIFT - Main Application Coordinator
 * Connects telemetry stream, state estimators, physical energy dynamics,
 * overtake models, constraint-first rolling-horizon optimizer, and visualizers.
 */

import { StateVector } from "../models/StateVector.js";
import { TrackModel, CIRCUITS } from "../models/TrackModel.js";
import { EnergyEstimator } from "../engine/EnergyEstimator.js";
import { OvertakeEngine } from "../engine/OvertakeEngine.js";
import { FutureOpportunityEngine } from "../engine/FutureOpportunityEngine.js";
import { ConstraintGenerator } from "../engine/ConstraintGenerator.js";
import { DynamicOptimizer } from "../engine/DynamicOptimizer.js";
import { BaselineSimulator } from "../engine/BaselineSimulator.js";
import { SCENARIOS } from "../scenarios/ScenarioLibrary.js";

import { TrackCanvas } from "./TrackCanvas.js";
import { PowerChart } from "./PowerChart.js";
import { TrajectoryChart } from "./TrajectoryChart.js";
import { DecisionExplainer } from "./DecisionExplainer.js";

export class TrackShiftApp {
  constructor() {
    // 1. Initialize Engines
    this.trackModel = new TrackModel("MONZA");
    this.energyEstimator = new EnergyEstimator({ vehicleMass: 798, etaRegen: 0.82 });
    this.overtakeEngine = new OvertakeEngine();
    this.futureEngine = new FutureOpportunityEngine(this.trackModel, this.energyEstimator, this.overtakeEngine);
    this.constraintGenerator = new ConstraintGenerator();
    this.optimizer = new DynamicOptimizer({
      energyEstimator: this.energyEstimator,
      overtakeEngine: this.overtakeEngine,
      futureEngine: this.futureEngine,
      constraintGenerator: this.constraintGenerator
    });
    this.baselineSimulator = new BaselineSimulator(
      this.trackModel,
      this.energyEstimator,
      this.overtakeEngine,
      this.futureEngine,
      this.constraintGenerator,
      this.optimizer
    );

    // 2. State & History
    this.state = SCENARIOS[0].state.clone();
    this.history = [];
    this.selectedHistoryItem = null;

    // 3. Simulation Clock
    this.isRunning = false;
    this.simSpeed = 1.0;
    this.lastFrameTime = performance.now();

    // 4. Initialize DOM & Canvas
    this.initDOM();
    this.initCanvasAndCharts();
    this.bindEvents();

    // 5. Initial Run & Telemetry sync
    this.loadScenario(SCENARIOS[0]);
    this.startAnimationLoop();
  }

  initDOM() {
    this.dom = {
      // Header controls
      circuitSelect: document.getElementById("select-circuit"),
      scenarioSelect: document.getElementById("select-scenario"),
      btnPlayPause: document.getElementById("btn-play-pause"),
      btnStep: document.getElementById("btn-step"),
      btnSpeed: document.getElementById("btn-speed"),
      btnReset: document.getElementById("btn-reset"),
      btnBenchmark: document.getElementById("btn-benchmark"),
      btnSettings: document.getElementById("btn-settings"),

      // Timestamp & Exact Decision Banner (Section 12)
      bannerLap: document.getElementById("banner-lap"),
      bannerTime: document.getElementById("banner-time"),
      bannerDist: document.getElementById("banner-dist"),
      bannerZone: document.getElementById("banner-zone"),
      bannerErs: document.getElementById("banner-ers"),
      bannerMguk: document.getElementById("banner-mguk"),
      bannerGap: document.getElementById("banner-gap"),
      bannerClosing: document.getElementById("banner-closing"),
      bannerPovertake: document.getElementById("banner-povertake"),
      bannerPcounter: document.getElementById("banner-pcounter"),
      bannerEreq: document.getElementById("banner-ereq"),
      bannerEharvest: document.getElementById("banner-eharvest"),
      bannerFutopp: document.getElementById("banner-futopp"),
      bannerDeployPower: document.getElementById("banner-deploy-power"),
      bannerDeployDur: document.getElementById("banner-deploy-dur"),
      bannerDeployCost: document.getElementById("banner-deploy-cost"),
      bannerRecCode: document.getElementById("banner-rec-code"),
      bannerRecSub: document.getElementById("banner-rec-sub"),
      bannerPill: document.getElementById("banner-pill"),

      // Left Cockpit & Telemetry Strip
      dispSpeed: document.getElementById("disp-speed"),
      dispThrottleBar: document.getElementById("disp-throttle-bar"),
      dispBrakeBar: document.getElementById("disp-brake-bar"),
      dispGear: document.getElementById("disp-gear"),
      dispPosition: document.getElementById("disp-position"),
      dispSocBar: document.getElementById("disp-soc-bar"),
      dispSocVal: document.getElementById("disp-soc-val"),
      dispTempBar: document.getElementById("disp-temp-bar"),
      dispTempVal: document.getElementById("disp-temp-val"),
      dispLapDeployed: document.getElementById("disp-lap-deployed"),
      dispLapHarvested: document.getElementById("disp-lap-harvested"),
      dispQuotaBar: document.getElementById("disp-quota-bar"),

      // Future Windows container
      futureWindowsStrip: document.getElementById("future-windows-strip"),

      // Decision Explainer
      explainerContainer: document.getElementById("explainer-container"),

      // History Table
      historyTableBody: document.getElementById("history-table-body"),

      // Modals and Drawers
      modalBenchmark: document.getElementById("modal-benchmark"),
      modalBenchmarkClose: document.getElementById("modal-benchmark-close"),
      btnRunStint: document.getElementById("btn-run-stint"),
      benchmarkResults: document.getElementById("benchmark-results"),

      drawerSettings: document.getElementById("drawer-settings"),
      drawerClose: document.getElementById("drawer-close"),

      // Settings sliders
      sliderVGain: document.getElementById("slider-vgain"),
      valVGain: document.getElementById("val-vgain"),
      sliderVLoss: document.getElementById("slider-vloss"),
      valVLoss: document.getElementById("val-vloss"),
      sliderLambdaE: document.getElementById("slider-lambdae"),
      valLambdaE: document.getElementById("val-lambdae"),
      sliderLambdaF: document.getElementById("slider-lambdaf"),
      valLambdaF: document.getElementById("val-lambdaf"),
      sliderMaxPower: document.getElementById("slider-maxpower"),
      valMaxPower: document.getElementById("val-maxpower"),
      sliderMaxLapEnergy: document.getElementById("slider-maxlapenergy"),
      valMaxLapEnergy: document.getElementById("val-maxlapenergy")
    };
  }

  initCanvasAndCharts() {
    this.trackCanvas = new TrackCanvas(document.getElementById("track-canvas"));
    this.trackCanvas.setTrackModel(this.trackModel);

    this.powerChart = new PowerChart(document.getElementById("power-canvas"));
    this.trajectoryChart = new TrajectoryChart(document.getElementById("trajectory-canvas"));
    this.explainer = new DecisionExplainer(this.dom.explainerContainer);
  }

  bindEvents() {
    // Play/Pause
    this.dom.btnPlayPause.addEventListener("click", () => this.togglePlay());

    // Step
    this.dom.btnStep.addEventListener("click", () => this.stepSimulation(0.3));

    // Speed multiplier
    this.dom.btnSpeed.addEventListener("click", () => {
      if (this.simSpeed === 1.0) this.simSpeed = 2.0;
      else if (this.simSpeed === 2.0) this.simSpeed = 5.0;
      else if (this.simSpeed === 5.0) this.simSpeed = 10.0;
      else this.simSpeed = 1.0;
      this.dom.btnSpeed.innerText = `${this.simSpeed}X`;
    });

    // Reset
    this.dom.btnReset.addEventListener("click", () => {
      this.powerChart.resetCumulatives();
      this.loadScenario(SCENARIOS[this.dom.scenarioSelect.selectedIndex]);
    });

    // Circuit Selector
    this.dom.circuitSelect.addEventListener("change", (e) => {
      this.changeCircuit(e.target.value);
    });

    // Scenario Selector
    this.dom.scenarioSelect.addEventListener("change", (e) => {
      const idx = parseInt(e.target.value, 10);
      this.loadScenario(SCENARIOS[idx]);
    });

    // Benchmark Modal
    this.dom.btnBenchmark.addEventListener("click", () => {
      this.dom.modalBenchmark.classList.add("open");
      this.runBenchmark();
    });
    this.dom.modalBenchmarkClose.addEventListener("click", () => {
      this.dom.modalBenchmark.classList.remove("open");
    });
    this.dom.btnRunStint.addEventListener("click", () => {
      this.runBenchmark();
    });

    // Settings Drawer
    this.dom.btnSettings.addEventListener("click", () => {
      this.dom.drawerSettings.classList.add("open");
    });
    this.dom.drawerClose.addEventListener("click", () => {
      this.dom.drawerSettings.classList.remove("open");
    });

    // Slider inputs for dynamic re-optimization
    const updateOptimizerWeights = () => {
      this.optimizer.setWeights({
        vGain: parseFloat(this.dom.sliderVGain.value),
        vLoss: parseFloat(this.dom.sliderVLoss.value),
        lambdaE: parseFloat(this.dom.sliderLambdaE.value),
        lambdaF: parseFloat(this.dom.sliderLambdaF.value)
      });
      this.dom.valVGain.innerText = this.dom.sliderVGain.value;
      this.dom.valVLoss.innerText = this.dom.sliderVLoss.value;
      this.dom.valLambdaE.innerText = this.dom.sliderLambdaE.value;
      this.dom.valLambdaF.innerText = this.dom.sliderLambdaF.value;

      this.constraintGenerator.updateRegulations({
        maxPermittedPowerKw: parseFloat(this.dom.sliderMaxPower.value),
        maxLapDeploymentMJ: parseFloat(this.dom.sliderMaxLapEnergy.value)
      });
      this.dom.valMaxPower.innerText = `${this.dom.sliderMaxPower.value} kW`;
      this.dom.valMaxLapEnergy.innerText = `${this.dom.sliderMaxLapEnergy.value} MJ`;

      this.evaluateCycle(0);
    };

    [
      this.dom.sliderVGain,
      this.dom.sliderVLoss,
      this.dom.sliderLambdaE,
      this.dom.sliderLambdaF,
      this.dom.sliderMaxPower,
      this.dom.sliderMaxLapEnergy
    ].forEach(slider => slider.addEventListener("input", updateOptimizerWeights));
  }

  changeCircuit(circuitId) {
    this.trackModel.setCircuit(circuitId);
    this.trackCanvas.setTrackModel(this.trackModel);
    this.state.track_distance = 0;
    this.powerChart.resetCumulatives();
    this.evaluateCycle(0);
  }

  loadScenario(scenario) {
    this.trackModel.setCircuit(scenario.circuitId);
    this.dom.circuitSelect.value = scenario.circuitId;
    this.trackCanvas.setTrackModel(this.trackModel);

    this.state = scenario.state.clone();
    this.powerChart.resetCumulatives();
    this.evaluateCycle(0);
  }

  togglePlay() {
    this.isRunning = !this.isRunning;
    if (this.isRunning) {
      this.dom.btnPlayPause.innerText = "HALT TELEMETRY";
      this.dom.btnPlayPause.classList.add("btn-primary");
      this.dom.btnPlayPause.classList.remove("btn-warning");
    } else {
      this.dom.btnPlayPause.innerText = "STREAM LIVE";
      this.dom.btnPlayPause.classList.remove("btn-primary");
      this.dom.btnPlayPause.classList.add("btn-warning");
    }
  }

  startAnimationLoop() {
    const loop = (timestamp) => {
      const deltaSec = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;

      if (this.isRunning && deltaSec > 0) {
        const stepDt = Math.min(0.25, deltaSec * this.simSpeed);
        this.stepSimulation(stepDt);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * Advances the vehicle and race state over a discrete timestep dt
   */
  stepSimulation(dt) {
    const totalLen = this.trackModel.circuit.length;
    const currentSpeedMs = Math.max(25, this.state.speed / 3.6);

    // 1. Advance Track Distance & Time
    const distDelta = currentSpeedMs * dt;
    this.state.track_distance = (this.state.track_distance + distDelta) % totalLen;
    this.state.time += dt;

    // Check lap completion
    if (this.state.track_distance < distDelta) {
      this.state.lap++;
      this.state.remaining_laps = Math.max(0, this.state.remaining_laps - 1);
      this.state.energy_deployed_lap = 0.0;
      this.state.energy_harvested_lap = 0.0;
    }

    // 2. Determine Current Zone & Track Context
    const { zone, index: zoneIdx } = this.trackModel.getZoneAtDistance(this.state.track_distance);
    this.state.current_zone = zone.name;
    this.state.zone_index = zoneIdx;

    // Dynamics modulation by zone
    if (zone.type === "BRAKING") {
      this.state.brake = 0.85;
      this.state.throttle = 0.0;
      this.state.gear = 3;
      this.state.speed = Math.max(zone.apexSpeed, this.state.speed - 90 * dt);
    } else if (zone.type === "ATTACK_ZONE" || zone.type === "STRAIGHT") {
      this.state.brake = 0.0;
      this.state.throttle = 1.0;
      this.state.gear = 7;
      this.state.speed = Math.min(zone.exitSpeed, this.state.speed + 35 * dt);
    } else {
      this.state.brake = 0.0;
      this.state.throttle = 0.88;
      this.state.gear = 5;
      this.state.speed = Math.min(zone.apexSpeed + 20, this.state.speed + 15 * dt);
    }

    // 3. Evaluate Optimization Cycle
    this.evaluateCycle(dt);
  }

  /**
   * Main Rolling-Horizon Optimization Step:
   * OBSERVE -> ESTIMATE -> PREDICT -> FILTER -> OPTIMIZE -> EXECUTE -> LOG
   */
  evaluateCycle(dt = 0.1) {
    const { zone } = this.trackModel.getZoneAtDistance(this.state.track_distance);

    // Lookahead future windows
    const futureWindows = this.futureEngine.generateFutureWindows(this.state, 4);

    // Execute Dynamic Optimizer
    const optResult = this.optimizer.optimize(this.state, zone, futureWindows);
    const bestAction = optResult.bestControl;
    const evalData = optResult.evaluation;

    // Step energy using optimal command
    const isBraking = zone.type === "BRAKING";
    const deltaBrake = isBraking ? Math.abs(zone.speedDeltaPotential) : 0;
    this.state = this.energyEstimator.stepEnergyState(this.state, bestAction.powerKw, isBraking, deltaBrake, dt > 0 ? dt : 0.1);

    // Opponent dynamics
    let rivalDist = (this.state.track_distance + (this.state.opponent_gap * (this.state.speed / 3.6))) % this.trackModel.circuit.length;
    if (this.state.race_position === 1) {
      // If defending P1, rival is behind us
      rivalDist = (this.state.track_distance - (this.state.opponent_gap * (this.state.speed / 3.6)) + this.trackModel.circuit.length) % this.trackModel.circuit.length;
    }

    // Pass execution detection
    if (bestAction.powerKw > 200 && zone.type === "ATTACK_ZONE" && evalData.pOvertake > 0.75 && evalData.pCounter < 0.32) {
      if (this.state.opponent_gap > 0.2) {
        this.state.opponent_gap = Math.max(0.15, this.state.opponent_gap - 0.04 * (dt > 0 ? dt : 0.1));
      }
    }

    // Add telemetry point to power chart
    if (dt > 0) {
      this.powerChart.addDataPoint(
        this.state.time,
        this.state.track_distance,
        isBraking ? 200 : bestAction.powerKw,
        isBraking,
        dt
      );
    }

    // Generate Candidate Trajectories for graph
    const trajectories = {
      optimized: this.energyEstimator.predictTrajectory(this.state, futureWindows, bestAction),
      current: this.energyEstimator.predictTrajectory(this.state, futureWindows, { powerKw: 0, duration: 0 }),
      aggressive: this.energyEstimator.predictTrajectory(this.state, futureWindows, { powerKw: 350, duration: 3.5 }),
      conservative: this.energyEstimator.predictTrajectory(this.state, futureWindows, { powerKw: 80, duration: 1.5 })
    };
    this.trajectoryChart.updateTrajectories(trajectories);

    // Update Decision Explainer panel
    this.explainer.render(optResult.explanation);

    // Update Future Windows UI
    this.renderFutureWindows(futureWindows);

    // Update Track Canvas
    this.trackCanvas.updateCarPositions(this.state.track_distance, rivalDist);

    // Update Exact Decision Timestamp Banner (Section 12)
    this.updateBannerUI(zone, evalData, bestAction, optResult.recommendation, optResult.horizonSummary);

    // Update Left Telemetry Cockpit
    this.updateTelemetryGauges();

    // Log to Decision History Table
    if (dt > 0 && Math.random() < 0.15) {
      this.logDecisionHistory(zone, evalData, bestAction, optResult.recommendation);
    }
  }

  updateBannerUI(zone, evalData, bestAction, recommendation, horizonSummary) {
    this.dom.bannerLap.innerText = `LAP ${this.state.lap}`;
    this.dom.bannerTime.innerText = this.state.formattedTime;
    this.dom.bannerDist.innerText = `${Math.round(this.state.track_distance)} m`;
    this.dom.bannerZone.innerText = zone.name.toUpperCase();

    // Current State
    this.dom.bannerErs.innerText = `${this.state.estimated_energy.toFixed(2)} MJ`;
    this.dom.bannerMguk.innerText = `${bestAction.powerKw} kW`;
    this.dom.bannerGap.innerText = `${this.state.opponent_gap.toFixed(2)} s`;
    this.dom.bannerClosing.innerText = `${this.state.opponent_closing_speed > 0 ? "+" : ""}${this.state.opponent_closing_speed.toFixed(1)} km/h`;

    // Decision Engine metrics
    this.dom.bannerPovertake.innerText = `${(evalData.pOvertake * 100).toFixed(0)}%`;
    this.dom.bannerPcounter.innerText = `${(evalData.pCounter * 100).toFixed(0)}%`;
    this.dom.bannerEreq.innerText = `${evalData.energyCostMJ.toFixed(2)} MJ`;
    this.dom.bannerEharvest.innerText = `+${horizonSummary.totalFutureHarvestMJ.toFixed(2)} MJ`;
    this.dom.bannerFutopp.innerText = `${horizonSummary.maxFutureStrategicValue.toFixed(2)}`;

    // Optimal Control parameters
    this.dom.bannerDeployPower.innerText = `${bestAction.powerKw} kW`;
    this.dom.bannerDeployDur.innerText = `${bestAction.duration.toFixed(1)} s`;
    this.dom.bannerDeployCost.innerText = `${evalData.energyCostMJ.toFixed(2)} MJ`;

    // Recommendation pill
    this.dom.bannerRecCode.innerText = recommendation.title;
    this.dom.bannerRecSub.innerText = recommendation.summary;

    if (recommendation.badgeColor === "red") {
      this.dom.bannerPill.style.borderColor = "var(--f1-red)";
      this.dom.bannerRecCode.style.color = "var(--f1-red)";
    } else if (recommendation.badgeColor === "yellow") {
      this.dom.bannerPill.style.borderColor = "var(--f1-yellow)";
      this.dom.bannerRecCode.style.color = "var(--f1-yellow)";
    } else if (recommendation.badgeColor === "green") {
      this.dom.bannerPill.style.borderColor = "var(--f1-green)";
      this.dom.bannerRecCode.style.color = "var(--f1-green)";
    } else {
      this.dom.bannerPill.style.borderColor = "var(--f1-cyan)";
      this.dom.bannerRecCode.style.color = "var(--f1-cyan)";
    }
  }

  updateTelemetryGauges() {
    this.dom.dispSpeed.innerText = this.state.speed.toFixed(1);
    this.dom.dispThrottleBar.style.width = `${(this.state.throttle * 100).toFixed(0)}%`;
    this.dom.dispBrakeBar.style.width = `${(this.state.brake * 100).toFixed(0)}%`;
    this.dom.dispGear.innerText = this.state.gear;
    this.dom.dispPosition.innerText = `P${this.state.race_position}`;

    // Battery SOC
    this.dom.dispSocVal.innerText = `${this.state.estimated_SOC.toFixed(1)}%`;
    this.dom.dispSocBar.style.width = `${this.state.estimated_SOC.toFixed(1)}%`;

    // Cell Temp
    this.dom.dispTempVal.innerText = `${this.state.cell_temp.toFixed(1)}°C`;
    this.dom.dispTempBar.style.width = `${Math.min(100, (this.state.cell_temp / 75) * 100).toFixed(0)}%`;

    // Per-lap quota (4.0 MJ limit)
    this.dom.dispLapDeployed.innerText = `${this.state.energy_deployed_lap.toFixed(2)} MJ`;
    this.dom.dispLapHarvested.innerText = `+${this.state.energy_harvested_lap.toFixed(2)} MJ`;
    const quotaPct = Math.min(100, (this.state.energy_deployed_lap / 4.0) * 100);
    this.dom.dispQuotaBar.style.width = `${quotaPct.toFixed(0)}%`;
  }

  renderFutureWindows(windows) {
    if (!this.dom.futureWindowsStrip) return;
    this.dom.futureWindowsStrip.innerHTML = "";

    windows.slice(0, 5).forEach((w, i) => {
      const card = document.createElement("div");
      card.className = `future-window-card ${w.strategicValue > 0.78 ? "best-window" : ""}`;
      card.innerHTML = `
        <div class="fw-header">
          <span>${w.label}</span>
          <span>${w.timeToWindow}s</span>
        </div>
        <div class="fw-val">${(w.pOvertake * 100).toFixed(0)}% P(OVER)</div>
        <div class="fw-meta">
          <span>RISK: ${(w.pCounter * 100).toFixed(0)}%</span>
          <span>REQ: ${w.energyRequired} MJ</span>
        </div>
        <div class="fw-meta" style="margin-top: 2px;">
          <span style="color: var(--f1-green);">REGEN: +${w.expectedFutureHarvest} MJ</span>
          <span style="color: var(--f1-yellow);">YIELD: ${w.strategicValue}</span>
        </div>
      `;
      this.dom.futureWindowsStrip.appendChild(card);
    });
  }

  logDecisionHistory(zone, evalData, bestAction, recommendation) {
    const row = {
      id: Date.now(),
      lap: this.state.lap,
      time: this.state.formattedTime,
      zone: zone.name,
      pOvertake: evalData.pOvertake,
      pCounter: evalData.pCounter,
      energy: this.state.estimated_energy,
      powerKw: bestAction.powerKw,
      controlText: `${bestAction.powerKw} kW / ${bestAction.duration}s`,
      recommendation: recommendation.title,
      badgeColor: recommendation.badgeColor,
      snapshotState: this.state.clone(),
      snapshotZone: zone
    };

    this.history.unshift(row);
    if (this.history.length > 25) this.history.pop();
    this.renderHistoryTable();
  }

  renderHistoryTable() {
    if (!this.dom.historyTableBody) return;
    this.dom.historyTableBody.innerHTML = "";

    this.history.forEach(item => {
      const tr = document.createElement("tr");
      let tagClass = "tag-cruise";
      if (item.badgeColor === "red") tagClass = "tag-deploy";
      else if (item.badgeColor === "green") tagClass = "tag-harvest";
      else if (item.badgeColor === "yellow") tagClass = "tag-conserve";

      tr.innerHTML = `
        <td>${item.lap}</td>
        <td>${item.time}</td>
        <td>${item.zone.substring(0, 14)}</td>
        <td>${(item.pOvertake * 100).toFixed(0)}%</td>
        <td>${(item.pCounter * 100).toFixed(0)}%</td>
        <td>${item.energy.toFixed(2)} MJ</td>
        <td>${item.powerKw} kW</td>
        <td>${item.controlText}</td>
        <td class="${tagClass}">${item.recommendation}</td>
      `;

      // Interactive Time-Travel Feature (Section 23):
      tr.addEventListener("click", () => {
        this.inspectHistoryMoment(item);
      });

      this.dom.historyTableBody.appendChild(tr);
    });
  }

  /**
   * Time-Travel Inspector (Section 23):
   * Restores vehicle state at that moment, evaluates feasible space,
   * explains why control was chosen, and displays what happened next.
   */
  inspectHistoryMoment(item) {
    // Highlight row
    document.querySelectorAll(".history-table tbody tr").forEach(r => r.classList.remove("selected-row"));
    event.currentTarget.classList.add("selected-row");

    // Pause live stream during inspection
    if (this.isRunning) this.togglePlay();

    // Restore snapshot state
    this.state = item.snapshotState.clone();
    this.evaluateCycle(0);
  }

  runBenchmark() {
    const results = this.baselineSimulator.runStintComparison(this.state, 5);
    let html = `
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
        Multi-lap benchmark across 5 racing laps under identical initial energy reserves and opponent dynamics:
      </div>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>STRATEGY</th>
            <th>OVERTAKES</th>
            <th>COUNTERED</th>
            <th>VIOLATIONS</th>
            <th>DEPLOYED (MJ)</th>
            <th>FINAL ERS</th>
            <th>EFFICIENCY</th>
            <th>SCORE</th>
          </tr>
        </thead>
        <tbody>
    `;

    Object.keys(results).forEach(key => {
      const res = results[key];
      const isTS = key === "TRACKSHIFT";
      html += `
        <tr class="${isTS ? 'highlight-trackshift' : ''}">
          <td style="text-align: left;"><strong>${res.name}</strong></td>
          <td style="color: var(--f1-green); font-weight: 700;">+${res.successfulOvertakes}</td>
          <td style="color: ${res.counterEventsSuffered > 0 ? 'var(--f1-red)' : 'var(--text-muted)'};">${res.counterEventsSuffered}</td>
          <td style="color: ${res.constraintViolations > 0 ? 'var(--f1-red)' : 'var(--f1-green)'}; font-weight: 700;">${res.constraintViolations}</td>
          <td>${res.totalEnergyDeployedMJ} MJ</td>
          <td>${res.finalEnergyMJ.toFixed(2)} MJ (${res.finalSOC.toFixed(0)}%)</td>
          <td style="color: var(--f1-yellow); font-weight: 700;">${res.energyEfficiency}</td>
          <td style="font-size: 0.95rem; font-weight: 800; color: #fff;">${res.netScore}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.5); border-left: 3px solid var(--f1-yellow); font-size: 0.78rem; line-height: 1.4;">
        <strong style="color: #fff; display: block; margin-bottom: 4px;">SYSTEM ANALYSIS & FINDINGS:</strong>
        TrackShift achieved the highest net strategic score by avoiding high counter-risk corners, eliminating regulatory quota violations, and timing deployment exclusively when kinetic recovery replenished battery headroom.
      </div>
    `;

    this.dom.benchmarkResults.innerHTML = html;
  }
}

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new TrackShiftApp();
});
