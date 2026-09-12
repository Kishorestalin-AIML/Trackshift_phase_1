/**
 * TRACKSHIFT - TrackCanvas
 * 2D Canvas representation of the circuit layout with animated car tracking,
 * zone color semantics (Attack in red/yellow, Braking in green, Straights in cyan),
 * and interactive telemetry tooltips.
 */

export class TrackCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.circuitId = "MONZA";
    this.currentDistance = 0;
    this.rivalDistance = 150;
    this.trackModel = null;
    this.zonePolylines = [];

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.render();
  }

  setTrackModel(trackModel) {
    this.trackModel = trackModel;
    this.circuitId = trackModel.circuit.id;
    this.generateTrackPath();
    this.render();
  }

  updateCarPositions(egoDistance, rivalDistance) {
    this.currentDistance = egoDistance;
    this.rivalDistance = rivalDistance;
    this.render();
  }

  /**
   * Generates 2D parametric control points for each circuit
   */
  generateTrackPath() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pad = Math.min(w, h) * 0.12;

    let rawPoints = [];

    if (this.circuitId === "MONZA") {
      // Monza Autodromo: Long straight top/bottom, Lesmo top right, Ascari bottom left, Parabolica right curve
      rawPoints = [
        { x: 0.15, y: 0.22 }, // Rettifilo Main Straight
        { x: 0.35, y: 0.22 },
        { x: 0.50, y: 0.23 }, // Prima Variante (T1-T2)
        { x: 0.65, y: 0.26 }, // Curva Grande (T3)
        { x: 0.78, y: 0.34 }, // Roggia (T4-T5)
        { x: 0.85, y: 0.42 }, // Lesmo 1 (T6)
        { x: 0.82, y: 0.52 }, // Lesmo 2 (T7)
        { x: 0.65, y: 0.62 }, // Serraglio straight
        { x: 0.45, y: 0.72 }, // Variante Ascari (T8-T10)
        { x: 0.25, y: 0.74 }, // Back Straight (Rettifilo di Rialto)
        { x: 0.12, y: 0.60 }, // Curva Parabolica
        { x: 0.10, y: 0.38 }
      ];
    } else if (this.circuitId === "SILVERSTONE") {
      rawPoints = [
        { x: 0.20, y: 0.30 }, // Hamilton Straight
        { x: 0.38, y: 0.24 }, // Abbey
        { x: 0.48, y: 0.35 }, // Arena / Loop
        { x: 0.35, y: 0.50 }, // Wellington Straight
        { x: 0.25, y: 0.62 }, // Brooklands / Luffield
        { x: 0.35, y: 0.72 }, // Copse
        { x: 0.55, y: 0.78 }, // Maggotts
        { x: 0.72, y: 0.70 }, // Becketts
        { x: 0.82, y: 0.52 }, // Chapel / Hangar Straight
        { x: 0.70, y: 0.36 }, // Stowe
        { x: 0.50, y: 0.28 }, // Vale / Club
        { x: 0.30, y: 0.28 }
      ];
    } else {
      // Spa-Francorchamps
      rawPoints = [
        { x: 0.25, y: 0.28 }, // La Source
        { x: 0.35, y: 0.32 }, // Eau Rouge
        { x: 0.48, y: 0.30 }, // Raidillon
        { x: 0.78, y: 0.22 }, // Kemmel Straight
        { x: 0.88, y: 0.38 }, // Les Combes
        { x: 0.76, y: 0.54 }, // Bruxelles / Rivage
        { x: 0.62, y: 0.68 }, // Pouhon
        { x: 0.45, y: 0.74 }, // Campus / Stavelot
        { x: 0.30, y: 0.66 }, // Blanchimont
        { x: 0.20, y: 0.48 }  // Bus Stop Chicane
      ];
    }

    // Scale to canvas dimensions
    this.scaledPoints = rawPoints.map(p => ({
      x: pad + p.x * (w - 2 * pad),
      y: pad + p.y * (h - 2 * pad)
    }));
  }

  getPointAtProgress(progress) {
    if (!this.scaledPoints || this.scaledPoints.length === 0) return { x: 100, y: 100 };
    const pts = this.scaledPoints;
    const n = pts.length;
    const p = ((progress % 1.0) + 1.0) % 1.0;
    const totalSegments = n;
    const index = Math.floor(p * totalSegments);
    const nextIndex = (index + 1) % n;
    const t = (p * totalSegments) - index;

    const p0 = pts[index];
    const p1 = pts[nextIndex];

    return {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t
    };
  }

  render() {
    if (!this.ctx || !this.scaledPoints || this.scaledPoints.length === 0) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Subtle Background Coordinate Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Draw Track Surface (Outer asphalt boundary)
    ctx.beginPath();
    ctx.moveTo(this.scaledPoints[0].x, this.scaledPoints[0].y);
    for (let i = 1; i < this.scaledPoints.length; i++) {
      ctx.lineTo(this.scaledPoints[i].x, this.scaledPoints[i].y);
    }
    ctx.closePath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Wide track bed
    ctx.strokeStyle = "#151b24";
    ctx.lineWidth = 22;
    ctx.stroke();

    // Track centerline ribbon
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // 3. Draw Zone Segment Overlays
    if (this.trackModel && this.trackModel.circuit) {
      const zones = this.trackModel.circuit.zones;
      const totalLen = this.trackModel.circuit.length;

      zones.forEach(z => {
        const startP = z.startDist / totalLen;
        const endP = (z.startDist + z.length) / totalLen;
        const numSteps = 12;

        ctx.beginPath();
        for (let s = 0; s <= numSteps; s++) {
          const prog = startP + (endP - startP) * (s / numSteps);
          const pt = this.getPointAtProgress(prog);
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }

        if (z.type === "ATTACK_ZONE") {
          ctx.strokeStyle = "rgba(225, 6, 0, 0.85)"; // Red attack straight
          ctx.lineWidth = 8;
        } else if (z.type === "BRAKING") {
          ctx.strokeStyle = "rgba(0, 230, 118, 0.85)"; // Green kinetic regen zone
          ctx.lineWidth = 8;
        } else if (z.drs) {
          ctx.strokeStyle = "rgba(255, 184, 0, 0.7)"; // Yellow DRS
          ctx.lineWidth = 6;
        } else {
          ctx.strokeStyle = "rgba(0, 240, 255, 0.3)"; // Cyan corner
          ctx.lineWidth = 4;
        }
        ctx.stroke();

        // Zone Start Marker / Label
        const labelPt = this.getPointAtProgress(startP);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(labelPt.x, labelPt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 4. Draw Rival Car Marker (Red / P1)
    const totalDist = this.trackModel ? this.trackModel.circuit.length : 5793;
    const rivalProg = this.rivalDistance / totalDist;
    const rivalPt = this.getPointAtProgress(rivalProg);

    ctx.save();
    ctx.shadowColor = "#e10600";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#e10600";
    ctx.beginPath();
    ctx.arc(rivalPt.x, rivalPt.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rival Label
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#f87171";
    ctx.fillText("RIVAL", rivalPt.x + 10, rivalPt.y - 8);

    // 5. Draw Ego Car Marker (Cyan / P2) with Tactical Halo
    const egoProg = this.currentDistance / totalDist;
    const egoPt = this.getPointAtProgress(egoProg);

    // Halo pulse ring
    ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(egoPt.x, egoPt.y, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(egoPt.x, egoPt.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ego Label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Chakra Petch', sans-serif";
    ctx.fillText("EGO #01", egoPt.x + 12, egoPt.y + 4);

    // 6. Draw Delta Ribbon between cars
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255, 184, 0, 0.6)";
    ctx.lineWidth = 2;
    ctx.moveTo(egoPt.x, egoPt.y);
    ctx.lineTo(rivalPt.x, rivalPt.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
