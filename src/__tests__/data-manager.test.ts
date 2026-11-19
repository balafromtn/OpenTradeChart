import { describe, it, expect } from "vitest";
import { parseCsvText } from "../services/data-manager/parser.ts";

describe("Custom Data Manager CSV Parser", () => {
  it("parses valid CSV with millisecond timestamps and cleans dead bars", () => {
    const csvData = [
      "timestamp,open,high,low,close,volume",
      "1767308400000,4323.5,4332.8,4323.5,4328.2,10.5",
      "1767308460000,4328.2,4331.9,4328.0,4328.8,8.2",
      "1767308520000,4328.8,4328.8,4328.8,4328.8,0.0", // dead bar (open==high==low==close with volume 0)
      "1767308580000,4328.8,4330.2,4327.8,4329.9,12.0",
    ].join("\n");

    const result = parseCsvText(csvData, {
      symbolName: "XAUUSD",
      displayName: "Gold",
      category: "COMMODITY",
      tickSize: 0.01,
      filterWeekends: false,
      filterDeadBars: true,
      maxBarsPerTimeframe: 1000,
    });

    expect(result.metadata.symbol).toBe("XAUUSD");
    expect(result.metadata.displayName).toBe("Gold");
    expect(result.metadata.category).toBe("COMMODITY");
    expect(result.summary.totalRawRows).toBe(4);
    expect(result.summary.cleanM1Bars).toBe(3); // dead bar was filtered out
    expect(result.series["1m"]).toBeDefined();
    expect(result.series["1m"]!.length).toBe(3);
  });

  it("handles ISO date strings and case-insensitive column headers", () => {
    const csvData = [
      "Date,Open,High,Low,Close,Vol",
      "2026-01-01 10:00:00,100,105,99,104,500",
      "2026-01-01 10:01:00,104,106,103,105,600",
    ].join("\n");

    const result = parseCsvText(csvData, {
      symbolName: "TEST",
      displayName: "Test Asset",
      category: "STOCK",
      tickSize: 0.01,
      filterWeekends: false,
      filterDeadBars: false,
    });

    expect(result.metadata.symbol).toBe("TEST");
    expect(result.summary.cleanM1Bars).toBe(2);
    expect(result.series["1m"]![0]!.open).toBe(100);
    expect(result.series["1m"]![1]!.close).toBe(105);
  });

  it("resamples 1m bars into higher timeframes with proper OHLCV aggregation", () => {
    const bars: string[] = ["timestamp,open,high,low,close,volume"];
    // 5 one-minute bars = 1 five-minute bar
    // Choose baseTs as an exact multiple of 300
    const baseTs = 1700000000 - (1700000000 % 300); // 1699999800
    bars.push(`${(baseTs + 0) * 1000},100,110,95,105,10`);
    bars.push(`${(baseTs + 60) * 1000},105,115,102,112,20`);
    bars.push(`${(baseTs + 120) * 1000},112,114,108,109,15`);
    bars.push(`${(baseTs + 180) * 1000},109,118,106,117,25`);
    bars.push(`${(baseTs + 240) * 1000},117,120,115,119,30`);

    const result = parseCsvText(bars.join("\n"), {
      symbolName: "RESAMPLE_TEST",
      displayName: "Resample Test",
      category: "CRYPTO",
      tickSize: 0.01,
      filterWeekends: false,
      filterDeadBars: false,
    });

    // 1m timeframe should have 5 bars
    expect(result.series["1m"]!.length).toBe(5);

    // 5m timeframe should have 1 bar
    expect(result.series["5m"]!.length).toBe(1);
    const bar5m = result.series["5m"]![0]!;
    expect(bar5m.open).toBe(100); // first open
    expect(bar5m.high).toBe(120); // max high
    expect(bar5m.low).toBe(95); // min low
    expect(bar5m.close).toBe(119); // last close
    expect(bar5m.volume).toBe(100); // sum of volumes (10+20+15+25+30)
  });

  it("throws a clear error if required columns are missing", () => {
    const invalidCsv = "timestamp,foo,bar\n1700000000,1,2";
    expect(() =>
      parseCsvText(invalidCsv, {
        symbolName: "FAIL",
        displayName: "Fail",
        category: "STOCK",
        tickSize: 0.01,
        filterWeekends: false,
        filterDeadBars: false,
      }),
    ).toThrow(/Could not detect required OHLC columns/);
  });
});
