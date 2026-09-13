/**
 * TRACKSHIFT — Dynamic Simulation & Physics Engine
 *
 * Implements:
 *   - Continuous dynamic energy equation: E_next = E_current - E_deployed + E_harvested - E_losses
 *   - Live car progression, gap dynamics, closing speed
 *   - Automatic candidate optimization on every tick
 *   - Incident triggers (Yellow Flag, VSC, Safety Car, Clear)
 *   - Automated Section 23 demonstration sequence
 */

import { raceStore } from "../state/raceState.js";
import { getSegmentAtNormalizedDist } from "../track/trackSegments.js";
import { getSectorForProgress } from "../track/sectors.js";
import { RulesEngine } from "./rulesEngine.js";
import { CandidateOptimizer } from "./candidateOptimizer.js";

export class RaceEngine {
  constructor() {
    this.store = raceStore;
    this.timerId = null;
    this.isPlaying = false;
    this.speedMultiplier = 1;
    this.lastTickTime = Date.now();
    this.demoStep = 0;
    this.demoTimer = null;
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTickTime = Date.now();
    this.timerId = setInterval(() => this.tick(), 50); // 20 Hz
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setSpeed(mult) {
    this.speedMultiplier = mult;
  }

  reset() {
    this.stop();
    this.stopDemo();
    this.store.reset();
    this.recalculate();
  }

  stepLap() {
    const s = this.store.getState();
    const nextLap = Math.min(s.totalLaps, s.lap + 1);
    this.store.setState({
      lap: nextLap,
      trackProgress: 0.74 // Canonical Hangar Straight location
    });
    this.store.addEvent(`L${nextLap}`, `Lap ${nextLap} commenced (+1 LAP step)`, "info");
    this.recalculate();
  }

  // -------------------------------------------------------------
  // SIMULATION TICK
  // -------------------------------------------------------------
  tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    const s = this.store.getState();
    const isSafetyCar = s.safetyCar || s.raceControl === "SAFETY_CAR";
    const isVSC = s.vsc || s.raceControl === "VSC";
    const isYellow = s.raceControl === "YELLOW" || s.raceControl === "YELLOW_S2";

    // Track progression: 5,891m circuit
    let baseSpeed = 318;
    if (isSafetyCar) baseSpeed = 135;
    else if (isVSC) baseSpeed = 205;
    else if (isYellow && s.currentSector === 2) baseSpeed = 225;

    const stepMeters = (baseSpeed / 3.6) * dt * this.speedMultiplier;
    let newProgress = (s.trackProgress + (stepMeters / 5891)) % 1.0;

    let newLap = s.lap;
    if (newProgress < s.trackProgress) {
      newLap = Math.min(s.totalLaps, s.lap + 1);
      this.store.addEvent(`L${newLap}`, `Lap ${newLap}/${s.totalLaps} completed`, "info");
    }

    const currentSectorData = getSectorForProgress(newProgress);
    const currentSegment = getSegmentAtNormalizedDist(newProgress);
    const isStraight = currentSegment.type === "straight";

    // Telemetry dynamics
    const speed = isSafetyCar ? 135 : isVSC ? 205 : isStraight ? 318 : 145;
    const throttle = isSafetyCar ? 40 : isStraight ? 97 : 55;

    // -------------------------------------------------------------
    // DYNAMIC ENERGY EQUATION (Section 4)
    // E_next = E_current - E_deployed + E_harvested - E_losses
    // -------------------------------------------------------------
    let eCurrent = s.currentEnergy ?? 2.84;
    let eDeployed = 0;
    let eHarvested = 0;
    const eLosses = 0.0005 * dt * this.speedMultiplier;

    if (s.decision?.action === "DEPLOY" && isStraight && !isSafetyCar && !isVSC && !isYellow) {
      // Deploying ~286 kW
      eDeployed = (286 * dt * this.speedMultiplier) / 1000 * 0.25;
    } else if (!isStraight || isSafetyCar || isVSC) {
      // Braking zone regeneration: MGU-K harvesting
      eHarvested = (220 * dt * this.speedMultiplier) / 1000 * 0.15;
    }

    let eNext = Math.min(4.0, Math.max(0.6, eCurrent - eDeployed + eHarvested - eLosses));

    // Dynamic gap & closing speed
    let gap = s.gapAhead ?? 0.72;
    let closing = s.closingSpeed ?? 6.8;

    if (eDeployed > 0) {
      gap = Math.max(0.18, gap - (0.015 * dt * this.speedMultiplier));
      closing = 7.2;
    } else if (eHarvested > 0) {
      gap = Math.min(1.4, gap + (0.005 * dt * this.speedMultiplier));
      closing = 4.1;
    }

    // Move cars along circuit
    const updatedCars = (s.cars || []).map(car => {
      if (car.isPlayer) {
        return { ...car, prog: newProgress };
      }
      return { ...car, prog: (car.prog + (stepMeters / 5891)) % 1.0 };
    });

    this.store.setState({
      lap: newLap,
      trackProgress: newProgress,
      speed,
      throttle,
      currentSector: currentSectorData.number,
      currentSegment: currentSegment.id,
      currentSegmentName: currentSegment.name,
      strategicZoneType: isStraight ? "OVERTAKE ZONE" : "CHASSIS RECOVERY",
      currentEnergy: Math.round(eNext * 100) / 100,
      harvestedEnergy: Math.round((s.harvestedEnergy + eHarvested) * 100) / 100,
      deployedEnergy: Math.round((s.deployedEnergy + eDeployed) * 100) / 100,
      gapAhead: Math.round(gap * 100) / 100,
      closingSpeed: closing,
      cars: updatedCars
    });

    this.recalculate();
  }

  // -------------------------------------------------------------
  // RECALCULATE OPTIMIZATION & CONSTRAINTS
  // -------------------------------------------------------------
  recalculate() {
    const s = this.store.getState();
    const currentSegment = getSegmentAtNormalizedDist(s.trackProgress);

    // Run Candidate Optimizer (Sections 9, 10, 12, 13, 14)
    const optResult = CandidateOptimizer.evaluateCandidates(s, currentSegment);
    const best = optResult.selected;

    const overtakeProb = CandidateOptimizer.calculateOvertakeProbability(s, currentSegment);
    const counterRisk = CandidateOptimizer.calculateCounterRisk(s, best.powerKw);

    const isSafetyCar = s.safetyCar || s.raceControl === "SAFETY_CAR";
    const isVSC = s.vsc || s.raceControl === "VSC";
    const isYellow = s.raceControl === "YELLOW" || s.raceControl === "YELLOW_S2";

    let actionLabel = "DEPLOY";
    let why = "Best feasible balance under constraints.";

    if (isSafetyCar) {
      actionLabel = "SUSPENDED (SC)";
      why = "Safety Car neutral: Overtaking prohibited by FIA regulations.";
    } else if (isYellow) {
      actionLabel = "WAIT / REGEN";
      why = "Yellow Flag Sector 2: Overtaking invalid, hold position and harvest.";
    } else if (isVSC) {
      actionLabel = "MAINTAIN DELTA";
      why = "VSC active: Maintain positive delta time and recharge Energy Store.";
    } else if (best.powerKw === 0) {
      actionLabel = "CONSERVE";
      why = "Sub-optimal sector for pass. Preserving battery reserve for next straight.";
    } else {
      actionLabel = "DEPLOY";
      why = `Optimal deployment: ${best.powerKw} kW for ${best.duration}s balances high overtake (${best.overtakeProb}%) with protected reserve.`;
    }

    this.store.setState({
      overtakeProbability: overtakeProb,
      counterRisk: counterRisk,
      candidateActions: optResult.candidates,
      decision: {
        action: actionLabel,
        powerKw: best.powerKw,
        duration: best.duration,
        label: best.powerKw > 0 ? `DEPLOY ${best.powerKw} kW (${best.duration}s)` : "HOLD / REGEN",
        overtakeProb: Math.round(overtakeProb * 100),
        counterRisk: Math.round(counterRisk * 100),
        why,
        status: best.feasible ? "FEASIBLE" : "RESTRICTED",
        constraintAvoided: optResult.constraintAvoided
      }
    });
  }

  // -------------------------------------------------------------
  // INCIDENT CONTROLS (Section 17)
  // -------------------------------------------------------------
  triggerYellow(sector = 2) {
    this.store.setState({
      raceControl: "YELLOW_S2",
      yellowSector: sector,
      vsc: false,
      safetyCar: false
    });
    this.store.addEvent(`L${this.store.getState().lap}`, `YELLOW FLAG SECTOR ${sector} — Previous deployment cancelled`, "caution");
    this.recalculate();
  }

  triggerVSC() {
    this.store.setState({
      raceControl: "VSC",
      vsc: true,
      safetyCar: false,
      yellowSector: null
    });
    this.store.addEvent(`L${this.store.getState().lap}`, `VSC DEPLOYED — Neutralized pace, kinetic harvest active`, "caution");
    this.recalculate();
  }

  triggerSafetyCar() {
    this.store.setState({
      raceControl: "SAFETY_CAR",
      safetyCar: true,
      vsc: false,
      yellowSector: null
    });
    this.store.addEvent(`L${this.store.getState().lap}`, `SAFETY CAR DEPLOYED — Pack compressed, overtaking suspended`, "caution");
    this.recalculate();
  }

  clearIncidents() {
    this.store.setState({
      raceControl: "GREEN",
      safetyCar: false,
      vsc: false,
      yellowSector: null
    });
    this.store.addEvent(`L${this.store.getState().lap}`, `GREEN FLAG — Track clear, full ERS deployment re-authorized`, "green");
    this.recalculate();
  }

  // -------------------------------------------------------------
  // APPLY SELECTED ACTION MANUALLY (FROM DRAWER OR HUD)
  // -------------------------------------------------------------
  applyCandidateAction(actionId) {
    const s = this.store.getState();
    const cand = (s.candidateActions || []).find(c => c.id === actionId);
    if (!cand) return;

    if (!cand.feasible) {
      this.store.addEvent(`L${s.lap}`, `ACTION BLOCKED: ${cand.constraintNote}`, "caution");
      return;
    }

    const energyCost = (cand.powerKw * cand.duration) / 1000;
    const newEnergy = Math.max(0.6, s.currentEnergy - energyCost);
    const newGap = cand.powerKw >= 250 ? Math.max(0.22, s.gapAhead - 0.28) : s.gapAhead;

    let newPos = s.position;
    let newTarget = s.targetPosition;

    if (newGap <= 0.25 && s.position === 6) {
      newPos = 5;
      newTarget = 4;
      this.store.addEvent(`L${s.lap}`, `OVERTAKE SUCCESSFUL: P6 → P5! Passed ${s.targetDriver} into Stowe`, "green");
    } else {
      this.store.addEvent(`L${s.lap}`, `COMMITTED: ${cand.label} (-${energyCost.toFixed(2)} MJ ERS)`, "green");
    }

    this.store.setState({
      currentEnergy: Math.round(newEnergy * 100) / 100,
      deployedEnergy: Math.round((s.deployedEnergy + energyCost) * 100) / 100,
      gapAhead: Math.round(newGap * 100) / 100,
      position: newPos,
      targetPosition: newTarget
    });

    this.recalculate();
  }

  // -------------------------------------------------------------
  // SECTION 23 DEMONSTRATION SEQUENCE
  // -------------------------------------------------------------
  runDemo() {
    this.stopDemo();
    this.demoStep = 0;
    this.start();

    const sequence = [
      // 1. Approaching Hangar Straight, gap 0.72s, DEPLOY 286 kW
      () => {
        this.clearIncidents();
        this.store.setState({
          lap: 38,
          trackProgress: 0.74,
          gapAhead: 0.72,
          currentEnergy: 2.84,
          closingSpeed: 6.8
        });
        this.store.addEvent("L38", "DEMO 1/5: Approaching Hangar Straight — Gap 0.72s, ERS 2.84 MJ", "green");
      },
      // 2. Deploy active -> Gap drops to 0.28s, ERS 2.32 MJ
      () => {
        this.store.setState({
          gapAhead: 0.28,
          currentEnergy: 2.32,
          closingSpeed: 9.4
        });
        this.store.addEvent("L38", "DEMO 2/5: 286 kW Deployed — ERS: 2.84 → 2.32 MJ, Gap: 0.72 → 0.28s", "green");
      },
      // 3. Incident occurs: Yellow Sector 2 -> Previous decision cancelled, WAIT / REGEN
      () => {
        this.triggerYellow(2);
        this.store.addEvent("L39", "DEMO 3/5: YELLOW FLAG S2 — Previous decision cancelled, switched to WAIT", "caution");
      },
      // 4. Track clear -> Recalculate
      () => {
        this.clearIncidents();
        this.store.setState({
          currentEnergy: 2.63,
          gapAhead: 0.55,
          closingSpeed: 5.2
        });
        this.store.addEvent("L40", "DEMO 4/5: GREEN FLAG — Kinetic energy harvested: 2.32 → 2.63 MJ", "green");
      },
      // 5. Overtake completed P6 -> P5
      () => {
        this.store.setState({
          position: 5,
          targetPosition: 4,
          gapAhead: 1.15
        });
        this.store.addEvent("L40", "DEMO 5/5: OVERTAKE COMPLETED! P6 → P5!", "green");
      }
    ];

    const stepInterval = 3400; // 3.4s per step
    const executeNext = () => {
      if (this.demoStep < sequence.length) {
        sequence[this.demoStep]();
        this.demoStep++;
        this.demoTimer = setTimeout(executeNext, stepInterval);
      } else {
        this.stopDemo();
      }
    };

    executeNext();
  }

  stopDemo() {
    if (this.demoTimer) {
      clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
  }
}

export const raceEngine = new RaceEngine();
