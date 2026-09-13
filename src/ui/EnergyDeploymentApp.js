/**
 * ALPINE F1 2026 DYNAMIC ENERGY & OVERTAKE DECISION DIGITAL TWIN
 * Application Controller
 *
 * Implements:
 * 1. 8 Dynamic Race Situation User Controls (Lap, Future Laps, Position, SOC, Ahead, Behind, Intensity, Constraint)
 * 2. Real-time dynamic recalculation on ANY input change
 * 3. Megajoule-First physical calculations (20.0 MJ Pack, 1 MW * 1s = 1 MJ)
 * 4. Tri-Segment Horizontal Energy Bar (USED | FREE | RESERVE)
 * 5. Numerical Energy Flow Visualization (Current -> Deploy -> Gain -> Recovery -> Future)
 * 6. WHAT / WHERE / WHEN / WHY Decision Output Card with classification tags
 * 7. Visual Demonstration of CONSTRAINT -> DECISION -> OUTCOME adaptation
 * 8. 13 General Decision Engine Constraints Inspector (C1 to C13)
 * 9. Multi-Lap Continuous Energy Transfer Timeline
 * 10. 3-Car Animated Race Track Strip Orchestrator
 */

import { alpineDecisionEngine } from "../engine/alpineDecisionTwinEngine.js";
import { AlpineRaceTrack } from "../components/AlpineRaceTrack.js";

export class EnergyDeploymentApp {
  constructor() {
    this.raceTrack = null;

    // 8 Race Situation parameters (Section 23) + Tyre & Pit (Sections 30, 31, 34, 41, 42)
    this.state = {
      currentLap: 24,
      lapsRemaining: 33,
      futureLaps: 3,
      position: 3,
      soc: 62, // 62% = 12.4 MJ available
      carAheadGap: 0.7,
      carBehindGap: 1.4,
      intensity: 75,
      constraintLevel: 25, // LOW to MODERATE
      compound: "MEDIUM",
      tyreAge: 12,
      trackCondition: "DRY",
      isVscOrSc: false
    };

    this.latestSimulation = null;
    this.isSimulating = false;
    this.constraintsVisible = false;
    this.auditVisible = false;
    this.inspectedStrategy = null; // Interactive candidate inspection (null = engine recommended)
    this._rafId = null;
  }

  /**
   * Dedicated fast-path synchronized update for Constraint Level
   */
  updateConstraintLevel(val) {
    this.state.constraintLevel = val;
    const c = val;
    const label = c <= 25 ? `LOW (${c}%)` : c <= 60 ? `STANDARD (${c}%)` : `HIGH (${c}%)`;

    const valConstraint = document.getElementById("val-constraint");
    if (valConstraint) {
      valConstraint.textContent = label;
      valConstraint.className = c > 60 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }

    const sliderConstraint = document.getElementById("slider-constraint");
    if (sliderConstraint && parseInt(sliderConstraint.value, 10) !== val) {
      sliderConstraint.value = val;
    }

    const valStratConstraint = document.getElementById("val-strategy-constraint");
    if (valStratConstraint) {
      valStratConstraint.textContent = label;
      valStratConstraint.className = c > 60 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }

    const sliderStratConstraint = document.getElementById("slider-strategy-constraint");
    if (sliderStratConstraint && parseInt(sliderStratConstraint.value, 10) !== val) {
      sliderStratConstraint.value = val;
    }

    this.updateLivePackAllocation(this.state.soc, false);
    this.scheduleRecalculate();
  }

  init() {
    this.raceTrack = new AlpineRaceTrack("alpine-track-canvas");
    this.bindControls();
    this.updateLivePackAllocation(this.state.soc, false);
    this.recalculateSimulation();

    // Section 37: Expose runDependencyAudit globally for developer & automated testing
    if (typeof window !== "undefined") {
      window.runDependencyAudit = (baseInput = {}) => this.runDependencyAudit(baseInput);
      window.alpineDecisionEngine = alpineDecisionEngine;
    }
  }

  /**
   * Section 37: Automated Correlation Test
   */
  runDependencyAudit(baseInput = {}) {
    return alpineDecisionEngine.runDependencyAudit({ ...this.state, ...baseInput });
  }

  /**
   * Schedules smooth throttled recalculation on next animation frame
   */
  scheduleRecalculate() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.recalculateSimulation();
    });
  }

  flushRecalculate() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.recalculateSimulation();
  }

  /**
   * Dedicated fast-path update for Car Ahead Gap ("reupdate that particular only")
   */
  updateCarAheadOnly(val) {
    this.state.carAheadGap = val;

    // 1. Update slider readout immediately
    const valAhead = document.getElementById("val-car-ahead");
    if (valAhead) {
      if (this.state.position === 1) {
        valAhead.textContent = "N/A (RACE LEADER P1)";
        valAhead.className = "ctrl-val text-muted";
      } else {
        valAhead.textContent = `${val.toFixed(1)} s`;
        valAhead.className = val <= 0.8 ? "ctrl-val text-green" : "ctrl-val text-blue";
      }
    }

    // 2. Update current state card immediately
    const csAhead = document.getElementById("cs-ahead");
    if (csAhead) {
      csAhead.textContent = this.state.position === 1 ? "LEAD" : `${val.toFixed(1)} s`;
    }

    // 3. Update animated race track immediately
    if (this.raceTrack) {
      this.raceTrack.updateLiveState({
        carAheadGap: val,
        position: this.state.position
      });
    }

    // 4. Update live pack allocation & battery rule validation
    this.updateLivePackAllocation(this.state.soc, false);

    // 5. Immediately recalculate simulation so Section E tradeoff & all cards update in real time
    this.recalculateSimulation();
  }

  /**
   * Dedicated fast-path update for Car Behind Gap ("reupdate that particular only")
   */
  updateCarBehindOnly(val) {
    this.state.carBehindGap = val;

    // 1. Update slider readout immediately
    const valBehind = document.getElementById("val-car-behind");
    if (valBehind) {
      valBehind.textContent = `${val.toFixed(1)} s`;
      if (val < 0.5) {
        valBehind.textContent += " (DEFENSIVE PRESSURE)";
        valBehind.className = "ctrl-val text-red";
      } else if (val < 1.0) {
        valBehind.className = "ctrl-val text-amber";
      } else {
        valBehind.className = "ctrl-val text-blue";
      }
    }

    // 2. Update current state card immediately
    const csBehind = document.getElementById("cs-behind");
    if (csBehind) {
      csBehind.textContent = `${val.toFixed(1)} s`;
    }

    // 3. Update animated race track immediately
    if (this.raceTrack) {
      this.raceTrack.updateLiveState({
        carBehindGap: val,
        position: this.state.position
      });
    }

    // 4. Live update Pack Allocation since rear gap drives defence reserve
    this.updateLivePackAllocation(this.state.soc, false);

    // 5. Immediately recalculate simulation so Section E tradeoff & all cards update in real time
    this.recalculateSimulation();
  }

  /**
   * Fast-Path Instant Update for TRI-SEGMENT ELECTRICAL PACK ALLOCATION
   * Synchronously updates the bar widths, labels, segregated detail cards, and telemetry at 60 FPS
   */
  updateLivePackAllocation(soc, isDragging = false) {
    soc = Math.max(0, Math.min(100, parseInt(soc, 10)));
    this.state.soc = soc;

    // Toggle dragging class on bar for zero-lag instant response
    const barContainer = document.getElementById("tri-segment-bar");
    if (barContainer) {
      if (isDragging) {
        barContainer.classList.add("is-dragging");
      } else {
        barContainer.classList.remove("is-dragging");
      }
    }

    // Sync single central SOC slider
    const sliderSoc = document.getElementById("slider-soc");
    if (sliderSoc && parseInt(sliderSoc.value, 10) !== soc) {
      sliderSoc.value = soc;
    }

    const packCapacity = alpineDecisionEngine.usableCapacityMJ; // 20.0 MJ
    const initialEnergyMJ = alpineDecisionEngine.socToMJ(soc);
    const initialJoules = Math.round(initialEnergyMJ * 1e6);
    const currentLap = this.state.currentLap != null ? this.state.currentLap : 24;
    const lapsRemaining = this.state.lapsRemaining != null ? this.state.lapsRemaining : Math.max(1, 57 - currentLap);
    const res = alpineDecisionEngine.calculateReserveModel(
      initialEnergyMJ,
      this.state.carBehindGap,
      lapsRemaining,
      this.state.position,
      currentLap
    );

    // 1. Physical Bounding
    const actualReserveMJ = Math.min(res.reserveMJ, initialEnergyMJ);
    const actualFreeMJ = Math.max(0, initialEnergyMJ - res.reserveMJ);
    const actualUsedMJ = Math.max(0, Math.round((packCapacity - initialEnergyMJ) * 100) / 100);

    const actualReserveJoules = Math.round(actualReserveMJ * 1e6);
    const actualFreeJoules = Math.round(actualFreeMJ * 1e6);
    const actualUsedJoules = Math.round(actualUsedMJ * 1e6);

    const reservePct = Math.round((actualReserveMJ / packCapacity) * 1000) / 10;
    const freePct = Math.round((actualFreeMJ / packCapacity) * 1000) / 10;
    const usedPct = Math.max(0, Math.round((actualUsedMJ / packCapacity) * 1000) / 10);

    // 2. Bar Widths & Labels
    const barReserve = document.getElementById("bar-seg-reserve");
    const labelReserve = document.getElementById("label-seg-reserve");
    if (barReserve) {
      barReserve.style.width = `${reservePct}%`;
      barReserve.style.display = reservePct > 0 ? "flex" : "none";
    }
    if (labelReserve) {
      labelReserve.textContent = reservePct > 7 ? `RESERVE ${actualReserveMJ.toFixed(1)} MJ (${Math.round(reservePct)}%)` : (reservePct > 3 ? `${actualReserveMJ.toFixed(1)}M` : "");
    }

    const barFree = document.getElementById("bar-seg-free");
    const labelFree = document.getElementById("label-seg-free");
    if (barFree) {
      barFree.style.width = `${freePct}%`;
      barFree.style.display = freePct > 0 ? "flex" : "none";
    }
    if (labelFree) {
      labelFree.textContent = freePct > 7 ? `FREE ${actualFreeMJ.toFixed(1)} MJ (${Math.round(freePct)}%)` : (freePct > 3 ? `${actualFreeMJ.toFixed(1)}M` : "");
    }

    const barUsed = document.getElementById("bar-seg-used");
    const labelUsed = document.getElementById("label-seg-used");
    if (barUsed) barUsed.style.width = `${usedPct}%`;
    if (labelUsed) {
      labelUsed.textContent = usedPct > 8 ? `USED ${actualUsedMJ.toFixed(1)} MJ (${Math.round(usedPct)}%)` : (usedPct > 3 ? `${actualUsedMJ.toFixed(1)}M` : "");
    }

    // 3. Legend Values
    const legRes = document.getElementById("leg-res-val");
    if (legRes) legRes.textContent = `${res.reserveMJ.toFixed(1)} MJ (${(res.reserveMJ * 1e6).toLocaleString()} J)`;
    const legFree = document.getElementById("leg-free-val");
    if (legFree) legFree.textContent = `${res.freeEnergyMJ.toFixed(1)} MJ (${(res.freeEnergyMJ * 1e6).toLocaleString()} J)`;
    const legUsed = document.getElementById("leg-used-val");
    if (legUsed) legUsed.textContent = `${actualUsedMJ.toFixed(1)} MJ (${actualUsedJoules.toLocaleString()} J)`;

    // 4. Slider Readout (Single Central Slider)
    const valSoc = document.getElementById("val-soc");
    if (valSoc) {
      valSoc.textContent = `${soc}% (${initialEnergyMJ.toFixed(1)} MJ · ${initialJoules.toLocaleString()} J)`;
      valSoc.className = soc < 25 ? "ctrl-val text-red" : soc < 40 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }

    // 5. Segregated Breakdown Cards
    const cardResVal = document.getElementById("card-res-val");
    if (cardResVal) cardResVal.textContent = `${actualReserveMJ.toFixed(1)} MJ (${actualReserveJoules.toLocaleString()} J)`;
    const cardResPct = document.getElementById("card-res-pct");
    if (cardResPct) cardResPct.textContent = `${reservePct.toFixed(1)}%`;

    const cardFreeVal = document.getElementById("card-free-val");
    if (cardFreeVal) cardFreeVal.textContent = `${actualFreeMJ.toFixed(1)} MJ (${actualFreeJoules.toLocaleString()} J)`;
    const cardFreePct = document.getElementById("card-free-pct");
    if (cardFreePct) cardFreePct.textContent = `${freePct.toFixed(1)}%`;

    const cardUsedVal = document.getElementById("card-used-val");
    if (cardUsedVal) cardUsedVal.textContent = `${actualUsedMJ.toFixed(1)} MJ (${actualUsedJoules.toLocaleString()} J)`;
    const cardUsedPct = document.getElementById("card-used-pct");
    if (cardUsedPct) cardUsedPct.textContent = `${usedPct.toFixed(1)}%`;

    // 6. Section C Top Grid Stats
    const statSoc = document.getElementById("stat-soc");
    if (statSoc) {
      statSoc.textContent = `${soc}%`;
      statSoc.className = soc < 25 ? "stat-val text-red" : soc < 40 ? "stat-val text-amber" : "stat-val text-blue";
    }
    const statAvailable = document.getElementById("stat-available");
    if (statAvailable) statAvailable.textContent = `${initialEnergyMJ.toFixed(1)} MJ (${initialJoules.toLocaleString()} J)`;
    const statReserved = document.getElementById("stat-reserved");
    if (statReserved) statReserved.textContent = `${actualReserveMJ.toFixed(1)} MJ (${actualReserveJoules.toLocaleString()} J)`;
    const statFree = document.getElementById("stat-free");
    if (statFree) {
      statFree.textContent = `${actualFreeMJ.toFixed(1)} MJ (${actualFreeJoules.toLocaleString()} J)`;
      statFree.className = actualFreeMJ >= 1.40 ? "stat-val text-green" : actualFreeMJ >= 0.5 ? "stat-val text-amber" : "stat-val text-red";
    }

    // 7. Left Sidebar State Card
    const csSoc = document.getElementById("cs-soc");
    if (csSoc) csSoc.textContent = `${soc}%`;
    const csEnergy = document.getElementById("cs-energy");
    if (csEnergy) csEnergy.textContent = `${initialEnergyMJ.toFixed(1)} MJ · ${initialJoules.toLocaleString()} J`;

    // 8. Dynamic Battery State Badge
    const batteryState = soc >= 60 ? "HEALTHY" : soc >= 40 ? "LIMITED" : soc >= 25 ? "LOW" : "CRITICAL";
    const stateBadge = document.getElementById("battery-state-badge");
    if (stateBadge) {
      stateBadge.textContent = `ENERGY: ${batteryState}`;
      stateBadge.className = `battery-state-badge ${batteryState.toLowerCase()}`;
    }

    // 9. Attack Capability & Detailed Limitation Rationale (FIA Rule Validation)
    const capVal = document.getElementById("battery-attack-capability");
    const limitReason = document.getElementById("battery-limit-reason");
    const canSuperClip = res.freeEnergyMJ >= 1.40 && soc >= 30;
    const isSprintPhase = res.isSprintPhase;
    const isRaceStart = res.isRaceStart;

    if (capVal) {
      if (soc <= 15) {
        capVal.textContent = "CRITICAL — AT SAFETY FLOOR (3.0 MJ / 3,000,000 J — MGU-K RECHARGE ONLY)";
        capVal.className = "cap-val text-red";
      } else if (soc <= 28 || res.freeEnergyMJ <= 0.05) {
        capVal.textContent = "CRITICAL — DISCRETIONARY ATTACK INFEASIBLE (NOTHING TO SAVE)";
        capVal.className = "cap-val text-red";
      } else if (isSprintPhase && res.freeEnergyMJ >= 0.30) {
        capVal.textContent = "FINAL SPRINT AUTHORIZED — SPEND USABLE PACK (UP TO 4.0 MJ / 4,000,000 J)";
        capVal.className = "cap-val text-green";
      } else if (isRaceStart && res.freeEnergyMJ >= 0.80) {
        capVal.textContent = "RACE START SCRAMBLE (350 kW / 1.40 MJ — OPENING LAP ATTACK)";
        capVal.className = "cap-val text-green";
      } else if (canSuperClip) {
        capVal.textContent = "SUPER-CLIP AVAILABLE (350 kW / 1.40 MJ · 1,400,000 J)";
        capVal.className = "cap-val text-green";
      } else if (res.freeEnergyMJ >= 0.50 && soc >= 25) {
        capVal.textContent = "LIMITED — NORMAL DEPLOYMENT ONLY (200 kW / 0.80 MJ)";
        capVal.className = "cap-val text-amber";
      } else {
        capVal.textContent = "RESTRICTED — COAST / RECOVERY ONLY";
        capVal.className = "cap-val text-amber";
      }
    }

    if (limitReason) {
      if (soc <= 15) {
        limitReason.textContent = `SAFETY FLOOR VIOLATION BLOCKED: Pack: ${initialEnergyMJ.toFixed(1)} MJ (${initialJoules.toLocaleString()} J) at 3.0 MJ floor | Free: 0.00 MJ | Active MGU-K recovery mandatory`;
        limitReason.style.color = "var(--accent-red)";
      } else if (soc <= 28 || res.freeEnergyMJ <= 0.05) {
        limitReason.textContent = `LOW ENERGY: Current: ${initialEnergyMJ.toFixed(1)} MJ (${initialJoules.toLocaleString()} J) | Reserve: ${res.reserveMJ.toFixed(1)} MJ (${(res.reserveMJ*1e6).toLocaleString()} J) | Free: 0.00 MJ | RECHARGE MANDATORY`;
        limitReason.style.color = "var(--accent-red)";
      } else if (isSprintPhase && res.freeEnergyMJ >= 0.30) {
        limitReason.textContent = `FINAL SPRINT: ${lapsRemaining} lap${lapsRemaining === 1 ? "" : "s"} remaining | Pack: ${initialEnergyMJ.toFixed(1)} MJ (${initialJoules.toLocaleString()} J) | Floor: 3.0 MJ (3,000,000 J) | Free: ${res.freeEnergyMJ.toFixed(1)} MJ (${(res.freeEnergyMJ*1e6).toLocaleString()} J) | STATUS: SPRINT BURN ACTIVE`;
        limitReason.style.color = "var(--accent-green)";
      } else if (isRaceStart && res.freeEnergyMJ >= 0.80) {
        limitReason.textContent = `RACE START: Lap ${currentLap}/57 | High pack energy (${initialEnergyMJ.toFixed(1)} MJ / ${initialJoules.toLocaleString()} J) | Free: ${res.freeEnergyMJ.toFixed(1)} MJ | STATUS: OPENING SCRAMBLE ACTIVE`;
        limitReason.style.color = "var(--accent-green)";
      } else if (!canSuperClip) {
        limitReason.textContent = `LOW ENERGY: Current: ${initialEnergyMJ.toFixed(1)} MJ (${initialJoules.toLocaleString()} J) | Reserve: ${res.reserveMJ.toFixed(1)} MJ | Available Free: ${res.freeEnergyMJ.toFixed(1)} MJ | SUPER-CLIP requires: 1.40 MJ | STATUS: INFEASIBLE`;
        limitReason.style.color = soc < 25 ? "var(--accent-red)" : "var(--accent-amber)";
      } else {
        limitReason.textContent = `Current: ${initialEnergyMJ.toFixed(1)} MJ (${initialJoules.toLocaleString()} J) | Reserve: ${res.reserveMJ.toFixed(1)} MJ | Free Attack: ${res.freeEnergyMJ.toFixed(1)} MJ >= 1.40 MJ | FIA RULE: COMPLIANT`;
        limitReason.style.color = "var(--text-secondary)";
      }
    }

    // 10. Live Race Track Canvas update
    if (this.raceTrack) {
      this.raceTrack.updateLiveState({
        soc,
        energyMJ: initialEnergyMJ,
        position: this.state.position,
        carBehindGap: this.state.carBehindGap,
        carAheadGap: this.state.carAheadGap
      });
    }

    // Reset status banner
    const statusBanner = document.getElementById("simulation-status-banner");
    if (statusBanner) statusBanner.style.display = "none";
  }

  /**
   * Section 1, 2, 14, 15: Instant Reactive SOC Slider Handler
   * Fast-path synchronous energy update followed by smoothly throttled twin recalculation.
   */
  onSOCSliderChange(newSoc, isDragging = false) {
    const soc = Math.max(0, Math.min(100, parseInt(newSoc, 10)));
    this.state.soc = soc;
    this.updateLivePackAllocation(soc, isDragging);

    // Treat as clean new initial scenario per Section 14
    if (this.raceTrack) {
      this.raceTrack.isSimulating = false;
      this.raceTrack.simulationOutcome = null;
    }

    // Immediately recalculate decision twin so Section E tradeoff & all cards update in real time
    this.recalculateSimulation();
  }

  bindControls() {
    // 1. Current Lap Slider & 2. Laps Remaining Slider (Synchronized Causal Pair)
    const sliderLap = document.getElementById("slider-current-lap");
    const sliderRemaining = document.getElementById("slider-laps-remaining");
    const valLap = document.getElementById("val-current-lap");
    const valRemaining = document.getElementById("val-laps-remaining");

    const syncLapState = (lap, remaining, source) => {
      this.state.currentLap = lap;
      this.state.lapsRemaining = remaining;
      this.state.futureLaps = Math.min(5, Math.max(1, remaining));

      if (valLap) valLap.textContent = `LAP ${this.state.currentLap} / 57`;
      if (valRemaining) valRemaining.textContent = `${this.state.lapsRemaining} LAPS REMAINING`;
      const csLap = document.getElementById("cs-lap");
      if (csLap) csLap.textContent = `${this.state.currentLap}`;

      if (sliderLap && source !== "lap") sliderLap.value = this.state.currentLap;
      if (sliderRemaining && source !== "remaining") sliderRemaining.value = this.state.lapsRemaining;

      // Update battery pack allocation & battery rule validation live
      this.updateLivePackAllocation(this.state.soc, true);
    };

    if (sliderLap) {
      sliderLap.addEventListener("input", (e) => {
        const lap = parseInt(e.target.value, 10);
        const rem = Math.max(1, 57 - lap);
        syncLapState(lap, rem, "lap");
        this.scheduleRecalculate();
      });
      sliderLap.addEventListener("change", () => this.flushRecalculate());
    }

    if (sliderRemaining) {
      sliderRemaining.addEventListener("input", (e) => {
        const rem = parseInt(e.target.value, 10);
        const lap = Math.max(1, Math.min(57, 57 - rem));
        syncLapState(lap, rem, "remaining");
        this.scheduleRecalculate();
      });
      sliderRemaining.addEventListener("change", () => this.flushRecalculate());
    }

    // Fallback support for legacy slider-future-laps if present
    const sliderFuture = document.getElementById("slider-future-laps");
    if (sliderFuture) {
      sliderFuture.addEventListener("input", (e) => {
        this.state.futureLaps = parseInt(e.target.value, 10);
        const valFuture = document.getElementById("val-future-laps");
        if (valFuture) {
          const endLap = this.state.currentLap + this.state.futureLaps;
          valFuture.textContent = `${this.state.futureLaps} LAPS (L${this.state.currentLap} → L${endLap})`;
        }
        this.scheduleRecalculate();
      });
      sliderFuture.addEventListener("change", () => this.flushRecalculate());
    }

    // 3. Position Selector Pills (P1 to P6)
    const posButtons = document.querySelectorAll(".pos-pill");
    posButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        posButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.position = parseInt(btn.dataset.position, 10);

        // Leader (P1) has no car ahead
        const aheadRow = document.getElementById("ctrl-car-ahead-row");
        if (aheadRow) {
          aheadRow.style.opacity = this.state.position === 1 ? "0.4" : "1.0";
          aheadRow.style.pointerEvents = this.state.position === 1 ? "none" : "auto";
        }

        this.updateLivePackAllocation(this.state.soc, false);
        this.flushRecalculate();
      });
    });

    // 4. Battery SOC Slider (Section 1, 2, 3, 15) & Direct Tri-Segment Pack Scrubber
    const sliderSoc = document.getElementById("slider-soc");
    if (sliderSoc) {
      sliderSoc.addEventListener("input", (e) => {
        this.onSOCSliderChange(e.target.value, true);
      });
      sliderSoc.addEventListener("change", (e) => {
        this.onSOCSliderChange(e.target.value, false);
        this.flushRecalculate();
      });
      sliderSoc.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const nextVal = Math.max(0, Math.min(100, this.state.soc + delta));
        sliderSoc.value = nextVal;
        this.onSOCSliderChange(nextVal, false);
        this.flushRecalculate();
      }, { passive: false });
    }



    // Direct Interactive Scrubbing on Tri-Segment Bar itself
    const barContainer = document.getElementById("tri-segment-bar");
    if (barContainer) {
      const handleBarScrub = (e) => {
        const rect = barContainer.getBoundingClientRect();
        if (rect.width <= 0) return;
        const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const pct = Math.round((clickX / rect.width) * 100);
        this.onSOCSliderChange(pct, true);
      };

      let isDown = false;
      barContainer.addEventListener("mousedown", (e) => {
        isDown = true;
        handleBarScrub(e);
      });
      window.addEventListener("mousemove", (e) => {
        if (isDown) handleBarScrub(e);
      });
      window.addEventListener("mouseup", () => {
        if (isDown) {
          isDown = false;
          barContainer.classList.remove("is-dragging");
          this.flushRecalculate();
        }
      });
    }

    // 5. Car Ahead Gap Slider (Section: "reupdate that particular only")
    const sliderAhead = document.getElementById("slider-car-ahead");
    if (sliderAhead) {
      sliderAhead.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.updateCarAheadOnly(val);
      });
      sliderAhead.addEventListener("change", (e) => {
        this.state.carAheadGap = parseFloat(e.target.value);
        this.flushRecalculate();
      });
      sliderAhead.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        const nextVal = Math.max(0.2, Math.min(3.0, Math.round((this.state.carAheadGap + delta) * 10) / 10));
        sliderAhead.value = nextVal;
        this.updateCarAheadOnly(nextVal);
      }, { passive: false });
    }

    // 6. Car Behind Gap Slider (Section: "reupdate that particular only")
    const sliderBehind = document.getElementById("slider-car-behind");
    if (sliderBehind) {
      sliderBehind.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.updateCarBehindOnly(val);
      });
      sliderBehind.addEventListener("change", (e) => {
        this.state.carBehindGap = parseFloat(e.target.value);
        this.flushRecalculate();
      });
      sliderBehind.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        const nextVal = Math.max(0.2, Math.min(3.0, Math.round((this.state.carBehindGap + delta) * 10) / 10));
        sliderBehind.value = nextVal;
        this.updateCarBehindOnly(nextVal);
      }, { passive: false });
    }

    // 7. Deployment Intensity Slider
    const sliderIntensity = document.getElementById("slider-intensity");
    if (sliderIntensity) {
      sliderIntensity.addEventListener("input", (e) => {
        this.state.intensity = parseInt(e.target.value, 10);
        const valIntensity = document.getElementById("val-intensity");
        if (valIntensity) {
          const baseKw = Math.round(160 + (this.state.intensity / 100) * 220);
          if (baseKw > 350) {
            valIntensity.textContent = `${baseKw} kW → 350 kW (FIA CLAMPED)`;
            valIntensity.className = "ctrl-val text-amber";
          } else {
            valIntensity.textContent = `${baseKw} kW (LEGAL)`;
            valIntensity.className = "ctrl-val text-blue";
          }
        }
        this.updateLivePackAllocation(this.state.soc, false);
        this.scheduleRecalculate();
      });
      sliderIntensity.addEventListener("change", () => this.flushRecalculate());
    }

    // 8. Constraint Level Sliders (Section 23 & Strategy Operations Toolbar)
    const sliderConstraint = document.getElementById("slider-constraint");
    if (sliderConstraint) {
      sliderConstraint.addEventListener("input", (e) => {
        this.updateConstraintLevel(parseInt(e.target.value, 10));
      });
      sliderConstraint.addEventListener("change", () => this.flushRecalculate());
    }

    const sliderStratConstraint = document.getElementById("slider-strategy-constraint");
    if (sliderStratConstraint) {
      sliderStratConstraint.addEventListener("input", (e) => {
        this.updateConstraintLevel(parseInt(e.target.value, 10));
      });
      sliderStratConstraint.addEventListener("change", () => this.flushRecalculate());
    }

    // Candidate Inspection Reset Button
    const btnResetInspect = document.getElementById("btn-reset-inspection");
    if (btnResetInspect) {
      btnResetInspect.addEventListener("click", () => {
        this.inspectedStrategy = null;
        if (this.latestSimulation) {
          this.updateStrategyComparisonUI(this.latestSimulation);
          this.updateOptimizationBreakdownUI(this.latestSimulation);
        }
      });
    }

    // 9. Compound Selector Pills (Section 34)
    const compoundButtons = document.querySelectorAll(".compound-pill");
    compoundButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        compoundButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.compound = btn.dataset.compound;
        this.flushRecalculate();
      });
    });

    // 10. Tyre Age Slider (Section 30)
    const sliderTyreAge = document.getElementById("slider-tyre-age");
    if (sliderTyreAge) {
      sliderTyreAge.addEventListener("input", (e) => {
        this.state.tyreAge = parseInt(e.target.value, 10);
        const valTyreAge = document.getElementById("val-tyre-age");
        if (valTyreAge) {
          valTyreAge.textContent = `${this.state.tyreAge} LAPS`;
          valTyreAge.className = this.state.tyreAge >= 25 ? "ctrl-val text-red" : this.state.tyreAge >= 18 ? "ctrl-val text-amber" : "ctrl-val text-blue";
        }
        this.scheduleRecalculate();
      });
      sliderTyreAge.addEventListener("change", () => this.flushRecalculate());
    }

    // 11. Track Condition Pills (Section 42)
    const conditionButtons = document.querySelectorAll(".condition-pill");
    conditionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        conditionButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.trackCondition = btn.dataset.condition;
        this.recalculateSimulation();
      });
    });

    // 12. Safety Car / VSC Toggle (Section 41)
    const chkVsc = document.getElementById("chk-vsc-sc");
    if (chkVsc) {
      chkVsc.addEventListener("change", (e) => {
        this.state.isVscOrSc = e.target.checked;
        this.recalculateSimulation();
      });
    }

    // Toggle 13 Constraints Matrix
    const btnToggleConstraints = document.getElementById("btn-toggle-constraints");
    if (btnToggleConstraints) {
      btnToggleConstraints.addEventListener("click", () => {
        this.constraintsVisible = !this.constraintsVisible;
        const matrix = document.getElementById("constraints-matrix-grid");
        if (matrix) {
          matrix.style.display = this.constraintsVisible ? "grid" : "none";
        }
        btnToggleConstraints.textContent = this.constraintsVisible
          ? "HIDE CONSTRAINT MATRIX"
          : "VIEW FULL CONSTRAINT MATRIX (13 CONSTRAINTS)";
      });
    }

    // Toggle Section K Internal Audit Mode (Section 43)
    const btnToggleTrace = document.getElementById("btn-toggle-trace");
    if (btnToggleTrace) {
      btnToggleTrace.addEventListener("click", () => {
        this.auditVisible = !this.auditVisible;
        const panel = document.getElementById("internal-audit-panel");
        if (panel) {
          panel.style.display = this.auditVisible ? "block" : "none";
        }
        btnToggleTrace.textContent = this.auditVisible
          ? "HIDE AUDIT STATE MATRIX"
          : "VIEW AUDIT STATE MATRIX (SECTION 43)";
      });
    }

    // Simulation Trigger Button
    const btnRun = document.getElementById("btn-run-simulation");
    if (btnRun) {
      btnRun.addEventListener("click", () => this.runSimulation());
    }

    // Demo Preset Button
    const btnDemo = document.getElementById("btn-demo-preset");
    if (btnDemo) {
      btnDemo.addEventListener("click", () => this.loadDemoPreset());
    }
  }

  /**
   * Recalculates all energy states, scores, constraints, and projections dynamically
   */
  recalculateSimulation() {
    this.latestSimulation = alpineDecisionEngine.simulate(this.state);
    this.centralRaceState = this.latestSimulation.centralRaceState;
    this.updateControlsUI();
    this.updateCurrentStateUI(this.latestSimulation);
    this.updateTyreAndPitUI(this.latestSimulation);
    this.updateTacticalPlanUI(this.latestSimulation);
    this.updateEnergyStateUI(this.latestSimulation);
    this.updateEnergyFlowUI(this.latestSimulation);
    this.updateDecisionCardUI(this.latestSimulation);
    this.updateUpcomingLapAdvisoryUI(this.latestSimulation);
    this.updateStrategyComparisonUI(this.latestSimulation);
    this.updateOptimizationBreakdownUI(this.latestSimulation);
    this.updateTradeoffUI(this.latestSimulation);
    this.updateZoneInfoUI(this.latestSimulation);
    this.updateAdaptationUI(this.latestSimulation);
    this.updateMultiLapTimeline(this.latestSimulation);
    this.updateConstraintsMatrix(this.latestSimulation);
    this.updateDecisionTraceAndAuditUI(this.latestSimulation);

    if (this.raceTrack) {
      this.raceTrack.updateLiveState({
        raceState: this.centralRaceState,
        position: this.centralRaceState.position,
        carBehindGap: this.centralRaceState.gapBehind,
        carAheadGap: this.centralRaceState.gapAhead,
        soc: this.centralRaceState.SOC,
        energyMJ: this.centralRaceState.energyMJ,
        tyrePerformance: this.centralRaceState.tyrePerformance,
        recommendation: this.latestSimulation.nextBestAction.strategy,
        targetZone: this.latestSimulation.nextBestAction.zoneNumber,
        deployedMJ: this.latestSimulation.nextBestAction.deployedMJ,
        expectedRecoveryMJ: this.latestSimulation.expectedRecoveryMJ
      });
    }
  }

  /**
   * Updates Compact CURRENT STATE card in left panel (Section 16, 46)
   */
  updateCurrentStateUI(sim) {
    const csLap = document.getElementById("cs-lap");
    if (csLap) csLap.textContent = `${this.state.currentLap}`;

    const csPos = document.getElementById("cs-pos");
    if (csPos) csPos.textContent = `P${this.state.position}`;

    const csSoc = document.getElementById("cs-soc");
    if (csSoc) csSoc.textContent = `${this.state.soc}%`;

    const csEnergy = document.getElementById("cs-energy");
    if (csEnergy) csEnergy.textContent = `${sim.initialEnergyMJ.toFixed(1)} MJ`;

    const csAhead = document.getElementById("cs-ahead");
    if (csAhead) {
      csAhead.textContent = this.state.position === 1 ? "LEAD" : `${this.state.carAheadGap.toFixed(1)} s`;
    }

    const csBehind = document.getElementById("cs-behind");
    if (csBehind) csBehind.textContent = `${this.state.carBehindGap.toFixed(1)} s`;

    const csTyre = document.getElementById("cs-tyre");
    if (csTyre && sim.tyreState) {
      csTyre.textContent = `${sim.tyreState.compoundId.substring(0, 3)} (${sim.tyreState.age}L)`;
    }

    const csGrip = document.getElementById("cs-grip");
    if (csGrip && sim.tyreState) {
      csGrip.textContent = `${sim.tyreState.grip}% (${sim.tyreState.degradationLevel})`;
      csGrip.className = sim.tyreState.grip < 60 ? "cs-val text-red" : sim.tyreState.grip < 75 ? "cs-val text-amber" : "cs-val text-green";
    }
  }

  updateControlsUI() {
    // Current Lap Readout
    const valLap = document.getElementById("val-current-lap");
    if (valLap) valLap.textContent = `LAP ${this.state.currentLap} / 57`;

    // Laps Remaining Readout & Slider Sync
    const valRemaining = document.getElementById("val-laps-remaining");
    const rem = this.state.lapsRemaining || Math.max(1, 57 - this.state.currentLap);
    if (valRemaining) valRemaining.textContent = `${rem} LAPS REMAINING`;
    const sliderRemaining = document.getElementById("slider-laps-remaining");
    if (sliderRemaining) sliderRemaining.value = rem;

    // Future Laps Readout (fallback)
    const valFuture = document.getElementById("val-future-laps");
    if (valFuture) {
      const endLap = this.state.currentLap + this.state.futureLaps;
      valFuture.textContent = `${this.state.futureLaps} LAPS (L${this.state.currentLap} → L${endLap})`;
    }

    // SOC Readout with MJ conversion (Section 2)
    const valSoc = document.getElementById("val-soc");
    if (valSoc) {
      const mj = alpineDecisionEngine.socToMJ(this.state.soc);
      valSoc.textContent = `${this.state.soc}% (${mj.toFixed(1)} MJ)`;
      valSoc.className = this.state.soc < 30 ? "ctrl-val text-red" : this.state.soc < 50 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }

    // Car Ahead Readout
    const valAhead = document.getElementById("val-car-ahead");
    if (valAhead) {
      if (this.state.position === 1) {
        valAhead.textContent = "N/A (RACE LEADER P1)";
        valAhead.className = "ctrl-val text-muted";
      } else {
        valAhead.textContent = `${this.state.carAheadGap.toFixed(1)} s`;
        valAhead.className = this.state.carAheadGap <= 0.8 ? "ctrl-val text-green" : "ctrl-val text-blue";
      }
    }

    // Car Behind Readout
    const valBehind = document.getElementById("val-car-behind");
    if (valBehind) {
      valBehind.textContent = `${this.state.carBehindGap.toFixed(1)} s`;
      if (this.state.carBehindGap < 0.5) {
        valBehind.textContent += " (DEFENSIVE PRESSURE)";
        valBehind.className = "ctrl-val text-red";
      } else if (this.state.carBehindGap < 1.0) {
        valBehind.className = "ctrl-val text-amber";
      } else {
        valBehind.className = "ctrl-val text-blue";
      }
    }

    // Deployment Intensity Readout
    const valIntensity = document.getElementById("val-intensity");
    if (valIntensity) {
      const baseKw = Math.round(160 + (this.state.intensity / 100) * 220);
      if (baseKw > 350) {
        valIntensity.textContent = `${baseKw} kW → 350 kW (FIA CLAMPED)`;
        valIntensity.className = "ctrl-val text-amber";
      } else {
        valIntensity.textContent = `${baseKw} kW (LEGAL)`;
        valIntensity.className = "ctrl-val text-blue";
      }
    }

    // Constraint Level Readouts (Section 23 & Strategy Operations Toolbar)
    const c = this.state.constraintLevel;
    const label = c <= 25 ? `LOW (${c}%)` : c <= 60 ? `STANDARD (${c}%)` : `HIGH (${c}%)`;

    const valConstraint = document.getElementById("val-constraint");
    if (valConstraint) {
      valConstraint.textContent = label;
      valConstraint.className = c > 60 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }
    const valStratConstraint = document.getElementById("val-strategy-constraint");
    if (valStratConstraint) {
      valStratConstraint.textContent = label;
      valStratConstraint.className = c > 60 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }
    const sliderStrat = document.getElementById("slider-strategy-constraint");
    if (sliderStrat && parseInt(sliderStrat.value, 10) !== c) {
      sliderStrat.value = c;
    }

    // Tyre Compound Readout (Section 34)
    const valTyreCompound = document.getElementById("val-tyre-compound");
    if (valTyreCompound) {
      const codeMap = { SOFT: "C4", MEDIUM: "C3", HARD: "C1", INTERMEDIATE: "I", WET: "W" };
      valTyreCompound.textContent = `${this.state.compound} (${codeMap[this.state.compound] || "C3"})`;
    }

    // Tyre Age Readout (Section 30)
    const valTyreAge = document.getElementById("val-tyre-age");
    if (valTyreAge) {
      valTyreAge.textContent = `${this.state.tyreAge} LAPS`;
      valTyreAge.className = this.state.tyreAge >= 25 ? "ctrl-val text-red" : this.state.tyreAge >= 18 ? "ctrl-val text-amber" : "ctrl-val text-blue";
    }

    // Track Condition Readout (Section 42)
    const valTrackCond = document.getElementById("val-track-condition");
    if (valTrackCond) {
      const tempC = this.state.trackCondition === "WET" ? 22 : this.state.trackCondition === "DAMP" ? 26 : 34;
      valTrackCond.textContent = `${this.state.trackCondition} (${tempC}°C)`;
    }

    // Position Selector Pills Sync (Sections 15 & 33)
    const posButtons = document.querySelectorAll(".pos-pill");
    posButtons.forEach((btn) => {
      if (parseInt(btn.dataset.position, 10) === this.state.position) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    const aheadRow = document.getElementById("ctrl-car-ahead-row");
    if (aheadRow) {
      aheadRow.style.opacity = this.state.position === 1 ? "0.4" : "1.0";
      aheadRow.style.pointerEvents = this.state.position === 1 ? "none" : "auto";
    }
  }

  /**
   * Updates SOC & Tri-Segment Energy State Display (Section 2 & 19)
   */
  updateEnergyStateUI(sim) {
    const soc = sim.initialSoc;

    // Fast-path instant synchronization of Tri-Segment Pack Allocation, sliders, and segregated cards
    this.updateLivePackAllocation(soc, false);

    // Update simulation post-action metrics
    const statAfter = document.getElementById("stat-after-energy");
    if (statAfter) statAfter.textContent = `${sim.energyAfterDeployMJ.toFixed(1)} MJ`;

    const statNet = document.getElementById("stat-net-delta");
    if (statNet) statNet.textContent = `Deploy: -${sim.deployedMJ.toFixed(2)} MJ`;

    const statAfterSoc = document.getElementById("stat-after-soc");
    if (statAfterSoc) statAfterSoc.textContent = `${sim.socAfterDeploy}%`;
  }

  /**
   * Updates Numerical Energy Flow Visualization (Section 25)
   */
  updateEnergyFlowUI(sim) {
    const flowCur = document.getElementById("flow-current");
    if (flowCur) flowCur.textContent = `${sim.initialEnergyMJ.toFixed(1)} MJ`;

    const flowCurSoc = document.getElementById("flow-current-soc");
    if (flowCurSoc) flowCurSoc.textContent = `SOC ${sim.initialSoc}%`;

    const flowDeploy = document.getElementById("flow-deploy-delta");
    if (flowDeploy) flowDeploy.textContent = `-${sim.deployedMJ.toFixed(2)} MJ`;

    const flowGain = document.getElementById("flow-gain");
    if (flowGain) flowGain.textContent = `+${sim.expectedGainSec.toFixed(2)} s`;

    const flowGainSub = document.getElementById("flow-gain-sub");
    if (flowGainSub) {
      if (sim.deployedMJ === 0) {
        flowGainSub.textContent = "Pack Conservation Delta";
      } else {
        flowGainSub.textContent = `Eff: +${sim.effectiveGainSec.toFixed(2)}s (${sim.tyreState ? sim.tyreState.grip : 100}% Grip)`;
      }
    }

    const flowRec = document.getElementById("flow-recovery-delta");
    if (flowRec) flowRec.textContent = `+${sim.expectedRecoveryMJ.toFixed(2)} MJ`;

    const flowRecLabel = document.getElementById("flow-recovery-label");
    if (flowRecLabel && sim.nextRecovery) {
      flowRecLabel.textContent = `RECOVERY (${sim.nextRecovery.zoneId})`;
    }

    const flowFut = document.getElementById("flow-future");
    if (flowFut) flowFut.textContent = `${sim.energyAfterRecoveryMJ.toFixed(1)} MJ`;

    const flowFutSoc = document.getElementById("flow-future-soc");
    if (flowFutSoc) flowFutSoc.textContent = `SOC ${sim.socAfterRecovery}%`;

    const flowNet = document.getElementById("flow-net-change");
    if (flowNet) {
      const sign = sim.netEnergyChangeMJ > 0 ? "+" : "";
      flowNet.textContent = `${sign}${sim.netEnergyChangeMJ.toFixed(2)} MJ`;
      flowNet.className = sim.netEnergyChangeMJ >= 0 ? "text-mono text-green" : "text-mono text-amber";
    }
  }

  /**
   * Updates Main Decision Output Card (Section 1, 18)
   */
  updateDecisionCardUI(sim) {
    const action = sim.nextBestAction;

    // Strategy Badge
    const stratBadge = document.getElementById("recommended-strategy-badge") || document.getElementById("dec-strategy-badge");
    if (stratBadge) {
      stratBadge.textContent = action.strategy;
      stratBadge.className = `strategy-pill ${action.strategy.toLowerCase().replace(/[^a-z]/g, "-")}`;
    }

    // WHEN & WHERE
    const valWhen = document.getElementById("dec-when");
    if (valWhen) {
      valWhen.textContent = `LAP ${action.lap} (${action.isCurrentLap ? "NEXT ZONE" : "FUTURE LAP"})`;
    }

    const valWhere = document.getElementById("out-where") || document.getElementById("dec-where");
    if (valWhere) {
      valWhere.textContent = `SECTOR ${action.sector} — ZONE ${action.zoneNumber} (${action.zoneName})`;
    }

    // Metrics Grid
    const valDeploy = document.getElementById("out-energy") || document.getElementById("dec-deploy");
    if (valDeploy) valDeploy.textContent = `Deploy: ${action.deployedMJ.toFixed(2)} MJ`;

    const valRec = document.getElementById("out-recovery") || document.getElementById("dec-recovery");
    if (valRec) valRec.textContent = `Next recovery: +${sim.expectedRecoveryMJ.toFixed(2)} MJ (${sim.nextRecovery ? sim.nextRecovery.zoneId : 'Z6'})`;

    const valEnergyFlow = document.getElementById("dec-energy-flow");
    if (valEnergyFlow) valEnergyFlow.textContent = `${sim.energyBeforeMJ.toFixed(2)} → ${sim.energyAfterDeployMJ.toFixed(2)} MJ`;

    const valSocShift = document.getElementById("out-after-energy") || document.getElementById("dec-soc-shift");
    if (valSocShift) valSocShift.textContent = `${sim.socAfterDeploy}% (${sim.initialSoc}% → ${sim.socAfterDeploy}%)`;

    const valOvertake = document.getElementById("dec-overtake-prob");
    if (valOvertake) valOvertake.textContent = `${sim.overtakeProb}%`;

    const valDefence = document.getElementById("dec-defence-risk");
    if (valDefence) {
      valDefence.textContent = sim.defenceRisk;
      valDefence.className = sim.defenceRisk === "HIGH" ? "param-val text-red" : sim.defenceRisk === "MEDIUM" ? "param-val text-amber" : "param-val text-blue";
    }

    const valFuture = document.getElementById("dec-future-opp");
    if (valFuture) valFuture.textContent = sim.futureOpp;

    const valFia = document.getElementById("out-fia") || document.getElementById("dec-fia-status");
    if (valFia) {
      valFia.textContent = sim.fiaStatus;
      valFia.className = action.isFiaLimitActive ? "param-val text-amber" : "param-val text-green";
    }

    // Optimization Score Badge (Sections 8, 14, 18)
    const valScore = document.getElementById("dec-strategy-score");
    if (valScore) {
      valScore.textContent = `${sim.strategyScore}/100`;
    }

    // Spend vs Save Optimization Metrics (Sections 4, 5, 6, 7, 15, 23)
    const svs = sim.spendVsSaveOptimization || (sim.tradeoffComparison && sim.tradeoffComparison.spendVsSaveOptimization);
    const valRaceVal = document.getElementById("dec-race-value");
    if (valRaceVal && svs) {
      const rv = svs.spendNow.raceValue;
      valRaceVal.textContent = (rv >= 0 ? "+" : "") + rv.toFixed(2);
    }

    const valSpendVsSave = document.getElementById("dec-spend-vs-save");
    if (valSpendVsSave && svs) {
      valSpendVsSave.textContent = svs.winner === "Spend Now"
        ? `SPEND WINS +${svs.winningMargin.toFixed(2)}`
        : svs.winner === "Harvest / Recharge"
        ? `RECHARGE (+${svs.winningMargin.toFixed(2)})`
        : `SAVE WINS +${svs.winningMargin.toFixed(2)}`;
      valSpendVsSave.className = svs.winner === "Spend Now"
        ? "param-val text-green"
        : svs.winner === "Harvest / Recharge"
        ? "param-val text-amber"
        : "param-val text-blue";
    }

    const valBestFut = document.getElementById("dec-best-future-opp");
    if (valBestFut && svs && svs.bestFutureOpportunity) {
      const b = svs.bestFutureOpportunity;
      valBestFut.textContent = `Lap ${b.lap} → Z${b.zoneNumber}`;
    }

    // 4-Question Decision Synthesis (Section 13, 18)
    const synthWhat = document.getElementById("synth-what");
    if (synthWhat) synthWhat.textContent = action.strategy;

    const synthWhere = document.getElementById("synth-where");
    if (synthWhere) synthWhere.textContent = `Sector ${action.sector} · Zone ${action.zoneNumber}`;

    const synthWhen = document.getElementById("synth-when");
    if (synthWhen) synthWhen.textContent = `Lap ${action.lap}`;

    const synthWhy = document.getElementById("synth-why");
    if (synthWhy) synthWhy.textContent = (sim.decisionSynthesis && sim.decisionSynthesis.why) || sim.why;

    // Recovery Timing & Sequence Strip (Section 8)
    const recDistTag = document.getElementById("dec-recovery-dist");
    const zonesAway = (sim.recoveryTiming && sim.recoveryTiming.zonesAway) || 1;
    if (recDistTag) recDistTag.textContent = `[${zonesAway} ZONE${zonesAway === 1 ? '' : 'S'} AWAY]`;

    const recTimingLoc = document.getElementById("rec-timing-loc");
    if (recTimingLoc) {
      const recZ = sim.recoveryTiming && sim.recoveryTiming.nextRecoveryZone;
      recTimingLoc.textContent = recZ ? `Sector ${recZ.sector} · Zone ${recZ.zoneNumber}` : "Sector 2 · Zone 6";
    }

    const recTimingDist = document.getElementById("rec-timing-dist");
    if (recTimingDist) {
      recTimingDist.textContent = `${zonesAway} zone${zonesAway === 1 ? '' : 's'} away`;
    }

    const recTimingExp = document.getElementById("rec-timing-exp");
    if (recTimingExp) {
      const expRec = (sim.recoveryTiming && sim.recoveryTiming.expectedRecoveryMJ) || sim.expectedRecoveryMJ || 0.80;
      recTimingExp.textContent = `Expected recovery: +${expRec.toFixed(2)} MJ`;
    }

    const recSeqFlow = document.getElementById("rec-seq-flow");
    if (recSeqFlow) {
      const recZoneId = sim.nextRecovery ? sim.nextRecovery.zoneId : "Z6";
      recSeqFlow.textContent = `Current attack (${action.strategy}) → deploy ${action.deployedMJ.toFixed(2)} MJ → remaining ${sim.energyAfterDeployMJ.toFixed(2)} MJ → next recovery (+${sim.expectedRecoveryMJ.toFixed(2)} MJ in ${recZoneId}) → future attack`;
    }

    // WHY THIS? and WHY NOT OTHERS? Lists (Section 14)
    const listWhyThis = document.getElementById("list-why-this");
    if (listWhyThis && sim.decisionSynthesis && sim.decisionSynthesis.whyThis) {
      listWhyThis.innerHTML = sim.decisionSynthesis.whyThis
        .map((bullet) => `<li>${bullet}</li>`)
        .join("");
    }

    const listWhyNotOthers = document.getElementById("list-why-not-others");
    if (listWhyNotOthers && sim.decisionSynthesis && sim.decisionSynthesis.whyNotOthers) {
      const items = Object.entries(sim.decisionSynthesis.whyNotOthers)
        .map(([strat, reason]) => `<li><strong>${strat}</strong> — ${reason.replace(/^[A-Z\-\s\/]+ — /, "")}</li>`)
        .join("");
      listWhyNotOthers.innerHTML = items;
    }

    // Rationales
    const valWhy = document.getElementById("out-reason") || document.getElementById("dec-why-text");
    if (valWhy) valWhy.textContent = sim.why;

    const valWhyZone = document.getElementById("out-why-zone") || document.getElementById("dec-why-zone-text");
    if (valWhyZone) valWhyZone.textContent = sim.whyThisZone;
  }

  /**
   * Updates UPCOMING LAP ENERGY DIRECTIVE & CONSTRAINT ADVISORY (SAVE / USE / HARVEST)
   * Shows active constraints and the best pick out of the four candidate actions for upcoming lap.
   */
  updateUpcomingLapAdvisoryUI(sim) {
    const advisory = sim.upcomingLapAdvisory;
    if (!advisory) return;

    // 1. Kicker & Directive Badge
    const kicker = document.getElementById("dir-lap-kicker");
    if (kicker) kicker.textContent = `UPCOMING LAP ${advisory.upcomingLapNumber} TACTICAL DIRECTIVE`;

    const badge = document.getElementById("dir-type-badge");
    if (badge) {
      badge.textContent = advisory.directiveLabel;
      badge.className = `directive-badge ${advisory.directiveBadgeClass}`;
    }

    const bestPickName = document.getElementById("dir-best-pick-name");
    if (bestPickName) {
      bestPickName.textContent = advisory.bestPick;
    }

    // 2. Upcoming Projection
    const netVal = document.getElementById("dir-net-energy-val");
    if (netVal) {
      const sign = advisory.netProjectedDeltaMJ > 0 ? "+" : "";
      netVal.textContent = `Start ${advisory.projectedStartEnergyMJ.toFixed(1)} MJ (SOC ${advisory.projectedStartSoc}%) · Net ${sign}${advisory.netProjectedDeltaMJ.toFixed(2)} MJ`;
      if (advisory.directive === "HARVEST" || advisory.netProjectedDeltaMJ > 0) {
        netVal.className = "net-val text-green";
      } else if (advisory.directive === "SAVE") {
        netVal.className = "net-val text-amber";
      } else {
        netVal.className = "net-val text-blue";
      }
    }

    // 3. Dynamic Constraint Chips
    const chipsContainer = document.getElementById("dir-constraint-chips");
    if (chipsContainer && advisory.constraintChips) {
      chipsContainer.innerHTML = advisory.constraintChips.map((c) =>
        `<span class="d-chip chip-${c.type}">${c.label}</span>`
      ).join("");
    }

    // 4. Engineering Rationale
    const rationale = document.getElementById("dir-explanation-text");
    if (rationale) {
      rationale.textContent = advisory.directiveRationale;
    }

    // 5. 4-Way Action Evaluation for Upcoming Lap
    const candidates = advisory.candidatesEvaluation;
    if (candidates) {
      const mapping = [
        { key: "SUPER-CLIP", cellId: "pick-cell-superclip", verdId: "pick-verd-superclip", reasId: "pick-reas-superclip" },
        { key: "NORMAL DEPLOYMENT", cellId: "pick-cell-normal", verdId: "pick-verd-normal", reasId: "pick-reas-normal" },
        { key: "COAST", cellId: "pick-cell-coast", verdId: "pick-verd-coast", reasId: "pick-reas-coast" },
        { key: "BRAKING / HARVEST", cellId: "pick-cell-harvest", verdId: "pick-verd-harvest", reasId: "pick-reas-harvest" }
      ];

      mapping.forEach((m) => {
        const cand = candidates[m.key];
        if (!cand) return;

        const cell = document.getElementById(m.cellId);
        if (cell) {
          cell.className = cand.isBest ? "dir-pick-cell pick-best" : "dir-pick-cell";
        }

        const verd = document.getElementById(m.verdId);
        if (verd) {
          verd.textContent = cand.isBest ? `✓ ${cand.verdict}` : cand.verdict;
          verd.className = `pick-verdict ${cand.colorClass}`;
        }

        const reas = document.getElementById(m.reasId);
        if (reas) {
          reas.textContent = cand.reason;
        }
      });
    }
  }

  /**
   * Updates Strategy Optimization Comparison Grid (Section 13)
   */
  updateStrategyComparisonUI(sim) {
    const container = document.getElementById("strategy-comparison-grid");
    if (!container || !sim.strategyComparison) return;

    const inspected = this.inspectedStrategy || sim.nextBestAction.strategy;

    // Update inspection toolbar badge
    const inspectBadge = document.getElementById("strat-inspect-status");
    const inspectName = document.getElementById("strat-inspect-name");
    const btnReset = document.getElementById("btn-reset-inspection");

    if (inspectBadge && inspectName) {
      const isManual = Boolean(this.inspectedStrategy && this.inspectedStrategy !== sim.nextBestAction.strategy);
      if (isManual) {
        inspectBadge.className = "strat-inspect-badge inspecting";
        inspectName.textContent = `INSPECTING CANDIDATE: ${this.inspectedStrategy}`;
        if (btnReset) btnReset.style.display = "inline-flex";
      } else {
        inspectBadge.className = "strat-inspect-badge recommended";
        inspectName.textContent = `ENGINE OPTIMAL: ${sim.nextBestAction.strategy}`;
        if (btnReset) btnReset.style.display = "none";
      }
    }

    container.innerHTML = "";
    sim.strategyComparison.forEach((strat) => {
      const card = document.createElement("div");
      const isRec = strat.isRecommended;
      const isInspected = strat.name === inspected;

      card.className = `strategy-option-card ${isRec ? "recommended" : ""} ${isInspected ? "inspected" : ""}`;
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Inspect strategy candidate ${strat.name}`);

      const pctWidth = Math.max(8, Math.min(100, strat.score));
      let statusTag = isRec ? "✓ RECOMMENDED" : strat.breakdown.isFeasible ? "FEASIBLE" : "RESTRICTED";
      let statusClass = isRec ? "recommended-tag" : strat.breakdown.isFeasible ? "feasible-tag" : "restricted-tag";

      if (strat.constraintStatus === "CLAMPED") {
        statusTag = "CLAMPED (C2)";
        statusClass = "clamped-tag";
      } else if (strat.constraintStatus === "BLOCKED") {
        statusTag = "BLOCKED (C3/C9)";
        statusClass = "restricted-tag";
      }

      // Format specs
      const powerStr = strat.powerLabel || `${strat.powerKw} kW`;
      const energyStr = strat.energyLabel || `${strat.energyDeltaMJ.toFixed(2)} MJ`;
      const gainStr = strat.expectedGainLabel || `${strat.expectedGainSec > 0 ? "+" : ""}${strat.expectedGainSec.toFixed(2)}s`;
      const constraintTag = strat.constraintRelation || "Compliant with 2026 FIA Regulations";
      const sliderNote = strat.constraintSliderTag ? `<div class="strat-slider-note">${strat.constraintSliderTag}</div>` : "";

        const def = (sim.strategyDefinitions && sim.strategyDefinitions[strat.name]) || null;
        const defBox = def ? `
          <div class="strat-def-box">
            <div class="strat-def-row"><strong>What:</strong> <span>${def.what}</span></div>
            <div class="strat-def-row"><strong>Choose when:</strong> <span>${def.chooseWhen}</span></div>
            <div class="strat-def-row"><strong>Optimizes:</strong> <span class="text-blue">${def.optimizes}</span></div>
            <div class="strat-def-row not-row"><strong>Not:</strong> <span>${def.not}</span></div>
          </div>
        ` : "";

        card.innerHTML = `
        <div class="strat-card-header">
          <div class="strat-title-group">
            <span class="strat-card-name">${strat.name}</span>
            <span class="strat-status-text ${statusClass}">${statusTag}</span>
          </div>
          <span class="strat-score-pill">${strat.score}</span>
        </div>

        <div class="strat-meter-track">
          <div class="strat-meter-fill" style="width: ${pctWidth}%;"></div>
        </div>

        <div class="strat-specs-row">
          <div class="strat-spec-col">
            <span class="strat-spec-lbl">MGU-K POWER</span>
            <span class="strat-spec-val text-blue">${powerStr}</span>
          </div>
          <div class="strat-spec-col">
            <span class="strat-spec-lbl">ENERGY DELTA</span>
            <span class="strat-spec-val ${strat.energyDeltaMJ >= 0 ? 'text-green' : 'text-amber'}">${energyStr}</span>
          </div>
          <div class="strat-spec-col">
            <span class="strat-spec-lbl">EXP. RACE GAIN</span>
            <span class="strat-spec-val ${strat.expectedGainSec > 0 ? 'text-green' : 'text-muted'}">${gainStr}</span>
          </div>
        </div>

        <div class="strat-constraint-banner">
          <span class="strat-constraint-icon">⚖</span>
          <span class="strat-constraint-text">${constraintTag}</span>
        </div>
        ${sliderNote}
        ${defBox}

        <div class="strat-inspect-footer">
          <span class="strat-inspect-link">${isInspected ? "● CURRENTLY INSPECTED" : "🔍 Click to inspect breakdown"}</span>
        </div>
      `;

      card.addEventListener("click", () => {
        if (this.inspectedStrategy === strat.name) {
          this.inspectedStrategy = null; // Toggle back to optimal
        } else {
          this.inspectedStrategy = strat.name;
        }
        this.updateStrategyComparisonUI(sim);
        this.updateOptimizationBreakdownUI(sim);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });

      container.appendChild(card);
    });
  }

  /**
   * Updates Optimization Breakdown ('Why This Won') Table (Section 14 & 44)
   */
  updateOptimizationBreakdownUI(sim) {
    const container = document.getElementById("opt-breakdown-table");
    if (!container) return;

    const inspectedName = this.inspectedStrategy || (sim.nextBestAction && sim.nextBestAction.strategy) || "SUPER-CLIP";
    const isAlternative = Boolean(this.inspectedStrategy && this.inspectedStrategy !== (sim.nextBestAction && sim.nextBestAction.strategy));
    const b = (sim.nextBestAction && sim.nextBestAction.candidateBreakdowns && sim.nextBestAction.candidateBreakdowns[inspectedName]) || sim.optimizationBreakdown || {
      normalizedScore: sim.strategyScore || 85,
      totalRawScore: 51,
      immediateRaceGain: 18,
      positionBenefit: 11,
      futureEnergyValue: 12,
      recoveryValue: 14,
      overtakeValue: 15,
      tyrePerformanceValue: 14,
      pitStrategyValue: 6,
      undercutValue: 2,
      energyCost: 8,
      attackRisk: 3,
      defenceRisk: 2,
      futureOpportunityCost: 4,
      counterattackRisk: 3,
      pitLaneTimeLoss: 0,
      tyreDegradationCost: 3,
      trafficRisk: 1,
      rulePenalty: 0
    };

    const stratName = (sim.nextBestAction && sim.nextBestAction.strategy) || "SUPER-CLIP";
    const scoreVal = b.normalizedScore !== undefined ? b.normalizedScore : (sim.strategyScore || 85);

    const bannerHtml = isAlternative ? `
      <div class="breakdown-inspect-banner alternative">
        <span class="bib-tag">INSPECTING CANDIDATE: <strong>${inspectedName}</strong></span>
        <span class="bib-score">Score: ${scoreVal}/100</span>
        <span class="bib-hint">(Engine optimal remains ${stratName} at ${sim.strategyScore || 85}/100)</span>
      </div>
    ` : `
      <div class="breakdown-inspect-banner optimal">
        <span class="bib-tag">OPTIMAL RECOMMENDATION: <strong>${inspectedName}</strong></span>
        <span class="bib-score text-blue">Optimal Score: ${scoreVal}/100</span>
      </div>
    `;

    container.innerHTML = `
      ${bannerHtml}
      <div class="breakdown-row">
        <span class="breakdown-label">+ Immediate Race Gain</span>
        <span class="breakdown-val pos">+${b.immediateRaceGain || 18}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Position Benefit</span>
        <span class="breakdown-val pos">+${b.positionBenefit || 11}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Future Energy Value</span>
        <span class="breakdown-val pos">+${b.futureEnergyValue || 12}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Recovery Value</span>
        <span class="breakdown-val pos">+${b.recoveryValue || 14}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Overtake Value</span>
        <span class="breakdown-val pos">+${b.overtakeValue !== undefined ? b.overtakeValue : 15}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Tyre Performance Value</span>
        <span class="breakdown-val pos">+${b.tyrePerformanceValue !== undefined ? b.tyrePerformanceValue : 14}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Pit Strategy Value</span>
        <span class="breakdown-val pos">+${b.pitStrategyValue !== undefined ? b.pitStrategyValue : 6}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">+ Undercut/Overcut Value</span>
        <span class="breakdown-val pos">+${b.undercutValue !== undefined ? b.undercutValue : 2}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Energy Cost</span>
        <span class="breakdown-val neg">-${b.energyCost !== undefined ? b.energyCost : 8}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Attack Risk</span>
        <span class="breakdown-val neg">-${b.attackRisk !== undefined ? b.attackRisk : 3}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Defence Risk</span>
        <span class="breakdown-val neg">-${b.defenceRisk !== undefined ? b.defenceRisk : 2}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Future Opportunity Cost</span>
        <span class="breakdown-val neg">-${b.futureOpportunityCost !== undefined ? b.futureOpportunityCost : 4}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Counterattack Risk</span>
        <span class="breakdown-val neg">-${b.counterattackRisk !== undefined ? b.counterattackRisk : 3}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Pit Lane Time Loss</span>
        <span class="breakdown-val neg">-${b.pitLaneTimeLoss !== undefined ? b.pitLaneTimeLoss : 0}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Tyre Degradation Cost</span>
        <span class="breakdown-val neg">-${b.tyreDegradationCost !== undefined ? b.tyreDegradationCost : 3}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Traffic Risk</span>
        <span class="breakdown-val neg">-${b.trafficRisk !== undefined ? b.trafficRisk : 1}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">- Rule &amp; Constraint Penalty</span>
        <span class="breakdown-val neg">-${b.rulePenalty !== undefined ? b.rulePenalty : 0}</span>
      </div>
      <div class="breakdown-row total-row">
        <span class="breakdown-label"><strong>TOTAL STRATEGY SCORE (SEC 44)</strong></span>
        <span class="breakdown-val text-blue"><strong>${b.totalRawScore || 51} (Normalized: ${scoreVal}/100)</strong></span>
      </div>
    `;
  }

  /**
   * Updates Option A vs Option B Trade-off Comparison (Section 9)
   */
  updateTradeoffUI(sim) {
    const container = document.getElementById("tradeoff-comparison-box");
    if (!container) return;

    const t = sim.tradeoffComparison || {
      decisionMode: "SPEND_NOW",
      tactic: "DEPLOY NOW (SUPER-CLIP 350 kW)",
      optionA: {
        title: "OPTION A — SPEND NOW",
        zone: "Zone 5 (High-Speed Acceleration Straight)",
        overtakeProb: sim.overtakeProb || 87,
        energyRequiredMJ: 1.40,
        expectedGain: "+0.42 s",
        statsLabel: "Overtake: 87% | 1.40 MJ (Gain: +0.42s)",
        description: "Deploy discretionary electrical energy immediately in current attack window."
      },
      optionB: {
        title: "OPTION B — SAVE FOR LATER",
        zone: "Next Lap — Zone 5 (Main DRS Straight)",
        overtakeProb: 91,
        energyRequiredMJ: 1.40,
        expectedGain: "+0.45 s",
        statsLabel: "Overtake: 91% | 1.40 MJ (Gain: +0.45s)",
        description: "Preserve usable pack to guarantee maximum attack power on subsequent straight."
      },
      strategicWays: [],
      recommendation: "SPEND NOW",
      rationale: "Attacking now delivers superior immediate race value (+0.42s) while maintaining legal defensive reserve."
    };

    const isOptionA = t.recommendation === "SPEND NOW" || t.recommendation === "MAINTAIN PACE";
    const strats = t.strategicWays || [];
    const isLeader = (sim.centralRaceState && sim.centralRaceState.position === 1) || this.state.position === 1;
    const socVal = this.state.soc;
    const energyMJ = alpineDecisionEngine.socToMJ(socVal);
    const lapsRemaining = Math.max(1, 57 - this.state.currentLap);
    const res = alpineDecisionEngine.calculateReserveModel(energyMJ, this.state.carBehindGap, lapsRemaining, this.state.position);
    const freeEnergyMJ = Math.max(0, energyMJ - res.reserveMJ);

    const f = t.factors || {
      soc: {
        percent: socVal,
        energyMJ: energyMJ,
        reserveMJ: res.reserveMJ,
        freeEnergyMJ: freeEnergyMJ,
        action: socVal <= 28 ? "RECHARGE VIA MGU-K" : (socVal < 40 ? "CONSERVE BUFFER" : "DEPLOY ON ATTACK"),
        status: socVal <= 28 ? "CRITICALLY LOW (NOTHING TO SAVE)" : (socVal < 40 ? "CONSTRAINED" : (socVal >= 68 ? "SURPLUS" : "HEALTHY")),
        levelClass: socVal <= 28 ? "low" : (socVal < 40 ? "mid" : "high")
      },
      carAhead: {
        gap: isLeader ? null : this.state.carAheadGap,
        label: isLeader ? "RACE LEADER P1" : `${this.state.carAheadGap.toFixed(1)}s`,
        inDrsWindow: !isLeader && this.state.carAheadGap <= 1.0,
        status: isLeader ? "CLEAN AIR (N/A)" : (this.state.carAheadGap <= 0.8 ? "DRS ATTACK CONE (<=0.8s)" : (this.state.carAheadGap <= 1.0 ? "MARGINAL DRS (<=1.0s)" : "OUT OF RANGE (>1.0s)")),
        statusClass: isLeader ? "leader" : (this.state.carAheadGap <= 1.0 ? "drs" : "out")
      },
      carBehind: {
        gap: this.state.carBehindGap,
        label: `${this.state.carBehindGap.toFixed(1)}s`,
        hasDefensiveThreat: this.state.carBehindGap < 0.5,
        status: this.state.carBehindGap < 0.5 ? "DEFENSIVE THREAT (<0.5s)" : (this.state.carBehindGap < 1.0 ? "MODERATE PRESSURE" : "CLEAR AIR (SAFE >=1.0s)"),
        statusClass: this.state.carBehindGap < 0.5 ? "threat" : (this.state.carBehindGap < 1.0 ? "mid" : "safe")
      }
    };

    const prod = t.productivity || {
      isWorthwhile: socVal > 28,
      isProductive: socVal > 28,
      rating: socVal <= 28 ? "UNVIABLE (NOTHING TO SAVE — MUST RECHARGE)" : "HIGHLY PRODUCTIVE & WORTHWHILE",
      badgeClass: socVal <= 28 ? "unviable" : "worthwhile",
      worthwhileLabel: socVal <= 28 ? "NOT WORTHWHILE — NOTHING TO SAVE (0.00 MJ FREE) · RECHARGE MANDATORY" : "HIGHLY PRODUCTIVE & WORTHWHILE",
      energyROI: socVal <= 28 ? 0.0 : 0.30,
      roiLabel: socVal <= 28 ? "0.00 s/MJ (Pack At Floor — MGU-K Regen: +1.15 MJ)" : "+0.30 s/MJ (High Pass Yield)",
      assessment: socVal <= 28
        ? "Battery is depleted to reserve floor (0.00 MJ free energy); there is nothing to save and keeping constant is impossible. Active MGU-K kinetic recovery under braking is mandatory."
        : "Energy deployment is fully productive within current tactical window."
    };

    // Tactic badge styling
    const tactic = t.tactic || t.recommendation;
    let tacticClass = "deploy";
    if (tactic.includes("HARVEST") || tactic.includes("REGEN") || tactic.includes("RECHARGE")) tacticClass = "harvest";
    else if (tactic.includes("COAST") || tactic.includes("SAVE") || tactic.includes("GUARD")) tacticClass = "coast";
    else if (tactic.includes("PACE") || tactic.includes("LEAD")) tacticClass = "leader";

    const optAStats = t.optionA.statsLabel || `Overtake: ${t.optionA.overtakeProb}% | ${typeof t.optionA.energyRequiredMJ === 'number' ? t.optionA.energyRequiredMJ.toFixed(2) : t.optionA.energyRequiredMJ} MJ`;
    const optBStats = t.optionB.statsLabel || `Overtake: ${t.optionB.overtakeProb}% | ${typeof t.optionB.energyRequiredMJ === 'number' ? t.optionB.energyRequiredMJ.toFixed(2) : t.optionB.energyRequiredMJ} MJ`;

    const svs = sim.spendVsSaveOptimization || (sim.tradeoffComparison && sim.tradeoffComparison.spendVsSaveOptimization) || {
      spendNow: { expectedGain: 0.29, energyCostMJ: 1.40, futureOpportunityValue: -0.05, defenceRisk: 0.02, raceValue: 0.75 },
      saveForLater: { currentGain: 0.05, energyPreservedMJ: 1.40, futureOpportunityValue: 0.52, recoveryValue: 0.18, raceValue: 0.51 },
      delta: 0.24,
      winner: "Spend Now",
      winningMargin: 0.24,
      verdictLabel: "SPEND WINS BY +0.24",
      bestFutureOpportunity: { lap: 25, sector: 2, zoneNumber: 5, zoneName: "Hangar Straight", energyRequiredMJ: 1.40, expectedGainSec: 0.30, overtakeProbability: 86, futureEnergyValue: 0.52 },
      causalExplanation: "Attacking now delivers superior immediate race value."
    };

    const target = svs.bestFutureOpportunity || {
      lap: 25,
      sector: 2,
      zoneNumber: 5,
      zoneName: "Hangar Straight",
      energyRequiredMJ: 1.40,
      expectedGainSec: 0.30,
      overtakeProbability: 86,
      futureEnergyValue: 0.52
    };

    const isSpendWinning = svs.winner === "Spend Now";
    const isRecharge = svs.winner === "Harvest / Recharge";
    const verdictClass = isSpendWinning ? "winner-spend" : (isRecharge ? "winner-recharge" : "winner-save");

    container.innerHTML = `
      <!-- Live Causal Factors Bar: Battery SOC, Car Ahead, Car Behind -->
      <div class="tradeoff-factors-bar">
        <div class="tf-factor-chip tf-soc-${f.soc.levelClass}">
          <div class="tf-chip-top">
            <span class="tf-chip-title">BATTERY FACTOR (SOC)</span>
            <span class="tf-chip-badge ${f.soc.levelClass}">${f.soc.status}</span>
          </div>
          <div class="tf-chip-val">${f.soc.percent}% · ${f.soc.energyMJ.toFixed(1)} MJ (${(f.soc.energyMJ * 1e6).toLocaleString()} J)</div>
          <div class="tf-chip-sub">${f.soc.freeEnergyMJ <= 0.05 ? "Free: 0.00 MJ (0 J - At Floor) | Action: MGU-K RECHARGE" : `Free: +${f.soc.freeEnergyMJ.toFixed(2)} MJ (${Math.round(f.soc.freeEnergyMJ * 1e6).toLocaleString()} J) | Floor: ${f.soc.reserveMJ.toFixed(1)} MJ`}</div>
        </div>

        <div class="tf-factor-chip tf-ahead-${f.carAhead.statusClass}">
          <div class="tf-chip-top">
            <span class="tf-chip-title">CAR AHEAD CASE</span>
            <span class="tf-chip-badge ${f.carAhead.statusClass}">${f.carAhead.inDrsWindow ? "DRS ACTIVE" : (isLeader ? "LEAD" : "OUT OF RANGE")}</span>
          </div>
          <div class="tf-chip-val">${f.carAhead.label}</div>
          <div class="tf-chip-sub">${f.carAhead.status}</div>
        </div>

        <div class="tf-factor-chip tf-behind-${f.carBehind.statusClass}">
          <div class="tf-chip-top">
            <span class="tf-chip-title">CAR BEHIND CASE</span>
            <span class="tf-chip-badge ${f.carBehind.statusClass}">${f.carBehind.hasDefensiveThreat ? "PRESSURING" : "SAFE"}</span>
          </div>
          <div class="tf-chip-val">${f.carBehind.label}</div>
          <div class="tf-chip-sub">${f.carBehind.status}</div>
        </div>
      </div>

      <!-- Energy Productivity & Worthwhile Assessment Engine Strip -->
      <div class="tradeoff-productivity-strip ${prod.badgeClass}">
        <div class="tps-header">
          <div class="tps-left">
            <span class="tps-tag">ENERGY PRODUCTIVITY &amp; WORTHWHILE ASSESSMENT</span>
            <span class="tps-badge ${prod.badgeClass}">${prod.worthwhileLabel}</span>
          </div>
          <div class="tps-roi">
            <span class="tps-roi-title">ENERGY ROI:</span>
            <span class="tps-roi-val">${prod.roiLabel}</span>
          </div>
        </div>
        <div class="tps-desc">${prod.assessment}</div>
      </div>

      <!-- Real Counterfactual Optimization Card: SPEND NOW VS SAVE FOR LATER (Sections 4, 5, 6, 7, 15) -->
      <div class="spend-vs-save-container" id="spend-vs-save-box">
        <div class="svs-header">
          <div class="svs-title-group">
            <span class="svs-kicker">COUNTERFACTUAL HORIZON OPTIMIZATION (H = 5 LAPS)</span>
            <strong class="svs-main-title">SPEND NOW VS SAVE FOR LATER</strong>
          </div>
          <div class="svs-verdict-pill ${verdictClass}" id="svs-verdict-pill">${svs.verdictLabel}</div>
        </div>

        <div class="svs-grid">
          <!-- Column 1: SPEND NOW -->
          <div class="svs-card svs-spend-card ${isSpendWinning ? 'active-winner' : ''}" id="svs-spend-card">
            <div class="svs-card-hdr">
              <div class="svs-card-title">SPEND NOW (SCENARIO A)</div>
              <span class="svs-badge spend" id="svs-spend-badge">${isRecharge ? "UNVIABLE" : "CANDIDATE BURST"}</span>
            </div>
            <div class="svs-rows">
              <div class="svs-row"><span class="svs-label">Expected Gain</span><span class="svs-val ${svs.spendNow.expectedGain > 0 ? 'pos' : ''}" id="svs-sn-gain">+${svs.spendNow.expectedGain.toFixed(2)}s</span></div>
              <div class="svs-row"><span class="svs-label">Energy Cost</span><span class="svs-val neg" id="svs-sn-cost">-${svs.spendNow.energyCostMJ.toFixed(2)} MJ</span></div>
              <div class="svs-row"><span class="svs-label">Future Opportunity</span><span class="svs-val ${svs.spendNow.futureOpportunityValue < 0 ? 'neg' : ''}" id="svs-sn-fut">${svs.spendNow.futureOpportunityValue >= 0 ? "+" : ""}${svs.spendNow.futureOpportunityValue.toFixed(2)}</span></div>
              <div class="svs-row"><span class="svs-label">Defence Risk</span><span class="svs-val" id="svs-sn-def">${svs.spendNow.defenceRisk >= 0 ? "+" : ""}${svs.spendNow.defenceRisk.toFixed(2)}</span></div>
              <div class="svs-row svs-total"><span class="svs-label">RACE VALUE</span><strong class="svs-val svs-score" id="svs-sn-value">${svs.spendNow.raceValue.toFixed(2)}</strong></div>
            </div>
          </div>

          <!-- Column 2: SAVE FOR LATER -->
          <div class="svs-card svs-save-card ${!isSpendWinning ? 'active-winner' : ''}" id="svs-save-card">
            <div class="svs-card-hdr">
              <div class="svs-card-title">SAVE FOR LATER (SCENARIO B)</div>
              <span class="svs-badge save" id="svs-save-badge">${isRecharge ? "RECHARGE REQUIRED" : "PRESERVE &amp; RECOVER"}</span>
            </div>
            <div class="svs-rows">
              <div class="svs-row"><span class="svs-label">Current Gain</span><span class="svs-val" id="svs-sl-gain">+${svs.saveForLater.currentGain.toFixed(2)}s</span></div>
              <div class="svs-row"><span class="svs-label">Energy Preserved</span><span class="svs-val pos" id="svs-sl-pres">+${svs.saveForLater.energyPreservedMJ.toFixed(2)} MJ</span></div>
              <div class="svs-row"><span class="svs-label">Future Opportunity</span><span class="svs-val pos" id="svs-sl-fut">+${svs.saveForLater.futureOpportunityValue.toFixed(2)}</span></div>
              <div class="svs-row"><span class="svs-label">Recovery Value</span><span class="svs-val pos" id="svs-sl-rec">+${svs.saveForLater.recoveryValue.toFixed(2)}</span></div>
              <div class="svs-row svs-total"><span class="svs-label">RACE VALUE</span><strong class="svs-val svs-score" id="svs-sl-value">${svs.saveForLater.raceValue.toFixed(2)}</strong></div>
            </div>
          </div>
        </div>

        <!-- Best Future Opportunity & Causal Proof -->
        <div class="svs-target-banner" id="svs-target-banner">
          <div class="stb-left">
            <span class="stb-kicker">BEST FUTURE OPPORTUNITY (ROLLING HORIZON):</span>
            <strong class="stb-target" id="svs-best-target-text">Lap ${target.lap} → Sector ${target.sector} → Zone ${target.zoneNumber} (${target.zoneName})</strong>
            <span class="stb-stats" id="svs-best-target-stats">Energy: ${target.energyRequiredMJ.toFixed(2)} MJ | Gain: +${target.expectedGainSec.toFixed(2)}s | Pass Prob: ${target.overtakeProbability}% | Future Value: ${target.futureEnergyValue.toFixed(2)}</span>
          </div>
          <div class="stb-reason-box">
            <span class="stb-reason-label">MATHEMATICAL CAUSAL PROOF:</span>
            <span class="stb-reason-text" id="svs-causal-reason">${svs.causalExplanation}</span>
          </div>
        </div>
      </div>

      <div class="tradeoff-directive-bar">
        <div class="directive-left">
          <span class="directive-label">DECISION DIRECTIVE:</span>
          <span class="directive-badge ${tacticClass}">${tactic}</span>
        </div>
        <span class="directive-zone">${t.optionA.zone}</span>
      </div>

      <div class="tradeoff-split">
        <div class="tradeoff-col ${isOptionA ? "active-opt" : ""}">
          <div class="tradeoff-col-hdr">
            <div class="tradeoff-opt-title">${t.optionA.title}</div>
            <span class="opt-tag ${isOptionA ? "active" : ""}">${isOptionA ? "OPTIMAL CHOICE" : "ALTERNATIVE"}</span>
          </div>
          <div class="tradeoff-opt-sub">${t.optionA.zone}</div>
          <div class="tradeoff-opt-stats">${optAStats}</div>
          <div class="tradeoff-opt-desc">${t.optionA.description}</div>
        </div>
        <div class="tradeoff-col ${!isOptionA ? "active-opt" : ""}">
          <div class="tradeoff-col-hdr">
            <div class="tradeoff-opt-title">${t.optionB.title}</div>
            <span class="opt-tag ${!isOptionA ? "active" : ""}">${!isOptionA ? "OPTIMAL CHOICE" : "ALTERNATIVE"}</span>
          </div>
          <div class="tradeoff-opt-sub">${t.optionB.zone}</div>
          <div class="tradeoff-opt-stats">${optBStats}</div>
          <div class="tradeoff-opt-desc">${t.optionB.description}</div>
        </div>
      </div>

      <!-- 4 Strategic Ways Evaluation Strip -->
      <div class="tradeoff-4strats-section">
        <div class="tradeoff-4strats-title">4 STRATEGIC WAYS EVALUATION (BRAKING, SUPER-CLIP, NORMAL, COAST)</div>
        <div class="tradeoff-4strats-grid">
          ${strats.map(s => {
            const isRec = s.isRecommended;
            const isFeas = s.isFeasible;
            return `
              <div class="tradeoff-strat-pill ${isRec ? "recommended" : (isFeas ? "feasible" : "infeasible")}">
                <div class="tsp-header">
                  <span class="tsp-name">${s.shortName || s.name}</span>
                  <span class="tsp-score">${s.score} PTS</span>
                </div>
                <div class="tsp-power">${s.powerLabel || (s.powerKw > 0 ? `${s.powerKw} kW` : (s.powerKw < 0 ? "MGU-K REGEN" : "0 kW (LIFT)"))}</div>
                <div class="tsp-metrics">
                  <span class="tsp-energy ${s.energyDeltaMJ > 0 ? "pos" : "neg"}">${s.energyDeltaMJ > 0 ? "+" : ""}${s.energyDeltaMJ.toFixed(2)} MJ</span>
                  <span class="tsp-gain">${s.expectedGainLabel || `${s.expectedGainSec > 0 ? "+" : ""}${s.expectedGainSec.toFixed(2)}s`}</span>
                </div>
                <div class="tsp-status ${isRec ? "rec" : (isFeas ? "feas" : "infeas")}">${s.statusLabel || (isRec ? "RECOMMENDED" : (isFeas ? "FEASIBLE" : "INFEASIBLE"))}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div class="tradeoff-banner">
        <div class="tradeoff-banner-title">
          <span class="tb-icon">⚡</span>
          <strong>ENGINE RECOMMENDATION: ${t.recommendation}</strong>
        </div>
        <div class="tradeoff-banner-text">${t.rationale}</div>
      </div>
    `;
  }

  /**
   * Updates Current Zone Information (Section 18)
   */
  updateZoneInfoUI(sim) {
    const banner = document.getElementById("zone-telemetry-banner");
    const container = document.getElementById("zone-info-grid");
    if (!container) return;

    const z = sim.activeZoneInfo || {
      zoneNumber: 5,
      zoneId: "Z5",
      zoneName: "Hangar Straight",
      sector: 2,
      performancePotential: 95,
      overtakePotential: 92,
      recoveryPotential: 15,
      defenceValue: 40,
      energyEfficiency: 90,
      currentGap: this.state.carAheadGap || 0.7,
      closingSpeed: "HIGH"
    };

    if (banner) {
      const isAccel = z.performancePotential >= 75;
      banner.innerHTML = `
        <div class="ztb-left">
          <span class="ztb-pill">ZONE ${z.zoneNumber} (${z.zoneId})</span>
          <strong class="ztb-name">${z.zoneName} · SECTOR ${z.sector}</strong>
        </div>
        <span class="ztb-type-badge ${isAccel ? 'accel' : 'tech'}">${isAccel ? 'HIGH-SPEED ACCELERATION STRAIGHT' : 'TECHNICAL CORNERING / BRAKING ZONE'}</span>
      `;
    }

    const gapStr = typeof z.currentGap === 'number' ? z.currentGap.toFixed(1) : (this.state.carAheadGap ? this.state.carAheadGap.toFixed(1) : '0.7');

    container.innerHTML = `
      <div class="zone-metric-card">
        <span class="zone-metric-val">${z.performancePotential}/100</span>
        <span class="zone-metric-label">PERFORMANCE POTENTIAL</span>
        <div class="zone-mini-meter"><div class="zone-mini-meter-fill" style="width: ${z.performancePotential}%;"></div></div>
      </div>
      <div class="zone-metric-card">
        <span class="zone-metric-val text-green">${z.overtakePotential}/100</span>
        <span class="zone-metric-label">OVERTAKE POTENTIAL</span>
        <div class="zone-mini-meter"><div class="zone-mini-meter-fill fill-green" style="width: ${z.overtakePotential}%;"></div></div>
      </div>
      <div class="zone-metric-card">
        <span class="zone-metric-val">${z.recoveryPotential}/100</span>
        <span class="zone-metric-label">RECOVERY POTENTIAL</span>
        <div class="zone-mini-meter"><div class="zone-mini-meter-fill fill-amber" style="width: ${z.recoveryPotential}%;"></div></div>
      </div>
      <div class="zone-metric-card">
        <span class="zone-metric-val">${z.defenceValue}/100</span>
        <span class="zone-metric-label">DEFENCE VALUE</span>
        <div class="zone-mini-meter"><div class="zone-mini-meter-fill" style="width: ${z.defenceValue}%;"></div></div>
      </div>
      <div class="zone-metric-card">
        <span class="zone-metric-val">${z.energyEfficiency}/100</span>
        <span class="zone-metric-label">ENERGY EFFICIENCY</span>
        <div class="zone-mini-meter"><div class="zone-mini-meter-fill fill-cyan" style="width: ${z.energyEfficiency}%;"></div></div>
      </div>
      <div class="zone-metric-card">
        <span class="zone-metric-val text-blue">${z.closingSpeed}</span>
        <span class="zone-metric-label">CLOSING SPEED (${gapStr}s)</span>
        <div class="zone-mini-meter"><div class="zone-mini-meter-fill fill-blue" style="width: ${z.closingSpeed === 'HIGH' ? 85 : z.closingSpeed === 'MODERATE' ? 50 : 25}%;"></div></div>
      </div>
    `;
  }

  /**
   * Updates Constraint -> Decision -> Outcome Adaptation Pipeline (Section 22)
   */
  updateAdaptationUI(sim) {
    const flow = sim.adaptationFlow;
    if (!flow) return;

    const c1 = document.getElementById("adapt-c1");
    if (c1) c1.textContent = flow.constraint;
    const d1 = document.getElementById("adapt-desc-1");
    if (d1) d1.textContent = flow.constraintDesc;

    const c2 = document.getElementById("adapt-c2");
    if (c2) c2.textContent = flow.engineDetects;
    const d2 = document.getElementById("adapt-desc-2");
    if (d2) d2.textContent = flow.engineDetectsDesc;

    const c3 = document.getElementById("adapt-c3");
    if (c3) c3.textContent = flow.decision;
    const d3 = document.getElementById("adapt-desc-3");
    if (d3) d3.textContent = flow.decisionDesc;

    const c4 = document.getElementById("adapt-c4");
    if (c4) c4.textContent = flow.recovery;
    const d4 = document.getElementById("adapt-desc-4");
    if (d4) d4.textContent = flow.recoveryDesc;

    const c5 = document.getElementById("adapt-c5");
    if (c5) c5.textContent = flow.nextAttack;
    const d5 = document.getElementById("adapt-desc-5");
    if (d5) d5.textContent = flow.nextAttackDesc;

    const c6 = document.getElementById("adapt-c6");
    if (c6) c6.textContent = flow.outcome;
    const d6 = document.getElementById("adapt-desc-6");
    if (d6) d6.textContent = flow.outcomeDesc;
  }

  /**
   * Updates Multi-Lap Stepper (Zone -> Sector -> Lap -> Next Lap)
   */
  updateMultiLapTimeline(sim) {
    const container = document.getElementById("multi-lap-timeline");
    if (!container) return;

    container.innerHTML = "";
    const sampleSteps = sim.allSteps.slice(0, 12); // First 12 consecutive zones

    sampleSteps.forEach((step) => {
      const isHero = step === sim.nextBestAction;
      const card = document.createElement("div");
      card.className = `zone-step-card ${isHero ? "active-hero" : ""}`;

      const stratClass = step.strategy.toLowerCase().replace(/[^a-z]/g, "-");
      const deltaText = step.deployedMJ > 0
        ? `-${step.deployedMJ.toFixed(2)} MJ`
        : step.recoveredMJ > 0
        ? `+${step.recoveredMJ.toFixed(2)} MJ`
        : `0.0 MJ`;

      card.innerHTML = `
        <div class="step-lap">L${step.lap} S${step.sector}-Z${step.zoneNumber}</div>
        <div class="step-name">${step.zoneName.split(" ")[0]}</div>
        <div class="step-strat ${stratClass}">${step.strategy}</div>
        <div class="step-delta ${step.recoveredMJ > 0 ? 'text-green' : step.deployedMJ > 0 ? 'text-blue' : 'text-muted'}">${deltaText}</div>
        <div class="step-soc text-mono">${step.socAfter}% SOC</div>
        ${step.overtakeOccurred ? '<div class="step-pass-tag">PASS P2</div>' : ''}
      `;

      container.appendChild(card);
    });
  }

  /**
   * Updates 13 General Constraints Inspector Grid & Live Interconnection Summary
   */
  updateConstraintsMatrix(sim) {
    if (!sim || !sim.constraints13) return;

    // 1. Update Live Summary Header
    const summary = sim.constraintSummary || {
      limitingCount: 0,
      compliantCount: 13,
      activeDrivers: []
    };

    const countLimiting = document.getElementById("c-count-limiting");
    if (countLimiting) {
      countLimiting.textContent = `${summary.limitingCount} LIMITING`;
      countLimiting.className = summary.limitingCount > 0 ? "c-count-badge clamped" : "c-count-badge compliant";
    }

    const countCompliant = document.getElementById("c-count-compliant");
    if (countCompliant) {
      countCompliant.textContent = `${summary.compliantCount} COMPLIANT`;
    }

    const driverLabel = document.getElementById("c-active-driver-label");
    if (driverLabel) {
      if (summary.activeDrivers && summary.activeDrivers.length > 0) {
        driverLabel.innerHTML = `ACTIVE SLIDER DRIVERS: <strong>${summary.activeDrivers.join(", ")}</strong>`;
      } else {
        driverLabel.innerHTML = `ACTIVE SLIDER DRIVERS: <strong>Standard Envelope (All 13 Compliant)</strong>`;
      }
    }

    // 2. Populate Real-Time Quick Chips (C1 to C13)
    const quickChips = document.getElementById("constraints-quick-chips");
    if (quickChips) {
      quickChips.innerHTML = "";
      Object.values(sim.constraints13).forEach((c) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `c-chip-pill ${c.statusClass || "ok"}`;
        chip.title = `${c.id} (${c.name}): ${c.status} · Driven by ${c.driverSlider}`;
        chip.innerHTML = `<strong>${c.id}</strong> <span>${c.status.replace(/_/g, " ")}</span>`;
        chip.addEventListener("click", () => {
          if (!this.constraintsVisible) {
            const btn = document.getElementById("btn-toggle-constraints");
            if (btn) btn.click();
          }
          // Scroll to the card
          const targetCard = document.getElementById(`card-${c.id.toLowerCase()}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.style.outline = "2px solid var(--alpine-blue)";
            setTimeout(() => { targetCard.style.outline = ""; }, 1800);
          }
        });
        quickChips.appendChild(chip);
      });
    }

    // 3. Populate Full 13-Constraint Matrix Grid
    const container = document.getElementById("constraints-matrix-grid");
    if (!container) return;

    container.innerHTML = "";
    const cMap = sim.constraints13;

    Object.values(cMap).forEach((c) => {
      const item = document.createElement("div");
      item.className = "constraint-matrix-item";
      item.id = `card-${c.id.toLowerCase()}`;

      const badgeClass = c.type === "FIA RULE" ? "fia-tag" : c.type === "MODEL ESTIMATE" ? "est-tag" : "sim-tag";

      item.innerHTML = `
        <div class="c-item-header">
          <span class="c-id">${c.id} — ${c.name}</span>
          <span class="meta-tag ${badgeClass}">[${c.type}]</span>
        </div>
        <div class="c-status-row">
          <span class="c-status-pill ${c.statusClass || "ok"}">${c.status.replace(/_/g, " ")}</span>
        </div>
        <div class="c-driver-slider">⚡ Direct Driver: <strong>${c.driverSlider}</strong></div>
        <p class="c-desc">${c.description}</p>
      `;

      container.appendChild(item);
    });
  }

  /**
   * Updates Section K: Decision Trace (12 Points) & Internal Audit Matrix (Sections 43 & 44)
   */
  updateDecisionTraceAndAuditUI(sim) {
    if (!sim) return;

    // 1. Update Winner Badge
    const winnerBadge = document.getElementById("trace-winner-badge");
    if (winnerBadge && sim.nextBestAction) {
      winnerBadge.textContent = `OPTIMAL: ${sim.nextBestAction.strategy} (${sim.strategyScore || 82} PTS)`;
    }

    // 2. Populate 12-point Canonical Decision Trace (Section 44)
    const traceGrid = document.getElementById("trace-lines-grid");
    if (traceGrid && sim.decisionTrace) {
      traceGrid.innerHTML = "";
      sim.decisionTrace.forEach((line, idx) => {
        const item = document.createElement("div");
        item.className = "trace-line-item";

        const numSpan = document.createElement("span");
        numSpan.className = "trace-num";
        numSpan.textContent = `${idx + 1}.`;

        const textSpan = document.createElement("span");
        textSpan.className = "trace-text";
        textSpan.textContent = line.replace(/^\d+\.\s*/, "");

        item.appendChild(numSpan);
        item.appendChild(textSpan);
        traceGrid.appendChild(item);
      });
    }

    // 3. Populate Internal Audit Matrix (Section 43)
    const auditGrid = document.getElementById("audit-category-grid");
    if (auditGrid && sim.auditState) {
      const a = sim.auditState;
      auditGrid.innerHTML = "";

      const categories = [
        {
          title: "1. INPUT & CENTRAL RACE STATE",
          fields: [
            { label: "Current Lap", val: `Lap ${a.inputState.lap} / ${a.inputState.totalLaps}` },
            { label: "Laps Remaining", val: `${a.inputState.lapsRemaining ?? (57 - a.inputState.lap)} Laps` },
            { label: "Player Position", val: `P${a.inputState.position}` },
            { label: "Active Race Order", val: a.inputState.raceOrder ? a.inputState.raceOrder.map(c => `${c.id}(P${c.pos})`).join(" · ") : "N/A" },
            { label: "Track Condition", val: `${a.inputState.trackCondition || "DRY"}` },
            { label: "Constraint Level", val: `${a.inputState.constraintLevel}%` },
            { label: "Deployment Intensity", val: `${a.inputState.deploymentIntensity || "BALANCED"}` }
          ]
        },
        {
          title: "2. ENERGY MODEL & RESERVE",
          fields: [
            { label: "Current Energy", val: `${a.energyState.energyMJ.toFixed(2)} MJ` },
            { label: "Pack Capacity", val: `${a.energyState.usableEnergyMJ.toFixed(1)} MJ (SOC ${a.energyState.socPercent}%)` },
            { label: "Calculated Reserve", val: `${a.reserveState.reserveMJ.toFixed(2)} MJ` },
            { label: "Free Energy", val: `${a.freeEnergyState.freeEnergyMJ.toFixed(2)} MJ` },
            { label: "Safety Floor", val: `${a.reserveState.safetyFloorMJ.toFixed(2)} MJ` },
            { label: "Battery State", val: a.energyState.batteryState }
          ]
        },
        {
          title: "3. TYRE & PIT TELEMETRY",
          fields: [
            { label: "Compound & Age", val: `${a.tyreState.compoundId} (${a.tyreState.age} Laps)` },
            { label: "Tyre Performance", val: `${(a.tyreState.performanceFactor * 100).toFixed(1)}% (Grip: ${a.tyreState.grip}%)` },
            { label: "Degradation Level", val: a.tyreState.degradationLevel },
            { label: "Pit Loss", val: `${a.pitState.pitLoss.totalLossSec.toFixed(1)}s (${a.pitState.pitLoss.inPitWindow ? "IN WINDOW" : "OUT OF WINDOW"})` },
            { label: "Pit Window", val: `Laps ${a.pitState.pitWindow.windowStart}–${a.pitState.pitWindow.windowEnd}` },
            { label: "Undercut Delta", val: `${a.pitState.undercutOvercut.deltaGainSec > 0 ? "+" : ""}${a.pitState.undercutOvercut.deltaGainSec.toFixed(2)}s` }
          ]
        },
        {
          title: "4. RACE DYNAMICS & ATTACK",
          fields: [
            { label: "Gap to Car Ahead", val: a.inputState.position === 1 ? "LEAD (0.0s)" : `${a.attackState.gapAhead.toFixed(2)}s` },
            { label: "Closing Speed", val: `${(a.attackState.closingSpeed || 0).toFixed(2)} m/s` },
            { label: "Zone Attack Potential", val: `${a.zoneState.effectivePotential}/100` },
            { label: "Overtake Probability", val: `${(a.attackState.overtakeProbability * 100).toFixed(1)}%` },
            { label: "Straight Line Advantage", val: a.attackState.overtakeProbability > 0.6 ? "+0.45s / Lap" : "+0.10s / Lap" }
          ]
        },
        {
          title: "5. DEFENCE & RECOVERY",
          fields: [
            { label: "Gap to Car Behind", val: `${a.defenceState.gapBehind.toFixed(2)}s` },
            { label: "Defence Risk", val: `${(a.defenceState.defenceRisk * 100).toFixed(1)}%` },
            { label: "Defensive Reserve", val: `${a.defenceState.defenceReserveMJ.toFixed(2)} MJ` },
            { label: "Defensive Pressure", val: a.defenceState.hasDefensivePressure ? "CRITICAL (<0.5s)" : "MANAGEABLE" },
            { label: "Next MGU-K Recovery", val: `${a.recoveryState.zoneId} (in ${a.recoveryState.zonesAway} zones)` },
            { label: "Expected Recovery", val: `+${(a.recoveryState.expectedRecoveryMJ || 1.10).toFixed(2)} MJ` }
          ]
        },
        {
          title: "6. COUNTERFACTUAL OPTIMIZATION",
          fields: [
            { label: "Evaluated Candidates", val: `${a.candidateActions.length} Actions` },
            { label: "Infeasible Actions", val: a.candidateActions.filter(c => !c.breakdown.isFeasible || !c.breakdown.isLegal).map(c => c.name).join(", ") || "None" },
            { label: "Optimal Selection", val: a.finalDecision },
            { label: "Simulated Outcome", val: `P${a.simulatedOutcomes.positionBefore} → P${a.simulatedOutcomes.positionAfter}` },
            { label: "Outcome State", val: a.simulatedOutcomes.positionAfter > a.simulatedOutcomes.positionBefore ? "CONCEDED (DEFENCE FAILED)" : a.simulatedOutcomes.positionAfter < a.simulatedOutcomes.positionBefore ? "OVERTAKE SUCCESS" : "POSITION HELD" }
          ]
        }
      ];

      categories.forEach(cat => {
        const catCard = document.createElement("div");
        catCard.className = "audit-cat-card";
        catCard.innerHTML = `
          <div class="audit-cat-title">${cat.title}</div>
          <div class="audit-cat-rows">
            ${cat.fields.map(f => `
              <div class="audit-row">
                <span class="audit-lbl">${f.label}</span>
                <span class="audit-val">${f.val}</span>
              </div>
            `).join("")}
          </div>
        `;
        auditGrid.appendChild(catCard);
      });
    }
  }

  /**
   * Updates Pit Stop & Tyre Strategy Engine UI (Sections 29–42, 46, 47)
   */
  updateTyreAndPitUI(sim) {
    if (!sim || !sim.tyreState || !sim.pitLoss || !sim.pitWindow) return;

    const ts = sim.tyreState;
    const pl = sim.pitLoss;
    const pw = sim.pitWindow;
    const uo = sim.undercutOvercut;
    const pa = sim.pitActions || [];

    // 1. Sidebar PIT STRATEGY [AUTO] Summary Card (Section 46)
    const sbPlanned = document.getElementById("sb-pit-planned");
    if (sbPlanned) sbPlanned.textContent = `LAP ${pw.plannedPitLap}`;

    const sbWindow = document.getElementById("sb-pit-window");
    if (sbWindow) sbWindow.textContent = `LAP ${pw.windowStart}–${pw.windowEnd}`;

    const sbNextTyre = document.getElementById("sb-pit-next-tyre");
    if (sbNextTyre) sbNextTyre.textContent = sim.nextCompound;

    const sbPitLoss = document.getElementById("sb-pit-loss");
    if (sbPitLoss) sbPitLoss.textContent = `+${pl.totalPitLossSec.toFixed(1)}s (${pl.currentPosition}→${pl.predictedPositionAfterStop})`;

    // 2. Main Decision Card Tyre & Pit Badges & Cells (Section 47)
    const decTyreBadge = document.getElementById("dec-tyre-badge");
    if (decTyreBadge) decTyreBadge.textContent = `TYRE: ${ts.compoundId}`;

    const bestPitAction = pa.find((a) => a.isRecommended) || { name: "STAY OUT" };
    const decPitBadge = document.getElementById("dec-pit-badge");
    if (decPitBadge) {
      decPitBadge.textContent = `PIT: ${bestPitAction.name}`;
      decPitBadge.className = `strategy-pill pit-action ${bestPitAction.name === "PIT NOW" ? "active-pit" : ""}`;
    }

    const decTyreCond = document.getElementById("dec-tyre-cond");
    if (decTyreCond) {
      decTyreCond.textContent = `${ts.age} Laps | Grip ${ts.grip}% | ${ts.degradationLevel} DEG`;
      decTyreCond.className = ts.grip < 60 ? "param-val text-red" : ts.grip < 75 ? "param-val text-amber" : "param-val text-blue";
    }

    const decPitWindow = document.getElementById("dec-pit-window");
    if (decPitWindow) decPitWindow.textContent = `Lap ${pw.windowStart}–${pw.windowEnd} (Best: Lap ${pw.bestLap})`;

    const decPitLoss = document.getElementById("dec-pit-loss");
    if (decPitLoss) decPitLoss.textContent = `+${pl.totalPitLossSec.toFixed(1)}s (Rejoin ${pl.predictedPositionAfterStop})`;

    const decUndercut = document.getElementById("dec-undercut-val");
    if (decUndercut && uo) {
      decUndercut.textContent = `+${uo.undercutGainSec.toFixed(1)}s (${uo.viability})`;
      decUndercut.className = uo.viability === "HIGH" ? "param-val text-green" : "param-val text-blue";
    }

    // 3. Section D Cockpit: Pit Stop Loss Decomposition (Section 31)
    const circuitTag = document.getElementById("pit-circuit-tag");
    if (circuitTag) circuitTag.textContent = `SILVERSTONE: ${pl.totalPitLossSec.toFixed(1)}s LOSS`;

    const valStationary = document.getElementById("val-stationary-stop");
    if (valStationary) valStationary.textContent = `${pl.stationaryStopTimeSec.toFixed(1)} s`;

    const valTravel = document.getElementById("val-travel-loss");
    if (valTravel) valTravel.textContent = `${pl.pitLaneTravelLossSec.toFixed(1)} s`;

    const valTotalLoss = document.getElementById("val-total-pit-loss");
    if (valTotalLoss) {
      valTotalLoss.textContent = `${pl.totalPitLossSec.toFixed(1)} s`;
      valTotalLoss.className = pl.isVscOrSc ? "term-val text-green" : "term-val text-amber";
    }

    const valVscSavings = document.getElementById("val-vsc-savings");
    if (valVscSavings) {
      valVscSavings.textContent = pl.isVscOrSc
        ? `VSC Active (Saved ${pl.timeSavedUnderVscSec.toFixed(1)}s vs Normal)`
        : `Green Flag Standard`;
      valVscSavings.className = pl.isVscOrSc ? "term-sub text-green" : "term-sub";
    }

    const rejoinCurr = document.getElementById("rejoin-curr-pos");
    if (rejoinCurr) rejoinCurr.textContent = pl.currentPosition;

    const rejoinExit = document.getElementById("rejoin-exit-pos");
    if (rejoinExit) rejoinExit.textContent = pl.predictedPositionAfterStop;

    const rejoinDrop = document.getElementById("rejoin-drop");
    if (rejoinDrop) {
      rejoinDrop.textContent = `Drops ${pl.positionDrop} position${pl.positionDrop !== 1 ? "s" : ""} (~4.2s/car density)`;
    }

    const rejoinBreakeven = document.getElementById("rejoin-breakeven");
    if (rejoinBreakeven) rejoinBreakeven.textContent = `${pl.lapsToRecoverPace} LAPS`;

    // 4. Section D: Candidate Pit Actions (Section 32)
    const actionsGrid = document.getElementById("pit-actions-comparison-grid");
    if (actionsGrid && pa.length > 0) {
      actionsGrid.innerHTML = "";
      pa.forEach((act) => {
        const row = document.createElement("div");
        row.className = `pit-action-row ${act.isRecommended ? "recommended" : ""}`;

        const recTag = act.isRecommended ? `<span class="recommended-tag">✓ BEST</span>` : "";
        row.innerHTML = `
          <div class="par-name">
            <span>${act.name}</span>
            ${recTag}
          </div>
          <div class="par-details">
            Pos: <strong>${act.trackPosition}</strong> | Loss: <strong>+${act.immediateTimeCostSec.toFixed(1)}s</strong> | Tyres: <strong>${act.futureTyrePerformance}</strong>
          </div>
          <div class="par-score">
            <span>Score: ${act.score}/100</span>
          </div>
        `;
        actionsGrid.appendChild(row);
      });
    }

    // 5. Section D: Undercut & Overcut (Section 38, 39, 40)
    if (uo) {
      const ucGain = document.getElementById("cockpit-undercut-gain");
      if (ucGain) ucGain.textContent = `+${uo.undercutGainSec.toFixed(1)} s`;

      const ucViab = document.getElementById("cockpit-undercut-viability");
      if (ucViab) {
        ucViab.textContent = `VIABILITY: ${uo.viability}`;
        ucViab.className = `uc-tag ${uo.viability === "HIGH" ? "high" : "low"}`;
      }

      const ocGain = document.getElementById("cockpit-overcut-gain");
      if (ocGain) ocGain.textContent = `+${uo.overcutGainSec.toFixed(1)} s`;

      const ocViab = document.getElementById("cockpit-overcut-viability");
      if (ocViab) {
        ocViab.textContent = `VIABILITY: ${uo.overcutViability}`;
        ocViab.className = `uc-tag ${uo.overcutViability === "HIGH" ? "high" : "low"}`;
      }

      const winRange = document.getElementById("cockpit-window-range");
      if (winRange) winRange.textContent = `LAP ${pw.windowStart}–${pw.windowEnd}`;

      const winBest = document.getElementById("cockpit-window-best");
      if (winBest) winBest.textContent = `Best: Lap ${pw.bestLap}`;

      const ucSummary = document.getElementById("cockpit-undercut-summary");
      if (ucSummary) {
        ucSummary.textContent = `${uo.summary} ${pw.rationale}`;
      }
    }

    // 6. Section D: Tyre Telemetry Gauges (Section 33)
    const gripFill = document.getElementById("tg-grip-fill");
    if (gripFill) {
      gripFill.style.width = `${ts.grip}%`;
      gripFill.style.backgroundColor = ts.grip < 60 ? "#ef4444" : ts.grip < 75 ? "#f59e0b" : "#22c55e";
    }

    const gripVal = document.getElementById("tg-grip-val");
    if (gripVal) gripVal.textContent = `${ts.grip}/100`;

    const degLevel = document.getElementById("tg-deg-level");
    if (degLevel) degLevel.textContent = `${ts.degradationLevel} DEG`;

    const tempFill = document.getElementById("tg-temp-fill");
    if (tempFill) {
      const pct = Math.min(100, Math.round((ts.temperatureC / 140) * 100));
      tempFill.style.width = `${pct}%`;
    }

    const tempVal = document.getElementById("tg-temp-val");
    if (tempVal) tempVal.textContent = `${ts.temperatureC}°C`;

    // 7. Section D: Available Tyre Set Inventory (Section 35)
    const invBadgesContainer = document.getElementById("tyre-inventory-badges");
    if (invBadgesContainer && sim.tyreInventory) {
      invBadgesContainer.innerHTML = "";
      Object.entries(sim.tyreInventory).forEach(([comp, count]) => {
        const badge = document.createElement("div");
        const isCurrent = comp === ts.compoundId;
        const isNext = comp === sim.nextCompound;
        badge.className = `inv-badge ${isCurrent ? "active-compound" : ""}`;
        badge.innerHTML = `
          <span class="inv-name">${comp}</span>
          <span class="inv-count">${count} Sets</span>
          ${isCurrent ? '<span class="status-micro-tag text-blue">FITTED</span>' : isNext ? '<span class="status-micro-tag text-green">PLANNED</span>' : ''}
        `;
        invBadgesContainer.appendChild(badge);
      });
    }

    const mandStatus = document.getElementById("mandatory-compound-status");
    if (mandStatus) {
      mandStatus.textContent = `✓ Mandatory 2-Compound Rule: Currently on ${ts.compoundId}. Recommended next compound: ${sim.nextCompound}.`;
    }
  }

  /**
   * Updates 5-Lap Tactical Strategy Timeline (Section 48)
   */
  updateTacticalPlanUI(sim) {
    const container = document.getElementById("tactical-plan-container");
    if (!container || !sim.tacticalRacePlan) return;

    container.innerHTML = "";
    sim.tacticalRacePlan.forEach((step) => {
      const card = document.createElement("div");
      card.className = `tactical-step-card ${step.isCurrentLap ? "current" : ""} ${step.isPitLap ? "pit" : ""}`;

      const actionClass = step.shortAction.toLowerCase().replace(/[^a-z]/g, "-");
      const isNeg = step.energyDeltaMJ < 0;
      const isPos = step.energyDeltaMJ > 0;
      const deltaClass = isNeg ? "neg" : isPos ? "pos" : "neutral";
      const deltaText = step.energyDeltaLabel || (isNeg ? `${step.energyDeltaMJ.toFixed(1)} MJ` : isPos ? `+${step.energyDeltaMJ.toFixed(1)} MJ` : "0.0 MJ");
      const probText = step.metricLabel || (step.attackProbability ? `Attack prob: ${step.attackProbability}%` : step.note);

      card.innerHTML = `
        <div class="step-card-header">
          <span class="step-lap-badge">LAP ${step.lap}${step.isCurrentLap ? " [NOW]" : step.isPitLap ? " [BOX]" : ""}</span>
          <span class="step-action-pill ${actionClass}">${step.shortAction}</span>
        </div>
        <div class="step-zone-desc">${step.zone}</div>
        <div class="step-delta-stat ${deltaClass}">${deltaText}</div>
        <div class="step-prob-stat">${probText}</div>
        <div class="step-compound-badge">TYRE: ${step.compound}</div>
        <div class="step-note-text">${step.note}</div>
      `;

      container.appendChild(card);
    });
  }

  runSimulation() {
    if (this.isSimulating) return;
    this.isSimulating = true;

    const btnRun = document.getElementById("btn-run-simulation");
    if (btnRun) {
      btnRun.disabled = true;
      btnRun.textContent = "SIMULATING ENERGY FLOW...";
    }

    const action = this.latestSimulation.nextBestAction;
    const isPositionLost = this.latestSimulation.positionLost || false;
    const overtakeOccurred = this.latestSimulation.overtakeOccurred || (action.strategy === "SUPER-CLIP" && this.state.position > 1);

    // Animate the sequence on the 3-car track
    this.raceTrack.runSimulation(
      {
        strategy: action.strategy,
        initialSoc: this.latestSimulation.initialSoc,
        remainingSoc: this.latestSimulation.socAfterDeploy,
        overtakeOccurred: overtakeOccurred,
        isPositionLost: isPositionLost,
        success: action.strategy === "SUPER-CLIP"
      },
      () => {
        this.isSimulating = false;
        if (btnRun) {
          btnRun.disabled = false;
          btnRun.textContent = "▶ RUN ENERGY SIMULATION";
        }

        // Update status readout
        const statusBanner = document.getElementById("simulation-status-banner");
        if (statusBanner) {
          statusBanner.style.display = "flex";
          if (isPositionLost) {
            const oldPos = this.state.position;
            const newPos = Math.min(6, this.state.position + 1);
            statusBanner.textContent = `⚠ DEFENCE CONCEDED (P${oldPos} → P${newPos}) — Battery reserve depleted under high rear pressure. Rival overtook.`;
            statusBanner.className = "sim-status danger";
          } else if (overtakeOccurred) {
            const oldPos = this.state.position;
            const nextP = Math.max(1, this.state.position - 1);
            statusBanner.textContent = `⚡ OVERTAKE SUCCESS (P${oldPos} → P${nextP}) — ${action.deployedMJ.toFixed(2)} MJ deployed in ${action.zoneId}. Race gain +${this.latestSimulation.expectedGainSec.toFixed(2)}s.`;
            statusBanner.className = "sim-status success";
          } else if (action.strategy === "BRAKING / HARVEST") {
            statusBanner.textContent = `🔋 ENERGY RECOVERED (+${this.latestSimulation.expectedRecoveryMJ.toFixed(2)} MJ) in ${action.zoneId}. Pack replenished.`;
            statusBanner.className = "sim-status harvest";
          } else if (action.strategy === "COAST") {
            statusBanner.textContent = `🛡 ENERGY PRESERVED (${this.latestSimulation.socAfterDeploy}% SOC). Free energy protected for upcoming straight.`;
            statusBanner.className = "sim-status coast";
          } else {
            statusBanner.textContent = `✓ NORMAL DEPLOYMENT EXECUTED (${action.deployedMJ.toFixed(2)} MJ deployed). Pace maintained within reserve envelope.`;
            statusBanner.className = "sim-status normal";
          }
        }

        // Sections 11 & 12: Deployment decreases battery, recovery replenishes battery
        if (action.strategy === "BRAKING / HARVEST") {
          this.state.soc = this.latestSimulation.socAfterRecovery;
        } else {
          this.state.soc = this.latestSimulation.socAfterDeploy;
        }
        if (isPositionLost) {
          this.state.position = Math.min(6, this.state.position + 1);
          this.state.carBehindGap = 0.8;
          this.state.carAheadGap = 0.4;
        } else if (overtakeOccurred) {
          this.state.position = Math.max(1, this.state.position - 1);
          this.state.carAheadGap = 1.2;
          this.state.carBehindGap = 0.6;
        }
        const sliderSoc = document.getElementById("slider-soc");
        if (sliderSoc) sliderSoc.value = this.state.soc;
        this.recalculateSimulation();
      }
    );
  }

  loadDemoPreset() {
    // Reference scenario: Lap 24, Laps Remaining 33, P3, SOC 62%, Ahead 0.7s, Behind 1.4s, Intensity 75%, Constraint 25%
    this.state.currentLap = 24;
    this.state.lapsRemaining = 33;
    this.state.futureLaps = 3;
    this.state.position = 3;
    this.state.carAheadGap = 0.7;
    this.state.carBehindGap = 1.4;
    this.state.soc = 62;
    this.state.intensity = 75;
    this.state.constraintLevel = 25;
    this.state.compound = "MEDIUM";
    this.state.tyreAge = 12;
    this.state.trackCondition = "DRY";
    this.state.isVscOrSc = false;

    // Update DOM inputs
    const sliderLap = document.getElementById("slider-current-lap");
    const sliderRemaining = document.getElementById("slider-laps-remaining");
    const sliderFuture = document.getElementById("slider-future-laps");
    const sliderAhead = document.getElementById("slider-car-ahead");
    const sliderBehind = document.getElementById("slider-car-behind");
    const sliderSoc = document.getElementById("slider-soc");
    const sliderIntensity = document.getElementById("slider-intensity");
    const sliderConstraint = document.getElementById("slider-constraint");
    const sliderTyreAge = document.getElementById("slider-tyre-age");
    const chkVsc = document.getElementById("chk-vsc-sc");

    if (sliderLap) sliderLap.value = 24;
    if (sliderRemaining) sliderRemaining.value = 33;
    if (sliderFuture) sliderFuture.value = 3;
    if (sliderAhead) sliderAhead.value = 0.7;
    if (sliderBehind) sliderBehind.value = 1.4;
    if (sliderSoc) sliderSoc.value = 62;
    if (sliderIntensity) sliderIntensity.value = 75;
    if (sliderConstraint) sliderConstraint.value = 25;
    if (sliderTyreAge) sliderTyreAge.value = 12;
    if (chkVsc) chkVsc.checked = false;

    document.querySelectorAll(".pos-pill").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.position, 10) === 3);
    });

    document.querySelectorAll(".compound-pill").forEach((b) => {
      b.classList.toggle("active", b.dataset.compound === "MEDIUM");
    });

    document.querySelectorAll(".condition-pill").forEach((b) => {
      b.classList.toggle("active", b.dataset.condition === "DRY");
    });

    this.recalculateSimulation();
  }
}

// Auto-bootstrap
function bootstrapEnergyDeploymentApp() {
  const app = new EnergyDeploymentApp();
  app.init();
  window.__energyDeploymentApp = app;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapEnergyDeploymentApp);
} else {
  bootstrapEnergyDeploymentApp();
}
