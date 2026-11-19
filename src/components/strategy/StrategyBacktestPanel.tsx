import { useState, useMemo } from "react";
import {
  Play,
  RotateCcw,
  Sliders,
  Code2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import type { Candle } from "../../services/schemas.ts";
import { useStrategyStore } from "../../services/strategy/store.ts";
import { EquityCurveChart } from "./EquityCurveChart.tsx";
import { cn } from "../../lib/utils.ts";
import { Button } from "../ui/button.tsx";

interface StrategyBacktestPanelProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  onOpenPythonDialog?: () => void;
}

export function StrategyBacktestPanel({
  candles,
  symbol,
  timeframe,
}: StrategyBacktestPanelProps) {
  const {
    strategies,
    selectedStrategyId,
    strategyParams,
    settings,
    outcome,
    isRunning,
    error,
    showChartMarkers,
    customScript,
    selectStrategy,
    updateParam,
    updateSettings,
    setCustomScript,
    toggleChartMarkers,
    runBacktest,
    clearOutcome,
  } = useStrategyStore();

  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "settings" | "code">("overview");
  const [showSettingsAccordion, setShowSettingsAccordion] = useState(false);
  const [tradeFilter, setTradeFilter] = useState<"all" | "wins" | "losses">("all");

  const activeStrategy = useMemo(
    () => strategies.find((s) => s.id === selectedStrategyId) || strategies[0]!,
    [strategies, selectedStrategyId],
  );

  const currentParams = strategyParams[activeStrategy.id] ?? activeStrategy.defaultParams;

  const handleRun = async () => {
    if (!candles || candles.length === 0) return;
    await runBacktest(candles, { symbol, timeframe });
  };

  const filteredTrades = useMemo(() => {
    if (!outcome || !outcome.trades) return [];
    if (tradeFilter === "wins") return outcome.trades.filter((t) => t.netPnl > 0);
    if (tradeFilter === "losses") return outcome.trades.filter((t) => t.netPnl <= 0);
    return outcome.trades;
  }, [outcome, tradeFilter]);

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden text-foreground">
      {/* ── Top Header Control Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/40 shrink-0">
        <div className="flex items-center gap-2">
          {/* Strategy Dropdown */}
          <select
            value={selectedStrategyId}
            onChange={(e) => selectStrategy(e.target.value)}
            className="h-8 px-2.5 py-1 text-xs font-semibold rounded bg-card border border-border text-foreground hover:border-primary/60 transition-colors cursor-pointer"
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.category}] {s.name}
              </option>
            ))}
          </select>

          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary">
            {activeStrategy.category}
          </span>

          <button
            type="button"
            onClick={() => setShowSettingsAccordion((prev) => !prev)}
            className={cn(
              "flex items-center gap-1 h-8 px-2.5 text-xs rounded border border-border hover:bg-secondary transition-colors",
              showSettingsAccordion && "bg-secondary text-primary border-primary/50",
            )}
            title="Toggle Strategy & Risk Settings"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Parameters</span>
            {showSettingsAccordion ? (
              <ChevronUp className="w-3 h-3 ml-0.5" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-0.5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Chart Markers */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showChartMarkers}
              onChange={(e) => toggleChartMarkers(e.target.checked)}
              className="rounded border-border text-primary focus:ring-0 h-3.5 w-3.5 accent-primary cursor-pointer"
            />
            <span className="hidden sm:inline">Show on Chart</span>
          </label>

          {/* Clear button */}
          {outcome && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearOutcome}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Clear results"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Run Backtest CTA Button */}
          <Button
            onClick={handleRun}
            disabled={isRunning || !candles || candles.length === 0}
            size="sm"
            className="h-8 px-3.5 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Play className={cn("w-3.5 h-3.5 fill-current", isRunning && "animate-spin")} />
            <span>{isRunning ? "Running Backtest…" : "Run Backtest"}</span>
          </Button>
        </div>
      </div>

      {/* ── Collapsible Parameters Panel ── */}
      {showSettingsAccordion && (
        <div className="p-3 border-b border-border bg-card/90 space-y-3 shrink-0 text-xs animate-in slide-in-from-top-1">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* Strategy specific parameters */}
            {activeStrategy.parameters.map((param) => (
              <div key={param.id} className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                  {param.name}
                </label>
                <input
                  type="number"
                  step={param.step ?? 1}
                  min={param.min}
                  max={param.max}
                  value={currentParams[param.id] ?? param.default}
                  onChange={(e) => updateParam(activeStrategy.id, param.id, parseFloat(e.target.value))}
                  className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono"
                />
              </div>
            ))}

            {/* General Risk Settings */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                Initial Capital ($)
              </label>
              <input
                type="number"
                step={500}
                value={settings.initialCapital}
                onChange={(e) => updateSettings({ initialCapital: parseFloat(e.target.value) || 10000 })}
                className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                Quantity (Lots/Qty)
              </label>
              <input
                type="number"
                step={0.1}
                min={0.01}
                value={settings.quantity}
                onChange={(e) => updateSettings({ quantity: parseFloat(e.target.value) || 1 })}
                className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                Direction
              </label>
              <select
                value={settings.side}
                onChange={(e) => updateSettings({ side: e.target.value as any })}
                className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs"
              >
                <option value="both">Both (Long & Short)</option>
                <option value="long_only">Long Only</option>
                <option value="short_only">Short Only</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                Stop Loss (%)
              </label>
              <input
                type="number"
                step={0.1}
                value={settings.stopLossPct}
                onChange={(e) => updateSettings({ stopLossPct: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                Take Profit (%)
              </label>
              <input
                type="number"
                step={0.1}
                value={settings.takeProfitPct}
                onChange={(e) => updateSettings({ takeProfitPct: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block truncate">
                Trailing Stop (%)
              </label>
              <input
                type="number"
                step={0.1}
                value={settings.trailingStopPct}
                onChange={(e) => updateSettings({ trailingStopPct: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive text-xs border-b border-destructive/20 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-3 py-1 shrink-0 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-3 py-1 rounded font-medium transition-colors",
              activeTab === "overview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={cn(
              "px-3 py-1 rounded font-medium transition-colors flex items-center gap-1",
              activeTab === "trades" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Trades</span>
            {outcome?.summary && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary font-mono">
                {outcome.summary.tradeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "px-3 py-1 rounded font-medium transition-colors",
              activeTab === "settings" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Risk & Settings
          </button>
          {activeStrategy.id === "custom_python" && (
            <button
              onClick={() => setActiveTab("code")}
              className={cn(
                "px-3 py-1 rounded font-medium transition-colors flex items-center gap-1 text-primary",
                activeTab === "code" ? "bg-card text-primary shadow-sm" : "text-primary/70 hover:text-primary",
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Python Code</span>
            </button>
          )}
        </div>

        {outcome && (
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              Tested on <strong className="text-foreground">{outcome.summary.barCount.toLocaleString()}</strong> bars
            </span>
            <span>•</span>
            <span>Execution time: {outcome.summary.ranMs}ms</span>
          </div>
        )}
      </div>

      {/* ── Main Tab Content Area ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Summary KPI Tiles */}
            {outcome?.summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                <div className="p-2.5 bg-card border border-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Net Profit
                  </div>
                  <div
                    className={cn(
                      "text-base font-bold font-mono",
                      outcome.summary.netProfit >= 0 ? "text-emerald-500" : "text-destructive",
                    )}
                  >
                    {outcome.summary.netProfit >= 0 ? "+" : ""}${outcome.summary.netProfit.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {outcome.summary.netProfitPct >= 0 ? "+" : ""}
                    {outcome.summary.netProfitPct}% of capital
                  </div>
                </div>

                <div className="p-2.5 bg-card border border-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Win Rate
                  </div>
                  <div className="text-base font-bold font-mono text-foreground">
                    {outcome.summary.winRate}%
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {outcome.summary.winCount}W / {outcome.summary.lossCount}L ({outcome.summary.tradeCount} trades)
                  </div>
                </div>

                <div className="p-2.5 bg-card border border-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Profit Factor
                  </div>
                  <div className="text-base font-bold font-mono text-foreground">
                    {outcome.summary.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Expectancy: ${outcome.summary.expectancy.toFixed(2)}/trade
                  </div>
                </div>

                <div className="p-2.5 bg-card border border-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Max Drawdown
                  </div>
                  <div className="text-base font-bold font-mono text-destructive">
                    -{outcome.summary.maxDrawdownPct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    -${outcome.summary.maxDrawdown.toLocaleString()}
                  </div>
                </div>

                <div className="p-2.5 bg-card border border-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Avg Win / Loss
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    +${outcome.summary.averageWin.toFixed(1)} / -${outcome.summary.averageLoss.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Ratio: {outcome.summary.winLossRatio.toFixed(2)}
                  </div>
                </div>

                <div className="p-2.5 bg-card border border-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Charges & Slippage
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    ${outcome.summary.chargesPaid.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Buy & Hold: {outcome.summary.buyAndHoldReturnPct >= 0 ? "+" : ""}
                    {outcome.summary.buyAndHoldReturnPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-lg space-y-2">
                <Play className="w-8 h-8 mx-auto text-emerald-500/80" />
                <h4 className="font-semibold text-sm">Ready to Backtest {activeStrategy.name}</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Click the <strong>&ldquo;Run Backtest&rdquo;</strong> button above to evaluate this strategy over{" "}
                  {candles.length.toLocaleString()} bars of {symbol} on the {timeframe} timeframe.
                </p>
              </div>
            )}

            {/* Interactive Equity Curve */}
            {outcome && outcome.equity && outcome.equity.length > 0 && (
              <EquityCurveChart
                points={outcome.equity}
                initialCapital={settings.initialCapital}
                height={170}
              />
            )}
          </div>
        )}

        {/* ── Trades Tab ── */}
        {activeTab === "trades" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTradeFilter("all")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] border border-border",
                    tradeFilter === "all" ? "bg-primary text-primary-foreground font-semibold" : "bg-card text-muted-foreground",
                  )}
                >
                  All ({outcome?.trades.length ?? 0})
                </button>
                <button
                  onClick={() => setTradeFilter("wins")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] border border-border",
                    tradeFilter === "wins" ? "bg-emerald-600 text-white font-semibold" : "bg-card text-muted-foreground",
                  )}
                >
                  Wins ({outcome?.trades.filter((t) => t.netPnl > 0).length ?? 0})
                </button>
                <button
                  onClick={() => setTradeFilter("losses")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] border border-border",
                    tradeFilter === "losses" ? "bg-destructive text-destructive-foreground font-semibold" : "bg-card text-muted-foreground",
                  )}
                >
                  Losses ({outcome?.trades.filter((t) => t.netPnl <= 0).length ?? 0})
                </button>
              </div>

              {outcome && (
                <button
                  type="button"
                  onClick={() => {
                    const csvContent =
                      "data:text/csv;charset=utf-8," +
                      [
                        "ID,Side,Quantity,EntryTime,EntryPrice,ExitTime,ExitPrice,GrossPnL,Charges,NetPnL,NetPnLPct,Reason,HoldingBars",
                        ...outcome.trades.map(
                          (t) =>
                            `${t.id},${t.side},${t.quantity},${new Date(t.entryTime * 1000).toISOString()},${t.entryPrice},${new Date(t.exitTime * 1000).toISOString()},${t.exitPrice},${t.grossPnl},${t.charges},${t.netPnl},${t.netPnlPct}%,${t.reason},${t.holdingBars}`,
                        ),
                      ].join("\n");
                    const encoded = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encoded);
                    link.setAttribute("download", `${symbol}_${activeStrategy.id}_trades.csv`);
                    link.click();
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <Download className="w-3 h-3" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>

            {filteredTrades.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded">
                No trades match the selected filter.
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-secondary/60 text-[10px] uppercase font-semibold text-muted-foreground sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">Side</th>
                      <th className="py-2 px-2.5">Entry Date & Time</th>
                      <th className="py-2 px-2.5 text-right">Entry Price</th>
                      <th className="py-2 px-2.5">Exit Date & Time</th>
                      <th className="py-2 px-2.5 text-right">Exit Price</th>
                      <th className="py-2 px-2.5 text-right">Net P&L</th>
                      <th className="py-2 px-2.5 text-right">Return %</th>
                      <th className="py-2 px-2.5">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                    {filteredTrades.map((trade) => {
                      const isWin = trade.netPnl > 0;
                      return (
                        <tr key={trade.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-1.5 px-2.5 text-muted-foreground">{trade.id}</td>
                          <td className="py-1.5 px-2.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                                trade.side === "long"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-rose-500/10 text-rose-500",
                              )}
                            >
                              {trade.side}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-muted-foreground font-sans text-xs">
                            {new Date(trade.entryTime * 1000).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">${trade.entryPrice.toFixed(2)}</td>
                          <td className="py-1.5 px-2.5 text-muted-foreground font-sans text-xs">
                            {new Date(trade.exitTime * 1000).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">${trade.exitPrice.toFixed(2)}</td>
                          <td
                            className={cn(
                              "py-1.5 px-2.5 text-right font-bold",
                              isWin ? "text-emerald-500" : "text-destructive",
                            )}
                          >
                            {isWin ? "+" : ""}${trade.netPnl.toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              "py-1.5 px-2.5 text-right font-semibold",
                              isWin ? "text-emerald-500" : "text-destructive",
                            )}
                          >
                            {isWin ? "+" : ""}
                            {trade.netPnlPct.toFixed(2)}%
                          </td>
                          <td className="py-1.5 px-2.5 font-sans">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px]",
                                trade.reason === "Take Profit" && "bg-emerald-500/10 text-emerald-500 font-semibold",
                                trade.reason === "Stop Loss" && "bg-destructive/10 text-destructive font-semibold",
                                trade.reason === "Trailing Stop" && "bg-amber-500/10 text-amber-500 font-semibold",
                                (trade.reason === "Exit Signal" || trade.reason === "Reversal") && "text-muted-foreground",
                              )}
                            >
                              {trade.reason}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-4">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Risk, Capital & Brokerage Settings</h4>
              <p className="text-xs text-muted-foreground">
                Configures backtesting capital, fees, slippage and execution constraints according to OpenAlgo models.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-secondary/20 border border-border rounded-lg space-y-3">
                <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                  Position & Capital
                </h5>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Initial Capital ($)</label>
                  <input
                    type="number"
                    value={settings.initialCapital}
                    onChange={(e) => updateSettings({ initialCapital: parseFloat(e.target.value) || 10000 })}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Quantity (Contracts / Lots)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={settings.quantity}
                    onChange={(e) => updateSettings({ quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Trade Side Allowed</label>
                  <select
                    value={settings.side}
                    onChange={(e) => updateSettings({ side: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs"
                  >
                    <option value="both">Both (Long & Short)</option>
                    <option value="long_only">Long Only</option>
                    <option value="short_only">Short Only</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-secondary/20 border border-border rounded-lg space-y-3">
                <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                  Stops & Profit Targets
                </h5>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Stop Loss (%)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={settings.stopLossPct}
                    onChange={(e) => updateSettings({ stopLossPct: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Take Profit (%)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={settings.takeProfitPct}
                    onChange={(e) => updateSettings({ takeProfitPct: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Trailing Stop Loss (%)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={settings.trailingStopPct}
                    onChange={(e) => updateSettings({ trailingStopPct: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-secondary/20 border border-border rounded-lg space-y-3 sm:col-span-2">
                <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                  Friction & Transaction Costs
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Slippage (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      value={settings.slippagePct}
                      onChange={(e) => updateSettings({ slippagePct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Flat Brokerage ($ per order)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={settings.brokeragePerOrder}
                      onChange={(e) => updateSettings({ brokeragePerOrder: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Turnover / Tax (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      value={settings.turnoverCostPct}
                      onChange={(e) => updateSettings({ turnoverCostPct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Python Code Tab ── */}
        {activeTab === "code" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Write OpenAlgo-compliant Python signal logic. Input: <code className="text-primary font-mono">candles</code> list.
                Returns dict with boolean arrays: <code className="text-primary font-mono">long_entry</code>, <code className="text-primary font-mono">long_exit</code>, <code className="text-primary font-mono">short_entry</code>, <code className="text-primary font-mono">short_exit</code>.
              </span>
            </div>

            <textarea
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs p-3 rounded-lg bg-secondary/30 border border-border focus:border-primary/60 outline-none leading-relaxed text-foreground"
              placeholder="# Write your Python strategy here..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
