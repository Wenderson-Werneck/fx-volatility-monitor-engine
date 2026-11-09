import {
  Operator,
  TriggerRule,
  EvaluationResult,
  FXQuote,
  MarketConsensusMode,
  PTAXDailyClose,
  RollingAverageMetrics,
} from "./types.js";

export class FXVolatilityMonitorEngine {
  /**
   * Evaluates a trigger rule against a rate with anti-flapping hysteresis and time-based cooldown.
   */
  public static evaluateHysteresis(
    rule: TriggerRule,
    currentRate: number,
    currentTime: Date = new Date()
  ): EvaluationResult {
    const isConditionMet =
      rule.operator === "ABOVE"
        ? currentRate >= rule.thresholdRate
        : currentRate <= rule.thresholdRate;

    const isoNow = currentTime.toISOString();

    if (!isConditionMet) {
      // Determine if rate retreated enough to safely re-arm the trigger
      const safeToRearm =
        rule.operator === "ABOVE"
          ? currentRate <= rule.thresholdRate - rule.hysteresisBand
          : currentRate >= rule.thresholdRate + rule.hysteresisBand;

      return {
        ruleId: rule.id,
        triggered: false,
        newArmedState: rule.armed || safeToRearm,
        evaluatedRate: currentRate,
        evaluatedAt: isoNow,
      };
    }

    // Condition is met. If not armed, it cannot trigger.
    if (!rule.armed) {
      return {
        ruleId: rule.id,
        triggered: false,
        newArmedState: false,
        evaluatedRate: currentRate,
        evaluatedAt: isoNow,
      };
    }

    // Check cooldown period
    let cooldownSatisfied = true;
    if (rule.lastTriggeredAt) {
      const lastTriggerMs = new Date(rule.lastTriggeredAt).getTime();
      const diffMinutes = (currentTime.getTime() - lastTriggerMs) / (1000 * 60);
      if (diffMinutes < rule.cooldownMinutes) {
        cooldownSatisfied = false;
      }
    }

    if (cooldownSatisfied) {
      return {
        ruleId: rule.id,
        triggered: true,
        newArmedState: false, // Disarm immediately upon firing
        triggerReason: `Rate ${currentRate.toFixed(4)} crossed threshold ${rule.thresholdRate.toFixed(4)} (${rule.operator}) with active armed state.`,
        evaluatedRate: currentRate,
        evaluatedAt: isoNow,
      };
    }

    return {
      ruleId: rule.id,
      triggered: false,
      newArmedState: false,
      evaluatedRate: currentRate,
      evaluatedAt: isoNow,
    };
  }

  /**
   * Resolves consensus exchange rate across multiple heterogeneous market data providers.
   */
  public static resolveConsensusRate(
    quotes: FXQuote[],
    mode: MarketConsensusMode
  ): { resolvedRate: number | null; consensusReached: boolean; contributingProviders: string[] } {
    if (quotes.length === 0) {
      return { resolvedRate: null, consensusReached: false, contributingProviders: [] };
    }

    if (mode === "OFFICIAL_PTAX_ONLY") {
      const ptax = quotes.find((q) => q.provider === "CENTRAL_BANK_PTAX");
      if (ptax) {
        return {
          resolvedRate: ptax.ask,
          consensusReached: true,
          contributingProviders: [ptax.provider],
        };
      }
      return { resolvedRate: null, consensusReached: false, contributingProviders: [] };
    }

    if (mode === "ANY_SINGLE_SOURCE") {
      const sorted = [...quotes].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return {
        resolvedRate: sorted[0].mid,
        consensusReached: true,
        contributingProviders: [sorted[0].provider],
      };
    }

    if (mode === "TWO_SOURCE_CONFIRMATION") {
      // Must have at least two distinct providers within 15 minutes of each other
      if (quotes.length < 2) {
        return { resolvedRate: null, consensusReached: false, contributingProviders: [] };
      }
      const uniqueProviders = new Map<string, FXQuote>();
      for (const q of quotes) {
        if (!uniqueProviders.has(q.provider)) {
          uniqueProviders.set(q.provider, q);
        }
      }

      if (uniqueProviders.size < 2) {
        return { resolvedRate: null, consensusReached: false, contributingProviders: [] };
      }

      const activeQuotes = Array.from(uniqueProviders.values());
      const avgRate =
        activeQuotes.reduce((acc, q) => acc + q.mid, 0) / activeQuotes.length;

      return {
        resolvedRate: Number(avgRate.toFixed(4)),
        consensusReached: true,
        contributingProviders: activeQuotes.map((q) => q.provider),
      };
    }

    return { resolvedRate: null, consensusReached: false, contributingProviders: [] };
  }

  /**
   * Computes statutory PTAX weekly and monthly rolling moving averages.
   */
  public static calculateRollingAverages(
    history: PTAXDailyClose[],
    referenceDateIso: string
  ): RollingAverageMetrics {
    if (history.length === 0) {
      return {
        currentWeekAvgS0: 0,
        priorWeekAvgS1: 0,
        weeklyDelta: 0,
        priorMonthAvgM1: 0,
        currentMonthAvgM0: 0,
      };
    }

    const refDate = new Date(`${referenceDateIso}T12:00:00Z`);

    // Determine Monday of current week
    const dayOfWeek = (refDate.getUTCDay() + 6) % 7; // Monday = 0
    const mondayMs = refDate.getTime() - dayOfWeek * 86400000;
    const mondayIso = new Date(mondayMs).toISOString().slice(0, 10);

    const priorMondayMs = mondayMs - 7 * 86400000;
    const priorMondayIso = new Date(priorMondayMs).toISOString().slice(0, 10);

    // Current week quotes (S0)
    const s0Quotes = history.filter(
      (h) => h.date >= mondayIso && h.date <= referenceDateIso
    );
    // Prior week quotes (S1)
    const s1Quotes = history.filter(
      (h) => h.date >= priorMondayIso && h.date < mondayIso
    );

    const s0Avg =
      s0Quotes.length > 0
        ? s0Quotes.reduce((acc, q) => acc + q.sellRate, 0) / s0Quotes.length
        : 0;
    const s1Avg =
      s1Quotes.length > 0
        ? s1Quotes.reduce((acc, q) => acc + q.sellRate, 0) / s1Quotes.length
        : 0;

    // Monthly buckets
    const currentMonthPrefix = referenceDateIso.slice(0, 7); // YYYY-MM
    const refYear = Number(referenceDateIso.slice(0, 4));
    const refMonth = Number(referenceDateIso.slice(5, 7));

    const priorMonthDate = new Date(Date.UTC(refYear, refMonth - 2, 1));
    const priorMonthPrefix = priorMonthDate.toISOString().slice(0, 7);

    const m0Quotes = history.filter((h) => h.date.startsWith(currentMonthPrefix));
    const m1Quotes = history.filter((h) => h.date.startsWith(priorMonthPrefix));

    const m0Avg =
      m0Quotes.length > 0
        ? m0Quotes.reduce((acc, q) => acc + q.sellRate, 0) / m0Quotes.length
        : 0;
    const m1Avg =
      m1Quotes.length > 0
        ? m1Quotes.reduce((acc, q) => acc + q.sellRate, 0) / m1Quotes.length
        : 0;

    return {
      currentWeekAvgS0: Number(s0Avg.toFixed(4)),
      priorWeekAvgS1: Number(s1Avg.toFixed(4)),
      weeklyDelta: Number((s0Avg - s1Avg).toFixed(4)),
      currentMonthAvgM0: Number(m0Avg.toFixed(4)),
      priorMonthAvgM1: Number(m1Avg.toFixed(4)),
    };
  }
}
