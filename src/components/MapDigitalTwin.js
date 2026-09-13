/**
 * TRACKSHIFT — Map-First Silverstone Digital Twin (Sections 1, 2, 3, 15, 17, 19)
 *
 * Implements:
 *   - Dominant full-screen Silverstone GP SVG layout with generous clean space
 *   - 3 physical sectors (S1, S2, S3) with dynamic S2 yellow path coloration
 *   - Live moving cars with on-track anchored HUD callouts:
 *       * Player: YOU P6 | ERS 2.84 MJ
 *       * Target: TARGET P5 | GAP 0.72s
 *       * Delta: 0.72s ↓ CLOSING +6.8 km/h
 *       * Zone: HANGAR STRAIGHT // OVERTAKE ZONE
 *       * TrackShift Decision Badge: DEPLOY 286 kW (1.8s) | OVERTAKE 84% | COUNTER 19%
 */

import { SILVERSTONE_CIRCUIT, generateSplineSamples } from "../track/silverstone.js";
import { TRACK_SEGMENTS } from "../track/trackSegments.js";
import { getSectorColor } from "../track/sectors.js";

export class MapDigitalTwin {
  constructor(containerEl, onOpenDecisionDrawer, onOpenSettingsDrawer) {
    this.container = containerEl;
    this.onOpenDecisionDrawer = onOpenDecisionDrawer;
    this.onOpenSettingsDrawer = onOpenSettingsDrawer;
    this.splineData = generateSplineSamples(SILVERSTONE_CIRCUIT.nodes, 32);
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="map-digital-twin-stage">
        <!-- SVG Circuit Canvas -->
        <svg id="silverstone-master-svg" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid meet" class="circuit-svg-canvas">
          <defs>
            <filter id="circuit-neon" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="car-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Circuit Foundation Asphalt / Runoff -->
          <path id="svg-track-bed" fill="none" stroke="#0a1226" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />
          <path id="svg-track-surface" fill="none" stroke="#101e3b" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
          <path id="svg-racing-line" fill="none" stroke="#060c1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />

          <!-- 3 Physical Sectors (Section 2 & 17) -->
          <path id="svg-sec-1" fill="none" stroke="#168bff" stroke-width="8" stroke-linecap="round" filter="url(#circuit-neon)" opacity="0.95" />
          <path id="svg-sec-2" fill="none" stroke="#7928ca" stroke-width="8" stroke-linecap="round" filter="url(#circuit-neon)" opacity="0.95" />
          <path id="svg-sec-3" fill="none" stroke="#e10600" stroke-width="8" stroke-linecap="round" filter="url(#circuit-neon)" opacity="0.95" />

          <!-- Subtle Sector Demarcations -->
          <g id="svg-sector-markers">
            <g transform="translate(370, 580)">
              <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ffffff" stroke-width="2" opacity="0.6" />
              <text x="12" y="4" fill="#a0aec0" font-size="10" font-weight="700" font-family="'JetBrains Mono', monospace">S1|S2</text>
            </g>
            <g transform="translate(670, 230)">
              <line x1="-8" y1="8" x2="8" y2="-8" stroke="#ffffff" stroke-width="2" opacity="0.6" />
              <text x="12" y="-4" fill="#a0aec0" font-size="10" font-weight="700" font-family="'JetBrains Mono', monospace">S2|S3</text>
            </g>
          </g>

          <!-- Strategic Straights Markers -->
          <g id="svg-straights-markers">
            <text x="730" y="490" text-anchor="middle" fill="#4a5568" font-size="9" font-weight="700" font-family="'Chakra Petch', sans-serif">START / FINISH</text>
            <text x="250" y="625" text-anchor="middle" fill="#4a5568" font-size="9" font-weight="700" font-family="'Chakra Petch', sans-serif">WELLINGTON STRAIGHT</text>
            <text x="750" y="325" text-anchor="middle" fill="#4a5568" font-size="9" font-weight="700" font-family="'Chakra Petch', sans-serif">HANGAR STRAIGHT</text>
          </g>

          <!-- Corner Nodes Dots -->
          <g id="svg-corner-dots">
            ${this.renderCornerDots()}
          </g>

          <!-- Live Moving Cars (Section 2 & 3) -->
          <g id="svg-cars-layer">
            <!-- Background Pack -->
            <circle id="map-car-p1" cx="0" cy="0" r="5" fill="#718096" />
            <circle id="map-car-p2" cx="0" cy="0" r="5" fill="#718096" />
            <circle id="map-car-p8" cx="0" cy="0" r="5" fill="#4a5568" />

            <!-- Car Behind (SAI P7) -->
            <circle id="map-car-p7" cx="0" cy="0" r="6.5" fill="#168bff" stroke="#ffffff" stroke-width="1.5" />

            <!-- Target Ahead (LEC P5) -->
            <circle id="map-car-p5" cx="0" cy="0" r="8" fill="#ffd700" stroke="#ffffff" stroke-width="2" filter="url(#car-glow)" />

            <!-- Player (YOU P6) -->
            <circle id="map-car-p6-pulse" cx="0" cy="0" r="14" fill="none" stroke="#e10600" stroke-width="2" opacity="0.5" />
            <circle id="map-car-p6" cx="0" cy="0" r="9" fill="#e10600" stroke="#ffffff" stroke-width="2.5" filter="url(#car-glow)" />
          </g>
        </svg>

        <!-- =======================================================
             ON-TRACK ANCHORED CONTEXTUAL HUD CALLOUTS (Section 3)
             ======================================================= -->
        <!-- 1. Player HUD (Near YOU P6) -->
        <div class="hud-anchor hud-player" id="hud-player">
          <div class="hud-tag hud-tag-player">YOU P6</div>
          <div class="hud-ers-val" id="hud-player-ers">ERS 2.84 MJ</div>
        </div>

        <!-- 2. Target HUD (Near TARGET P5) -->
        <div class="hud-anchor hud-target" id="hud-target">
          <div class="hud-tag hud-tag-target">TARGET P5</div>
          <div class="hud-gap-val" id="hud-target-gap">GAP 0.72s</div>
        </div>

        <!-- 3. Between Cars: Closing Rate HUD -->
        <div class="hud-anchor hud-delta" id="hud-delta">
          <span class="hud-delta-gap" id="hud-delta-gap">0.72s</span>
          <span class="hud-delta-arrow">↓</span>
          <span class="hud-delta-speed" id="hud-delta-closing">CLOSING +6.8 km/h</span>
        </div>

        <!-- 4. Strategic Zone HUD (Section 1) -->
        <div class="hud-zone-indicator" id="hud-zone">
          <span class="zone-name" id="hud-zone-name">HANGAR STRAIGHT</span>
          <span class="zone-badge" id="hud-zone-type">OVERTAKE ZONE</span>
        </div>

        <!-- 5. Main Map Decision HUD Callout (Section 3 & 15) -->
        <div class="hud-decision-badge" id="hud-decision-badge">
          <div class="dec-header">
            <span class="dec-brand">TRACKSHIFT</span>
            <span class="dec-status-pill" id="hud-dec-status">FEASIBLE</span>
          </div>

          <div class="dec-action-main">
            <strong class="dec-action-title" id="hud-dec-action">DEPLOY</strong>
            <div class="dec-action-specs">
              <span class="dec-power text-cyan" id="hud-dec-power">286 kW</span>
              <span class="dec-duration" id="hud-dec-duration">1.8s</span>
            </div>
          </div>

          <div class="dec-metrics-row">
            <div class="dec-metric">
              <span class="dm-label">OVERTAKE</span>
              <strong class="dm-val text-green" id="hud-dec-overtake">84%</strong>
            </div>
            <div class="dec-metric">
              <span class="dm-label">COUNTER</span>
              <strong class="dm-val text-yellow" id="hud-dec-counter">19%</strong>
            </div>
          </div>

          <div class="dec-why-snippet">
            <span class="why-label">WHY?</span>
            <span class="why-body" id="hud-dec-why">Best feasible balance under constraints</span>
          </div>

          <button class="btn-view-decision-inline" id="btn-open-decision">
            VIEW DECISION →
          </button>
        </div>

        <!-- 6. Race Condition Banner (Section 17) -->
        <div class="map-race-condition-pill flag-green" id="map-race-condition">
          <span class="condition-dot">●</span>
          <span id="map-condition-text">GREEN FLAG</span>
        </div>

        <!-- 7. Future Opportunity Peek (Section 8) -->
        <div class="future-opp-peek" id="future-opp-peek">
          <span class="fo-label">NEXT OPPORTUNITY:</span>
          <strong class="fo-zone" id="fo-zone">STOWE (18.2s)</strong>
          <span class="fo-prob text-green" id="fo-prob">91%</span>
        </div>
      </div>
    `;

    this.mountTrackPaths();
    this.bindEvents();
  }

  mountTrackPaths() {
    const samples = this.splineData.samples;
    const total = samples.length;

    const s1Pts = [];
    const s2Pts = [];
    const s3Pts = [];

    samples.forEach((pt, i) => {
      const frac = i / total;
      if (frac < 0.28) s1Pts.push(pt);
      else if (frac < 0.71) s2Pts.push(pt);
      else s3Pts.push(pt);
    });

    if (s1Pts.length > 0 && s2Pts.length > 0) s2Pts.unshift(s1Pts[s1Pts.length - 1]);
    if (s2Pts.length > 0 && s3Pts.length > 0) s3Pts.unshift(s2Pts[s2Pts.length - 1]);
    if (s3Pts.length > 0 && s1Pts.length > 0) s1Pts.unshift(s3Pts[s3Pts.length - 1]);

    const pathD = (pts) => {
      if (!pts || pts.length === 0) return "";
      return pts.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
    };

    const dS1 = pathD(s1Pts);
    const dS2 = pathD(s2Pts);
    const dS3 = pathD(s3Pts);
    const dFull = samples.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "") + " Z";

    const setAttr = (id, attr, val) => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.setAttribute(attr, val);
    };

    setAttr("svg-track-bed", "d", dFull);
    setAttr("svg-track-surface", "d", dFull);
    setAttr("svg-racing-line", "d", dFull);
    setAttr("svg-sec-1", "d", dS1);
    setAttr("svg-sec-2", "d", dS2);
    setAttr("svg-sec-3", "d", dS3);
  }

  renderCornerDots() {
    const cornerSegments = TRACK_SEGMENTS.filter(s => s.type === "corner");
    return cornerSegments.map(seg => {
      const pos = seg.pos || { x: 500, y: 300 };
      return `
        <g class="corner-dot-group" transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="3" fill="#2d3748" stroke="#4a5568" stroke-width="1" />
          <text x="0" y="${pos.y > 400 ? 12 : -6}" text-anchor="middle" fill="#718096" font-size="7.5" font-family="'Chakra Petch', sans-serif">
            ${seg.name.toUpperCase()}
          </text>
        </g>
      `;
    }).join("");
  }

  bindEvents() {
    const btn = this.container.querySelector("#btn-open-decision");
    if (btn) {
      btn.addEventListener("click", () => {
        if (this.onOpenDecisionDrawer) this.onOpenDecisionDrawer();
      });
    }

    const badge = this.container.querySelector("#hud-decision-badge");
    if (badge) {
      badge.addEventListener("click", (e) => {
        if (!e.target.closest("#btn-open-decision")) {
          if (this.onOpenDecisionDrawer) this.onOpenDecisionDrawer();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // DYNAMIC RENDER TICK
  // -------------------------------------------------------------
  render(state) {
    if (!state) return;

    const samples = this.splineData.samples;
    const totalSamples = samples.length;

    const getCoordForProg = (prog) => {
      const norm = ((prog % 1) + 1) % 1;
      const idx = Math.min(totalSamples - 1, Math.floor(norm * totalSamples));
      return samples[idx] || { x: 500, y: 300 };
    };

    // 1. Move Player (P6 YOU)
    const p6Pt = getCoordForProg(state.trackProgress ?? 0.74);
    const p6Car = this.container.querySelector("#map-car-p6");
    const p6Pulse = this.container.querySelector("#map-car-p6-pulse");
    if (p6Car) { p6Car.setAttribute("cx", p6Pt.x); p6Car.setAttribute("cy", p6Pt.y); }
    if (p6Pulse) { p6Pulse.setAttribute("cx", p6Pt.x); p6Pulse.setAttribute("cy", p6Pt.y); }

    // Position Player HUD Callout
    const hudPlayer = this.container.querySelector("#hud-player");
    if (hudPlayer) {
      hudPlayer.style.left = `${(p6Pt.x / 1000) * 100}%`;
      hudPlayer.style.top = `${(p6Pt.y / 650) * 100}%`;
      const ersEl = hudPlayer.querySelector("#hud-player-ers");
      if (ersEl) ersEl.textContent = `ERS ${(state.currentEnergy ?? 2.84).toFixed(2)} MJ`;
      const tagEl = hudPlayer.querySelector(".hud-tag-player");
      if (tagEl) tagEl.textContent = `YOU P${state.position ?? 6}`;
    }

    // 2. Move Target Ahead (P5 LEC)
    const targetCar = (state.cars || []).find(c => c.isTarget) || { prog: (state.trackProgress + 0.02) % 1.0 };
    const p5Pt = getCoordForProg(targetCar.prog);
    const p5Car = this.container.querySelector("#map-car-p5");
    if (p5Car) { p5Car.setAttribute("cx", p5Pt.x); p5Car.setAttribute("cy", p5Pt.y); }

    // Position Target HUD Callout
    const hudTarget = this.container.querySelector("#hud-target");
    if (hudTarget) {
      hudTarget.style.left = `${(p5Pt.x / 1000) * 100}%`;
      hudTarget.style.top = `${(p5Pt.y / 650) * 100}%`;
      const gapEl = hudTarget.querySelector("#hud-target-gap");
      if (gapEl) gapEl.textContent = `GAP ${(state.gapAhead ?? 0.72).toFixed(2)}s`;
      const tagEl = hudTarget.querySelector(".hud-tag-target");
      if (tagEl) tagEl.textContent = `TARGET P${state.targetPosition ?? 5}`;
    }

    // 3. Between Cars: Closing Rate HUD
    const hudDelta = this.container.querySelector("#hud-delta");
    if (hudDelta) {
      const midX = (p6Pt.x + p5Pt.x) / 2;
      const midY = (p6Pt.y + p5Pt.y) / 2;
      hudDelta.style.left = `${(midX / 1000) * 100}%`;
      hudDelta.style.top = `${(midY / 650) * 100}%`;
      const gapEl = hudDelta.querySelector("#hud-delta-gap");
      const closingEl = hudDelta.querySelector("#hud-delta-closing");
      if (gapEl) gapEl.textContent = `${(state.gapAhead ?? 0.72).toFixed(2)}s`;
      if (closingEl) closingEl.textContent = `CLOSING +${(state.closingSpeed ?? 6.8).toFixed(1)} km/h`;
    }

    // Move Car Behind (P7 SAI)
    const behindCar = (state.cars || []).find(c => c.isBehind) || { prog: (state.trackProgress - 0.04) % 1.0 };
    const p7Pt = getCoordForProg(behindCar.prog);
    const p7Car = this.container.querySelector("#map-car-p7");
    if (p7Car) { p7Car.setAttribute("cx", p7Pt.x); p7Car.setAttribute("cy", p7Pt.y); }

    // Move Background Pack
    const bgP1 = (state.cars || []).find(c => c.id === "p1");
    if (bgP1) {
      const pt = getCoordForProg(bgP1.prog);
      const c = this.container.querySelector("#map-car-p1");
      if (c) { c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); }
    }
    const bgP2 = (state.cars || []).find(c => c.id === "p2");
    if (bgP2) {
      const pt = getCoordForProg(bgP2.prog);
      const c = this.container.querySelector("#map-car-p2");
      if (c) { c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); }
    }

    // 4. Update Sector 2 Path Color (Section 17: Yellow Flag)
    const s2Path = this.container.querySelector("#svg-sec-2");
    if (s2Path) {
      const color = getSectorColor(2, state.raceControl, state.yellowSector);
      s2Path.setAttribute("stroke", color);
      s2Path.setAttribute("stroke-width", color === "#ffd700" ? "11" : "8");
    }

    // 5. Update Strategic Zone Callout (Section 1)
    const zoneName = this.container.querySelector("#hud-zone-name");
    const zoneType = this.container.querySelector("#hud-zone-type");
    if (zoneName) zoneName.textContent = (state.currentSegmentName || "HANGAR STRAIGHT").toUpperCase();
    if (zoneType) zoneType.textContent = state.strategicZoneType || "OVERTAKE ZONE";

    // 6. Update Decision Badge (Section 15)
    const d = state.decision || {};
    const decAction = this.container.querySelector("#hud-dec-action");
    const decPower = this.container.querySelector("#hud-dec-power");
    const decDuration = this.container.querySelector("#hud-dec-duration");
    const decOvertake = this.container.querySelector("#hud-dec-overtake");
    const decCounter = this.container.querySelector("#hud-dec-counter");
    const decWhy = this.container.querySelector("#hud-dec-why");
    const decStatus = this.container.querySelector("#hud-dec-status");

    if (decAction) decAction.textContent = d.action || "DEPLOY";
    if (decPower) decPower.textContent = d.powerKw > 0 ? `${d.powerKw} kW` : "0 kW";
    if (decDuration) decDuration.textContent = d.powerKw > 0 ? `${d.duration}s` : "HARVEST";
    if (decOvertake) decOvertake.textContent = `${Math.round((state.overtakeProbability ?? 0.84) * 100)}%`;
    if (decCounter) decCounter.textContent = `${Math.round((state.counterRisk ?? 0.19) * 100)}%`;
    if (decWhy) decWhy.textContent = d.why || "Best feasible balance under constraints";
    if (decStatus) {
      decStatus.textContent = d.status || "FEASIBLE";
      decStatus.className = d.status === "FEASIBLE" ? "dec-status-pill pill-feasible" : "dec-status-pill pill-restricted";
    }

    // 7. Race Condition Indicator (Section 17)
    const condPill = this.container.querySelector("#map-race-condition");
    const condText = this.container.querySelector("#map-condition-text");
    if (condPill && condText) {
      if (state.raceControl === "SAFETY_CAR" || state.safetyCar) {
        condPill.className = "map-race-condition-pill flag-safety-car";
        condText.textContent = "SAFETY CAR";
      } else if (state.raceControl === "VSC" || state.vsc) {
        condPill.className = "map-race-condition-pill flag-vsc";
        condText.textContent = "VSC ACTIVE";
      } else if (state.raceControl === "YELLOW" || state.raceControl === "YELLOW_S2" || state.yellowSector) {
        condPill.className = "map-race-condition-pill flag-yellow";
        condText.textContent = "S2 YELLOW";
      } else {
        condPill.className = "map-race-condition-pill flag-green";
        condText.textContent = "GREEN FLAG";
      }
    }
  }
}
