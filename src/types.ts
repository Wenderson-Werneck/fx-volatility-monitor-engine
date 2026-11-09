export type Operator = "ABOVE" | "BELOW";

export type MarketProvider = "CENTRAL_BANK_PTAX" | "AWESOME_API" | "TWELVE_DATA" | "HG_BRASIL";

export type MarketConsensusMode = "ANY_SINGLE_SOURCE" | "TWO_SOURCE_CONFIRMATION" | "OFFICIAL_PTAX_ONLY";

export interface FXQuote {
  provider: MarketProvider;
  pair: string; // e.g. "USD/BRL"
  bid: number;
  ask: number;
  mid: number;
  timestamp: string; // ISO 8601
}

export interface PTAXDailyClose {
  date: string; // YYYY-MM-DD
  buyRate: number;
  sellRate: number;
  bulletinCount: number;
}

export interface TriggerRule {
  id: string;
  ruleName: string;
  operator: Operator;
  thresholdRate: number;
  consensusMode: MarketConsensusMode;
  armed: boolean;
  lastTriggeredAt: string | null;
  cooldownMinutes: number; // e.g. 60
  hysteresisBand: number; // e.g. 0.01 BRL
}

export interface EvaluationResult {
  ruleId: string;
  triggered: boolean;
  newArmedState: boolean;
  triggerReason?: string;
  evaluatedRate: number;
  evaluatedAt: string;
}

export interface RollingAverageMetrics {
  currentWeekAvgS0: number;
  priorWeekAvgS1: number;
  weeklyDelta: number;
  priorMonthAvgM1: number;
  currentMonthAvgM0: number;
}
