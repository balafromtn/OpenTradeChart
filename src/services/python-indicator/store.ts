import { create } from "zustand";
import { safeStorage } from "../../lib/safe-storage.ts";
import type { Candle } from "../schemas.ts";
import { executePythonIndicator } from "./runner.ts";
import { PYTHON_TEMPLATES } from "./templates.ts";
import type { PythonPlotConfig } from "./types.ts";

const STORAGE_KEY_CODE = "oc_custom_python_indicator_code";
const STORAGE_KEY_ENABLED = "oc_custom_python_indicator_enabled";
const STORAGE_KEY_TEMPLATE = "oc_custom_python_indicator_template";

const DEFAULT_TEMPLATE = PYTHON_TEMPLATES[0]!;

interface PythonIndicatorState {
  script: string;
  enabled: boolean;
  selectedTemplateId: string;
  plots: PythonPlotConfig[];
  logs: string[];
  status: "idle" | "running" | "success" | "error";
  error: string | null;
  executionTimeMs: number;
  runner: string | null;

  setScript: (script: string) => void;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  loadTemplate: (templateId: string) => void;
  runScript: (candles: Candle[]) => Promise<boolean>;
  clearPlots: () => void;
}

export const usePythonIndicatorStore = create<PythonIndicatorState>((set, get) => ({
  script: safeStorage.getItem(STORAGE_KEY_CODE) || DEFAULT_TEMPLATE.script,
  enabled: safeStorage.getItem(STORAGE_KEY_ENABLED) === "true",
  selectedTemplateId: safeStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE.id,
  plots: [],
  logs: [],
  status: "idle",
  error: null,
  executionTimeMs: 0,
  runner: null,

  setScript: (script: string) => {
    safeStorage.setItem(STORAGE_KEY_CODE, script);
    set({ script });
  },

  setEnabled: (enabled: boolean) => {
    safeStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    set({ enabled });
  },

  toggleEnabled: () => {
    const next = !get().enabled;
    safeStorage.setItem(STORAGE_KEY_ENABLED, String(next));
    set({ enabled: next });
  },

  loadTemplate: (templateId: string) => {
    const found = PYTHON_TEMPLATES.find((t) => t.id === templateId);
    if (!found) return;
    safeStorage.setItem(STORAGE_KEY_TEMPLATE, found.id);
    safeStorage.setItem(STORAGE_KEY_CODE, found.script);
    set({
      selectedTemplateId: found.id,
      script: found.script,
      error: null,
      status: "idle",
    });
  },

  runScript: async (candles: Candle[]) => {
    const { script } = get();
    set({ status: "running", error: null });

    try {
      const res = await executePythonIndicator(script, candles);

      if (res.success) {
        set({
          status: "success",
          plots: res.plots,
          logs: res.logs || [],
          error: null,
          executionTimeMs: res.executionTimeMs || 0,
          runner: res.runner || null,
          enabled: true, // Auto-enable on successful run
        });
        safeStorage.setItem(STORAGE_KEY_ENABLED, "true");
        return true;
      } else {
        set({
          status: "error",
          error: res.error || "Script failed",
          logs: res.logs || [],
          executionTimeMs: res.executionTimeMs || 0,
          runner: res.runner || null,
        });
        return false;
      }
    } catch (err: any) {
      set({
        status: "error",
        error: err?.message || String(err),
        logs: [],
      });
      return false;
    }
  },

  clearPlots: () => {
    set({ plots: [], status: "idle", error: null });
  },
}));
