/**
 * Public entry point for embedding OpenTradeChart.
 *
 * Implement `OpenTradeChartAdapter`, hand it to `<OpenTradeChartProvider>`, and the
 * terminal runs against your backend — no fork, no patched files.
 */
export { OpenTradeChartProvider, OpenChartsProvider } from "./provider.tsx";
export {
  getAdapter,
  hasAdapter,
  onAdapterChange,
  setAdapter,
} from "./registry.ts";
export type {
  Account,
  CandleRequest,
  Candle,
  ClosedPosition,
  ConnectionState,
  MarketDataSource,
  MarketEvent,
  OpenTradeChartAdapter,
  OpenChartsAdapter,
  Order,
  OrderModification,
  Page,
  PlaceOrderInput,
  Position,
  PositionModification,
  Quote,
  StorageDriver,
  Symbol,
  TradingEvent,
  TradingGateway,
  Unsubscribe,
} from "./types.ts";
