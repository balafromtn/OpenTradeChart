import type { Candle } from "../schemas.ts";
import type { StrategyDefinition, BacktestSettings, BacktestOutcome } from "./types.ts";
import { runBacktestSimulation } from "./engine.ts";

export async function executeBacktest(
  strategy: StrategyDefinition,
  params: Record<string, any>,
  settings: BacktestSettings,
  candles: Candle[],
  meta: { symbol: string; timeframe: string },
): Promise<BacktestOutcome> {
  const runMeta = {
    strategyId: strategy.id,
    strategyName: strategy.name,
    symbol: meta.symbol,
    timeframe: meta.timeframe,
  };

  // 1. Try Python backend for custom Python strategies
  if (strategy.id === "custom_python" && strategy.pythonScript && typeof window !== "undefined") {
    try {
      const response = await fetch("/api/strategy-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: strategy.pythonScript,
          candles,
          settings,
          params,
          meta: runMeta,
        }),
      });

      if (response.ok) {
        const pyResult = await response.json();
        if (pyResult.success && pyResult.signals) {
          const sigs = {
            longEntry: pyResult.signals.long_entry || [],
            longExit: pyResult.signals.long_exit || [],
            shortEntry: pyResult.signals.short_entry || [],
            shortExit: pyResult.signals.short_exit || [],
          };
          const outcome = runBacktestSimulation(candles, sigs, settings, runMeta);
          outcome.executedVia = "python-backend";
          return outcome;
        }
      }
    } catch {
      // Fall through to browser engine
    }
  }

  // 2. Client-side simulation engine (instant, zero-dependency)
  if (strategy.generateSignals) {
    const signals = strategy.generateSignals(candles, params);
    return runBacktestSimulation(candles, signals, settings, runMeta);
  }

  throw new Error(`Strategy ${strategy.name} does not have a signal generator.`);
}
