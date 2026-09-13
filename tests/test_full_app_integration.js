/**
 * TRACKSHIFT — Map-First Digital Twin Integration Test Suite
 *
 * Verifies:
 *   - Silverstone track layout, 3 sectors, 15 corners, 3 straights, dynamic S2 yellow
 *   - Central raceState with MJ-based energy model, closing rate, candidate actions
 *   - Candidate action optimization (0 kW, 100 kW, 180 kW, 250 kW, 286 kW, 350 kW)
 *   - 2026 FIA rules & constraint filtering (350 kW key zone / 250 kW other, reserve floor)
 *   - Rejection explanations and constraint recovery
 *   - Incidents: Yellow flag S2, VSC, Safety Car
 *   - Clean map DOM elements, HUD anchors, slide-out drawers, and controls
 *   - 100vh viewport-locked CSS
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { INITIAL_RACE_STATE } from "../src/state/raceState.js";
import { SILVERSTONE_CIRCUIT } from "../src/track/silverstone.js";
import { TRACK_SEGMENTS } from "../src/track/trackSegments.js";
import { SECTORS, getSectorColor } from "../src/track/sectors.js";
import { RulesEngine, RULES_2026 } from "../src/engine/rulesEngine.js";
import { CandidateOptimizer } from "../src/engine/candidateOptimizer.js";
import { RaceEngine } from "../src/engine/raceEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const htmlContent = fs.readFileSync(path.join(projectRoot, "index.html"), "utf-8");
const cssContent = fs.readFileSync(path.join(projectRoot, "styles/trackshift.css"), "utf-8");
const appJsContent = fs.readFileSync(path.join(projectRoot, "src/ui/App.js"), "utf-8");

console.log("\n=======================================================");
console.log("=== AUDITING TRACKSHIFT MAP-FIRST DIGITAL TWIN      ===");
console.log("=======================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. TRACK & CIRCUIT INTEGRATION (Sections 2 & 17)
// -------------------------------------------------------------
console.log("[1] Track Model & Silverstone Verification...");
assert(SILVERSTONE_CIRCUIT.lengthMeters === 5891, "Silverstone track length is 5,891 meters");
assert(SECTORS[1] && SECTORS[2] && SECTORS[3], "3 distinct physical sectors defined (S1, S2, S3)");

// Check corners
const cornerNames = [
  "Abbey", "Farm Curve", "Village", "The Loop", "Aintree",
  "Brooklands", "Luffield", "Woodcote", "Copse", "Maggotts",
  "Becketts", "Chapel", "Stowe", "Vale", "Club"
];
cornerNames.forEach(cName => {
  const found = TRACK_SEGMENTS.find(s => s.name.toLowerCase().includes(cName.toLowerCase()));
  assert(!!found, `Track contains corner: ${cName}`);
});

// Check straights
const straightNames = ["Hamilton Straight", "Wellington Straight", "Hangar Straight"];
straightNames.forEach(sName => {
  const found = TRACK_SEGMENTS.find(s => s.name.toLowerCase().includes(sName.toLowerCase()));
  assert(!!found, `Track contains straight: ${sName}`);
});

// Check physical sector color change when S2 is yellow
const s2GreenColor = getSectorColor(2, "GREEN", null);
const s2YellowColor = getSectorColor(2, "YELLOW_S2", 2);
assert(s2GreenColor !== s2YellowColor, "S2 color dynamically changes between GREEN and YELLOW");
assert(s2YellowColor === "#ffd700", `S2 yellow color is #ffd700 (got ${s2YellowColor})`);

// -------------------------------------------------------------
// 2. CENTRAL RACE STATE & DYNAMIC ENERGY MODEL (Section 4)
// -------------------------------------------------------------
console.log("\n[2] Central raceState & Dynamic Energy Model Verification...");
assert(INITIAL_RACE_STATE.lap === 38, "Canonical lap is 38");
assert(INITIAL_RACE_STATE.position === 6, "Player starts at P6");
assert(INITIAL_RACE_STATE.targetPosition === 5, "Target opponent is P5");
assert(INITIAL_RACE_STATE.gapAhead === 0.72, "Gap ahead is 0.72 s");
assert(INITIAL_RACE_STATE.closingSpeed === 6.8, "Closing speed is +6.8 km/h");
assert(INITIAL_RACE_STATE.currentEnergy === 2.84, "Current ERS energy is 2.84 MJ");
assert(INITIAL_RACE_STATE.energyReserve === 1.20, "Energy reserve floor is 1.20 MJ");
assert(INITIAL_RACE_STATE.currentSegment === "HANGAR_STRAIGHT", "Current segment is Hangar Straight");

// -------------------------------------------------------------
// 3. CANDIDATE ACTION OPTIMIZER & CONSTRAINTS (Sections 9–14)
// -------------------------------------------------------------
console.log("\n[3] Candidate Action Optimizer & 2026 Constraints Verification...");
const optResult = CandidateOptimizer.evaluateCandidates(INITIAL_RACE_STATE, null);
assert(optResult.candidates.length >= 5, `Generated ${optResult.candidates.length} candidate actions (0kW, 100kW, 180kW, 250kW, 286kW, 350kW)`);

const action286 = optResult.candidates.find(c => c.powerKw === 286);
const action350 = optResult.candidates.find(c => c.powerKw === 350);
const action0 = optResult.candidates.find(c => c.powerKw === 0);

assert(action286 && action286.feasible === true, "286 kW candidate is FEASIBLE");
assert(optResult.selected.powerKw === 286, `Optimizer selected 286 kW as best feasible action (got ${optResult.selected.powerKw} kW)`);
assert(action0 && action0.feasible === true, "0 kW candidate is FEASIBLE");

// Verify constraint rejection of 350 kW due to energy reserve
assert(action350 && action350.feasible === false, "350 kW candidate is REJECTED by constraint filter");
assert(action350.constraintNote.includes("ENERGY RESERVE"), "350 kW rejection explicitly explains Energy Reserve constraint");

// Verify constraint overcome / recovery narrative (Section 13)
assert(optResult.constraintAvoided.includes("350 kW → 286 kW"), "Constraint avoided narrative explains reduction from 350 kW to 286 kW");

// -------------------------------------------------------------
// 4. INCIDENT RECALCULATION & SUSPENSION (Sections 10, 16, 17)
// -------------------------------------------------------------
console.log("\n[4] Race Interruption & Incident Recalculation Verification...");
const yellowState = {
  ...INITIAL_RACE_STATE,
  raceControl: "YELLOW_S2",
  yellowSector: 2,
  currentSector: 2
};
const yellowOpt = CandidateOptimizer.evaluateCandidates(yellowState, null);
assert(yellowOpt.selected.powerKw === 0, `Yellow flag forces selection of 0 kW Maintain/Harvest (got ${yellowOpt.selected.powerKw} kW)`);
assert(yellowOpt.candidates.find(c => c.powerKw === 286).feasible === false, "286 kW is SUSPENDED under yellow flag");

const scState = {
  ...INITIAL_RACE_STATE,
  raceControl: "SAFETY_CAR",
  safetyCar: true
};
const scOpt = CandidateOptimizer.evaluateCandidates(scState, null);
assert(scOpt.selected.powerKw === 0, "Safety Car forces 0 kW harvesting pace");
assert(scOpt.candidates.find(c => c.powerKw === 286).feasible === false, "Deployment is SUSPENDED under Safety Car");

// -------------------------------------------------------------
// 5. DOM STRUCTURE & MAP-FIRST ELEMENTS AUDIT (Sections 2, 3, 20)
// -------------------------------------------------------------
console.log("\n[5] DOM Elements & Interactive Controls Audit...");
const requiredIds = [
  "mount-map-stage",
  "mount-decision-drawer",
  "mount-settings-drawer",
  "mount-records-modal",
  "btn-header-view-decision",
  "btn-header-settings",
  "btn-play",
  "btn-pause",
  "btn-reset",
  "btn-step-lap",
  "btn-speed-1",
  "btn-speed-2",
  "btn-speed-5",
  "btn-rc-yellow",
  "btn-rc-vsc",
  "btn-rc-sc",
  "btn-rc-clear",
  "btn-auto-demo",
  "btn-lap-record-pill"
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML contains mandatory element #${id}`);
});

// -------------------------------------------------------------
// 6. VIEWPORT LOCK & MAP-FIRST STYLING AUDIT (Section 2)
// -------------------------------------------------------------
console.log("\n[6] Viewport-Locked Layout & Map-First Aesthetics Audit...");
assert(cssContent.includes("height: 100vh"), "CSS enforces 100vh viewport height");
assert(cssContent.includes("overflow: hidden"), "CSS enforces overflow: hidden to prevent document scroll");
assert(cssContent.includes("map-stage-container"), "CSS implements hero map stage container");
assert(cssContent.includes("hud-anchor"), "CSS implements on-track anchored HUD callouts");
assert(cssContent.includes("decision-drawer-panel"), "CSS implements slide-out Decision Details drawer");
assert(cssContent.includes("#050813"), "CSS implements midnight navy background");
assert(cssContent.includes("#e10600"), "CSS implements racing red accent");
assert(cssContent.includes("#00f0ff") || cssContent.includes("#168bff"), "CSS implements electric blue/cyan accent");

console.log("\n=======================================================");
console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
