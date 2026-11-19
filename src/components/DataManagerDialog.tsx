import { useState, useEffect, useRef } from "react";
import {
  Database,
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  BarChart2,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Download,
} from "lucide-react";
import { Button } from "./ui/button.tsx";
import { parseCsvText } from "../services/data-manager/parser.ts";
import {
  getCustomSymbols,
  getCustomCandles,
  saveCustomDataset,
} from "../services/data-manager/storage.ts";
import {
  refreshCustomSymbols,
  removeCustomSymbol,
} from "../services/data-manager/registry.ts";
import type { CustomSymbolMetadata, ParseResult } from "../services/data-manager/types.ts";
import { DEMO_SYMBOLS } from "../services/demo/instruments.ts";
import { cn } from "../lib/utils.ts";

interface DataManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectSymbol?: (symbol: string) => void;
  currentSymbol?: string;
}

export function DataManagerDialog({
  open,
  onClose,
  onSelectSymbol,
  currentSymbol,
}: DataManagerDialogProps) {
  const [activeTab, setActiveTab] = useState<"import" | "manage">("import");
  const [customSymbols, setCustomSymbols] = useState<CustomSymbolMetadata[]>([]);

  // Import form state
  const [files, setFiles] = useState<File[]>([]);
  const [symbolName, setSymbolName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("COMMODITY");
  const [tickSize, setTickSize] = useState("0.01");
  const [filterWeekends, setFilterWeekends] = useState(true);
  const [filterDeadBars, setFilterDeadBars] = useState(true);
  const [maxBars, setMaxBars] = useState("2000");

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadList = async () => {
    try {
      const list = await getCustomSymbols();
      setCustomSymbols(list);
    } catch (err) {
      console.warn("Failed to load custom symbols:", err);
    }
  };

  useEffect(() => {
    if (open) {
      void loadList();
    }
  }, [open]);

  // Auto-detect symbol name when file is selected
  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const fileArray = Array.from(selectedFiles);
    setFiles(fileArray);
    setParseResult(null);
    setParseError(null);

    // Try inferring symbol name from the first file name
    const first = fileArray[0];
    if (first) {
      const firstName = first.name.replace(/\.[^/.]+$/, "");
      // Extract leading letters e.g. "xauusd_2026" -> "XAUUSD"
      const match = firstName.match(/^([a-zA-Z]{3,8})/);
      if (match && match[1] && !symbolName) {
        const inferred = match[1].toUpperCase();
        setSymbolName(inferred);
        if (inferred.includes("XAU") || inferred.includes("GOLD")) {
          setDisplayName("Gold");
          setCategory("COMMODITY");
          setTickSize("0.01");
        } else if (inferred.includes("EUR") || inferred.includes("GBP") || inferred.includes("USD")) {
          setDisplayName(inferred);
          setCategory("FOREX");
          setTickSize("0.0001");
        } else if (inferred.includes("BTC") || inferred.includes("ETH")) {
          setDisplayName(inferred);
          setCategory("CRYPTO");
          setTickSize("0.01");
        }
      }
    }
  };

  const handleProcessCsv = async () => {
    if (files.length === 0) {
      setParseError("Please select at least one CSV file.");
      return;
    }
    if (!symbolName.trim()) {
      setParseError("Please specify a Symbol name (e.g. XAUUSD).");
      return;
    }

    setParsing(true);
    setParseError(null);

    try {
      // Read all selected files and concatenate text
      let combinedCsv = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const text = await file.text();
        if (i === 0) {
          combinedCsv = text;
        } else {
          // Skip header row on subsequent files
          const lines = text.split(/\r?\n/);
          if (lines.length > 1) {
            combinedCsv += "\n" + lines.slice(1).join("\n");
          }
        }
      }

      const parsed = parseCsvText(combinedCsv, {
        symbolName: symbolName.trim().toUpperCase(),
        displayName: displayName.trim() || symbolName.trim().toUpperCase(),
        category,
        tickSize: parseFloat(tickSize) || 0.01,
        filterWeekends,
        filterDeadBars,
        maxBarsPerTimeframe: parseInt(maxBars, 10) || 2000,
      });

      setParseResult(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(message);
    } finally {
      setParsing(false);
    }
  };

  const handleSaveAndChart = async () => {
    if (!parseResult) return;
    setSaving(true);
    try {
      await saveCustomDataset(parseResult.metadata, parseResult.series, parseResult.rawCsv);
      await refreshCustomSymbols();
      await loadList();

      // If callback provided, switch to the newly imported symbol!
      if (onSelectSymbol) {
        onSelectSymbol(parseResult.metadata.symbol);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(`Failed to save dataset: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sym: string) => {
    if (!confirm(`Are you sure you want to delete custom data for "${sym}"?`)) return;
    try {
      await removeCustomSymbol(sym);
      await loadList();
      // If currently selected, revert to default
      if (currentSymbol === sym && onSelectSymbol) {
        onSelectSymbol("BTCUSD");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Custom Data Manager</h2>
              <p className="text-xs text-muted-foreground">
                Import CSV files, clean & resample multi-timeframe candles, and chart instantly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-border bg-card">
          <button
            onClick={() => setActiveTab("import")}
            className={cn(
              "flex items-center gap-2 py-2 px-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "import"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV Data</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("manage");
              void loadList();
            }}
            className={cn(
              "flex items-center gap-2 py-2 px-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "manage"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers className="w-4 h-4" />
            <span>Manage Stored Data ({customSymbols.length})</span>
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "import" ? (
            <>
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2",
                  files.length > 0
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-secondary/40",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-primary/80" />
                <div>
                  <span className="font-semibold text-sm">
                    {files.length > 0
                      ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                      : "Click to upload or drag & drop CSV files"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports Dukascopy, MT4/MT5, TradingView, Binance, or custom OHLCV CSVs
                  </p>
                </div>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto justify-center">
                    {files.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-xs text-secondary-foreground"
                      >
                        <FileText className="w-3 h-3" />
                        {f.name} ({(f.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Symbol Config Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Symbol Ticker *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. XAUUSD, EURUSD, AAPL"
                    value={symbolName}
                    onChange={(e) => setSymbolName(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-secondary/50 border border-border rounded-md font-mono outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gold Spot, Apple Inc."
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-secondary/50 border border-border rounded-md outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Asset Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-secondary/50 border border-border rounded-md outline-none focus:border-primary"
                  >
                    <option value="COMMODITY">COMMODITY (Gold, Oil, Metals)</option>
                    <option value="FOREX">FOREX (Currencies)</option>
                    <option value="CRYPTO">CRYPTO (Tokens & Pairs)</option>
                    <option value="STOCK">STOCK (Equities)</option>
                    <option value="INDICES">INDICES (Indices & Futures)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">
                    Tick Size ($)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.01"
                    value={tickSize}
                    onChange={(e) => setTickSize(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-sm bg-secondary/50 border border-border rounded-md font-mono outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Data Cleaning Settings */}
              <div className="p-3 bg-secondary/20 border border-border rounded-lg space-y-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Automated Cleaning & Resampling Options
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterWeekends}
                      onChange={(e) => setFilterWeekends(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Filter Saturday offline bars (Forex/Gold)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterDeadBars}
                      onChange={(e) => setFilterDeadBars(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Remove flat zero-volume ticks</span>
                  </label>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-muted-foreground">Max bars retained per timeframe:</span>
                  <select
                    value={maxBars}
                    onChange={(e) => setMaxBars(e.target.value)}
                    className="px-2 py-0.5 rounded bg-card border border-border text-xs"
                  >
                    <option value="1000">1,000 bars (fastest)</option>
                    <option value="2000">2,000 bars (recommended)</option>
                    <option value="5000">5,000 bars (deep history)</option>
                  </select>
                </div>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parse preview */}
              {parseResult && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Dataset Processed & Resampled Successfully
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {parseResult.summary.dateStart} &rarr; {parseResult.summary.dateEnd}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-card rounded border border-border/60">
                      <div className="text-muted-foreground text-[10px] uppercase">Raw Rows</div>
                      <div className="font-semibold text-sm">
                        {parseResult.summary.totalRawRows.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 bg-card rounded border border-border/60">
                      <div className="text-muted-foreground text-[10px] uppercase">Clean Bars</div>
                      <div className="font-semibold text-sm">
                        {parseResult.summary.cleanM1Bars.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 bg-card rounded border border-border/60">
                      <div className="text-muted-foreground text-[10px] uppercase">Symbol</div>
                      <div className="font-semibold text-sm font-mono text-primary">
                        {parseResult.metadata.symbol}
                      </div>
                    </div>
                    <div className="p-2 bg-card rounded border border-border/60">
                      <div className="text-muted-foreground text-[10px] uppercase">Category</div>
                      <div className="font-semibold text-sm">{parseResult.metadata.category}</div>
                    </div>
                  </div>

                  {/* Timeframe counts table */}
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                      Timeframe Candles Ready for Charting:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(parseResult.summary.timeframeCounts).map(([tf, count]) => (
                        <span
                          key={tf}
                          className="px-2 py-0.5 bg-card border border-border rounded text-xs font-mono"
                        >
                          <span className="text-primary font-bold">{tf}</span>: {count} bars
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Manage Stored Data tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Custom datasets are preserved in browser IndexedDB and backed up to workspace disk (<code className="text-[11px] bg-muted px-1 py-0.5 rounded">data/custom/</code>). Data survives app restarts and browser cache clears.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("import")}
                  className="gap-1.5 text-xs h-8"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Import New
                </Button>
              </div>

              {customSymbols.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-lg text-muted-foreground space-y-2">
                  <Database className="w-8 h-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm">No custom imported datasets yet.</p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setActiveTab("import")}
                    className="gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    Import Your First CSV
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {customSymbols.map((item) => (
                    <div
                      key={item.symbol}
                      className={cn(
                        "p-3.5 bg-card border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors",
                        currentSymbol === item.symbol && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base font-mono">{item.symbol}</span>
                          <span className="text-xs text-muted-foreground">{item.displayName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold bg-secondary text-secondary-foreground">
                            {item.category}
                          </span>
                          {currentSymbol === item.symbol && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-medium">
                              Active Chart
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {item.firstDate} &rarr; {item.lastDate}
                          </span>
                          <span>•</span>
                          <span>{item.totalParsedBars.toLocaleString()} bars</span>
                          <span>•</span>
                          <span>Imported {new Date(item.importedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant={currentSymbol === item.symbol ? "secondary" : "default"}
                          size="sm"
                          onClick={() => {
                            if (onSelectSymbol) onSelectSymbol(item.symbol);
                            onClose();
                          }}
                          className="gap-1.5 text-xs h-8"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          {currentSymbol === item.symbol ? "Charted" : "Chart Now"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const candles = await getCustomCandles(item.symbol, "1m");
                              const blob = new Blob(
                                [JSON.stringify({ metadata: item, candles: candles || [] }, null, 2)],
                                { type: "application/json" },
                              );
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${item.symbol}_dataset.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              console.error("Export failed:", err);
                            }
                          }}
                          className="h-8 px-2 text-xs"
                          title="Export Dataset JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(item.symbol)}
                          className="text-destructive hover:bg-destructive/10 h-8 px-2"
                          title="Delete Dataset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Default built-in symbols info */}
              <div className="pt-3 border-t border-border/60">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Built-in Demo Feeds ({DEMO_SYMBOLS.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_SYMBOLS.map((s) => (
                    <span
                      key={s.name}
                      onClick={() => {
                        if (onSelectSymbol) onSelectSymbol(s.name);
                        onClose();
                      }}
                      className={cn(
                        "cursor-pointer px-2 py-1 rounded bg-secondary/60 hover:bg-secondary border border-border text-xs flex items-center gap-1.5 transition-colors",
                        currentSymbol === s.name && "border-primary font-bold text-primary",
                      )}
                    >
                      <span className="font-mono">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{s.category}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {activeTab === "import" && parseResult && (
              <span>Ready to chart {parseResult.metadata.symbol} across 8 timeframes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {activeTab === "import" && (
              <>
                {!parseResult ? (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={files.length === 0 || !symbolName.trim() || parsing}
                    onClick={handleProcessCsv}
                    className="gap-1.5"
                  >
                    {parsing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing & Resampling...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        <span>Parse & Resample</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={saving}
                    onClick={handleSaveAndChart}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {saving ? "Saving..." : "Save & Open on Chart"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
