import { create } from "zustand";
import type { Candle } from "../schemas.ts";
import type {
  StrategyDefinition,
  BacktestSettings,
  BacktestOutcome,
} from "./types.ts";
import { BUILTIN_STRATEGIES } from "./builtinStrategies.ts";
import { executeBacktest } from "./runner.ts";

const DEFAULT_SETTINGS: BacktestSettings = {
  initialCapital: 10000,
  quantity: 1,
  side: "both",
  stopLossPct: 1.5,
  takeProfitPct: 3.0,
  trailingStopPct: 0.5,
  slippagePct: 0.02,
  brokeragePerOrder: 1.0,
  turnoverCostPct: 0.02,
};

interface StrategyState {
  strategies: StrategyDefinition[];
  selectedStrategyId: string;
  strategyParams: Record<string, Record<string, any>>;
  settings: BacktestSettings;
  outcome: BacktestOutcome | null;
  isRunning: boolean;
  error: string | null;
  showChartMarkers: boolean;
  customScript: string;

  // Actions
  selectStrategy: (id: string) => void;
  updateParam: (strategyId: string, paramId: string, value: any) => void;
  updateSettings: (partial: Partial<BacktestSettings>) => void;
  setCustomScript: (script: string) => void;
  toggleChartMarkers: (show?: boolean) => void;
  runBacktest: (
    candles: Candle[],
    meta: { symbol: string; timeframe: string },
  ) => Promise<BacktestOutcome | null>;
  clearOutcome: () => void;
}

export const useStrategyStore = create<StrategyState>((set, get) => {
  // Initialize default params for all builtins
  const initialParams: Record<string, Record<string, any>> = {};
  for (const s of BUILTIN_STRATEGIES) {
    initialParams[s.id] = { ...s.defaultParams };
  }

  const customStrat = BUILTIN_STRATEGIES.find((s) => s.id === "custom_python");
  const initialScript = customStrat?.pythonScript ?? "";

  return {
    strategies: BUILTIN_STRATEGIES,
    selectedStrategyId: "ema_crossover",
    strategyParams: initialParams,
    settings: DEFAULT_SETTINGS,
    outcome: null,
    isRunning: false,
    error: null,
    showChartMarkers: true,
    customScript: initialScript,

    selectStrategy: (id: string) => {
      set({ selectedStrategyId: id, error: null });
    },

    updateParam: (strategyId: string, paramId: string, value: any) => {
      set((state) => ({
        strategyParams: {
          ...state.strategyParams,
          [strategyId]: {
            ...state.strategyParams[strategyId],
            [paramId]: value,
          },
        },
      }));
    },

    updateSettings: (partial: Partial<BacktestSettings>) => {
      set((state) => ({
        settings: { ...state.settings, ...partial },
      }));
    },

    setCustomScript: (script: string) => {
      set({ customScript: script });
    },

    toggleChartMarkers: (show?: boolean) => {
      set((state) => ({
        showChartMarkers: show !== undefined ? show : !state.showChartMarkers,
      }));
    },

    runBacktest: async (candles: Candle[], meta: { symbol: string; timeframe: string }) => {
      const state = get();
      const strategy = state.strategies.find((s) => s.id === state.selectedStrategyId);

      if (!strategy) {
        set({ error: "Strategy not found" });
        return null;
      }

      const params = state.strategyParams[strategy.id] ?? strategy.defaultParams;
      set({ isRunning: true, error: null });

      try {
        // If custom strategy, attach the updated script
        const stratToRun =
          strategy.id === "custom_python"
            ? { ...strategy, pythonScript: state.customScript }
            : strategy;

        const outcome = await executeBacktest(stratToRun, params, state.settings, candles, meta);
        set({ outcome, isRunning: false, error: outcome.error ?? null });
        return outcome;
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        set({ isRunning: false, error: errorMsg });
        return null;
      }
    },

    clearOutcome: () => {
      set({ outcome: null, error: null });
    },
  };
});
