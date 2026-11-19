import type { Symbol } from "../schemas.ts";
import { getCustomSymbols, toTerminalSymbol, deleteCustomDataset } from "./storage.ts";
import { invalidateSeriesCache } from "../demo/candles.ts";
import { refreshDemoFeedCursors } from "../demo/feed.ts";

const STORAGE_KEY = "opentradechart_custom_symbols_meta";

function readCachedSymbols(): Symbol[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function writeCachedSymbols(symbols: Symbol[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {}
}

let customSymbolsCache: Symbol[] = readCachedSymbols();
let isInitialized = false;

export const CUSTOM_SYMBOLS_EVENT = "opentradechart:custom-symbols-updated";

export async function initCustomSymbols(): Promise<Symbol[]> {
  try {
    const list = await getCustomSymbols();
    customSymbolsCache = list.map(toTerminalSymbol);
    writeCachedSymbols(customSymbolsCache);
    isInitialized = true;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CUSTOM_SYMBOLS_EVENT, { detail: customSymbolsCache }));
    }
    return customSymbolsCache;
  } catch (err) {
    console.warn("Failed to init custom symbols:", err);
    return customSymbolsCache;
  }
}

export function getCustomSymbolsSync(): Symbol[] {
  if (!isInitialized && typeof window !== "undefined") {
    // Trigger background sync with IndexedDB
    void initCustomSymbols();
  }
  return customSymbolsCache;
}

export async function refreshCustomSymbols(): Promise<Symbol[]> {
  const symbols = await initCustomSymbols();
  refreshDemoFeedCursors();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CUSTOM_SYMBOLS_EVENT, { detail: symbols }));
  }
  return symbols;
}

export async function removeCustomSymbol(symbolName: string): Promise<void> {
  await deleteCustomDataset(symbolName);
  invalidateSeriesCache(symbolName);
  await refreshCustomSymbols();
}
