/**
 * RACE TWIN — Track Digital Twin Component (Sections 5–12)
 *
 * Implements:
 *   - Accurate Silverstone SVG geometry
 *   - 3 distinct physical sectors (S1, S2, S3) with subtle engineering colors
 *   - Physical sector color change when S2 is yellow (Section 7)
 *   - Corner labels (Abbey, Farm, Village, The Loop, Aintree, Brooklands, Luffield,
 *     Woodcote, Copse, Maggotts, Becketts, Chapel, Stowe, Vale, Club) (Section 8)
 *   - Straights marked: Start/Finish, Wellington Straight, Hangar Straight (Section 9)
 *   - Dynamic attack zones (HIGH, MEDIUM, LOW, NO ATTACK) (Section 10)
 *   - Cars: YOU (P4), TARGET (P3), BEHIND (P5), plus background pack (Section 12)
 *   - Interactive corner click tooltip (Section 8)
 */

import { SILVERSTONE_CIRCUIT, generateSplineSamples } from "../track/silverstone.js";
import { TRACK_SEGMENTS, getSegmentById } from "../track/trackSegments.js";
import { getSectorColor } from "../track/sectors.js";

export class TrackTwin {
  constructor(containerEl, onSegmentSelect) {
    this.container = containerEl;
    this.onSegmentSelect = onSegmentSelect;
    this.splineData = generateSplineSamples(SILVERSTONE_CIRCUIT.nodes, 32);
    this.selectedSegment = null;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="track-twin-wrapper" style="position: relative; width: 100%; height: 100%;">
        <!-- Track Header Strip -->
        <div class="track-status-bar">
          <div class="track-status-left">
            <span class="track-circuit-tag">SILVERSTONE GP</span>
            <span class="track-segment-pill" id="track-current-segment">HANGAR STRAIGHT</span>
          </div>
          <div class="track-sectors-indicator">
            <span class="sec-badge sec-badge-s1" id="track-badge-s1">S1</span>
            <span class="sec-badge sec-badge-s2" id="track-badge-s2">S2</span>
            <span class="sec-badge sec-badge-s3" id="track-badge-s3">S3</span>
          </div>
          <div class="track-legend-compact">
            <span class="leg-item"><span class="leg-dot red-dot">●</span> YOU (P4)</span>
            <span class="leg-item"><span class="leg-dot yellow-dot">●</span> TARGET (P3)</span>
            <span class="leg-item"><span class="leg-dot blue-dot">●</span> BEHIND (P5)</span>
          </div>
        </div>

        <!-- SVG Track Canvas -->
        <div class="track-svg-container" id="track-svg-mount" style="width: 100%; height: calc(100% - 34px);"></div>

        <!-- Corner Click Tooltip Overlay (Section 8) -->
        <div class="corner-tooltip-card hidden" id="corner-tooltip">
          <div class="tooltip-header">
            <span class="tt-title" id="tt-name">COPSE</span>
            <span class="tt-sector" id="tt-sector">SECTOR 1</span>
            <button class="tt-close-btn" id="tt-close">&times;</button>
          </div>
          <div class="tooltip-type" id="tt-type">CORNER</div>
          <div class="tooltip-grid">
            <div class="tt-row">
              <span class="tt-label">ATTACK POTENTIAL</span>
              <strong class="tt-val" id="tt-potential">LOW (31%)</strong>
            </div>
            <div class="tt-row">
              <span class="tt-label">RISK</span>
              <strong class="tt-val tt-risk-high" id="tt-risk">HIGH (88%)</strong>
            </div>
            <div class="tt-row">
              <span class="tt-label">RECOMMENDATION</span>
              <strong class="tt-val tt-rec" id="tt-rec">SAVE</strong>
            </div>
          </div>
          <div class="tooltip-desc" id="tt-desc">High-g apex. Passing offline carries extreme vortex disturbance.</div>
        </div>
      </div>
    `;

    this.mountSvg();
    this.bindEvents();
  }

  mountSvg() {
    const mount = this.container.querySelector("#track-svg-mount");
    if (!mount) return;

    const samples = this.splineData.samples;
    const total = samples.length;

    // Separate samples into Sector 1, 2, 3 paths
    // S1: 0 .. ~28%, S2: ~28% .. ~71%, S3: ~71% .. 100%
    const s1Pts = [];
    const s2Pts = [];
    const s3Pts = [];

    samples.forEach((pt, i) => {
      const frac = i / total;
      if (frac < 0.28) {
        s1Pts.push(pt);
      } else if (frac < 0.71) {
        s2Pts.push(pt);
      } else {
        s3Pts.push(pt);
      }
    });

    // Make paths overlap slightly at boundaries for seamless connectivity
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

    mount.innerHTML = `
      <svg id="silverstone-svg" viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; display: block;">
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="car-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Circuit Runoff & Track Bed Base -->
        <path d="${dFull}" fill="none" stroke="#0d182e" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${dFull}" fill="none" stroke="#142445" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${dFull}" fill="none" stroke="#0a1224" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />

        <!-- 3 PHYSICAL SECTORS (Section 7) -->
        <!-- Sector 1 Path -->
        <path id="svg-sector-1" d="${dS1}" fill="none" stroke="#168bff" stroke-width="8" stroke-linecap="round" filter="url(#neon-glow)" opacity="0.95" />
        
        <!-- Sector 2 Path (turns bright caution yellow on incident!) -->
        <path id="svg-sector-2" d="${dS2}" fill="none" stroke="#00f0ff" stroke-width="8" stroke-linecap="round" filter="url(#neon-glow)" opacity="0.95" />
        
        <!-- Sector 3 Path -->
        <path id="svg-sector-3" d="${dS3}" fill="none" stroke="#e10600" stroke-width="8" stroke-linecap="round" filter="url(#neon-glow)" opacity="0.95" />

        <!-- Physical Sector Boundary Markers (Section 7) -->
        <!-- S1 | S2 Boundary at Wellington entry -->
        <g class="boundary-marker" transform="translate(370, 580)">
          <line x1="-12" y1="-12" x2="12" y2="12" stroke="#ffffff" stroke-width="3" />
          <text x="16" y="5" fill="#ffffff" font-size="11" font-weight="700" font-family="'JetBrains Mono', monospace">S1|S2</text>
        </g>
        <!-- S2 | S3 Boundary at Hangar entry -->
        <g class="boundary-marker" transform="translate(670, 230)">
          <line x1="-12" y1="12" x2="12" y2="-12" stroke="#ffffff" stroke-width="3" />
          <text x="16" y="-5" fill="#ffffff" font-size="11" font-weight="700" font-family="'JetBrains Mono', monospace">S2|S3</text>
        </g>

        <!-- MARKED STRAIGHTS (Section 9) -->
        <!-- Start / Finish -->
        <g class="straight-label" transform="translate(730, 480)">
          <rect x="-65" y="-12" width="130" height="22" rx="4" fill="rgba(7, 11, 23, 0.85)" stroke="#168bff" stroke-width="1" />
          <text x="0" y="3" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700" font-family="'Chakra Petch', sans-serif">START / FINISH</text>
        </g>
        <!-- Wellington Straight -->
        <g class="straight-label" transform="translate(240, 620)">
          <rect x="-75" y="-12" width="150" height="22" rx="4" fill="rgba(7, 11, 23, 0.85)" stroke="#00f0ff" stroke-width="1" />
          <text x="0" y="3" text-anchor="middle" fill="#00f0ff" font-size="10" font-weight="700" font-family="'Chakra Petch', sans-serif">WELLINGTON STRAIGHT</text>
        </g>
        <!-- Hangar Straight -->
        <g class="straight-label" transform="translate(750, 310)">
          <rect x="-70" y="-12" width="140" height="22" rx="4" fill="rgba(7, 11, 23, 0.85)" stroke="#e10600" stroke-width="1.5" />
          <text x="0" y="3" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700" font-family="'Chakra Petch', sans-serif">HANGAR STRAIGHT</text>
        </g>

        <!-- CORNER LABELS & CLICK TARGETS (Section 8) -->
        <g id="track-corners-group">
          ${this.renderCornerMarkers()}
        </g>

        <!-- DYNAMIC ATTACK ZONE HIGHLIGHT LAYER (Section 10) -->
        <g id="track-attack-overlay"></g>

        <!-- LIVE MOVING CARS (Section 12) -->
        <g id="track-cars-group">
          <!-- Background Cars -->
          <circle id="car-p1" cx="0" cy="0" r="5.5" fill="#a0aec0" stroke="#070b17" stroke-width="1.5" />
          <circle id="car-p2" cx="0" cy="0" r="5.5" fill="#a0aec0" stroke="#070b17" stroke-width="1.5" />
          <circle id="car-p6" cx="0" cy="0" r="5.5" fill="#718096" stroke="#070b17" stroke-width="1.5" />

          <!-- Car Behind (P5 SAI) -->
          <g id="car-p5-group">
            <circle id="car-p5" cx="0" cy="0" r="7" fill="#168bff" stroke="#ffffff" stroke-width="1.5" />
            <text id="car-p5-label" x="0" y="-10" text-anchor="middle" fill="#168bff" font-size="9" font-weight="700" font-family="'JetBrains Mono', monospace">SAI (P5)</text>
          </g>

          <!-- Target Ahead (P3 LEC) -->
          <g id="car-p3-group">
            <circle id="car-p3" cx="0" cy="0" r="8" fill="#ffd700" stroke="#ffffff" stroke-width="2" filter="url(#car-glow)" />
            <text id="car-p3-label" x="0" y="-11" text-anchor="middle" fill="#ffd700" font-size="10" font-weight="800" font-family="'JetBrains Mono', monospace">LEC (P3)</text>
          </g>

          <!-- Player Car (P4 YOU) -->
          <g id="car-p4-group">
            <circle id="car-p4-pulse" cx="0" cy="0" r="14" fill="none" stroke="#e10600" stroke-width="2" opacity="0.6" />
            <circle id="car-p4" cx="0" cy="0" r="9" fill="#e10600" stroke="#ffffff" stroke-width="2.5" filter="url(#car-glow)" />
            <text id="car-p4-label" x="0" y="-12" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800" font-family="'JetBrains Mono', monospace">YOU (P4)</text>
          </g>
        </g>
      </svg>
    `;
  }

  renderCornerMarkers() {
    // 15 canonical Silverstone corners specified in Section 8:
    // ABBEY, FARM, VILLAGE, THE LOOP, AINTREE, BROOKLANDS, LUFFIELD, WOODCOTE, COPSE, MAGGOTTS, BECKETTS, CHAPEL, STOWE, VALE, CLUB
    const cornerSegments = TRACK_SEGMENTS.filter(s => s.type === "corner");

    return cornerSegments.map(seg => {
      const pos = seg.pos || { x: 500, y: 300 };
      const potential = Math.round(seg.attackPotential * 100);
      const isHigh = potential >= 70;
      const dotColor = isHigh ? "#00e676" : potential >= 40 ? "#00f0ff" : "#ffd700";

      return `
        <g class="corner-node-target" data-seg-id="${seg.id}" style="cursor: pointer;" transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="12" fill="transparent" />
          <circle cx="0" cy="0" r="4" fill="${dotColor}" stroke="#ffffff" stroke-width="1.5" />
          <text x="0" y="${pos.y > 400 ? 14 : -8}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-weight="700" font-family="'Chakra Petch', sans-serif" letter-spacing="0.5">
            ${seg.name.toUpperCase()}
          </text>
        </g>
      `;
    }).join("");
  }

  bindEvents() {
    const cornerNodes = this.container.querySelectorAll(".corner-node-target");
    cornerNodes.forEach(node => {
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        const segId = node.getAttribute("data-seg-id");
        this.showCornerTooltip(segId);
      });
    });

    const closeBtn = this.container.querySelector("#tt-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hideCornerTooltip());
    }

    // Dismiss on click outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#corner-tooltip") && !e.target.closest(".corner-node-target")) {
        this.hideCornerTooltip();
      }
    });
  }

  showCornerTooltip(segId) {
    const seg = getSegmentById(segId);
    if (!seg) return;

    const tt = this.container.querySelector("#corner-tooltip");
    if (!tt) return;

    const potPct = Math.round(seg.attackPotential * 100);
    const riskPct = Math.round(seg.risk * 100);
    const potLabel = potPct >= 70 ? "HIGH" : potPct >= 40 ? "MEDIUM" : "LOW";
    const riskLabel = riskPct >= 70 ? "HIGH" : riskPct >= 40 ? "MEDIUM" : "LOW";

    tt.querySelector("#tt-name").textContent = seg.name.toUpperCase();
    tt.querySelector("#tt-sector").textContent = `SECTOR ${seg.sector}`;
    tt.querySelector("#tt-type").textContent = seg.type.toUpperCase();
    tt.querySelector("#tt-potential").textContent = `${potLabel} (${potPct}%)`;
    tt.querySelector("#tt-risk").textContent = `${riskLabel} (${riskPct}%)`;
    tt.querySelector("#tt-rec").textContent = seg.recommendedAction ? seg.recommendedAction.replace("_", " ") : "CONTROLLED";
    tt.querySelector("#tt-desc").textContent = seg.tooltipText || "Corner dynamics under continuous evaluation.";

    tt.classList.remove("hidden");

    if (this.onSegmentSelect) {
      this.onSegmentSelect(seg);
    }
  }

  hideCornerTooltip() {
    const tt = this.container.querySelector("#corner-tooltip");
    if (tt) tt.classList.add("hidden");
  }

  // -------------------------------------------------------------
  // RENDER DYNAMIC STATE UPDATE
  // -------------------------------------------------------------
  render(state) {
    if (!state) return;

    // 1. Update Sector 2 Color (Section 7: when S2 is yellow, physical path turns yellow!)
    const s2Path = this.container.querySelector("#svg-sector-2");
    const s2Badge = this.container.querySelector("#track-badge-s2");
    if (s2Path) {
      const s2Color = getSectorColor(2, state.raceControl, state.yellowSector);
      s2Path.setAttribute("stroke", s2Color);
      if (s2Color === "#ffd700") {
        s2Path.setAttribute("stroke-width", "11");
        if (s2Badge) {
          s2Badge.textContent = "S2: YELLOW";
          s2Badge.classList.add("badge-yellow-flag");
        }
      } else {
        s2Path.setAttribute("stroke-width", "8");
        if (s2Badge) {
          s2Badge.textContent = "S2";
          s2Badge.classList.remove("badge-yellow-flag");
        }
      }
    }

    // 2. Update Sector 1 & 3 Badges
    const s1Path = this.container.querySelector("#svg-sector-1");
    if (s1Path) {
      s1Path.setAttribute("stroke", getSectorColor(1, state.raceControl, state.yellowSector));
    }
    const s3Path = this.container.querySelector("#svg-sector-3");
    if (s3Path) {
      s3Path.setAttribute("stroke", getSectorColor(3, state.raceControl, state.yellowSector));
    }

    // Current segment pill
    const curSegEl = this.container.querySelector("#track-current-segment");
    if (curSegEl) {
      curSegEl.textContent = state.currentSegmentName ? state.currentSegmentName.toUpperCase() : "HANGAR STRAIGHT";
    }

    // 3. Update Car Positions along track
    const samples = this.splineData.samples;
    const totalSamples = samples.length;

    const getCoordForProg = (prog) => {
      const norm = ((prog % 1) + 1) % 1;
      const idx = Math.min(totalSamples - 1, Math.floor(norm * totalSamples));
      return samples[idx] || { x: 500, y: 300 };
    };

    // Update Player (P4 YOU)
    const p4Pt = getCoordForProg(state.trackProgress ?? 0.74);
    const p4Group = this.container.querySelector("#car-p4-group");
    if (p4Group) {
      const c = p4Group.querySelector("#car-p4");
      const pulse = p4Group.querySelector("#car-p4-pulse");
      const label = p4Group.querySelector("#car-p4-label");
      if (c) {
        c.setAttribute("cx", p4Pt.x);
        c.setAttribute("cy", p4Pt.y);
      }
      if (pulse) {
        pulse.setAttribute("cx", p4Pt.x);
        pulse.setAttribute("cy", p4Pt.y);
      }
      if (label) {
        label.setAttribute("x", p4Pt.x);
        label.setAttribute("y", p4Pt.y - 12);
        label.textContent = `YOU (P${state.position || 4})`;
      }
    }

    // Update Target (P3 or P2)
    const targetCar = (state.cars || []).find(c => c.isTarget) || { prog: (state.trackProgress + 0.02) % 1.0, name: "LEC", pos: 3 };
    const p3Pt = getCoordForProg(targetCar.prog);
    const p3Group = this.container.querySelector("#car-p3-group");
    if (p3Group) {
      const c = p3Group.querySelector("#car-p3");
      const label = p3Group.querySelector("#car-p3-label");
      if (c) {
        c.setAttribute("cx", p3Pt.x);
        c.setAttribute("cy", p3Pt.y);
      }
      if (label) {
        label.setAttribute("x", p3Pt.x);
        label.setAttribute("y", p3Pt.y - 11);
        label.textContent = `${targetCar.name} (P${state.targetPosition || 3})`;
      }
    }

    // Update Car Behind (P5)
    const behindCar = (state.cars || []).find(c => c.isBehind) || { prog: (state.trackProgress - 0.04) % 1.0, name: "SAI", pos: 5 };
    const p5Pt = getCoordForProg(behindCar.prog);
    const p5Group = this.container.querySelector("#car-p5-group");
    if (p5Group) {
      const c = p5Group.querySelector("#car-p5");
      const label = p5Group.querySelector("#car-p5-label");
      if (c) {
        c.setAttribute("cx", p5Pt.x);
        c.setAttribute("cy", p5Pt.y);
      }
      if (label) {
        label.setAttribute("x", p5Pt.x);
        label.setAttribute("y", p5Pt.y - 10);
      }
    }

    // Background cars
    const bgP1 = (state.cars || []).find(c => c.id === "p1");
    if (bgP1) {
      const pt = getCoordForProg(bgP1.prog);
      const el = this.container.querySelector("#car-p1");
      if (el) { el.setAttribute("cx", pt.x); el.setAttribute("cy", pt.y); }
    }
    const bgP2 = (state.cars || []).find(c => c.id === "p2");
    if (bgP2) {
      const pt = getCoordForProg(bgP2.prog);
      const el = this.container.querySelector("#car-p2");
      if (el) { el.setAttribute("cx", pt.x); el.setAttribute("cy", pt.y); }
    }
    const bgP6 = (state.cars || []).find(c => c.id === "p6");
    if (bgP6) {
      const pt = getCoordForProg(bgP6.prog);
      const el = this.container.querySelector("#car-p6");
      if (el) { el.setAttribute("cx", pt.x); el.setAttribute("cy", pt.y); }
    }
  }
}
