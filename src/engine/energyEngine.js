/**
 * RACE TWIN — Energy Simulation & Look-Ahead Engine (Sections 14, 25, 26, 33)
 *
 * Implements:
 *   - Energy state projections for ATTACK, CONTROLLED, and SAVE
 *   - Look-ahead curve across NOW, +1, +2, +3 laps
 *   - Next 3 tactical opportunities
 */

export class EnergyEngine {
  /**
   * Calculate energy impact of an action
   */
  static simulateEnergyDelta(action, currentEnergy = 63) {
    switch (action) {
      case "ATTACK":
        // Intensive burst: -11% net drain, low harvest
        return {
          energyAvailable: Math.max(5, currentEnergy - 11),
          deploymentPower: 350,
          harvestPower: 0,
          deploymentPercent: 28,
          harvestPercent: 3,
          reservePercent: 34
        };
      case "CONTROLLED":
        // Measured deployment: -7% net drain
        return {
          energyAvailable: Math.max(10, currentEnergy - 7),
          deploymentPower: 310,
          harvestPower: 45,
          deploymentPercent: 18,
          harvestPercent: 7,
          reservePercent: 42
        };
      case "SAVE":
      default:
        // Harvest focus: +4% net gain
        return {
          energyAvailable: Math.min(100, currentEnergy + 4),
          deploymentPower: 120,
          harvestPower: 180,
          deploymentPercent: 8,
          harvestPercent: 16,
          reservePercent: 52
        };
    }
  }

  /**
   * Next 3 tactical opportunities (Section 25)
   */
  static getNextOpportunities(lap = 38) {
    return [
      {
        timing: "NOW",
        zone: "HANGAR STRAIGHT",
        sector: "S3",
        potential: "HIGH",
        probability: 78,
        risk: 22,
        energyCost: 11
      },
      {
        timing: "+1 LAP",
        zone: "BROOKLANDS",
        sector: "S2",
        potential: "MEDIUM",
        probability: 51,
        risk: 42,
        energyCost: 8
      },
      {
        timing: "+2 LAPS",
        zone: "HANGAR STRAIGHT",
        sector: "S3",
        potential: "HIGH",
        probability: 83,
        risk: 18,
        energyCost: 10
      }
    ];
  }

  /**
   * Compute energy look-ahead projection points for SVG graph (Section 26)
   */
  static computeLookAhead(currentEnergy = 63) {
    return {
      currentEnergy,
      projectedAfterAttack: Math.max(15, currentEnergy - 11),
      projectedAfterSave: Math.min(100, currentEnergy + 4),
      laps: [
        {
          label: "NOW",
          base: currentEnergy,
          attack: Math.max(15, currentEnergy - 11),
          save: Math.min(100, currentEnergy - 4),
          oppValue: 78
        },
        {
          label: "+1",
          base: Math.max(10, currentEnergy - 6),
          attack: Math.max(10, currentEnergy - 19),
          save: Math.min(100, currentEnergy + 2),
          oppValue: 51
        },
        {
          label: "+2",
          base: Math.max(10, currentEnergy - 10),
          attack: Math.max(10, currentEnergy - 25),
          save: Math.min(100, currentEnergy + 5),
          oppValue: 83
        },
        {
          label: "+3",
          base: Math.max(10, currentEnergy - 12),
          attack: Math.max(10, currentEnergy - 30),
          save: Math.min(100, currentEnergy + 8),
          oppValue: 65
        }
      ]
    };
  }
}
