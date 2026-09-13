/**
 * TRACKSHIFT — Horizontal Race Twin Visualization (Sections 6 & 15)
 *
 * Replaces geographic circuit map with a clean, high-performance horizontal
 * drag-strip race visualization.
 *
 * Features:
 * - User Car (P2, TrackShift Red & Gold livery, MGU-K boost aura)
 * - Opponent Car (P1, Rival Silver & Cyan livery)
 * - Interactive distance leader-line displaying live gap and closing speed
 * - Dynamic overtaking animation with smooth lane shift
 * - Clear "OVERTAKE SUCCESS" (P2 -> P1) and "ATTACK FAILED" event overlays
 * - Replay simulation button
 */

import { twinStore } from "../state/twinState.js";

export class RaceTwinCanvas {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = null;
    this.ctx = null;
    this.animId = null;

    // Simulation animation state
    this.animProgress = 0.0; // 0..1
    this.isPlaying = false;
    this.trackOffset = 0;

    this.initDOM();
    this.initCanvas();
    this.bindEvents();

    twinStore.subscribe(state => this.onStateChange(state));
  }

  initDOM() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="race-twin-wrapper">
        <div class="race-twin-header">
          <div class="twin-header-left">
            <span class="twin-badge-live">● HORIZONTAL RACE TWIN</span>
            <span class="twin-subtag">2026 STRAIGHTAWAY DYNAMICS</span>
          </div>
          <div class="twin-header-telemetry">
            <span class="twin-metric-pill" id="twin-hud-gap">GAP: 0.80 s</span>
            <span class="twin-metric-pill" id="twin-hud-closing">CLOSING: +8.0 km/h</span>
            <span class="twin-metric-pill" id="twin-hud-soc">ENERGY: 62%</span>
            <button class="btn-replay-sim" id="btn-replay-animation" title="Replay Simulation Animation">
              ↺ REPLAY SIMULATION
            </button>
          </div>
        </div>

        <div class="race-canvas-container" id="race-canvas-container">
          <canvas id="race-twin-canvas"></canvas>
          <div class="race-event-overlay" id="race-event-overlay" style="display: none;">
            <div class="event-banner" id="event-banner-text">OVERTAKE SUCCESS</div>
            <div class="event-subtext" id="event-banner-sub">POSITION GAINED: P2 → P1</div>
          </div>
        </div>
      </div>
    `;
  }

  initCanvas() {
    this.canvas = document.getElementById("race-twin-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.startRenderLoop();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (rect.height || 180) * dpr;
    this.ctx.scale(dpr, dpr);
    this.renderWidth = rect.width;
    this.renderHeight = rect.height || 180;
  }

  bindEvents() {
    const replayBtn = document.getElementById("btn-replay-animation");
    if (replayBtn) {
      replayBtn.addEventListener("click", () => this.triggerAnimation(twinStore.getState().selectedStrategy));
    }
  }

  onStateChange(state) {
    const hudGap = document.getElementById("twin-hud-gap");
    const hudClosing = document.getElementById("twin-hud-closing");
    const hudSoc = document.getElementById("twin-hud-soc");

    if (hudGap) hudGap.textContent = `GAP: ${state.gap.toFixed(2)} s`;
    if (hudClosing) {
      const sign = state.closingSpeed >= 0 ? "+" : "";
      hudClosing.textContent = `CLOSING: ${sign}${state.closingSpeed.toFixed(1)} km/h`;
      hudClosing.style.color = state.closingSpeed >= 0 ? "#00f0ff" : "#ff3b30";
    }
    if (hudSoc) hudSoc.textContent = `ENERGY: ${state.soc}%`;

    // Handle overlay display based on state
    const overlay = document.getElementById("race-event-overlay");
    const banner = document.getElementById("event-banner-text");
    const sub = document.getElementById("event-banner-sub");

    if (overlay && banner && sub) {
      if (state.overtakeResult === "SUCCESS") {
        overlay.style.display = "flex";
        banner.textContent = "OVERTAKE SUCCESS";
        banner.className = "event-banner success";
        sub.textContent = "POSITION GAINED: P2 → P1 (+1.00 EXP POSITION)";
      } else if (state.overtakeResult === "FAILED") {
        overlay.style.display = "flex";
        banner.textContent = "ATTACK FAILED";
        banner.className = "event-banner failed";
        sub.textContent = "ENERGY EXHAUSTED — OPPONENT RETAINS P1";
      } else {
        overlay.style.display = "none";
      }
    }
  }

  triggerAnimation(strategy = "ATTACK") {
    this.animProgress = 0.0;
    this.isPlaying = true;
    this.activeStrategy = strategy;

    const overlay = document.getElementById("race-event-overlay");
    if (overlay) overlay.style.display = "none";

    twinStore.setState({ simulationMode: "RUNNING", overtakeResult: null });

    const state = twinStore.getState();
    const canSucceed = state.soc >= 35 && state.gap <= 1.2 && state.deploymentPower >= 200 && state.ruleStatus !== "VIOLATION";

    let elapsed = 0;
    const duration = 3200; // 3.2s animation duration
    const startTime = performance.now();

    const step = (now) => {
      elapsed = now - startTime;
      this.animProgress = Math.min(1.0, elapsed / duration);

      // Dynamically update timeline progress (00s -> 30s)
      const simSec = (this.animProgress * 30.0).toFixed(1);
      const stageIdx = Math.min(6, Math.floor(this.animProgress * 7));

      // Calculate real-time energy drain during attack animation
      if (strategy === "ATTACK") {
        const deployMJ = Math.round((this.animProgress * 1.80) * 100) / 100;
        const currentSoc = Math.max(10, Math.round(state.soc - (deployMJ / 4.0) * 100));
        twinStore.setState({
          deployedEnergy: deployMJ,
          soc: currentSoc,
          timelineProgressSec: parseFloat(simSec),
          timelineStageIndex: stageIdx
        });
      } else if (strategy === "RECOVER") {
        const recoverMJ = Math.round((this.animProgress * 0.75) * 100) / 100;
        const currentSoc = Math.min(100, Math.round(state.soc + (recoverMJ / 4.0) * 100));
        twinStore.setState({
          recoveredEnergy: recoverMJ,
          soc: currentSoc,
          timelineProgressSec: parseFloat(simSec),
          timelineStageIndex: stageIdx
        });
      }

      if (this.animProgress < 1.0) {
        requestAnimationFrame(step);
      } else {
        this.isPlaying = false;
        twinStore.setState({ simulationMode: "FINISHED" });

        if (strategy === "ATTACK") {
          if (canSucceed) {
            twinStore.setState({
              overtakeResult: "SUCCESS",
              userCar: { ...state.userCar, position: 1 },
              opponentCar: { ...state.opponentCar, position: 2 }
            });
          } else {
            twinStore.setState({
              overtakeResult: "FAILED",
              userCar: { ...state.userCar, position: 2 },
              opponentCar: { ...state.opponentCar, position: 1 }
            });
          }
        }
      }
    };

    requestAnimationFrame(step);
  }

  startRenderLoop() {
    const render = () => {
      this.draw();
      this.animId = requestAnimationFrame(render);
    };
    render();
  }

  draw() {
    if (!this.ctx || !this.renderWidth) return;
    const ctx = this.ctx;
    const w = this.renderWidth;
    const h = this.renderHeight;

    ctx.clearRect(0, 0, w, h);

    // Track scroll offset for moving speed illusion
    this.trackOffset = (this.trackOffset + 3.5) % 80;

    // 1. Draw Track Surface & Curbs
    this.drawTrack(ctx, w, h);

    // 2. Compute Car Positions based on Strategy & Animation Progress
    const state = twinStore.getState();
    const strategy = state.selectedStrategy || "WAIT";

    let userX = w * 0.32;
    let userY = h * 0.58;
    let oppX = w * 0.68;
    let oppY = h * 0.42;

    if (this.isPlaying) {
      const p = this.animProgress;
      if (strategy === "ATTACK") {
        const canPass = state.soc >= 35 && state.gap <= 1.2 && state.deploymentPower >= 200;
        if (canPass) {
          // Accelerate and pull ahead smoothly
          userX = w * 0.32 + p * (w * 0.46);
          // Pull out alongside in middle, tuck back in
          if (p < 0.5) {
            userY = h * 0.58 + p * (h * 0.12);
          } else {
            userY = h * 0.64 - (p - 0.5) * (h * 0.28);
          }
          oppX = w * 0.68 - p * (w * 0.15);
        } else {
          // Draw close to opponent's rear gearbox, then stall out
          if (p < 0.6) {
            userX = w * 0.32 + p * (w * 0.32);
          } else {
            userX = (w * 0.32 + 0.6 * (w * 0.32)) - (p - 0.6) * (w * 0.22);
          }
        }
      } else if (strategy === "SAVE") {
        userX = w * 0.32 - p * (w * 0.08);
      } else if (strategy === "DEFEND") {
        oppX = w * 0.48 - (1 - p) * (w * 0.12);
        userY = h * 0.50 + Math.sin(p * Math.PI * 2) * 12; // defensive weaving
      } else if (strategy === "RECOVER") {
        userX = w * 0.30;
      }
    }

    // 3. Draw Inter-Car Distance Telemetry Line
    this.drawDeltaLine(ctx, userX, userY, oppX, oppY, state.gap, state.closingSpeed);

    // 4. Draw Opponent Car (P1, Silver/Cyan)
    const isOppP1 = state.userCar.position === 2;
    this.drawF1Car(ctx, oppX, oppY, {
      label: isOppP1 ? "P1 LEC #16" : "P2 LEC #16",
      color: "#00d2be", // Mercedes / Cyan accent
      accent: "#e0e0e0",
      speed: state.opponentCar.speed,
      isUser: false
    });

    // 5. Draw User Car (P2, TrackShift Red/Gold)
    this.drawF1Car(ctx, userX, userY, {
      label: isOppP1 ? "P2 YOU #44" : "P1 YOU #44",
      color: "#e10600", // F1 Red
      accent: "#ffd700", // Gold
      speed: state.userCar.speed,
      isUser: true,
      mguKAura: strategy === "ATTACK" && this.isPlaying,
      regenAura: strategy === "RECOVER" && this.isPlaying
    });
  }

  drawTrack(ctx, w, h) {
    // Asphalt base
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0e1117");
    grad.addColorStop(0.5, "#141824");
    grad.addColorStop(1, "#0e1117");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Top & bottom rumble curbs (Red & White alternating)
    const curbH = 7;
    const segmentW = 24;
    for (let x = -this.trackOffset; x < w + segmentW; x += segmentW) {
      const isRed = Math.floor((x + this.trackOffset) / segmentW) % 2 === 0;
      ctx.fillStyle = isRed ? "#e10600" : "#ffffff";
      ctx.fillRect(x, 0, segmentW, curbH);
      ctx.fillRect(x, h - curbH, segmentW, curbH);
    }

    // Lane dashes in center
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 16]);
    ctx.lineDashOffset = -this.trackOffset * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // 100m, 50m Distance brake boards
    const markerInterval = w * 0.35;
    for (let i = 0; i < 3; i++) {
      const mx = ((i * markerInterval) - this.trackOffset * 2) % w;
      const posX = mx < 0 ? mx + w : mx;
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillText(`${(3 - i) * 50}m`, posX, h - 14);
    }
  }

  drawDeltaLine(ctx, x1, y1, x2, y2, gap, closingSpeed) {
    if (x1 >= x2) return; // user has passed opponent

    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(x1 + 32, y1);
    ctx.lineTo(x2 - 32, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Delta badge in center
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.fillStyle = "rgba(10, 14, 23, 0.88)";
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - 38, midY - 12, 76, 24, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${gap.toFixed(2)}s | ${closingSpeed >= 0 ? "+" : ""}${closingSpeed.toFixed(0)}`, midX, midY + 4);

    ctx.restore();
  }

  drawF1Car(ctx, x, y, options) {
    ctx.save();
    ctx.translate(x, y);

    // Glowing MGU-K boost aura (orange/red for deploy, bright green for regen)
    if (options.mguKAura) {
      const auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 36);
      auraGrad.addColorStop(0, "rgba(255, 85, 0, 0.65)");
      auraGrad.addColorStop(1, "rgba(255, 0, 0, 0.0)");
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
    } else if (options.regenAura) {
      const regenGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 36);
      regenGrad.addColorStop(0, "rgba(0, 255, 136, 0.70)");
      regenGrad.addColorStop(1, "rgba(0, 255, 136, 0.0)");
      ctx.fillStyle = regenGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top-down F1 chassis silhouette
    // Body dimensions: ~54px length, 24px width
    ctx.fillStyle = options.color;
    ctx.beginPath();
    // Nosecone
    ctx.moveTo(27, 0);
    // Left front wing
    ctx.lineTo(20, -11);
    ctx.lineTo(16, -11);
    ctx.lineTo(16, -5);
    // Sidepod curve left
    ctx.lineTo(0, -9);
    ctx.lineTo(-14, -9);
    // Left rear wheel/wing
    ctx.lineTo(-18, -12);
    ctx.lineTo(-24, -12);
    ctx.lineTo(-24, -4);
    // Rear diffuser
    ctx.lineTo(-27, -4);
    ctx.lineTo(-27, 4);
    // Right rear wheel/wing
    ctx.lineTo(-24, 4);
    ctx.lineTo(-24, 12);
    ctx.lineTo(-18, 12);
    // Sidepod curve right
    ctx.lineTo(-14, 9);
    ctx.lineTo(0, 9);
    // Right front wing
    ctx.lineTo(16, 5);
    ctx.lineTo(16, 11);
    ctx.lineTo(20, 11);
    ctx.closePath();
    ctx.fill();

    // Halo cockpit (dark gray)
    ctx.fillStyle = "#1a1f2c";
    ctx.beginPath();
    ctx.ellipse(3, 0, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit helmet accent
    ctx.fillStyle = options.accent;
    ctx.beginPath();
    ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Wheels (4 black rectangles)
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(10, -14, 10, 4); // Front Left
    ctx.fillRect(10, 10, 10, 4);  // Front Right
    ctx.fillRect(-22, -14, 11, 4); // Rear Left
    ctx.fillRect(-22, 10, 11, 4);  // Rear Right

    // Car Position & Driver Label Badge
    ctx.fillStyle = options.isUser ? "#ffd700" : "#00f0ff";
    ctx.font = "800 10px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(options.label, 0, -18);

    ctx.restore();
  }
}
