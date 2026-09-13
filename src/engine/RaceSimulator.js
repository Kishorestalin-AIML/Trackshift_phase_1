/**
 * TRACKSHIFT - RaceSimulator
 * Continuous deterministic/seeded 10-lap race simulation engine for Silverstone GP.
 *
 * Implements:
 *   - 10-car authentic F1 pack:
 *       Car 44: PLAYER ("YOU", Red #ff1801, Starts P6)
 *       Car 16: TARGET ("P5", Yellow #ffb800, Starts P5)
 *       Pack Cars: [1, 4, 63, 55, 11, 81, 14, 23] (Sleek Gray #8b949e)
 *   - Physical continuous progression (d += v * dt), no teleportation.
 *   - Lateral offset inside/outside passing dynamics for visual overtakes.
 *   - Complete Lap Record Data Model (Section 35) with Sector 1, 2, 3 times,
 *     delta vs previous lap, best lap tracking, and key decision summaries.
 *   - Dynamic target promotion: overtaking P5 promotes P4 to yellow target.
 */

import { StateVector } from "../models/StateVector.js";

export class RaceSimulator {
  constructor(options = {}) {
    this.trackModel = options.trackModel;
    this.energyEstimator = options.energyEstimator;
    this.overtakeEngine = options.overtakeEngine;
    this.futureEngine = options.futureEngine;
    this.constraintGenerator = options.constraintGenerator;
    this.optimizer = options.optimizer;

    // Simulation Config (RACE TWIN: Silverstone GP Lap 38 / 52)
    this.totalLaps = 52;
    this.currentLap = 38;
    this.raceTime = 38 * 91.4; // seconds
    this.simSpeed = 5.0; // Default 5x speed for smooth demo
    this.isPaused = true;
    this.isComplete = false;

    // Competitor Positions: P7 hunting P6
    this.playerPosition = 7;
    this.opponentPosition = 6;

    // Lap Records System (Sections 18, 19, 20, 35, 38)
    this.lapRecords = [];
    this.bestLapTime = null;
    this.lastLapTime = null;
    this.lastDelta = null;

    // Live Sector Tracking
    this.currentLapStartTime = 0.0;
    this.sector1Time = null;
    this.sector2Time = null;
    this.sector3Time = null;
    this.sector1Recorded = false;
    this.sector2Recorded = false;
    this.currentSector = 1;

    // Current Lap Running Accounting
    this.currentLapStartPos = 6;
    this.currentLapStartGap = 0.85;
    this.currentLapStartEnergy = 3.20;
    this.currentLapDecisions = [];
    this.currentLapResult = "STABLE";

    // Telemetry and Replay Timeline
    this.decisionTimeline = [];
    this.telemetryHistory = [];
    this.currentStepIndex = 0;
    this.isReplaying = false;

    // Outperformance Stats
    this.stats = {
      playerOvertakes: 0,
      playerCounterEvents: 0,
      totalEnergyDeployedMJ: 0.0,
      totalEnergyHarvestedMJ: 0.0,
      totalEnergyWastedMJ: 0.0,
      constraintViolations: 0,
      optimizationScores: []
    };

    // Event Callbacks
    this.onOvertake = null;
    this.onCounterEvent = null;
    this.onOvertakeMissed = null;
    this.onDecisionEvent = null;
    this.onLapCompleted = null;
    this.onRaceConditionChanged = null;
    this.onRaceEventLogged = null;

    this.resetSimulation();
  }

  resetSimulation(initialPreset = null) {
    this.totalLaps = 52;
    this.currentLap = 38;
    this.raceTime = 38 * 91.4;
    this.playerPosition = 7;
    this.opponentPosition = 6;
    this.isPaused = true;
    this.isComplete = false;
    this.isReplaying = false;

    // Race Conditions
    this.raceCondition = "GREEN"; // GREEN, YELLOW_S1, YELLOW_S2, YELLOW_S3, VSC, SAFETY_CAR
    this.raceEvents = [
      { lap: 38, time: 38 * 91.4 + 31, formattedTime: "38:31", text: "Attack opportunity detected", type: "info" },
      { lap: 38, time: 38 * 91.4 + 14, formattedTime: "38:14", text: "Gap < 1.0s to P6", type: "info" },
      { lap: 38, time: 38 * 91.4 + 2, formattedTime: "38:02", text: "Energy deployment increased", type: "info" },
      { lap: 38, time: 38 * 91.4, formattedTime: "38:00", text: "LIVE REPLAY ACTIVE — SILVERSTONE GP", type: "green" }
    ];
    this.safetyCar = {
      id: "car-sc",
      number: "SC",
      name: "SAFETY CAR",
      position: 0,
      color: "#ff9100",
      distance: 0,
      speed: 135.0,
      isActive: false,
      lateralOffset: 0
    };
    this.automatedIncidentsTriggered = {
      l39Yellow: false,
      l39Restart: false,
      l41Vsc: false,
      l41Restart: false
    };

    this.decisionTimeline = [];
    this.telemetryHistory = [];
    this.currentStepIndex = 0;
    this.lapRecords = [];
    this.bestLapTime = 90.412;
    this.lastLapTime = 91.240;
    this.lastDelta = -0.17;

    // Reset Live Lap Accounting
    this.currentLapStartTime = this.raceTime;
    this.sector1Time = 28.204;
    this.sector2Time = null;
    this.sector3Time = null;
    this.sector1Recorded = true;
    this.sector2Recorded = false;
    this.currentSector = 2;
    this.currentLapStartPos = 7;
    this.currentLapStartGap = initialPreset?.opponentGap ?? 0.82;
    this.currentLapStartEnergy = 2.44;
    this.currentLapDecisions = [];
    this.currentLapResult = "HUNTING P6";

    this.stats = {
      playerOvertakes: 0,
      playerCounterEvents: 0,
      totalEnergyDeployedMJ: 0.0,
      totalEnergyHarvestedMJ: 0.0,
      totalEnergyWastedMJ: 0.0,
      constraintViolations: 0,
      optimizationScores: []
    };

    const trackLen = this.trackModel ? this.trackModel.circuit.length : 5891;

    // Initial state on Lap 38 (P7 chasing P6 at 0.82s)
    this.playerState = new StateVector({
      lap: 38,
      time: this.raceTime,
      track_distance: 2840.0, // Wellington / Brooklands
      speed: 287.0,
      acceleration: 3.8,
      throttle: 1.0,
      brake: 0.0,
      gear: 7,
      estimated_energy: 2.44,
      estimated_SOC: 61.0,
      energy_available_pct: 61.0,
      energy_deployment_pct: 8.2,
      energy_harvest_pct: 4.7,
      energy_reserve_pct: 32.0,
      energy_harvest_rate: 0.0,
      energy_deployment_rate: 184.0,
      cell_temp: 58.4,
      tyre_compound: "MEDIUM",
      tyre_condition: 72.0,
      tyre_degradation: "MEDIUM",
      tyre_temp: "OPTIMAL",
      tyre_temp_deg: 95.0,
      tyre_risk: "LOW",
      opponent_gap: initialPreset?.opponentGap ?? 0.82,
      gap_behind: 1.41,
      pace_delta: 0.17,
      opponent_closing_speed: 6.8,
      race_position: 7,
      target_position: 6,
      current_zone: "WELLINGTON STRAIGHT",
      remaining_laps: 14,
      energy_harvested_lap: 0.38,
      energy_deployed_lap: 0.65
    });

    // 10-Car Multi-Competitor Grid
    // P1: VER (1), P2: NOR (4), P3: RUS (63), P4: SAI (55), P5: PIA (81)
    // P6: LEC (16) - Target (Yellow #ffb800)
    // P7: YOU (44) - Player (Red #ff1801)
    // P8: PER (11) - Behind at 1.41s
    // P9: ALO (14), P10: ALB (23)
    this.competitors = [
      { id: "car-1", number: 1, name: "VER", position: 1, color: "#8b949e", distance: (2840 + Math.round(trackLen * 0.28)) % trackLen, speed: 295.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-4", number: 4, name: "NOR", position: 2, color: "#8b949e", distance: (2840 + Math.round(trackLen * 0.22)) % trackLen, speed: 293.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-63", number: 63, name: "RUS", position: 3, color: "#8b949e", distance: (2840 + Math.round(trackLen * 0.17)) % trackLen, speed: 291.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-55", number: 55, name: "SAI", position: 4, color: "#8b949e", distance: (2840 + Math.round(trackLen * 0.11)) % trackLen, speed: 289.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-81", number: 81, name: "PIA", position: 5, color: "#8b949e", distance: (2840 + Math.round(trackLen * 0.05)) % trackLen, speed: 288.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-16", number: 16, name: "LEC", position: 6, color: "#ffb800", distance: (2840 + 65) % trackLen, speed: 285.0, isPlayer: false, isTarget: true, lateralOffset: 0 },
      { id: "car-44", number: 44, name: "YOU", position: 7, color: "#ff1801", distance: 2840.0, speed: 287.0, isPlayer: true, isTarget: false, lateralOffset: 0 },
      { id: "car-11", number: 11, name: "PER", position: 8, color: "#8b949e", distance: (2840 - 110 + trackLen) % trackLen, speed: 283.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-14", number: 14, name: "ALO", position: 9, color: "#8b949e", distance: (2840 - 190 + trackLen) % trackLen, speed: 281.0, isPlayer: false, isTarget: false, lateralOffset: 0 },
      { id: "car-23", number: 23, name: "ALB", position: 10, color: "#8b949e", distance: (2840 - 270 + trackLen) % trackLen, speed: 280.0, isPlayer: false, isTarget: false, lateralOffset: 0 }
    ];

    this.opponentSpeed = 285.0;
    this.opponentDistance = (2840 + 65) % trackLen;

    // Initial Telemetry Frame
    this.recordTelemetryFrame();
  }

  setCircuit(circuitId) {
    if (this.trackModel) {
      this.trackModel.setCircuit(circuitId);
      this.resetSimulation();
    }
  }

  setSpeed(speedMultiplier) {
    this.simSpeed = speedMultiplier;
  }

  start() {
    this.isPaused = false;
  }

  pause() {
    this.isPaused = true;
  }

  stepLapForward() {
    if (this.currentLap >= this.totalLaps) return;
    this.currentLap++;
    this.playerState.lap = this.currentLap;
    this.playerState.remaining_laps = Math.max(0, this.totalLaps - this.currentLap);

    // Tyre degradation: -1.2% per lap
    this.playerState.tyre_condition = Math.max(20, parseFloat((this.playerState.tyre_condition - 1.2).toFixed(1)));
    if (this.playerState.tyre_condition < 60) {
      this.playerState.tyre_degradation = "HIGH";
      this.playerState.tyre_risk = "MEDIUM";
    }

    // Deterministic progression matching Section 33 Quality Bar
    if (this.currentLap === 39) {
      this.playerState.opponent_gap = 0.48;
      this.playerState.gap_behind = 1.65;
      this.playerState.energy_available_pct = 54.2;
      this.playerState.energy_deployment_pct = 14.8;
      this.playerState.energy_reserve_pct = 28.5;
      this.playerState.current_zone = "HANGAR STRAIGHT";
      this.logRaceEvent(`39:01 Gap reduced to 0.48s in Hangar Straight`, "info");
      this.logRaceEvent(`39:03 Attack opportunity surge detected (P=88%)`, "green");
    } else if (this.currentLap === 40) {
      this.playerState.opponent_gap = 0.95;
      this.playerState.energy_available_pct = 64.0;
      this.playerState.energy_harvest_pct = 6.8;
      this.playerState.energy_reserve_pct = 36.0;
      this.playerState.current_zone = "THE LOOP";
      this.logRaceEvent(`40:02 Lap 40: Tactical harvest and energy regeneration`, "info");
    } else if (this.currentLap === 41) {
      this.playerState.opponent_gap = 0.38;
      this.playerState.energy_available_pct = 67.5;
      this.playerState.current_zone = "STOWE CORNER";
      this.logRaceEvent(`41:00 Lap 41: High-value attack opportunity window at Stowe`, "green");
    } else if (this.currentLap === 42) {
      this.playerState.opponent_gap = 1.20;
      this.playerState.current_zone = "COPSE CORNER";
      this.logRaceEvent(`42:00 Lap 42: Navigating traffic ahead`, "info");
    }

    this.recordTelemetryFrame();

    if (this.onLapCompleted) {
      this.onLapCompleted({
        lap: this.currentLap,
        lapTime: 90.842,
        formattedLapTime: "1:30.842",
        sector1: 28.104,
        sector2: 36.421,
        sector3: 26.317,
        gapEnd: this.playerState.opponent_gap,
        energyEnd: parseFloat((this.playerState.energy_available_pct / 25).toFixed(2)),
        decisionSummary: this.currentLap === 39 ? "ATTACK" : (this.currentLap === 40 ? "SAVE" : "CONTROLLED"),
        result: "ACTIVE"
      });
    }
  }

  setRaceCondition(newCondition, reason = "") {
    const prevCondition = this.raceCondition;
    this.raceCondition = newCondition;

    if (newCondition === "GREEN") {
      this.safetyCar.isActive = false;
      this.logRaceEvent(`39:45 🟢 GREEN FLAG — RESTART ACTIVE`, "green");
      this.logRaceEvent(`39:46 Decision Twin recalculating remaining stint...`, "info");
      this.logRaceEvent(`39:48 NEW STRATEGY: ATTACK ON RESTART`, "green");
    } else if (newCondition.startsWith("YELLOW")) {
      const sec = newCondition === "YELLOW_S1" ? 1 : (newCondition === "YELLOW_S2" ? 2 : 3);
      this.logRaceEvent(`39:04 ⚠ YELLOW FLAG — SECTOR ${sec}${reason ? ` (${reason})` : ''}`, "yellow");
      this.logRaceEvent(`39:05 Previous strategy invalidated`, "warning");
      this.logRaceEvent(`39:06 Decision Twin recalculating remaining race...`, "info");
      this.logRaceEvent(`39:08 NEW STRATEGY: SAVE + HARVEST`, "green");
    } else if (newCondition === "VSC") {
      this.logRaceEvent(`L${this.currentLap} 🟠 VSC ACTIVE — SPEED NEUTRALIZED`, "vsc");
      this.logRaceEvent(`L${this.currentLap} Previous strategy invalidated`, "warning");
      this.logRaceEvent(`L${this.currentLap} NEW STRATEGY: SAVE + HARVEST (VSC DELTA)`, "green");
    } else if (newCondition === "SAFETY_CAR") {
      this.safetyCar.isActive = true;
      const leader = this.competitors.find(c => c.position === 1) || this.competitors[0];
      const trackLen = this.trackModel ? this.trackModel.circuit.length : 5891;
      this.safetyCar.distance = (leader.distance + 40) % trackLen;
      this.safetyCar.speed = 135.0;
      this.logRaceEvent(`L${this.currentLap} 🚨 SAFETY CAR DEPLOYED`, "safety_car");
      this.logRaceEvent(`L${this.currentLap} Previous strategy invalidated`, "warning");
      this.logRaceEvent(`L${this.currentLap} Decision Twin recalculating...`, "info");
      this.logRaceEvent(`L${this.currentLap} NEW STRATEGY: SAVE + HARVEST FOR RESTART`, "green");
    }

    if (this.onRaceConditionChanged) {
      this.onRaceConditionChanged(newCondition, `RACE CONDITION: ${newCondition}`);
    }
  }

  applyWhatIfCommitment(action) {
    if (action === "ATTACK") {
      this.playerState.energy_deployment_pct = 16.5;
      this.playerState.energy_available_pct = Math.max(10, parseFloat((this.playerState.energy_available_pct - 2.8).toFixed(1)));
      this.playerState.speed = Math.min(338, this.playerState.speed + 12);
      this.playerState.opponent_gap = Math.max(0.15, parseFloat((this.playerState.opponent_gap - 0.22).toFixed(2)));
      this.logRaceEvent(`Strategy override: ATTACK committed by race engineer`, "attack");
    } else if (action === "SAVE") {
      this.playerState.energy_deployment_pct = 1.2;
      this.playerState.energy_harvest_pct = 7.5;
      this.playerState.energy_available_pct = Math.min(98, parseFloat((this.playerState.energy_available_pct + 2.5).toFixed(1)));
      this.playerState.speed = Math.max(220, this.playerState.speed - 10);
      this.logRaceEvent(`Strategy override: SAVE committed — battery regenerating`, "info");
    } else {
      this.playerState.energy_deployment_pct = 8.0;
      this.playerState.energy_harvest_pct = 4.7;
      this.logRaceEvent(`Strategy override: CONTROLLED ATTACK active`, "info");
    }
    this.recordTelemetryFrame();
  }

  logRaceEvent(text, type = "info") {
    const event = {
      lap: this.currentLap,
      time: this.raceTime,
      formattedTime: this.formatTime(this.raceTime),
      text,
      type
    };
    this.raceEvents.unshift(event);
    if (this.raceEvents.length > 30) this.raceEvents.pop();

    if (this.onRaceEventLogged) {
      this.onRaceEventLogged(event);
    }
  }

  getTargetCompetitor() {
    return this.competitors.find(c => c.isTarget) || this.competitors.find(c => c.position === this.playerPosition - 1) || this.competitors[4];
  }

  getCompetitors() {
    const trackLen = this.trackModel ? this.trackModel.circuit.length : 5891;
    const playerDist = this.playerState.track_distance;

    const list = this.competitors.map(c => {
      let gapSec = 0;
      if (c.isPlayer) {
        gapSec = 0;
      } else {
        let d = (c.distance - playerDist + trackLen) % trackLen;
        if (d > trackLen / 2) d -= trackLen;
        gapSec = parseFloat((d / Math.max(20, c.speed / 3.6)).toFixed(2));
      }

      return {
        ...c,
        gapSec,
        closingSpeed: parseFloat((this.playerState.speed - c.speed).toFixed(1))
      };
    });

    if (this.safetyCar && this.safetyCar.isActive) {
      let d = (this.safetyCar.distance - playerDist + trackLen) % trackLen;
      if (d > trackLen / 2) d -= trackLen;
      const gapSec = parseFloat((d / Math.max(20, this.safetyCar.speed / 3.6)).toFixed(2));
      list.push({
        ...this.safetyCar,
        gapSec,
        closingSpeed: parseFloat((this.playerState.speed - this.safetyCar.speed).toFixed(1))
      });
    }

    return list;
  }

  formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(3);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  getLapDecisionSummary(decisions) {
    if (!decisions || decisions.length === 0) return "HOLD";
    const hasDeploy = decisions.some(d => d.powerKw >= 200);
    if (hasDeploy) return "DEPLOY";
    const hasLow = decisions.some(d => d.powerKw > 0);
    if (hasLow) return "LOW";
    const hasWait = decisions.some(d => d.action === "WAIT");
    if (hasWait) return "WAIT";
    return "HOLD";
  }

  /**
   * Advances the race simulation over a delta time (seconds)
   */
  step(dt) {
    if (this.isPaused || this.isComplete) return;

    const scaledDt = dt * this.simSpeed;
    const trackLen = this.trackModel.circuit.length;
    const prevDist = this.playerState.track_distance;

    // 1. Current Zone & Sector Identification
    const { zone, index: zoneIdx } = this.trackModel.getZoneAtDistance(this.playerState.track_distance);
    const isNewZone = this.playerState.current_zone !== zone.name;
    this.playerState.current_zone = zone.name;
    this.playerState.zone_index = zoneIdx;

    // Sector Identification
    const { sector: activeSector, index: sectorIdx } = this.trackModel.getSectorAtDistance(this.playerState.track_distance);
    this.currentSector = sectorIdx + 1;

    // Dynamic Automated Incidents (Section 11, 12, 13, 14, 19, 29)
    if (!this.automatedIncidentsTriggered.l6Yellow && this.currentLap === 6 && this.playerState.track_distance > 1800) {
      this.automatedIncidentsTriggered.l6Yellow = true;
      this.setRaceCondition("YELLOW_S2", "INCIDENT TURN 6 BROOKLANDS");
    } else if (this.automatedIncidentsTriggered.l6Yellow && !this.automatedIncidentsTriggered.l6Restart && (this.currentLap > 6 || this.playerState.track_distance > 4200)) {
      this.automatedIncidentsTriggered.l6Restart = true;
      this.setRaceCondition("GREEN");
    } else if (!this.automatedIncidentsTriggered.l8Vsc && this.currentLap === 8 && this.playerState.track_distance > 1500) {
      this.automatedIncidentsTriggered.l8Vsc = true;
      this.setRaceCondition("VSC", "DEBRIS TURN 12 BECKETTS");
    } else if (this.automatedIncidentsTriggered.l8Vsc && !this.automatedIncidentsTriggered.l8Restart && (this.currentLap > 8 || this.playerState.track_distance > 3900)) {
      this.automatedIncidentsTriggered.l8Restart = true;
      this.setRaceCondition("GREEN");
    }

    // Safety Car Advancement along track
    if (this.safetyCar && this.safetyCar.isActive) {
      const scSpeedMs = this.safetyCar.speed / 3.6;
      this.safetyCar.distance = (this.safetyCar.distance + scSpeedMs * scaledDt) % trackLen;
    }

    // Sector Timing Checkpoints
    const curLapElapsed = this.raceTime - this.currentLapStartTime;
    const s1Boundary = this.trackModel.circuit.sectors ? this.trackModel.circuit.sectors[0].endDistance : 1480;
    const s2Boundary = this.trackModel.circuit.sectors ? this.trackModel.circuit.sectors[1].endDistance : 4760;

    if (!this.sector1Recorded && prevDist < s1Boundary && this.playerState.track_distance >= s1Boundary) {
      this.sector1Time = parseFloat(curLapElapsed.toFixed(3));
      this.sector1Recorded = true;
    } else if (!this.sector2Recorded && prevDist < s2Boundary && this.playerState.track_distance >= s2Boundary) {
      this.sector2Time = parseFloat((curLapElapsed - (this.sector1Time || 28.2)).toFixed(3));
      this.sector2Recorded = true;
    }

    // 2. Modulate Vehicle Speed by Zone Profile (Corner Entry -> Apex -> Exit)
    const zoneProgress = (this.playerState.track_distance - zone.startDistance) / Math.max(1, zone.length);
    const isBraking = zone.type === "BRAKING_HARVEST";

    if (isBraking) {
      if (zoneProgress < 0.40) {
        // Heavy Braking phase
        this.playerState.brake = zone.brakingIntensity || 0.92;
        this.playerState.throttle = 0.0;
        this.playerState.gear = 2;
        this.playerState.speed = Math.max(zone.apexSpeed, this.playerState.speed - 140 * scaledDt);
      } else {
        // Corner exit acceleration phase
        this.playerState.brake = 0.0;
        this.playerState.throttle = 0.90;
        this.playerState.gear = 4;
        this.playerState.speed = Math.min(zone.exitSpeed, this.playerState.speed + 38 * scaledDt);
      }
    } else if (zone.type === "HIGH_VALUE_ATTACK" || zone.type === "ATTACK") {
      this.playerState.brake = 0.0;
      this.playerState.throttle = 1.0;
      this.playerState.gear = 8;
      this.playerState.speed = Math.min(zone.exitSpeed, this.playerState.speed + 48 * scaledDt);
    } else if (zone.type === "ACCELERATION" || zone.type === "CORNER_EXIT") {
      this.playerState.brake = 0.0;
      this.playerState.throttle = 0.95;
      this.playerState.gear = 6;
      this.playerState.speed = Math.min(zone.exitSpeed, this.playerState.speed + 38 * scaledDt);
    } else {
      // High-speed corners (Woodcote, Copse, Maggotts, Becketts, Chapel)
      this.playerState.brake = 0.0;
      this.playerState.throttle = 0.92;
      this.playerState.gear = 6;
      this.playerState.speed = Math.min(zone.exitSpeed, this.playerState.speed + 30 * scaledDt);
    }

    // Enforce Race Condition Speed Capping on Player
    if (this.raceCondition === "VSC") {
      this.playerState.speed = Math.min(160.0, this.playerState.speed);
    } else if (this.raceCondition === "SAFETY_CAR") {
      this.playerState.speed = Math.min(135.0, this.playerState.speed);
    } else if (this.raceCondition.startsWith("YELLOW")) {
      const yellowSec = parseInt(this.raceCondition.split("_S")[1]);
      if (this.currentSector === yellowSec) {
        this.playerState.speed = Math.min(185.0, this.playerState.speed);
      }
    }

    // 3. Rolling-Horizon Energy Optimization
    this.playerState.race_condition = this.raceCondition;
    this.playerState.current_sector = this.currentSector;
    const futureWindows = this.futureEngine.generateFutureWindows(this.playerState, 4);
    const optResult = this.optimizer.optimize(this.playerState, zone, futureWindows);
    const bestControl = optResult.bestControl;
    const evalData = optResult.evaluation;

    // Power surge on deployment
    if (bestControl.powerKw > 0) {
      const deployAcc = (bestControl.powerKw / 350) * 14.0;
      this.playerState.speed = Math.min(348, this.playerState.speed + deployAcc * scaledDt);
      this.playerState.acceleration = 4.5 + deployAcc;
      this.playerState.energy_deployment_rate = bestControl.powerKw;
      this.playerState.energy_harvest_rate = 0.0;
    } else if (isBraking) {
      this.playerState.energy_harvest_rate = 240.0;
      this.playerState.energy_deployment_rate = 0.0;
    } else {
      this.playerState.energy_harvest_rate = 0.0;
      this.playerState.energy_deployment_rate = 0.0;
    }

    // Step physical energy state (Recovery & Deployment)
    const isActivelyBraking = isBraking && zoneProgress < 0.40;
    const brakeDeltaKmH = isActivelyBraking ? Math.max(50, (zone.entrySpeed || 300) - (zone.apexSpeed || 100)) : 0.0;
    this.playerState = this.energyEstimator.stepEnergyState(
      this.playerState,
      bestControl.powerKw,
      isActivelyBraking,
      brakeDeltaKmH,
      scaledDt
    );

    // Track energy usage stats
    const isDeploying = bestControl.powerKw > 0;
    if (isDeploying) {
      const depMJ = (bestControl.powerKw * 1000 * scaledDt) / 1e6;
      this.stats.totalEnergyDeployedMJ += depMJ;
    }
    if (isBraking) {
      const harvMJ = (220.0 * 1000 * scaledDt) / 1e6;
      this.stats.totalEnergyHarvestedMJ += harvMJ;
    }

    // Log decision when entering zone
    if (isNewZone) {
      const decisionLog = {
        lap: this.currentLap,
        time: this.raceTime,
        zone: zone.name,
        zoneType: zone.type,
        powerKw: bestControl.powerKw,
        duration: bestControl.duration,
        pOvertake: evalData.pOvertake,
        pCounter: evalData.pCounter,
        action: bestControl.powerKw >= 200 ? "DEPLOY" : (bestControl.powerKw > 0 ? "LOW" : (evalData.pOvertake < 0.35 ? "HOLD" : "WAIT")),
        costMJ: evalData.energyCostMJ
      };
      this.decisionTimeline.push(decisionLog);
      this.currentLapDecisions.push(decisionLog);

      if (this.onDecisionEvent && (bestControl.powerKw >= 200 || (evalData.pOvertake >= 0.70 && bestControl.powerKw === 0))) {
        this.onDecisionEvent({
          title: bestControl.powerKw >= 200 ? "OVERTAKE WINDOW DETECTED" : "TACTICAL PRESERVATION ACTIVE",
          pOvertake: evalData.pOvertake,
          pCounter: evalData.pCounter,
          action: bestControl.powerKw >= 200 ? `→ DEPLOY ${bestControl.powerKw} kW • ${bestControl.duration}s` : `→ PRESERVE ENERGY (0 kW)`
        });
      }
    }

    // 4. Advance Player Dynamics along track (d += v * dt, No Teleportation)
    const playerSpeedMs = Math.max(20, this.playerState.speed / 3.6);
    this.playerState.track_distance = (this.playerState.track_distance + playerSpeedMs * scaledDt) % trackLen;
    this.raceTime += scaledDt;
    this.playerState.time = this.raceTime;

    // 5. Check Lap Completion (Cross Start/Finish Line)
    if (this.playerState.track_distance < prevDist) {
      const totalLapTime = parseFloat((this.raceTime - this.currentLapStartTime).toFixed(3));
      const s1 = this.sector1Time || 28.204;
      const s2 = this.sector2Time || 36.841;
      const s3 = parseFloat((totalLapTime - s1 - s2).toFixed(3));

      // Build Section 35 Lap Record Data Model
      const lapRecord = {
        lap: this.currentLap,
        lapTime: totalLapTime,
        formattedLapTime: this.formatTime(totalLapTime),
        sector1: s1,
        sector2: s2,
        sector3: s3,
        positionStart: this.currentLapStartPos,
        positionEnd: this.playerPosition,
        gapStart: this.currentLapStartGap,
        gapEnd: this.playerState.opponent_gap,
        energyStart: this.currentLapStartEnergy,
        energyHarvested: parseFloat(this.playerState.energy_harvested_lap.toFixed(2)),
        energyDeployed: parseFloat(this.playerState.energy_deployed_lap.toFixed(2)),
        energyEnd: parseFloat(this.playerState.estimated_energy.toFixed(2)),
        decisions: [...this.currentLapDecisions],
        decisionSummary: this.getLapDecisionSummary(this.currentLapDecisions),
        result: this.currentLapResult,
        delta: this.lastLapTime ? parseFloat((totalLapTime - this.lastLapTime).toFixed(3)) : 0.0,
        isBestLap: !this.bestLapTime || totalLapTime < this.bestLapTime
      };

      this.lapRecords.push(lapRecord);
      this.lastDelta = lapRecord.delta;
      this.lastLapTime = totalLapTime;
      if (lapRecord.isBestLap) {
        this.bestLapTime = totalLapTime;
      }

      if (this.onLapCompleted) {
        this.onLapCompleted(lapRecord);
      }

      // Transition to next lap
      this.currentLap++;
      this.currentLapStartTime = this.raceTime;
      this.sector1Time = null;
      this.sector2Time = null;
      this.sector3Time = null;
      this.sector1Recorded = false;
      this.sector2Recorded = false;
      this.currentLapStartPos = this.playerPosition;
      this.currentLapStartGap = this.playerState.opponent_gap;
      this.currentLapStartEnergy = parseFloat(this.playerState.estimated_energy.toFixed(2));
      this.currentLapDecisions = [];
      this.currentLapResult = "STABLE";

      this.playerState.lap = this.currentLap;
      this.playerState.remaining_laps = Math.max(0, this.totalLaps - this.currentLap);
      this.playerState.energy_deployed_lap = 0.0;
      this.playerState.energy_harvested_lap = 0.0;

      if (this.currentLap > this.totalLaps) {
        this.currentLap = this.totalLaps;
        this.isComplete = true;
        this.isPaused = true;
        return;
      }
    }

    // Update Player car record in competitors
    const playerCar = this.competitors.find(c => c.isPlayer);
    if (playerCar) {
      playerCar.distance = this.playerState.track_distance;
      playerCar.speed = this.playerState.speed;
      playerCar.position = this.playerPosition;
    }

    // 6. Advance All 9 Competitors (Realistic pack movement)
    const targetCar = this.getTargetCompetitor();

    this.competitors.forEach(c => {
      if (c.isPlayer) return;

      const { zone: cZone } = this.trackModel.getZoneAtDistance(c.distance);
      const cProgress = (c.distance - cZone.startDistance) / Math.max(1, cZone.length);
      const cIsBraking = cZone.type === "BRAKING_HARVEST";

      let targetSpd = cIsBraking
        ? (cProgress < 0.40 ? cZone.apexSpeed + 2 : cZone.exitSpeed - 4)
        : (cZone.type === "HIGH_VALUE_ATTACK" || cZone.type === "ATTACK" ? cZone.exitSpeed - 3 : cZone.exitSpeed - 2);

      if (c.id === "car-1") targetSpd += 5;
      if (c.id === "car-4") targetSpd += 3;
      if (c.id === "car-63") targetSpd += 2;
      // Target car under pressure in attack straights
      if (c.isTarget && (cZone.type === "HIGH_VALUE_ATTACK" || cZone.type === "ATTACK")) {
        targetSpd -= 10;
      }

      // Regulate Competitors under Race Conditions
      if (this.raceCondition === "VSC") {
        targetSpd = Math.min(targetSpd, 160.0);
      } else if (this.raceCondition === "SAFETY_CAR") {
        targetSpd = Math.min(targetSpd, 135.0);
      } else if (this.raceCondition.startsWith("YELLOW")) {
        const ySec = parseInt(this.raceCondition.split("_S")[1]);
        const { sector: compSector } = this.trackModel.getSectorAtDistance(c.distance);
        if (compSector && (compSector.sectorNumber || 1) === ySec) {
          targetSpd = Math.min(targetSpd, 185.0);
        }
      }

      c.speed += (targetSpd - c.speed) * Math.min(1.0, 3.8 * scaledDt);
      const cSpeedMs = c.speed / 3.6;
      c.distance = (c.distance + cSpeedMs * scaledDt) % trackLen;
    });

    // 7. Tactical Gap, Relative Speed, and Overtake Physics (Sections 7, 25, 26)
    if (targetCar) {
      this.opponentSpeed = targetCar.speed;
      this.opponentDistance = targetCar.distance;

      let gapMeters = (targetCar.distance - this.playerState.track_distance + trackLen) % trackLen;
      if (gapMeters > trackLen / 2) gapMeters -= trackLen;

      const currentGap = Math.max(0.05, gapMeters / Math.max(20, targetCar.speed / 3.6));
      this.playerState.opponent_gap = parseFloat(currentGap.toFixed(2));
      this.playerState.opponent_closing_speed = parseFloat((this.playerState.speed - targetCar.speed).toFixed(1));

      const absGapDist = Math.abs(gapMeters);

      // Side-by-Side Passing Lanes (Normal Vector Offsets, Sections 6 & 25)
      if (absGapDist < 30) {
        playerCar.lateralOffset = -7.5; // Inside passing apex line
        targetCar.lateralOffset = 7.5;  // Outside defensive line
      } else {
        playerCar.lateralOffset *= 0.85;
        targetCar.lateralOffset *= 0.85;
      }

      // Check Physical Overtake Execution (Sections 7, 25)
      const isAttackZone = zone.type === "HIGH_VALUE_ATTACK" || zone.type === "ATTACK";
      const hasSurgingPower = bestControl.powerKw >= 200;
      const yellowSec = this.raceCondition.startsWith("YELLOW") ? parseInt(this.raceCondition.split("_S")[1]) : null;
      const canOvertake = this.raceCondition === "GREEN" || (this.raceCondition.startsWith("YELLOW") && this.currentSector !== yellowSec);

      if (canOvertake && (gapMeters <= 0 || (hasSurgingPower && isAttackZone && absGapDist < 16)) && evalData.pOvertake >= 0.65) {
        const prevPlayerPos = this.playerPosition;
        const targetPos = targetCar.position;

        if (this.playerPosition > targetPos) {
          this.playerPosition = targetPos;
          this.playerState.race_position = this.playerPosition;
          targetCar.position = prevPlayerPos;
          targetCar.isTarget = false;
          targetCar.color = "#8b949e"; // Overtaken car becomes sleek gray
          this.stats.playerOvertakes++;
          this.currentLapResult = `OVERTAKE P${prevPlayerPos}→P${this.playerPosition}`;

          this.logRaceEvent(`L${this.currentLap} OVERTAKE P${prevPlayerPos}→P${this.playerPosition}`, "overtake");

          // Promote next car ahead to yellow target
          const nextTarget = this.competitors.find(c => !c.isPlayer && c.position === this.playerPosition - 1);
          if (nextTarget) {
            nextTarget.isTarget = true;
            nextTarget.color = "#ffb800"; // Yellow Target
          }

          if (this.onOvertake) {
            this.onOvertake({
              fromPos: prevPlayerPos,
              toPos: this.playerPosition,
              overtakenCar: targetCar
            });
          }
        }
      } else if (evalData.pCounter >= 0.40 && absGapDist < 15) {
        this.stats.playerCounterEvents++;
        this.stats.totalEnergyWastedMJ += 0.35;
        this.currentLapResult = "COUNTER DEFENSE";
        if (this.onCounterEvent) {
          this.onCounterEvent({
            position: this.playerPosition,
            targetCar
          });
        }
      }
    }

    // 8. Record Telemetry History Frame
    this.recordTelemetryFrame();
  }

  recordTelemetryFrame() {
    const targetCar = this.getTargetCompetitor();
    const frame = {
      stepIndex: this.currentStepIndex++,
      raceTime: this.raceTime,
      lap: this.currentLap,
      playerDistance: this.playerState.track_distance,
      playerSpeed: this.playerState.speed,
      playerPosition: this.playerPosition,
      opponentDistance: targetCar ? targetCar.distance : 0,
      opponentSpeed: targetCar ? targetCar.speed : 280,
      opponentGap: this.playerState.opponent_gap,
      closingSpeed: this.playerState.opponent_closing_speed,
      energyMJ: this.playerState.estimated_energy,
      soc: this.playerState.estimated_SOC,
      currentZone: this.playerState.current_zone,
      competitors: this.competitors.map(c => ({ ...c }))
    };

    this.telemetryHistory.push(frame);
    if (this.telemetryHistory.length > 3000) {
      this.telemetryHistory.shift();
    }
  }

  seekReplay(index) {
    if (index < 0 || index >= this.telemetryHistory.length) return null;
    const frame = this.telemetryHistory[index];
    this.playerState.track_distance = frame.playerDistance;
    this.playerState.speed = frame.playerSpeed;
    this.playerState.lap = frame.lap;
    this.playerState.estimated_energy = frame.energyMJ;
    this.playerState.opponent_gap = frame.opponentGap;
    this.playerState.opponent_closing_speed = frame.closingSpeed;
    this.playerState.current_zone = frame.currentZone;
    this.playerPosition = frame.playerPosition;

    if (frame.competitors) {
      this.competitors = frame.competitors.map(c => ({ ...c }));
    }

    this.isReplaying = true;
    return frame;
  }
}
