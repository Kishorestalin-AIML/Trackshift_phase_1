<<<<<<< HEAD
# Trackshift_phase_1
Trackshift Hackathon
=======
# TrackShift F1 2026: Alpine Energy & Race Decision Digital Twin

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![FIA 2026 Regulations](https://img.shields.io/badge/FIA_2026-Compliant-0090FF)](https://www.fia.com)
[![Tests](https://img.shields.io/badge/Tests-15%20Passing%20(100%25)-22c55e)](#test-suite--verification)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An authoritative, physics-grounded **Digital Twin and Decision Engine** for Formula 1 2026 regulations, tailored for the Alpine F1 Team. TrackShift transforms hybrid powertrain energy deployment from heuristic guesswork into a **real-time mathematical counterfactual optimization**:

> *"Given everything known right now, is a finite unit of electrical energy more valuable if spent immediately, or preserved for a high-leverage future opportunity downstream?"*

---

## Table of Contents
1. [Core Innovations](#core-innovations)
2. [Single Central RaceState Architecture](#single-central-racestate-architecture)
3. [Mathematical Optimization Engine](#mathematical-optimization-engine)
4. [Rolling Horizon Opportunity Model (H = 5 Laps)](#rolling-horizon-opportunity-model-h--5-laps)
5. [Tyre Degradation & Pit Strategy Competing Model](#tyre-degradation--pit-strategy-competing-model)
6. [FIA 2026 Technical Regulations Enforcement](#fia-2026-technical-regulations-enforcement)
7. [User Interface & Cockpit Telemetry](#user-interface--cockpit-telemetry)
8. [Test Suite & Verification](#test-suite--verification)
9. [Quick Start & Development](#quick-start--development)

---

## Core Innovations

- **Real "Spend Now vs. Save for Later" Optimization**: No static charts, random percentages, or decorative timelines. Counterfactual futures are simulated concurrently across a rolling 5-lap horizon.
- **Energy Opportunity Cost Function**: Quantifies the penalty of starving downstream high-value attacks if energy is expended sub-optimally today.
- **Single Source of Truth**: All telemetry cards, race tracks, timelines, and decision badges read from one single authoritative `RaceState` object.
- **Dynamic Energy Reserve & Free Energy**: Accounts for safety floor, defensive pressure from cars behind, and recovery gap requirements before declaring discretionary energy.
- **Coupled Tyre & Pit Strategies**: Tyre performance degradation directly derates electrical acceleration and closing speed, dynamically adjusting pit window viability.
- **Strict 2026 FIA Regulation Clamping**: Real-time filtering for 350 kW straight-line limits, 4.0 MJ/lap discharge caps, and 15% pack reserve floors.

---

## Single Central `RaceState` Architecture

Every component in TrackShift reads from and writes to a central, unified state object. There are zero disconnected models or independent buffers:

```javascript
RaceState {
  currentLap                 // e.g. Lap 42 / 57
  lapsRemaining              // 57 - currentLap
  futureHorizon              // Rolling horizon H = 5 laps
  position                   // P1 through P6

  energyMJ                   // Authoritative pack energy (e.g. 12.4 MJ)
  usableEnergyMJ             // 20.0 MJ total battery capacity
  socPercent                 // State of Charge (e.g. 62%)
  freeEnergyMJ               // Discretionary energy = Energy - RequiredReserve
  requiredReserveMJ          // Dynamic reserve requirement

  gapAhead                   // Seconds to lead vehicle (e.g. 0.6s)
  gapBehind                  // Seconds to rear pursuer (e.g. 1.4s)
  closingSpeedAhead          // m/s closing delta ahead
  closingSpeedBehind         // m/s closing delta behind

  currentZone                // Active circuit zone (1 through 9)
  currentSector              // Circuit sector (1, 2, or 3)
  attackZones[]              // Prime overtaking zones (Z1, Z5, Z7)
  recoveryZones[]            // Heavy braking recovery zones (Z3, Z4, Z6, Z8)
  nextRecoveryZone           // Proximity and identity of next recovery opportunity

  tyreCompound               // SOFT | MEDIUM | HARD | INTERMEDIATE | WET
  tyreAge                    // Laps completed on current set
  tyrePerformance            // Effective friction coefficient μ_tyre (0.0 to 1.0)
  tyreDegradationRate        // Thermal and wear rate delta

  pitWindow                  // Open/close lap boundaries and optimal stop
  pitLoss                    // Total pit lane loss (e.g. +21.4s at Silverstone)
  pitStrategy                // STAY OUT | PIT NOW | UNDERCUT CANDIDATE

  fiaRuleProfile             // FIA 2026 rule definitions and technical parameters
}
```

---

## Mathematical Optimization Engine

TrackShift continuously answers whether deploying energy right now yields a superior expected race outcome compared to conserving that energy for downstream sectors.

### 1. Spend Now Value ($J_{\text{spend}}$)
$$J_{\text{spend}}(a) = G_{\text{immediate}} + V_{\text{position}} + A_{\text{immediate}} + D_{\text{defence}} - C_{\text{energy}} - C_{\text{opp\_future}} - R_{\text{risk}}$$

- **$G_{\text{immediate}}$ (Immediate Gain)**: Laptime reduction from electrical torque deployment scaled by tyre grip ($\mu_{\text{tyre}} \times 0.42\text{s}$ in DRS cone).
- **$V_{\text{position}}$ (Position Gain)**: Expected position value weighted by the sigmoid overtake probability: $\left(\frac{P_{\text{overtake}}}{100} \times 0.65 \times \mu_{\text{tyre}}\right)$.
- **$A_{\text{immediate}}$ (Immediate Attack Value)**: Track position capture leverage before DRS trains form ($+0.20$ in attack cone, $+0.25$ in sprint phase).
- **$D_{\text{defence}}$ (Defence Value)**: Vulnerability penalty ($-0.22$) if pack discharge leaves the car exposed to a pursuer within $<0.5\text{s}$.
- **$C_{\text{energy}}$ (Energy Scarcity Cost)**: Marginal depletion cost on the finite $20.0\text{ MJ}$ pack: $\frac{E_{\text{deployed}}}{20.0} \times 2.2$.
- **$C_{\text{opp\_future}}$ (Energy Opportunity Cost)**:
  $$C_{\text{opp\_future}} = V_{\text{best\_future}}(\text{unconstrained}) - V_{\text{best\_future}}(\text{starved})$$
  If current spending drops post-action free energy below $0.80\text{ MJ}$, future high-yield attacks are degraded, penalizing up to $0.55 \times V_{\text{future\_best}}$.
- **$R_{\text{risk}}$ (Counterattack & Slip Risk)**: Risk penalty ($0.18$ with close pursuer, $0.02$ in clear air).

### 2. Save For Later Value ($J_{\text{save}}$)
$$J_{\text{save}} = G_{\text{future\_race}} + V_{\text{future\_energy}} + V_{\text{recovery}} - C_{\text{opp\_current}} - R_{\text{current}}$$

- **$G_{\text{future\_race}}$**: Expected race gain achievable at the highest-yield downstream opportunity.
- **$V_{\text{future\_energy}}$**: The maximized future opportunity value over horizon $H = 5$:
  $$V_{\text{future\_energy}}(\tau) = G_{\text{exp}}(\tau) + V_{\text{pos}}(\tau) - C_{\text{energy\_exp}}(\tau) - R_{\text{exp}}(\tau)$$
  $$\text{BestFutureOpportunity} = \arg\max_{\tau \in [1, H]} V_{\text{future\_energy}}(\tau)$$
- **$V_{\text{recovery}}$**: Energy recovery value from upcoming braking zones ($+0.18$).
- **$C_{\text{opp\_current}}$**: Opportunity cost of forfeiting an immediate DRS attack window.
- **$R_{\text{current}}$**: Risk of dropping out of the 1.0s DRS cone while conserving pace.

### 3. Optimization Verdict & Delta
$$\Delta = J_{\text{spend}} - J_{\text{save}}, \quad \text{Winning Margin} = |\Delta|$$

$$\text{Verdict} = \begin{cases}
\text{HARVEST / RECHARGE} & \text{if } \text{SOC} \le 28\% \text{ (Free Energy } \le 0.05\text{ MJ)} \\
\text{SPEND NOW} & \text{if } \Delta > 0 \\
\text{SAVE FOR LATER} & \text{if } \Delta \le 0
\end{cases}$$

---

## Rolling Horizon Opportunity Model ($H = 5$ Laps)

The engine projects 5 subsequent laps sequentially, computing lap-by-lap state progression:

```
CURRENT: Lap 42 · Sector 2 · Zone 4 (Attack: HIGH | Energy Req: 1.5 MJ | P_overtake: 74%)
   ↓
LAP 43: Sector 2 · Zone 7 (Attack: LOW | Action: COAST | Delta: -0.2 MJ | Reserve building)
   ↓
LAP 44: Sector 2 · Zone 5 (Attack: VERY HIGH | Action: SUPER-CLIP | Delta: -1.6 MJ | P_overtake: 81%)
   ↓
LAP 45: Sector 1 · Zone 3 (Recovery: HIGH | Action: HARVEST | Delta: +1.0 MJ | MGU-K Regen)
   ↓
LAP 46: Pit Lane (Pit Window: OPEN | Action: PIT | Delta: 0.0 MJ | Fresh Medium Tyres)
```

---

## Tyre Degradation & Pit Strategy Competing Model

Tyres and pit strategy are not separate dashboards; they directly modify electrical effectiveness:

$$\text{EffectiveAttackValue} = \text{ElectricalDeploymentBenefit} \times \mu_{\text{tyre}}$$

- **Pirelli 2026 Compounds**: Soft, Medium, Hard, Intermediate, and Wet curves with compound-specific wear and thermal sensitivities.
- **Undercut / Overcut Calculator**: Calculates traffic rejoin position, out-lap delta, pit lane delta ($+21.4\text{s}$ at Silverstone), and net race position delta.
- **VSC / Safety Car Modifiers**: Exploits pit window opportunities under neutralized conditions (saving $\sim 7.6\text{s}$ under VSC).

---

## FIA 2026 Technical Regulations Enforcement

Candidate actions pass through a strict regulatory filter before evaluation:

1. **Power Caps**: Acceleration zones capped at **350 kW**; non-acceleration zones capped at **250 kW**. Illegal power demands are clamped, not penalized.
2. **Lap Discharge Limit**: Maximum **4.0 MJ/lap** net electrical discharge.
3. **Safety Reserve Floor**: Minimum mandatory pack reserve of **15% SOC (3.0 MJ / 3,000,000 J)**. Discharging below this floor is strictly inhibited; MGU-K recovery is mandated.
4. **Active Aerodynamics (Manual Override Mode)**: High-speed straightline deployment enabled only when within the regulated gap envelope.

---

## User Interface & Cockpit Telemetry

### 1. Main Decision Card
Provides an instantaneous summary of the authoritative race decision:
- **WHAT**: Candidate strategy (`SUPER-CLIP`, `NORMAL DEPLOYMENT`, `COAST`, `BRAKING / HARVEST`)
- **WHERE**: Track coordinates (`Sector X · Zone Y (Zone Name)`)
- **WHEN**: Execution timing (`Now` vs `Upcoming Lap`)
- **ENERGY & RECOVERY**: Exact deploy demand and upcoming MGU-K regen yield
- **CURRENT RACE VALUE**: Mathematical objective score $J(a)$
- **SPEND VS SAVE VERDICT**: Active winner with exact margin delta
- **BEST FUTURE OPPORTUNITY**: Projected highest-value downstream target

### 2. Live Spend Now vs. Save For Later Card
Located in Section E, providing a side-by-side analytical audit:
- **Verdict Pill**: Color-coded winner (`SPEND WINS BY +0.24`, `SAVE WINS BY +0.25`, or `RECHARGE MANDATORY`)
- **Telemetry Grid**: Side-by-side numerical comparison of Expected Gain, Energy Cost, Future Value, Risk, and net Race Value.
- **Active Winner Highlight**: Automatically borders and illuminates the winning strategy card.
- **Mathematical Causal Proof**: Plain-English telemetry justification explaining *why* the winner won.

### 3. Functional Multi-Lap Timeline
Displays real simulated parameters for every future step:
- Exact Megajoule deltas (`-0.9 MJ`, `-1.6 MJ`, `-0.2 MJ`, `+1.0 MJ`)
- Realistic probabilities and status tags (`Attack prob: 81%`, `Reserve building`, `Fresh tyres`)

---

## Test Suite & Verification

The repository includes **15 comprehensive automated test suites** covering unit, integration, and DOM-level verification.

### Core Success Scenarios Verified (Section 25)

| Scenario | Conditions | Winning Action | Mathematical Justification | Status |
|---|---|---|---|---|
| **A. Strong Attack** | High SOC (70%), Gap Ahead 0.4s, Fresh Softs, Safe Behind | **SPEND NOW** | High immediate pass yield ($88\%$) with surplus free energy ($+0.24$) | **PASSED** |
| **B. Better Future** | Gap Ahead 2.2s (Outside DRS), 50% SOC, Medium Tyres | **SAVE FOR LATER** | Attacking clean air yields low pass value; conserving maximizes downstream DRS straight | **PASSED** |
| **C. Defence Pressure** | Gap Behind 0.3s (Severe threat), 44% SOC | **SAVE FOR LATER** | Defence reserve expands to $2.1\text{ MJ}$; forward attack leaves vehicle vulnerable | **PASSED** |
| **D. Recovery Ahead** | Braking zones approaching | **RECOVERY FACTORED** | Energy scarcity derated by imminent $+0.85\text{ MJ}$ kinetic regeneration | **PASSED** |
| **E. Degraded Tyres** | Tyres at 24 laps on Softs ($\mu_{\text{tyre}} < 70\%$) | **PIT VALUE RISES** | Degraded grip reduces traction benefit; pit window opens | **PASSED** |
| **F. Final Sprint** | Laps Remaining $\le 2$ (Sprint Phase) | **SPEND NOW** | Hoarding buffers collapse to zero; unspent energy at flag has 0 value | **PASSED** |
| **G. Depleted Battery** | Pack $\le 28\%$ (Free Energy $= 0.0\text{ MJ}$) | **HARVEST / RECHARGE** | Pack rests at reserve floor; spending unviable, MGU-K regen mandatory | **PASSED** |

Run the test suite:
```bash
npm test
```

```
==================================================================
=== ALL 15 SUITES PASSED (100% SUCCESS RATE)                   ===
==================================================================
  ✓ 1.  test_alpine_decision_twin.js
  ✓ 2.  test_connected_decision_engine.js
  ✓ 3.  test_dependency_audit.js
  ✓ 4.  test_extreme_cases.js
  ✓ 5.  test_tyre_pit_dom.js
  ✓ 6.  test_slider_constraints_interconnection.js
  ✓ 7.  test_constraints_dom_audit.js
  ✓ 8.  test_battery_synchronization.js
  ✓ 9.  test_case_validation.js
  ✓ 10. test_property_consistency.js
  ✓ 11. test_decision_trace_dom_audit.js
  ✓ 12. test_laps_remaining_slider.js
  ✓ 13. test_energy_deployment_twin.js
  ✓ 14. test_future_opportunity_tradeoff.js
  ✓ 15. test_spend_now_vs_save_later_optimization.js
```

---

## Quick Start & Development

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Launch
```bash
# Clone repository
git clone https://github.com/Kishorestalin-AIML/Trackshift_phase_1.git
cd Trackshift_phase_1

# Install dependencies
npm install

# Run local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to interact with the Digital Twin.

### Build Production Bundle
```bash
npm run build
```

---

## License
MIT License. Developed for Alpine F1 2026 Energy Strategy Simulation Research.
>>>>>>> 53a9842 (feat(engine): complete Spend Now vs Save For Later mathematical optimization, central RaceState, rolling horizon, and README documentation)
