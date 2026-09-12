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
    this.estimated_energy = initialData.estimated_energy ?? 2.91; // MJ (Max capacity typically 4.0 MJ usable per lap)
    this.estimated_SOC = initialData.estimated_SOC ?? 72.8; // % (Battery state of charge)
    this.energy_harvest_rate = initialData.energy_harvest_rate ?? 0.0; // kW
    this.energy_deployment_rate = initialData.energy_deployment_rate ?? 184.0; // kW (MGU-K current deployment)
    this.cell_temp = initialData.cell_temp ?? 58.4; // °C

    // Race & Opponent Dynamics (Observable Only)
    this.opponent_gap = initialData.opponent_gap ?? 0.82; // seconds ahead
    this.opponent_closing_speed = initialData.opponent_closing_speed ?? 7.4; // km/h relative closing speed
    this.race_position = initialData.race_position ?? 2; // P2 chasing P1
    this.current_zone = initialData.current_zone ?? "ATTACK STRAIGHT";
    this.zone_index = initialData.zone_index ?? 0;
    this.remaining_laps = initialData.remaining_laps ?? 34; // 57 - 23

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
      energy_harvest_rate: this.energy_harvest_rate,
      energy_deployment_rate: this.energy_deployment_rate,
      cell_temp: this.cell_temp,
      opponent_gap: this.opponent_gap,
      opponent_closing_speed: this.opponent_closing_speed,
      race_position: this.race_position,
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
