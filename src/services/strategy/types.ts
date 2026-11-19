import type { Candle } from "../schemas.ts";

export type StrategySide = "both" | "long_only" | "short_only";

export interface StrategyParameter {
  id: string;
  name: string;
  type: "number" | "boolean" | "select";
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  description?: string;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  category: "Trend" | "Momentum" | "Breakout" | "Mean Reversion" | "Custom";
  parameters: StrategyParameter[];
  defaultParams: Record<string, any>;
  /** Optional Python script code for this strategy */
  pythonScript?: string;
  /** Function to evaluate signals on candles */
  generateSignals?: (
    candles: Candle[],
    params: Record<string, any>,
  ) => {
    longEntry: boolean[];
    longExit: boolean[];
    shortEntry: boolean[];
    shortExit: boolean[];
  };
}

export interface BacktestSettings {
  initialCapital: number;
  quantity: number;
  side: StrategySide;
  stopLossPct: number; // e.g. 1.5 for 1.5%
  takeProfitPct: number; // e.g. 3.0 for 3.0%
  trailingStopPct: number; // e.g. 0.5 for 0.5% trailing stop, 0 = disabled
  slippagePct: number; // e.g. 0.02%
  brokeragePerOrder: number; // flat cost e.g. $1 or ₹20
  turnoverCostPct: number; // statutory cost % e.g. 0.02%
  maxTradesPerDay?: number;
}

export interface BacktestTrade {
  id: number;
  entryTime: number; // Unix epoch seconds
  exitTime: number;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  netPnlPct: number;
  reason:
    | "Take Profit"
    | "Stop Loss"
    | "Trailing Stop"
    | "Exit Signal"
    | "Reversal"
    | "End of Data";
  holdingBars: number;
}

export interface BacktestEquityPoint {
  time: number;
  equity: number;
  drawdown: number; // Drawdown % from peak (0 to -100%)
  drawdownValue: number; // Drawdown in currency
  inPosition: boolean;
}

export interface BacktestSummary {
  initialCapital: number;
  endingEquity: number;
  netProfit: number;
  netProfitPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number; // 0 - 100%
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number; // $ value
  maxDrawdownPct: number; // %
  maxRunUp: number;
  averageTrade: number;
  averageWin: number;
  averageLoss: number;
  winLossRatio: number;
  largestWin: number;
  largestLoss: number;
  chargesPaid: number;
  buyAndHoldReturn: number;
  buyAndHoldReturnPct: number;
  exposureTimePct: number;
  ranMs: number;
  barCount: number;
}

export interface BacktestOutcome {
  success: boolean;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  summary: BacktestSummary;
  trades: BacktestTrade[];
  equity: BacktestEquityPoint[];
  error?: string;
  executedVia: "browser-engine" | "python-backend";
}
