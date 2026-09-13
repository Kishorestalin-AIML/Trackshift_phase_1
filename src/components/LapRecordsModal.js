/**
 * TRACKSHIFT — Lap Records Modal (Section 21)
 *
 * Unobtrusive secondary dialog displaying completed lap records and telemetry telemetry logs.
 */

export class LapRecordsModal {
  constructor(containerEl, onClose) {
    this.container = containerEl;
    this.onClose = onClose;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="lap-records-backdrop hidden" id="records-backdrop">
        <div class="lap-records-dialog">
          <div class="dialog-header">
            <div class="dialog-title-wrap">
              <span class="dialog-badge">FIA SESSION TELEMETRY</span>
              <h2 class="dialog-title">SILVERSTONE GP // LAP LOGS</h2>
            </div>
            <button class="dialog-close-btn" id="records-close">&times;</button>
          </div>

          <div class="dialog-body">
            <table class="records-table">
              <thead>
                <tr>
                  <th>LAP</th>
                  <th>LAP TIME</th>
                  <th>S1</th>
                  <th>S2</th>
                  <th>S3</th>
                  <th>END ERS</th>
                  <th>DECISION</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody id="records-tbody">
                <!-- Populated via render() -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector("#records-close");
    const backdrop = this.container.querySelector("#records-backdrop");

    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.close();
      });
    }
  }

  open() {
    const backdrop = this.container.querySelector("#records-backdrop");
    if (backdrop) backdrop.classList.remove("hidden");
  }

  close() {
    const backdrop = this.container.querySelector("#records-backdrop");
    if (backdrop) backdrop.classList.add("hidden");
    if (this.onClose) this.onClose();
  }

  render(state) {
    if (!state || !state.lapRecords) return;
    const tbody = this.container.querySelector("#records-tbody");
    if (!tbody) return;

    tbody.innerHTML = state.lapRecords.map(rec => `
      <tr class="${rec.isBest ? 'tr-best-lap' : ''}">
        <td><strong>L${rec.lap}</strong></td>
        <td class="font-mono text-cyan">${rec.lapTime} ${rec.isBest ? '★' : ''}</td>
        <td class="font-mono">${rec.s1}</td>
        <td class="font-mono">${rec.s2}</td>
        <td class="font-mono">${rec.s3}</td>
        <td class="font-mono text-green">${rec.energyEnd}</td>
        <td>DEPLOY 286 kW</td>
        <td><span class="badge-status badge-feasible">COMPLIANT</span></td>
      </tr>
    `).join("");
  }
}
