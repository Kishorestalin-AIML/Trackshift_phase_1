/**
 * TRACKSHIFT - TrajectoryChart
 * Multi-Horizon Energy Trajectory Graph comparing prospective future energy curves:
 *   1. Current Policy
 *   2. Aggressive Deployment (High drain risk)
 *   3. Conservative Deployment (Hoarding / low yield)
 *   4. TrackShift Optimized Policy (Balanced deployment dip & regenerative recovery)
 */

export class TrajectoryChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.trajectories = {
      optimized: [],
      current: [],
      aggressive: [],
      conservative: []
    };

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.render();
  }

  updateTrajectories(trajectoryData) {
    this.trajectories = trajectoryData;
    this.render();
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 25;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Energy range: 0.0 MJ to 4.0 MJ (Usable ERS capacity)
    const minE = 0.0;
    const maxE = 4.0;

    const getY = (energyMJ) => {
      const norm = (energyMJ - minE) / (maxE - minE);
      return padTop + chartH * (1.0 - norm);
    };

    // 1. Reference Levels (4.0 MJ full, 15% 0.6 MJ floor, etc.)
    const refLevels = [
      { val: 4.0, label: "4.0 MJ (MAX)", color: "rgba(255, 255, 255, 0.15)", dash: [2, 2] },
      { val: 3.0, label: "3.0 MJ", color: "rgba(255, 255, 255, 0.08)", dash: [2, 2] },
      { val: 2.0, label: "2.0 MJ", color: "rgba(255, 255, 255, 0.08)", dash: [2, 2] },
      { val: 1.0, label: "1.0 MJ", color: "rgba(255, 255, 255, 0.08)", dash: [2, 2] },
      { val: 0.6, label: "15% SOC FLOOR", color: "rgba(225, 6, 0, 0.45)", dash: [4, 4] }
    ];

    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    refLevels.forEach(ref => {
      const y = getY(ref.val);
      ctx.strokeStyle = ref.color;
      ctx.setLineDash(ref.dash);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ref.color;
      ctx.fillText(ref.label, padLeft - 6, y);
    });

    // 2. Draw Trajectory Curves
    const drawLine = (points, color, width, dash = []) => {
      if (!points || points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);

      points.forEach((pt, i) => {
        const x = padLeft + (i / (points.length - 1)) * chartW;
        const y = getY(pt.energy);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // A. Conservative Hoarding Trajectory (Cyan)
    drawLine(this.trajectories.conservative, "rgba(0, 240, 255, 0.45)", 1.5, [3, 3]);

    // B. Aggressive Dump Trajectory (Red dotted - shows danger of dipping below floor)
    drawLine(this.trajectories.aggressive, "rgba(225, 6, 0, 0.55)", 1.5, [4, 4]);

    // C. Current Policy Trajectory (Grey)
    drawLine(this.trajectories.current, "rgba(255, 255, 255, 0.35)", 1.5);

    // D. TrackShift Optimized Policy Trajectory (Yellow/Gold Glowing)
    if (this.trajectories.optimized && this.trajectories.optimized.length > 1) {
      ctx.save();
      ctx.shadowColor = "#ffb800";
      ctx.shadowBlur = 8;
      drawLine(this.trajectories.optimized, "#ffb800", 2.5);
      ctx.restore();
    }

    // 3. Legend / Labels
    ctx.textAlign = "left";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";

    ctx.fillStyle = "#ffb800";
    ctx.fillText("● OPTIMIZED POLICY", padLeft + 10, padTop + 12);

    ctx.fillStyle = "rgba(0, 240, 255, 0.7)";
    ctx.fillText("● CONSERVATIVE", padLeft + 150, padTop + 12);

    ctx.fillStyle = "rgba(225, 6, 0, 0.7)";
    ctx.fillText("● AGGRESSIVE", padLeft + 265, padTop + 12);
  }
}
