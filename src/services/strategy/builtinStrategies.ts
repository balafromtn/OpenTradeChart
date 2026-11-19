import type { Candle } from "../schemas.ts";
import type { StrategyDefinition } from "./types.ts";

/**
 * Calculates Simple Moving Average (SMA)
 */
function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) {
      sum -= values[i - period]!;
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return result;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i]!;
  }
  let prevEma = sum / period;
  result[period - 1] = prevEma;

  for (let i = period; i < values.length; i++) {
    prevEma = values[i]! * k + prevEma * (1 - k);
    result[i] = prevEma;
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
function calculateRSI(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i]! - closes[i - 1]!;
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

/**
 * Calculates True Range and ATR
 */
function calculateATR(candles: Candle[], period: number): number[] {
  const tr: number[] = [candles[0] ? candles[0].high - candles[0].low : 0];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i]!.high;
    const l = candles[i]!.low;
    const prevC = candles[i - 1]!.close;
    tr.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
  }
  return calculateSMA(tr, period);
}

export const BUILTIN_STRATEGIES: StrategyDefinition[] = [
  {
    id: "ema_crossover",
    name: "OpenAlgo EMA Crossover",
    description: "Classic OpenAlgo dual moving-average trend following strategy. Buys on bullish golden cross and exits or shorts on bearish death cross.",
    category: "Trend",
    parameters: [
      { id: "fastPeriod", name: "Fast EMA Period", type: "number", default: 9, min: 2, max: 200, step: 1 },
      { id: "slowPeriod", name: "Slow EMA Period", type: "number", default: 21, min: 5, max: 500, step: 1 },
    ],
    defaultParams: { fastPeriod: 9, slowPeriod: 21 },
    generateSignals: (candles, params) => {
      const fastP = Number(params.fastPeriod ?? 9);
      const slowP = Number(params.slowPeriod ?? 21);
      const closes = candles.map((c) => c.close);
      const fastEma = calculateEMA(closes, fastP);
      const slowEma = calculateEMA(closes, slowP);

      const n = candles.length;
      const longEntry = new Array(n).fill(false);
      const longExit = new Array(n).fill(false);
      const shortEntry = new Array(n).fill(false);
      const shortExit = new Array(n).fill(false);

      for (let i = 1; i < n; i++) {
        const prevFast = fastEma[i - 1];
        const prevSlow = slowEma[i - 1];
        const currFast = fastEma[i];
        const currSlow = slowEma[i];

        if (
          prevFast !== undefined &&
          prevSlow !== undefined &&
          currFast !== undefined &&
          currSlow !== undefined &&
          !isNaN(prevFast) &&
          !isNaN(prevSlow) &&
          !isNaN(currFast) &&
          !isNaN(currSlow)
        ) {
          // Bullish Crossover: Fast crosses above Slow
          if (prevFast <= prevSlow && currFast > currSlow) {
            longEntry[i] = true;
            shortExit[i] = true;
          }
          // Bearish Crossunder: Fast crosses below Slow
          else if (prevFast >= prevSlow && currFast < currSlow) {
            shortEntry[i] = true;
            longExit[i] = true;
          }
        }
      }
      return { longEntry, longExit, shortEntry, shortExit };
    },
    pythonScript: `# OpenAlgo EMA Crossover Strategy
def signals(df):
    fast = df['close'].ewm(span=9, adjust=False).mean()
    slow = df['close'].ewm(span=21, adjust=False).mean()
    
    long_entry = (fast > slow) & (fast.shift(1) <= slow.shift(1))
    long_exit = (fast < slow) & (fast.shift(1) >= slow.shift(1))
    short_entry = long_exit
    short_exit = long_entry
    
    return {
        "long_entry": long_entry.tolist(),
        "long_exit": long_exit.tolist(),
        "short_entry": short_entry.tolist(),
        "short_exit": short_exit.tolist()
    }
`,
  },

  {
    id: "rsi_reversal",
    name: "OpenAlgo RSI Mean Reversion",
    description: "Reversion strategy identifying oversold bounces and overbought exhaustion. Buys when RSI crosses back above oversold threshold.",
    category: "Mean Reversion",
    parameters: [
      { id: "period", name: "RSI Period", type: "number", default: 14, min: 2, max: 100, step: 1 },
      { id: "oversold", name: "Oversold Level", type: "number", default: 30, min: 10, max: 45, step: 1 },
      { id: "overbought", name: "Overbought Level", type: "number", default: 70, min: 55, max: 90, step: 1 },
    ],
    defaultParams: { period: 14, oversold: 30, overbought: 70 },
    generateSignals: (candles, params) => {
      const p = Number(params.period ?? 14);
      const os = Number(params.oversold ?? 30);
      const ob = Number(params.overbought ?? 70);
      const closes = candles.map((c) => c.close);
      const rsi = calculateRSI(closes, p);

      const n = candles.length;
      const longEntry = new Array(n).fill(false);
      const longExit = new Array(n).fill(false);
      const shortEntry = new Array(n).fill(false);
      const shortExit = new Array(n).fill(false);

      for (let i = 1; i < n; i++) {
        const prevRsi = rsi[i - 1];
        const currRsi = rsi[i];
        if (
          prevRsi !== undefined &&
          currRsi !== undefined &&
          !isNaN(prevRsi) &&
          !isNaN(currRsi)
        ) {
          // Cross above oversold: buy
          if (prevRsi <= os && currRsi > os) {
            longEntry[i] = true;
          }
          // Cross into overbought: exit long / enter short
          if (prevRsi < ob && currRsi >= ob) {
            longExit[i] = true;
            shortEntry[i] = true;
          }
          // Cross below overbought: exit short
          if (prevRsi >= 50 && currRsi < 50) {
            shortExit[i] = true;
          }
        }
      }
      return { longEntry, longExit, shortEntry, shortExit };
    },
  },

  {
    id: "supertrend_trend",
    name: "OpenAlgo Supertrend",
    description: "ATR-based volatility trailing trend system. Rides strong breakouts and flips direction on band violation.",
    category: "Trend",
    parameters: [
      { id: "atrPeriod", name: "ATR Period", type: "number", default: 10, min: 3, max: 50, step: 1 },
      { id: "multiplier", name: "ATR Multiplier", type: "number", default: 3.0, min: 0.5, max: 10, step: 0.1 },
    ],
    defaultParams: { atrPeriod: 10, multiplier: 3.0 },
    generateSignals: (candles, params) => {
      const period = Number(params.atrPeriod ?? 10);
      const mult = Number(params.multiplier ?? 3.0);
      const atr = calculateATR(candles, period);

      const n = candles.length;
      const longEntry = new Array(n).fill(false);
      const longExit = new Array(n).fill(false);
      const shortEntry = new Array(n).fill(false);
      const shortExit = new Array(n).fill(false);

      let trend = 1; // 1 = uptrend, -1 = downtrend
      let upperBand = 0;
      let lowerBand = 0;

      for (let i = period; i < n; i++) {
        const c = candles[i]!;
        const prevC = candles[i - 1]!;
        const hl2 = (c.high + c.low) / 2;
        const currentAtr = atr[i]!;

        const basicUpper = hl2 + mult * currentAtr;
        const basicLower = hl2 - mult * currentAtr;

        if (basicUpper < upperBand || prevC.close > upperBand) {
          upperBand = basicUpper;
        }
        if (basicLower > lowerBand || prevC.close < lowerBand) {
          lowerBand = basicLower;
        }

        const prevTrend = trend;
        if (trend === 1 && c.close < lowerBand) {
          trend = -1;
        } else if (trend === -1 && c.close > upperBand) {
          trend = 1;
        }

        if (prevTrend === -1 && trend === 1) {
          longEntry[i] = true;
          shortExit[i] = true;
        } else if (prevTrend === 1 && trend === -1) {
          shortEntry[i] = true;
          longExit[i] = true;
        }
      }
      return { longEntry, longExit, shortEntry, shortExit };
    },
  },

  {
    id: "bollinger_breakout",
    name: "OpenAlgo Bollinger Band Breakout",
    description: "Volatility breakout strategy. Buys when price closes above the upper 2-standard-deviation band and exits at the 20 SMA midline.",
    category: "Breakout",
    parameters: [
      { id: "period", name: "Period", type: "number", default: 20, min: 5, max: 100, step: 1 },
      { id: "stdDev", name: "Standard Deviation", type: "number", default: 2.0, min: 1.0, max: 4.0, step: 0.1 },
    ],
    defaultParams: { period: 20, stdDev: 2.0 },
    generateSignals: (candles, params) => {
      const p = Number(params.period ?? 20);
      const k = Number(params.stdDev ?? 2.0);
      const closes = candles.map((c) => c.close);
      const sma = calculateSMA(closes, p);

      const n = candles.length;
      const longEntry = new Array(n).fill(false);
      const longExit = new Array(n).fill(false);
      const shortEntry = new Array(n).fill(false);
      const shortExit = new Array(n).fill(false);

      for (let i = p; i < n; i++) {
        // Calculate standard deviation over window
        let varianceSum = 0;
        const mean = sma[i]!;
        for (let j = i - p + 1; j <= i; j++) {
          varianceSum += Math.pow(closes[j]! - mean, 2);
        }
        const sd = Math.sqrt(varianceSum / p);
        const upper = mean + k * sd;
        const lower = mean - k * sd;

        const close = closes[i]!;
        const prevClose = closes[i - 1]!;

        // Upper band breakout
        if (prevClose <= upper && close > upper) {
          longEntry[i] = true;
        } else if (close < mean) {
          longExit[i] = true;
        }

        // Lower band breakdown
        if (prevClose >= lower && close < lower) {
          shortEntry[i] = true;
        } else if (close > mean) {
          shortExit[i] = true;
        }
      }
      return { longEntry, longExit, shortEntry, shortExit };
    },
  },

  {
    id: "macd_momentum",
    name: "OpenAlgo MACD Histogram Momentum",
    description: "Dual-momentum momentum oscillator. Enters long when MACD line crosses above Signal line with rising momentum.",
    category: "Momentum",
    parameters: [
      { id: "fast", name: "Fast EMA", type: "number", default: 12, min: 2, max: 50, step: 1 },
      { id: "slow", name: "Slow EMA", type: "number", default: 26, min: 10, max: 100, step: 1 },
      { id: "signal", name: "Signal EMA", type: "number", default: 9, min: 2, max: 30, step: 1 },
    ],
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    generateSignals: (candles, params) => {
      const fastP = Number(params.fast ?? 12);
      const slowP = Number(params.slow ?? 26);
      const sigP = Number(params.signal ?? 9);
      const closes = candles.map((c) => c.close);

      const fastEma = calculateEMA(closes, fastP);
      const slowEma = calculateEMA(closes, slowP);
      const macdLine = fastEma.map((f, i) => f - slowEma[i]!);

      // Calculate signal line (EMA of MACD line)
      const validMacd = macdLine.slice(slowP - 1);
      const signalSlice = calculateEMA(validMacd, sigP);
      const signalLine = new Array(slowP - 1).fill(NaN).concat(signalSlice);

      const n = candles.length;
      const longEntry = new Array(n).fill(false);
      const longExit = new Array(n).fill(false);
      const shortEntry = new Array(n).fill(false);
      const shortExit = new Array(n).fill(false);

      for (let i = 1; i < n; i++) {
        const mPrev = macdLine[i - 1];
        const sPrev = signalLine[i - 1];
        const mCurr = macdLine[i];
        const sCurr = signalLine[i];

        if (
          mPrev !== undefined &&
          sPrev !== undefined &&
          mCurr !== undefined &&
          sCurr !== undefined &&
          !isNaN(mPrev) &&
          !isNaN(sPrev) &&
          !isNaN(mCurr) &&
          !isNaN(sCurr)
        ) {
          if (mPrev <= sPrev && mCurr > sCurr) {
            longEntry[i] = true;
            shortExit[i] = true;
          } else if (mPrev >= sPrev && mCurr < sCurr) {
            shortEntry[i] = true;
            longExit[i] = true;
          }
        }
      }
      return { longEntry, longExit, shortEntry, shortExit };
    },
  },

  {
    id: "custom_python",
    name: "Custom OpenAlgo Python Strategy",
    description: "Write and execute arbitrary Python backtesting code directly with OpenAlgo signal format. Modify the script below and test immediately.",
    category: "Custom",
    parameters: [
      { id: "fastLength", name: "Fast Length", type: "number", default: 10, min: 2, max: 100, step: 1 },
      { id: "slowLength", name: "Slow Length", type: "number", default: 30, min: 5, max: 200, step: 1 },
    ],
    defaultParams: { fastLength: 10, slowLength: 30 },
    generateSignals: (candles, params) => {
      // Fallback JS evaluator for the custom template
      const fastP = Number(params.fastLength ?? 10);
      const slowP = Number(params.slowLength ?? 30);
      const closes = candles.map((c) => c.close);
      const fastSma = calculateSMA(closes, fastP);
      const slowSma = calculateSMA(closes, slowP);

      const n = candles.length;
      const longEntry = new Array(n).fill(false);
      const longExit = new Array(n).fill(false);
      const shortEntry = new Array(n).fill(false);
      const shortExit = new Array(n).fill(false);

      for (let i = 1; i < n; i++) {
        const currFast = fastSma[i];
        const currSlow = slowSma[i];
        const prevFast = fastSma[i - 1];
        const prevSlow = slowSma[i - 1];

        if (
          currFast !== undefined &&
          currSlow !== undefined &&
          prevFast !== undefined &&
          prevSlow !== undefined &&
          !isNaN(currFast) &&
          !isNaN(currSlow) &&
          !isNaN(prevFast) &&
          !isNaN(prevSlow)
        ) {
          if (prevFast <= prevSlow && currFast > currSlow) {
            longEntry[i] = true;
            shortExit[i] = true;
          } else if (prevFast >= prevSlow && currFast < currSlow) {
            shortEntry[i] = true;
            longExit[i] = true;
          }
        }
      }
      return { longEntry, longExit, shortEntry, shortExit };
    },
    pythonScript: `# OpenAlgo Custom Strategy Script
# Receives 'candles' array with OHLCV data.
# Expected output dict with boolean arrays: long_entry, long_exit, short_entry, short_exit

def signals(candles):
    closes = [c['close'] for c in candles]
    n = len(closes)
    
    # 10 / 30 Moving Average crossover
    fast_period = 10
    slow_period = 30
    
    fast_ma = [sum(closes[max(0, i-fast_period+1):i+1]) / min(i+1, fast_period) for i in range(n)]
    slow_ma = [sum(closes[max(0, i-slow_period+1):i+1]) / min(i+1, slow_period) for i in range(n)]
    
    long_entry = [False] * n
    long_exit = [False] * n
    short_entry = [False] * n
    short_exit = [False] * n
    
    for i in range(1, n):
        if fast_ma[i-1] <= slow_ma[i-1] and fast_ma[i] > slow_ma[i]:
            long_entry[i] = True
            shortExit[i] = True
        elif fast_ma[i-1] >= slow_ma[i-1] and fast_ma[i] < slow_ma[i]:
            short_entry[i] = True
            long_exit[i] = True
            
    return {
        "long_entry": long_entry,
        "long_exit": long_exit,
        "short_entry": short_entry,
        "short_exit": short_exit
    }
`,
  },
];
