/**
 * RACE TWIN — Event Log Component (Section 29)
 *
 * Tactical event history tracking race changes, incident triggers, and strategy decisions.
 */

export class EventLog {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="bottom-panel-card event-log-panel">
        <div class="bottom-card-header">
          <span class="card-title">EVENT LOG</span>
          <span class="card-sub-tag">TELEMETRY AUDIT</span>
        </div>

        <div class="event-feed-list" id="event-feed-list">
          <div class="event-entry">
            <span class="event-lap">L38</span>
            <span class="event-text">Decision → Controlled Attack</span>
          </div>
          <div class="event-entry">
            <span class="event-lap">L38</span>
            <span class="event-text">Attack window detected (Hangar Straight)</span>
          </div>
          <div class="event-entry">
            <span class="event-lap">L38</span>
            <span class="event-text">Green flag active — P4 hunting P3</span>
          </div>
        </div>
      </div>
    `;
  }

  render(state) {
    if (!state || !state.events) return;

    const list = this.container.querySelector("#event-feed-list");
    if (!list) return;

    list.innerHTML = state.events.map(ev => {
      const typeClass = ev.type === "green" ? "text-green" : ev.type === "caution" ? "text-yellow" : "";
      return `
        <div class="event-entry">
          <span class="event-lap">${ev.lap || "L38"}</span>
          <span class="event-text ${typeClass}">${ev.text}</span>
        </div>
      `;
    }).join("");
  }
}
