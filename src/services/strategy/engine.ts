import type { Candle } from "../schemas.ts";
import type {
  BacktestSettings,
  BacktestTrade,
  BacktestEquityPoint,
  BacktestSummary,
  BacktestOutcome,
} from "./types.ts";

/**
 * OpenAlgo-compliant bar path generator:
 * For long: Open -> Low (adverse) -> High (favourable) -> Close
 * For short: Open -> High (adverse) -> Low (favourable) -> Close
 */
function getBarPath(candle: Candle, isLong: boolean): number[] {
  return isLong
    ? [candle.open, candle.low, candle.high, candle.close]
    : [candle.open, candle.high, candle.low, candle.close];
}

function calculateOrderCost(price: number, quantity: number, settings: BacktestSettings): number {
  const turnover = price * quantity;
  const brokerage = settings.brokeragePerOrder;
  const statutory = (turnover * settings.turnoverCostPct) / 100;
  return statutory + brokerage;
}

/**
 * Runs a full backtest simulation over candles using OpenAlgo bar-path execution logic.
 */
export function runBacktestSimulation(
  candles: Candle[],
  signals: {
    longEntry: boolean[];
    longExit: boolean[];
    shortEntry: boolean[];
    shortExit: boolean[];
  },
  settings: BacktestSettings,
  meta: {
    strategyId: string;
    strategyName: string;
    symbol: string;
    timeframe: string;
  },
): BacktestOutcome {
  const startTime = performance.now();

  if (!candles || candles.length < 2) {
    return createEmptyOutcome(meta, "Insufficient candle data for backtest (minimum 2 bars required).");
  }

  const slip = (settings.slippagePct ?? 0.02) / 100;
  const qty = settings.quantity > 0 ? settings.quantity : 1;
  const allowLong = settings.side === "both" || settings.side === "long_only";
  const allowShort = settings.side === "both" || settings.side === "short_only";

  let currentCapital = settings.initialCapital;
  let peakEquity = currentCapital;

  let posSide: "long" | "short" | null = null;
  let posEntryPrice = 0;
  let posEntryTime = 0;
  let posEntryBar = 0;
  let posStopPrice: number | null = null;
  let posTargetPrice: number | null = null;
  let posExtremePrice = 0; // Peak favorable price reached during trade

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];

  let pendingOrder: {
    action: "BUY" | "SELL" | "EXIT" | "REVERSE_BUY" | "REVERSE_SELL";
    reason: string;
  } | null = null;

  let totalChargesPaid = 0;
  let totalInMarketBars = 0;

  function closePosition(
    exitPrice: number,
    exitTime: number,
    exitBarIndex: number,
    reason: BacktestTrade["reason"],
  ) {
    if (!posSide) return;

    const isLong = posSide === "long";
    // Apply slippage on exit: selling gets lower price, buying back short gets higher price
    const filledPrice = isLong ? exitPrice * (1 - slip) : exitPrice * (1 + slip);
    const grossPnl = isLong
      ? (filledPrice - posEntryPrice) * qty
      : (posEntryPrice - filledPrice) * qty;

    const entryCost = calculateOrderCost(posEntryPrice, qty, settings);
    const exitCost = calculateOrderCost(filledPrice, qty, settings);
    const tradeCharges = entryCost + exitCost;
    const netPnl = grossPnl - tradeCharges;
    const netPnlPct = (netPnl / (posEntryPrice * qty)) * 100;

    totalChargesPaid += tradeCharges;
    currentCapital += netPnl;

    trades.push({
      id: trades.length + 1,
      entryTime: posEntryTime,
      exitTime,
      side: posSide,
      quantity: qty,
      entryPrice: Number(posEntryPrice.toFixed(4)),
      exitPrice: Number(filledPrice.toFixed(4)),
      grossPnl: Number(grossPnl.toFixed(2)),
      charges: Number(tradeCharges.toFixed(2)),
      netPnl: Number(netPnl.toFixed(2)),
      netPnlPct: Number(netPnlPct.toFixed(2)),
      reason,
      holdingBars: exitBarIndex - posEntryBar,
    });

    posSide = null;
    posEntryPrice = 0;
    posStopPrice = null;
    posTargetPrice = null;
    posExtremePrice = 0;
  }

  function openPosition(side: "long" | "short", openPrice: number, openTime: number, barIndex: number) {
    posSide = side;
    posEntryBar = barIndex;
    posEntryTime = openTime;
    // Apply slippage on entry: buying pays more, shorting gets less
    posEntryPrice = side === "long" ? openPrice * (1 + slip) : openPrice * (1 - slip);
    posExtremePrice = posEntryPrice;

    // Set Initial Stop Loss and Take Profit levels
    if (settings.stopLossPct > 0) {
      const slDist = (posEntryPrice * settings.stopLossPct) / 100;
      posStopPrice = side === "long" ? posEntryPrice - slDist : posEntryPrice + slDist;
    } else {
      posStopPrice = null;
    }

    if (settings.takeProfitPct > 0) {
      const tpDist = (posEntryPrice * settings.takeProfitPct) / 100;
      posTargetPrice = side === "long" ? posEntryPrice + tpDist : posEntryPrice - tpDist;
    } else {
      posTargetPrice = null;
    }
  }

  // Iterate chronologically through candles
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!;
    const barTime = candle.time;

    // 1. Process Pending Orders at the Open of the bar (OpenAlgo execution model)
    if (pendingOrder) {
      const openPrice = candle.open;

      if (pendingOrder.action === "EXIT" && posSide) {
        closePosition(openPrice, barTime, i, "Exit Signal");
      } else if (pendingOrder.action === "REVERSE_BUY") {
        if (posSide === "short") closePosition(openPrice, barTime, i, "Reversal");
        if (allowLong) openPosition("long", openPrice, barTime, i);
      } else if (pendingOrder.action === "REVERSE_SELL") {
        if (posSide === "long") closePosition(openPrice, barTime, i, "Reversal");
        if (allowShort) openPosition("short", openPrice, barTime, i);
      } else if (pendingOrder.action === "BUY" && !posSide && allowLong) {
        openPosition("long", openPrice, barTime, i);
      } else if (pendingOrder.action === "SELL" && !posSide && allowShort) {
        openPosition("short", openPrice, barTime, i);
      }

      pendingOrder = null;
    }

    // 2. Intra-bar price path simulation for active position (Stop Loss / Take Profit / Trailing Stop)
    if (posSide) {
      totalInMarketBars++;
      const isLong = posSide === "long";
      const path = getBarPath(candle, isLong);

      for (const pricePoint of path) {
        // Update extreme favorable price
        if (isLong) {
          if (pricePoint > posExtremePrice) {
            posExtremePrice = pricePoint;
            // Ratchet trailing stop upward
            if (settings.trailingStopPct > 0) {
              const trailDist = (posExtremePrice * settings.trailingStopPct) / 100;
              const newTrail = posExtremePrice - trailDist;
              if (posStopPrice === null || newTrail > posStopPrice) {
                posStopPrice = newTrail;
              }
            }
          }
        } else {
          if (pricePoint < posExtremePrice) {
            posExtremePrice = pricePoint;
            // Ratchet trailing stop downward
            if (settings.trailingStopPct > 0) {
              const trailDist = (posExtremePrice * settings.trailingStopPct) / 100;
              const newTrail = posExtremePrice + trailDist;
              if (posStopPrice === null || newTrail < posStopPrice) {
                posStopPrice = newTrail;
              }
            }
          }
        }

        // Check Stop Loss breach
        if (posStopPrice !== null) {
          const isStopBreached = isLong ? pricePoint <= posStopPrice : pricePoint >= posStopPrice;
          if (isStopBreached) {
            const isTrailing = settings.trailingStopPct > 0 && posExtremePrice !== posEntryPrice;
            closePosition(posStopPrice, barTime, i, isTrailing ? "Trailing Stop" : "Stop Loss");
            break;
          }
        }

        // Check Take Profit breach
        if (posTargetPrice !== null) {
          const isTargetBreached = isLong ? pricePoint >= posTargetPrice : pricePoint <= posTargetPrice;
          if (isTargetBreached) {
            closePosition(posTargetPrice, barTime, i, "Take Profit");
            break;
          }
        }
      }
    }

    // 3. Mark to Market at Bar Close for Equity Curve
    let markedOpenPnl = 0;
    if (posSide) {
      const isLong = posSide === "long";
      markedOpenPnl = isLong
        ? (candle.close - posEntryPrice) * qty
        : (posEntryPrice - candle.close) * qty;
    }

    const currentEquity = currentCapital + markedOpenPnl;
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const drawdownValue = currentEquity - peakEquity; // <= 0
    const drawdownPct = peakEquity > 0 ? (drawdownValue / peakEquity) * 100 : 0;

    equityCurve.push({
      time: barTime,
      equity: Number(currentEquity.toFixed(2)),
      drawdown: Number(drawdownPct.toFixed(2)),
      drawdownValue: Number(drawdownValue.toFixed(2)),
      inPosition: posSide !== null,
    });

    // 4. Evaluate Signals on this closed bar to queue orders for next bar's open
    const longEnter = signals.longEntry[i] ?? false;
    const longExit = signals.longExit[i] ?? false;
    const shortEnter = signals.shortEntry[i] ?? false;
    const shortExit = signals.shortExit[i] ?? false;

    if (posSide === "long") {
      if (shortEnter && allowShort) {
        pendingOrder = { action: "REVERSE_SELL", reason: "Signal Reversal" };
      } else if (longExit) {
        pendingOrder = { action: "EXIT", reason: "Long Exit Signal" };
      }
    } else if (posSide === "short") {
      if (longEnter && allowLong) {
        pendingOrder = { action: "REVERSE_BUY", reason: "Signal Reversal" };
      } else if (shortExit) {
        pendingOrder = { action: "EXIT", reason: "Short Exit Signal" };
      }
    } else {
      if (longEnter && allowLong) {
        pendingOrder = { action: "BUY", reason: "Long Entry Signal" };
      } else if (shortEnter && allowShort) {
        pendingOrder = { action: "SELL", reason: "Short Entry Signal" };
      }
    }
  }

  // Close open position on the final bar if still open
  if (posSide) {
    const lastBar = candles[candles.length - 1]!;
    closePosition(lastBar.close, lastBar.time, candles.length - 1, "End of Data");
    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1]!.equity = Number(currentCapital.toFixed(2));
      equityCurve[equityCurve.length - 1]!.inPosition = false;
    }
  }

  const ranMs = performance.now() - startTime;
  const summary = calculateSummaryMetrics(trades, equityCurve, settings, candles, ranMs);

  return {
    success: true,
    strategyId: meta.strategyId,
    strategyName: meta.strategyName,
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    summary,
    trades,
    equity: equityCurve,
    executedVia: "browser-engine",
  };
}

function calculateSummaryMetrics(
  trades: BacktestTrade[],
  equityCurve: BacktestEquityPoint[],
  settings: BacktestSettings,
  candles: Candle[],
  ranMs: number,
): BacktestSummary {
  const endingEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1]!.equity : settings.initialCapital;
  const netProfit = endingEquity - settings.initialCapital;
  const netProfitPct = settings.initialCapital > 0 ? (netProfit / settings.initialCapital) * 100 : 0;

  const tradeCount = trades.length;
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const winRate = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

  const totalWinPnl = wins.reduce((sum, t) => sum + t.netPnl, 0);
  const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.netPnl, 0));

  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 99.99 : 0;
  const expectancy = tradeCount > 0 ? netProfit / tradeCount : 0;

  let maxDrawdownValue = 0;
  let maxDrawdownPct = 0;
  let maxRunUp = 0;

  for (const pt of equityCurve) {
    if (Math.abs(pt.drawdownValue) > maxDrawdownValue) {
      maxDrawdownValue = Math.abs(pt.drawdownValue);
    }
    if (Math.abs(pt.drawdown) > maxDrawdownPct) {
      maxDrawdownPct = Math.abs(pt.drawdown);
    }
    const runUp = pt.equity - settings.initialCapital;
    if (runUp > maxRunUp) {
      maxRunUp = runUp;
    }
  }

  const averageTrade = tradeCount > 0 ? netProfit / tradeCount : 0;
  const averageWin = winCount > 0 ? totalWinPnl / winCount : 0;
  const averageLoss = lossCount > 0 ? totalLossPnl / lossCount : 0;
  const winLossRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.netPnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.netPnl)) : 0;

  const totalCharges = trades.reduce((sum, t) => sum + t.charges, 0);

  // Buy & hold comparison
  const firstClose = candles[0]?.close ?? 1;
  const lastClose = candles[candles.length - 1]?.close ?? 1;
  const buyAndHoldReturnPct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const buyAndHoldReturn = (settings.initialCapital * buyAndHoldReturnPct) / 100;

  const inMarketPoints = equityCurve.filter((p) => p.inPosition).length;
  const exposureTimePct = equityCurve.length > 0 ? (inMarketPoints / equityCurve.length) * 100 : 0;

  return {
    initialCapital: settings.initialCapital,
    endingEquity: Number(endingEquity.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    netProfitPct: Number(netProfitPct.toFixed(2)),
    tradeCount,
    winCount,
    lossCount,
    winRate: Number(winRate.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    maxDrawdown: Number(maxDrawdownValue.toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    maxRunUp: Number(maxRunUp.toFixed(2)),
    averageTrade: Number(averageTrade.toFixed(2)),
    averageWin: Number(averageWin.toFixed(2)),
    averageLoss: Number(averageLoss.toFixed(2)),
    winLossRatio: Number(winLossRatio.toFixed(2)),
    largestWin: Number(largestWin.toFixed(2)),
    largestLoss: Number(largestLoss.toFixed(2)),
    chargesPaid: Number(totalCharges.toFixed(2)),
    buyAndHoldReturn: Number(buyAndHoldReturn.toFixed(2)),
    buyAndHoldReturnPct: Number(buyAndHoldReturnPct.toFixed(2)),
    exposureTimePct: Number(exposureTimePct.toFixed(2)),
    ranMs: Number(ranMs.toFixed(1)),
    barCount: candles.length,
  };
}

function createEmptyOutcome(
  meta: { strategyId: string; strategyName: string; symbol: string; timeframe: string },
  errorMsg: string,
): BacktestOutcome {
  return {
    success: false,
    strategyId: meta.strategyId,
    strategyName: meta.strategyName,
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    summary: {
      initialCapital: 10000,
      endingEquity: 10000,
      netProfit: 0,
      netProfitPct: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      maxRunUp: 0,
      averageTrade: 0,
      averageWin: 0,
      averageLoss: 0,
      winLossRatio: 0,
      largestWin: 0,
      largestLoss: 0,
      chargesPaid: 0,
      buyAndHoldReturn: 0,
      buyAndHoldReturnPct: 0,
      exposureTimePct: 0,
      ranMs: 0,
      barCount: 0,
    },
    trades: [],
    equity: [],
    error: errorMsg,
    executedVia: "browser-engine",
  };
}
