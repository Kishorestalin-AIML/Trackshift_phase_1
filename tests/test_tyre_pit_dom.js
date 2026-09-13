/**
 * AUTOMATED DOM & CSS AUDIT FOR PIT STOP + TYRE STRATEGY ENGINE (SECTIONS 29–49)
 */

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
console.log("=== AUDITING PIT STOP & TYRE DOM + CSS BINDINGS (SECS 29–49)    ===");
console.log("==================================================================\n");

const html = fs.readFileSync(path.resolve("index.html"), "utf-8");
const css = fs.readFileSync(path.resolve("styles/trackshift.css"), "utf-8");

console.log("[1] Checking Left Control Panel Elements...");
assert(html.includes('id="val-tyre-compound"'), "Contains #val-tyre-compound");
assert(html.includes('id="compound-selector-group"'), "Contains #compound-selector-group");
assert(html.includes('data-compound="SOFT"'), "Contains SOFT compound pill");
assert(html.includes('data-compound="MEDIUM"'), "Contains MEDIUM compound pill");
assert(html.includes('data-compound="HARD"'), "Contains HARD compound pill");
assert(html.includes('data-compound="INTERMEDIATE"'), "Contains INTER compound pill");
assert(html.includes('data-compound="WET"'), "Contains WET compound pill");
assert(html.includes('id="val-tyre-age"'), "Contains #val-tyre-age");
assert(html.includes('id="slider-tyre-age"'), "Contains #slider-tyre-age");
assert(html.includes('id="val-track-condition"'), "Contains #val-track-condition");
assert(html.includes('id="condition-selector-group"'), "Contains #condition-selector-group");
assert(html.includes('data-condition="DRY"'), "Contains DRY condition pill");
assert(html.includes('data-condition="DAMP"'), "Contains DAMP condition pill");
assert(html.includes('data-condition="WET"'), "Contains WET condition pill");

console.log("\n[2] Checking Sidebar PIT STRATEGY [AUTO] Summary Card...");
assert(html.includes('id="sb-pit-planned"'), "Contains #sb-pit-planned");
assert(html.includes('id="sb-pit-window"'), "Contains #sb-pit-window");
assert(html.includes('id="sb-pit-next-tyre"'), "Contains #sb-pit-next-tyre");
assert(html.includes('id="sb-pit-loss"'), "Contains #sb-pit-loss");

console.log("\n[3] Checking CURRENT STATE Card Readouts...");
assert(html.includes('id="cs-tyre"'), "Contains #cs-tyre");
assert(html.includes('id="cs-grip"'), "Contains #cs-grip");

console.log("\n[4] Checking Main Decision Card Badges & Parameters...");
assert(html.includes('id="dec-tyre-badge"'), "Contains #dec-tyre-badge");
assert(html.includes('id="dec-pit-badge"'), "Contains #dec-pit-badge");
assert(html.includes('id="dec-tyre-cond"'), "Contains #dec-tyre-cond");
assert(html.includes('id="dec-pit-window"'), "Contains #dec-pit-window");
assert(html.includes('id="dec-pit-loss"'), "Contains #dec-pit-loss");
assert(html.includes('id="dec-undercut-val"'), "Contains #dec-undercut-val");

console.log("\n[5] Checking Section D: Pit Stop & Tyre Cockpit Elements...");
assert(html.includes('id="chk-vsc-sc"'), "Contains #chk-vsc-sc toggle");
assert(html.includes('id="pit-circuit-tag"'), "Contains #pit-circuit-tag");
assert(html.includes('id="val-stationary-stop"'), "Contains #val-stationary-stop");
assert(html.includes('id="val-travel-loss"'), "Contains #val-travel-loss");
assert(html.includes('id="val-total-pit-loss"'), "Contains #val-total-pit-loss");
assert(html.includes('id="val-vsc-savings"'), "Contains #val-vsc-savings");
assert(html.includes('id="rejoin-curr-pos"'), "Contains #rejoin-curr-pos");
assert(html.includes('id="rejoin-exit-pos"'), "Contains #rejoin-exit-pos");
assert(html.includes('id="rejoin-drop"'), "Contains #rejoin-drop");
assert(html.includes('id="rejoin-breakeven"'), "Contains #rejoin-breakeven");
assert(html.includes('id="pit-actions-comparison-grid"'), "Contains #pit-actions-comparison-grid");
assert(html.includes('id="cockpit-undercut-gain"'), "Contains #cockpit-undercut-gain");
assert(html.includes('id="cockpit-undercut-viability"'), "Contains #cockpit-undercut-viability");
assert(html.includes('id="cockpit-overcut-gain"'), "Contains #cockpit-overcut-gain");
assert(html.includes('id="cockpit-overcut-viability"'), "Contains #cockpit-overcut-viability");
assert(html.includes('id="cockpit-window-range"'), "Contains #cockpit-window-range");
assert(html.includes('id="cockpit-window-best"'), "Contains #cockpit-window-best");
assert(html.includes('id="cockpit-undercut-summary"'), "Contains #cockpit-undercut-summary");
assert(html.includes('id="tg-grip-fill"'), "Contains #tg-grip-fill");
assert(html.includes('id="tg-grip-val"'), "Contains #tg-grip-val");
assert(html.includes('id="tg-deg-level"'), "Contains #tg-deg-level");
assert(html.includes('id="tg-temp-fill"'), "Contains #tg-temp-fill");
assert(html.includes('id="tg-temp-val"'), "Contains #tg-temp-val");
assert(html.includes('id="tyre-inventory-badges"'), "Contains #tyre-inventory-badges");
assert(html.includes('id="mandatory-compound-status"'), "Contains #mandatory-compound-status");

console.log("\n[6] Checking Section E: 5-Lap Tactical Strategy Timeline...");
assert(html.includes('id="tactical-plan-container"'), "Contains #tactical-plan-container");

console.log("\n[7] Checking Stylesheet Rules for Tyre & Pit Engine...");
assert(css.includes(".pit-tyre-cockpit-section"), "CSS defines .pit-tyre-cockpit-section");
assert(css.includes(".cockpit-dual-grid"), "CSS defines .cockpit-dual-grid");
assert(css.includes(".pit-loss-breakdown-box"), "CSS defines .pit-loss-breakdown-box");
assert(css.includes(".pit-action-row"), "CSS defines .pit-action-row");
assert(css.includes(".undercut-analysis-box"), "CSS defines .undercut-analysis-box");
assert(css.includes(".tyre-telemetry-row"), "CSS defines .tyre-telemetry-row");
assert(css.includes(".tyre-inventory-box"), "CSS defines .tyre-inventory-box");
assert(css.includes(".tactical-plan-section"), "CSS defines .tactical-plan-section");
assert(css.includes(".tactical-step-card"), "CSS defines .tactical-step-card");
assert(css.includes(".compound-pill.soft"), "CSS defines .compound-pill.soft");
assert(css.includes(".compound-pill.medium"), "CSS defines .compound-pill.medium");
assert(css.includes(".compound-pill.hard"), "CSS defines .compound-pill.hard");
assert(css.includes(".compound-pill.inter"), "CSS defines .compound-pill.inter");
assert(css.includes(".compound-pill.wet"), "CSS defines .compound-pill.wet");

console.log("\n==================================================================");
console.log("🎉 ALL PIT STOP & TYRE DOM + CSS BINDING AUDITS PASSED!         ===");
console.log("==================================================================\n");
