/**
 * OpenTradeChart — an embeddable trading terminal.
 *
 * ```tsx
 * import { OpenTradeChartProvider, Terminal } from "@dylanpersonguy/opentradechart";
 * import { createDemoAdapter } from "@dylanpersonguy/opentradechart/demo";
 * import "@dylanpersonguy/opentradechart/style.css";
 *
 * <OpenTradeChartProvider adapter={createDemoAdapter()}>
 *   <Terminal />
 * </OpenTradeChartProvider>;
 * ```
 *
 * Point it at your own backend by implementing `OpenTradeChartAdapter`, and compose
 * your own layout from the individual panels. Neither requires forking.
 */
export * from "./adapter/index.ts";
export * from "./terminal/index.ts";
export type { OpenTradeChartProviderProps, OpenChartsProviderProps } from "./adapter/provider.tsx";
export { onNotification, type Notification } from "./notifications.ts";
export type { Candle, Order, Position, Symbol, PlaceOrderInput } from "./services/schemas.ts";
export { usePythonIndicatorStore } from "./services/python-indicator/store.ts";
export { executePythonIndicator } from "./services/python-indicator/runner.ts";
export { PythonIndicatorDialog } from "./components/PythonIndicatorDialog.tsx";
export { PYTHON_TEMPLATES } from "./services/python-indicator/templates.ts";
export type {
  PythonPlotConfig,
  PythonPlotPoint,
  PythonIndicatorResult,
  PythonScriptTemplate,
} from "./services/python-indicator/types.ts";

export { useStrategyStore } from "./services/strategy/store.ts";
export { BUILTIN_STRATEGIES } from "./services/strategy/builtinStrategies.ts";
export { runBacktestSimulation } from "./services/strategy/engine.ts";
export { executeBacktest } from "./services/strategy/runner.ts";
export { StrategyBacktestPanel } from "./components/strategy/StrategyBacktestPanel.tsx";
export type {
  StrategyDefinition,
  StrategyParameter,
  BacktestSettings,
  BacktestTrade,
  BacktestEquityPoint,
  BacktestSummary,
  BacktestOutcome,
} from "./services/strategy/types.ts";

// Types only: the Hyperliquid broker itself is not part of the core entry so
// the package does not pull wallet and exchange dependencies into every host.
// Use `createHyperliquidAdapter` from src/hyperliquid/adapter.ts when building the app.
export type { HyperliquidAdapter, HyperliquidAdapterOptions } from "./hyperliquid/adapter.ts";
