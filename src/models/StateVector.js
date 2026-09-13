/**
 * TRACKSHIFT - Dynamic Constraint-Based F1 Energy & Race Decision Engine
 * StateVector: Maintains the full observable/estimated 17-element dynamic state vector x(t).
 */

export class StateVector {
  constructor(initialData = {}) {
    this.lap = initialData.lap ?? 23;
    this.time = initialData.time ?? 78.432; // In seconds (e.g. 1:18.432)
    this.track_distance = initialData.track_distance ?? 4382.0; // In meters
    this.speed = initialData.speed ?? 314.5; // km/h
    this.acceleration = initialData.acceleration ?? 4.2; // m/s^2
    this.throttle = initialData.throttle ?? 1.0; // 0.0 to 1.0
    this.brake = initialData.brake ?? 0.0; // 0.0 to 1.0
    this.gear = initialData.gear ?? 7; // 1 to 8

    // ERS Dynamic States
    this.estimated_energy = initialData.estimated_energy ?? 2.44; // MJ
    this.estimated_SOC = initialData.estimated_SOC ?? 61.0; // % (Battery state of charge)
    this.energy_available_pct = initialData.energy_available_pct ?? 61.0; // % Available
    this.energy_deployment_pct = initialData.energy_deployment_pct ?? 8.2; // % Deployment
    this.energy_harvest_pct = initialData.energy_harvest_pct ?? 4.7; // % Harvest
    this.energy_reserve_pct = initialData.energy_reserve_pct ?? 32.0; // % Reserve
    this.energy_harvest_rate = initialData.energy_harvest_rate ?? 0.0; // kW
    this.energy_deployment_rate = initialData.energy_deployment_rate ?? 184.0; // kW (MGU-K current deployment)
    this.cell_temp = initialData.cell_temp ?? 58.4; // °C

    // Tyre Model (Section 14)
    this.tyre_compound = initialData.tyre_compound ?? "MEDIUM";
    this.tyre_condition = initialData.tyre_condition ?? 72.0; // %
    this.tyre_degradation = initialData.tyre_degradation ?? "MEDIUM";
    this.tyre_temp = initialData.tyre_temp ?? "OPTIMAL";
    this.tyre_temp_deg = initialData.tyre_temp_deg ?? 95.0; // °C
    this.tyre_risk = initialData.tyre_risk ?? "LOW";

    // Race & Opponent Dynamics (Observable Only)
    this.opponent_gap = initialData.opponent_gap ?? 0.82; // seconds ahead (Target P6)
    this.gap_behind = initialData.gap_behind ?? 1.41; // seconds behind (Car in P8)
    this.pace_delta = initialData.pace_delta ?? 0.17; // seconds pace advantage (+0.17s)
    this.opponent_closing_speed = initialData.opponent_closing_speed ?? 7.4; // km/h relative closing speed
    this.race_position = initialData.race_position ?? 7; // P7 chasing P6
    this.target_position = initialData.target_position ?? 6;
    this.current_zone = initialData.current_zone ?? "HANGAR STRAIGHT";
    this.zone_index = initialData.zone_index ?? 0;
    this.remaining_laps = initialData.remaining_laps ?? 14; // 52 - 38

    // Lap-level cumulatives
    this.energy_harvested_lap = initialData.energy_harvested_lap ?? 0.85; // MJ
    this.energy_deployed_lap = initialData.energy_deployed_lap ?? 1.94; // MJ
  }

  /**
   * Clone current state
   */
  clone() {
    return new StateVector({
      lap: this.lap,
      time: this.time,
      track_distance: this.track_distance,
      speed: this.speed,
      acceleration: this.acceleration,
      throttle: this.throttle,
      brake: this.brake,
      gear: this.gear,
      estimated_energy: this.estimated_energy,
      estimated_SOC: this.estimated_SOC,
      energy_available_pct: this.energy_available_pct,
      energy_deployment_pct: this.energy_deployment_pct,
      energy_harvest_pct: this.energy_harvest_pct,
      energy_reserve_pct: this.energy_reserve_pct,
      energy_harvest_rate: this.energy_harvest_rate,
      energy_deployment_rate: this.energy_deployment_rate,
      cell_temp: this.cell_temp,
      tyre_compound: this.tyre_compound,
      tyre_condition: this.tyre_condition,
      tyre_degradation: this.tyre_degradation,
      tyre_temp: this.tyre_temp,
      tyre_temp_deg: this.tyre_temp_deg,
      tyre_risk: this.tyre_risk,
      opponent_gap: this.opponent_gap,
      gap_behind: this.gap_behind,
      pace_delta: this.pace_delta,
      opponent_closing_speed: this.opponent_closing_speed,
      race_position: this.race_position,
      target_position: this.target_position,
      current_zone: this.current_zone,
      zone_index: this.zone_index,
      remaining_laps: this.remaining_laps,
      energy_harvested_lap: this.energy_harvested_lap,
      energy_deployed_lap: this.energy_deployed_lap
    });
  }

  /**
   * Formatted timestamp mm:ss.ms
   */
  get formattedTime() {
    const mins = Math.floor(this.time / 60);
    const secs = (this.time % 60).toFixed(3);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
  }

  /**
   * Raw array representation as defined in specs:
   * x(t) = [lap, time, track_distance, speed, acceleration, throttle, brake, gear,
   *         estimated_energy, estimated_SOC, energy_harvest_rate, energy_deployment_rate,
   *         opponent_gap, opponent_closing_speed, race_position, current_zone, remaining_laps]
   */
  toArray() {
    return [
      this.lap,
      this.time,
      this.track_distance,
      this.speed,
      this.acceleration,
      this.throttle,
      this.brake,
      this.gear,
      this.estimated_energy,
      this.estimated_SOC,
      this.energy_harvest_rate,
      this.energy_deployment_rate,
      this.opponent_gap,
      this.opponent_closing_speed,
      this.race_position,
      this.current_zone,
      this.remaining_laps
    ];
  }
}
