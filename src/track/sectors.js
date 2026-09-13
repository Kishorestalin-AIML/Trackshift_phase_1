/**
 * RACE TWIN — Track Sectors Model (Section 7)
 * Defines boundaries, engineering colors, and dynamic yellow flag status for S1, S2, S3.
 */

export const SECTORS = {
  1: {
    number: 1,
    id: "S1",
    name: "Sector 1",
    label: "S1 (Abbey → Aintree)",
    startFraction: 0.0,
    endFraction: 0.28,
    defaultColor: "#168bff", // Electric Blue
    yellowColor: "#ffd700",  // Bright Caution Amber
    glowColor: "rgba(22, 139, 255, 0.4)",
    lengthMeters: 1520,
    majorCorners: ["Abbey", "Farm", "Village", "The Loop", "Aintree"],
    straights: ["Start / Finish (Hamilton Straight)"],
    status: "GREEN"
  },
  2: {
    number: 2,
    id: "S2",
    name: "Sector 2",
    label: "S2 (Wellington → Chapel)",
    startFraction: 0.28,
    endFraction: 0.71,
    defaultColor: "#00f0ff", // Cyan engineering line (turns bright amber #ffd700 when yellow!)
    yellowColor: "#ffd700",  // Bright Caution Amber
    glowColor: "rgba(0, 240, 255, 0.4)",
    lengthMeters: 2760,
    majorCorners: ["Brooklands", "Luffield", "Woodcote", "Copse", "Maggotts", "Becketts", "Chapel"],
    straights: ["Wellington Straight", "National Straight"],
    status: "GREEN"
  },
  3: {
    number: 3,
    id: "S3",
    name: "Sector 3",
    label: "S3 (Hangar Straight → Club)",
    startFraction: 0.71,
    endFraction: 1.0,
    defaultColor: "#e10600", // Racing Red
    yellowColor: "#ffd700",  // Bright Caution Amber
    glowColor: "rgba(225, 6, 0, 0.4)",
    lengthMeters: 1611,
    majorCorners: ["Stowe", "Vale", "Club"],
    straights: ["Hangar Straight"],
    status: "GREEN"
  }
};

/**
 * Returns the sector for a given progress fraction (0..1)
 */
export function getSectorForProgress(progress) {
  const norm = ((progress % 1) + 1) % 1;
  if (norm < 0.28) return SECTORS[1];
  if (norm < 0.71) return SECTORS[2];
  return SECTORS[3];
}

/**
 * Returns the active color for a sector based on race control state
 */
export function getSectorColor(sectorNum, raceControl, yellowSector) {
  const sec = SECTORS[sectorNum];
  if (!sec) return "#168bff";

  if (raceControl === "YELLOW" || yellowSector === sectorNum || (raceControl === "YELLOW_S2" && sectorNum === 2)) {
    return sec.yellowColor;
  }
  if (raceControl === "SAFETY_CAR" || raceControl === "VSC") {
    return "#ff9f1a"; // Caution Amber
  }
  return sec.defaultColor;
}
