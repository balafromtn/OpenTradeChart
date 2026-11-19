import type { Candle } from "../schemas.ts";
import type { PythonIndicatorResult, PythonPlotConfig } from "./types.ts";

let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

/**
 * Load Pyodide WebAssembly runner dynamically when requested in the browser.
 */
async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    // Check if pyodide script is already on page
    if (!(window as any).loadPyodide) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide WebAssembly runtime from CDN."));
        document.head.appendChild(script);
      });
    }

    const pyodide = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodideLoadingPromise;
}

/**
 * Normalizes user script output into standard PythonPlotConfig array.
 */
function normalizeOutput(rawOutput: any): PythonPlotConfig[] {
  if (!rawOutput) return [];

  // Case 1: output is { plots: [...] }
  if (typeof rawOutput === "object" && Array.isArray(rawOutput.plots)) {
    return rawOutput.plots.map((p: any, idx: number) => ({
      name: String(p.name || `Plot ${idx + 1}`),
      type: p.type === "histogram" || p.type === "area" ? p.type : "line",
      color: typeof p.color === "string" ? p.color : undefined,
      lineWidth: typeof p.lineWidth === "number" ? p.lineWidth : 2,
      lineStyle: p.lineStyle || "solid",
      pane: p.pane === "below" ? "below" : "overlay",
      data: Array.isArray(p.data)
        ? p.data.filter((d: any) => d && typeof d.time === "number" && typeof d.value === "number")
        : [],
    }));
  }

  // Case 2: output is directly an array of points: [{ time, value }, ...]
  if (Array.isArray(rawOutput)) {
    return [
      {
        name: "Python Indicator",
        type: "line",
        color: "#38bdf8",
        lineWidth: 2,
        lineStyle: "solid",
        pane: "overlay",
        data: rawOutput.filter(
          (d: any) => d && typeof d.time === "number" && typeof d.value === "number",
        ),
      },
    ];
  }

  return [];
}

/**
 * Execute Python script using Vite Dev Server backend (Local Python interpreter).
 */
async function runViaBackendApi(
  script: string,
  candles: Candle[],
): Promise<PythonIndicatorResult> {
  const start = performance.now();
  const res = await fetch("/api/python-indicator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script,
      candles: candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Backend API error (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const elapsed = Math.round(performance.now() - start);

  if (!json.success) {
    return {
      success: false,
      plots: [],
      error: json.error || "Script execution failed on backend",
      logs: json.logs || [],
      executionTimeMs: elapsed,
      runner: "local-python",
    };
  }

  return {
    success: true,
    plots: normalizeOutput(json.output || json.plots),
    logs: json.logs || [],
    executionTimeMs: elapsed,
    runner: "local-python",
  };
}

/**
 * Execute Python script using Pyodide in WebAssembly (browser sandbox).
 */
async function runViaPyodide(
  script: string,
  candles: Candle[],
): Promise<PythonIndicatorResult> {
  const start = performance.now();
  const pyodide = await getPyodide();

  // Prepare input data
  const candleList = candles.map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume || 0,
  }));

  pyodide.globals.set("candles", candleList);
  pyodide.globals.set("opens", candleList.map((c) => c.open));
  pyodide.globals.set("highs", candleList.map((c) => c.high));
  pyodide.globals.set("lows", candleList.map((c) => c.low));
  pyodide.globals.set("closes", candleList.map((c) => c.close));
  pyodide.globals.set("volumes", candleList.map((c) => c.volume));
  pyodide.globals.set("times", candleList.map((c) => c.time));

  // Capture stdout
  const logs: string[] = [];
  pyodide.setStdout({ batched: (msg: string) => logs.push(msg) });

  try {
    const wrappedScript = `
import json

output = None
plots = None
result = None

${script}

final_res = output if output is not None else (plots if plots is not None else result)
json.dumps(final_res)
`;

    const rawJsonStr = await pyodide.runPythonAsync(wrappedScript);
    const elapsed = Math.round(performance.now() - start);
    const parsed = rawJsonStr ? JSON.parse(rawJsonStr) : null;

    return {
      success: true,
      plots: normalizeOutput(parsed),
      logs,
      executionTimeMs: elapsed,
      runner: "pyodide",
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      success: false,
      plots: [],
      error: err?.message || String(err),
      logs,
      executionTimeMs: elapsed,
      runner: "pyodide",
    };
  }
}

/**
 * Main execution entrypoint:
 * Tries the local Python backend first. If unavailable, falls back to in-browser Pyodide.
 */
export async function executePythonIndicator(
  script: string,
  candles: Candle[],
): Promise<PythonIndicatorResult> {
  if (!candles || candles.length === 0) {
    return {
      success: false,
      plots: [],
      error: "No candle data available to compute indicator.",
      logs: [],
    };
  }

  // 1. Try local dev-server / Node.js backend
  try {
    return await runViaBackendApi(script, candles);
  } catch (backendErr: any) {
    console.info(
      "[PythonIndicator] Local server endpoint not reachable, attempting Pyodide WebAssembly runner...",
      backendErr.message,
    );
  }

  // 2. Try in-browser Pyodide
  try {
    return await runViaPyodide(script, candles);
  } catch (pyodideErr: any) {
    return {
      success: false,
      plots: [],
      error: `Execution error: ${pyodideErr?.message || String(pyodideErr)}. Ensure local Python server is running or Pyodide can load.`,
      logs: [],
      runner: "pyodide",
    };
  }
}
