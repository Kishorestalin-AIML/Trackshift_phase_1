/**
 * TRACKSHIFT - TrackModel
 * Segmented representation of F1 circuits with zone-by-zone geometries,
 * braking harvest zones, DRS/attack straights, and counter-attack risk indexes.
 */

export const CIRCUITS = {
  MONZA: {
    id: "MONZA",
    name: "Autodromo Nazionale Monza",
    country: "Italy",
    length: 5793, // meters
    totalLaps: 53,
    baseLapTime: 81.5, // seconds
    zones: [
      {
        id: "Z1_MAIN_STRAIGHT",
        name: "Rettifilo Tribune",
        type: "ATTACK_ZONE",
        startDist: 0,
        length: 1050,
        drs: true,
        harvestPotential: 0.1, // Low harvest during full throttle
        attackOpportunity: 0.85, // Prime overtake window
        counterRisk: 0.22,
        entrySpeed: 290,
        apexSpeed: 345,
        exitSpeed: 345,
        speedDeltaPotential: 18,
        description: "Primary DRS straight heading into Prima Variante chicane."
      },
      {
        id: "Z2_PRIMA_VARIANTE",
        name: "Variante del Rettifilo (T1-T2)",
        type: "BRAKING",
        startDist: 1050,
        length: 280,
        drs: false,
        harvestPotential: 0.95, // Massive kinetic harvest from 345 to 75 km/h
        attackOpportunity: 0.88, // Divebomb / slipstream completion
        counterRisk: 0.35, // Switchback vulnerability on exit
        entrySpeed: 345,
        apexSpeed: 75,
        exitSpeed: 140,
        speedDeltaPotential: -270,
        description: "Heaviest braking zone on the calendar. Extreme kinetic regeneration."
      },
      {
        id: "Z3_CURVA_GRANDE",
        name: "Curva Grande (T3)",
        type: "CORNER_FAST",
        startDist: 1330,
        length: 820,
        drs: false,
        harvestPotential: 0.15,
        attackOpportunity: 0.32,
        counterRisk: 0.18,
        entrySpeed: 140,
        apexSpeed: 285,
        exitSpeed: 310,
        speedDeltaPotential: 170,
        description: "Sweeping flat-out right hander leading toward Roggia."
      },
      {
        id: "Z4_VARIANTE_ROGGIA",
        name: "Variante della Roggia (T4-T5)",
        type: "BRAKING",
        startDist: 2150,
        length: 320,
        drs: false,
        harvestPotential: 0.82,
        attackOpportunity: 0.72,
        counterRisk: 0.40, // High counter risk on exit straight to Lesmo
        entrySpeed: 320,
        apexSpeed: 110,
        exitSpeed: 180,
        speedDeltaPotential: -210,
        description: "Tight left-right chicane with heavy deceleration."
      },
      {
        id: "Z5_LESMO_COMPLEX",
        name: "Curva di Lesmo (T6-T7)",
        type: "CORNER_MEDIUM",
        startDist: 2470,
        length: 680,
        drs: false,
        harvestPotential: 0.45,
        attackOpportunity: 0.28,
        counterRisk: 0.25,
        entrySpeed: 260,
        apexSpeed: 165,
        exitSpeed: 235,
        speedDeltaPotential: -95,
        description: "Medium-speed technical double right-hander."
      },
      {
        id: "Z6_SERRAGLIO",
        name: "Curva del Serraglio",
        type: "STRAIGHT",
        startDist: 3150,
        length: 640,
        drs: true,
        harvestPotential: 0.1,
        attackOpportunity: 0.65,
        counterRisk: 0.28,
        entrySpeed: 235,
        apexSpeed: 325,
        exitSpeed: 330,
        speedDeltaPotential: 95,
        description: "Kinked blast under the bridge towards Ascari."
      },
      {
        id: "Z7_VARIANTE_ASCARI",
        name: "Variante Ascari (T8-T10)",
        type: "BRAKING",
        startDist: 3790,
        length: 510,
        drs: false,
        harvestPotential: 0.78,
        attackOpportunity: 0.75,
        counterRisk: 0.38,
        entrySpeed: 330,
        apexSpeed: 170,
        exitSpeed: 240,
        speedDeltaPotential: -160,
        description: "High-speed chicane demanding precision and strong traction."
      },
      {
        id: "Z8_BACK_STRAIGHT",
        name: "Rettifilo di Rialto",
        type: "STRAIGHT",
        startDist: 4300,
        length: 920,
        drs: true,
        harvestPotential: 0.1,
        attackOpportunity: 0.82, // Attack Straight
        counterRisk: 0.20,
        entrySpeed: 240,
        apexSpeed: 335,
        exitSpeed: 340,
        speedDeltaPotential: 100,
        description: "Long acceleration straight leading into Curva Parabolica."
      },
      {
        id: "Z9_PARABOLICA",
        name: "Curva Parabolica / Alboreto (T11)",
        type: "CORNER_FAST",
        startDist: 5220,
        length: 573,
        drs: false,
        harvestPotential: 0.55,
        attackOpportunity: 0.45,
        counterRisk: 0.45, // High exit traction determines straight line speed
        entrySpeed: 340,
        apexSpeed: 215,
        exitSpeed: 290,
        speedDeltaPotential: -125,
        description: "Iconic accelerating long radius arc launching cars onto the main straight."
      }
    ]
  },

  SILVERSTONE: {
    id: "SILVERSTONE",
    name: "Silverstone Grand Prix Circuit",
    country: "United Kingdom",
    length: 5891,
    totalLaps: 52,
    baseLapTime: 87.2,
    zones: [
      { id: "S1_HAMILTON", name: "Hamilton Straight", type: "STRAIGHT", startDist: 0, length: 770, drs: true, harvestPotential: 0.12, attackOpportunity: 0.75, counterRisk: 0.25, entrySpeed: 270, apexSpeed: 315, exitSpeed: 315, speedDeltaPotential: 45 },
      { id: "S2_ABBEY_FARM", name: "Abbey & Farm (T1-T2)", type: "CORNER_FAST", startDist: 770, length: 650, drs: false, harvestPotential: 0.25, attackOpportunity: 0.40, counterRisk: 0.20, entrySpeed: 315, apexSpeed: 285, exitSpeed: 260, speedDeltaPotential: -55 },
      { id: "S3_VILLAGE_LOOP", name: "Village & The Loop (T3-T4)", type: "BRAKING", startDist: 1420, length: 480, drs: false, harvestPotential: 0.88, attackOpportunity: 0.82, counterRisk: 0.42, entrySpeed: 260, apexSpeed: 88, exitSpeed: 145, speedDeltaPotential: -172 },
      { id: "S4_WELLINGTON", name: "Wellington Straight", type: "ATTACK_ZONE", startDist: 1900, length: 790, drs: true, harvestPotential: 0.10, attackOpportunity: 0.86, counterRisk: 0.30, entrySpeed: 145, apexSpeed: 320, exitSpeed: 320, speedDeltaPotential: 175 },
      { id: "S5_BROOKLANDS", name: "Brooklands & Luffield (T6-T7)", type: "BRAKING", startDist: 2690, length: 640, drs: false, harvestPotential: 0.82, attackOpportunity: 0.78, counterRisk: 0.35, entrySpeed: 320, apexSpeed: 105, exitSpeed: 210, speedDeltaPotential: -215 },
      { id: "S6_COPSE", name: "Copse (T9)", type: "CORNER_FAST", startDist: 3330, length: 520, drs: false, harvestPotential: 0.30, attackOpportunity: 0.35, counterRisk: 0.18, entrySpeed: 285, apexSpeed: 265, exitSpeed: 280, speedDeltaPotential: -20 },
      { id: "S7_MAGGOTTS_BECKETTS", name: "Maggotts / Becketts / Chapel", type: "CORNER_FAST", startDist: 3850, length: 760, drs: false, harvestPotential: 0.40, attackOpportunity: 0.30, counterRisk: 0.22, entrySpeed: 300, apexSpeed: 220, exitSpeed: 275, speedDeltaPotential: -80 },
      { id: "S8_HANGAR", name: "Hangar Straight", type: "ATTACK_ZONE", startDist: 4610, length: 850, drs: true, harvestPotential: 0.10, attackOpportunity: 0.89, counterRisk: 0.28, entrySpeed: 275, apexSpeed: 338, exitSpeed: 340, speedDeltaPotential: 65 },
      { id: "S9_STOWE_VALE", name: "Stowe, Vale & Club (T15-T18)", type: "BRAKING", startDist: 5460, length: 431, drs: false, harvestPotential: 0.85, attackOpportunity: 0.76, counterRisk: 0.36, entrySpeed: 340, apexSpeed: 110, exitSpeed: 240, speedDeltaPotential: -230 }
    ]
  },

  SPA: {
    id: "SPA",
    name: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    length: 7004,
    totalLaps: 44,
    baseLapTime: 104.5,
    zones: [
      { id: "SP1_LA_SOURCE", name: "La Source (T1)", type: "BRAKING", startDist: 0, length: 380, drs: false, harvestPotential: 0.90, attackOpportunity: 0.84, counterRisk: 0.45, entrySpeed: 290, apexSpeed: 70, exitSpeed: 140, speedDeltaPotential: -220 },
      { id: "SP2_EAU_ROUGE", name: "Eau Rouge / Raidillon", type: "CORNER_FAST", startDist: 380, length: 650, drs: false, harvestPotential: 0.15, attackOpportunity: 0.25, counterRisk: 0.15, entrySpeed: 140, apexSpeed: 305, exitSpeed: 310, speedDeltaPotential: 170 },
      { id: "SP3_KEMMEL", name: "Kemmel Straight", type: "ATTACK_ZONE", startDist: 1030, length: 1020, drs: true, harvestPotential: 0.08, attackOpportunity: 0.94, counterRisk: 0.32, entrySpeed: 310, apexSpeed: 350, exitSpeed: 350, speedDeltaPotential: 40 },
      { id: "SP4_LES_COMBES", name: "Les Combes & Malmedy", type: "BRAKING", startDist: 2050, length: 580, drs: false, harvestPotential: 0.92, attackOpportunity: 0.88, counterRisk: 0.40, entrySpeed: 350, apexSpeed: 125, exitSpeed: 190, speedDeltaPotential: -225 },
      { id: "SP5_RIVAGE_POUHON", name: "Bruxelles & Pouhon (T8-T12)", type: "CORNER_MEDIUM", startDist: 2630, length: 1850, drs: false, harvestPotential: 0.50, attackOpportunity: 0.35, counterRisk: 0.24, entrySpeed: 260, apexSpeed: 180, exitSpeed: 275, speedDeltaPotential: -80 },
      { id: "SP6_CAMPUS_STAVELOT", name: "Campus & Stavelot (T13-T15)", type: "CORNER_FAST", startDist: 4480, length: 920, drs: false, harvestPotential: 0.35, attackOpportunity: 0.42, counterRisk: 0.28, entrySpeed: 275, apexSpeed: 230, exitSpeed: 285, speedDeltaPotential: -45 },
      { id: "SP7_BLANCHIMONT", name: "Blanchimont (T16-T17)", type: "STRAIGHT", startDist: 5400, length: 1150, drs: true, harvestPotential: 0.12, attackOpportunity: 0.68, counterRisk: 0.20, entrySpeed: 285, apexSpeed: 335, exitSpeed: 335, speedDeltaPotential: 50 },
      { id: "SP8_BUS_STOP", name: "Bus Stop Chicane (T18-T19)", type: "BRAKING", startDist: 6550, length: 454, drs: false, harvestPotential: 0.88, attackOpportunity: 0.85, counterRisk: 0.48, entrySpeed: 335, apexSpeed: 82, exitSpeed: 160, speedDeltaPotential: -253 }
    ]
  }
};

export class TrackModel {
  constructor(circuitId = "MONZA") {
    this.circuit = CIRCUITS[circuitId] || CIRCUITS.MONZA;
  }

  setCircuit(circuitId) {
    if (CIRCUITS[circuitId]) {
      this.circuit = CIRCUITS[circuitId];
    }
  }

  getZoneAtDistance(distance) {
    const d = distance % this.circuit.length;
    for (let i = 0; i < this.circuit.zones.length; i++) {
      const z = this.circuit.zones[i];
      const endDist = z.startDist + z.length;
      if (d >= z.startDist && d < endDist) {
        return { zone: z, index: i, progressInZone: (d - z.startDist) / z.length };
      }
    }
    return { zone: this.circuit.zones[0], index: 0, progressInZone: 0 };
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
}
