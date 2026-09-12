/**
 * TRACKSHIFT - DecisionExplainer
 * Generates dynamic, structured explainability diagnostics:
 * "WHY THIS CONTROL?" or "WHY NOT DEPLOY?"
 * Translates multi-factor optimization variables into clear engineer-facing checklists.
 */

export class DecisionExplainer {
  constructor(containerElement) {
    this.container = containerElement;
  }

  render(explanationData) {
    if (!this.container || !explanationData) return;

    const { title, factors, optimalResultText } = explanationData;

    let factorsHtml = "";
    factors.forEach(f => {
      const icon = f.passed ? "✓" : "✕";
      const statusClass = f.passed ? "pass" : "fail";
      factorsHtml += `
        <li class="explainer-item ${statusClass}">
          <span class="explainer-icon">${icon}</span>
          <span>${f.label}</span>
        </li>
      `;
    });

    this.container.innerHTML = `
      <div style="font-size: 0.8rem; font-weight: 800; letter-spacing: 1.5px; color: ${title.includes('NOT') ? 'var(--f1-yellow)' : 'var(--f1-cyan)'}; margin-bottom: 6px;">
        ${title}
      </div>
      <ul class="explainer-list">
        ${factorsHtml}
      </ul>
      <div style="margin-top: 10px; padding: 8px 10px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-subtle); border-radius: 3px; font-family: var(--font-mono); font-size: 0.74rem;">
        <span style="color: var(--text-muted); display: block; font-size: 0.65rem; text-transform: uppercase;">Optimization Result</span>
        <strong style="color: #fff;">${optimalResultText}</strong>
      </div>
    `;
  }
}
