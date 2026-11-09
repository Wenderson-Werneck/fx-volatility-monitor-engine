# 💱 FX Volatility Monitor & Consensus Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green)](https://nodejs.org/)

An enterprise-grade Foreign Exchange (FX) monitoring, threshold evaluation, and rolling moving-average analytical engine designed for corporate treasury, trade finance, and supply chain operations.

---

## 🏗 Key Architectural Capabilities

- **Anti-Flapping Hysteresis Engine**:
  Prevents alert fatigue and event flapping on borderline rates using a dual-state armed/disarmed state machine, configurable hysteresis bands (e.g. `±R$ 0.01`), and statutory cooldown timers.
- **Multi-Source Consensus Resolution**:
  Aggregates real-time indicative quotes across heterogeneous providers (`AwesomeAPI`, `Twelve Data`, `HG Brasil`, and official `Central Bank PTAX`), calculating harmonized midpoint rates or requiring multi-provider agreement.
- **Statutory PTAX Rolling Averages**:
  Computes official Brazilian Central Bank rolling weekly averages ($S_0$, $S_{-1}$, $\Delta_{S_0-S_1}$) and monthly averages ($M_0$, $M_{-1}$) with automated partial-week and calendar-aware handling.

---

## 📐 Mathematical Formulation

### 1. Hysteresis State Transition

For an upper threshold rule with target rate $R_{target}$ and hysteresis buffer $\delta$:

$$\text{Trigger Condition: } R_t \ge R_{target} \quad \land \quad \text{Armed} = \text{True}$$

$$\text{Rearm Condition: } R_t \le R_{target} - \delta$$

```text
Rate
  ▲
  │        ┌───────────────────────────── Trigger Fired (Disarms)
──┼────────┼──────────────────────────── Threshold (R_target)
  │       / \
──┼──────/───\─────────────┌──────────── Re-arm Threshold (R_target - δ)
  │     /     \           /
  └────┴───────┴─────────┴──────────────► Time
```

### 2. Rolling Weekly PTAX Moving Average

$$S_k = \frac{1}{N_k} \sum_{i=1}^{N_k} PTAX_{sell}(i)$$

$$\Delta_{S_0 - S_{-1}} = S_0 - S_{-1}$$

---

## 🚀 Quick Start

### Build and Run Tests

```bash
# Compile TypeScript to ES2022
npm run build

# Execute automated test suite (Node.js Native Test Runner)
npm test
```

### Example Usage

```typescript
import { FXVolatilityMonitorEngine, TriggerRule } from "fx-volatility-monitor-engine";

const rule: TriggerRule = {
  id: "FX_USD_BRL_PEAK",
  ruleName: "Notify Treasury when USD/BRL >= 5.80",
  operator: "ABOVE",
  thresholdRate: 5.80,
  consensusMode: "TWO_SOURCE_CONFIRMATION",
  armed: true,
  lastTriggeredAt: null,
  cooldownMinutes: 60,
  hysteresisBand: 0.01,
};

// Evaluate incoming rate against rule
const result = FXVolatilityMonitorEngine.evaluateHysteresis(rule, 5.805);

if (result.triggered) {
  console.log(`[ALERT] ${result.triggerReason}`);
  // Dispatch outbox email or webhook
}
```

---

## 🔒 Security & Data Privacy

This repository contains sanitized algorithmic logic and simulated data models. No internal enterprise endpoints, proprietary API tokens, or production database credentials are included.

## 📄 License

MIT © [Wenderson Werneck](https://github.com/Wenderson-Werneck)
