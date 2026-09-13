/**
 * RACE TWIN — Track Segments Metadata
 * Detailed engineering characteristics for every corner and straight of Silverstone GP.
 *
 * Provides:
 *   - Sector categorization (1, 2, 3)
 *   - Attack Potential & Overtake Probability
 *   - Energy requirement (%) & Tactical Risk (%)
 *   - Recommended Action (ATTACK, SAVE, CONTROLLED_ATTACK)
 *   - Visual Zone Color (GREEN = High Opportunity, BLUE = Harvest/Prepare, YELLOW = Caution, RED = Restricted)
 */

export const TRACK_SEGMENTS = [
  // ==========================================
  // SECTOR 1
  // ==========================================
  {
    id: "sf-hamilton",
    name: "Hamilton Straight",
    turn: "S/F",
    sector: 1,
    type: "straight",
    attackPotential: 0.72,
    energyRequired: 9,
    risk: 0.28,
    overtakeProbability: 0.64,
    recommendedAction: "CONTROLLED_ATTACK",
    colorCategory: "GREEN",
    lengthMeters: 520,
    pos: { x: 745, y: 470 },
    tooltipText: "Start/Finish straight. High slipstream potential approaching Abbey entry."
  },
  {
    id: "t1-abbey",
    name: "Abbey",
    turn: "T1",
    sector: 1,
    type: "corner",
    attackPotential: 0.35,
    energyRequired: 4,
    risk: 0.65,
    overtakeProbability: 0.28,
    recommendedAction: "SAVE",
    colorCategory: "YELLOW",
    lengthMeters: 240,
    pos: { x: 670, y: 310 },
    tooltipText: "High-speed flat right-hand kink. Passing offline carries severe vortex turbulence."
  },
  {
    id: "t2-farm",
    name: "Farm Curve",
    turn: "T2",
    sector: 1,
    type: "corner",
    attackPotential: 0.22,
    energyRequired: 3,
    risk: 0.55,
    overtakeProbability: 0.18,
    recommendedAction: "SAVE",
    colorCategory: "BLUE",
    lengthMeters: 280,
    pos: { x: 575, y: 290 },
    tooltipText: "Sweeping downhill left. Primary zone for battery harvesting and thermal recovery."
  },
  {
    id: "t3-village",
    name: "Village",
    turn: "T3",
    sector: 1,
    type: "corner",
    attackPotential: 0.68,
    energyRequired: 7,
    risk: 0.42,
    overtakeProbability: 0.58,
    recommendedAction: "CONTROLLED_ATTACK",
    colorCategory: "GREEN",
    lengthMeters: 210,
    pos: { x: 500, y: 390 },
    tooltipText: "Heavy braking right-hander. Inside line dive opportunity with moderate risk."
  },
  {
    id: "t4-loop",
    name: "The Loop",
    turn: "T4",
    sector: 1,
    type: "corner",
    attackPotential: 0.45,
    energyRequired: 4,
    risk: 0.38,
    overtakeProbability: 0.42,
    recommendedAction: "SAVE",
    colorCategory: "BLUE",
    lengthMeters: 190,
    pos: { x: 385, y: 440 },
    tooltipText: "Slowest corner on circuit (85 km/h). Extreme kinetic MGU-K regeneration zone."
  },
  {
    id: "t5-aintree",
    name: "Aintree",
    turn: "T5",
    sector: 1,
    type: "corner",
    attackPotential: 0.52,
    energyRequired: 6,
    risk: 0.35,
    overtakeProbability: 0.48,
    recommendedAction: "CONTROLLED_ATTACK",
    colorCategory: "BLUE",
    lengthMeters: 230,
    pos: { x: 440, y: 545 },
    tooltipText: "Critical exit traction corner leading onto Wellington Straight."
  },

  // ==========================================
  // SECTOR 2
  // ==========================================
  {
    id: "s2-wellington",
    name: "Wellington Straight",
    turn: "DRS 1",
    sector: 2,
    type: "straight",
    attackPotential: 0.85,
    energyRequired: 10,
    risk: 0.25,
    overtakeProbability: 0.74,
    recommendedAction: "ATTACK",
    colorCategory: "GREEN",
    lengthMeters: 750,
    pos: { x: 260, y: 620 },
    tooltipText: "DRS Zone 1. High-value deployment window into Brooklands braking zone."
  },
  {
    id: "t6-brooklands",
    name: "Brooklands",
    turn: "T6",
    sector: 2,
    type: "corner",
    attackPotential: 0.78,
    energyRequired: 8,
    risk: 0.45,
    overtakeProbability: 0.72,
    recommendedAction: "ATTACK",
    colorCategory: "GREEN",
    lengthMeters: 260,
    pos: { x: 130, y: 585 },
    tooltipText: "Premier overtaking corner. Heavy braking deceleration from 315 km/h."
  },
  {
    id: "t7-luffield",
    name: "Luffield",
    turn: "T7",
    sector: 2,
    type: "corner",
    attackPotential: 0.40,
    energyRequired: 5,
    risk: 0.58,
    overtakeProbability: 0.34,
    recommendedAction: "SAVE",
    colorCategory: "YELLOW",
    lengthMeters: 310,
    pos: { x: 90, y: 460 },
    tooltipText: "Long endurance right-hander. Front-left tyre graining hazard if fighting offline."
  },
  {
    id: "t8-woodcote",
    name: "Woodcote",
    turn: "T8",
    sector: 2,
    type: "corner",
    attackPotential: 0.30,
    energyRequired: 4,
    risk: 0.62,
    overtakeProbability: 0.22,
    recommendedAction: "SAVE",
    colorCategory: "YELLOW",
    lengthMeters: 220,
    pos: { x: 155, y: 350 },
    tooltipText: "Fast right acceleration bend onto the National pit straight."
  },
  {
    id: "s2-national",
    name: "National Straight",
    turn: "STR",
    sector: 2,
    type: "straight",
    attackPotential: 0.58,
    energyRequired: 7,
    risk: 0.38,
    overtakeProbability: 0.52,
    recommendedAction: "CONTROLLED_ATTACK",
    colorCategory: "BLUE",
    lengthMeters: 440,
    pos: { x: 195, y: 260 },
    tooltipText: "Short transitional acceleration zone leading into Copse entry."
  },
  {
    id: "t9-copse",
    name: "Copse",
    turn: "T9",
    sector: 2,
    type: "corner",
    attackPotential: 0.25,
    energyRequired: 4,
    risk: 0.88,
    overtakeProbability: 0.20,
    recommendedAction: "SAVE",
    colorCategory: "RED",
    lengthMeters: 250,
    pos: { x: 260, y: 150 },
    tooltipText: "Blind 290 km/h high-g apex. Extreme risk of contact; hold line and preserve battery."
  },
  {
    id: "t10-maggotts",
    name: "Maggotts",
    turn: "T10",
    sector: 2,
    type: "corner",
    attackPotential: 0.18,
    energyRequired: 3,
    risk: 0.92,
    overtakeProbability: 0.12,
    recommendedAction: "SAVE",
    colorCategory: "RED",
    lengthMeters: 280,
    pos: { x: 380, y: 110 },
    tooltipText: "Ultra high-speed esses entry. Passing strictly impossible without total aero wash."
  },
  {
    id: "t11-13-becketts",
    name: "Becketts",
    turn: "T11-13",
    sector: 2,
    type: "corner",
    attackPotential: 0.24,
    energyRequired: 4,
    risk: 0.82,
    overtakeProbability: 0.16,
    recommendedAction: "SAVE",
    colorCategory: "BLUE",
    lengthMeters: 340,
    pos: { x: 510, y: 110 },
    tooltipText: "Rapid directional transition. High kinetic recovery on off-throttle trail-braking."
  },
  {
    id: "t14-chapel",
    name: "Chapel",
    turn: "T14",
    sector: 2,
    type: "corner",
    attackPotential: 0.48,
    energyRequired: 6,
    risk: 0.40,
    overtakeProbability: 0.44,
    recommendedAction: "CONTROLLED_ATTACK",
    colorCategory: "BLUE",
    lengthMeters: 210,
    pos: { x: 630, y: 150 },
    tooltipText: "Launch corner onto Hangar Straight. Exit speed determines overtake probability."
  },

  // ==========================================
  // SECTOR 3
  // ==========================================
  {
    id: "s3-hangar",
    name: "Hangar Straight",
    turn: "DRS 2",
    sector: 3,
    type: "straight",
    attackPotential: 0.92,
    energyRequired: 12,
    risk: 0.22,
    overtakeProbability: 0.82,
    recommendedAction: "ATTACK",
    colorCategory: "GREEN",
    lengthMeters: 770,
    pos: { x: 740, y: 330 },
    tooltipText: "Longest straight on Silverstone (330+ km/h). Highest expected race value window."
  },
  {
    id: "t15-stowe",
    name: "Stowe",
    turn: "T15",
    sector: 3,
    type: "corner",
    attackPotential: 0.80,
    energyRequired: 8,
    risk: 0.48,
    overtakeProbability: 0.74,
    recommendedAction: "CONTROLLED_ATTACK",
    colorCategory: "GREEN",
    lengthMeters: 270,
    pos: { x: 895, y: 440 },
    tooltipText: "High-speed brake into right-hander. Classic inside slipstream overtake corner."
  },
  {
    id: "t16-vale",
    name: "Vale",
    turn: "T16",
    sector: 3,
    type: "corner",
    attackPotential: 0.55,
    energyRequired: 5,
    risk: 0.52,
    overtakeProbability: 0.50,
    recommendedAction: "SAVE",
    colorCategory: "YELLOW",
    lengthMeters: 180,
    pos: { x: 855, y: 560 },
    tooltipText: "Chicane downhill entry. Significant counter-switchback risk on exit."
  },
  {
    id: "t17-18-club",
    name: "Club",
    turn: "T17-18",
    sector: 3,
    type: "corner",
    attackPotential: 0.45,
    energyRequired: 5,
    risk: 0.45,
    overtakeProbability: 0.40,
    recommendedAction: "SAVE",
    colorCategory: "BLUE",
    lengthMeters: 290,
    pos: { x: 780, y: 625 },
    tooltipText: "Final complex before Start/Finish straight. Pre-charge battery for next lap."
  }
];

export function getSegmentById(id) {
  return TRACK_SEGMENTS.find(s => s.id === id) || TRACK_SEGMENTS[0];
}

export function getSegmentAtNormalizedDist(normDist) {
  const idx = Math.min(
    TRACK_SEGMENTS.length - 1,
    Math.floor(normDist * TRACK_SEGMENTS.length)
  );
  return TRACK_SEGMENTS[idx];
}
