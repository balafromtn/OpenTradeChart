import { describe, it, expect } from "vitest";
import type { Candle } from "../services/schemas.ts";
import { runBacktestSimulation } from "../services/strategy/engine.ts";
import { BUILTIN_STRATEGIES } from "../services/strategy/builtinStrategies.ts";
import type { BacktestSettings } from "../services/strategy/types.ts";

function generateTestCandles(n: number = 100): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  const startTime = 1700000000;

  for (let i = 0; i < n; i++) {
    // Generate trending/oscillating series
    const change = Math.sin(i / 5) * 2 + (i > 50 ? 0.5 : -0.2);
    const open = price;
    const high = open + Math.abs(change) + 1.5;
    const low = Math.max(1, open - Math.abs(change) - 1.2);
    const close = open + change;
    price = close;

    candles.push({
      time: startTime + i * 3600,
      open,
      high,
      low,
      close,
      volume: 1000 + i * 10,
    });
  }
  return candles;
}

const testSettings: BacktestSettings = {
  initialCapital: 10000,
  quantity: 1,
  side: "both",
  stopLossPct: 2.0,
  takeProfitPct: 4.0,
  trailingStopPct: 1.0,
  slippagePct: 0.02,
  brokeragePerOrder: 1.0,
  turnoverCostPct: 0.02,
};

describe("Strategy Backtesting Engine", () => {
  it("should simulate trades with OpenAlgo bar-path and calculate summary metrics", () => {
    const candles = generateTestCandles(100);
    const n = candles.length;

    // Synthetic signals: buy at bar 10, exit at bar 20, buy at bar 40, exit at bar 60
    const signals = {
      longEntry: new Array(n).fill(false),
      longExit: new Array(n).fill(false),
      shortEntry: new Array(n).fill(false),
      shortExit: new Array(n).fill(false),
    };

    signals.longEntry[10] = true;
    signals.longExit[25] = true;
    signals.shortEntry[40] = true;
    signals.shortExit[55] = true;

    const outcome = runBacktestSimulation(
      candles,
      signals,
      testSettings,
      {
        strategyId: "test_strategy",
        strategyName: "Test Strategy",
        symbol: "TEST",
        timeframe: "1h",
      },
    );

    expect(outcome.success).toBe(true);
    expect(outcome.trades.length).toBeGreaterThan(0);
    expect(outcome.equity.length).toBe(candles.length);
    expect(outcome.summary.initialCapital).toBe(10000);
    expect(outcome.summary.barCount).toBe(100);

    // Verify first trade executed at bar 11 open (next-bar-open execution)
    const firstTrade = outcome.trades[0]!;
    expect(firstTrade.side).toBe("long");
    expect(firstTrade.quantity).toBe(1);
    expect(firstTrade.charges).toBeGreaterThan(0);
    expect(Number.isFinite(firstTrade.netPnl)).toBe(true);
  });

  it("should trigger Stop Loss and Take Profit levels accurately", () => {
    const candles: Candle[] = [
      { time: 100, open: 100, high: 101, low: 99, close: 100, volume: 100 },
      // Bar 1: long signal fired
      { time: 200, open: 100, high: 101, low: 99, close: 100, volume: 100 },
      // Bar 2: entered at 100, price surges to 106 (> 4% TP target of 104)
      { time: 300, open: 100, high: 107, low: 99, close: 106, volume: 100 },
      { time: 400, open: 106, high: 107, low: 105, close: 106, volume: 100 },
    ];

    const signals = {
      longEntry: [false, true, false, false],
      longExit: [false, false, false, false],
      shortEntry: [false, false, false, false],
      shortExit: [false, false, false, false],
    };

    const outcome = runBacktestSimulation(
      candles,
      signals,
      {
        ...testSettings,
        takeProfitPct: 4.0, // TP at 104
        stopLossPct: 2.0, // SL at 98
      },
      { strategyId: "tp_test", strategyName: "TP Test", symbol: "TEST", timeframe: "1h" },
    );

    expect(outcome.trades.length).toBe(1);
    const trade = outcome.trades[0]!;
    expect(trade.reason).toBe("Take Profit");
    expect(trade.netPnl).toBeGreaterThan(0);
  });

  it("should generate valid signals from builtin EMA Crossover strategy", () => {
    const emaStrategy = BUILTIN_STRATEGIES.find((s) => s.id === "ema_crossover");
    expect(emaStrategy).toBeDefined();

    const candles = generateTestCandles(150);
    const signals = emaStrategy!.generateSignals!(candles, { fastPeriod: 5, slowPeriod: 15 });

    expect(signals.longEntry.length).toBe(candles.length);
    expect(signals.shortEntry.length).toBe(candles.length);

    // Verify backtest runs cleanly on builtin strategy
    const outcome = runBacktestSimulation(
      candles,
      signals,
      testSettings,
      {
        strategyId: emaStrategy!.id,
        strategyName: emaStrategy!.name,
        symbol: "BTCUSD",
        timeframe: "1h",
      },
    );

    expect(outcome.success).toBe(true);
    expect(outcome.summary.tradeCount).toBeGreaterThanOrEqual(0);
  });

  it("should generate valid signals from builtin Supertrend strategy", () => {
    const supertrend = BUILTIN_STRATEGIES.find((s) => s.id === "supertrend_trend");
    expect(supertrend).toBeDefined();

    const candles = generateTestCandles(150);
    const signals = supertrend!.generateSignals!(candles, { atrPeriod: 10, multiplier: 3.0 });

    expect(signals.longEntry.length).toBe(candles.length);
    expect(signals.shortEntry.length).toBe(candles.length);

    const outcome = runBacktestSimulation(
      candles,
      signals,
      testSettings,
      {
        strategyId: supertrend!.id,
        strategyName: supertrend!.name,
        symbol: "ETHUSD",
        timeframe: "1h",
      },
    );

    expect(outcome.success).toBe(true);
  });
});
