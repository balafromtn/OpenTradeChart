import type { Candle, CandleRequest, MarketEvent, OpenTradeChartAdapter, Symbol } from "./types.ts";

// Map OpenTradeChart interval strings to your Python backend seconds
const TF_MAP: Record<string, number> = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export const pythonAdapter: OpenTradeChartAdapter = {
  name: "local-python",

  marketData: {
    async getSymbols(): Promise<Symbol[]> {
      return [
        {
          id: "xauusd",
          name: "XAUUSD",
          displayName: "Gold / US Dollar",
          category: "COMMODITY",
          contractSize: 1,
          tickSize: 0.01,
          tickValue: 0.01,
          marginPercent: 1,
          maxLeverage: 100,
          commission: 0,
          swapLong: 0,
          swapShort: 0,
          tradingHoursStart: null,
          tradingHoursEnd: null,
          isActive: true,
        },
      ];
    },

    async getCandles(request: CandleRequest): Promise<Candle[]> {
      const tf = TF_MAP[request.timeframe] || 60;
      const endMs = request.toMs ?? Date.now();
      const limit = request.limit ?? 3000;

      try {
        const res = await fetch(`http://127.0.0.1:8765/candles?tf=${tf}&end=${endMs}&n=${limit}`);
        if (!res.ok) throw new Error("Failed to fetch from Python");
        const data = await res.json();

        return data.map((d: any[]) => ({
          time: Math.floor(d[0] / 1000),
          open: Number(d[1]),
          high: Number(d[2]),
          low: Number(d[3]),
          close: Number(d[4]),
          volume: Number(d[5] || 0),
        }));
      } catch (err) {
        console.error("Python Adapter Error:", err);
        return [];
      }
    },

    subscribe(_handler: (event: MarketEvent) => void) {
      return () => {};
    },
  },

  storage: {
    get(key: string) {
      return localStorage.getItem(`oc_py_${key}`);
    },
    set(key: string, value: string) {
      localStorage.setItem(`oc_py_${key}`, value);
    },
    remove(key: string) {
      localStorage.removeItem(`oc_py_${key}`);
    },
  },
};
