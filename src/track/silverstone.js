/**
 * RACE TWIN — Silverstone Grand Prix Circuit Geometry
 * 5,891m FIA Grade 1 Reference Circuit
 *
 * Provides:
 *   - Accurate coordinate path nodes with Catmull-Rom smoothing
 *   - Separate SVG path representations for Sector 1, Sector 2, and Sector 3
 *   - Apex kerb coordinates
 *   - Start/Finish line anchor
 */

export const SILVERSTONE_CIRCUIT = {
  id: "silverstone-gp",
  name: "Silverstone Grand Prix Circuit",
  lengthMeters: 5891,
  laps: 52,
  viewBox: "0 0 1000 650",
  width: 1000,
  height: 650,

  // 3 Distinct Sectors with distances and engineering color themes
  sectors: {
    1: {
      id: "S1",
      name: "Sector 1",
      startDistance: 0,
      endDistance: 1520,
      color: "#168bff", // Electric Blue
      glowColor: "rgba(22, 139, 255, 0.4)",
      labelPos: { x: 500, y: 360 }
    },
    2: {
      id: "S2",
      name: "Sector 2",
      startDistance: 1520,
      endDistance: 4280,
      color: "#00f0ff", // Cyan (turns yellow on incident)
      glowColor: "rgba(0, 240, 255, 0.4)",
      labelPos: { x: 260, y: 350 }
    },
    3: {
      id: "S3",
      name: "Sector 3",
      startDistance: 4280,
      endDistance: 5891,
      color: "#e10600", // Racing Red
      glowColor: "rgba(225, 6, 0, 0.4)",
      labelPos: { x: 740, y: 290 }
    }
  },

  // Key control nodes around circuit (normalized viewBox coordinates)
  nodes: [
    // HAMILTON STRAIGHT / START-FINISH (Sector 1 begins)
    { id: "sf", x: 720, y: 470, turn: "S/F", name: "Hamilton Straight", sector: 1, type: "straight" },
    { id: "t1-abbey", x: 670, y: 340, turn: "T1", name: "Abbey", sector: 1, type: "corner", apexSide: -1 },
    { id: "t2-farm", x: 580, y: 320, turn: "T2", name: "Farm Curve", sector: 1, type: "corner", apexSide: 1 },
    { id: "t3-village", x: 490, y: 360, turn: "T3", name: "Village", sector: 1, type: "corner", apexSide: -1 },
    { id: "t4-loop", x: 410, y: 440, turn: "T4", name: "The Loop", sector: 1, type: "corner", apexSide: 1 },
    { id: "t5-aintree", x: 420, y: 530, turn: "T5", name: "Aintree", sector: 1, type: "corner", apexSide: 1 },

    // SECTOR 1 -> SECTOR 2 BOUNDARY (Wellington Straight entry)
    { id: "s1-s2-boundary", x: 370, y: 580, turn: "S1|S2", name: "S1/S2 Boundary", sector: 2, type: "boundary" },
    { id: "wellington", x: 250, y: 590, turn: "DRS 1", name: "Wellington Straight", sector: 2, type: "straight" },
    { id: "t6-brooklands", x: 160, y: 560, turn: "T6", name: "Brooklands", sector: 2, type: "corner", apexSide: 1 },
    { id: "t7-luffield", x: 130, y: 460, turn: "T7", name: "Luffield", sector: 2, type: "corner", apexSide: -1 },
    { id: "t8-woodcote", x: 180, y: 370, turn: "T8", name: "Woodcote", sector: 2, type: "corner", apexSide: -1 },
    { id: "national", x: 210, y: 280, turn: "STR", name: "National Straight", sector: 2, type: "straight" },
    { id: "t9-copse", x: 270, y: 180, turn: "T9", name: "Copse", sector: 2, type: "corner", apexSide: -1 },
    { id: "t10-maggotts", x: 390, y: 140, turn: "T10", name: "Maggotts", sector: 2, type: "corner", apexSide: 1 },
    { id: "t11-13-becketts", x: 510, y: 140, turn: "T11-13", name: "Becketts", sector: 2, type: "corner", apexSide: -1 },
    { id: "t14-chapel", x: 620, y: 180, turn: "T14", name: "Chapel", sector: 2, type: "corner", apexSide: 1 },

    // SECTOR 2 -> SECTOR 3 BOUNDARY (Hangar Straight entry)
    { id: "s2-s3-boundary", x: 670, y: 230, turn: "S2|S3", name: "S2/S3 Boundary", sector: 3, type: "boundary" },
    { id: "hangar", x: 760, y: 330, turn: "DRS 2", name: "Hangar Straight", sector: 3, type: "straight" },
    { id: "t15-stowe", x: 860, y: 440, turn: "T15", name: "Stowe", sector: 3, type: "corner", apexSide: -1 },
    { id: "t16-vale", x: 820, y: 550, turn: "T16", name: "Vale", sector: 3, type: "corner", apexSide: 1 },
    { id: "t17-18-club", x: 760, y: 590, turn: "T17-18", name: "Club", sector: 3, type: "corner", apexSide: -1 }
  ]
};

/**
 * Generate closed spline samples for smooth rendering and car progression
 */
export function generateSplineSamples(nodes, samplesPerSegment = 24) {
  const n = nodes.length;
  const samples = [];
  let cumulativeDist = 0;

  for (let i = 0; i < n; i++) {
    const p0 = nodes[(i - 1 + n) % n];
    const p1 = nodes[i];
    const p2 = nodes[(i + 1) % n];
    const p3 = nodes[(i + 2) % n];

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
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

      // Determine sector based on current index
      let sector = 1;
      if (i >= 6 && i < 16) sector = 2;
      else if (i >= 16) sector = 3;

      samples.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        sector,
        nodeIndex: i,
        nodeName: p1.name
      });
    }
  }

  // Compute normals and cumulative distance
  const total = samples.length;
  for (let i = 0; i < total; i++) {
    const prev = samples[(i - 1 + total) % total];
    const next = samples[(i + 1) % total];
    const curr = samples[i];

    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;

    curr.angle = Math.atan2(dy, dx);
    curr.nx = -dy / len;
    curr.ny = dx / len;

    const stepDist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    cumulativeDist += stepDist;
    curr.cumDist = cumulativeDist;
  }

  return { samples, totalDist: cumulativeDist };
}

/**
 * Pre-generate standard SVG path string from point array
 */
export function buildSvgPathString(points) {
  if (!points || points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}
