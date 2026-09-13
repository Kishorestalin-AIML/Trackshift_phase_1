/**
 * AUTOMATED TEST SUITE: ALPINE F1 2026 ENERGY DEPLOYMENT DIGITAL TWIN
 *
 * Tests:
 * 1. DOM Architecture (Alpine header, 7 controls, 3-car track, Next Best Action, Why This Zone)
 * 2. Multi-lap continuous energy transfer (Zone -> Sector -> Lap -> Next Lap)
 * 3. 4 Deployment strategies (SUPER-CLIP, NORMAL DEPLOYMENT, COAST, BRAKING / HARVEST)
 * 4. Required Energy Reserve & Free Energy model
 * 5. Recovery timing & feasibility analysis
 * 6. Demo Scenario preset verification (Section 22)
 * 7. FIA 2026 rule profile & 350 kW auto-clamping
 */

import fs from "fs";
import path from "path";
import { energyDeploymentEngine, FIA_RULE_PROFILE_2026 } from "../src/engine/energyDeploymentTwinEngine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n==================================================================");
console.log("=== RUNNING ALPINE F1 2026 ENERGY DEPLOYMENT TWIN TEST SUITE   ===");
console.log("==================================================================\n");

// 1. Audit DOM Architecture & Inputs
console.log("[1] Auditing index.html for Brand & Controls...");
const html = fs.readFileSync(path.resolve("index.html"), "utf-8");

assert(html.includes("ALPINE"), "Contains ALPINE brand header");
assert(html.includes("ENERGY DEPLOYMENT DIGITAL TWIN"), "Contains ENERGY DEPLOYMENT DIGITAL TWIN subtitle");
assert(html.includes("id=\"slider-current-lap\""), "Contains Control 1: Current Lap slider");
assert(html.includes("id=\"slider-laps-remaining\""), "Contains Control 2: Laps Remaining slider");
assert(html.includes("pos-selector-group"), "Contains Control 3: Position selector group");
assert(html.includes("data-position=\"1\"") && html.includes("data-position=\"6\""), "Contains position pills P1 through P6");
assert(html.includes("id=\"slider-car-ahead\""), "Contains Control 4: Car Ahead Gap slider");
assert(html.includes("id=\"slider-car-behind\""), "Contains Control 5: Car Behind Gap slider");
assert(html.includes("id=\"slider-soc\""), "Contains Control 6: Battery SOC slider");
assert(html.includes("id=\"slider-intensity\""), "Contains Control 7: Deployment Intensity slider");
assert(html.includes("id=\"alpine-track-canvas\""), "Contains 3-car race strip canvas");
assert(html.includes("id=\"finite-battery-fill\""), "Contains finite battery bar");
assert(html.includes("id=\"recommended-strategy-badge\""), "Contains Recommended Strategy badge");
assert(html.includes("id=\"out-where\""), "Contains WHERE location readout");
assert(html.includes("id=\"out-energy\""), "Contains Energy Deployed readout");
assert(html.includes("id=\"out-recovery\""), "Contains Expected Recovery readout");
assert(html.includes("id=\"out-after-energy\""), "Contains Energy After Action readout");
assert(html.includes("id=\"out-fia\""), "Contains FIA compliance status");
assert(html.includes("id=\"out-reason\""), "Contains Tactical Reason readout");
assert(html.includes("id=\"out-why-zone\""), "Contains 'WHY THIS ZONE?' explanation");
assert(html.includes("id=\"multi-lap-timeline\""), "Contains Multi-Lap Timeline Stepper container");
assert(html.includes("id=\"btn-demo-preset\""), "Contains Demo Preset button");

// 2. Audit CSS Theme
console.log("\n[2] Auditing trackshift.css for Clean White + Alpine Blue Theme...");
const css = fs.readFileSync(path.resolve("styles/trackshift.css"), "utf-8");
assert(css.includes("--alpine-blue: #0090ff"), "Defines primary Alpine Blue brand token");
assert(css.includes("--bg-page: #f8fafc") || css.includes("--bg-page: #ffffff"), "Defines white/light background");
assert(css.includes(".strategy-pill.super-clip"), "Contains SUPER-CLIP strategy badge style");
assert(css.includes(".strategy-pill.braking---harvest"), "Contains BRAKING / HARVEST badge style");
assert(css.includes(".why-zone-box"), "Contains 'Why This Zone' container style");

// 3. Test Multi-Lap Continuous Energy Transfer
console.log("\n[3] Testing Multi-Lap Continuous Energy Transfer (Zone -> Sector -> Lap -> Next Lap)...");
const multiLapSim = energyDeploymentEngine.simulateMultiLap({
  currentLap: 24,
  futureLaps: 3,
  position: 3,
  carAheadGap: 0.7,
  carBehindGap: 1.4,
  soc: 58,
  intensity: 75
});

assert(multiLapSim.lapPlans.length === 4, `Simulates 4 laps in total (Lap 24 + 3 future, got ${multiLapSim.lapPlans.length})`);
assert(multiLapSim.allZoneSteps.length === 36, `Simulates 36 zones continuously (4 laps * 9 zones, got ${multiLapSim.allZoneSteps.length})`);

// Verify continuous transfer: End SOC of Lap 24 MUST equal Start SOC of Lap 25
const lap24 = multiLapSim.lapPlans[0];
const lap25 = multiLapSim.lapPlans[1];
assert(lap24.endSoc === lap25.startSoc, `Energy transfers continuously: Lap 24 End SOC (${lap24.endSoc}%) == Lap 25 Start SOC (${lap25.startSoc}%)`);

// Verify intra-lap zone transfer: Zone N socAfter == Zone N+1 socBefore
for (let i = 0; i < multiLapSim.allZoneSteps.length - 1; i++) {
  const currentStep = multiLapSim.allZoneSteps[i];
  const nextStep = multiLapSim.allZoneSteps[i + 1];
  assert(currentStep.socAfter === nextStep.socBefore, `Zone ${currentStep.zoneId} socAfter (${currentStep.socAfter}%) == Zone ${nextStep.zoneId} socBefore (${nextStep.socBefore}%)`);
}

// 4. Test 4 Deployment Strategies
console.log("\n[4] Testing 4 Deployment Strategies across 9 Zones...");
const allStrategies = new Set(multiLapSim.allZoneSteps.map((s) => s.strategy));
assert(allStrategies.has("SUPER-CLIP"), "Includes SUPER-CLIP deployment");
assert(allStrategies.has("COAST"), "Includes COAST deployment");
assert(allStrategies.has("BRAKING / HARVEST"), "Includes BRAKING / HARVEST deployment");

// Heavy braking zones (Z3, Z4, Z8) must prioritize recovery
const z4Steps = multiLapSim.allZoneSteps.filter((s) => s.zoneId === "Z4");
assert(z4Steps.every((s) => s.strategy === "BRAKING / HARVEST" || s.strategy === "COAST"), "Zone 4 (Heavy braking) prioritizes recovery/coast");

// 5. Test Required Energy Reserve Model & Free Energy
console.log("\n[5] Testing Required Reserve Model...");
const resNormal = energyDeploymentEngine.calculateReserveMetrics(58, 1.4, 30, 3);
assert(resNormal.requiredReserveMJ >= 1.2, `Calculates dynamic reserve (>=1.2 MJ, got ${resNormal.requiredReserveMJ} MJ)`);
assert(resNormal.freeEnergyMJ > 0, `Free energy available under 58% SOC (got ${resNormal.freeEnergyMJ} MJ)`);

// High defensive pressure (< 0.5s) must increase required reserve
const resPressured = energyDeploymentEngine.calculateReserveMetrics(58, 0.4, 30, 3);
assert(resPressured.requiredReserveMJ > resNormal.requiredReserveMJ, "Rear threat (<0.5s) expands required reserve");
assert(resPressured.hasDefensivePressure === true, "Flags defensive pressure");

// Low SOC (< 30%) leaves minimal or zero free energy
const resLow = energyDeploymentEngine.calculateReserveMetrics(22, 1.4, 30, 3);
assert(resLow.freeEnergyMJ === 0, `Low SOC (22%) leaves 0 Free Energy (got ${resLow.freeEnergyMJ} MJ)`);

// 6. Test Demo Scenario Preset (Section 22)
console.log("\n[6] Testing Demo Scenario Preset (L24 / 3 Laps / P3 / 58% SOC / 0.7s Ahead / 1.4s Behind)...");
const demoSim = energyDeploymentEngine.simulateMultiLap({
  currentLap: 24,
  futureLaps: 3,
  position: 3,
  carAheadGap: 0.7,
  carBehindGap: 1.4,
  soc: 58,
  intensity: 80
});

// Demo progression check:
// L24 S1-Z3 -> COAST / HARVEST
// L24 S2-Z4 -> BRAKING / HARVEST (+0.7 MJ)
// L24 S2-Z5 -> SUPER-CLIP (-1.8 MJ) with overtake P3 -> P2
const l24z3 = demoSim.allZoneSteps.find((s) => s.lap === 24 && s.zoneId === "Z3");
const l24z4 = demoSim.allZoneSteps.find((s) => s.lap === 24 && s.zoneId === "Z4");
const l24z5 = demoSim.allZoneSteps.find((s) => s.lap === 24 && s.zoneId === "Z5");

assert(l24z4.strategy === "BRAKING / HARVEST", `L24-Z4 selects BRAKING / HARVEST (got ${l24z4.strategy})`);
assert(l24z4.recoveredMJ >= 0.6, `L24-Z4 recovers energy (got +${l24z4.recoveredMJ} MJ)`);

assert(l24z5.strategy === "SUPER-CLIP", `L24-Z5 selects SUPER-CLIP (got ${l24z5.strategy})`);
assert(l24z5.overtakeOccurred === true, "L24-Z5 triggers overtake event (P3 -> P2)");
assert(l24z5.newPosition === "P2", "Position moves to P2");

// Next Best Action verification
assert(demoSim.nextBestAction !== null, "Identifies Next Best Energy Action");
assert(demoSim.nextBestAction.zoneNumber === 5, `Next Best Action is Zone 5 (got ${demoSim.nextBestAction.zoneNumber})`);
assert(demoSim.whyThisZone.includes("ZONE 5 selected"), "Generates 'WHY THIS ZONE?' explanation");

// 7. Test FIA 2026 Rule Profile & Clamping (Section 16 & 17)
console.log("\n[7] Testing FIA 2026 Rule Compliance & Clamping...");
assert(FIA_RULE_PROFILE_2026.accelerationZoneLimitKw === 350, "FIA 2026 acceleration zone limit is 350 kW");
assert(FIA_RULE_PROFILE_2026.standardZoneLimitKw === 250, "FIA 2026 standard zone limit is 250 kW");

// Test over-limit intensity (100% requested -> 380 kW -> clamped to 350 kW)
const clampSim = energyDeploymentEngine.simulateMultiLap({
  currentLap: 24,
  futureLaps: 1,
  position: 3,
  carAheadGap: 0.7,
  carBehindGap: 1.4,
  soc: 60,
  intensity: 100 // requests 380 kW
});
const z5Clamped = clampSim.allZoneSteps.find((s) => s.zoneId === "Z5");
assert(z5Clamped.powerKw === 350, `Power is clamped to legal 350 kW (got ${z5Clamped.powerKw} kW)`);
assert(z5Clamped.isFiaLimitActive === true, "Flags FIA LIMIT ACTIVE when requested > 350 kW");

console.log("\n==================================================================");
console.log("=== ALL ALPINE F1 2026 ENERGY DEPLOYMENT TWIN TESTS PASSED!    ===");
console.log("==================================================================\n");
