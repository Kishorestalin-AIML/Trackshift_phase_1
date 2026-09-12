/**
 * TRACKSHIFT - PowerChart
 * Real-time Power Utilization Graph plotting MGU-K Power (kW) vs Time / Track Distance.
 * Includes horizontal reference lines at 0, 100, 200, 300, 350 kW,
 * and cumulative displays for energy deployed, harvested, and net balance.
 */

export class PowerChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.dataPoints = []; // { time, dist, powerKw, isHarvest }
    this.maxPoints = 120;
    this.maxPermittedPower = 350;

    this.cumDeployedMJ = 0.0;
    this.cumHarvestedMJ = 0.0;

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.render();
  }

  addDataPoint(time, dist, powerKw, isHarvest = false, dtSeconds = 0.2) {
    this.dataPoints.push({
      time,
      dist,
      powerKw: isHarvest ? -Math.abs(powerKw) : powerKw,
      isHarvest
    });

    if (isHarvest) {
      this.cumHarvestedMJ += (Math.abs(powerKw) * dtSeconds) / 1000.0;
    } else if (powerKw > 0) {
      this.cumDeployedMJ += (powerKw * dtSeconds) / 1000.0;
    }

    if (this.dataPoints.length > this.maxPoints) {
      this.dataPoints.shift();
    }

    this.render();
  }

  resetCumulatives() {
    this.cumDeployedMJ = 0.0;
    this.cumHarvestedMJ = 0.0;
    this.dataPoints = [];
    this.render();
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const padLeft = 55;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 25;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Power range: -250 kW (max harvest) to +375 kW (max deploy headroom)
    const minP = -250;
    const maxP = 375;

    const getY = (powerKw) => {
      const norm = (powerKw - minP) / (maxP - minP);
      return padTop + chartH * (1.0 - norm);
    };

    // 1. Draw Reference Grid Lines
    const refLevels = [
      { val: 350, label: "350 kW (FIA LIMIT)", color: "rgba(225, 6, 0, 0.45)", dash: [4, 4] },
      { val: 300, label: "300 kW", color: "rgba(255, 255, 255, 0.12)", dash: [2, 2] },
      { val: 200, label: "200 kW", color: "rgba(255, 255, 255, 0.12)", dash: [2, 2] },
      { val: 100, label: "100 kW", color: "rgba(255, 255, 255, 0.12)", dash: [2, 2] },
      { val: 0, label: "0 kW (NEUTRAL)", color: "rgba(255, 255, 255, 0.35)", dash: [] },
      { val: -150, label: "-150 kW (REGEN)", color: "rgba(0, 230, 118, 0.25)", dash: [3, 3] }
    ];

    ctx.font = "10px 'JetBrains Mono', monospace";
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

    // 2. Draw Zero Reference Center Baseline
    const zeroY = getY(0);

    // 3. Draw Real-Time Power Trace
    if (this.dataPoints.length > 1) {
      // Shaded fill above/below zero
      ctx.beginPath();
      const firstX = padLeft;
      ctx.moveTo(firstX, zeroY);

      this.dataPoints.forEach((pt, i) => {
        const x = padLeft + (i / (this.maxPoints - 1)) * chartW;
        const y = getY(pt.powerKw);
        ctx.lineTo(x, y);
      });

      const lastX = padLeft + ((this.dataPoints.length - 1) / (this.maxPoints - 1)) * chartW;
      ctx.lineTo(lastX, zeroY);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
      gradient.addColorStop(0, "rgba(225, 6, 0, 0.35)"); // Red deploy
      gradient.addColorStop(0.5, "rgba(255, 184, 0, 0.15)");
      gradient.addColorStop(0.65, "rgba(0, 240, 255, 0.05)");
      gradient.addColorStop(1, "rgba(0, 230, 118, 0.30)"); // Green harvest
      ctx.fillStyle = gradient;
      ctx.fill();

      // Bold Stroke line
      ctx.beginPath();
      this.dataPoints.forEach((pt, i) => {
        const x = padLeft + (i / (this.maxPoints - 1)) * chartW;
        const y = getY(pt.powerKw);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#ffb800";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Current Value Head Dot
      const currentPt = this.dataPoints[this.dataPoints.length - 1];
      const curX = lastX;
      const curY = getY(currentPt.powerKw);

      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fillStyle = currentPt.powerKw >= 0 ? "#e10600" : "#00e676";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Render Cumulative Telemetry Stats Overlay in Top Right
    const netMJ = this.cumHarvestedMJ - this.cumDeployedMJ;
    ctx.textAlign = "left";
    ctx.font = "bold 10px 'JetBrains Mono', monospace";

    ctx.fillStyle = "#ff6b6b";
    ctx.fillText(`DEPLOYED: -${this.cumDeployedMJ.toFixed(2)} MJ`, padLeft + 10, padTop + 14);

    ctx.fillStyle = "#00e676";
    ctx.fillText(`HARVESTED: +${this.cumHarvestedMJ.toFixed(2)} MJ`, padLeft + 180, padTop + 14);

    ctx.fillStyle = netMJ >= 0 ? "#00e676" : "#ffb800";
    ctx.fillText(`NET: ${netMJ >= 0 ? "+" : ""}${netMJ.toFixed(2)} MJ`, padLeft + 350, padTop + 14);
  }
}
