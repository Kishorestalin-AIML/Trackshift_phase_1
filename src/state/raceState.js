/**
 * TRACKSHIFT — Central Digital Twin State
 * Single Source of Truth for the Map-First F1 Race Decision Digital Twin
 */

export const INITIAL_RACE_STATE = {
  // --- Race Session ---
  lap: 38,
  totalLaps: 52,
  lapTime: "1:30.982",
  bestLap: "1:30.982",
  delta: "+0.184",

  // --- Positions & Tactical Delta ---
  position: 6, // P6
  targetPosition: 5, // P5
  targetDriver: "LEC",
  targetNumber: 16,
  playerDriver: "YOU",
  playerNumber: 44,
  carBehindDriver: "SAI",
  carBehindNumber: 55,

  gapAhead: 0.72, // 0.72s
  gapBehind: 1.84, // 1.84s
  closingSpeed: 6.8, // +6.8 km/h closing rate on target
  speed: 318, // km/h
  throttle: 97, // %

  // --- Silverstone Track Location ---
  currentSector: 3,
  currentSegment: "HANGAR_STRAIGHT",
  currentSegmentName: "Hangar Straight",
  strategicZoneType: "OVERTAKE ZONE",
  trackProgress: 0.74, // 0..1 around Silverstone GP circuit

  // --- Dynamic Energy Model (MJ units - Section 4) ---
  currentEnergy: 2.84, // 2.84 MJ usable ERS
  maxEnergyCapacity: 4.00, // 4.00 MJ total buffer
  energyReserve: 1.20, // 1.20 MJ protective reserve floor
  harvestedEnergy: 0.31, // +0.31 MJ recovered
  deployedEnergy: 0.52, // -0.52 MJ deployed this zone
  energyLosses: 0.04, // Thermal and transmission loss
  harvestEfficiency: 0.78, // 78% MGU-K regen efficiency
  deploymentDuration: 1.8, // seconds

  // --- Strategic Probabilities (Sections 6, 7, 8) ---
  overtakeProbability: 0.84, // 84%
  counterRisk: 0.19, // 19%
  futureOpportunity: {
    zone: "Stowe",
    distanceSec: 18.2,
    probability: 0.91,
    energyCost: 1.15
  },

  // --- Active Decision (Sections 1, 3, 15) ---
  decision: {
    action: "DEPLOY",
    powerKw: 286,
    duration: 1.8,
    label: "DEPLOY 286 kW (1.8s)",
    overtakeProb: 84,
    counterRisk: 19,
    why: "Best feasible balance under constraints.",
    status: "FEASIBLE",
    constraintAvoided: "Reduced deployment from 350 kW → 286 kW. Energy reserve protected, future opportunity preserved."
  },

  // --- Evaluated Candidate Actions (Sections 9, 10, 14, 20) ---
  candidateActions: [
    {
      id: "0kw",
      powerKw: 0,
      duration: 2.0,
      label: "0 kW × 2.0s",
      type: "MAINTAIN",
      overtakeProb: 21,
      counterRisk: 4,
      energyCost: "LOW (+0.12 MJ)",
      futureOpp: "HIGH",
      score: 0.42,
      feasible: true,
      selected: false,
      constraintNote: "Feasible — Full energy preservation"
    },
    {
      id: "180kw",
      powerKw: 180,
      duration: 2.0,
      label: "180 kW × 2.0s",
      type: "MODERATE",
      overtakeProb: 61,
      counterRisk: 9,
      energyCost: "MED (-0.36 MJ)",
      futureOpp: "HIGH",
      score: 0.71,
      feasible: true,
      selected: false,
      constraintNote: "Feasible — Safe delta reduction"
    },
    {
      id: "286kw",
      powerKw: 286,
      duration: 1.8,
      label: "286 kW × 1.8s",
      type: "OPTIMAL",
      overtakeProb: 84,
      counterRisk: 19,
      energyCost: "MED (-0.51 MJ)",
      futureOpp: "MED",
      score: 0.86,
      feasible: true,
      selected: true,
      constraintNote: "Feasible — Optimal race value balance"
    },
    {
      id: "350kw",
      powerKw: 350,
      duration: 1.5,
      label: "350 kW × 1.5s",
      type: "MAX_OVERRIDE",
      overtakeProb: 88,
      counterRisk: 31,
      energyCost: "HIGH (-0.53 MJ)",
      futureOpp: "LOW",
      score: 0.64,
      feasible: false,
      selected: false,
      constraintNote: "✕ ENERGY RESERVE: Would reduce reserve below 1.20 MJ floor for Stowe"
    }
  ],

  // --- Race Conditions (Section 17) ---
  raceControl: "GREEN", // GREEN, YELLOW_S2, VSC, SAFETY_CAR
  yellowSector: null,
  vsc: false,
  safetyCar: false,

  // --- Cars On Track ---
  cars: [
    { id: "p1", pos: 1, name: "VER", number: 1, prog: 0.90, isPlayer: false },
    { id: "p2", pos: 2, name: "NOR", number: 4, prog: 0.84, isPlayer: false },
    { id: "p5", pos: 5, name: "LEC", number: 16, prog: 0.76, isPlayer: false, isTarget: true },
    { id: "p6", pos: 6, name: "YOU", number: 44, prog: 0.74, isPlayer: true },
    { id: "p7", pos: 7, name: "SAI", number: 55, prog: 0.67, isPlayer: false, isBehind: true },
    { id: "p8", pos: 8, name: "RUS", number: 63, prog: 0.58, isPlayer: false }
  ],

  // --- UI Drawers & Modals ---
  isDecisionDrawerOpen: false,
  isSettingsDrawerOpen: false,
  isLapRecordsOpen: false,

  // --- Lap Records History (Section 21) ---
  lapRecords: [
    { lap: 35, lapTime: "1:31.420", s1: "28.310", s2: "37.110", s3: "26.000", energyEnd: "2.71 MJ", isBest: false },
    { lap: 36, lapTime: "1:31.104", s1: "28.180", s2: "36.950", s3: "25.974", energyEnd: "2.68 MJ", isBest: false },
    { lap: 37, lapTime: "1:31.284", s1: "28.210", s2: "37.020", s3: "26.054", energyEnd: "2.78 MJ", isBest: false },
    { lap: 38, lapTime: "1:30.982", s1: "28.050", s2: "36.880", s3: "26.052", energyEnd: "2.84 MJ", isBest: true }
  ],

  // --- Events Feed ---
  events: [
    { lap: "L38", text: "TrackShift: Selected DEPLOY 286 kW (1.8s) for Hangar Straight", type: "green" },
    { lap: "L38", text: "Target gap closing: 0.72s at +6.8 km/h", type: "info" },
    { lap: "L38", text: "Green flag conditions — Full ERS deployment permitted", type: "info" }
  ]
};

export class RaceStore {
  constructor() {
    this.state = JSON.parse(JSON.stringify(INITIAL_RACE_STATE));
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  reset() {
    this.state = JSON.parse(JSON.stringify(INITIAL_RACE_STATE));
    this.notify();
  }

  addEvent(lap, text, type = "info") {
    const newEvent = { lap, text, type, timestamp: Date.now() };
    this.state.events = [newEvent, ...this.state.events.slice(0, 15)];
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Error in RaceStore listener:", err);
      }
    }
  }
}

export const raceStore = new RaceStore();
