/**
 * ALPINE RACE TRACK STRIP COMPONENT
 *
 * Visualizes 3 moving F1 cars along a clean horizontal motorsport race-track strip:
 * 1. CAR BEHIND (Rival pressing from rear, smaller car)
 * 2. MY CAR (Alpine F1 Blue 🏎️, with overhead dynamic energy bar)
 * 3. CAR AHEAD (Target opponent car)
 *
 * Implements:
 * - Dynamic inter-car telemetry lines and gap tags
 * - Defensive pressure alerts (< 0.5s)
 * - Real-time energy drain/recovery animations
 * - Full overtake animations (acceleration -> side-by-side -> pass -> position update)
 * - Failed overtake and defensive block maneuvers
 */

export class AlpineRaceTrack {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    this.trackOffset = 0;
    this.animId = null;

    // Simulation states
    this.isSimulating = false;
    this.animProgress = 0.0;
    this.currentSoc = 58;
    this.displaySoc = 58;
    this.simulationOutcome = null;

    // Live position values
    this.state = {
      position: 3,
      carBehindGap: 0.7,
      carAheadGap: 0.8,
      recommendation: "ATTACK"
    };

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

  updateLiveState(newState) {
    this.state = { ...this.state, ...newState };
    if (!this.isSimulating) {
      this.currentSoc = this.state.soc !== undefined ? this.state.soc : this.currentSoc;
      this.displaySoc = this.currentSoc;
      // Clear past simulation outcome so cars respond immediately to live slider movements
      this.simulationOutcome = null;
    }
  }

  runSimulation(outcome, onComplete) {
    this.isSimulating = true;
    this.animProgress = 0.0;
    this.simulationOutcome = outcome;
    this.displaySoc = outcome.initialSoc;

    const duration = 2800; // 2.8s smooth transition
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      this.animProgress = Math.min(1.0, elapsed / duration);

      // Drain or charge overhead energy bar
      const targetSoc = outcome.remainingSoc;
      this.displaySoc = Math.round(
        outcome.initialSoc + this.animProgress * (targetSoc - outcome.initialSoc)
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

    // Continuous road motion
    this.trackOffset = (this.trackOffset + 3.0) % 60;

    // 1. Draw Clean Asphalt Track Strip
    this.drawTrackSurface(ctx, w, h);

    // 2. Compute 3 Car Coordinates
    const isP1 = this.state.position === 1;

    // Base positions across horizontal strip
    let myCarX = isP1 ? w * 0.66 : w * 0.46;
    let myCarY = h * 0.58;

    let behindY = h * 0.62;
    let aheadY = h * 0.40;

    // Smooth, full-range visual mapping from 0.2s to 3.0s (no dead zones!)
    const minGap = 0.2;
    const maxGap = 3.0;

    // Car Behind: 0.2s is right on our rear wing (-0.08w), 3.0s is far behind (-0.38w)
    const behindVal = Math.max(minGap, Math.min(maxGap, this.state.carBehindGap ?? 1.4));
    const behindRatio = (behindVal - minGap) / (maxGap - minGap);
    let behindX = myCarX - (w * 0.08) - behindRatio * (w * 0.30);
    behindX = Math.max(w * 0.05, Math.min(myCarX - 42, behindX));

    let aheadX = w * 0.78;
    if (!isP1) {
      // Car Ahead: 0.2s is right on front bumper (+0.08w), 3.0s is pulling away down straight (+0.40w)
      const aheadVal = Math.max(minGap, Math.min(maxGap, this.state.carAheadGap ?? 0.7));
      const aheadRatio = (aheadVal - minGap) / (maxGap - minGap);
      aheadX = myCarX + (w * 0.08) + aheadRatio * (w * 0.32);
      aheadX = Math.min(w * 0.94, Math.max(myCarX + 42, aheadX));
    }

    // Dynamic Animation Offsets
    if (this.isSimulating && this.simulationOutcome) {
      const p = this.animProgress;
      const rec = this.simulationOutcome.strategy || this.simulationOutcome.recommendation;
      const success = this.simulationOutcome.success ?? (this.simulationOutcome.overtakeOccurred || rec === "SUPER-CLIP");

      if ((rec === "SUPER-CLIP" || rec === "ATTACK") && success) {
        // Stronger closing / attack pass maneuver: accelerate into passing lane, draw alongside, pass
        myCarX = (w * 0.46) + p * (w * 0.38);
        if (p < 0.45) {
          myCarY = (h * 0.58) + p * (h * 0.12);
        } else {
          myCarY = (h * 0.63) - (p - 0.45) * (h * 0.32);
        }
        aheadX = (w * 0.78) - p * (w * 0.14);
      } else if (this.simulationOutcome.positionLost || (this.simulationOutcome.defenceConcession && this.simulationOutcome.positionsLost > 0)) {
        // Section 15, 16, 39: Defensive concession under depleted battery & close rear threat
        // Opponent behind accelerates alongside into passing lane, draws ahead, claims forward position
        behindX = (w * 0.20) + p * (w * 0.42);
        if (p < 0.45) {
          behindY = (h * 0.62) + p * (h * 0.08);
        } else {
          behindY = (h * 0.66) - (p - 0.45) * (h * 0.22);
        }
        myCarX = (w * 0.46) - p * (w * 0.10);
      } else if (rec === "SUPER-CLIP" && !success) {
        // Surge forward, draw alongside, ahead car defends line
        if (p < 0.6) {
          myCarX = (w * 0.46) + p * (w * 0.26);
        } else {
          myCarX = (w * 0.46 + 0.6 * (w * 0.26)) - (p - 0.6) * (w * 0.20);
          aheadX = (w * 0.78) + (p - 0.6) * (w * 0.10);
        }
      } else if (rec === "NORMAL DEPLOYMENT") {
        // Controlled closing: close gap steadily without reckless lunging
        myCarX = (w * 0.46) + Math.sin(p * Math.PI) * (w * 0.10);
      } else if (rec === "BRAKING / HARVEST") {
        // Recovery & build-up: decelerate slightly under heavy braking recovery to build pack capacity
        myCarX = (w * 0.46) - Math.sin(p * Math.PI) * (w * 0.08);
        behindX = (behindX) + Math.sin(p * Math.PI) * (w * 0.04);
      } else if (rec === "COAST" || rec === "WAIT") {
        // Energy preservation: smooth slipstream cruising with minimal battery draw
        myCarX = (w * 0.46) + Math.sin(p * Math.PI * 2) * 3;
      } else if (rec === "DEFEND") {
        // Weave into defensive lane to block closing car behind
        myCarY = (h * 0.58) + Math.sin(p * Math.PI) * (h * 0.12);
        behindX = myCarX - (w * 0.15) + Math.sin(p * Math.PI * 2) * 6;
      }
    } else if (!this.isSimulating) {
      // Live continuous rendering dynamically reflects the calculated strategy
      const rec = this.state.recommendation;
      const isCriticalSoc = (this.state.soc ?? 60) < 25;
      const isCloseBehind = (this.state.carBehindGap ?? 1.4) < 0.6;

      if (rec === "SUPER-CLIP" && !isP1) {
        // Stronger closing / aggressive attack posture toward car ahead
        myCarX = Math.min(aheadX - 38, w * 0.52 + Math.sin(performance.now() * 0.004) * 3);
      } else if (rec === "NORMAL DEPLOYMENT" && !isP1) {
        // Controlled closing distance
        myCarX = Math.min(aheadX - 44, w * 0.47 + Math.sin(performance.now() * 0.002) * 2);
      } else if (rec === "COAST") {
        // Energy preservation: slight lift-off easing back
        myCarX = isP1 ? w * 0.64 : w * 0.43;
      } else if (rec === "BRAKING / HARVEST") {
        // Recovery build-up: braking phase deceleration tuck
        myCarX = isP1 ? w * 0.62 : w * 0.41;
      }

      // Section 10 & 18: Critical battery depletion with opponent pressing behind
      if (isCriticalSoc && isCloseBehind) {
        // Insufficient defence reserve: opponent closes in tightly and threatens to pull alongside
        behindX = Math.min(myCarX - 22, behindX + (w * 0.07));
      }
    } else if (this.simulationOutcome && (this.simulationOutcome.strategy === "SUPER-CLIP" || this.simulationOutcome.recommendation === "ATTACK") && (this.simulationOutcome.success || this.simulationOutcome.overtakeOccurred)) {
      // Post-overtake position (My car is in front of Car Ahead)
      myCarX = w * 0.76;
      myCarY = h * 0.42;
      aheadX = w * 0.44;
      aheadY = h * 0.60;
    } else if (this.simulationOutcome && (this.simulationOutcome.positionLost || (this.simulationOutcome.defenceConcession && this.simulationOutcome.positionsLost > 0))) {
      // Post-concession position (Opponent has passed ahead)
      behindX = w * 0.62;
      behindY = h * 0.44;
      myCarX = w * 0.38;
      myCarY = h * 0.60;
    }

    // 3. Draw Telemetry Connector Lines & Gap Badges
    // Connector: Car Behind -> My Car
    this.drawGapConnector(ctx, behindX, behindY, myCarX, myCarY, {
      gapSec: this.state.carBehindGap,
      isDefensivePressure: this.state.carBehindGap < 0.5,
      isWarning: this.state.carBehindGap < 0.8,
      label: `${this.state.carBehindGap.toFixed(1)}s BEHIND`
    });

    // Connector: My Car -> Car Ahead (only if not P1)
    if (!isP1 && myCarX < aheadX) {
      this.drawGapConnector(ctx, myCarX, myCarY, aheadX, aheadY, {
        gapSec: this.state.carAheadGap,
        isAttackZone: this.state.carAheadGap <= 1.0,
        label: `${this.state.carAheadGap.toFixed(1)}s AHEAD`
      });
    }

    // 4. Draw Car Behind (Smaller rival)
    const behindPos = Math.min(8, this.state.position + 1);
    this.drawCar(ctx, behindX, behindY, {
      label: `P${behindPos} BEHIND`,
      bodyColor: "#64748b",
      accentColor: "#f1f5f9",
      scale: 0.85,
      isUser: false
    });

    // 5. Draw Car Ahead (Target opponent, if not P1)
    if (!isP1) {
      const aheadPos = Math.max(1, this.state.position - 1);
      const isAheadPassed = myCarX > aheadX;
      this.drawCar(ctx, aheadX, aheadY, {
        label: isAheadPassed ? `P${this.state.position} OPPONENT` : `P${aheadPos} AHEAD`,
        bodyColor: "#1e293b",
        accentColor: "#cbd5e1",
        scale: 0.95,
        isUser: false
      });
    }

    // 6. Draw My Car (Hero Alpine F1 Blue 🏎️)
    const currentMyPos = (this.simulationOutcome && this.simulationOutcome.recommendation === "ATTACK" && this.simulationOutcome.success)
      ? `P${Math.max(1, this.state.position - 1)}`
      : `P${this.state.position}`;

    const activeRec = this.isSimulating
      ? (this.simulationOutcome?.strategy || this.simulationOutcome?.recommendation)
      : this.state.recommendation;

    this.drawCar(ctx, myCarX, myCarY, {
      label: `${currentMyPos} MY CAR`,
      bodyColor: "#0090ff", // Iconic Alpine Blue
      accentColor: "#ffffff",
      secondaryAccent: "#ff4d6d", // French Tricolor / Alpine Pink accent
      scale: 1.05,
      isUser: true,
      soc: this.displaySoc,
      isBoosting: activeRec === "SUPER-CLIP" || activeRec === "ATTACK",
      isRecovering: activeRec === "BRAKING / HARVEST" || activeRec === "RECOVER",
      isCoasting: activeRec === "COAST" || activeRec === "WAIT",
      isDefending: activeRec === "DEFEND"
    });

    // 7. Draw "PASS COMPLETE" notification banner if overtake completed or in final third
    const isSuperClip = this.simulationOutcome && (this.simulationOutcome.strategy === "SUPER-CLIP" || this.simulationOutcome.recommendation === "ATTACK");
    const isPass = isSuperClip && (this.simulationOutcome.success || this.simulationOutcome.overtakeOccurred);
    if ((this.isSimulating && isPass && this.animProgress >= 0.55) || (!this.isSimulating && isPass)) {
      this.drawPassCompleteBadge(ctx, w, h);
    }

    // 8. Draw "DEFENSIVE CONCESSION" notification banner if position lost due to depleted battery
    const isConcession = this.simulationOutcome && (this.simulationOutcome.positionLost || (this.simulationOutcome.defenceConcession && this.simulationOutcome.positionsLost > 0));
    if ((this.isSimulating && isConcession && this.animProgress >= 0.55) || (!this.isSimulating && isConcession)) {
      this.drawPositionLostBadge(ctx, w, h);
    }
  }

  drawPassCompleteBadge(ctx, w, h) {
    ctx.save();
    const bannerW = 210;
    const bannerH = 34;
    const bannerX = (w - bannerW) / 2;
    const bannerY = 18;

    // Glowing green shadow
    ctx.shadowColor = "rgba(16, 185, 129, 0.7)";
    ctx.shadowBlur = 10;

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10b981";
    ctx.font = "800 12px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✓ PASS COMPLETE", w / 2, bannerY + 14);

    const oldP = this.state.position;
    const newP = Math.max(1, oldP - 1);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 9.5px 'JetBrains Mono', monospace";
    ctx.fillText(`POSITION GAINED: P${oldP} → P${newP}`, w / 2, bannerY + 27);
    ctx.restore();
  }

  drawPositionLostBadge(ctx, w, h) {
    ctx.save();
    const bannerW = 230;
    const bannerH = 34;
    const bannerX = (w - bannerW) / 2;
    const bannerY = 18;

    // Glowing crimson shadow
    ctx.shadowColor = "rgba(239, 68, 68, 0.7)";
    ctx.shadowBlur = 10;

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ef4444";
    ctx.font = "800 12px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠ DEFENSIVE CONCESSION", w / 2, bannerY + 14);

    const oldP = this.state.position;
    const newP = Math.min(10, oldP + 1);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 9.5px 'JetBrains Mono', monospace";
    ctx.fillText(`POSITION CONCEDED: P${oldP} → P${newP} (BATTERY LOW)`, w / 2, bannerY + 27);
    ctx.restore();
  }

  drawTrackSurface(ctx, w, h) {
    // Crisp asphalt styling with subtle gradients
    const trackGrad = ctx.createLinearGradient(0, 0, 0, h);
    trackGrad.addColorStop(0, "#1e293b");
    trackGrad.addColorStop(0.5, "#0f172a");
    trackGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = trackGrad;
    ctx.fillRect(0, 0, w, h);

    // Alpine Blue & White Rumble Curbs top and bottom
    const curbH = 7;
    const curbW = 22;
    for (let x = -this.trackOffset; x < w + curbW; x += curbW) {
      const isBlue = Math.floor((x + this.trackOffset) / curbW) % 2 === 0;
      ctx.fillStyle = isBlue ? "#0090ff" : "#ffffff";
      ctx.fillRect(x, 0, curbW, curbH);
      ctx.fillRect(x, h - curbH, curbW, curbH);
    }

    // White dashed center line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 14]);
    ctx.lineDashOffset = -this.trackOffset * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawGapConnector(ctx, x1, y1, x2, y2, opts) {
    ctx.save();

    let strokeColor = "rgba(148, 163, 184, 0.4)";
    let badgeBg = "rgba(15, 23, 42, 0.85)";
    let badgeBorder = "#cbd5e1";
    let textColor = "#f8fafc";

    if (opts.isDefensivePressure) {
      strokeColor = "rgba(239, 68, 68, 0.8)";
      badgeBg = "#ef4444";
      badgeBorder = "#b91c1c";
      textColor = "#ffffff";
    } else if (opts.isWarning) {
      strokeColor = "rgba(245, 158, 11, 0.6)";
      badgeBorder = "#f59e0b";
    } else if (opts.isAttackZone) {
      strokeColor = "rgba(0, 144, 255, 0.6)";
      badgeBorder = "#0090ff";
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(x1 + 25, y1);
    ctx.lineTo(x2 - 25, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gap badge box
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const badgeW = opts.isDefensivePressure ? 104 : 76;
    const badgeH = 20;

    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const text = opts.isDefensivePressure ? `⚠ ${opts.label}` : opts.label;
    ctx.fillText(text, midX, midY + 3.5);

    ctx.restore();
  }

  drawCar(ctx, x, y, opts) {
    ctx.save();
    ctx.translate(x, y);
    const s = opts.scale || 1.0;
    ctx.scale(s, s);

    // Boost glowing aura if deploying attack power
    if (opts.isBoosting) {
      const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 36);
      aura.addColorStop(0, "rgba(0, 144, 255, 0.65)");
      aura.addColorStop(1, "rgba(0, 144, 255, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
    } else if (opts.isRecovering) {
      const greenAura = ctx.createRadialGradient(0, 0, 8, 0, 0, 32);
      greenAura.addColorStop(0, "rgba(16, 185, 129, 0.6)");
      greenAura.addColorStop(1, "rgba(16, 185, 129, 0)");
      ctx.fillStyle = greenAura;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top-down F1 Car Silhouette
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

    // Side livery stripes (Alpine Pink / White)
    if (opts.isUser && opts.secondaryAccent) {
      ctx.fillStyle = opts.secondaryAccent;
      ctx.fillRect(-8, -7, 10, 2);
      ctx.fillRect(-8, 5, 10, 2);
    }

    // Cockpit & Halo
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.ellipse(2, 0, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Driver helmet
    ctx.fillStyle = opts.accentColor;
    ctx.beginPath();
    ctx.arc(1, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 4 Wheels
    ctx.fillStyle = "#020617";
    ctx.fillRect(8, -13, 9, 3.5);
    ctx.fillRect(8, 9.5, 9, 3.5);
    ctx.fillRect(-20, -13, 10, 3.5);
    ctx.fillRect(-20, 9.5, 10, 3.5);

    // Car Label Tag
    ctx.fillStyle = opts.isUser ? "#0090ff" : "#f1f5f9";
    ctx.font = "800 10px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, 0, -18);

    // Overhead Real-Time Battery Bar for My Car
    if (opts.isUser) {
      const barW = 56;
      const barH = 5;
      const barX = -barW / 2;
      const barY = -32;

      // Dark badge background
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(barX - 3, barY - 12, barW + 6, barH + 15);

      // Label: ENERGY 58%
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 8.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`ENERGY ${opts.soc}%`, 0, barY - 3);

      // Gray track
      ctx.fillStyle = "#334155";
      ctx.fillRect(barX, barY, barW, barH);

      // Color-coded fill (Alpine blue / green / amber / red)
      const fillW = Math.max(0, (opts.soc / 100) * barW);
      ctx.fillStyle = opts.soc < 25 ? "#ef4444" : opts.soc < 45 ? "#f59e0b" : "#0090ff";
      ctx.fillRect(barX, barY, fillW, barH);
    }

    ctx.restore();
  }
}
