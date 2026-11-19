import React, { useState, useEffect, useRef } from "react";
import {
  Code2,
  Play,
  RotateCcw,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Terminal,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import { Button } from "./ui/button.tsx";
import { usePythonIndicatorStore } from "../services/python-indicator/store.ts";
import { PYTHON_TEMPLATES } from "../services/python-indicator/templates.ts";
import type { Candle } from "../services/schemas.ts";

interface PythonIndicatorDialogProps {
  open: boolean;
  onClose: () => void;
  candles: Candle[];
}

export function PythonIndicatorDialog({
  open,
  onClose,
  candles,
}: PythonIndicatorDialogProps) {
  const {
    script,
    setScript,
    enabled,
    toggleEnabled,
    selectedTemplateId,
    loadTemplate,
    runScript,
    plots,
    logs,
    status,
    error,
    executionTimeMs,
    runner,
  } = usePythonIndicatorStore();

  const [activeTab, setActiveTab] = useState<"console" | "plots" | "help">("console");
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Synchronize scroll of textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Keyboard shortcut: Tab indents 4 spaces; Ctrl+Enter or Cmd+Enter runs script
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runScript(candles);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + "    " + val.substring(end);
      setScript(updated);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    }
  };

  const lineCount = (script.match(/\n/g) || []).length + 1;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl h-[88vh] bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ── Dialog Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30 select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Python Custom Indicator
                </h2>
                {status === "running" && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                    Executing...
                  </span>
                )}
                {status === "success" && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    {plots.length} {plots.length === 1 ? "plot" : "plots"} ({executionTimeMs}ms)
                  </span>
                )}
                {status === "error" && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                    <AlertCircle className="h-3 w-3" />
                    Failed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Write Python to calculate mathematical indicators and render graphs in real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleEnabled}
              className={`text-xs gap-1.5 h-8 ${
                enabled
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {enabled ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> Showing on Chart
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hidden on Chart
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Action Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-secondary/15 border-b border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[11px] font-medium">Templates:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => loadTemplate(e.target.value)}
              className="h-7 px-2.5 rounded bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PYTHON_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} ({tmpl.pane})
                </option>
              ))}
            </select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadTemplate(selectedTemplateId)}
              title="Reset code to current template"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCheatsheet(!showCheatsheet)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1" /> API Cheatsheet
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => runScript(candles)}
              disabled={status === "running"}
              className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
            >
              <Play className="h-3 w-3 fill-current" />
              Run & Apply (Ctrl+↵)
            </Button>
          </div>
        </div>

        {/* ── Cheatsheet Banner (Collapsible) ── */}
        {showCheatsheet && (
          <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/20 text-xs text-foreground/90 space-y-1.5 animate-in slide-in-from-top-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-primary text-[11px] uppercase tracking-wider">
                Python Environment & Scope
              </span>
              <button
                onClick={() => setShowCheatsheet(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div>
                <strong className="text-foreground">Provided Variables:</strong>{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">candles</code> (list
                of dicts), <code className="text-primary bg-background px-1 py-0.5 rounded">closes</code>,{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">highs</code>,{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">lows</code>,{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">opens</code>,{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">times</code>,{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">volumes</code>
              </div>
              <div>
                <strong className="text-foreground">Output Format:</strong> Assign to{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">output = {"{"} "plots": [...] {"}"}</code>{" "}
                with <code className="text-primary bg-background px-1 py-0.5 rounded">type</code> (&quot;line&quot;, &quot;histogram&quot;, &quot;area&quot;) and{" "}
                <code className="text-primary bg-background px-1 py-0.5 rounded">pane</code> (&quot;overlay&quot; or &quot;below&quot;).
              </div>
            </div>
          </div>
        )}

        {/* ── Code Editor Body ── */}
        <div className="relative flex-1 min-h-0 flex bg-[#0d1117] text-[#c9d1d9] font-mono text-xs overflow-hidden">
          {/* Line Numbers Gutter */}
          <div
            ref={lineNumbersRef}
            className="w-12 py-3 pr-2.5 text-right select-none bg-[#090d13] text-[#484f58] border-r border-[#21262d] overflow-hidden"
          >
            {lineNumbers.map((num) => (
              <div key={num} className="leading-5">
                {num}
              </div>
            ))}
          </div>

          {/* Textarea Code Input */}
          <textarea
            ref={textareaRef}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="# Write your Python indicator code here..."
            className="flex-1 p-3 bg-transparent text-[#e6edf3] font-mono text-xs leading-5 resize-none focus:outline-none overflow-y-auto whitespace-pre selection:bg-primary/30"
          />
        </div>

        {/* ── Console / Outputs Drawer ── */}
        <div className="h-44 border-t border-border flex flex-col bg-card">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/70 bg-secondary/25">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("console")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  activeTab === "console"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Terminal className="h-3 w-3" /> Console Logs ({logs.length})
              </button>
              <button
                onClick={() => setActiveTab("plots")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  activeTab === "plots"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3 w-3" /> Active Plots ({plots.length})
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {runner && <span>Engine: <span className="font-mono text-foreground">{runner}</span></span>}
              <span>Candles: <span className="font-mono text-foreground">{candles.length}</span></span>
            </div>
          </div>

          <div className="flex-1 p-3 font-mono text-xs overflow-y-auto bg-background/50">
            {error && (
              <div className="p-2 mb-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Execution Error
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[11px]">{error}</pre>
              </div>
            )}

            {activeTab === "console" && (
              <div className="space-y-1">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground italic text-[11px]">
                    No print outputs. Use print(...) in your Python script to log data here.
                  </p>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="text-muted-foreground leading-relaxed">
                      <span className="text-primary/70 mr-1.5">&gt;</span>
                      <span className="text-foreground/90">{log}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "plots" && (
              <div className="space-y-2">
                {plots.length === 0 ? (
                  <p className="text-muted-foreground italic text-[11px]">
                    No plots returned yet. Click &quot;Run & Apply&quot; to generate plots.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {plots.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full border border-black/20"
                            style={{ backgroundColor: p.color || "#38bdf8" }}
                          />
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-muted">
                            {p.type || "line"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-muted">
                            {p.pane || "overlay"}
                          </span>
                          <span className="font-mono text-foreground font-semibold">
                            {p.data.length} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Dialog Footer ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-secondary/20">
          <div className="text-[11px] text-muted-foreground">
            {candles.length > 0
              ? `Processing ${candles.length} bars from active chart`
              : "No chart bars available"}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                runScript(candles);
              }}
              disabled={status === "running"}
              className="h-8 text-xs bg-primary text-primary-foreground font-medium"
            >
              Apply to Chart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
