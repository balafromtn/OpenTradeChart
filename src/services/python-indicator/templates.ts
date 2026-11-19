import type { PythonScriptTemplate } from "./types.ts";

export const PYTHON_TEMPLATES: PythonScriptTemplate[] = [
  {
    id: "sma_cross",
    name: "Dual Moving Average Cross (SMA 20 & 50)",
    description: "Plots Fast (20) and Slow (50) Simple Moving Averages over the price chart",
    pane: "overlay",
    script: `# Dual Moving Average Cross (SMA 20 & SMA 50)
# Available inputs: candles, opens, highs, lows, closes, volumes, times

def calculate_sma(series, period):
    result = []
    for i in range(len(series)):
        if i >= period - 1:
            avg = sum(series[i - period + 1 : i + 1]) / period
            result.append({"time": times[i], "value": round(avg, 4)})
    return result

sma_fast = calculate_sma(closes, 20)
sma_slow = calculate_sma(closes, 50)

print(f"Calculated SMA20 ({len(sma_fast)} points) and SMA50 ({len(sma_slow)} points)")

output = {
    "plots": [
        {
            "name": "SMA Fast (20)",
            "type": "line",
            "color": "#f0b90b",
            "lineWidth": 2,
            "pane": "overlay",
            "data": sma_fast
        },
        {
            "name": "SMA Slow (50)",
            "type": "line",
            "color": "#3b82f6",
            "lineWidth": 2,
            "pane": "overlay",
            "data": sma_slow
        }
    ]
}
`,
  },
  {
    id: "bollinger_bands",
    name: "Bollinger Bands (20, 2.0)",
    description: "Volatility envelope with Upper, Middle, and Lower bands",
    pane: "overlay",
    script: `import math

# Bollinger Bands Calculation (20-period, 2.0 Standard Deviations)
period = 20
mult = 2.0

upper_band, middle_band, lower_band = [], [], []

for i in range(len(closes)):
    if i >= period - 1:
        window = closes[i - period + 1 : i + 1]
        mean = sum(window) / period
        variance = sum((x - mean) ** 2 for x in window) / period
        std_dev = math.sqrt(variance)
        t = times[i]
        
        middle_band.append({"time": t, "value": round(mean, 2)})
        upper_band.append({"time": t, "value": round(mean + mult * std_dev, 2)})
        lower_band.append({"time": t, "value": round(mean - mult * std_dev, 2)})

print(f"Bollinger Bands computed across {len(middle_band)} bars.")

output = {
    "plots": [
        {
            "name": "Upper Band",
            "type": "line",
            "color": "#0ecb81",
            "lineWidth": 1,
            "lineStyle": "dashed",
            "pane": "overlay",
            "data": upper_band
        },
        {
            "name": "Basis (SMA 20)",
            "type": "line",
            "color": "#eab308",
            "lineWidth": 2,
            "lineStyle": "solid",
            "pane": "overlay",
            "data": middle_band
        },
        {
            "name": "Lower Band",
            "type": "line",
            "color": "#f6465d",
            "lineWidth": 1,
            "lineStyle": "dashed",
            "pane": "overlay",
            "data": lower_band
        }
    ]
}
`,
  },
  {
    id: "rsi_oscillator",
    name: "Custom RSI Oscillator with Overbought/Oversold",
    description: "Relative Strength Index in separate pane below with 70/30 reference levels",
    pane: "below",
    script: `# Custom Relative Strength Index (RSI 14)
period = 14
gains, losses = [], []

for i in range(1, len(closes)):
    diff = closes[i] - closes[i - 1]
    gains.append(max(0, diff))
    losses.append(max(0, -diff))

rsi_points = []
if len(gains) >= period:
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = max(0, diff)
        loss = max(0, -diff)
        
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        
        rs = avg_gain / avg_loss if avg_loss != 0 else 100.0
        val = 100.0 - (100.0 / (1.0 + rs))
        rsi_points.append({"time": times[i], "value": round(val, 2)})

ref_70 = [{"time": p["time"], "value": 70} for p in rsi_points]
ref_30 = [{"time": p["time"], "value": 30} for p in rsi_points]

print(f"RSI computed: {len(rsi_points)} bars. Latest RSI: {rsi_points[-1]['value'] if rsi_points else 'N/A'}")

output = {
    "plots": [
        {
            "name": "RSI (14)",
            "type": "line",
            "color": "#a855f7",
            "lineWidth": 2,
            "pane": "below",
            "data": rsi_points
        },
        {
            "name": "Overbought (70)",
            "type": "line",
            "color": "#f6465d",
            "lineWidth": 1,
            "lineStyle": "dashed",
            "pane": "below",
            "data": ref_70
        },
        {
            "name": "Oversold (30)",
            "type": "line",
            "color": "#0ecb81",
            "lineWidth": 1,
            "lineStyle": "dashed",
            "pane": "below",
            "data": ref_30
        }
    ]
}
`,
  },
  {
    id: "macd_histogram",
    name: "MACD with Color-Coded Histogram",
    description: "Moving Average Convergence Divergence with green/red histogram bars in sub-pane",
    pane: "below",
    script: `# MACD (12, 26, 9) with Momentum Histogram
def calculate_ema(series, period):
    k = 2.0 / (period + 1)
    ema_vals = [series[0]]
    for val in series[1:]:
        ema_vals.append(val * k + ema_vals[-1] * (1.0 - k))
    return ema_vals

ema12 = calculate_ema(closes, 12)
ema26 = calculate_ema(closes, 26)

macd_line = [round(e12 - e26, 4) for e12, e26 in zip(ema12, ema26)]
signal_line = calculate_ema(macd_line, 9)

macd_data = []
signal_data = []
hist_data = []

for i in range(26, len(closes)):
    t = times[i]
    m_val = macd_line[i]
    s_val = signal_line[i]
    h_val = round(m_val - s_val, 4)
    
    macd_data.append({"time": t, "value": m_val})
    signal_data.append({"time": t, "value": s_val})
    hist_data.append({
        "time": t,
        "value": h_val,
        "color": "#0ecb81" if h_val >= 0 else "#f6465d"
    })

print(f"MACD generated {len(hist_data)} bars")

output = {
    "plots": [
        {
            "name": "MACD Line",
            "type": "line",
            "color": "#38bdf8",
            "lineWidth": 2,
            "pane": "below",
            "data": macd_data
        },
        {
            "name": "Signal Line",
            "type": "line",
            "color": "#f97316",
            "lineWidth": 1.5,
            "pane": "below",
            "data": signal_data
        },
        {
            "name": "Histogram",
            "type": "histogram",
            "pane": "below",
            "data": hist_data
        }
    ]
}
`,
  },
  {
    id: "donchian_channels",
    name: "Donchian Channels (20-period)",
    description: "Turtle trading channels plotting Highest High and Lowest Low over 20 bars",
    pane: "overlay",
    script: `# Donchian Channels (20-period)
period = 20
upper_channel, lower_channel, median_channel = [], [], []

for i in range(len(candles)):
    if i >= period - 1:
        window_highs = highs[i - period + 1 : i + 1]
        window_lows = lows[i - period + 1 : i + 1]
        
        hh = max(window_highs)
        ll = min(window_lows)
        mid = (hh + ll) / 2.0
        t = times[i]
        
        upper_channel.append({"time": t, "value": round(hh, 2)})
        lower_channel.append({"time": t, "value": round(ll, 2)})
        median_channel.append({"time": t, "value": round(mid, 2)})

output = {
    "plots": [
        {
            "name": "Donchian High (20)",
            "type": "line",
            "color": "#06b6d4",
            "lineWidth": 2,
            "pane": "overlay",
            "data": upper_channel
        },
        {
            "name": "Donchian Mid (20)",
            "type": "line",
            "color": "#64748b",
            "lineWidth": 1,
            "lineStyle": "dotted",
            "pane": "overlay",
            "data": median_channel
        },
        {
            "name": "Donchian Low (20)",
            "type": "line",
            "color": "#ec4899",
            "lineWidth": 2,
            "pane": "overlay",
            "data": lower_channel
        }
    ]
}
`,
  },
  {
    id: "momentum_oscillator",
    name: "Price Momentum Oscillator (PMO)",
    description: "Percentage price momentum oscillator with zero centerline",
    pane: "below",
    script: `# Momentum Oscillator (% Change over N bars)
period = 12
mom_data = []

for i in range(period, len(closes)):
    prev = closes[i - period]
    curr = closes[i]
    pct_change = ((curr - prev) / prev) * 100.0 if prev > 0 else 0
    mom_data.append({"time": times[i], "value": round(pct_change, 2)})

zero_line = [{"time": p["time"], "value": 0} for p in mom_data]

output = {
    "plots": [
        {
            "name": "Momentum %",
            "type": "line",
            "color": "#10b981",
            "lineWidth": 2,
            "pane": "below",
            "data": mom_data
        },
        {
            "name": "Zero Baseline",
            "type": "line",
            "color": "#64748b",
            "lineWidth": 1,
            "lineStyle": "dashed",
            "pane": "below",
            "data": zero_line
        }
    ]
}
`,
  },
];
