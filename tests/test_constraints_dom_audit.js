import fs from "fs";
import path from "path";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

console.log("\n==================================================================");
console.log("=== AUDITING CONSTRAINTS & INTERCONNECTION DOM + CSS BINDINGS ===");
console.log("==================================================================\n");

const html = fs.readFileSync(path.resolve("index.html"), "utf-8");
const css = fs.readFileSync(path.resolve("styles/trackshift.css"), "utf-8");
const appJs = fs.readFileSync(path.resolve("src/ui/EnergyDeploymentApp.js"), "utf-8");

console.log("[1] Checking Section J Live Constraint Summary Bar Elements in index.html...");
assert(html.includes('id="constraints-live-summary-bar"'), "Contains #constraints-live-summary-bar");
assert(html.includes('id="constraints-summary-counts"'), "Contains #constraints-summary-counts");
assert(html.includes('id="c-count-limiting"'), "Contains #c-count-limiting");
assert(html.includes('id="c-count-compliant"'), "Contains #c-count-compliant");
assert(html.includes('id="c-active-driver-label"'), "Contains #c-active-driver-label");
assert(html.includes('id="constraints-quick-chips"'), "Contains #constraints-quick-chips");
assert(html.includes('id="constraints-matrix-grid"'), "Contains #constraints-matrix-grid");

console.log("\n[2] Checking Section G Energy Flow Dynamic Subtitles in index.html...");
assert(html.includes('id="flow-gain-sub"'), "Contains #flow-gain-sub");
assert(html.includes('id="flow-recovery-label"'), "Contains #flow-recovery-label");

console.log("\n[3] Checking Section H Adaptation Dynamic Subtitles in index.html...");
assert(html.includes('id="adapt-desc-1"'), "Contains #adapt-desc-1");
assert(html.includes('id="adapt-desc-2"'), "Contains #adapt-desc-2");
assert(html.includes('id="adapt-desc-3"'), "Contains #adapt-desc-3");
assert(html.includes('id="adapt-desc-4"'), "Contains #adapt-desc-4");
assert(html.includes('id="adapt-desc-5"'), "Contains #adapt-desc-5");
assert(html.includes('id="adapt-desc-6"'), "Contains #adapt-desc-6");

console.log("\n[4] Checking Stylesheet Rules in trackshift.css...");
assert(css.includes(".constraints-live-summary-bar"), "CSS defines .constraints-live-summary-bar");
assert(css.includes(".constraints-summary-counts"), "CSS defines .constraints-summary-counts");
assert(css.includes(".c-count-badge.clamped"), "CSS defines .c-count-badge.clamped");
assert(css.includes(".c-count-badge.compliant"), "CSS defines .c-count-badge.compliant");
assert(css.includes(".c-active-driver-label"), "CSS defines .c-active-driver-label");
assert(css.includes(".constraints-quick-chips"), "CSS defines .constraints-quick-chips");
assert(css.includes(".c-chip-pill.ok"), "CSS defines .c-chip-pill.ok");
assert(css.includes(".c-chip-pill.clamped"), "CSS defines .c-chip-pill.clamped");
assert(css.includes(".c-chip-pill.restricted"), "CSS defines .c-chip-pill.restricted");
assert(css.includes(".c-chip-pill.active"), "CSS defines .c-chip-pill.active");
assert(css.includes(".c-driver-slider"), "CSS defines .c-driver-slider");
assert(css.includes(".c-status-pill.clamped"), "CSS defines .c-status-pill.clamped");
assert(css.includes(".c-status-pill.restricted"), "CSS defines .c-status-pill.restricted");

console.log("\n[5] Checking UI Logic Wiring in EnergyDeploymentApp.js...");
assert(appJs.includes('document.getElementById("c-count-limiting")'), "EnergyDeploymentApp binds #c-count-limiting");
assert(appJs.includes('document.getElementById("c-count-compliant")'), "EnergyDeploymentApp binds #c-count-compliant");
assert(appJs.includes('document.getElementById("c-active-driver-label")'), "EnergyDeploymentApp binds #c-active-driver-label");
assert(appJs.includes('document.getElementById("constraints-quick-chips")'), "EnergyDeploymentApp binds #constraints-quick-chips");
assert(appJs.includes('document.getElementById("flow-gain-sub")'), "EnergyDeploymentApp binds #flow-gain-sub");
assert(appJs.includes('document.getElementById("flow-recovery-label")'), "EnergyDeploymentApp binds #flow-recovery-label");
assert(appJs.includes('document.getElementById("adapt-desc-1")'), "EnergyDeploymentApp binds #adapt-desc-1");
assert(appJs.includes('document.getElementById("adapt-desc-6")'), "EnergyDeploymentApp binds #adapt-desc-6");
assert(appJs.includes("c-driver-slider"), "EnergyDeploymentApp renders direct driver slider indicators");

console.log("\n==================================================================");
console.log("🎉 ALL CONSTRAINTS & INTERCONNECTION DOM AUDITS PASSED!");
console.log("==================================================================\n");
