import type { Candle } from "../schemas.ts";
import type { ParseOptions, ParseResult, CustomSymbolMetadata } from "./types.ts";

export const RESAMPLE_TIMEFRAMES: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};

interface RawBar {
  time: number; // Unix epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Parses raw timestamp values into epoch seconds.
 * Supports:
 * - epoch ms (e.g. 1767308400000)
 * - epoch sec (e.g. 1767308400)
 * - ISO string / date string (e.g. "2024-05-10 12:30:00", "2024.05.10 12:30:00")
 */
function parseTimestamp(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check if purely numeric
  const num = Number(trimmed);
  if (!isNaN(num) && Number.isFinite(num)) {
    if (num > 1e11) return Math.floor(num / 1000); // ms -> s
    if (num > 1e8) return Math.floor(num); // s
  }

  // Normalize date string "2024.05.10" or "2024/05/10" -> "2024-05-10"
  const normalized = trimmed.replace(/(\d{4})[./](\d{2})[./](\d{2})/, "$1-$2-$3");
  const parsed = Date.parse(normalized);
  if (!isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }

  return null;
}

export function parseCsvText(
  csvText: string,
  options: ParseOptions,
): ParseResult {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2 || !lines[0]) {
    throw new Error("CSV file does not contain enough data (minimum header + 1 row required).");
  }

  // Detect delimiter: comma, semicolon, tab
  const headerLine = lines[0].trim();
  let delimiter = ",";
  if (headerLine.includes("\t")) delimiter = "\t";
  else if (headerLine.includes(";")) delimiter = ";";

  const headers = headerLine.toLowerCase().split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const timeIdx = headers.findIndex((h) => ["timestamp", "time", "datetime", "date"].includes(h));
  const openIdx = headers.findIndex((h) => ["open", "o"].includes(h));
  const highIdx = headers.findIndex((h) => ["high", "h"].includes(h));
  const lowIdx = headers.findIndex((h) => ["low", "l"].includes(h));
  const closeIdx = headers.findIndex((h) => ["close", "c"].includes(h));
  const volIdx = headers.findIndex((h) => ["volume", "vol", "v"].includes(h));

  if (timeIdx === -1 || openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error(
      `Could not detect required OHLC columns. Found headers: [${headers.join(", ")}]. Expected timestamp, open, high, low, close.`,
    );
  }

  const rawBars: RawBar[] = [];
  let totalRawRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;
    totalRawRows++;

    const cols = line.split(delimiter);
    if (cols.length <= Math.max(timeIdx, openIdx, highIdx, lowIdx, closeIdx)) continue;

    const timeCol = cols[timeIdx];
    const openCol = cols[openIdx];
    const highCol = cols[highIdx];
    const lowCol = cols[lowIdx];
    const closeCol = cols[closeIdx];
    if (timeCol == null || openCol == null || highCol == null || lowCol == null || closeCol == null) {
      continue;
    }

    const ts = parseTimestamp(timeCol);
    if (ts == null) continue;

    const open = parseFloat(openCol);
    const high = parseFloat(highCol);
    const low = parseFloat(lowCol);
    const close = parseFloat(closeCol);
    const vol = volIdx !== -1 && cols[volIdx] ? parseFloat(cols[volIdx]!) : 0;

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    // 1. Weekend filter: remove Saturdays (in JS getUTCDay() === 6 is Saturday)
    if (options.filterWeekends) {
      const day = new Date(ts * 1000).getUTCDay();
      if (day === 6) continue;
    }

    // 2. Dead bar filter: open == high == low == close with 0 volume
    if (options.filterDeadBars) {
      if (open === close && high === low && (vol === 0 || isNaN(vol))) {
        continue;
      }
    }

    rawBars.push({
      time: ts,
      open,
      high,
      low,
      close,
      volume: isNaN(vol) ? 0 : vol,
    });
  }

  if (rawBars.length === 0) {
    throw new Error("No valid candlestick rows found after parsing and filtering.");
  }

  // Sort chronologically and drop duplicates
  rawBars.sort((a, b) => a.time - b.time);
  const dedupedBars: RawBar[] = [];
  for (let i = 0; i < rawBars.length; i++) {
    const current = rawBars[i];
    const prev = rawBars[i - 1];
    if (current && (!prev || current.time !== prev.time)) {
      dedupedBars.push(current);
    }
  }

  const maxBars = options.maxBarsPerTimeframe ?? 2000;
  const seriesMap: Record<string, Candle[]> = {};
  const timeframeCounts: Record<string, number> = {};

  // Resample to all standard timeframes
  for (const [tf, sec] of Object.entries(RESAMPLE_TIMEFRAMES)) {
    // Group into time buckets
    const bucketMap = new Map<
      number,
      { open: number; high: number; low: number; close: number; volume: number }
    >();

    for (const bar of dedupedBars) {
      let bucketTime: number;
      if (tf === "1w") {
        // Monday 00:00:00 UTC alignment
        bucketTime = Math.floor((bar.time - 4 * 86400) / sec) * sec + 4 * 86400;
      } else {
        bucketTime = Math.floor(bar.time / sec) * sec;
      }

      const existing = bucketMap.get(bucketTime);
      if (!existing) {
        bucketMap.set(bucketTime, {
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
        });
      } else {
        existing.high = Math.max(existing.high, bar.high);
        existing.low = Math.min(existing.low, bar.low);
        existing.close = bar.close;
        existing.volume += bar.volume;
      }
    }

    const candles: Candle[] = [];
    for (const [t, vals] of bucketMap.entries()) {
      candles.push({
        time: t,
        open: Number(vals.open.toFixed(4)),
        high: Number(vals.high.toFixed(4)),
        low: Number(vals.low.toFixed(4)),
        close: Number(vals.close.toFixed(4)),
        volume: Number(vals.volume.toFixed(4)),
      });
    }

    candles.sort((a, b) => a.time - b.time);
    const sliced = maxBars > 0 && candles.length > maxBars ? candles.slice(-maxBars) : candles;
    seriesMap[tf] = sliced;
    timeframeCounts[tf] = sliced.length;
  }

  const firstBar = dedupedBars[0];
  const lastBar = dedupedBars[dedupedBars.length - 1];
  const firstDate = firstBar ? new Date(firstBar.time * 1000).toISOString().split("T")[0] ?? "" : "";
  const lastDate = lastBar ? new Date(lastBar.time * 1000).toISOString().split("T")[0] ?? "" : "";

  const metadata: CustomSymbolMetadata = {
    symbol: options.symbolName.toUpperCase().trim(),
    displayName: options.displayName.trim() || options.symbolName.toUpperCase().trim(),
    category: options.category || "COMMODITY",
    tickSize: options.tickSize || 0.01,
    contractSize: options.category === "COMMODITY" ? 100 : 1,
    importedAt: new Date().toISOString(),
    totalParsedBars: dedupedBars.length,
    firstDate,
    lastDate,
    timeframes: Object.keys(RESAMPLE_TIMEFRAMES),
  };

  return {
    metadata,
    series: seriesMap,
    rawCsv: csvText,
    summary: {
      totalRawRows,
      cleanM1Bars: dedupedBars.length,
      dateStart: firstDate,
      dateEnd: lastDate,
      timeframeCounts,
    },
  };
}
