/**
 * TRACKSHIFT — F1 2026 Energy & Overtake Digital Twin
 * Central Reactive State Store
 *
 * Single source of truth for the map-free simulation control panel
 * and animated race visualization.
 */

export const INITIAL_TWIN_STATE = {
  // --- Session Telemetry ---
  lap: 24,
  totalLaps: 57,
  ruleProfileName: "2026 FIA HYBRID V1.4",
  simulationMode: "IDLE", // IDLE, RUNNING, PAUSED, FINISHED
  speedMultiplier: 1, // 1x, 2x, 5x

  // --- Left Panel Inputs: Race State ---
  soc: 62, // Battery SOC (0–100%)
  batteryCapacity: 4.00, // Total usable buffer in MJ
  availableEnergy: 2.48, // (soc / 100) * batteryCapacity in MJ
  gap: 0.80, // Opponent Gap (0.2–3.0 s)
  closingSpeed: 8.0, // Closing speed (-5 to +15 km/h)
  deploymentPower: 280, // Electrical deployment (0–350 kW)
  recoveryPotential: 72, // Energy recovery potential (0–100%)

  // --- Constraint Severity (Levels 1–5) ---
  constraintLevel: 2, // 1: LOW, 2: MODERATE, 3: HIGH, 4: CRITICAL, 5: EXTREME

  // --- Active Scenario ---
  activeScenarioId: "SCENARIO_01",
  activeScenarioName: "ATTACK WINDOW",

  // --- Car Telemetry & Positions ---
  userCar: {
    driver: "YOU",
    number: 44,
    position: 2, // P2
    speed: 324, // km/h
    throttle: 100, // %
    mguKState: "DEPLOYING", // DEPLOYING, HARVESTING, IDLE
    xProgress: 35, // 0..100% along the drag strip
    yLane: 0 // 0: baseline, -1: inside dive, 1: outside
  },
  opponentCar: {
    driver: "LEC",
    number: 16,
    position: 1, // P1
    speed: 316, // km/h
    throttle: 98,
    xProgress: 68,
    yLane: 0
  },

  // --- Strategy Selection ---
  selectedStrategy: "WAIT", // ATTACK, WAIT, SAVE, RECOVER, DEFEND

  // --- Energy Delta Tracking ---
  deployedEnergy: 0.0, // MJ deployed in current run
  recoveredEnergy: 0.0, // MJ recovered in current run
  netEnergy: 0.0, // recovered - deployed (MJ)
  targetDeployEnergy: 1.80, // MJ needed for full attack
  targetRecoverEnergy: 0.70, // MJ expected in braking zone

  // --- 2026 Rule Validation ---
  ruleStatus: "LEGAL", // LEGAL, WARNING, VIOLATION
  ruleViolationMessage: "",
  recommendedLegalPower: 280,

  // --- Dynamic Decision & Opportunity Cost ---
  recommendation: {
    action: "WAIT",
    title: "PRESERVE FOR NEXT STRATEGIC WINDOW",
    rationale: "Save 1.2 MJ for the next high-value attack window.",
    overtakeProb: 63,
    futureProb: 84,
    energyRisk: "LOW",
    confidence: 87,
    opportunityCostStatement: "Using 1.8 MJ now increases immediate overtake probability by 17%, but reduces the probability of successfully defending the next attack window by 21%."
  },

  // --- Animated Timeline (00s -> 30s) ---
  timelineStageIndex: 0,
  timelineProgressSec: 0.0, // 0.0 to 30.0s
  overtakeResult: null // "SUCCESS", "FAILED", null
};

class TwinStore {
  constructor() {
    this.state = { ...INITIAL_TWIN_STATE };
    this.subscribers = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    for (const listener of this.subscribers) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("TwinStore subscriber error:", err);
      }
    }
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };

    // Auto-update Available Energy whenever SOC or batteryCapacity changes
    if (partial.soc !== undefined || partial.batteryCapacity !== undefined) {
      const cap = this.state.batteryCapacity ?? 4.00;
      const soc = this.state.soc ?? 62;
      this.state.availableEnergy = Math.round(((soc / 100) * cap) * 100) / 100;
    }

    this.notify();
  }

  reset() {
    this.setState({
      ...INITIAL_TWIN_STATE,
      simulationMode: "IDLE",
      timelineStageIndex: 0,
      timelineProgressSec: 0.0,
      overtakeResult: null,
      deployedEnergy: 0.0,
      recoveredEnergy: 0.0,
      netEnergy: 0.0,
      userCar: { ...INITIAL_TWIN_STATE.userCar },
      opponentCar: { ...INITIAL_TWIN_STATE.opponentCar }
    });
  }
}

export const twinStore = new TwinStore();
