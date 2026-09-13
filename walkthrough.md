# WALKTHROUGH — CONSTRAINT-CORRELATED F1 2026 ENERGY & OVERTAKE DIGITAL TWIN

## System Repair Summary

A complete, full logical and data-flow repair has been executed across the application. The existing UI layout, styling, cards, controls, and canvas animations have been preserved as the frontend shell, while the internal engine has been unified into **ONE CONNECTED DECISION SYSTEM**.

---

## 1. Central Architecture & Data Flow

All calculations now flow through a single source of truth:

```
USER CONTROLS (11 Sliders / Pickers)
   ↓
CENTRAL RACE STATE (`centralRaceState`)
   ↓
PHYSICAL & REGULATORY CONSTRAINTS (13 Constraints C1–C13)
   ↓
ENERGY MODEL (20.0 MJ Pack, E_next = E_curr - E_dep + E_rec, SOC derived)
   ↓
TYRE & PIT MODELS (Compound, Age, Degradation Cliff, 21.4s Pit Loss, Undercut)
   ↓
RACE DYNAMICS (Sigmoid Overtake Probability, Defence Buffer, Zone Telemetry)
   ↓
RECOVERY TIMING & FUTURE OPPORTUNITY COST
   ↓
CANDIDATE ACTIONS & FIA 2026 FEASIBILITY FILTER
   ↓
MULTI-CRITERIA OPTIMIZER (11-Term Objective Function J(a))
   ↓
CANONICAL DECISION OBJECT (`decision` — Section 41)
   ↓
┌─────────────────────┼─────────────────────┐
↓                     ↓                     ↓
DECISION CARDS        TACTICAL TIMELINE     3-CAR CANVAS ANIMATION
```

---

## 2. Key Components Repaired

### A. Central Race State (`buildCentralRaceState`)
- Replaces isolated, duplicate variables with a single schema adhering to Section 2:
  - `currentLap`, `totalLaps: 57`, `position`, `futureLaps`
  - `energyMJ`, `usableEnergyMJ: 20.0`, `socPercent`
  - `gapAhead`, `gapBehind`, `closingSpeed`
  - `currentSector`, `currentZone`
  - `tyreCompound`, `tyreAge`, `tyrePerformance`, `tyreDegradation`
  - `trackCondition`, `weather`
  - `pitWindow`, `pitLoss`, `lapsSincePit`
  - `constraintLevel`, `recoveryZones`, `attackZones`, `fiaRuleProfile`

### B. Real Circuit Decision Zones
- All 9 circuit decision zones configured with full Section 8 optimization attributes:
  - `zoneId`, `attackValue`, `deploymentValue`, `recoveryValue`, `brakingOpportunity`
  - `overtakingValue`, `defenceValue`, `tyreSensitivity`, `riskLevel`
  - `deploymentPowerLimit`, `recoveryLimit`

### C. Physical Energy & Reserve Model
- Pack capacity: $20.0\text{ MJ}$.
- Deployment: $E_{\text{deployed}} = P_{\text{MW}} \times t_{\text{sec}}$ (e.g. $350\text{ kW} \times 4.0\text{s} = 1.40\text{ MJ}$).
- Recovery: Non-1:1 independent kinetic recovery up to $7.0\text{ MJ/lap}$.
- SOC: Strictly derived via $SOC = (E / 20.0) \times 100\%$. No arbitrary percentage drops.
- Dynamic Reserve:
  $$E_{\text{reserve}} = E_{\text{future}} + E_{\text{defence}} + E_{\text{recoveryGap}} + E_{\text{safetyFloor}}$$
  $$E_{\text{free}} = E_{\text{current}} - E_{\text{reserve}}$$

### D. Single Canonical Decision Object (Section 41)
Returned by `simulate().decision` and consumed by UI cards and animation:
```javascript
{
  action: "SUPER-CLIP" | "NORMAL DEPLOYMENT" | "COAST" | "BRAKING / HARVEST",
  lap: 25,
  sector: 2,
  zone: 5,
  energyBefore: 14.01,
  energyDeployed: 1.40,
  energyRecovered: 0.80,
  energyAfter: 13.41,
  socBefore: 70,
  socAfter: 67,
  overtakeProbability: 75,
  defenceRisk: "LOW",
  tyreState: { compoundId: "MEDIUM", tyreAge: 8, grip: 77, ... },
  pitDecision: "STAY OUT",
  pitValue: 86,
  futureOpportunityValue: 19,
  score: 87,
  fiaStatus: "LEGAL",
  rejectedAlternatives: [
    { action: "NORMAL DEPLOYMENT", score: 72, reason: "Suboptimal combined race outcome" },
    { action: "COAST", score: 68, reason: "Future energy has greater race value than current opportunity." },
    { action: "BRAKING / HARVEST", score: 25, reason: "Low recovery potential in acceleration zone." }
  ],
  explanation: "High-value attack opportunity with sufficient free energy..."
}
```

---

## 3. Automated Verification Results

### A. Section 37: Automated Correlation Test (`runDependencyAudit`)
Executed via `node tests/test_dependency_audit.js`:
- Total Inputs Audited: 11
- Connected Inputs: 11 (100%)
- Disconnected Inputs: 0
- **Status: PASSED**

| Input Tested | Parameter Modified | Downstream Response Verified |
| :--- | :--- | :--- |
| **Battery SOC** | 70% $\rightarrow$ 30% | `socBefore: 70% -> 30%`, `freeEnergy: 9.9 -> 1.9 MJ`, `energyBefore: 14.0 -> 6.0 MJ` |
| **Current Lap** | 25 $\rightarrow$ 55 | `decision.lap: 25 -> 55`, `reserveMJ: 4.1 -> 3.8 MJ` |
| **Position** | P2 $\rightarrow$ P1 | `overtakeProb: 75% -> 0%`, Leader defence mode activated |
| **Gap Ahead** | 1.0s $\rightarrow$ 3.2s | `overtakeProb: 75% -> 5%`, `closingSpeed: MODERATE -> LOW`, C5 outside window |
| **Gap Behind** | 1.5s $\rightarrow$ 0.3s | `defenceRisk: LOW -> HIGH`, `defenceMJ: 0.5 -> 1.6 MJ`, C6 HIGH_PRESSURE |
| **Future Laps** | 3 $\rightarrow$ 5 | `futureLaps: 3 -> 5`, Lookahead weighting elevated in C7 |
| **Tyre Compound** | MEDIUM $\rightarrow$ HARD | `grip: 77% -> 74%`, `perfFactor: 0.77 -> 0.74` |
| **Tyre Age** | 8 $\rightarrow$ 26 | `grip: 77% -> 44%`, `degradation: LOW -> CRITICAL` |
| **Track Condition** | DRY $\rightarrow$ WET | `weather: DRY -> WET`, `grip: 77% -> 19%`, C4 EXTENDED_REGEN |
| **Constraint Level** | 30% $\rightarrow$ 85% | C2 power derated, `constraintLevel: 30 -> 85` |
| **Intensity** | 75% $\rightarrow$ 25% | Power derated from 246 to 237 kW, SAVE weighting applied |

### B. Section 38: Extreme Test Cases Audit
Executed via `node tests/test_extreme_cases.js`:
- Total Cases Tested: 7
- Cases Passed: 7 (100%)
- **Status: PASSED**

1. **TEST 1 — High energy + strong attack**: Selected `SUPER-CLIP`, pass probability 75%.
2. **TEST 2 — Low energy + weak opportunity**: Selected `BRAKING / HARVEST`, Super-Clip blocked.
3. **TEST 3 — Low energy + immediate recovery**: Selected `BRAKING / HARVEST` in Zone 3 hairpin (+0.83 MJ).
4. **TEST 4 — Old tyres**: 32-lap grip dropped to 33%, `PIT NOW` promoted with score 91 vs `STAY OUT` (52).
5. **TEST 5 — Strong pressure from behind**: Rear gap 0.3s expanded defence reserve to 1.6 MJ, `defenceRisk = HIGH`.
6. **TEST 6 — Late race (Lap 56/57)**: Immediate position gain prioritized, rolling horizon truncated at race finish (18 zone steps).
7. **TEST 7 — Illegal deployment**: SOC 20% below safety floor rejected Super-Clip as infeasible (`isFeasible: false`).

---

## 4. Test Suite & Build Status

All suites passed with zero failures:
```bash
npm test
#  ✓ test_alpine_decision_twin.js (22/22 passed)
#  ✓ test_connected_decision_engine.js (11/11 passed)
#  ✓ test_dependency_audit.js (11/11 inputs connected)
#  ✓ test_extreme_cases.js (7/7 cases passed)
#  ✓ test_tyre_pit_dom.js (7/7 passed)
#  ✓ test_slider_constraints_interconnection.js (8/8 passed)
#  ✓ test_constraints_dom_audit.js (5/5 passed)
#  ✓ test_battery_synchronization.js (7/7 passed)

npm run build
#  ✓ built in 382ms (0 errors, 0 warnings)
```

---

## 5. Battery Segment — Live Slider Synchronization Repair (Sections 1–20)

1. **Immediate Reactive SOC Slider Handler (`onSOCSliderChange`)**:
   - The battery SOC slider (`#slider-soc`) is bound directly to `input`, `change`, and `wheel` events.
   - Moving the slider immediately and synchronously triggers `recalculateSimulation()`.
   - Never waits for run button, next lap, or page refresh.
   - Cleanly resets transient simulation outcomes and status banners per Section 14.
2. **Single Source of Truth & Zero Disagreement**:
   - Directly maintains physical formula: $E_{\text{MJ}} = (\text{SOC} / 100) \times 20.0\text{ MJ}$.
   - Numerical readouts on the control panel (`#val-soc`), Current State card (`#cs-soc`, `#cs-energy`), and grid stats (`#stat-soc`, `#stat-available`) are guaranteed to agree $100\%$ at all times.
3. **Dynamic Battery State Badges & Indicators**:
   - Displays real-time badge `#battery-state-badge`:
     - $\ge 60\% \implies \text{ENERGY: HEALTHY}$ (Emerald green)
     - $40\% \text{ to } 59\% \implies \text{ENERGY: LIMITED}$ (Amber)
     - $25\% \text{ to } 39\% \implies \text{ENERGY: LOW}$ (Orange-red)
     - $< 25\% \implies \text{ENERGY: CRITICAL}$ (Crimson pulsing glow)
4. **Tri-Segment Horizontal Bar Bounding**:
   - Reserve, Free, and Used megajoules sum to $20.0\text{ MJ}$ and percentage widths total $100.0\%$.
   - Prevents bar overflow or negative widths when SOC drops below the reserve floor.
5. **Attack Capability & Limitation Rationale**:
   - `#battery-attack-capability` indicates whether SUPER-CLIP ($1.40\text{ MJ} / 350\text{ kW}$) or NORMAL ($200\text{ kW}$) is available.
   - `#battery-limit-reason` details current energy, reserve requirement, available free attack energy, and feasibility status.
6. **Battery + Position Consequence**:
   - Critical battery depletion ($< 25\%$ SOC / $< 5.0\text{ MJ}$) combined with intense defensive pressure from behind ($< 0.5\text{s}$) triggers defensive concession in the decision engine and causes the rival car to close tightly in the live animation.
8. **Tri-Segment Electrical Pack Allocation — Live & Segregated Synchronization**:
   - **Single Central Control (`#slider-soc`)**: The redundant secondary slider in Section C (`#tri-pack-slider`) was removed per user request. The main Battery SOC slider in the sidebar control panel remains the single source of truth driving the entire digital twin.
   - **Click & Drag Scrubbing on `#tri-segment-bar`**: The user can scrub or click directly anywhere on the tri-segment bar to instantly seek to that energy level.
   - **Visual Segregation**: Crisp 2px dividers between Reserve, Free, and Used segments, enhanced gradients, and a hatched pattern for depleted headroom.
   - **Pack Scale & Ticks (`#tri-bar-ticks`)**: Visual tick markers across 0 MJ (0%), 5 MJ (25%), 10 MJ (50%), 15 MJ (75%), and 20 MJ (100%).
   - **Segregated 3-Segment Cards Grid (`#tri-segregated-cards-grid`)**: Real-time breakdown displaying RESERVE FLOOR (`#card-res-val`), FREE ATTACK ENERGY (`#card-free-val`), and DEPLETED HEADROOM (`#card-used-val`) with live megajoules, percentages, and engineering descriptions.
   - **Fast-Path 60 FPS Engine (`updateLivePackAllocation`)**: Instant (<0.1ms) DOM update on every mouse pixel movement with `.is-dragging` zero-transition responsiveness, debouncing heavier background recalculations so the slide bar feels perfectly fluid.

