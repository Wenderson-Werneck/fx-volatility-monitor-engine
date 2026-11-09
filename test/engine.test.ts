// @ts-ignore
import { test, describe } from "node:test";
// @ts-ignore
import assert from "node:assert/strict";
import { FXVolatilityMonitorEngine } from "../src/engine.js";
import { TriggerRule, FXQuote, PTAXDailyClose } from "../src/types.js";

describe("FXVolatilityMonitorEngine", () => {
  test("hysteresis correctly prevents flapping on borderline rates", () => {
    const rule: TriggerRule = {
      id: "RULE_USD_ABOVE_580",
      ruleName: "Alert when USD reaches 5.80",
      operator: "ABOVE",
      thresholdRate: 5.80,
      consensusMode: "ANY_SINGLE_SOURCE",
      armed: true,
      lastTriggeredAt: null,
      cooldownMinutes: 60,
      hysteresisBand: 0.01,
    };

    const now = new Date("2026-11-09T10:00:00Z");

    // 1. Rate crosses 5.805 -> Should TRIGGER and DISARM
    const res1 = FXVolatilityMonitorEngine.evaluateHysteresis(rule, 5.805, now);
    assert.equal(res1.triggered, true);
    assert.equal(res1.newArmedState, false);

    // 2. Next tick: Rate drops to 5.795 (only 0.005 below threshold, less than 0.01 hysteresis)
    // Should NOT rearm yet
    const unarmRule: TriggerRule = {
      ...rule,
      armed: false,
      lastTriggeredAt: now.toISOString(),
    };
    const res2 = FXVolatilityMonitorEngine.evaluateHysteresis(unarmRule, 5.795, new Date("2026-11-09T10:05:00Z"));
    assert.equal(res2.triggered, false);
    assert.equal(res2.newArmedState, false); // Still disarmed

    // 3. Rate drops to 5.789 (more than 0.01 below 5.80) -> Safe to RE-ARM
    const res3 = FXVolatilityMonitorEngine.evaluateHysteresis(unarmRule, 5.789, new Date("2026-11-09T10:15:00Z"));
    assert.equal(res3.triggered, false);
    assert.equal(res3.newArmedState, true); // Safely rearmed
  });

  test("two-source consensus calculates harmonic average across distinct providers", () => {
    const quotes: FXQuote[] = [
      {
        provider: "AWESOME_API",
        pair: "USD/BRL",
        bid: 5.812,
        ask: 5.814,
        mid: 5.813,
        timestamp: "2026-11-09T10:00:00Z",
      },
      {
        provider: "TWELVE_DATA",
        pair: "USD/BRL",
        bid: 5.816,
        ask: 5.818,
        mid: 5.817,
        timestamp: "2026-11-09T10:01:00Z",
      },
    ];

    const consensus = FXVolatilityMonitorEngine.resolveConsensusRate(
      quotes,
      "TWO_SOURCE_CONFIRMATION"
    );
    assert.equal(consensus.consensusReached, true);
    assert.equal(consensus.resolvedRate, 5.815);
    assert.deepEqual(consensus.contributingProviders, ["AWESOME_API", "TWELVE_DATA"]);
  });

  test("calculates PTAX rolling weekly averages and delta", () => {
    const ptaxHistory: PTAXDailyClose[] = [
      // S1 (Prior week: Mon-Fri)
      { date: "2026-11-02", buyRate: 5.75, sellRate: 5.755, bulletinCount: 4 },
      { date: "2026-11-03", buyRate: 5.76, sellRate: 5.765, bulletinCount: 4 },
      { date: "2026-11-04", buyRate: 5.77, sellRate: 5.775, bulletinCount: 4 },
      { date: "2026-11-05", buyRate: 5.78, sellRate: 5.785, bulletinCount: 4 },
      { date: "2026-11-06", buyRate: 5.79, sellRate: 5.795, bulletinCount: 4 },
      // S0 (Current week: Mon)
      { date: "2026-11-09", buyRate: 5.82, sellRate: 5.825, bulletinCount: 2 },
    ];

    const metrics = FXVolatilityMonitorEngine.calculateRollingAverages(
      ptaxHistory,
      "2026-11-09"
    );

    assert.equal(metrics.currentWeekAvgS0, 5.825); // Only 1 day so far
    assert.equal(metrics.priorWeekAvgS1, 5.775); // (5.755+5.765+5.775+5.785+5.795)/5 = 5.775
    assert.equal(metrics.weeklyDelta, 0.05); // 5.825 - 5.775 = +0.05 BRL
  });
});
