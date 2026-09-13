/**
 * TRACKSHIFT — Simple Horizontal Race Track Visualization
 *
 * Focuses on two moving F1 cars:
 * CAR 1 — MY CAR (Red 🏎️)
 * CAR 2 — OPPONENT (Cyan/Silver 🏎️)
 *
 * Includes:
 * - Continuous horizontal movement along road surface
 * - Floating energy bar above My Car showing real-time discharge (60% -> 43%)
 * - Dynamic gap closing and overtaking animations
 * - Failure animation where My Car draws close but opponent pulls away
 */

export class SimpleRaceTrack {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    this.trackOffset = 0;
    this.animId = null;

    // Simulation animation properties
    this.isSimulating = false;
    this.animProgress = 0.0; // 0..1
    this.currentSoc = 60;
    this.displaySoc = 60;
    this.simulationOutcome = null; // result object from SimpleTwinEngine

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.startRenderLoop();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = 190 * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = 190;
  }

  setSoc(soc) {
    this.currentSoc = soc;
    if (!this.isSimulating) {
      this.displaySoc = soc;
    }
  }

  runOvertake(outcome, onComplete) {
    this.isSimulating = true;
    this.animProgress = 0.0;
    this.simulationOutcome = outcome;
    this.displaySoc = outcome.initialSoc;

    const duration = 2800; // 2.8s animation duration
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      this.animProgress = Math.min(1.0, elapsed / duration);

      // Visibly drain energy bar above car in real time
      const targetSoc = outcome.remainingSoc;
      this.displaySoc = Math.round(
        outcome.initialSoc - this.animProgress * (outcome.initialSoc - targetSoc)
      );

      if (this.animProgress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        this.isSimulating = false;
        if (onComplete) onComplete(outcome);
      }
    };

    requestAnimationFrame(animate);
  }

  startRenderLoop() {
    const render = () => {
      this.draw();
      this.animId = requestAnimationFrame(render);
    };
    render();
  }

  draw() {
    if (!this.ctx || !this.width) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Continuous road animation
    this.trackOffset = (this.trackOffset + 3.2) % 60;

    // 1. Draw Track Surface & Road Markings
    this.drawTrack(ctx, w, h);

    // 2. Calculate Car Positions
    let myCarX = w * 0.28;
    let myCarY = h * 0.62;
    let oppCarX = w * 0.68;
    let oppCarY = h * 0.40;

    if (this.isSimulating && this.simulationOutcome) {
      const p = this.animProgress;
      const success = this.simulationOutcome.success;

      if (success) {
        // Accelerate, pull out alongside, pass opponent, move ahead
        myCarX = w * 0.28 + p * (w * 0.48);
        if (p < 0.45) {
          myCarY = h * 0.62 + p * (h * 0.10);
        } else {
          myCarY = h * 0.66 - (p - 0.45) * (h * 0.26);
        }
        oppCarX = w * 0.68 - p * (w * 0.12);
      } else {
        // Close toward opponent, draw level briefly, then opponent pulls away
        if (p < 0.6) {
          myCarX = w * 0.28 + p * (w * 0.32);
        } else {
          myCarX = (w * 0.28 + 0.6 * (w * 0.32)) - (p - 0.6) * (w * 0.20);
          oppCarX = w * 0.68 + (p - 0.6) * (w * 0.10);
        }
      }
    } else if (this.simulationOutcome && this.simulationOutcome.success) {
      // Post-overtake position (My car is in front)
      myCarX = w * 0.72;
      myCarY = h * 0.42;
      oppCarX = w * 0.35;
      oppCarY = h * 0.60;
    }

    // 3. Draw Inter-Car Connector Line if Opponent is ahead
    if (myCarX < oppCarX) {
      this.drawInterCarGap(ctx, myCarX, myCarY, oppCarX, oppCarY);
    }

    // 4. Draw Car 2 — OPPONENT (P1, Cyan/Silver)
    this.drawCar(ctx, oppCarX, oppCarY, {
      label: myCarX > oppCarX ? "P2 OPPONENT" : "P1 OPPONENT",
      bodyColor: "#00d2be",
      accentColor: "#ffffff",
      isUser: false
    });

    // 5. Draw Car 1 — MY CAR (Red/Gold) with Overhead Energy Bar
    this.drawCar(ctx, myCarX, myCarY, {
      label: myCarX > oppCarX ? "P1 MY CAR" : "P2 MY CAR",
      bodyColor: "#e10600",
      accentColor: "#ffd700",
      isUser: true,
      soc: this.displaySoc,
      isBoosting: this.isSimulating
    });
  }

  drawTrack(ctx, w, h) {
    // Asphalt dark gradient
    const asphaltGrad = ctx.createLinearGradient(0, 0, 0, h);
    asphaltGrad.addColorStop(0, "#0c101b");
    asphaltGrad.addColorStop(0.5, "#151b2a");
    asphaltGrad.addColorStop(1, "#0c101b");
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(0, 0, w, h);

    // Rumble Curbs top and bottom (Red & White)
    const curbHeight = 8;
    const curbSegmentWidth = 24;
    for (let x = -this.trackOffset; x < w + curbSegmentWidth; x += curbSegmentWidth) {
      const isRed = Math.floor((x + this.trackOffset) / curbSegmentWidth) % 2 === 0;
      ctx.fillStyle = isRed ? "#e10600" : "#ffffff";
      ctx.fillRect(x, 0, curbSegmentWidth, curbHeight);
      ctx.fillRect(x, h - curbHeight, curbSegmentWidth, curbHeight);
    }

    // White dashed center line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 16]);
    ctx.lineDashOffset = -this.trackOffset * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawInterCarGap(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(x1 + 30, y1);
    ctx.lineTo(x2 - 30, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gap badge
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.fillStyle = "rgba(10, 14, 23, 0.85)";
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - 32, midY - 11, 64, 22, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAP 0.72s", midX, midY + 4);

    ctx.restore();
  }

  drawCar(ctx, x, y, opts) {
    ctx.save();
    ctx.translate(x, y);

    // Boost glowing particle trail if deploying
    if (opts.isBoosting) {
      const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 32);
      aura.addColorStop(0, "rgba(255, 100, 0, 0.6)");
      aura.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top-down F1 car silhouette (length ~50px, width ~22px)
    ctx.fillStyle = opts.bodyColor;
    ctx.beginPath();
    // Nose
    ctx.moveTo(25, 0);
    // Front wing left
    ctx.lineTo(18, -10);
    ctx.lineTo(14, -10);
    ctx.lineTo(14, -4);
    // Sidepod left
    ctx.lineTo(0, -8);
    ctx.lineTo(-12, -8);
    // Rear wing left
    ctx.lineTo(-16, -11);
    ctx.lineTo(-22, -11);
    ctx.lineTo(-22, -4);
    // Diffuser
    ctx.lineTo(-25, -4);
    ctx.lineTo(-25, 4);
    // Rear wing right
    ctx.lineTo(-22, 4);
    ctx.lineTo(-22, 11);
    ctx.lineTo(-16, 11);
    // Sidepod right
    ctx.lineTo(-12, 8);
    ctx.lineTo(0, 8);
    // Front wing right
    ctx.lineTo(14, 4);
    ctx.lineTo(14, 10);
    ctx.lineTo(18, 10);
    ctx.closePath();
    ctx.fill();

    // Halo & Cockpit
    ctx.fillStyle = "#12151e";
    ctx.beginPath();
    ctx.ellipse(2, 0, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Driver helmet
    ctx.fillStyle = opts.accentColor;
    ctx.beginPath();
    ctx.arc(1, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Wheels (4 black rectangles)
    ctx.fillStyle = "#07090e";
    ctx.fillRect(8, -13, 9, 3.5);
    ctx.fillRect(8, 9.5, 9, 3.5);
    ctx.fillRect(-20, -13, 10, 3.5);
    ctx.fillRect(-20, 9.5, 10, 3.5);

    // Driver label tag above
    ctx.fillStyle = opts.isUser ? "#ffd700" : "#00f0ff";
    ctx.font = "800 10px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, 0, -18);

    // Floating Energy Bar above My Car (Section 4 requirement)
    if (opts.isUser) {
      const barW = 56;
      const barH = 5;
      const barX = -barW / 2;
      const barY = -32;

      // Background
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(barX - 2, barY - 11, barW + 4, barH + 13);

      // Energy text label: ENERGY 60%
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 8.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`ENERGY ${opts.soc}%`, 0, barY - 2);

      // Track
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(barX, barY, barW, barH);

      // Fill bar
      const fillW = Math.max(0, (opts.soc / 100) * barW);
      ctx.fillStyle = opts.soc < 25 ? "#ff3b30" : opts.soc < 45 ? "#ff9500" : "#00ff88";
      ctx.fillRect(barX, barY, fillW, barH);
    }

    ctx.restore();
  }
}
