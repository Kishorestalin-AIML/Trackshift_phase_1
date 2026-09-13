/**
 * TRACKSHIFT - TrackModel
 * Primary Track: Spa-inspired simulation track (7,004m closed circuit)
 * Features 17 numbered turns (T1 to T17) and 9 strategic zone classifications.
 */

export const STRATEGIC_ZONE_TYPES = {
  BRAKING_HARVEST: "BRAKING_HARVEST",
  CORNER_ENTRY: "CORNER_ENTRY",
  CORNER: "CORNER",
  CORNER_EXIT: "CORNER_EXIT",
  ACCELERATION: "ACCELERATION",
  ATTACK: "ATTACK",
  DEFENSE: "DEFENSE",
  LOW_VALUE: "LOW_VALUE",
  HIGH_VALUE_ATTACK: "HIGH_VALUE_ATTACK"
};

export const CIRCUITS = {
  SPA_SIMULATION: {
    id: "SPA_SIMULATION",
    name: "Spa-inspired simulation track",
    officialLabel: "Spa-inspired simulation track",
    length: 7004, // meters
    totalLaps: 10, // Test run default: 10 laps
    baseLapTime: 104.2, // seconds
    turnsCount: 17,
    zones: [
      {
        id: "Z1_LA_SOURCE",
        turn: "T1",
        name: "T1 La Source",
        type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST,
        startDistance: 0,
        endDistance: 380,
        length: 380,
        harvestPotential: 0.92, // Heavy braking recovery from 305 to 70 km/h
        deploymentValue: 0.45,
        overtakingValue: 0.84,
        counterRisk: 0.42, // Switchback vulnerability on exit
        brakingIntensity: 0.95,
        cornerExitValue: 0.88,
        entrySpeed: 305,
        apexSpeed: 70,
        exitSpeed: 140,
        speedDeltaPotential: -235,
        drs: false,
        description: "Tight right-hand hairpin. Heavy deceleration harvest, high switchback counter-risk."
      },
      {
        id: "Z2_EAU_ROUGE_RAIDILLON",
        turn: "T2-T4",
        name: "T2-T4 Eau Rouge / Raidillon",
        type: STRATEGIC_ZONE_TYPES.ACCELERATION,
        startDistance: 380,
        endDistance: 1030,
        length: 650,
        harvestPotential: 0.10,
        deploymentValue: 0.72,
        overtakingValue: 0.25,
        counterRisk: 0.14,
        brakingIntensity: 0.05,
        cornerExitValue: 0.95, // Exit speed dictates straight line speed on Kemmel
        entrySpeed: 140,
        apexSpeed: 305,
        exitSpeed: 310,
        speedDeltaPotential: 170,
        drs: false,
        description: "Steep uphill compression and crest. Critical exit traction for Kemmel Straight."
      },
      {
        id: "Z3_KEMMEL_STRAIGHT",
        turn: "T5",
        name: "T5 Kemmel Straight",
        type: STRATEGIC_ZONE_TYPES.HIGH_VALUE_ATTACK,
        startDistance: 1030,
        endDistance: 2050,
        length: 1020,
        harvestPotential: 0.05,
        deploymentValue: 0.98,
        overtakingValue: 0.94, // Prime DRS attack zone
        counterRisk: 0.32,
        brakingIntensity: 0.0,
        cornerExitValue: 0.30,
        entrySpeed: 310,
        apexSpeed: 350,
        exitSpeed: 350,
        speedDeltaPotential: 40,
        drs: true,
        description: "1,020m primary overtaking zone with DRS. Maximum deployment efficiency."
      },
      {
        id: "Z4_LES_COMBES_MALMEDY",
        turn: "T6-T7",
        name: "T6-T7 Les Combes & Malmedy",
        type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST,
        startDistance: 2050,
        endDistance: 2630,
        length: 580,
        harvestPotential: 0.94,
        deploymentValue: 0.35,
        overtakingValue: 0.88,
        counterRisk: 0.40,
        brakingIntensity: 0.92,
        cornerExitValue: 0.65,
        entrySpeed: 350,
        apexSpeed: 130,
        exitSpeed: 195,
        speedDeltaPotential: -220,
        drs: false,
        description: "Severe braking from 350 km/h into downhill chicane. Heavy kinetic recovery."
      },
      {
        id: "Z5_BRUXELLES_RIVAGE",
        turn: "T8-T9",
        name: "T8-T9 Bruxelles / Rivage",
        type: STRATEGIC_ZONE_TYPES.DEFENSE,
        startDistance: 2630,
        endDistance: 3550,
        length: 920,
        harvestPotential: 0.55,
        deploymentValue: 0.30,
        overtakingValue: 0.38,
        counterRisk: 0.28,
        brakingIntensity: 0.60,
        cornerExitValue: 0.50,
        entrySpeed: 240,
        apexSpeed: 105,
        exitSpeed: 185,
        speedDeltaPotential: -135,
        drs: false,
        description: "Long looping downhill 180-degree hairpin. Defensive line holding zone."
      },
      {
        id: "Z6_POUHON",
        turn: "T10-T11",
        name: "T10-T11 Double Pouhon",
        type: STRATEGIC_ZONE_TYPES.CORNER_EXIT,
        startDistance: 3550,
        endDistance: 4480,
        length: 930,
        harvestPotential: 0.35,
        deploymentValue: 0.50,
        overtakingValue: 0.32,
        counterRisk: 0.22,
        brakingIntensity: 0.35,
        cornerExitValue: 0.90,
        entrySpeed: 290,
        apexSpeed: 240,
        exitSpeed: 280,
        speedDeltaPotential: -50,
        drs: false,
        description: "Ultra high-speed double-apex left-hander pulling 5.2g lateral acceleration."
      },
      {
        id: "Z7_FAGNES",
        turn: "T12",
        name: "T12 Fagnes Chicane",
        type: STRATEGIC_ZONE_TYPES.CORNER_ENTRY,
        startDistance: 4480,
        endDistance: 4950,
        length: 470,
        harvestPotential: 0.60,
        deploymentValue: 0.40,
        overtakingValue: 0.48,
        counterRisk: 0.32,
        brakingIntensity: 0.68,
        cornerExitValue: 0.70,
        entrySpeed: 280,
        apexSpeed: 160,
        exitSpeed: 215,
        speedDeltaPotential: -120,
        drs: false,
        description: "Right-left flick requiring curb riding and precise throttle pickup."
      },
      {
        id: "Z8_STAVELOT",
        turn: "T13-T14",
        name: "T13-T14 Stavelot / Paul Frere",
        type: STRATEGIC_ZONE_TYPES.ACCELERATION,
        startDistance: 4950,
        endDistance: 5400,
        length: 450,
        harvestPotential: 0.25,
        deploymentValue: 0.65,
        overtakingValue: 0.40,
        counterRisk: 0.20,
        brakingIntensity: 0.40,
        cornerExitValue: 0.94,
        entrySpeed: 215,
        apexSpeed: 190,
        exitSpeed: 280,
        speedDeltaPotential: 65,
        drs: false,
        description: "Fast accelerating right-hander launching onto the full-throttle run to Blanchimont."
      },
      {
        id: "Z9_BLANCHIMONT",
        turn: "T15",
        name: "T15 Blanchimont",
        type: STRATEGIC_ZONE_TYPES.ATTACK,
        startDistance: 5400,
        endDistance: 6550,
        length: 1150,
        harvestPotential: 0.08,
        deploymentValue: 0.78,
        overtakingValue: 0.70,
        counterRisk: 0.24,
        brakingIntensity: 0.05,
        cornerExitValue: 0.85,
        entrySpeed: 280,
        apexSpeed: 335,
        exitSpeed: 335,
        speedDeltaPotential: 55,
        drs: true,
        description: "Flat-out blast at 335 km/h setting up final divebomb opportunity at Bus Stop."
      },
      {
        id: "Z10_BUS_STOP",
        turn: "T16-T17",
        name: "T16-T17 Bus Stop Chicane",
        type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST,
        startDistance: 6550,
        endDistance: 7004,
        length: 454,
        harvestPotential: 0.90,
        deploymentValue: 0.35,
        overtakingValue: 0.86,
        counterRisk: 0.48, // Extreme switchback risk on pit straight exit
        brakingIntensity: 0.94,
        cornerExitValue: 0.75,
        entrySpeed: 335,
        apexSpeed: 82,
        exitSpeed: 160,
        speedDeltaPotential: -253,
        drs: false,
        description: "Hard stop from 335 to 82 km/h. High kinetic recovery, critical DRS exit traction."
      }
    ]
  },

  MONZA: {
    id: "MONZA",
    name: "Autodromo Nazionale Monza",
    officialLabel: "Monza GP Track",
    length: 5793,
    totalLaps: 10,
    baseLapTime: 81.5,
    turnsCount: 11,
    zones: [
      { id: "Z1_MAIN_STRAIGHT", turn: "T1-T2 Lead", name: "Rettifilo Tribune", type: STRATEGIC_ZONE_TYPES.HIGH_VALUE_ATTACK, startDistance: 0, endDistance: 1050, length: 1050, harvestPotential: 0.1, deploymentValue: 0.95, overtakingValue: 0.85, counterRisk: 0.22, brakingIntensity: 0.0, cornerExitValue: 0.3, entrySpeed: 290, apexSpeed: 345, exitSpeed: 345, speedDeltaPotential: 18, drs: true },
      { id: "Z2_PRIMA_VARIANTE", turn: "T1-T2", name: "Variante del Rettifilo", type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST, startDistance: 1050, endDistance: 1330, length: 280, harvestPotential: 0.95, deploymentValue: 0.3, overtakingValue: 0.88, counterRisk: 0.35, brakingIntensity: 0.98, cornerExitValue: 0.8, entrySpeed: 345, apexSpeed: 75, exitSpeed: 140, speedDeltaPotential: -270, drs: false },
      { id: "Z3_CURVA_GRANDE", turn: "T3", name: "Curva Grande", type: STRATEGIC_ZONE_TYPES.ACCELERATION, startDistance: 1330, endDistance: 2150, length: 820, harvestPotential: 0.15, deploymentValue: 0.6, overtakingValue: 0.32, counterRisk: 0.18, brakingIntensity: 0.1, cornerExitValue: 0.9, entrySpeed: 140, apexSpeed: 285, exitSpeed: 310, speedDeltaPotential: 170, drs: false },
      { id: "Z4_VARIANTE_ROGGIA", turn: "T4-T5", name: "Variante della Roggia", type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST, startDistance: 2150, endDistance: 2470, length: 320, harvestPotential: 0.82, deploymentValue: 0.35, overtakingValue: 0.72, counterRisk: 0.40, brakingIntensity: 0.88, cornerExitValue: 0.7, entrySpeed: 320, apexSpeed: 110, exitSpeed: 180, speedDeltaPotential: -210, drs: false },
      { id: "Z5_LESMO_COMPLEX", turn: "T6-T7", name: "Curva di Lesmo", type: STRATEGIC_ZONE_TYPES.CORNER, startDistance: 2470, endDistance: 3150, length: 680, harvestPotential: 0.45, deploymentValue: 0.4, overtakingValue: 0.28, counterRisk: 0.25, brakingIntensity: 0.5, cornerExitValue: 0.65, entrySpeed: 260, apexSpeed: 165, exitSpeed: 235, speedDeltaPotential: -95, drs: false },
      { id: "Z6_SERRAGLIO", turn: "T7 Exit", name: "Curva del Serraglio", type: STRATEGIC_ZONE_TYPES.ATTACK, startDistance: 3150, endDistance: 3790, length: 640, harvestPotential: 0.1, deploymentValue: 0.7, overtakingValue: 0.65, counterRisk: 0.28, brakingIntensity: 0.05, cornerExitValue: 0.75, entrySpeed: 235, apexSpeed: 325, exitSpeed: 330, speedDeltaPotential: 95, drs: true },
      { id: "Z7_VARIANTE_ASCARI", turn: "T8-T10", name: "Variante Ascari", type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST, startDistance: 3790, endDistance: 4300, length: 510, harvestPotential: 0.78, deploymentValue: 0.4, overtakingValue: 0.75, counterRisk: 0.38, brakingIntensity: 0.82, cornerExitValue: 0.85, entrySpeed: 330, apexSpeed: 170, exitSpeed: 240, speedDeltaPotential: -160, drs: false },
      { id: "Z8_BACK_STRAIGHT", turn: "T10 Exit", name: "Rettifilo di Rialto", type: STRATEGIC_ZONE_TYPES.HIGH_VALUE_ATTACK, startDistance: 4300, endDistance: 5220, length: 920, harvestPotential: 0.1, deploymentValue: 0.9, overtakingValue: 0.82, counterRisk: 0.20, brakingIntensity: 0.0, cornerExitValue: 0.4, entrySpeed: 240, apexSpeed: 335, exitSpeed: 340, speedDeltaPotential: 100, drs: true },
      { id: "Z9_PARABOLICA", turn: "T11", name: "Curva Parabolica", type: STRATEGIC_ZONE_TYPES.CORNER_EXIT, startDistance: 5220, endDistance: 5793, length: 573, harvestPotential: 0.55, deploymentValue: 0.6, overtakingValue: 0.45, counterRisk: 0.45, brakingIntensity: 0.65, cornerExitValue: 0.95, entrySpeed: 340, apexSpeed: 215, exitSpeed: 290, speedDeltaPotential: -125, drs: false }
    ]
  },

  SILVERSTONE: {
    id: "SILVERSTONE",
    name: "Silverstone Grand Prix Circuit",
    officialLabel: "Silverstone GP (5,891m • 18 Turns)",
    length: 5891, // meters
    totalLaps: 10,
    baseLapTime: 87.4, // seconds
    turnsCount: 18,
    sectors: [
      { id: "S1", name: "Sector 1", startDistance: 0, endDistance: 1480, targetTime: 28.204 },
      { id: "S2", name: "Sector 2", startDistance: 1480, endDistance: 4760, targetTime: 36.841 },
      { id: "S3", name: "Sector 3", startDistance: 4760, endDistance: 5891, targetTime: 25.937 }
    ],
    zones: [
      {
        id: "Z1_HAMILTON_ABBEY",
        turn: "T1-T2",
        name: "T1-T2 Abbey & Farm",
        type: STRATEGIC_ZONE_TYPES.ACCELERATION,
        startDistance: 0,
        endDistance: 540,
        length: 540,
        harvestPotential: 0.15,
        deploymentValue: 0.70,
        overtakingValue: 0.35,
        counterRisk: 0.20,
        brakingIntensity: 0.10,
        cornerExitValue: 0.90,
        entrySpeed: 290,
        apexSpeed: 260,
        exitSpeed: 295,
        speedDeltaPotential: 5,
        drs: false,
        description: "Flat-out blast through Abbey kink into sweeping Farm curve. Critical entry line for Village hairpin."
      },
      {
        id: "Z2_VILLAGE_LOOP",
        turn: "T3-T4",
        name: "T3-T4 Village & The Loop",
        type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST,
        startDistance: 540,
        endDistance: 1180,
        length: 640,
        harvestPotential: 0.88,
        deploymentValue: 0.40,
        overtakingValue: 0.82,
        counterRisk: 0.45,
        brakingIntensity: 0.90,
        cornerExitValue: 0.94,
        entrySpeed: 295,
        apexSpeed: 88,
        exitSpeed: 140,
        speedDeltaPotential: -207,
        drs: false,
        description: "Heavy braking hairpin complex. Massive kinetic recovery; tight exit dictates speed down Wellington."
      },
      {
        id: "Z3_AINTREE",
        turn: "T5",
        name: "T5 Aintree Corner",
        type: STRATEGIC_ZONE_TYPES.CORNER_EXIT,
        startDistance: 1180,
        endDistance: 1480,
        length: 300,
        harvestPotential: 0.10,
        deploymentValue: 0.65,
        overtakingValue: 0.30,
        counterRisk: 0.18,
        brakingIntensity: 0.15,
        cornerExitValue: 0.96,
        entrySpeed: 140,
        apexSpeed: 215,
        exitSpeed: 250,
        speedDeltaPotential: 110,
        drs: false,
        description: "Full-throttle left exit launching cars onto Wellington Straight with maximum traction."
      },
      {
        id: "Z4_WELLINGTON_STRAIGHT",
        turn: "DRS 1",
        name: "Wellington Straight (DRS)",
        type: STRATEGIC_ZONE_TYPES.HIGH_VALUE_ATTACK,
        startDistance: 1480,
        endDistance: 2360,
        length: 880,
        harvestPotential: 0.05,
        deploymentValue: 0.96,
        overtakingValue: 0.92,
        counterRisk: 0.35,
        brakingIntensity: 0.00,
        cornerExitValue: 0.40,
        entrySpeed: 250,
        apexSpeed: 325,
        exitSpeed: 325,
        speedDeltaPotential: 75,
        drs: true,
        description: "880m primary DRS overtaking zone. High-yield ERS deployment leading into Brooklands."
      },
      {
        id: "Z5_BROOKLANDS_LUFFIELD",
        turn: "T6-T7",
        name: "T6-T7 Brooklands & Luffield",
        type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST,
        startDistance: 2360,
        endDistance: 3120,
        length: 760,
        harvestPotential: 0.90,
        deploymentValue: 0.42,
        overtakingValue: 0.85,
        counterRisk: 0.42,
        brakingIntensity: 0.92,
        cornerExitValue: 0.88,
        entrySpeed: 325,
        apexSpeed: 110,
        exitSpeed: 170,
        speedDeltaPotential: -215,
        drs: false,
        description: "Hard stop from 325 km/h into long sweeping right carousel. High kinetic recovery and cutback risk."
      },
      {
        id: "Z6_WOODCOTE_NATIONAL",
        turn: "T8",
        name: "T8 Woodcote & National Straight",
        type: STRATEGIC_ZONE_TYPES.ACCELERATION,
        startDistance: 3120,
        endDistance: 3680,
        length: 560,
        harvestPotential: 0.10,
        deploymentValue: 0.68,
        overtakingValue: 0.38,
        counterRisk: 0.22,
        brakingIntensity: 0.10,
        cornerExitValue: 0.90,
        entrySpeed: 170,
        apexSpeed: 255,
        exitSpeed: 295,
        speedDeltaPotential: 125,
        drs: false,
        description: "Fast curving acceleration past old pit complex heading towards Copse."
      },
      {
        id: "Z7_COPSE",
        turn: "T9",
        name: "T9 Copse Corner",
        type: STRATEGIC_ZONE_TYPES.CORNER,
        startDistance: 3680,
        endDistance: 4120,
        length: 440,
        harvestPotential: 0.30,
        deploymentValue: 0.55,
        overtakingValue: 0.32,
        counterRisk: 0.24,
        brakingIntensity: 0.30,
        cornerExitValue: 0.94,
        entrySpeed: 295,
        apexSpeed: 265,
        exitSpeed: 285,
        speedDeltaPotential: -10,
        drs: false,
        description: "Legendary 265 km/h high-speed blind right corner pulling over 4.8G lateral load."
      },
      {
        id: "Z8_MAGGOTTS_BECKETTS_CHAPEL",
        turn: "T10-T14",
        name: "T10-T14 Maggotts, Becketts & Chapel",
        type: STRATEGIC_ZONE_TYPES.DEFENSE,
        startDistance: 4120,
        endDistance: 4760,
        length: 640,
        harvestPotential: 0.45,
        deploymentValue: 0.60,
        overtakingValue: 0.40,
        counterRisk: 0.28,
        brakingIntensity: 0.45,
        cornerExitValue: 0.98,
        entrySpeed: 285,
        apexSpeed: 215,
        exitSpeed: 290,
        speedDeltaPotential: 5,
        drs: false,
        description: "Iconic high-speed chicane sequence. Perfect exit from Chapel is essential for Hangar Straight."
      },
      {
        id: "Z9_HANGAR_STRAIGHT",
        turn: "DRS 2",
        name: "Hangar Straight (DRS Prime)",
        type: STRATEGIC_ZONE_TYPES.HIGH_VALUE_ATTACK,
        startDistance: 4760,
        endDistance: 5460,
        length: 700,
        harvestPotential: 0.05,
        deploymentValue: 0.98,
        overtakingValue: 0.95,
        counterRisk: 0.30,
        brakingIntensity: 0.00,
        cornerExitValue: 0.35,
        entrySpeed: 290,
        apexSpeed: 335,
        exitSpeed: 335,
        speedDeltaPotential: 45,
        drs: true,
        description: "Full-power 335 km/h straight. Prime ERS overtake zone into Stowe."
      },
      {
        id: "Z10_STOWE_VALE_CLUB",
        turn: "T15-T18",
        name: "T15-T18 Stowe, Vale & Club",
        type: STRATEGIC_ZONE_TYPES.BRAKING_HARVEST,
        startDistance: 5460,
        endDistance: 5891,
        length: 431,
        harvestPotential: 0.94,
        deploymentValue: 0.35,
        overtakingValue: 0.84,
        counterRisk: 0.46,
        brakingIntensity: 0.95,
        cornerExitValue: 0.85,
        entrySpeed: 335,
        apexSpeed: 95,
        exitSpeed: 210,
        speedDeltaPotential: -240,
        drs: false,
        description: "Heavy braking at Stowe and Vale chicane. Maximum energy regeneration into final Club turn."
      }
    ]
  }
};

export class TrackModel {
  constructor(circuitId = "SILVERSTONE") {
    this.circuit = CIRCUITS[circuitId] || CIRCUITS.SILVERSTONE || CIRCUITS.SPA_SIMULATION;
  }

  setCircuit(circuitId) {
    if (CIRCUITS[circuitId]) {
      this.circuit = CIRCUITS[circuitId];
    }
  }

  getZoneAtDistance(distance) {
    const d = ((distance % this.circuit.length) + this.circuit.length) % this.circuit.length;
    for (let i = 0; i < this.circuit.zones.length; i++) {
      const z = this.circuit.zones[i];
      if (d >= z.startDistance && d < z.endDistance) {
        return { zone: z, index: i, progressInZone: (d - z.startDistance) / z.length };
      }
    }
    return { zone: this.circuit.zones[0], index: 0, progressInZone: 0 };
  }

  getSectorAtDistance(distance) {
    const d = ((distance % this.circuit.length) + this.circuit.length) % this.circuit.length;
    const sectors = this.circuit.sectors || [
      { id: "S1", name: "Sector 1", startDistance: 0, endDistance: this.circuit.length * 0.33, targetTime: 28.0 },
      { id: "S2", name: "Sector 2", startDistance: this.circuit.length * 0.33, endDistance: this.circuit.length * 0.75, targetTime: 36.0 },
      { id: "S3", name: "Sector 3", startDistance: this.circuit.length * 0.75, endDistance: this.circuit.length, targetTime: 26.0 }
    ];

    for (let i = 0; i < sectors.length; i++) {
      const s = sectors[i];
      if (d >= s.startDistance && d < s.endDistance) {
        return { sector: s, index: i };
      }
    }
    return { sector: sectors[0], index: 0 };
  }

  getNextZones(currentIndex, count = 4) {
    const result = [];
    const total = this.circuit.zones.length;
    for (let i = 1; i <= count; i++) {
      const idx = (currentIndex + i) % total;
      result.push({
        zone: this.circuit.zones[idx],
        index: idx,
        isNextLap: currentIndex + i >= total
      });
    }
    return result;
  }

  getSectorForZone(zoneId) {
    const zone = this.circuit.zones.find(z => z.id === zoneId);
    if (!zone) return 1;
    const midDist = (zone.startDistance + zone.endDistance) / 2;
    const { index } = this.getSectorAtDistance(midDist);
    return index + 1; // 1, 2, or 3
  }

  isZoneAffectedByCondition(zone, raceCondition) {
    if (!raceCondition || raceCondition === "GREEN") return false;
    if (raceCondition === "VSC" || raceCondition === "SAFETY_CAR") return true;
    const secNum = this.getSectorForZone(zone.id);
    if (raceCondition === "YELLOW_S1" && secNum === 1) return true;
    if (raceCondition === "YELLOW_S2" && secNum === 2) return true;
    if (raceCondition === "YELLOW_S3" && secNum === 3) return true;
    return false;
  }
}
