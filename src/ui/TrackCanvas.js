/**
 * TRACKSHIFT - TrackCanvas
 * High-definition 2D race circuit visualization for Silverstone Grand Prix.
 *
 * Implements:
 *   1. Authentic Silverstone GP Circuit (5,891m • 18 Turns) with real corner names:
 *      Hamilton Straight, Abbey, Farm, Village, The Loop, Aintree, Wellington Straight,
 *      Brooklands, Luffield, Woodcote, Copse, Maggotts, Becketts, Chapel,
 *      Hangar Straight, Stowe, Vale, Club.
 *   2. Smooth Catmull-Rom spline asphalt with apex kerbs and checkered Start/Finish gantry.
 *   3. Small top-down F1-style car markers (Section 6):
 *      - PLAYER (Red #ff1801, tactical halo, "[44] YOU")
 *      - TARGET (Yellow #ffb800, amber alert, "[16] P5 TARGET")
 *      - 8 PACK COMPETITORS (Sleek Gray #8b949e, driver numbers)
 *   4. Active strategic zone highlights & subtle current section indicator.
 *   5. On-Track Race Order Strip (P1 to P10).
 */

export const SILVERSTONE_POINTS = [
  { x: 0.74, y: 0.62, turn: "S/F", label: "HAMILTON STRAIGHT", apexSide: 1 },
  { x: 0.69, y: 0.44, turn: "T1", label: "ABBEY", apexSide: -1 },
  { x: 0.60, y: 0.42, turn: "T2", label: "FARM CURVE", apexSide: 1 },
  { x: 0.49, y: 0.46, turn: "T3", label: "VILLAGE", apexSide: -1 },
  { x: 0.40, y: 0.56, turn: "T4", label: "THE LOOP", apexSide: 1 },
  { x: 0.42, y: 0.67, turn: "T5", label: "AINTREE", apexSide: 1 },
  { x: 0.31, y: 0.77, turn: "DRS 1", label: "WELLINGTON STRAIGHT", apexSide: 0 },
  { x: 0.18, y: 0.78, turn: "T6", label: "BROOKLANDS", apexSide: 1 },
  { x: 0.13, y: 0.67, turn: "T7", label: "LUFFIELD", apexSide: -1 },
  { x: 0.17, y: 0.54, turn: "T8", label: "WOODCOTE", apexSide: -1 },
  { x: 0.20, y: 0.38, turn: "T8-T9", label: "NATIONAL STRAIGHT", apexSide: 0 },
  { x: 0.26, y: 0.22, turn: "T9", label: "COPSE", apexSide: -1 },
  { x: 0.39, y: 0.17, turn: "T10-T11", label: "MAGGOTTS", apexSide: 1 },
  { x: 0.52, y: 0.17, turn: "T12-T13", label: "BECKETTS", apexSide: -1 },
  { x: 0.63, y: 0.23, turn: "T14", label: "CHAPEL", apexSide: 1 },
  { x: 0.77, y: 0.39, turn: "DRS 2", label: "HANGAR STRAIGHT", apexSide: 0 },
  { x: 0.89, y: 0.54, turn: "T15", label: "STOWE", apexSide: -1 },
  { x: 0.84, y: 0.68, turn: "T16", label: "VALE", apexSide: 1 },
  { x: 0.79, y: 0.74, turn: "T17-T18", label: "CLUB", apexSide: -1 }
];

export class TrackCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.trackModel = null;
    this.competitors = [];
    this.playerDistance = 0;
    this.opponentDistance = 68;
    this.activeZoneId = null;
    this.nextOppZoneId = null;
    this.raceCondition = "GREEN";
    this.hoveredCar = null;

    this.splineSamples = [];
    this.totalSplineLength = 0;
    this.turnMarkers = [];

    // Track Layer Visibility Controls (Section 27)
    this.layers = {
      cars: true,
      corners: true,
      sectors: true,
      attackZones: true,
      energyZones: true,
      incidents: true,
      racingLine: true
    };

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.hoveredCar = null;
      this.render();
    });
  }

  setLayers(layerConfig) {
    this.layers = { ...this.layers, ...layerConfig };
    this.render();
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(400, rect.width * dpr);
    this.canvas.height = Math.max(300, rect.height * dpr);
    this.dpr = dpr;
    this.generateTrackPath();
    this.render();
  }

  setTrackModel(trackModel) {
    this.trackModel = trackModel;
    this.generateTrackPath();
    this.render();
  }

  setCircuit(circuitId) {
    this.generateTrackPath();
    this.render();
  }

  updateCars(competitorsOrPlayerDist, oppDist = 0, activeZoneId = null, nextOppZoneId = null, raceCondition = "GREEN") {
    if (Array.isArray(competitorsOrPlayerDist)) {
      this.competitors = competitorsOrPlayerDist;
      const player = this.competitors.find(c => c.isPlayer);
      if (player) this.playerDistance = player.distance;
      const target = this.competitors.find(c => c.isTarget);
      if (target) this.opponentDistance = target.distance;
    } else {
      this.playerDistance = competitorsOrPlayerDist;
      this.opponentDistance = oppDist;
    }

    this.activeZoneId = activeZoneId;
    this.nextOppZoneId = nextOppZoneId;
    this.raceCondition = raceCondition;
    this.render();
  }

  generateTrackPath() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    const padX = w * 0.07;
    const padY = h * 0.11;
    const rawPoints = SILVERSTONE_POINTS;

    // 1. Control points in canvas pixels
    const controlPoints = rawPoints.map(p => ({
      x: padX + p.x * (w - 2 * padX),
      y: padY + p.y * (h - 2 * padY),
      turn: p.turn,
      label: p.label,
      apexSide: p.apexSide || 0
    }));

    // 2. Smooth Catmull-Rom closed spline with 380 samples
    const numControl = controlPoints.length;
    const stepsPerSegment = 20;
    const totalSamples = numControl * stepsPerSegment;
    const samples = [];

    for (let i = 0; i < numControl; i++) {
      const p0 = controlPoints[(i - 1 + numControl) % numControl];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % numControl];
      const p3 = controlPoints[(i + 2) % numControl];

      for (let s = 0; s < stepsPerSegment; s++) {
        const t = s / stepsPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        samples.push({ x, y, controlIndex: i });
      }
    }

    // 3. Tangents, Normals & Cumulative Length
    let cumLength = 0;
    for (let i = 0; i < totalSamples; i++) {
      const prev = samples[(i - 1 + totalSamples) % totalSamples];
      const next = samples[(i + 1) % totalSamples];
      const curr = samples[i];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;

      curr.angle = Math.atan2(dy, dx);
      curr.nx = -dy / len;
      curr.ny = dx / len;

      const segDist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      cumLength += segDist;
      curr.cumDist = cumLength;
    }

    this.splineSamples = samples;
    this.totalSplineLength = cumLength;

    // 4. Place Turn Badges cleanly
    this.turnMarkers = controlPoints.map((cp, idx) => {
      const sampleIdx = idx * stepsPerSegment;
      const sample = samples[sampleIdx] || cp;
      return {
        ...cp,
        x: sample.x,
        y: sample.y,
        nx: sample.nx,
        ny: sample.ny,
        angle: sample.angle
      };
    });
  }

  getPointAndTangentAtProgress(progress) {
    if (!this.splineSamples || this.splineSamples.length === 0) {
      return { x: 100, y: 100, angle: 0, nx: 0, ny: -1 };
    }

    const normP = ((progress % 1.0) + 1.0) % 1.0;
    const targetDist = normP * this.totalSplineLength;
    const samples = this.splineSamples;
    const n = samples.length;

    let low = 0;
    let high = n - 1;
    let idx = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (samples[mid].cumDist >= targetDist) {
        idx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const s0 = samples[idx];
    const s1 = samples[(idx + 1) % n];
    const d0 = s0.cumDist;
    const d1 = s1.cumDist < d0 ? d0 + s1.cumDist : s1.cumDist;
    const t = Math.max(0, Math.min(1, (targetDist - (d0 - Math.hypot(s1.x - s0.x, s1.y - s0.y))) / (d1 - d0 || 1)));

    return {
      x: s0.x + (s1.x - s0.x) * t,
      y: s0.y + (s1.y - s0.y) * t,
      angle: s0.angle,
      nx: s0.nx,
      ny: s0.ny
    };
  }

  getPointAtProgress(progress) {
    return this.getPointAndTangentAtProgress(progress);
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.dpr || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const trackLen = this.trackModel ? this.trackModel.circuit.length : 5891;
    let found = null;

    if (this.competitors && this.competitors.length > 0) {
      for (const car of this.competitors) {
        const prog = (car.distance / trackLen) % 1.0;
        const pt = this.getPointAndTangentAtProgress(prog);
        const lat = car.lateralOffset || 0;
        const carX = pt.x + pt.nx * lat;
        const carY = pt.y + pt.ny * lat;

        const dist = Math.hypot(mouseX - carX, mouseY - carY);
        if (dist < 26 * dpr) {
          found = { car, x: carX, y: carY };
          break;
        }
      }
    }

    if (this.hoveredCar !== found) {
      this.hoveredCar = found;
      this.render();
    }
  }

  render() {
    if (!this.ctx || !this.splineSamples || this.splineSamples.length === 0) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const trackLen = this.trackModel ? this.trackModel.circuit.length : 5891;
    const samples = this.splineSamples;

    ctx.clearRect(0, 0, w, h);

    // 1. Subtle Precision Track Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. High-Definition Closed Circuit Roadway
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y);
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i].x, samples[i].y);
    }
    ctx.closePath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Asphalt base foundation
    ctx.strokeStyle = "#12151d";
    ctx.lineWidth = 28;
    ctx.stroke();

    // Asphalt surface
    ctx.strokeStyle = "#1b202c";
    ctx.lineWidth = 20;
    ctx.stroke();

    // Boundary lines (white)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Dynamic Racing Line (Layer controlled)
    if (this.layers.racingLine) {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 6;
      ctx.setLineDash([10, 12]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    // 3. Authentic Red/White Apex Kerbs
    this.turnMarkers.forEach((tm) => {
      if (tm.apexSide === 0) return;
      const centerIdx = tm.controlIndex * 20;
      const kerbRadius = 12.5;
      const kerbLen = 7;

      for (let k = -kerbLen; k <= kerbLen; k++) {
        const sIdx = (centerIdx + k + samples.length) % samples.length;
        const samp = samples[sIdx];
        const nextSamp = samples[(sIdx + 1) % samples.length];

        const kColor = Math.abs(k) % 2 === 0 ? "#ff2a2a" : "#ffffff";
        ctx.strokeStyle = kColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const kx0 = samp.x + samp.nx * kerbRadius * tm.apexSide;
        const ky0 = samp.y + samp.ny * kerbRadius * tm.apexSide;
        const kx1 = nextSamp.x + nextSamp.nx * kerbRadius * tm.apexSide;
        const ky1 = nextSamp.y + nextSamp.ny * kerbRadius * tm.apexSide;
        ctx.moveTo(kx0, ky0);
        ctx.lineTo(kx1, ky1);
        ctx.stroke();
      }
    });

    // 4. Sector Boundaries (Section 2 & 8)
    if (this.layers.sectors) {
      const sectorBounds = [
        { prog: 1480 / trackLen, label: "S1 ❙ S2" },
        { prog: 4760 / trackLen, label: "S2 ❙ S3" }
      ];

      sectorBounds.forEach(sb => {
        const pt = this.getPointAndTangentAtProgress(sb.prog);
        const tickW = 16;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(pt.x - pt.nx * tickW, pt.y - pt.ny * tickW);
        ctx.lineTo(pt.x + pt.nx * tickW, pt.y + pt.ny * tickW);
        ctx.stroke();

        // Subtle sector marker tag
        const tagDist = 24;
        const tagX = pt.x + pt.nx * tagDist;
        const tagY = pt.y + pt.ny * tagDist;
        ctx.fillStyle = "rgba(10, 16, 32, 0.9)";
        ctx.fillRect(tagX - 24, tagY - 8, 48, 16);
        ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX - 24, tagY - 8, 48, 16);
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00f0ff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sb.label, tagX, tagY);
        ctx.restore();
      });
    }

    // 5. Dynamic Race Condition Track Overlays (Sections 11 - 14)
    if (this.layers.incidents && this.raceCondition && this.raceCondition !== "GREEN") {
      if (this.raceCondition.startsWith("YELLOW")) {
        const ySec = parseInt(this.raceCondition.split("_S")[1]);
        const sStart = ySec === 1 ? 0 : (ySec === 2 ? 1480 / trackLen : 4760 / trackLen);
        const sEnd = ySec === 1 ? 1480 / trackLen : (ySec === 2 ? 4760 / trackLen : 1.0);
        const pulse = 0.35 + 0.25 * Math.sin(Date.now() / 140);

        ctx.save();
        ctx.beginPath();
        const steps = 60;
        for (let s = 0; s <= steps; s++) {
          const prog = sStart + (sEnd - sStart) * (s / steps);
          const pt = this.getPointAtProgress(prog);
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = `rgba(255, 214, 0, ${pulse})`;
        ctx.lineWidth = 26;
        ctx.shadowColor = "#ffd600";
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.restore();

        // Caution Tag at midpoint of sector
        const midP = (sStart + sEnd) / 2;
        const midPt = this.getPointAndTangentAtProgress(midP);
        ctx.save();
        const bx = midPt.x + midPt.nx * 28;
        const by = midPt.y + midPt.ny * 28;
        ctx.fillStyle = "rgba(10, 12, 16, 0.95)";
        ctx.fillRect(bx - 70, by - 12, 140, 24);
        ctx.strokeStyle = "#ffd600";
        ctx.lineWidth = 1.8;
        ctx.strokeRect(bx - 70, by - 12, 140, 24);
        ctx.fillStyle = "#ffd600";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`⚠ YELLOW FLAG SECTOR ${ySec}`, bx, by - 4);
        ctx.font = "bold 7px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("INCIDENT DETECTED // CAR 18 OFF", bx, by + 6);
        ctx.restore();

      } else if (this.raceCondition === "VSC") {
        // Full Track Neutralized Glow
        const pulse = 0.22 + 0.12 * Math.sin(Date.now() / 180);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(samples[0].x, samples[0].y);
        for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i].x, samples[i].y);
        ctx.closePath();
        ctx.strokeStyle = `rgba(255, 145, 0, ${pulse})`;
        ctx.lineWidth = 26;
        ctx.shadowColor = "#ff9100";
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();

      } else if (this.raceCondition === "SAFETY_CAR") {
        // Full track caution queue
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(samples[0].x, samples[0].y);
        for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i].x, samples[i].y);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255, 145, 0, 0.18)";
        ctx.lineWidth = 24;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Strategic Zones Overlay (Section 2 & 10)
    if ((this.layers.attackZones || this.layers.energyZones) && this.trackModel && this.trackModel.circuit && this.trackModel.circuit.zones) {
      const zones = this.trackModel.circuit.zones;

      zones.forEach(z => {
        const isActive = this.activeZoneId === z.id || this.activeZoneId === z.name;
        const isNextOpp = this.nextOppZoneId === z.id || this.nextOppZoneId === z.name;

        // Do not display every attribute simultaneously; only highlight relevant zones
        if (!isActive && !isNextOpp) return;

        const startP = z.startDistance / trackLen;
        const endP = z.endDistance / trackLen;
        const numSteps = 24;

        ctx.beginPath();
        for (let s = 0; s <= numSteps; s++) {
          const prog = startP + (endP - startP) * (s / numSteps);
          const pt = this.getPointAtProgress(prog);
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }

        // Section 8 Zone Colors:
        // GREEN: High-value deployment / attack opportunity
        // BLUE: Energy harvesting / preparation zone
        // YELLOW: Caution / tactical zone
        // RED: High-risk or restricted deployment state
        let zoneColor = "#00b0ff";
        let zoneShadow = "#00b0ff";

        if (this.raceCondition && this.raceCondition.startsWith("YELLOW")) {
          const ySec = parseInt(this.raceCondition.split("_S")[1]);
          const { sector: zSector } = this.trackModel.getSectorAtDistance ? this.trackModel.getSectorAtDistance(z.startDistance) : { sector: { sectorNumber: 1 } };
          if (zSector && zSector.sectorNumber === ySec) {
            zoneColor = "#ff1744"; // RED: Restricted
            zoneShadow = "#ff1744";
          } else {
            zoneColor = "#ffd600"; // YELLOW: Caution
            zoneShadow = "#ffd600";
          }
        } else if (z.type === "HIGH_VALUE_ATTACK" || z.type === "ATTACK") {
          zoneColor = "#00e676"; // GREEN: High-value deployment / attack
          zoneShadow = "#00e676";
        } else if (z.type === "BRAKING_HARVEST") {
          zoneColor = "#00b0ff"; // BLUE: Energy harvesting
          zoneShadow = "#00b0ff";
        } else {
          zoneColor = "#ffd600"; // YELLOW: Caution / tactical
          zoneShadow = "#ffd600";
        }

        ctx.strokeStyle = zoneColor;
        ctx.lineWidth = isActive ? 16 : 10;
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = zoneShadow;
        ctx.shadowBlur = isActive ? 20 : 10;
        ctx.stroke();
        ctx.restore();
      });
    }

    // 7. Start / Finish Gantry (Hamilton Straight)
    const sfPt = this.getPointAndTangentAtProgress(0.0);
    const sfW = 14;
    ctx.save();
    ctx.translate(sfPt.x, sfPt.y);
    ctx.rotate(sfPt.angle);
    for (let c = -sfW; c <= sfW; c += 4) {
      ctx.fillStyle = (Math.floor(c / 4) % 2 === 0) ? "#ffffff" : "#000000";
      ctx.fillRect(-2, c, 4, 4);
    }
    ctx.fillStyle = "#ff1801";
    ctx.fillRect(-1.5, -sfW - 5, 3, 4);
    ctx.restore();

    // 6. Silverstone Corner Labels (Section 7)
    if (this.layers.corners) {
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      this.turnMarkers.forEach((tm) => {
        const radOffset = (tm.apexSide !== 0 ? tm.apexSide * 22 : -18);
        const tagX = tm.x + tm.nx * radOffset;
        const tagY = tm.y + tm.ny * radOffset;

        ctx.beginPath();
        ctx.arc(tm.x, tm.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = tm.turn === "S/F" ? "#ff1801" : (tm.turn.includes("DRS") ? "#ffc700" : "#00f0ff");
        ctx.fill();

        const isDrs = tm.turn.includes("DRS");
        const isSF = tm.turn === "S/F";
        const labelText = tm.label ? `${tm.turn}: ${tm.label}` : tm.turn;
        const tagWidth = Math.max(38, labelText.length * 6.5 + 10);

        ctx.fillStyle = "rgba(8, 14, 28, 0.92)";
        ctx.fillRect(tagX - tagWidth / 2, tagY - 7, tagWidth, 14);

        ctx.strokeStyle = isSF ? "#ff1801" : (isDrs ? "#ffc700" : "rgba(0, 240, 255, 0.3)");
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX - tagWidth / 2, tagY - 7, tagWidth, 14);

        ctx.fillStyle = isSF ? "#ff5252" : (isDrs ? "#ffc700" : "#cbd5e1");
        ctx.fillText(labelText, tagX, tagY);
      });
    }

    // 7. Render 10 Competitors as Top-Down F1 Cars (Section 9)
    if (this.layers.cars) {
      const competitors = (this.competitors && this.competitors.length > 0) ? this.competitors : [
        { id: "car-44", number: 44, name: "YOU", position: 7, color: "#ff1801", distance: 0, speed: 285, isPlayer: true, isTarget: false },
        { id: "car-16", number: 16, name: "LEC", position: 6, color: "#ffb800", distance: 88, speed: 282, isPlayer: false, isTarget: true }
      ];

      const playerCar = competitors.find(c => c.isPlayer) || competitors[0];
      const targetCar = competitors.find(c => c.isTarget) || competitors.find(c => c.position === playerCar.position - 1);

    // Tactical Gap Line
    if (playerCar && targetCar) {
      const pProg = (playerCar.distance / trackLen) % 1.0;
      const tProg = (targetCar.distance / trackLen) % 1.0;
      const pPt = this.getPointAndTangentAtProgress(pProg);
      const tPt = this.getPointAndTangentAtProgress(tProg);

      const pX = pPt.x + pPt.nx * (playerCar.lateralOffset || 0);
      const pY = pPt.y + pPt.ny * (playerCar.lateralOffset || 0);
      const tX = tPt.x + tPt.nx * (targetCar.lateralOffset || 0);
      const tY = tPt.y + tPt.ny * (targetCar.lateralOffset || 0);

      const dist = Math.hypot(pX - tX, pY - tY);
      if (dist < w * 0.40) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255, 184, 0, 0.65)";
        ctx.lineWidth = 1.8;
        ctx.moveTo(pX, pY);
        ctx.lineTo(tX, tY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Render Each Top-Down F1 Car Marker
    competitors.forEach(car => {
      const prog = (car.distance / trackLen) % 1.0;
      const ptData = this.getPointAndTangentAtProgress(prog);
      const lat = car.lateralOffset || 0;
      const carX = ptData.x + ptData.nx * lat;
      const carY = ptData.y + ptData.ny * lat;

      const isPlayer = car.isPlayer;
      const isTarget = car.isTarget;
      const isHovered = this.hoveredCar && this.hoveredCar.car.id === car.id;

      let gapM = (car.distance - playerCar.distance + trackLen) % trackLen;
      if (gapM > trackLen / 2) gapM -= trackLen;
      const gapSec = Math.abs(gapM / Math.max(20, (car.speed || 280) / 3.6));

      // Draw Top-Down F1 Car Silhouette
      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(ptData.angle);

      const mainColor = isPlayer ? "#ff1801" : (isTarget ? "#ffb800" : (car.color || "#8b949e"));
      const tireColor = "#0d0f14";
      const wingColor = isPlayer ? "#ffffff" : (isTarget ? "#1a1a1a" : "#4a5568");

      // Tactical Halo Rings
      if (isPlayer) {
        const pulse = Math.sin(Date.now() / 180) * 2.5;
        ctx.strokeStyle = "rgba(255, 24, 1, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#ff1801";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isTarget) {
        ctx.strokeStyle = "rgba(255, 184, 0, 0.6)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4 Black Rubber Wheels
      ctx.fillStyle = tireColor;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 0.8;
      // Front Wheels
      ctx.fillRect(4.5, -7.5, 4.5, 3.2);
      ctx.strokeRect(4.5, -7.5, 4.5, 3.2);
      ctx.fillRect(4.5, 4.3, 4.5, 3.2);
      ctx.strokeRect(4.5, 4.3, 4.5, 3.2);
      // Rear Wheels
      ctx.fillRect(-8.5, -8.0, 5.5, 3.8);
      ctx.strokeRect(-8.5, -8.0, 5.5, 3.8);
      ctx.fillRect(-8.5, 4.2, 5.5, 3.8);
      ctx.strokeRect(-8.5, 4.2, 5.5, 3.8);

      // Front Aerodynamic Wing
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.roundRect(8, -7, 2.8, 14, 1);
      ctx.fill();

      // Rear Wing
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.roundRect(-10.5, -7.5, 3.0, 15, 1);
      ctx.fill();

      // Main F1 Monocoque Chassis
      ctx.fillStyle = mainColor;
      if (isPlayer) {
        ctx.shadowColor = "#ff1801";
        ctx.shadowBlur = 16;
      } else if (isTarget) {
        ctx.shadowColor = "#ffb800";
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(3, -2.6);
      ctx.lineTo(-3, -4.0);
      ctx.lineTo(-8, -3.2);
      ctx.lineTo(-8, 3.2);
      ctx.lineTo(-3, 4.0);
      ctx.lineTo(3, 2.6);
      ctx.closePath();
      ctx.fill();

      // Cockpit & Halo
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#07090d";
      ctx.beginPath();
      ctx.ellipse(-1, 0, 3.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Safety Car Emergency Roof Bar
      if (car.id === "car-sc") {
        const strobe = Math.floor(Date.now() / 150) % 2 === 0;
        ctx.fillStyle = strobe ? "#ff9100" : "#ffffff";
        ctx.shadowColor = "#ff9100";
        ctx.shadowBlur = strobe ? 16 : 4;
        ctx.fillRect(-2, -6, 4, 12);
        ctx.shadowBlur = 0;
      }

      // Driver Helmet
      ctx.fillStyle = isPlayer ? "#ffffff" : (isTarget ? "#000000" : "#cbd5e1");
      ctx.beginPath();
      ctx.arc(-1, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Labels (Section 5 & 6)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (isPlayer) {
        const tagW = 64;
        const tagH = 15;
        ctx.fillStyle = "rgba(10, 12, 16, 0.94)";
        ctx.fillRect(carX - tagW / 2, carY - 24, tagW, tagH);
        ctx.strokeStyle = "#ff1801";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(carX - tagW / 2, carY - 24, tagW, tagH);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px 'Chakra Petch', sans-serif";
        ctx.fillText("P7 [44] YOU", carX, carY - 17);

      } else if (isTarget) {
        const tagW = 76;
        const tagH = 15;
        ctx.fillStyle = "rgba(10, 12, 16, 0.94)";
        ctx.fillRect(carX - tagW / 2, carY + 14, tagW, tagH);
        ctx.strokeStyle = "#ffb800";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(carX - tagW / 2, carY + 14, tagW, tagH);

        ctx.fillStyle = "#ffb800";
        ctx.font = "bold 9px 'Chakra Petch', sans-serif";
        ctx.fillText(`P6 [${car.number}] TARGET`, carX, carY + 21.5);

      } else if (car.id === "car-sc") {
        const tagW = 86;
        const tagH = 15;
        ctx.fillStyle = "rgba(10, 12, 16, 0.94)";
        ctx.fillRect(carX - tagW / 2, carY - 24, tagW, tagH);
        ctx.strokeStyle = "#ff9100";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(carX - tagW / 2, carY - 24, tagW, tagH);

        ctx.fillStyle = "#ff9100";
        ctx.font = "bold 9px 'Chakra Petch', sans-serif";
        ctx.fillText("🚨 SAFETY CAR", carX, carY - 17);

      } else {
        if (isHovered || gapSec < 0.6) {
          const tagW = 48;
          const tagH = 14;
          ctx.fillStyle = "rgba(10, 12, 16, 0.92)";
          ctx.fillRect(carX - tagW / 2, carY - 22, tagW, tagH);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1;
          ctx.strokeRect(carX - tagW / 2, carY - 22, tagW, tagH);

          ctx.fillStyle = "#cbd5e1";
          ctx.font = "bold 8.5px 'Chakra Petch', sans-serif";
          ctx.fillText(`P${car.position} [${car.number}]`, carX, carY - 15);
        } else {
          ctx.fillStyle = "rgba(10, 12, 16, 0.8)";
          ctx.fillRect(carX - 8, carY - 18, 16, 11);
          ctx.fillStyle = "#8b949e";
          ctx.font = "bold 8px 'JetBrains Mono', monospace";
          ctx.fillText(String(car.number), carX, carY - 13);
        }
      }
    });
    } // End if (this.layers.cars)

    // On-Track VSC / SC Status Banner at top center
    if (this.raceCondition === "VSC") {
      const bannerW = 340;
      const bannerH = 24;
      const bx = (w - bannerW) / 2;
      const by = 14;
      ctx.fillStyle = "rgba(10, 12, 16, 0.95)";
      ctx.fillRect(bx, by, bannerW, bannerH);
      ctx.strokeStyle = "#ff9100";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bannerW, bannerH);
      ctx.fillStyle = "#ff9100";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🟠 VSC ACTIVE — SPEED NEUTRALIZED", bx + bannerW / 2, by + bannerH / 2);
    } else if (this.raceCondition === "SAFETY_CAR") {
      const bannerW = 340;
      const bannerH = 24;
      const bx = (w - bannerW) / 2;
      const by = 14;
      ctx.fillStyle = "rgba(10, 12, 16, 0.95)";
      ctx.fillRect(bx, by, bannerW, bannerH);
      ctx.strokeStyle = "#ff1801";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bannerW, bannerH);
      ctx.fillStyle = "#ff5252";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🚨 SAFETY CAR DEPLOYED — FORM QUEUE", bx + bannerW / 2, by + bannerH / 2);
    }

    // 8. On-Track Race Order Strip (Section 27)
    // P4 CAR 55 | P5 CAR 16 | P6 YOU | P7 CAR 11
    const sortedCars = [...competitors].sort((a, b) => a.position - b.position);
    const stripX = 14;
    const stripY = 14;
    const stripW = 360;
    const stripH = 24;

    ctx.fillStyle = "rgba(10, 12, 16, 0.88)";
    ctx.fillRect(stripX, stripY, stripW, stripH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(stripX, stripY, stripW, stripH);

    ctx.textAlign = "left";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("RACE ORDER:", stripX + 8, stripY + 12);

    let curX = stripX + 78;
    // Show nearby competitors (around player position)
    const playerIdx = sortedCars.findIndex(c => c.isPlayer);
    const visibleNearby = sortedCars.slice(Math.max(0, playerIdx - 2), Math.min(sortedCars.length, playerIdx + 3));

    visibleNearby.forEach(c => {
      const isYou = c.isPlayer;
      const isTgt = c.isTarget;
      const cColor = isYou ? "#ff1801" : (isTgt ? "#ffb800" : "#cbd5e1");

      ctx.fillStyle = cColor;
      ctx.font = isYou ? "bold 10px 'JetBrains Mono', monospace" : "9px 'JetBrains Mono', monospace";

      const txt = isYou ? `P${c.position} YOU` : `P${c.position} [${c.number}]`;
      ctx.fillText(txt, curX, stripY + 12);
      curX += (isYou ? 64 : 48);
    });

    // 9. Silverstone GP Circuit HUD at Top Right
    const hudW = 210;
    const hudX = w - hudW - 14;
    const hudY = 14;

    ctx.fillStyle = "rgba(10, 12, 16, 0.88)";
    ctx.fillRect(hudX, hudY, hudW, stripH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(hudX, hudY, hudW, stripH);

    ctx.textAlign = "right";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ffc700";
    ctx.fillText("SILVERSTONE GP // 5,891m • 18T", hudX + hudW - 10, hudY + 12);

    // 10. Interactive Hover Tooltip
    if (this.hoveredCar) {
      const { car, x, y } = this.hoveredCar;
      const tipW = 150;
      const tipH = 48;
      const tipX = Math.min(w - tipW - 10, Math.max(10, x + 14));
      const tipY = Math.min(h - tipH - 10, Math.max(10, y - 24));
      const tipColor = car.isPlayer ? "#ff1801" : (car.isTarget ? "#ffb800" : "#8b949e");

      ctx.fillStyle = "rgba(10, 12, 16, 0.96)";
      ctx.fillRect(tipX, tipY, tipW, tipH);
      ctx.strokeStyle = tipColor;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(tipX, tipY, tipW, tipH);

      ctx.textAlign = "left";
      ctx.font = "bold 10px 'Chakra Petch', sans-serif";
      ctx.fillStyle = tipColor;
      ctx.fillText(`CAR ${car.number} (${car.name || "DRIVER"}) • P${car.position}`, tipX + 8, tipY + 14);

      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(`Speed: ${Math.round(car.speed || 280)} km/h`, tipX + 8, tipY + 28);
      ctx.fillText(`Gap: ${car.isPlayer ? "LEADER HUNT" : (car.gapSec !== undefined ? (car.gapSec > 0 ? `+${car.gapSec}s` : `${car.gapSec}s`) : "0.0s")}`, tipX + 8, tipY + 40);
    }
  }
}
