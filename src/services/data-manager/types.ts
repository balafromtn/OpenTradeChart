import type { Candle } from "../schemas.ts";

export interface CustomSymbolMetadata {
  symbol: string;
  displayName: string;
  category: "CRYPTO" | "COMMODITY" | "FOREX" | "STOCK" | "INDICES" | string;
  tickSize: number;
  contractSize?: number;
  importedAt: string;
  sourceFileName?: string;
  totalParsedBars: number;
  firstDate?: string;
  lastDate?: string;
  timeframes: string[];
}

export interface ParseOptions {
  symbolName: string;
  displayName: string;
  category: string;
  tickSize: number;
  filterWeekends: boolean;
  filterDeadBars: boolean;
  maxBarsPerTimeframe?: number;
}

export interface ParseResult {
  metadata: CustomSymbolMetadata;
  series: Record<string, Candle[]>;
  rawCsv?: string;
  summary: {
    totalRawRows: number;
    cleanM1Bars: number;
    dateStart: string;
    dateEnd: string;
    timeframeCounts: Record<string, number>;
  };
}
