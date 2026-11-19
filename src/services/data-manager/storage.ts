import type { Candle, Symbol } from "../schemas.ts";
import type { CustomSymbolMetadata } from "./types.ts";

const DB_NAME = "opentradechart_custom_data_v1";
const DB_VERSION = 1;
const STORE_SYMBOLS = "symbols";
const STORE_SERIES = "series";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not supported in this environment"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SYMBOLS)) {
          db.createObjectStore(STORE_SYMBOLS, { keyPath: "symbol" });
        }
        if (!db.objectStoreNames.contains(STORE_SERIES)) {
          db.createObjectStore(STORE_SERIES);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return dbPromise;
}

/**
 * Requests durable storage permission from the browser.
 * When granted, browser cache cleaning will not evict IndexedDB data.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export async function getCustomSymbols(): Promise<CustomSymbolMetadata[]> {
  try {
    const db = await getDb();
    const idbSymbols = await new Promise<CustomSymbolMetadata[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SYMBOLS, "readonly");
      const store = tx.objectStore(STORE_SYMBOLS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (idbSymbols.length > 0) {
      return idbSymbols;
    }

    // Cache / Site-Data Recovery:
    // If IndexedDB is empty (e.g. user cleared browser cache/cookies),
    // automatically restore datasets from the local disk backend (data/custom/symbols.json)
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/custom-data/list");
        if (res.ok) {
          const diskSymbols: CustomSymbolMetadata[] = await res.json();
          if (Array.isArray(diskSymbols) && diskSymbols.length > 0) {
            // Re-populate IndexedDB with the recovered symbols
            const writeTx = db.transaction(STORE_SYMBOLS, "readwrite");
            const symStore = writeTx.objectStore(STORE_SYMBOLS);
            for (const s of diskSymbols) {
              symStore.put(s);
            }
            return diskSymbols;
          }
        }
      } catch {
        // Offline or non-dev environment
      }
    }

    return [];
  } catch (err) {
    console.warn("Failed to load custom symbols from IndexedDB:", err);
    return [];
  }
}

export async function getCustomSymbol(symbol: string): Promise<CustomSymbolMetadata | undefined> {
  try {
    const db = await getDb();
    const result = await new Promise<CustomSymbolMetadata | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_SYMBOLS, "readonly");
      const store = tx.objectStore(STORE_SYMBOLS);
      const req = store.get(symbol);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result) return result;

    // Fallback: check symbols list
    const all = await getCustomSymbols();
    return all.find((s) => s.symbol === symbol);
  } catch {
    return undefined;
  }
}

export async function saveCustomDataset(
  metadata: CustomSymbolMetadata,
  seriesMap: Record<string, Candle[]>,
  rawCsv?: string,
): Promise<void> {
  // 1. Save to browser IndexedDB
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_SYMBOLS, STORE_SERIES], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const symStore = tx.objectStore(STORE_SYMBOLS);
    symStore.put(metadata);

    const seriesStore = tx.objectStore(STORE_SERIES);
    for (const [tf, candles] of Object.entries(seriesMap)) {
      seriesStore.put(candles, `${metadata.symbol}_${tf}`);
    }
  });

  // Request browser storage persistence so browser cache cleans won't evict it
  void requestStoragePersistence();

  // 2. Physical File System Backup (/data/custom/):
  // Sync to local disk backend so it permanently survives clearing browser cache or cookies
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/custom-data/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, seriesMap, rawCsv }),
      });
    } catch (err) {
      console.debug("[storage] local disk backup skipped (offline or prod):", err);
    }
  }
}

export async function getCustomCandles(
  symbol: string,
  timeframe: string,
): Promise<Candle[] | undefined> {
  try {
    const db = await getDb();
    const idbCandles = await new Promise<Candle[] | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_SERIES, "readonly");
      const store = tx.objectStore(STORE_SERIES);
      const req = store.get(`${symbol}_${timeframe}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (idbCandles && idbCandles.length > 0) {
      return idbCandles;
    }

    // Cache / Site-Data Recovery:
    // If candles are missing in IndexedDB, fetch from the local disk backend (data/custom/<symbol>/<tf>.json)
    if (typeof window !== "undefined") {
      try {
        const res = await fetch(
          `/api/custom-data/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(timeframe)}`,
        );
        if (res.ok) {
          const diskCandles: Candle[] = await res.json();
          if (Array.isArray(diskCandles) && diskCandles.length > 0) {
            // Re-populate IndexedDB for next time
            const writeTx = db.transaction(STORE_SERIES, "readwrite");
            const seriesStore = writeTx.objectStore(STORE_SERIES);
            seriesStore.put(diskCandles, `${symbol}_${timeframe}`);
            return diskCandles;
          }
        }
      } catch {
        // Offline
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function deleteCustomDataset(symbol: string): Promise<void> {
  const db = await getDb();
  const meta = await getCustomSymbol(symbol);
  const timeframes = meta?.timeframes || ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_SYMBOLS, STORE_SERIES], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const symStore = tx.objectStore(STORE_SYMBOLS);
    symStore.delete(symbol);

    const seriesStore = tx.objectStore(STORE_SERIES);
    for (const tf of timeframes) {
      seriesStore.delete(`${symbol}_${tf}`);
    }
  });

  // Also delete from physical local disk
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/custom-data/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
    } catch {
      // ignore
    }
  }
}

export function toTerminalSymbol(meta: CustomSymbolMetadata): Symbol {
  return {
    id: meta.symbol,
    name: meta.symbol,
    displayName: meta.displayName || meta.symbol,
    category: meta.category || "COMMODITY",
    contractSize: meta.contractSize ?? (meta.category === "COMMODITY" ? 100 : 1),
    tickSize: meta.tickSize || 0.01,
    tickValue: meta.tickSize || 0.01,
    marginPercent: 1,
    maxLeverage: 100,
    commission: 0,
    swapLong: 0,
    swapShort: 0,
    tradingHoursStart: null,
    tradingHoursEnd: null,
    isActive: true,
  };
}
